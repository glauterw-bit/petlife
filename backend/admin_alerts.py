"""Avisos no celular do administrador (push): assinatura, cancelamento, suporte,
avaliação nova. Nunca levanta — um aviso que falha não pode derrubar a ação
que o disparou."""
from __future__ import annotations

import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User


def _admin_emails() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS", "glauterw@gmail.com")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


async def notify_admins(db: AsyncSession, key: str, kind: str, title: str, body: str) -> None:
    """`key` é a dedupe: o mesmo aviso nunca sai duas vezes."""
    try:
        import push_service
        if not push_service.configured():
            return
        from routers.push import _deliver
        admins = (await db.execute(select(User).where(User.email.in_(_admin_emails())))).scalars().all()
        for a in admins:
            await _deliver(db, a.id, f"adm:{key}:{a.id}"[:120], kind, title[:200], body[:300])
    except Exception:
        pass
