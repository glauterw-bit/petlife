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
from models import Pet, User
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
