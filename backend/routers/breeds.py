from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional

from database import get_db
from models import Breed
from schemas import BreedResponse
from auth import get_current_user
from models import User
import ai_service

router = APIRouter(prefix="/breeds", tags=["Raças"])


@router.get("", response_model=list[BreedResponse])
async def list_breeds(
    species: Optional[str] = Query(None, description="dog ou cat"),
    size: Optional[str] = Query(None, description="small, medium, large ou giant"),
    energy_level: Optional[int] = Query(None, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
):
    query = select(Breed)
    if species:
        query = query.where(Breed.species == species)
    if size:
        query = query.where(Breed.size == size)
    if energy_level:
        query = query.where(Breed.energy_level == energy_level)
    query = query.order_by(Breed.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/search", response_model=list[BreedResponse])
async def search_breeds(
    q: str = Query(..., min_length=1, description="Termo de busca"),
    db: AsyncSession = Depends(get_db),
):
    search_term = f"%{q}%"
    result = await db.execute(
        select(Breed)
        .where(
            or_(
                Breed.name.ilike(search_term),
                Breed.name_en.ilike(search_term),
                Breed.origin.ilike(search_term),
            )
        )
        .order_by(Breed.name)
    )
    return result.scalars().all()


@router.get("/{breed_id}", response_model=BreedResponse)
async def get_breed(breed_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Breed).where(Breed.id == breed_id))
    breed = result.scalar_one_or_none()
    if not breed:
        raise HTTPException(status_code=404, detail="Raça não encontrada")
    return breed


@router.get("/{breed_id}/care-guide")
async def get_breed_care_guide(
    breed_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Breed).where(Breed.id == breed_id))
    breed = result.scalar_one_or_none()
    if not breed:
        raise HTTPException(status_code=404, detail="Raça não encontrada")

    breed_info = {
        "name": breed.name,
        "species": breed.species,
        "size": breed.size,
        "energy_level": breed.energy_level,
        "grooming_level": breed.grooming_level,
        "health_issues": breed.health_issues or [],
        "exercise_needs": breed.exercise_needs,
        "temperament": breed.temperament or [],
        "feeding_guide": breed.feeding_guide,
    }

    pet_info = {
        "name": "Seu pet",
        "age": "adulto",
        "weight": None,
        "neutered": False,
        "gender": None,
    }

    guide = await ai_service.generate_care_guide(breed_info, pet_info)
    return {"breed_id": breed_id, "breed_name": breed.name, "care_guide": guide}
