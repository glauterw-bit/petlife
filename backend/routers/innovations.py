"""Features inovadoras: Bedtime Story IA + Snapshot Triage por foto.
Reusa o pipeline Claude já configurado em ai_service.
"""
import base64
from datetime import datetime, timedelta
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models import Pet, User, PetWeightHistory, BehaviorPlan, BehaviorCheckIn, Vaccine, Exam, Anamnesis, Reminder, UserChallenge, PetBehaviorLog, PetStory, PetShare, PetRelation, PetActivityLog, Notification, WalkSession, pet_accessible_filter, log_pet_activity, notify_pet_collaborators
import secrets as _secrets
from sqlalchemy import or_
from database import settings as db_settings
import os, uuid
from auth import get_current_user
import ai_service
import subscriptions

_limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/innovations", tags=["Innovations"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _calculate_age(birth_date) -> str:
    if not birth_date:
        return ""
    now = datetime.utcnow()
    delta = now - birth_date
    years = delta.days // 365
    months = (delta.days % 365) // 30
    if years > 0:
        return f"{years} anos"
    return f"{months} meses"


# ─── Bedtime Story ────────────────────────────────────────────────────────────

class BedtimeStoryRequest(BaseModel):
    pet_id: int
    mood: Literal["carinhoso", "aventura", "engraçado", "calmo"] = "carinhoso"


@router.post("/bedtime-story")
@_limiter.limit("10/hour")
async def bedtime_story(
    request: Request,
    body: BedtimeStoryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gera história de boa noite (~2 min) personalizada com nome, raça, idade."""
    await subscriptions.check_quota(db, current_user, "ai_analysis")
    result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.breed))
        .where(Pet.id == body.pet_id, pet_accessible_filter(current_user.id))
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    pet_info = {
        "name": pet.name,
        "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
        "breed_name": pet.breed.name if pet.breed else "vira-lata",
        "age": _calculate_age(pet.birth_date),
        "owner_name": current_user.name.split()[0],
    }

    try:
        result = await ai_service.generate_bedtime_story(pet_info, mood=body.mood)
        await subscriptions.consume_quota(db, current_user, "ai_analysis")
        return result
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(
                status_code=503,
                detail="História indisponível: crédito da Anthropic API esgotado. Administrador deve recarregar em console.anthropic.com",
            )
        raise HTTPException(status_code=503, detail="Erro ao gerar história. Tente novamente.")


# ─── Pain Assessment (Grimace Scale / Glasgow) ───────────────────────────────

@router.post("/pain-assessment")
@_limiter.limit("20/hour")
async def pain_assessment(
    request: Request,
    pet_id: int = Form(...),
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Avaliação de dor por foto facial. Gato: Feline Grimace Scale. Cão: Glasgow."""
    await subscriptions.check_quota(db, current_user, "ai_analysis")
    media_type = (photo.content_type or "image/jpeg").lower()
    if media_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Formato inválido.")
    contents = await photo.read()
    if len(contents) > MAX_IMAGE_BYTES or not contents:
        raise HTTPException(status_code=400, detail="Imagem inválida.")

    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, pet_accessible_filter(current_user.id))
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    pet_info = {
        "name": pet.name,
        "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
    }
    b64 = base64.b64encode(contents).decode("ascii")
    try:
        r = await ai_service.assess_pet_pain(b64, media_type, pet_info)
        await subscriptions.consume_quota(db, current_user, "ai_analysis")
        r["pet_name"] = pet.name
        r["species"] = pet_info["species"]
        return r
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(status_code=503, detail="Avaliação indisponível: crédito Anthropic esgotado.")
        raise HTTPException(status_code=503, detail="Erro ao analisar foto.")


# ─── Stool Cam (Fecal Score) ──────────────────────────────────────────────────

@router.post("/stool-analysis")
@_limiter.limit("20/hour")
async def stool_analysis(
    request: Request,
    pet_id: int = Form(...),
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Análise visual de fezes — escala fecal 1-7, cor, alertas."""
    await subscriptions.check_quota(db, current_user, "ai_analysis")
    media_type = (photo.content_type or "image/jpeg").lower()
    if media_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Formato inválido.")
    contents = await photo.read()
    if len(contents) > MAX_IMAGE_BYTES or not contents:
        raise HTTPException(status_code=400, detail="Imagem inválida.")

    result = await db.execute(
        select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id))
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    pet_info = {
        "name": pet.name,
        "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
    }
    b64 = base64.b64encode(contents).decode("ascii")
    try:
        r = await ai_service.analyze_stool_from_image(b64, media_type, pet_info)
        await subscriptions.consume_quota(db, current_user, "ai_analysis")
        r["pet_name"] = pet.name
        return r
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(status_code=503, detail="Análise indisponível: crédito Anthropic esgotado.")
        raise HTTPException(status_code=503, detail="Erro ao analisar foto.")


# ─── Pet Weight History + Growth Chart ───────────────────────────────────────

class WeightEntry(BaseModel):
    weight_kg: float
    body_condition_score: Optional[int] = None
    source: Optional[str] = "manual"
    notes: Optional[str] = None
    measured_at: Optional[datetime] = None


@router.post("/pets/{pet_id}/weight")
async def add_weight(
    pet_id: int,
    body: WeightEntry,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    entry = PetWeightHistory(
        pet_id=pet_id,
        weight_kg=body.weight_kg,
        body_condition_score=body.body_condition_score,
        source=body.source or "manual",
        notes=body.notes,
        measured_at=body.measured_at or datetime.utcnow(),
    )
    db.add(entry)
    # Atualiza peso atual do pet também
    pet.weight = body.weight_kg
    actor_first = current_user.name.split()[0]
    await log_pet_activity(
        db, pet_id, current_user.id,
        action="weight_added",
        summary=f"{actor_first} registrou peso de {body.weight_kg} kg",
        meta={"weight_kg": body.weight_kg},
    )
    await notify_pet_collaborators(
        db, pet_id, current_user.id,
        type="weight_added",
        title=f"{actor_first} atualizou o peso de {pet.name}",
        body=f"{body.weight_kg} kg registrado",
        link=f"/pets/{pet_id}",
    )
    await db.commit()
    await db.refresh(entry)
    return {
        "id": entry.id,
        "weight_kg": entry.weight_kg,
        "measured_at": entry.measured_at.isoformat(),
        "body_condition_score": entry.body_condition_score,
    }


@router.get("/pets/{pet_id}/weight-history")
async def get_weight_history(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    hist_q = await db.execute(
        select(PetWeightHistory).where(PetWeightHistory.pet_id == pet_id).order_by(PetWeightHistory.measured_at)
    )
    history = hist_q.scalars().all()

    # Calcula alerta simples baseado na variação
    alert = None
    if len(history) >= 2:
        first = history[0].weight_kg
        last = history[-1].weight_kg
        if first > 0:
            pct = ((last - first) / first) * 100
            if pct > 15:
                alert = {"type": "ganho", "severity": "alta", "message": f"Ganho de {pct:.1f}% desde primeira medição. Avaliar com vet."}
            elif pct > 8:
                alert = {"type": "ganho", "severity": "media", "message": f"Ganho de {pct:.1f}%. Monitorar dieta e exercício."}
            elif pct < -15:
                alert = {"type": "perda", "severity": "alta", "message": f"Perda de {abs(pct):.1f}%. Consultar vet."}
            elif pct < -8:
                alert = {"type": "perda", "severity": "media", "message": f"Perda de {abs(pct):.1f}%. Monitorar apetite."}

    return {
        "pet_id": pet_id,
        "pet_name": pet.name,
        "breed_weight_range": pet.breed.weight_range if pet.breed else None,
        "current_weight": pet.weight,
        "entries": [
            {
                "id": h.id,
                "weight_kg": h.weight_kg,
                "body_condition_score": h.body_condition_score,
                "source": h.source,
                "measured_at": h.measured_at.isoformat(),
                "notes": h.notes,
            }
            for h in history
        ],
        "alert": alert,
    }


# ─── Pet Health Score ─────────────────────────────────────────────────────────

@router.get("/pets/{pet_id}/health-score")
async def get_health_score(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Score 0-100 de saúde/cuidado, cruzando vacinação, peso, atividade,
    bem-estar e constância. Atualizado a cada chamada (refletindo dados do dia)."""
    import health_score as hs
    from datetime import date as _date

    pet_q = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, pet_accessible_filter(current_user.id))
    )
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    today = _date.today()
    now = datetime.utcnow()
    species = pet.species.value if hasattr(pet.species, "value") else pet.species

    # 1) Vacinação — próximas doses
    vac_q = await db.execute(select(Vaccine.next_due).where(Vaccine.pet_id == pet_id))
    next_dues = [row[0] for row in vac_q.all()]
    dim_vac = hs.score_vaccination(next_dues, today)

    # 2) Peso — último BCS + tendência
    wh_q = await db.execute(
        select(PetWeightHistory).where(PetWeightHistory.pet_id == pet_id)
        .order_by(PetWeightHistory.measured_at.desc()).limit(5)
    )
    weights = wh_q.scalars().all()
    has_weight = len(weights) > 0
    last_bcs = weights[0].body_condition_score if weights else None
    trend = None
    if len(weights) >= 2 and weights[-1].weight_kg:
        diff = weights[0].weight_kg - weights[-1].weight_kg
        pct = (diff / weights[-1].weight_kg) * 100
        trend = "stable" if abs(pct) < 3 else ("up" if pct > 0 else "down")
    dim_weight = hs.score_weight(last_bcs, trend, has_weight)

    # 3) Atividade — passeios dos últimos 7 dias
    week_ago = now - timedelta(days=7)
    walk_q = await db.execute(
        select(WalkSession).where(
            WalkSession.pet_id == pet_id,
            WalkSession.ended_at.is_not(None),
            WalkSession.started_at >= week_ago,
        )
    )
    week_walks = walk_q.scalars().all()
    dist_7d = sum(w.distance_meters for w in week_walks)
    energy = pet.breed.energy_level if pet.breed else None
    dim_act = hs.score_activity(len(week_walks), dist_7d, species, energy)

    # 4) Bem-estar — behavior logs dos últimos 7 dias
    bl_q = await db.execute(
        select(PetBehaviorLog).where(
            PetBehaviorLog.pet_id == pet_id,
            PetBehaviorLog.logged_at >= week_ago,
        ).order_by(PetBehaviorLog.logged_at.desc())
    )
    logs = bl_q.scalars().all()
    dim_well = hs.score_wellbeing(
        [l.mood for l in logs],
        [l.appetite for l in logs],
        len(logs),
    )

    # 5) Constância — dias ativos nos últimos 14 dias (passeio OU peso OU log)
    fortnight = now - timedelta(days=14)
    active_days: set = set()
    for w in week_walks:
        active_days.add(w.started_at.date())
    walk14_q = await db.execute(
        select(WalkSession.started_at).where(
            WalkSession.pet_id == pet_id, WalkSession.started_at >= fortnight
        )
    )
    for (ts,) in walk14_q.all():
        if ts:
            active_days.add(ts.date())
    log14_q = await db.execute(
        select(PetBehaviorLog.logged_at).where(
            PetBehaviorLog.pet_id == pet_id, PetBehaviorLog.logged_at >= fortnight
        )
    )
    for (ts,) in log14_q.all():
        if ts:
            active_days.add(ts.date())
    wt14_q = await db.execute(
        select(PetWeightHistory.measured_at).where(
            PetWeightHistory.pet_id == pet_id, PetWeightHistory.measured_at >= fortnight
        )
    )
    for (ts,) in wt14_q.all():
        if ts:
            active_days.add(ts.date())
    dim_cons = hs.score_consistency(len(active_days))

    result = hs.compute_health_score({
        "vaccination": dim_vac,
        "weight": dim_weight,
        "activity": dim_act,
        "wellbeing": dim_well,
        "consistency": dim_cons,
    })
    result["pet_id"] = pet_id
    result["pet_name"] = pet.name
    result["computed_at"] = now.isoformat()
    # destaque acionável: pega a dimensão de menor score pra sugerir ação
    worst = min(result["breakdown"], key=lambda d: d["score"])
    result["top_action"] = {"key": worst["key"], "label": worst["label"], "message": worst["message"]}
    return result


# ─── Care Streak (sequência de dias cuidando) ────────────────────────────────

@router.get("/pets/{pet_id}/care-streak")
async def get_care_streak(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sequência de dias consecutivos com QUALQUER cuidado (passeio, check-in,
    peso, foto). Recompensa o hábito diário — base da retenção."""
    from datetime import date as _date

    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    horizon = datetime.utcnow() - timedelta(days=120)
    active_days: set = set()

    walk_q = await db.execute(
        select(WalkSession.started_at).where(
            WalkSession.pet_id == pet_id, WalkSession.started_at >= horizon
        )
    )
    for (ts,) in walk_q.all():
        if ts:
            active_days.add(ts.date())

    log_q = await db.execute(
        select(PetBehaviorLog.logged_at).where(
            PetBehaviorLog.pet_id == pet_id, PetBehaviorLog.logged_at >= horizon
        )
    )
    for (ts,) in log_q.all():
        if ts:
            active_days.add(ts.date())

    wt_q = await db.execute(
        select(PetWeightHistory.measured_at).where(
            PetWeightHistory.pet_id == pet_id, PetWeightHistory.measured_at >= horizon
        )
    )
    for (ts,) in wt_q.all():
        if ts:
            active_days.add(ts.date())

    story_q = await db.execute(
        select(PetStory.created_at).where(
            PetStory.pet_id == pet_id, PetStory.created_at >= horizon
        )
    )
    for (ts,) in story_q.all():
        if ts:
            active_days.add(ts.date())

    today = _date.today()
    if today in active_days:
        cursor = today
    elif (today - timedelta(days=1)) in active_days:
        cursor = today - timedelta(days=1)
    else:
        cursor = None
    current = 0
    while cursor is not None and cursor in active_days:
        current += 1
        cursor -= timedelta(days=1)

    best = 0
    if active_days:
        run = 0
        prev = None
        for d in sorted(active_days):
            if prev is not None and (d - prev).days == 1:
                run += 1
            else:
                run = 1
            best = max(best, run)
            prev = d

    did_today = today in active_days
    milestones = [3, 7, 14, 30, 60, 100]
    next_milestone = next((m for m in milestones if m > current), None)

    return {
        "pet_id": pet_id,
        "pet_name": pet.name,
        "current_streak": current,
        "best_streak": best,
        "did_today": did_today,
        "active_days_total": len(active_days),
        "next_milestone": next_milestone,
        "days_to_milestone": (next_milestone - current) if next_milestone else None,
    }


# ─── Health Forecast (previsão preventiva por IA) ────────────────────────────

@router.get("/pets/{pet_id}/health-forecast")
@_limiter.limit("10/hour")
async def get_health_forecast(
    request: Request,
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Previsão preventiva de saúde 6-12 meses por IA, baseada em raça, idade,
    peso e histórico. NÃO é diagnóstico — antecipa cuidados preventivos."""
    from health_protocols import get_age_phase

    await subscriptions.check_quota(db, current_user, "ai_analysis")

    pet_q = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, pet_accessible_filter(current_user.id))
    )
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    species = pet.species.value if hasattr(pet.species, "value") else pet.species

    # peso/tendência
    wh_q = await db.execute(
        select(PetWeightHistory).where(PetWeightHistory.pet_id == pet_id)
        .order_by(PetWeightHistory.measured_at.desc()).limit(5)
    )
    weights = wh_q.scalars().all()
    last_bcs = weights[0].body_condition_score if weights else None
    weight_trend = None
    if len(weights) >= 2 and weights[-1].weight_kg:
        diff = weights[0].weight_kg - weights[-1].weight_kg
        pct = (diff / weights[-1].weight_kg) * 100
        weight_trend = "estável" if abs(pct) < 3 else (f"ganho de {pct:.0f}%" if pct > 0 else f"perda de {abs(pct):.0f}%")

    # atividade recente
    week_ago = datetime.utcnow() - timedelta(days=14)
    walk_q = await db.execute(
        select(WalkSession).where(
            WalkSession.pet_id == pet_id, WalkSession.ended_at.is_not(None),
            WalkSession.started_at >= week_ago,
        )
    )
    n_walks = len(walk_q.scalars().all())
    activity_level = "alto" if n_walks >= 8 else ("moderado" if n_walks >= 3 else "baixo")

    breed_issues = None
    if pet.breed and getattr(pet.breed, "health_issues", None):
        hi = pet.breed.health_issues
        breed_issues = hi if isinstance(hi, list) else None

    pet_info = {
        "name": pet.name,
        "species": species,
        "breed_name": pet.breed.name if pet.breed else None,
        "age": _calculate_age(pet.birth_date),
        "age_phase": get_age_phase(species, pet.birth_date),
        "weight": pet.weight,
    }
    signals = {
        "weight_trend": weight_trend,
        "bcs": last_bcs,
        "neutered": pet.neutered,
        "activity_level": activity_level,
        "breed_health_issues": breed_issues,
    }

    try:
        result = await ai_service.generate_health_forecast(pet_info, signals)
        await subscriptions.consume_quota(db, current_user, "ai_analysis")
        result["pet_id"] = pet_id
        result["pet_name"] = pet.name
        return result
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(status_code=503, detail="Previsão indisponível: crédito Anthropic esgotado.")
        raise HTTPException(status_code=503, detail="Previsão indisponível no momento. Tente mais tarde.")


# ─── Behavior Plans ───────────────────────────────────────────────────────────

class BehaviorPlanCreate(BaseModel):
    pet_id: int
    issue_type: Literal["separation_anxiety", "fear", "reactivity", "aggression", "destruction", "barking", "cat_litter"]
    intensity: Literal["leve", "moderada", "alta"]
    context: Optional[str] = ""


@router.post("/behavior-plans")
@_limiter.limit("10/hour")
async def create_behavior_plan(
    request: Request,
    body: BehaviorPlanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == body.pet_id, pet_accessible_filter(current_user.id))
    )
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    pet_info = {
        "name": pet.name,
        "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
        "breed_name": pet.breed.name if pet.breed else "SRD",
        "age": _calculate_age(pet.birth_date),
    }

    try:
        plan_data = await ai_service.generate_behavior_plan(
            pet_info=pet_info,
            issue_type=body.issue_type,
            intensity=body.intensity,
            context=body.context or "",
        )
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(status_code=503, detail="Plano indisponível: crédito Anthropic esgotado.")
        raise HTTPException(status_code=503, detail="Erro ao gerar plano.")

    plan = BehaviorPlan(
        pet_id=body.pet_id,
        user_id=current_user.id,
        issue_type=body.issue_type,
        intensity=body.intensity,
        plan_data=plan_data,
        context_notes=body.context,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return {
        "id": plan.id,
        "pet_id": plan.pet_id,
        "pet_name": pet.name,
        "issue_type": plan.issue_type,
        "intensity": plan.intensity,
        "status": plan.status,
        "duration_weeks": plan.duration_weeks,
        "plan_data": plan.plan_data,
        "created_at": plan.created_at.isoformat(),
    }


@router.get("/behavior-plans")
async def list_behavior_plans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await db.execute(
        select(BehaviorPlan, Pet.name)
        .join(Pet, BehaviorPlan.pet_id == Pet.id)
        .where(BehaviorPlan.user_id == current_user.id)
        .order_by(BehaviorPlan.created_at.desc())
    )
    out = []
    for plan, pet_name in q.all():
        checkin_q = await db.execute(
            select(BehaviorCheckIn).where(BehaviorCheckIn.plan_id == plan.id)
        )
        checkins = checkin_q.scalars().all()
        out.append({
            "id": plan.id,
            "pet_id": plan.pet_id,
            "pet_name": pet_name,
            "issue_type": plan.issue_type,
            "intensity": plan.intensity,
            "status": plan.status,
            "duration_weeks": plan.duration_weeks,
            "created_at": plan.created_at.isoformat(),
            "completed_at": plan.completed_at.isoformat() if plan.completed_at else None,
            "check_ins_count": len(checkins),
            "average_progress": sum(c.progress_score for c in checkins) / len(checkins) if checkins else None,
        })
    return out


@router.get("/behavior-plans/{plan_id}")
async def get_behavior_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await db.execute(
        select(BehaviorPlan).options(selectinload(BehaviorPlan.check_ins)).where(
            BehaviorPlan.id == plan_id,
            BehaviorPlan.user_id == current_user.id,
        )
    )
    plan = q.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    return {
        "id": plan.id,
        "pet_id": plan.pet_id,
        "issue_type": plan.issue_type,
        "intensity": plan.intensity,
        "status": plan.status,
        "duration_weeks": plan.duration_weeks,
        "plan_data": plan.plan_data,
        "context_notes": plan.context_notes,
        "created_at": plan.created_at.isoformat(),
        "completed_at": plan.completed_at.isoformat() if plan.completed_at else None,
        "check_ins": [
            {
                "day_number": c.day_number,
                "progress_score": c.progress_score,
                "notes": c.notes,
                "completed_at": c.completed_at.isoformat(),
            }
            for c in sorted(plan.check_ins, key=lambda x: x.day_number)
        ],
    }


class CheckInRequest(BaseModel):
    day_number: int
    progress_score: int
    notes: Optional[str] = None


@router.post("/behavior-plans/{plan_id}/check-in")
async def behavior_check_in(
    plan_id: int,
    body: CheckInRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan_q = await db.execute(
        select(BehaviorPlan).where(BehaviorPlan.id == plan_id, BehaviorPlan.user_id == current_user.id)
    )
    plan = plan_q.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")

    if not (0 <= body.progress_score <= 10):
        raise HTTPException(status_code=400, detail="Score deve estar entre 0 e 10")

    checkin = BehaviorCheckIn(
        plan_id=plan_id,
        day_number=body.day_number,
        progress_score=body.progress_score,
        notes=body.notes,
    )
    db.add(checkin)

    # Marca plano como completo se passou da última semana
    total_days = plan.duration_weeks * 7
    if body.day_number >= total_days:
        plan.status = "completed"
        plan.completed_at = datetime.utcnow()

    await db.commit()
    return {"id": checkin.id, "day_number": body.day_number, "progress_score": body.progress_score}


# ─── PetLife Wrapped (yearly recap) ───────────────────────────────────────────

@router.get("/petlife-wrapped/{pet_id}")
@_limiter.limit("5/hour")
async def petlife_wrapped(
    request: Request,
    pet_id: int,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func, extract

    pet_q = await db.execute(select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    target_year = year or datetime.utcnow().year

    # Agrega dados do ano
    async def count_in_year(model, date_col):
        q = await db.execute(
            select(func.count()).select_from(model).where(
                model.pet_id == pet_id,
                extract("year", date_col) == target_year,
            )
        )
        return q.scalar() or 0

    vaccines_count = await count_in_year(Vaccine, Vaccine.date_given)
    exams_count = await count_in_year(Exam, Exam.date)
    anamneses_count = await count_in_year(Anamnesis, Anamnesis.created_at)
    weights_count = await count_in_year(PetWeightHistory, PetWeightHistory.measured_at)

    rem_q = await db.execute(
        select(func.count()).select_from(Reminder).where(
            Reminder.pet_id == pet_id,
            extract("year", Reminder.due_date) == target_year,
        )
    )
    reminders_count = rem_q.scalar() or 0

    chal_q = await db.execute(
        select(func.count(), func.sum(UserChallenge.points_earned)).select_from(UserChallenge).where(
            UserChallenge.pet_id == pet_id,
            UserChallenge.status == "completed",
            extract("year", UserChallenge.completed_at) == target_year,
        )
    )
    chal_row = chal_q.one()
    challenges_count = chal_row[0] or 0
    total_points = chal_row[1] or 0

    # Mês de mais atividade (baseado em soma de vacinas+exames+anamneses por mês)
    month_q = await db.execute(
        select(extract("month", Anamnesis.created_at).label("m"), func.count())
        .where(Anamnesis.pet_id == pet_id, extract("year", Anamnesis.created_at) == target_year)
        .group_by("m")
        .order_by(func.count().desc())
        .limit(1)
    )
    month_row = month_q.first()
    busiest_month_n = int(month_row[0]) if month_row else None
    busiest_month = {
        1: "janeiro", 2: "fevereiro", 3: "março", 4: "abril", 5: "maio", 6: "junho",
        7: "julho", 8: "agosto", 9: "setembro", 10: "outubro", 11: "novembro", 12: "dezembro",
    }.get(busiest_month_n, "ano todo")

    year_data = {
        "year": target_year,
        "vaccines_count": vaccines_count,
        "exams_count": exams_count,
        "anamneses_count": anamneses_count,
        "ai_chats_count": 0,  # nao trackeamos chat history ainda
        "reminders_count": reminders_count,
        "challenges_count": challenges_count,
        "total_points": int(total_points),
        "weights_count": weights_count,
        "photo_analyses_count": 0,  # nao trackeamos ainda
        "busiest_month": busiest_month,
    }

    pet_info = {
        "name": pet.name,
        "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
        "breed_name": pet.breed.name if pet.breed else "SRD",
    }

    try:
        wrapped = await ai_service.generate_petlife_wrapped(pet_info, year_data)
        wrapped["pet_name"] = pet.name
        wrapped["pet_id"] = pet.id
        wrapped["year"] = target_year
        wrapped["raw_stats"] = year_data
        return wrapped
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(status_code=503, detail="Wrapped indisponível: crédito Anthropic esgotado.")
        # Sem IA, retorna versão simples baseada apenas em dados
        return {
            "pet_name": pet.name,
            "pet_id": pet.id,
            "year": target_year,
            "title": f"O ano de {pet.name} em {target_year}",
            "subtitle": "Olha quanta coisa rolou esse ano!",
            "highlights": [
                {"emoji": "💉", "stat": vaccines_count, "label": "vacinas", "narrative": f"{vaccines_count} doses pra ficar protegido"},
                {"emoji": "🏥", "stat": exams_count, "label": "exames", "narrative": f"{exams_count} check-ups de saúde"},
                {"emoji": "🏆", "stat": challenges_count, "label": "desafios", "narrative": f"{challenges_count} desafios completos"},
                {"emoji": "⭐", "stat": total_points, "label": "pontos", "narrative": f"{total_points} pontos no ranking"},
            ],
            "narrative": f"{pet.name} teve um ano cheio de cuidados! Tudo registrado no PetLife.",
            "share_text": f"O ano de {pet.name} em {target_year} no PetLife 🐾",
            "raw_stats": year_data,
        }


# ─── Pet Behavior Log (daily check-in + pattern detection) ───────────────────

class BehaviorLogEntry(BaseModel):
    mood: Optional[Literal["feliz", "neutro", "apatico", "ansioso", "agitado"]] = None
    energy: Optional[int] = None  # 1-5
    appetite: Optional[Literal["normal", "reduzido", "aumentado", "recusou"]] = None
    water_intake: Optional[Literal["normal", "reduzido", "aumentado"]] = None
    stool_quality: Optional[int] = None  # 1-7
    activity_minutes: Optional[int] = None
    notes: Optional[str] = None


@router.post("/pets/{pet_id}/behavior-log")
async def add_behavior_log(
    pet_id: int,
    body: BehaviorLogEntry,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    log = PetBehaviorLog(pet_id=pet_id, **body.model_dump(exclude_none=True))
    db.add(log)
    actor_first = current_user.name.split()[0]
    await log_pet_activity(
        db, pet_id, current_user.id,
        action="behavior_logged",
        summary=f"{actor_first} registrou bem-estar ({body.mood or 'check-in'})",
        meta={"mood": body.mood, "appetite": body.appetite},
    )
    await notify_pet_collaborators(
        db, pet_id, current_user.id,
        type="behavior_logged",
        title=f"{actor_first} registrou bem-estar de {pet.name}",
        body=f"Humor: {body.mood or 'check-in'}",
        link=f"/pets/{pet_id}",
    )
    await db.commit()
    await db.refresh(log)
    return {"id": log.id, "logged_at": log.logged_at.isoformat()}


@router.get("/pets/{pet_id}/behavior-log")
async def get_behavior_logs(
    pet_id: int,
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    since = datetime.utcnow() - timedelta(days=days)
    logs_q = await db.execute(
        select(PetBehaviorLog)
        .where(PetBehaviorLog.pet_id == pet_id, PetBehaviorLog.logged_at >= since)
        .order_by(PetBehaviorLog.logged_at.desc())
    )
    logs = logs_q.scalars().all()
    return {
        "pet_id": pet_id,
        "pet_name": pet.name,
        "days_requested": days,
        "logs": [
            {
                "id": l.id,
                "logged_at": l.logged_at.isoformat(),
                "mood": l.mood,
                "energy": l.energy,
                "appetite": l.appetite,
                "water_intake": l.water_intake,
                "stool_quality": l.stool_quality,
                "activity_minutes": l.activity_minutes,
                "notes": l.notes,
            }
            for l in logs
        ],
    }


@router.get("/pets/{pet_id}/behavior-patterns")
@_limiter.limit("5/hour")
async def analyze_behavior(
    request: Request,
    pet_id: int,
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    since = datetime.utcnow() - timedelta(days=days)
    logs_q = await db.execute(
        select(PetBehaviorLog)
        .where(PetBehaviorLog.pet_id == pet_id, PetBehaviorLog.logged_at >= since)
        .order_by(PetBehaviorLog.logged_at)
    )
    logs = logs_q.scalars().all()
    if len(logs) < 5:
        return {
            "summary": f"Apenas {len(logs)} dias registrados. IA precisa de pelo menos 7 dias pra detectar padrões. Continue registrando!",
            "patterns": [],
            "alerts": [],
            "logs_count": len(logs),
        }

    pet_info = {"name": pet.name, "species": pet.species.value if hasattr(pet.species, "value") else pet.species}
    logs_data = [{
        "logged_at": l.logged_at.strftime("%Y-%m-%d"),
        "mood": l.mood, "energy": l.energy, "appetite": l.appetite,
        "water_intake": l.water_intake, "stool_quality": l.stool_quality,
        "activity_minutes": l.activity_minutes, "notes": l.notes,
    } for l in logs]

    try:
        result = await ai_service.analyze_behavior_patterns(pet_info, logs_data)
        result["logs_count"] = len(logs)
        return result
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(status_code=503, detail="Análise indisponível: crédito Anthropic esgotado.")
        raise HTTPException(status_code=503, detail="Erro na análise.")


# ─── Senior Longevity Protocol ────────────────────────────────────────────────

@router.get("/pets/{pet_id}/senior-protocol")
async def senior_protocol(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pets 7+ anos (cães) ou 10+ (gatos) ganham protocolo semestral curado."""
    pet_q = await db.execute(select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    if not pet.birth_date:
        return {"is_senior": False, "message": "Data de nascimento não informada — não dá pra calcular fase senior."}

    age_years = (datetime.utcnow() - pet.birth_date).days // 365
    species = pet.species.value if hasattr(pet.species, "value") else pet.species
    is_senior = (species == "dog" and age_years >= 7) or (species == "cat" and age_years >= 10)

    if not is_senior:
        return {
            "is_senior": False,
            "age_years": age_years,
            "species": species,
            "becomes_senior_at": "7 anos" if species == "dog" else "10 anos",
            "message": f"{pet.name} ainda não está na fase senior. Protocolo ativa automaticamente quando completar a idade.",
        }

    # Protocolo curado (rule-based, sem IA — confiável e gratuito)
    semestral_exams = [
        {"name": "Hemograma completo", "frequency": "semestral", "reason": "Detecção precoce de anemia, infecções, leucemia"},
        {"name": "Bioquímico (ureia, creatinina, ALT, FA, glicemia)", "frequency": "semestral", "reason": "Função renal e hepática"},
        {"name": "Urinálise (EAS)", "frequency": "semestral", "reason": "Doença renal crônica, diabetes, infecção urinária"},
        {"name": "Pressão arterial", "frequency": "semestral", "reason": "Hipertensão é comum em seniores e silenciosa"},
        {"name": "Avaliação cardíaca (ausculta + ECG anual)", "frequency": "anual", "reason": "Cardiopatias seniores"},
        {"name": "Exame oftalmológico", "frequency": "anual", "reason": "Catarata, glaucoma"},
        {"name": "Avaliação dental + limpeza", "frequency": "anual", "reason": "Doença periodontal afeta órgãos sistêmicos"},
    ]

    species_specific = []
    if species == "cat":
        species_specific = [
            {"name": "T4 total (tireoide)", "frequency": "anual", "reason": "Hipertireoidismo é a doença endócrina mais comum em gatas/os seniores"},
            {"name": "Teste FIV/FeLV (se acesso à rua)", "frequency": "anual", "reason": "Reavaliação imune"},
        ]
    else:
        species_specific = [
            {"name": "Radiografia ortopédica (quadril, coluna)", "frequency": "se sintomas", "reason": "Artrose, displasia"},
            {"name": "TSH/T4 (tireoide)", "frequency": "anual", "reason": "Hipotireoidismo canino senior"},
        ]

    supplements = [
        {"name": "Ômega-3 (EPA + DHA)", "purpose": "Anti-inflamatório, articulações, cognição"},
        {"name": "Glucosamina + condroitina", "purpose": "Cartilagem articular"},
        {"name": "SAM-e ou silimarina (se fígado alterado)", "purpose": "Hepatoprotetor"},
        {"name": "Antioxidantes (vit E, selênio)", "purpose": "Cognição e imunidade"},
    ]

    lifestyle = [
        "Ração senior específica (com restrição proteica controlada se função renal alterada)",
        "Exercício moderado diário — caminhadas curtas e frequentes",
        "Enriquecimento ambiental cognitivo (brinquedos de busca, jogos)",
        "Cama ortopédica pra articulações",
        "Hidratação reforçada (fontes para gatos, água sempre fresca)",
        "Monitorar sinais sutis: mudança de apetite, sede aumentada, perda de peso, mudança de comportamento",
    ]

    return {
        "is_senior": True,
        "pet_name": pet.name,
        "age_years": age_years,
        "species": species,
        "life_stage": "senior" if age_years < (12 if species == "dog" else 15) else "geriátrico",
        "exams_protocol": semestral_exams + species_specific,
        "supplements_to_discuss": supplements,
        "lifestyle_recommendations": lifestyle,
        "early_warning_signs": [
            "Perda de peso sem dieta",
            "Sede aumentada (poliúria/polidipsia)",
            "Apatia ou redução de interação",
            "Confusão noturna, latidos sem motivo",
            "Dificuldade de subir escadas ou no sofá",
            "Mau hálito forte (doença periodontal/renal)",
        ],
        "disclaimer": "Protocolo orientativo baseado em diretrizes AAHA Senior Care + Brasil. Adapte com seu veterinário de confiança.",
    }


# ─── Memorial Mode (sensible — end-of-life support) ──────────────────────────

class MemorialRequest(BaseModel):
    deceased_at: Optional[datetime] = None
    owner_message: Optional[str] = ""


@router.post("/pets/{pet_id}/memorial")
async def set_memorial(
    pet_id: int,
    body: MemorialRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, pet_accessible_filter(current_user.id))
    )
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    pet_info = {
        "name": pet.name,
        "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
        "age": (datetime.utcnow() - pet.birth_date).days // 365 if pet.birth_date else None,
    }
    age_str = f"{pet_info['age']} anos" if pet_info["age"] else ""

    try:
        memorial = await ai_service.generate_memorial_text({**pet_info, "age": age_str}, body.owner_message or "")
    except Exception:
        memorial = {
            "memorial_text": f"Em memória de {pet.name}. Para sempre em nossos corações.",
            "epitaph": f"Em memória de {pet.name}",
            "comfort_message": "Sinto muito pela sua perda. Que as boas memórias permaneçam.",
        }

    pet.is_deceased = True
    pet.deceased_at = body.deceased_at or datetime.utcnow()
    pet.memorial_text = memorial.get("memorial_text", "")
    pet.is_lost = False  # se estivesse marcado perdido
    await db.commit()

    return {
        "pet_id": pet.id,
        "pet_name": pet.name,
        "deceased_at": pet.deceased_at.isoformat(),
        "memorial_text": pet.memorial_text,
        "epitaph": memorial.get("epitaph"),
        "comfort_message": memorial.get("comfort_message"),
        "memorial_url": f"/memorial/{pet.id}",
    }


# Public endpoint pra página de memorial (sem auth)
@router.get("/public/memorial/{pet_id}", include_in_schema=False)
async def public_memorial(
    pet_id: int,
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(
        select(Pet).options(selectinload(Pet.breed), selectinload(Pet.owner)).where(Pet.id == pet_id)
    )
    pet = pet_q.scalar_one_or_none()
    if not pet or not pet.is_deceased:
        raise HTTPException(status_code=404, detail="Memorial não encontrado")

    age_years = (pet.deceased_at - pet.birth_date).days // 365 if pet.birth_date and pet.deceased_at else None

    return {
        "pet": {
            "name": pet.name,
            "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
            "breed": pet.breed.name if pet.breed else None,
            "photo": pet.photo,
            "birth_date": pet.birth_date.isoformat() if pet.birth_date else None,
            "deceased_at": pet.deceased_at.isoformat() if pet.deceased_at else None,
            "age_years": age_years,
        },
        "memorial_text": pet.memorial_text,
        "owner_name": pet.owner.name if pet.owner else None,
    }


# ─── Pet Stories (photo feed + AI captions) ──────────────────────────────────

@router.post("/pets/{pet_id}/stories")
@_limiter.limit("20/hour")
async def add_story(
    request: Request,
    pet_id: int,
    user_caption: str = Form(""),
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sobe foto + IA gera caption automática + emoção detectada."""
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    media_type = (photo.content_type or "image/jpeg").lower()
    if media_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Formato inválido.")

    contents = await photo.read()
    if len(contents) > MAX_IMAGE_BYTES or not contents:
        raise HTTPException(status_code=400, detail="Imagem inválida.")

    # Comprime antes de salvar
    from image_utils import compress_image
    try:
        contents, ext = compress_image(contents, max_dimension=1280, quality=80)
    except Exception:
        ext = ".jpg"

    upload_dir = os.path.join(db_settings.UPLOAD_DIR, "stories")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    photo_url = f"/uploads/stories/{filename}"

    # Caption IA (não bloqueia se falhar)
    ai_caption = None
    ai_emotion = None
    try:
        pet_info = {"name": pet.name, "species": pet.species.value if hasattr(pet.species, "value") else pet.species}
        b64 = base64.b64encode(contents).decode("ascii")
        cap = await ai_service.generate_story_caption(b64, "image/jpeg", pet_info)
        ai_caption = cap.get("caption")
        ai_emotion = cap.get("emotion")
    except Exception:
        pass

    story = PetStory(
        pet_id=pet_id,
        user_id=current_user.id,
        photo_url=photo_url,
        user_caption=user_caption or None,
        ai_caption=ai_caption,
        ai_emotion=ai_emotion,
    )
    db.add(story)
    actor_first = current_user.name.split()[0]
    await log_pet_activity(
        db, pet_id, current_user.id,
        action="story_created",
        summary=f"{actor_first} postou uma nova foto",
        meta={"photo_url": photo_url},
    )
    await notify_pet_collaborators(
        db, pet_id, current_user.id,
        type="story_created",
        title=f"{actor_first} postou uma foto de {pet.name}",
        body=ai_caption or user_caption or "Confira a nova foto",
        link=f"/pets/{pet_id}",
    )
    await db.commit()
    await db.refresh(story)

    return {
        "id": story.id,
        "pet_id": pet_id,
        "photo_url": photo_url,
        "user_caption": story.user_caption,
        "ai_caption": story.ai_caption,
        "ai_emotion": story.ai_emotion,
        "created_at": story.created_at.isoformat(),
    }


@router.get("/pets/{pet_id}/stories")
async def list_stories(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    stories_q = await db.execute(
        select(PetStory).where(PetStory.pet_id == pet_id).order_by(PetStory.created_at.desc())
    )
    stories = stories_q.scalars().all()
    return [
        {
            "id": s.id,
            "photo_url": s.photo_url,
            "user_caption": s.user_caption,
            "ai_caption": s.ai_caption,
            "ai_emotion": s.ai_emotion,
            "created_at": s.created_at.isoformat(),
        }
        for s in stories
    ]


@router.delete("/stories/{story_id}", status_code=204)
async def delete_story(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    story_q = await db.execute(select(PetStory).where(PetStory.id == story_id, PetStory.user_id == current_user.id))
    story = story_q.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story não encontrado")
    await db.delete(story)
    await db.commit()
    return None


# ─── Multi-tutor sharing ──────────────────────────────────────────────────────

class ShareInvite(BaseModel):
    email: str
    role: Literal["co_tutor", "sitter", "familia"] = "co_tutor"


async def _user_can_access_pet(db: AsyncSession, user: User, pet: Pet) -> bool:
    """Owner ou share aceito."""
    if pet.user_id == user.id:
        return True
    q = await db.execute(
        select(PetShare).where(
            PetShare.pet_id == pet.id,
            PetShare.user_id == user.id,
            PetShare.status == "accepted",
        )
    )
    return q.scalar_one_or_none() is not None


@router.post("/pets/{pet_id}/share")
@_limiter.limit("20/hour")
async def invite_share(
    request: Request,
    pet_id: int,
    body: ShareInvite,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apenas o owner original pode convidar (não cascading)."""
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, Pet.user_id == current_user.id))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado ou você não é o tutor principal")

    email = body.email.strip().lower()
    if email == current_user.email.lower():
        raise HTTPException(status_code=400, detail="Você já é o tutor desse pet")

    # Verifica se já existe convite pendente/aceito
    existing_q = await db.execute(
        select(PetShare).where(
            PetShare.pet_id == pet_id,
            PetShare.invite_email == email,
            PetShare.status.in_(["pending", "accepted"]),
        )
    )
    if existing_q.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Já existe convite ativo ou aceito pra esse e-mail")

    # Se o usuário já existe no app, vincula direto
    user_q = await db.execute(select(User).where(User.email == email))
    target_user = user_q.scalar_one_or_none()

    token = _secrets.token_urlsafe(32)
    share = PetShare(
        pet_id=pet_id,
        user_id=target_user.id if target_user else None,
        invite_email=email,
        invited_by_user_id=current_user.id,
        role=body.role,
        invite_token=token,
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return {
        "id": share.id,
        "invite_email": share.invite_email,
        "role": share.role,
        "status": share.status,
        "invite_token": token,
        "invited_at": share.invited_at.isoformat(),
        "share_url": f"/share/accept/{token}",
        "user_exists": target_user is not None,
    }


@router.get("/pets/{pet_id}/shares")
async def list_pet_shares(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = pet_q.scalar_one_or_none()
    if not pet or not await _user_can_access_pet(db, current_user, pet):
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    q = await db.execute(
        select(PetShare, User.name, User.email)
        .outerjoin(User, PetShare.user_id == User.id)
        .where(PetShare.pet_id == pet_id, PetShare.status != "revoked")
        .order_by(PetShare.invited_at.desc())
    )
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "invite_email": s.invite_email,
            "user_name": name,
            "user_email": user_email,
            "role": s.role,
            "status": s.status,
            "invited_at": s.invited_at.isoformat(),
            "accepted_at": s.accepted_at.isoformat() if s.accepted_at else None,
            "is_owner": s.user_id == pet.user_id,
            "invite_token": s.invite_token if s.status == "pending" else None,
        }
        for s, name, user_email in q.all()
    ]


@router.delete("/shares/{share_id}")
async def revoke_share(
    share_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await db.execute(select(PetShare).where(PetShare.id == share_id))
    share = q.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Compartilhamento não encontrado")

    pet_q = await db.execute(select(Pet).where(Pet.id == share.pet_id))
    pet = pet_q.scalar_one_or_none()
    if not pet or (pet.user_id != current_user.id and share.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="Apenas o tutor principal ou o próprio usuário pode revogar")

    share.status = "revoked"
    share.revoked_at = datetime.utcnow()
    await db.commit()
    return {"message": "Compartilhamento revogado"}


@router.get("/invites/received")
async def my_invites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await db.execute(
        select(PetShare, Pet, User.name)
        .join(Pet, PetShare.pet_id == Pet.id)
        .join(User, PetShare.invited_by_user_id == User.id)
        .where(
            or_(
                PetShare.user_id == current_user.id,
                PetShare.invite_email == current_user.email.lower(),
            ),
            PetShare.status == "pending",
        )
    )
    return [
        {
            "id": s.id,
            "pet_id": pet.id,
            "pet_name": pet.name,
            "pet_photo": pet.photo,
            "pet_species": pet.species.value if hasattr(pet.species, "value") else pet.species,
            "inviter_name": inviter,
            "role": s.role,
            "invited_at": s.invited_at.isoformat(),
            "invite_token": s.invite_token,
        }
        for s, pet, inviter in q.all()
    ]


@router.post("/invites/{token}/accept")
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await db.execute(select(PetShare).where(PetShare.invite_token == token))
    share = q.scalar_one_or_none()
    if not share or share.status != "pending":
        raise HTTPException(status_code=404, detail="Convite não encontrado ou já processado")

    # Match por user_id ou email
    if share.user_id and share.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Esse convite não é seu")
    if not share.user_id and share.invite_email.lower() != current_user.email.lower():
        raise HTTPException(status_code=403, detail="Esse convite é para outro e-mail")

    share.user_id = current_user.id
    share.status = "accepted"
    share.accepted_at = datetime.utcnow()

    pet_q = await db.execute(select(Pet).where(Pet.id == share.pet_id))
    pet = pet_q.scalar_one_or_none()

    # Avisa o tutor original
    if pet:
        actor_first = current_user.name.split()[0]
        db.add(Notification(
            user_id=share.invited_by_user_id,
            pet_id=pet.id,
            actor_user_id=current_user.id,
            type="invite_accepted",
            title=f"{actor_first} aceitou o convite",
            body=f"Agora também é {share.role.replace('_', ' ')} de {pet.name}",
            link=f"/pets/{pet.id}",
        ))
    await db.commit()
    return {
        "message": "Convite aceito",
        "pet_id": share.pet_id,
        "pet_name": pet.name if pet else None,
        "role": share.role,
    }


@router.get("/pets/{pet_id}/activity")
async def list_pet_activity(
    pet_id: int,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista atividade recente do pet — quem fez o quê (auditoria pra família/co-tutores)."""
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    q = await db.execute(
        select(PetActivityLog, User.name)
        .join(User, PetActivityLog.user_id == User.id)
        .where(PetActivityLog.pet_id == pet_id)
        .order_by(PetActivityLog.created_at.desc())
        .limit(min(limit, 100))
    )
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_name": user_name,
            "action": log.action,
            "summary": log.summary,
            "meta": log.meta,
            "created_at": log.created_at.isoformat(),
            "is_me": log.user_id == current_user.id,
        }
        for log, user_name in q.all()
    ]


@router.post("/invites/{token}/decline")
async def decline_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await db.execute(select(PetShare).where(PetShare.invite_token == token))
    share = q.scalar_one_or_none()
    if not share or share.status != "pending":
        raise HTTPException(status_code=404, detail="Convite não encontrado")
    if share.user_id and share.user_id != current_user.id:
        if share.invite_email.lower() != current_user.email.lower():
            raise HTTPException(status_code=403, detail="Esse convite não é seu")
    share.status = "declined"
    await db.commit()
    return {"message": "Convite recusado"}


@router.get("/pets/shared-with-me")
async def shared_pets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pets compartilhados com o usuário atual (não os que ele é dono)."""
    q = await db.execute(
        select(PetShare, Pet, User.name)
        .join(Pet, PetShare.pet_id == Pet.id)
        .join(User, Pet.user_id == User.id)
        .where(PetShare.user_id == current_user.id, PetShare.status == "accepted")
    )
    return [
        {
            "share_id": s.id,
            "pet_id": pet.id,
            "pet_name": pet.name,
            "pet_photo": pet.photo,
            "pet_species": pet.species.value if hasattr(pet.species, "value") else pet.species,
            "owner_name": owner_name,
            "role": s.role,
            "accepted_at": s.accepted_at.isoformat() if s.accepted_at else None,
        }
        for s, pet, owner_name in q.all()
    ]


# ─── Pet Genealogical Tree / Family ──────────────────────────────────────────

class RelationCreate(BaseModel):
    related_pet_id: int
    relation: Literal["sibling", "parent", "offspring", "mate", "friend"]


def _inverse_relation(r: str) -> str:
    return {"parent": "offspring", "offspring": "parent", "sibling": "sibling", "mate": "mate", "friend": "friend"}.get(r, r)


@router.post("/pets/{pet_id}/relations")
async def add_relation(
    pet_id: int,
    body: RelationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Adiciona laço entre 2 pets. Cria registros nas duas pontas — pet inicial
    confirmed_at=now (dono que criou), outra ponta status=pending (precisa
    o outro dono confirmar)."""
    if pet_id == body.related_pet_id:
        raise HTTPException(status_code=400, detail="Pet não pode ter relação consigo mesmo")

    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    related_q = await db.execute(select(Pet).where(Pet.id == body.related_pet_id))
    related = related_q.scalar_one_or_none()
    if not related:
        raise HTTPException(status_code=404, detail="Pet relacionado não existe")

    # Já existe?
    existing_q = await db.execute(
        select(PetRelation).where(
            PetRelation.pet_id == pet_id,
            PetRelation.related_pet_id == body.related_pet_id,
        )
    )
    if existing_q.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Relação já existe")

    # Se mesmo tutor, auto-confirma
    same_owner = related.user_id == current_user.id
    confirmed_at = datetime.utcnow() if same_owner else None
    status_val = "confirmed" if same_owner else "pending"

    # Side A
    side_a = PetRelation(
        pet_id=pet_id,
        related_pet_id=body.related_pet_id,
        relation=body.relation,
        created_by_user_id=current_user.id,
        confirmed_at=confirmed_at,
        status=status_val,
    )
    # Side B (inversa)
    side_b = PetRelation(
        pet_id=body.related_pet_id,
        related_pet_id=pet_id,
        relation=_inverse_relation(body.relation),
        created_by_user_id=current_user.id,
        confirmed_at=confirmed_at,
        status=status_val,
    )
    db.add_all([side_a, side_b])
    await db.commit()
    return {
        "message": "Relação criada (auto-confirmada)" if same_owner else "Convite de relação enviado — aguarda confirmação do outro tutor",
        "relation_id": side_a.id,
        "status": status_val,
    }


@router.post("/relations/{relation_id}/confirm")
async def confirm_relation(
    relation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rel_q = await db.execute(select(PetRelation).where(PetRelation.id == relation_id))
    rel = rel_q.scalar_one_or_none()
    if not rel or rel.status != "pending":
        raise HTTPException(status_code=404, detail="Relação não encontrada ou já processada")

    pet_q = await db.execute(select(Pet).where(Pet.id == rel.pet_id))
    pet = pet_q.scalar_one_or_none()
    if not pet or pet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o tutor do pet pode confirmar")

    rel.confirmed_at = datetime.utcnow()
    rel.status = "confirmed"

    # Confirma o lado espelho também
    mirror_q = await db.execute(
        select(PetRelation).where(
            PetRelation.pet_id == rel.related_pet_id,
            PetRelation.related_pet_id == rel.pet_id,
            PetRelation.status == "pending",
        )
    )
    mirror = mirror_q.scalar_one_or_none()
    if mirror:
        mirror.status = "confirmed"
        mirror.confirmed_at = datetime.utcnow()

    await db.commit()
    return {"message": "Relação confirmada"}


@router.delete("/relations/{relation_id}")
async def delete_relation(
    relation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rel_q = await db.execute(select(PetRelation).where(PetRelation.id == relation_id))
    rel = rel_q.scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="Relação não encontrada")

    pet_q = await db.execute(select(Pet).where(Pet.id == rel.pet_id))
    pet = pet_q.scalar_one_or_none()
    if not pet or pet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o tutor pode remover")

    # Apaga as duas pontas
    await db.delete(rel)
    mirror_q = await db.execute(
        select(PetRelation).where(
            PetRelation.pet_id == rel.related_pet_id,
            PetRelation.related_pet_id == rel.pet_id,
        )
    )
    mirror = mirror_q.scalar_one_or_none()
    if mirror:
        await db.delete(mirror)
    await db.commit()
    return None


@router.get("/pets/{pet_id}/family-tree")
async def family_tree(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id))
    pet = pet_q.scalar_one_or_none()
    if not pet or not await _user_can_access_pet(db, current_user, pet):
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    rels_q = await db.execute(
        select(PetRelation, Pet, User.name)
        .join(Pet, PetRelation.related_pet_id == Pet.id)
        .join(User, Pet.user_id == User.id)
        .where(PetRelation.pet_id == pet_id)
    )

    relations: dict[str, list] = {"parent": [], "offspring": [], "sibling": [], "mate": [], "friend": []}
    pending = []
    for rel, related_pet, owner_name in rels_q.all():
        item = {
            "relation_id": rel.id,
            "pet_id": related_pet.id,
            "pet_name": related_pet.name,
            "pet_photo": related_pet.photo,
            "pet_species": related_pet.species.value if hasattr(related_pet.species, "value") else related_pet.species,
            "breed": related_pet.breed.name if related_pet.breed else None,
            "owner_name": owner_name,
            "status": rel.status,
        }
        if rel.status == "pending":
            # Show as pending — needs the OTHER side's owner to confirm
            pending.append({**item, "relation": rel.relation, "is_inbound": rel.created_by_user_id != current_user.id})
        elif rel.status == "confirmed":
            relations.setdefault(rel.relation, []).append(item)

    return {
        "pet_id": pet_id,
        "pet_name": pet.name,
        "relations": relations,
        "pending": pending,
    }


# ─── AI Vet Scribe (B2B — vet portal feature) ────────────────────────────────

class VetScribeRequest(BaseModel):
    pet_id: int
    transcript: str  # notas/transcrição da consulta (texto livre)


@router.post("/vet-scribe")
@_limiter.limit("30/hour")
async def vet_scribe(
    request: Request,
    body: VetScribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recebe notas brutas da consulta e devolve prontuário SOAP estruturado.
    Restrito a vets. Pet precisa ter PetClinicAccess concedido pelo tutor.
    """
    if not current_user.is_vet:
        raise HTTPException(status_code=403, detail="Apenas veterinários podem usar Vet Scribe.")

    if len(body.transcript.strip()) < 30:
        raise HTTPException(status_code=400, detail="Notas muito curtas. Forneça pelo menos 30 caracteres.")

    # Check vet has access to this pet
    from routers.vet_portal import _vet_accessible_pet_ids
    accessible = await _vet_accessible_pet_ids(db, current_user)
    if body.pet_id not in accessible:
        raise HTTPException(status_code=403, detail="Tutor não autorizou sua clínica a acessar este pet.")

    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == body.pet_id)
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    pet_info = {
        "name": pet.name,
        "breed_name": pet.breed.name if pet.breed else "SRD",
        "age": _calculate_age(pet.birth_date),
        "weight": pet.weight,
    }
    try:
        soap = await ai_service.generate_soap_note(body.transcript, pet_info, current_user.name)
        soap["pet_name"] = pet.name
        soap["pet_id"] = pet.id
        return soap
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(status_code=503, detail="Vet Scribe indisponível: crédito Anthropic esgotado.")
        raise HTTPException(status_code=503, detail="Erro ao gerar prontuário.")


# ─── Snapshot Triage ──────────────────────────────────────────────────────────

@router.post("/snapshot-triage")
@_limiter.limit("20/hour")
async def snapshot_triage(
    request: Request,
    pet_id: int = Form(...),
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Triagem rápida por foto — BCS, olhos, dental, postura. NÃO substitui vet."""
    await subscriptions.check_quota(db, current_user, "ai_analysis")
    media_type = (photo.content_type or "image/jpeg").lower()
    if media_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Formato inválido. Use JPG, PNG ou WEBP.")

    contents = await photo.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Imagem maior que 5 MB.")
    if not contents:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.breed))
        .where(Pet.id == pet_id, pet_accessible_filter(current_user.id))
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    pet_info = {
        "name": pet.name,
        "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
        "breed_name": pet.breed.name if pet.breed else None,
        "weight": pet.weight,
        "age": _calculate_age(pet.birth_date),
    }

    b64 = base64.b64encode(contents).decode("ascii")
    try:
        result = await ai_service.snapshot_triage_from_image(b64, media_type, pet_info)
        await subscriptions.consume_quota(db, current_user, "ai_analysis")
        result["pet_name"] = pet.name
        return result
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(
                status_code=503,
                detail="Triagem indisponível: crédito Anthropic esgotado. Administrador deve recarregar em console.anthropic.com",
            )
        raise HTTPException(status_code=503, detail="Erro ao analisar foto. Tente outra.")
