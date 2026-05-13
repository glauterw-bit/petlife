"""Lost-pet: marca pet como perdido + página pública verificável por QR-tag.
QR-tag física na coleira aponta para /public/lost/<pet_id>.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db, AsyncSessionLocal
from models import Pet, User
from auth import get_current_user

router = APIRouter(prefix="/pets", tags=["Lost Pet"])


class LostPetUpdate(BaseModel):
    is_lost: bool
    last_seen: Optional[str] = None
    reward: Optional[str] = None


@router.post("/{pet_id}/lost")
async def toggle_lost(
    pet_id: int,
    payload: LostPetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    if pet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    pet.is_lost = payload.is_lost
    pet.lost_at = datetime.utcnow() if payload.is_lost else None
    pet.lost_last_seen = payload.last_seen if payload.is_lost else None
    pet.lost_reward = payload.reward if payload.is_lost else None
    await db.commit()
    return {
        "pet_id": pet.id,
        "is_lost": pet.is_lost,
        "lost_at": pet.lost_at.isoformat() if pet.lost_at else None,
        "last_seen": pet.lost_last_seen,
        "reward": pet.lost_reward,
    }


# Endpoint público (sem auth) — chamado quando alguém escaneia o QR-tag
async def public_lost_pet(pet_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Pet).options(selectinload(Pet.breed), selectinload(Pet.owner)).where(Pet.id == pet_id)
        )
        pet = result.scalar_one_or_none()
        if not pet:
            raise HTTPException(status_code=404, detail="Pet não cadastrado")

        return {
            "pet": {
                "id": pet.id,
                "name": pet.name,
                "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
                "breed": pet.breed.name if pet.breed else None,
                "color": pet.color,
                "photo": pet.photo,
                "microchip": pet.microchip,
            },
            "is_lost": pet.is_lost,
            "lost_at": pet.lost_at.isoformat() if pet.lost_at else None,
            "last_seen": pet.lost_last_seen,
            "reward": pet.lost_reward,
            "owner_contact": {
                "name": pet.owner.name,
                # Não expõe email completo; só telefone se opt-in
                "phone": pet.owner.phone,
            } if pet.is_lost else None,
        }
