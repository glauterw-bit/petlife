import os
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from database import get_db, settings
from models import Pet, Vaccine, PetShare, pet_accessible_filter
from schemas import VaccineCreate, VaccineUpdate, VaccineResponse
from auth import get_current_user
from models import User

router = APIRouter(prefix="/vaccines", tags=["Vacinas"])


async def _user_has_pet_access(db: AsyncSession, pet_id: int, user_id: int) -> bool:
    """True se user é owner OU share aceito."""
    q = await db.execute(
        select(Pet.id).where(Pet.id == pet_id, pet_accessible_filter(user_id))
    )
    return q.scalar_one_or_none() is not None


async def _get_pet_and_verify(pet_id: int, user_id: int, db: AsyncSession) -> Pet:
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    if not await _user_has_pet_access(db, pet_id, user_id):
        raise HTTPException(status_code=403, detail="Acesso negado")
    return pet


async def _get_vaccine_and_verify(vaccine_id: int, user_id: int, db: AsyncSession) -> Vaccine:
    result = await db.execute(
        select(Vaccine).options(selectinload(Vaccine.pet)).where(Vaccine.id == vaccine_id)
    )
    vaccine = result.scalar_one_or_none()
    if not vaccine:
        raise HTTPException(status_code=404, detail="Vacina não encontrada")
    if not await _user_has_pet_access(db, vaccine.pet_id, user_id):
        raise HTTPException(status_code=403, detail="Acesso negado")
    return vaccine


@router.post("", response_model=VaccineResponse, status_code=status.HTTP_201_CREATED)
async def create_vaccine(
    data: VaccineCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_pet_and_verify(data.pet_id, current_user.id, db)

    vaccine = Vaccine(
        pet_id=data.pet_id,
        name=data.name,
        date_given=data.date_given,
        next_due=data.next_due,
        lot_number=data.lot_number,
        veterinarian=data.veterinarian,
        notes=data.notes,
    )
    db.add(vaccine)
    await db.commit()
    await db.refresh(vaccine)
    return vaccine


@router.post("/scan-card")
async def scan_vaccine_card(
    pet_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lê a carteirinha por foto e devolve as vacinas encontradas.

    NÃO grava nada: o app mostra o resultado para o tutor conferir e só então
    salva. É o caminho para quem tem a caderneta em mãos — digitar vacina a
    vacina era onde as pessoas desistiam.
    """
    import base64
    import ai_service

    pet = await _get_pet_and_verify(pet_id, current_user.id, db)

    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imagem muito grande (máx. 8 MB).")
    media_type = file.content_type or "image/jpeg"
    if media_type not in ("image/jpeg", "image/png", "image/webp", "image/heic"):
        media_type = "image/jpeg"

    b64 = base64.b64encode(contents).decode("ascii")
    pet_info = {"species": pet.species.value if hasattr(pet.species, "value") else pet.species}
    try:
        return await ai_service.read_vaccine_card(b64, media_type, pet_info)
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(status_code=503, detail="Leitura indisponível: crédito da IA esgotado.")
        raise HTTPException(status_code=503, detail="Não consegui ler a carteirinha. Tente outra foto.")


@router.get("", response_model=list[VaccineResponse])
async def list_vaccines(
    pet_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Todas as vacinas dos pets acessíveis ao usuário (opcionalmente de um pet).

    O app chama este endpoint na tela de Vacinas. Sem ele a lista vinha vazia
    para todo mundo, mesmo com vacinas cadastradas.
    """
    pet_q = await db.execute(select(Pet.id).where(pet_accessible_filter(current_user.id)))
    pet_ids = [r[0] for r in pet_q.fetchall()]
    if pet_id is not None:
        if pet_id not in pet_ids:
            raise HTTPException(status_code=404, detail="Pet não encontrado")
        pet_ids = [pet_id]
    if not pet_ids:
        return []

    result = await db.execute(
        select(Vaccine)
        .options(selectinload(Vaccine.pet))
        .where(Vaccine.pet_id.in_(pet_ids))
        .order_by(Vaccine.date_given.desc())
    )
    return result.scalars().all()


@router.get("/pet/{pet_id}", response_model=list[VaccineResponse])
async def list_vaccines_for_pet(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_pet_and_verify(pet_id, current_user.id, db)
    result = await db.execute(
        select(Vaccine).where(Vaccine.pet_id == pet_id).order_by(Vaccine.date_given.desc())
    )
    return result.scalars().all()


@router.get("/upcoming-reminders", response_model=list[VaccineResponse])
async def get_upcoming_vaccine_reminders(
    days_ahead: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    future = now + timedelta(days=days_ahead)

    pet_result = await db.execute(
        select(Pet.id).where(pet_accessible_filter(current_user.id))
    )
    pet_ids = [row[0] for row in pet_result.fetchall()]

    if not pet_ids:
        return []

    result = await db.execute(
        select(Vaccine).where(
            and_(
                Vaccine.pet_id.in_(pet_ids),
                Vaccine.next_due >= now,
                Vaccine.next_due <= future,
            )
        ).order_by(Vaccine.next_due)
    )
    return result.scalars().all()


@router.get("/{vaccine_id}", response_model=VaccineResponse)
async def get_vaccine(
    vaccine_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_vaccine_and_verify(vaccine_id, current_user.id, db)


@router.put("/{vaccine_id}", response_model=VaccineResponse)
async def update_vaccine(
    vaccine_id: int,
    data: VaccineUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vaccine = await _get_vaccine_and_verify(vaccine_id, current_user.id, db)
    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(vaccine, field, value)
    await db.commit()
    await db.refresh(vaccine)
    return vaccine


@router.get("/pet/{pet_id}/carteirinha")
async def get_vaccination_card(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet = await _get_pet_and_verify(pet_id, current_user.id, db)

    from sqlalchemy.orm import selectinload as sio
    result = await db.execute(
        select(Pet).options(sio(Pet.breed), sio(Pet.vaccines)).where(Pet.id == pet_id)
    )
    pet_full = result.scalar_one_or_none()

    vaccines_sorted = sorted(pet_full.vaccines, key=lambda v: v.date_given, reverse=True)

    return {
        "pet": {
            "id": pet_full.id,
            "name": pet_full.name,
            "species": pet_full.species,
            "breed": pet_full.breed.name if pet_full.breed else None,
            "birth_date": pet_full.birth_date.isoformat() if pet_full.birth_date else None,
            "weight": pet_full.weight,
            "color": pet_full.color,
            "gender": pet_full.gender,
            "neutered": pet_full.neutered,
            "microchip": pet_full.microchip,
            "photo": pet_full.photo,
        },
        "owner": {
            "name": current_user.name,
            "email": current_user.email,
            "phone": current_user.phone,
        },
        "vaccines": [
            {
                "id": v.id,
                "name": v.name,
                "date_given": v.date_given.isoformat(),
                "next_due": v.next_due.isoformat() if v.next_due else None,
                "lot_number": v.lot_number,
                "veterinarian": v.veterinarian,
                "notes": v.notes,
                "document_path": v.document_path,
            }
            for v in vaccines_sorted
        ],
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.delete("/{vaccine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vaccine(
    vaccine_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vaccine = await _get_vaccine_and_verify(vaccine_id, current_user.id, db)
    await db.delete(vaccine)
    await db.commit()


@router.post("/{vaccine_id}/upload-document", response_model=VaccineResponse)
async def upload_vaccine_document(
    vaccine_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vaccine = await _get_vaccine_and_verify(vaccine_id, current_user.id, db)

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo muito grande (máximo 10MB)")

    upload_dir = os.path.join(settings.UPLOAD_DIR, "vaccines")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "document.pdf")[1] or ".pdf"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    vaccine.document_path = f"/uploads/vaccines/{filename}"
    await db.commit()
    await db.refresh(vaccine)
    return vaccine
