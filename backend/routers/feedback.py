"""Feedback dos usuários — pesquisa de satisfação e sugestões de melhoria.

O app mostra um popup (1x por usuário) pedindo nota + sugestões. Aqui a gente
grava, evita duplicata por usuário/origem e expõe a leitura só pro admin.
"""
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Feedback, User
from auth import get_current_user

router = APIRouter(prefix="/feedback", tags=["Feedback"])

DEFAULT_ADMINS = "glauterw@gmail.com"


def _admin_emails() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS", DEFAULT_ADMINS)
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


class FeedbackCreate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    likes_most: Optional[str] = Field(None, max_length=2000)
    suggestion: Optional[str] = Field(None, max_length=2000)
    can_contact: bool = False
    source: Optional[str] = Field("popup", max_length=40)


@router.get("/status")
async def feedback_status(
    source: str = "popup",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Diz se este usuário já respondeu — o popup usa pra não repetir."""
    res = await db.execute(
        select(func.count(Feedback.id)).where(
            Feedback.user_id == current_user.id, Feedback.source == source
        )
    )
    return {"answered": (res.scalar() or 0) > 0}


@router.post("")
async def create_feedback(
    data: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not any([data.rating, (data.likes_most or "").strip(), (data.suggestion or "").strip()]):
        raise HTTPException(status_code=400, detail="Envie ao menos uma nota ou um comentário.")

    # idempotente por usuário+origem: se já respondeu, atualiza em vez de duplicar
    res = await db.execute(
        select(Feedback).where(
            Feedback.user_id == current_user.id, Feedback.source == data.source
        )
    )
    fb = res.scalars().first()
    if fb is None:
        fb = Feedback(user_id=current_user.id, source=data.source)
        db.add(fb)

    fb.rating = data.rating
    fb.likes_most = (data.likes_most or "").strip() or None
    fb.suggestion = (data.suggestion or "").strip() or None
    fb.can_contact = bool(data.can_contact)
    fb.created_at = datetime.utcnow()

    await db.commit()
    await db.refresh(fb)
    return {"ok": True, "id": fb.id}


@router.get("")
async def list_feedback(
    limit: int = 200,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leitura restrita ao admin — alimenta o painel."""
    if (current_user.email or "").lower() not in _admin_emails():
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador.")

    res = await db.execute(
        select(Feedback, User.name, User.email)
        .join(User, User.id == Feedback.user_id)
        .order_by(desc(Feedback.created_at))
        .limit(min(limit, 500))
    )
    rows = res.all()

    ratings = [f.rating for f, _, _ in rows if f.rating]
    return {
        "total": len(rows),
        "avg_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
        "items": [
            {
                "id": f.id,
                "rating": f.rating,
                "likes_most": f.likes_most,
                "suggestion": f.suggestion,
                "can_contact": f.can_contact,
                "source": f.source,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "user_name": name,
                "user_email": email if f.can_contact else None,
            }
            for f, name, email in rows
        ],
    }
