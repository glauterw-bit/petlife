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
from models import Pet, Anamnesis, Breed
from schemas import AIChatRequest, AIChatResponse, AIAnalysisRequest, AIAnalysisResponse
from auth import get_current_user
from models import User
import ai_service

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
            .where(Pet.id == body.pet_id, Pet.user_id == current_user.id)
        )
        pet = result.scalar_one_or_none()
        if pet:
            pet_info = {
                "name": pet.name,
                "species": pet.species,
                "breed_name": pet.breed.name if pet.breed else "SRD",
                "age": _calculate_age(pet.birth_date),
                "weight": pet.weight,
                "neutered": pet.neutered,
                "gender": pet.gender,
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
    if anamnesis.pet.user_id != current_user.id:
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
