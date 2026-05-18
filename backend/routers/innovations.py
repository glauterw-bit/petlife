"""Features inovadoras: Bedtime Story IA + Snapshot Triage por foto.
Reusa o pipeline Claude já configurado em ai_service.
"""
import base64
from datetime import datetime
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models import Pet, User, PetWeightHistory, BehaviorPlan, BehaviorCheckIn, Vaccine, Exam, Anamnesis, Reminder, UserChallenge
from auth import get_current_user
import ai_service

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
    result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.breed))
        .where(Pet.id == body.pet_id, Pet.user_id == current_user.id)
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
    media_type = (photo.content_type or "image/jpeg").lower()
    if media_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Formato inválido.")
    contents = await photo.read()
    if len(contents) > MAX_IMAGE_BYTES or not contents:
        raise HTTPException(status_code=400, detail="Imagem inválida.")

    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, Pet.user_id == current_user.id)
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
    media_type = (photo.content_type or "image/jpeg").lower()
    if media_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Formato inválido.")
    contents = await photo.read()
    if len(contents) > MAX_IMAGE_BYTES or not contents:
        raise HTTPException(status_code=400, detail="Imagem inválida.")

    result = await db.execute(
        select(Pet).where(Pet.id == pet_id, Pet.user_id == current_user.id)
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
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, Pet.user_id == current_user.id))
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
    pet_q = await db.execute(select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, Pet.user_id == current_user.id))
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
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == body.pet_id, Pet.user_id == current_user.id)
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

    pet_q = await db.execute(select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id, Pet.user_id == current_user.id))
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
        .where(Pet.id == pet_id, Pet.user_id == current_user.id)
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
