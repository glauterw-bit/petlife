import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from slowapi import Limiter
from slowapi.util import get_remote_address

_ai_limiter = Limiter(key_func=get_remote_address)

from database import get_db
from models import Pet, Anamnesis, Breed, Vaccine, Exam, Reminder, PetBehaviorLog, PetWeightHistory, BehaviorPlan, pet_accessible_filter, user_has_pet_access
from schemas import AIChatRequest, AIChatResponse, AIAnalysisRequest, AIAnalysisResponse
from auth import get_current_user
from models import User
import ai_service
from datetime import datetime, timedelta

router = APIRouter(prefix="/ai", tags=["Assistente IA"])


def _calculate_age(birth_date) -> str:
    if not birth_date:
        return "desconhecida"
    now = datetime.utcnow()
    delta = now - birth_date
    years = delta.days // 365
    months = (delta.days % 365) // 30
    if years > 0:
        return f"{years} ano(s) e {months} mês(es)"
    return f"{months} mês(es)"


@router.post("/chat", response_model=AIChatResponse)
@_ai_limiter.limit("30/hour")
async def ai_chat(
    request: Request,
    body: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_info = None

    if body.pet_id:
        result = await db.execute(
            select(Pet)
            .options(selectinload(Pet.breed))
            .where(Pet.id == body.pet_id, pet_accessible_filter(current_user.id))
        )
        pet = result.scalar_one_or_none()
        if pet:
            # Vacinas (últimas 10 + próximas pendentes)
            vac_q = await db.execute(
                select(Vaccine).where(Vaccine.pet_id == pet.id).order_by(Vaccine.date_given.desc()).limit(10)
            )
            vaccines = vac_q.scalars().all()

            # Exames (últimos 5)
            exam_q = await db.execute(
                select(Exam).where(Exam.pet_id == pet.id).order_by(Exam.date.desc()).limit(5)
            )
            exams = exam_q.scalars().all()

            # Anamneses (últimas 3)
            anam_q = await db.execute(
                select(Anamnesis).where(Anamnesis.pet_id == pet.id).order_by(Anamnesis.created_at.desc()).limit(3)
            )
            anamneses = anam_q.scalars().all()

            # Lembretes pendentes (próximos 30 dias)
            now = datetime.utcnow()
            rem_q = await db.execute(
                select(Reminder).where(
                    Reminder.pet_id == pet.id,
                    Reminder.is_completed == False,  # noqa: E712
                    Reminder.due_date >= now,
                    Reminder.due_date <= now + timedelta(days=30),
                ).order_by(Reminder.due_date)
            )
            reminders = rem_q.scalars().all()

            # Histórico de peso (últimas 5 medições — pra tendência)
            weight_q = await db.execute(
                select(PetWeightHistory).where(PetWeightHistory.pet_id == pet.id)
                .order_by(PetWeightHistory.measured_at.desc()).limit(5)
            )
            weights = weight_q.scalars().all()

            # Behavior logs (últimos 7 dias)
            log_q = await db.execute(
                select(PetBehaviorLog).where(
                    PetBehaviorLog.pet_id == pet.id,
                    PetBehaviorLog.logged_at >= now - timedelta(days=7),
                ).order_by(PetBehaviorLog.logged_at.desc())
            )
            behavior_logs = log_q.scalars().all()

            # Plano comportamental ativo
            plan_q = await db.execute(
                select(BehaviorPlan).where(
                    BehaviorPlan.pet_id == pet.id, BehaviorPlan.status == "active"
                ).limit(1)
            )
            active_plan = plan_q.scalar_one_or_none()

            pet_info = {
                "name": pet.name,
                "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
                "breed_name": pet.breed.name if pet.breed else "SRD",
                "age": _calculate_age(pet.birth_date),
                "weight": pet.weight,
                "neutered": pet.neutered,
                "gender": pet.gender.value if pet.gender and hasattr(pet.gender, "value") else pet.gender,
                "color": pet.color,
                "microchip": pet.microchip,
                "bio": pet.bio,
                "is_lost": pet.is_lost,
                "is_deceased": pet.is_deceased,
                # Histórico médico
                "vaccines_recent": [
                    {
                        "name": v.name,
                        "date_given": v.date_given.strftime("%Y-%m-%d") if v.date_given else None,
                        "next_due": v.next_due.strftime("%Y-%m-%d") if v.next_due else None,
                        "veterinarian": v.veterinarian,
                    } for v in vaccines
                ],
                "exams_recent": [
                    {
                        "name": e.name,
                        "type": e.type,
                        "date": e.date.strftime("%Y-%m-%d") if e.date else None,
                        "result": (e.result or "")[:200],
                    } for e in exams
                ],
                "anamneses_recent": [
                    {
                        "date": a.created_at.strftime("%Y-%m-%d") if a.created_at else None,
                        "symptoms": (a.symptoms or "")[:300],
                        "duration": a.duration,
                        "appetite": a.appetite,
                        "energy_level": a.energy_level,
                    } for a in anamneses
                ],
                "upcoming_reminders": [
                    {
                        "title": r.title,
                        "type": r.type.value if hasattr(r.type, "value") else r.type,
                        "due_date": r.due_date.strftime("%Y-%m-%d") if r.due_date else None,
                    } for r in reminders
                ],
                "weight_history": [
                    {
                        "weight_kg": w.weight_kg,
                        "measured_at": w.measured_at.strftime("%Y-%m-%d"),
                        "body_condition_score": w.body_condition_score,
                    } for w in weights
                ],
                "behavior_last_7d": [
                    {
                        "date": l.logged_at.strftime("%Y-%m-%d"),
                        "mood": l.mood,
                        "energy": l.energy,
                        "appetite": l.appetite,
                        "water": l.water_intake,
                        "activity_min": l.activity_minutes,
                    } for l in behavior_logs
                ],
                "active_behavior_plan": (
                    {
                        "issue": active_plan.issue_type,
                        "intensity": active_plan.intensity,
                        "created_at": active_plan.created_at.strftime("%Y-%m-%d"),
                    } if active_plan else None
                ),
            }

    try:
        response_text = await ai_service.chat_with_vet_ai(
            pet_info=pet_info,
            question=body.question,
            conversation_history=body.conversation_history,
        )
        return AIChatResponse(
            response=response_text,
            pet_name=pet_info["name"] if pet_info else None,
        )
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(
                status_code=503,
                detail="Vyron IA temporariamente indisponível. (Crédito da API esgotado — administrador deve recarregar em console.anthropic.com)",
            )
        if "rate" in msg and "limit" in msg:
            raise HTTPException(
                status_code=429,
                detail="Muitas requisições à IA. Aguarde alguns segundos e tente de novo.",
            )
        raise HTTPException(
            status_code=503,
            detail=f"Vyron IA temporariamente indisponível. Tente novamente em instantes.",
        )


@router.post("/analyze-anamnesis", response_model=AIAnalysisResponse)
@_ai_limiter.limit("20/hour")
async def analyze_anamnesis(
    request: Request,
    body: AIAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Anamnesis)
        .options(selectinload(Anamnesis.pet).selectinload(Pet.breed))
        .where(Anamnesis.id == body.anamnesis_id)
    )
    anamnesis = result.scalar_one_or_none()
    if not anamnesis:
        raise HTTPException(status_code=404, detail="Anamnese não encontrada")
    if not await user_has_pet_access(db, anamnesis.pet_id, current_user.id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    pet = anamnesis.pet

    pet_info = {
        "name": pet.name,
        "species": pet.species,
        "breed_name": pet.breed.name if pet.breed else "SRD",
        "age": _calculate_age(pet.birth_date),
        "weight": pet.weight,
        "neutered": pet.neutered,
        "gender": pet.gender,
    }

    anamnesis_data = {
        "symptoms": anamnesis.symptoms,
        "duration": anamnesis.duration,
        "appetite": anamnesis.appetite,
        "water_intake": anamnesis.water_intake,
        "energy_level": anamnesis.energy_level,
        "behavior_changes": anamnesis.behavior_changes,
        "previous_conditions": anamnesis.previous_conditions,
        "current_medications": anamnesis.current_medications,
        "allergies": anamnesis.allergies,
        "last_vet_visit": str(anamnesis.last_vet_visit) if anamnesis.last_vet_visit else None,
    }

    try:
        analysis = await ai_service.analyze_pet_anamnesis(pet_info, anamnesis_data)

        anamnesis.ai_analysis = json.dumps(analysis, ensure_ascii=False)
        await db.commit()

        return AIAnalysisResponse(
            analysis=analysis.get("full_analysis", "Análise realizada com sucesso."),
            urgency_level=analysis.get("urgency_level", "media"),
            recommendations=analysis.get("recommendations", []),
        )
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(
                status_code=503,
                detail="Análise de IA temporariamente indisponível. (Crédito da API esgotado — administrador deve recarregar em console.anthropic.com)",
            )
        raise HTTPException(
            status_code=503,
            detail="Análise de IA temporariamente indisponível. Tente novamente em instantes.",
        )
