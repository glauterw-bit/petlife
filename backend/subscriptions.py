"""Serviço de assinatura: resolução de tier efetivo + enforcement de quota.

Tier efetivo = premium_tier do usuário SE a assinatura ainda estiver válida
(premium_expires_at > agora). Caso contrário, free. Isso é "lazy expiry":
não precisamos de cron — qualquer checagem de tier já degrada pra free.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

import pricing
from models import User, Pet, QuotaUsage


def effective_tier(user: User, now: datetime | None = None) -> str:
    """Tier válido agora. 'pro'/'plus' só valem se a assinatura não expirou."""
    now = now or datetime.utcnow()
    tier = (user.premium_tier or "free")
    if tier == "free":
        return "free"
    if user.premium_expires_at and user.premium_expires_at > now:
        return tier
    return "free"


def _current_month(now: datetime | None = None) -> str:
    now = now or datetime.utcnow()
    return f"{now.year:04d}-{now.month:02d}"


async def _count_pets(db: AsyncSession, user_id: int) -> int:
    q = await db.execute(select(func.count(Pet.id)).where(Pet.user_id == user_id))
    return int(q.scalar() or 0)


async def _get_or_create_usage(db: AsyncSession, user_id: int) -> QuotaUsage:
    month = _current_month()
    q = await db.execute(
        select(QuotaUsage).where(QuotaUsage.user_id == user_id, QuotaUsage.month == month)
    )
    usage = q.scalar_one_or_none()
    if usage is None:
        usage = QuotaUsage(user_id=user_id, month=month, ai_chat=0, ai_analysis=0)
        db.add(usage)
        await db.flush()
    return usage


async def usage_snapshot(db: AsyncSession, user: User) -> dict:
    """Resumo de uso vs limite — pra tela de planos e badges de quota."""
    tier = effective_tier(user)
    limits = pricing.quotas_for_tier(tier)
    usage = await _get_or_create_usage(db, user.id)
    pets = await _count_pets(db, user.id)
    return {
        "tier": tier,
        "month": usage.month,
        "limits": limits,
        "used": {
            "pets": pets,
            "ai_chat": usage.ai_chat,
            "ai_analysis": usage.ai_analysis,
        },
    }


async def check_quota(db: AsyncSession, user: User, resource: str) -> None:
    """Levanta 402 se o usuário JÁ estourou a quota do recurso. Não incrementa.
    Chamar ANTES da ação. Para recursos mensais, consumir com consume_quota()
    só depois que a ação der certo (evita gastar quota se a IA falhar)."""
    tier = effective_tier(user)
    limit = pricing.quota_limit(tier, resource)
    if limit == pricing.UNLIMITED:
        return

    if resource == "pets":
        used = await _count_pets(db, user.id)
    else:
        usage = await _get_or_create_usage(db, user.id)
        used = getattr(usage, resource, 0)

    if used >= limit:
        raise _quota_error(resource, limit, tier)


async def consume_quota(db: AsyncSession, user: User, resource: str) -> None:
    """Incrementa o contador mensal do recurso (no-op p/ ilimitado e p/ 'pets').
    Chamar DEPOIS que a ação (ex: chamada de IA) deu certo."""
    tier = effective_tier(user)
    limit = pricing.quota_limit(tier, resource)
    if limit == pricing.UNLIMITED or resource == "pets":
        return
    usage = await _get_or_create_usage(db, user.id)
    setattr(usage, resource, getattr(usage, resource, 0) + 1)
    await db.flush()


def _quota_error(resource: str, limit: int, tier: str) -> HTTPException:
    label = pricing.RESOURCE_LABEL.get(resource, resource)
    suggestion = "Assine o PetLife Pro pra liberar acesso ilimitado." if tier != "free" \
        else "Assine o PetLife+ ou Pro pra liberar mais."
    return HTTPException(
        status_code=402,
        detail=f"Você atingiu o limite mensal de {label} do seu plano ({limit}). {suggestion}",
    )
