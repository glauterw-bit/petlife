"""Painel do administrador — KPIs de uso do app.

Acesso restrito por e-mail (env ADMIN_EMAILS, separado por vírgula;
default = dono do app). Segurança real é ESTE guard no servidor — o
frontend só esconde/mostra o link.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user
from models import (
    User, Pet, Vaccine, Exam, Reminder, WalkSession, PetStory, PetExpense,
    QuotaUsage, IapTransaction, PetActivityLog, Anamnesis, UsageEvent,
    PetWeightHistory, PetBehaviorLog, PasswordResetRequest,
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
        u = await count(select(func.count(func.distinct(UsageEvent.user_id))).where(UsageEvent.event == "app_open", UsageEvent.created_at >= day, UsageEvent.created_at < nxt))
        opens_by_day.append({"day": day.strftime("%d/%m"), "opens": c, "users": u})

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


# ─── Mapa de usuários ─────────────────────────────────────────────────────────
# Localização aproximada: 1º ponto GPS do passeio mais recente do usuário;
# fallback: DDD do telefone → centróide do estado. Só o admin vê.
DDD_STATE = {
    **{d: ("SP", -23.55, -46.63) for d in (11,12,13,14,15,16,17,18,19)},
    21: ("RJ", -22.91, -43.17), 22: ("RJ", -22.91, -43.17), 24: ("RJ", -22.91, -43.17),
    27: ("ES", -20.32, -40.34), 28: ("ES", -20.32, -40.34),
    **{d: ("MG", -19.92, -43.94) for d in (31,32,33,34,35,37,38)},
    **{d: ("PR", -25.43, -49.27) for d in (41,42,43,44,45,46)},
    **{d: ("SC", -27.59, -48.55) for d in (47,48,49)},
    **{d: ("RS", -30.03, -51.23) for d in (51,53,54,55)},
    61: ("DF", -15.79, -47.88), 62: ("GO", -16.68, -49.25), 64: ("GO", -16.68, -49.25),
    63: ("TO", -10.18, -48.33), 65: ("MT", -15.60, -56.10), 66: ("MT", -15.60, -56.10),
    67: ("MS", -20.44, -54.65), 68: ("AC", -9.97, -67.81), 69: ("RO", -8.76, -63.90),
    **{d: ("BA", -12.97, -38.51) for d in (71,73,74,75,77)},
    79: ("SE", -10.91, -37.07), 81: ("PE", -8.05, -34.90), 87: ("PE", -8.05, -34.90),
    82: ("AL", -9.67, -35.74), 83: ("PB", -7.12, -34.88), 84: ("RN", -5.79, -35.21),
    85: ("CE", -3.72, -38.54), 88: ("CE", -3.72, -38.54), 86: ("PI", -5.09, -42.80), 89: ("PI", -5.09, -42.80),
    91: ("PA", -1.46, -48.50), 93: ("PA", -1.46, -48.50), 94: ("PA", -1.46, -48.50),
    92: ("AM", -3.12, -60.02), 97: ("AM", -3.12, -60.02), 95: ("RR", 2.82, -60.67),
    96: ("AP", 0.03, -51.07), 98: ("MA", -2.53, -44.30), 99: ("MA", -2.53, -44.30),
}


def _ddd_from_phone(phone: str | None):
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("55") and len(digits) >= 12:
        digits = digits[2:]
    if len(digits) >= 10:
        try:
            return int(digits[:2])
        except ValueError:
            return None
    return None


@router.get("/users/locations")
async def admin_user_locations(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users = (await db.execute(select(User))).scalars().all()

    # passeio mais recente com rota, por usuário
    walks = (await db.execute(
        select(WalkSession.user_id, WalkSession.route_points)
        .where(WalkSession.route_points.is_not(None))
        .order_by(WalkSession.user_id, WalkSession.started_at.desc())
    )).all()
    gps_by_user = {}
    for uid, pts in walks:
        if uid in gps_by_user or not pts:
            continue
        try:
            p = pts[0]
            gps_by_user[uid] = (round(float(p["lat"]), 2), round(float(p["lng"]), 2))
        except Exception:
            continue

    out, by_state = [], {}
    for u in users:
        lat = lng = None
        source = None
        state = None
        if u.id in gps_by_user:
            lat, lng = gps_by_user[u.id]
            source = "gps"
        else:
            ddd = _ddd_from_phone(u.phone)
            if ddd and ddd in DDD_STATE:
                state, lat, lng = DDD_STATE[ddd]
                source = "ddd"
        if lat is None:
            continue
        if state is None:
            # tenta achar estado pelo DDD mesmo com GPS (pro resumo)
            ddd = _ddd_from_phone(u.phone)
            state = DDD_STATE.get(ddd, (None,))[0] if ddd else None
        if state:
            by_state[state] = by_state.get(state, 0) + 1
        out.append({"id": u.id, "name": u.name, "lat": lat, "lng": lng, "source": source, "state": state})

    # País e cidade (derivados de IP no login — ver geo_service). O mapa por
    # GPS/DDD só enxergava Brasil; isto mostra de onde o mundo está chegando.
    by_country, by_city, estrangeiros = {}, {}, []
    for u in users:
        cc = getattr(u, "geo_country", None)
        if not cc:
            continue
        by_country[cc] = by_country.get(cc, 0) + 1
        cidade = getattr(u, "geo_city", None)
        if cidade:
            chave = f"{cidade}|{cc}"
            by_city[chave] = by_city.get(chave, 0) + 1
        if cc != "BR":
            estrangeiros.append({
                "id": u.id, "name": u.name, "country": cc,
                "city": getattr(u, "geo_city", None),
                "region": getattr(u, "geo_region", None),
            })

    return {
        "located": len(out), "total_users": len(users),
        "by_state": sorted(([{"state": k, "count": v} for k, v in by_state.items()]), key=lambda x: -x["count"]),
        "points": out,
        "geo_located": sum(by_country.values()),
        "by_country": sorted([{"country": k, "count": v} for k, v in by_country.items()], key=lambda x: -x["count"]),
        "by_city": sorted(
            [{"city": k.split("|")[0], "country": k.split("|")[1], "count": v} for k, v in by_city.items()],
            key=lambda x: -x["count"])[:15],
        "foreign_users": estrangeiros,
    }


# ─── Pedidos de redefinição de senha (enquanto não há SMTP) ──────────────────
@router.get("/reset-requests")
async def list_reset_requests(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Fila de tutores que pediram redefinição — resolver em 1 clique."""
    rows = (await db.execute(
        select(PasswordResetRequest)
        .where(PasswordResetRequest.resolved_at.is_(None))
        .order_by(PasswordResetRequest.created_at.desc()).limit(100)
    )).scalars().all()

    ids = [r.user_id for r in rows if r.user_id]
    users = {}
    if ids:
        for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all():
            users[u.id] = u

    out = []
    for r in rows:
        u = users.get(r.user_id)
        out.append({
            "id": r.id,
            "email": r.email,
            "name": u.name if u else None,
            "phone": u.phone if u else None,
            "created_at": r.created_at.isoformat(),
        })
    return {"pending": len(out), "requests": out}


@router.post("/reset-requests/{req_id}/code")
async def generate_reset_code(
    req_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Gera o código de redefinição e devolve a mensagem pronta pro WhatsApp."""
    import secrets as _secrets

    r = (await db.execute(
        select(PasswordResetRequest).where(PasswordResetRequest.id == req_id)
    )).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    u = (await db.execute(select(User).where(User.email == r.email))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    code = f"{_secrets.randbelow(900000) + 100000}"
    u.password_reset_code = code
    u.password_reset_expires = datetime.utcnow() + timedelta(minutes=30)
    r.resolved_at = datetime.utcnow()
    await db.commit()

    primeiro = (u.name or "").split(" ")[0] or "tutor"
    link = "https://petlife-frontend-production.up.railway.app/auth/reset"
    msg = (
        f"Oi, {primeiro}! Aqui é o suporte do PetLife 🐾\n\n"
        f"Seu código para redefinir a senha é: {code}\n\n"
        f"Use em: {link}\n"
        f"(e-mail: {u.email})\n\n"
        f"O código vale por 30 minutos."
    )
    phone = "".join(ch for ch in (u.phone or "") if ch.isdigit())
    if phone and not phone.startswith("55"):
        phone = "55" + phone

    return {
        "code": code,
        "email": u.email,
        "name": u.name,
        "phone": u.phone,
        "message": msg,
        "whatsapp_url": (f"https://wa.me/{phone}?text=" + quote(msg)) if phone else None,
        "expires_in_minutes": 30,
    }


@router.get("/ai-topics")
async def ai_topics_report(
    days: int = 90,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """O que os tutores mais perguntam à Vyron IA — por TEMA.

    Privacidade: o texto das perguntas nunca é armazenado; só a categoria
    (classificada localmente em ai_topics.py).
    """
    import ai_topics
    from models import AiTopicLog

    since = datetime.utcnow() - timedelta(days=max(1, min(days, 365)))

    rows = (await db.execute(
        select(AiTopicLog.topic, func.count(AiTopicLog.id).label("n"))
        .where(AiTopicLog.created_at >= since)
        .group_by(AiTopicLog.topic)
        .order_by(func.count(AiTopicLog.id).desc())
    )).all()

    total = sum(n for _t, n in rows)
    by_species = (await db.execute(
        select(AiTopicLog.species, func.count(AiTopicLog.id))
        .where(AiTopicLog.created_at >= since, AiTopicLog.species.is_not(None))
        .group_by(AiTopicLog.species)
    )).all()

    return {
        "total": total,
        "days": days,
        "topics": [
            {
                "topic": t,
                "label": ai_topics.label(t),
                "count": n,
                "pct": round(n * 100 / total, 1) if total else 0,
            }
            for t, n in rows
        ],
        "by_species": {s: n for s, n in by_species},
    }
