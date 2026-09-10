"""Canal de suporte dentro do app — conversa direta tutor ↔ admin.

Uma thread por usuário. O admin responde pelo painel; cada lado é avisado
por e-mail quando a outra parte escreve (fire-and-forget, nunca bloqueia).
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from html import escape

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from auth import get_current_user
from models import User, SupportMessage
from routers.events import track_event
from routers.admin_stats import require_admin, _admin_emails
from email_service import send_email

_limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/support", tags=["Suporte"])

APP_URL = "https://petlife-frontend-production.up.railway.app"


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: int
    sender: str
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


def _notify_admin(user: User, body: str) -> None:
    """Avisa o(s) admin(s) por e-mail que chegou mensagem nova. Nunca levanta."""
    preview = escape(body[:400])
    html = (
        f"<p><b>{escape(user.name or user.email)}</b> ({escape(user.email)}) "
        f"mandou mensagem no suporte do PetLife:</p>"
        f"<blockquote style='border-left:3px solid #14b8a6;padding-left:12px'>{preview}</blockquote>"
        f"<p><a href='{APP_URL}/admin'>Responder no painel de atendimento</a></p>"
    )
    for admin_email in _admin_emails():
        asyncio.ensure_future(send_email(
            admin_email, f"💬 Suporte PetLife — {user.name or user.email}", html
        ))


def _notify_user(user: User, body: str) -> None:
    """Avisa o tutor que o suporte respondeu. Nunca levanta."""
    preview = escape(body[:400])
    html = (
        f"<p>Oi, {escape((user.name or '').split(' ')[0] or 'tutor(a)')}! "
        f"O suporte do PetLife respondeu você:</p>"
        f"<blockquote style='border-left:3px solid #14b8a6;padding-left:12px'>{preview}</blockquote>"
        f"<p><a href='{APP_URL}/suporte'>Abrir a conversa no app</a> 🐾</p>"
    )
    asyncio.ensure_future(send_email(
        user.email, "💬 O suporte do PetLife respondeu você", html
    ))


# ── Lado do tutor ────────────────────────────────────────────────────────────

@router.get("/messages", response_model=list[MessageOut])
async def my_messages(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.user_id == current_user.id)
        .order_by(SupportMessage.created_at.asc())
        .limit(300)
    )
    msgs = list(res.scalars().all())
    # abrir a conversa = ler as respostas do admin
    await db.execute(
        update(SupportMessage)
        .where(
            SupportMessage.user_id == current_user.id,
            SupportMessage.sender == "admin",
            SupportMessage.read_at.is_(None),
        )
        .values(read_at=datetime.utcnow())
    )
    return msgs


@router.post("/messages", response_model=MessageOut, status_code=201)
@_limiter.limit("30/hour")
async def send_message(
    request: Request,
    data: MessageIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg = SupportMessage(user_id=current_user.id, sender="user", body=data.body.strip())
    db.add(msg)
    await track_event(db, current_user.id, "support_sent")
    await db.flush()
    await db.refresh(msg)
    _notify_admin(current_user, msg.body)
    return msg


@router.get("/unread")
async def my_unread(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    n = (await db.execute(
        select(func.count(SupportMessage.id)).where(
            SupportMessage.user_id == current_user.id,
            SupportMessage.sender == "admin",
            SupportMessage.read_at.is_(None),
        )
    )).scalar() or 0
    return {"unread": int(n)}


# ── Lado do admin (painel de atendimento) ────────────────────────────────────

@router.get("/admin/threads")
async def admin_threads(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Uma linha por usuário: última mensagem + quantas não lidas."""
    res = await db.execute(
        select(SupportMessage, User.name, User.email)
        .join(User, User.id == SupportMessage.user_id)
        .order_by(SupportMessage.created_at.desc())
        .limit(1000)
    )
    threads: dict[int, dict] = {}
    for m, name, email in res.all():
        t = threads.setdefault(m.user_id, {
            "user_id": m.user_id,
            "name": name,
            "email": email,
            "last_body": m.body[:140],
            "last_sender": m.sender,
            "last_at": m.created_at.isoformat(),
            "unread": 0,
        })
        if m.sender == "user" and m.read_at is None:
            t["unread"] += 1
    return {"threads": list(threads.values())}


@router.get("/admin/threads/{user_id}")
async def admin_thread(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    ures = await db.execute(select(User).where(User.id == user_id))
    user = ures.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    res = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.user_id == user_id)
        .order_by(SupportMessage.created_at.asc())
        .limit(300)
    )
    msgs = list(res.scalars().all())
    await db.execute(
        update(SupportMessage)
        .where(
            SupportMessage.user_id == user_id,
            SupportMessage.sender == "user",
            SupportMessage.read_at.is_(None),
        )
        .values(read_at=datetime.utcnow())
    )
    return {
        "user": {"id": user.id, "name": user.name, "email": user.email},
        "messages": [MessageOut.model_validate(m).model_dump(mode="json") for m in msgs],
    }


@router.post("/admin/threads/{user_id}", response_model=MessageOut, status_code=201)
async def admin_reply(
    user_id: int,
    data: MessageIn,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    ures = await db.execute(select(User).where(User.id == user_id))
    user = ures.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    msg = SupportMessage(user_id=user_id, sender="admin", body=data.body.strip())
    db.add(msg)
    await db.flush()
    await db.refresh(msg)
    _notify_user(user, msg.body)
    return msg
