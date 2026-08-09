"""Painel do administrador — KPIs de uso do app.

Acesso restrito por e-mail (env ADMIN_EMAILS, separado por vírgula;
default = dono do app). Segurança real é ESTE guard no servidor — o
frontend só esconde/mostra o link.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user
from models import (
    User, Pet, Vaccine, Exam, Reminder, WalkSession, PetStory, PetExpense,
    QuotaUsage, IapTransaction, PetActivityLog, Anamnesis, UsageEvent,
    PetWeightHistory, PetBehaviorLog,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

DEFAULT_ADMINS = "glauterw@gmail.com"


def _admin_emails() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS", DEFAULT_ADMINS)
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.email or "").lower() not in _admin_emails():
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador.")
    return current_user


@router.get("/stats")
async def admin_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    d1, d7, d30 = now - timedelta(days=1), now - timedelta(days=7), now - timedelta(days=30)
    month_start = datetime(now.year, now.month, 1)

    async def count(q):
        return int((await db.execute(q)).scalar() or 0)

    # ── Usuários ──
    total_users = await count(select(func.count(User.id)))
    new_7d = await count(select(func.count(User.id)).where(User.created_at >= d7))
    new_30d = await count(select(func.count(User.id)).where(User.created_at >= d30))
    dau = await count(select(func.count(User.id)).where(User.last_seen_at >= d1))
    wau = await count(select(func.count(User.id)).where(User.last_seen_at >= d7))
    mau = await count(select(func.count(User.id)).where(User.last_seen_at >= d30))
    vets = await count(select(func.count(User.id)).where(User.is_vet == True))  # noqa: E712

    # Ativos 30d por sinais de uso (fallback histórico, já que last_seen começou agora)
    active_signals = set()
    for uid, in (await db.execute(select(WalkSession.user_id).where(WalkSession.started_at >= d30).distinct())).all():
        active_signals.add(uid)
    for uid, in (await db.execute(select(PetActivityLog.user_id).where(PetActivityLog.created_at >= d30).distinct())).all():
        active_signals.add(uid)
    month_str = f"{now.year:04d}-{now.month:02d}"
    for uid, in (await db.execute(select(QuotaUsage.user_id).where(QuotaUsage.month == month_str).distinct())).all():
        active_signals.add(uid)

    # ── Assinaturas ──
    tiers = {}
    for tier, c in (await db.execute(select(User.premium_tier, func.count(User.id)).group_by(User.premium_tier))).all():
        tiers[tier or "free"] = int(c)
    iap_tx = await count(select(func.count(IapTransaction.id)))

    # ── Conteúdo ──
    total_pets = await count(select(func.count(Pet.id)))
    species = {}
    for sp, c in (await db.execute(select(Pet.species, func.count(Pet.id)).group_by(Pet.species))).all():
        species[getattr(sp, "value", str(sp))] = int(c)
    total_vaccines = await count(select(func.count(Vaccine.id)))
    total_exams = await count(select(func.count(Exam.id)))
    total_reminders = await count(select(func.count(Reminder.id)))
    total_anamneses = await count(select(func.count(Anamnesis.id)))
    total_stories = await count(select(func.count(PetStory.id)))
    total_expenses = await count(select(func.count(PetExpense.id)))

    # ── Passeios ──
    walks_total = await count(select(func.count(WalkSession.id)).where(WalkSession.ended_at.is_not(None)))
    walks_30d = await count(select(func.count(WalkSession.id)).where(WalkSession.ended_at.is_not(None), WalkSession.started_at >= d30))
    km_total = float((await db.execute(select(func.coalesce(func.sum(WalkSession.distance_meters), 0.0)).where(WalkSession.ended_at.is_not(None)))).scalar() or 0) / 1000

    # ── IA (mês corrente) ──
    ai_chat_month = await count(select(func.coalesce(func.sum(QuotaUsage.ai_chat), 0)).where(QuotaUsage.month == month_str))
    ai_analysis_month = await count(select(func.coalesce(func.sum(QuotaUsage.ai_analysis), 0)).where(QuotaUsage.month == month_str))

    # ── Cadastros por mês (últimos 6) ──
    signups = []
    for i in range(5, -1, -1):
        y, m = now.year, now.month - i
        while m <= 0:
            y, m = y - 1, m + 12
        start = datetime(y, m, 1)
        end = datetime(y + (1 if m == 12 else 0), 1 if m == 12 else m + 1, 1)
        c = await count(select(func.count(User.id)).where(User.created_at >= start, User.created_at < end))
        signups.append({"month": f"{y:04d}-{m:02d}", "count": c})

    # ── Atividade recente (14 dias, por dia: walks + activity logs) ──
    activity = []
    for i in range(13, -1, -1):
        day = datetime(now.year, now.month, now.day) - timedelta(days=i)
        nxt = day + timedelta(days=1)
        w = await count(select(func.count(WalkSession.id)).where(WalkSession.started_at >= day, WalkSession.started_at < nxt))
        a = await count(select(func.count(PetActivityLog.id)).where(PetActivityLog.created_at >= day, PetActivityLog.created_at < nxt))
        activity.append({"day": day.strftime("%d/%m"), "events": w + a})

    # ── Aberturas do app (usage_events: app_open) ──
    opens_total = await count(select(func.count(UsageEvent.id)).where(UsageEvent.event == "app_open"))
    opens_30d = await count(select(func.count(UsageEvent.id)).where(UsageEvent.event == "app_open", UsageEvent.created_at >= d30))
    openers = await count(select(func.count(func.distinct(UsageEvent.user_id))).where(UsageEvent.event == "app_open"))
    # reabriram = usuários com app_open em 2+ DIAS distintos
    day_expr = func.date(UsageEvent.created_at)
    sub = select(UsageEvent.user_id, func.count(func.distinct(day_expr)).label("dias")).where(UsageEvent.event == "app_open").group_by(UsageEvent.user_id).subquery()
    reopeners = await count(select(func.count()).select_from(sub).where(sub.c.dias >= 2))
    opens_by_day = []
    for i in range(13, -1, -1):
        day = datetime(now.year, now.month, now.day) - timedelta(days=i)
        nxt = day + timedelta(days=1)
        c = await count(select(func.count(UsageEvent.id)).where(UsageEvent.event == "app_open", UsageEvent.created_at >= day, UsageEvent.created_at < nxt))
        opens_by_day.append({"day": day.strftime("%d/%m"), "opens": c})

    # ── Funções mais usadas (30d — tabelas de domínio + eventos + IA do mês) ──
    async def c30(model, col):
        return await count(select(func.count(model.id)).where(col >= d30))
    features = {
        "Passeios": await count(select(func.count(WalkSession.id)).where(WalkSession.started_at >= d30, WalkSession.ended_at.is_not(None))),
        "Vyron IA (chat)": ai_chat_month,
        "Análises de IA": ai_analysis_month,
        "Peso registrado": await c30(PetWeightHistory, PetWeightHistory.measured_at),
        "Check-in diário": await c30(PetBehaviorLog, PetBehaviorLog.logged_at),
        "Momentos (fotos)": await c30(PetStory, PetStory.created_at),
        "Gastos": await c30(PetExpense, PetExpense.spent_at),
        "Vacinas": await c30(Vaccine, Vaccine.created_at),
        "Exames": await c30(Exam, Exam.created_at),
        "Lembretes": await c30(Reminder, Reminder.created_at),
    }
    for ev, label in [("pdf_export", "PDF pro vet"), ("recap_view", "Recap do mês"), ("recap_share", "Recap compartilhado"), ("plans_view", "Tela de planos"), ("paywall_shown", "Paywall exibido"), ("enrichment", "Bem-estar IA")]:
        features[label] = await count(select(func.count(UsageEvent.id)).where(UsageEvent.event == ev, UsageEvent.created_at >= d30))
    top_features = sorted([{"name": k, "count": v} for k, v in features.items() if v > 0], key=lambda x: -x["count"])[:12]

    # ── Ativação & retenção ──
    with_pet = await count(select(func.count(func.distinct(Pet.user_id))))
    older_7d = await count(select(func.count(User.id)).where(User.created_at < d7))
    retained_7d = await count(select(func.count(User.id)).where(User.created_at < d7, User.last_seen_at >= d7))
    activation = {
        "signed_up": total_users,
        "created_pet": with_pet,
        "created_pet_pct": round(100 * with_pet / total_users, 1) if total_users else 0,
        "still_active_7d": wau,
        "still_active_30d": mau,
        "retained_7d": retained_7d,
        "retained_7d_base": older_7d,
        "retained_7d_pct": round(100 * retained_7d / older_7d, 1) if older_7d else 0,
    }

    return {
        "generated_at": now.isoformat(),
        "opens": {"total": opens_total, "last_30d": opens_30d, "unique_users": openers,
                  "reopeners": reopeners, "avg_per_user": round(opens_total / openers, 1) if openers else 0,
                  "by_day": opens_by_day},
        "top_features": top_features,
        "activation": activation,
        "users": {
            "total": total_users, "new_7d": new_7d, "new_30d": new_30d,
            "dau": dau, "wau": wau, "mau": mau,
            "active_30d_signals": len(active_signals),
            "vets": vets, "by_tier": tiers,
        },
        "revenue": {"iap_transactions": iap_tx, "paying_users": sum(v for k, v in tiers.items() if k != "free")},
        "content": {
            "pets": total_pets, "pets_by_species": species,
            "vaccines": total_vaccines, "exams": total_exams,
            "reminders": total_reminders, "anamneses": total_anamneses,
            "stories": total_stories, "expenses_entries": total_expenses,
        },
        "walks": {"total": walks_total, "last_30d": walks_30d, "km_total": round(km_total, 1)},
        "ai": {"chat_month": ai_chat_month, "analysis_month": ai_analysis_month, "month": month_str},
        "signups_by_month": signups,
        "activity_14d": activity,
    }


@router.get("/users")
async def admin_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 300,
):
    """Lista de usuários com contato e sinais de uso — pra análise de experiência."""
    rows = (await db.execute(
        select(User).order_by(User.last_seen_at.desc().nullslast(), User.created_at.desc()).limit(min(limit, 500))
    )).scalars().all()

    pets_by_user = dict((await db.execute(
        select(Pet.user_id, func.count(Pet.id)).group_by(Pet.user_id)
    )).all())
    opens_by_user = dict((await db.execute(
        select(UsageEvent.user_id, func.count(UsageEvent.id)).where(UsageEvent.event == "app_open").group_by(UsageEvent.user_id)
    )).all())
    walks_by_user = dict((await db.execute(
        select(WalkSession.user_id, func.count(WalkSession.id)).where(WalkSession.ended_at.is_not(None)).group_by(WalkSession.user_id)
    )).all())

    return {
        "total": len(rows),
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "tier": u.premium_tier or "free",
                "is_vet": bool(u.is_vet),
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_seen_at": u.last_seen_at.isoformat() if u.last_seen_at else None,
                "pets": int(pets_by_user.get(u.id, 0)),
                "opens": int(opens_by_user.get(u.id, 0)),
                "walks": int(walks_by_user.get(u.id, 0)),
            }
            for u in rows
        ],
    }
