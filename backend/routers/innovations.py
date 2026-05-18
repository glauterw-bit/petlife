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
