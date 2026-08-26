from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import Pet, Breed, WalkRoutine, user_has_pet_access
from schemas import WalkRoutineCreate, WalkRoutineUpdate, WalkRoutineResponse, WalkRoutineGenerateRequest
from auth import get_current_user
from models import User
import ai_service

router = APIRouter(prefix="/routines", tags=["Rotinas de Passeio"])


def _calculate_age(birth_date) -> str:
    if not birth_date:
        return "adulto"
    now = datetime.utcnow()
    delta = now - birth_date
    years = delta.days // 365
    if years < 1:
        months = delta.days // 30
        return f"filhote de {months} mês(es)"
    elif years >= 8:
        return f"sênior de {years} anos"
    return f"{years} ano(s)"


@router.post("/generate", response_model=WalkRoutineResponse, status_code=status.HTTP_201_CREATED)
async def generate_walk_routine(
    request: WalkRoutineGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == request.pet_id)
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    if not await user_has_pet_access(db, pet.id, current_user.id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    pet_info = {
        "name": pet.name,
        "species": pet.species,
        "age": _calculate_age(pet.birth_date),
        "weight": pet.weight,
        "neutered": pet.neutered,
        "gender": pet.gender,
    }

    breed_info = {}
    if pet.breed:
        breed_info = {
            "name": pet.breed.name,
            "size": pet.breed.size,
            "energy_level": pet.breed.energy_level or 3,
        }
    else:
        breed_info = {
            "name": "SRD (Sem Raça Definida)",
            "size": "medium",
            "energy_level": 3,
        }

    try:
        routine_data = await ai_service.generate_walk_routine(pet_info, breed_info)
        times = routine_data.get("time_slots") or ["08:00", "17:00"]
        # A IA às vezes devolve string em vez de lista; normalizamos aqui pra
        # não estourar no cliente.
        if isinstance(times, str):
            times = [times]
        routine = WalkRoutine(
            pet_id=request.pet_id,
            frequency_per_day=routine_data.get("frequency_per_day") or len(times) or 2,
            duration_minutes=routine_data.get("duration_minutes") or 30,
            time_slots=[str(x) for x in times],
            notes=routine_data.get("notes"),
            details=routine_data,
            ai_generated=True,
        )
    except Exception:
        routine = WalkRoutine(
            pet_id=request.pet_id,
            frequency_per_day=2,
            duration_minutes=30,
            time_slots=["08:00", "17:00"],
            notes="Rotina padrão. Ajuste conforme necessidade do seu pet.",
            details=None,
            ai_generated=True,
        )

    db.add(routine)
    await db.commit()
    await db.refresh(routine)
    return routine


@router.get("/pet/{pet_id}", response_model=list[WalkRoutineResponse])
async def list_routines_for_pet(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    if not await user_has_pet_access(db, pet.id, current_user.id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    result = await db.execute(
        select(WalkRoutine)
        .where(WalkRoutine.pet_id == pet_id)
        .order_by(WalkRoutine.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=WalkRoutineResponse, status_code=status.HTTP_201_CREATED)
async def create_routine(
    data: WalkRoutineCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pet).where(Pet.id == data.pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    if not await user_has_pet_access(db, pet.id, current_user.id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    routine = WalkRoutine(
        pet_id=data.pet_id,
        frequency_per_day=data.frequency_per_day,
        duration_minutes=data.duration_minutes,
        time_slots=data.time_slots,
        notes=data.notes,
        ai_generated=False,
    )
    db.add(routine)
    await db.commit()
    await db.refresh(routine)
    return routine


@router.put("/{routine_id}", response_model=WalkRoutineResponse)
async def update_routine(
    routine_id: int,
    data: WalkRoutineUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WalkRoutine).options(selectinload(WalkRoutine.pet)).where(WalkRoutine.id == routine_id)
    )
    routine = result.scalar_one_or_none()
    if not routine:
        raise HTTPException(status_code=404, detail="Rotina não encontrada")
    if not await user_has_pet_access(db, routine.pet_id, current_user.id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(routine, field, value)
    await db.commit()
    await db.refresh(routine)
    return routine


@router.delete("/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routine(
    routine_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WalkRoutine).options(selectinload(WalkRoutine.pet)).where(WalkRoutine.id == routine_id)
    )
    routine = result.scalar_one_or_none()
    if not routine:
        raise HTTPException(status_code=404, detail="Rotina não encontrada")
    if not await user_has_pet_access(db, routine.pet_id, current_user.id):
        raise HTTPException(status_code=403, detail="Acesso negado")
    await db.delete(routine)
    await db.commit()
