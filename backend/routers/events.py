"""Telemetria própria (leve, LGPD-friendly): eventos de uso pro painel admin.
Só grava user_id + nome do evento — nenhum conteúdo/PII no evento."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from auth import get_current_user
from models import User, UsageEvent

_limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/events", tags=["Telemetria"])

# Whitelist — evento fora daqui é descartado (400)
ALLOWED = {
    "app_open",        # abertura do app (1x por sessão do navegador/app)
    "plans_view",      # visitou a tela de planos
    "paywall_shown",   # bateu na quota e viu o modal de upgrade
    "recap_share",     # compartilhou o recap do mês
    "carteirinha_share",
}


class EventIn(BaseModel):
    event: str


async def track_event(db: AsyncSession, user_id: int, event: str) -> None:
    """Uso interno (server-side) — não valida whitelist, não levanta exceção."""
    try:
        db.add(UsageEvent(user_id=user_id, event=event))
        await db.flush()
    except Exception:
        pass


@router.post("", status_code=204)
@_limiter.limit("120/hour")
async def post_event(
    request: Request,
    body: EventIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.event not in ALLOWED:
        raise HTTPException(status_code=400, detail="Evento desconhecido")
    await track_event(db, current_user.id, body.event)
