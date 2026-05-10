import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import Pet, Anamnesis, Breed
from schemas import AnamnesisCreate, AnamnesisResponse
from auth import get_current_user
from models import User
import ai_service

router = APIRouter(prefix="/anamnesis", tags=["Anamnese"])


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


@router.post("", response_model=AnamnesisResponse, status_code=status.HTTP_201_CREATED)
async def create_anamnesis(
    data: AnamnesisCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == data.pet_id)
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    if pet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    anamnesis = Anamnesis(
        pet_id=data.pet_id,
        symptoms=data.symptoms,
        duration=data.duration,
        appetite=data.appetite,
        water_intake=data.water_intake,
        energy_level=data.energy_level,
        behavior_changes=data.behavior_changes,
        previous_conditions=data.previous_conditions,
        current_medications=data.current_medications,
        allergies=data.allergies,
        last_vet_visit=data.last_vet_visit,
    )
    db.add(anamnesis)
    await db.flush()

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
        "symptoms": data.symptoms,
        "duration": data.duration,
        "appetite": data.appetite,
        "water_intake": data.water_intake,
        "energy_level": data.energy_level,
        "behavior_changes": data.behavior_changes,
        "previous_conditions": data.previous_conditions,
        "current_medications": data.current_medications,
        "allergies": data.allergies,
        "last_vet_visit": str(data.last_vet_visit) if data.last_vet_visit else None,
    }

    try:
        analysis_result = await ai_service.analyze_pet_anamnesis(pet_info, anamnesis_data)
        anamnesis.ai_analysis = json.dumps(analysis_result, ensure_ascii=False)
    except Exception as e:
        anamnesis.ai_analysis = json.dumps({
            "error": "Análise de IA temporariamente indisponível",
            "urgency_level": "desconhecido",
            "recommendations": ["Consulte um veterinário para avaliação presencial"],
        }, ensure_ascii=False)

    await db.commit()
    await db.refresh(anamnesis)
    return anamnesis


@router.get("/pet/{pet_id}", response_model=list[AnamnesisResponse])
async def list_anamneses_for_pet(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    if pet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    result = await db.execute(
        select(Anamnesis)
        .where(Anamnesis.pet_id == pet_id)
        .order_by(Anamnesis.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{anamnesis_id}", response_model=AnamnesisResponse)
async def get_anamnesis(
    anamnesis_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Anamnesis)
        .options(selectinload(Anamnesis.pet))
        .where(Anamnesis.id == anamnesis_id)
    )
    anamnesis = result.scalar_one_or_none()
    if not anamnesis:
        raise HTTPException(status_code=404, detail="Anamnese não encontrada")
    if anamnesis.pet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return anamnesis
