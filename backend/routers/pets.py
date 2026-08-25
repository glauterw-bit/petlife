import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db, settings
from models import Pet, Breed, Vaccine, Exam, Anamnesis, Reminder, WalkRoutine, PetShare
from schemas import PetCreate, PetUpdate, PetResponse, PetFullProfile
from auth import get_current_user
from models import User, pet_accessible_filter
import subscriptions

router = APIRouter(prefix="/pets", tags=["Pets"])


def _check_pet_ownership(pet: Pet, user_id: int):
    """Apenas owner — usar para ações destrutivas (delete, transfer)."""
    if pet.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas o tutor principal pode realizar essa ação")


async def _check_pet_access(db: AsyncSession, pet: Pet, user_id: int):
    """Owner OU co-tutor com share aceito — usar para reads e edits comuns."""
    if pet.user_id == user_id:
        return
    share_q = await db.execute(
        select(PetShare.id).where(
            PetShare.pet_id == pet.id,
            PetShare.user_id == user_id,
            PetShare.status == "accepted",
        )
    )
    if not share_q.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")


@router.post("", response_model=PetResponse, status_code=status.HTTP_201_CREATED)
async def create_pet(
    pet_data: PetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Quota de pets por plano (free: 3, plus: 5, pro: ilimitado) — ver pricing.QUOTAS
    await subscriptions.check_quota(db, current_user, "pets")

    if pet_data.breed_id:
        breed_result = await db.execute(select(Breed).where(Breed.id == pet_data.breed_id))
        breed = breed_result.scalar_one_or_none()
        if not breed:
            raise HTTPException(status_code=404, detail="Raça não encontrada")

    pet = Pet(
        user_id=current_user.id,
        name=pet_data.name,
        species=pet_data.species,
        breed_id=pet_data.breed_id,
        birth_date=pet_data.birth_date,
        weight=pet_data.weight,
        color=pet_data.color,
        gender=pet_data.gender,
        neutered=pet_data.neutered,
        microchip=pet_data.microchip,
        bio=pet_data.bio,
    )
    db.add(pet)
    await db.commit()

    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet.id)
    )
    pet = result.scalar_one()
    return pet


@router.get("", response_model=list[PetResponse])
async def list_pets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.breed))
        .where(pet_accessible_filter(current_user.id))
        .order_by(Pet.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{pet_id}", response_model=PetResponse)
async def get_pet(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id)
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    await _check_pet_access(db, pet, current_user.id)
    return pet


@router.put("/{pet_id}", response_model=PetResponse)
async def update_pet(
    pet_id: int,
    pet_data: PetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id)
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    await _check_pet_access(db, pet, current_user.id)

    update_fields = pet_data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(pet, field, value)

    await db.commit()
    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet.id)
    )
    return result.scalar_one()


@router.delete("/{pet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pet(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    _check_pet_ownership(pet, current_user.id)
    await db.delete(pet)
    await db.commit()


@router.post("/{pet_id}/photo", response_model=PetResponse)
async def upload_pet_photo(
    pet_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet_id)
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    await _check_pet_access(db, pet, current_user.id)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser uma imagem")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo muito grande (máximo 10MB)")

    # Comprime/redimensiona antes de salvar — economiza storage e banda
    from image_utils import compress_image
    try:
        content, ext = compress_image(content, max_dimension=1600, quality=85)
    except Exception:
        # Se falhar (arquivo corrompido), salva o original
        ext = os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg"

    upload_dir = os.path.join(settings.UPLOAD_DIR, "pets")
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    pet.photo = f"/uploads/pets/{filename}"
    await db.commit()
    result = await db.execute(
        select(Pet).options(selectinload(Pet.breed)).where(Pet.id == pet.id)
    )
    return result.scalar_one()


@router.get("/{pet_id}/full-profile", response_model=PetFullProfile)
async def get_pet_full_profile(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pet)
        .options(
            selectinload(Pet.breed),
            selectinload(Pet.vaccines),
            selectinload(Pet.exams),
            selectinload(Pet.anamneses),
            selectinload(Pet.reminders),
            selectinload(Pet.walk_routines),
        )
        .where(Pet.id == pet_id)
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    await _check_pet_access(db, pet, current_user.id)
    return pet
