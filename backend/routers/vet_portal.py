import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from database import get_db, settings
from models import (
    User, VetClinic, ClinicVet, Pet, Vaccine, Exam, Anamnesis, Reminder, WalkRoutine, Breed,
    PetClinicAccess,
)


async def _vet_accessible_pet_ids(db: AsyncSession, vet_user: User) -> list[int]:
    """Retorna IDs dos pets cujo tutor concedeu acesso a alguma clínica
    da qual este vet faz parte. Base do controle de acesso (LGPD).
    """
    clinic_q = await db.execute(select(ClinicVet.clinic_id).where(ClinicVet.user_id == vet_user.id))
    clinic_ids = [r[0] for r in clinic_q.all()]
    if not clinic_ids:
        return []
    access_q = await db.execute(
        select(PetClinicAccess.pet_id).where(
            and_(
                PetClinicAccess.clinic_id.in_(clinic_ids),
                PetClinicAccess.revoked_at.is_(None),
            )
        )
    )
    return [r[0] for r in access_q.all()]
from schemas import VetClinicCreate, VetClinicResponse, UserLogin, Token, UserResponse
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_current_vet
)

router = APIRouter(prefix="/vet", tags=["Portal Veterinário"])


@router.post("/clinic/register", response_model=VetClinicResponse, status_code=status.HTTP_201_CREATED)
async def register_clinic(
    data: VetClinicCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.cnpj:
        existing = await db.execute(select(VetClinic).where(VetClinic.cnpj == data.cnpj))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="CNPJ já cadastrado")

    clinic = VetClinic(
        name=data.name,
        cnpj=data.cnpj,
        phone=data.phone,
        email=data.email,
        address=data.address,
        city=data.city,
        state=data.state,
        zip_code=data.zip_code,
        latitude=data.latitude,
        longitude=data.longitude,
        specialty=data.specialty,
    )
    db.add(clinic)
    await db.flush()

    clinic_vet = ClinicVet(
        clinic_id=clinic.id,
        user_id=current_user.id,
    )
    db.add(clinic_vet)

    current_user.is_vet = True
    await db.commit()
    await db.refresh(clinic)
    return clinic


@router.post("/login", response_model=Token)
async def vet_login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
        )
    if not user.is_vet:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário não é veterinário",
        )

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/patients")
async def get_vet_patients(
    current_user: User = Depends(get_current_vet),
    db: AsyncSession = Depends(get_db),
):
    """Lista APENAS os pets cujos tutores concederam acesso a alguma clínica
    do vet logado (consentimento explícito via PetClinicAccess).
    """
    accessible_ids = await _vet_accessible_pet_ids(db, current_user)
    if not accessible_ids:
        return []

    pet_result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.breed), selectinload(Pet.owner))
        .where(Pet.id.in_(accessible_ids))
        .order_by(Pet.name)
    )
    pets = pet_result.scalars().all()

    return [
        {
            "pet_id": pet.id,
            "pet_name": pet.name,
            "species": pet.species,
            "breed": pet.breed.name if pet.breed else "SRD",
            "owner_name": pet.owner.name,
            "owner_email": pet.owner.email,
            "owner_phone": pet.owner.phone,
        }
        for pet in pets
    ]


@router.get("/patient/{pet_id}/full-history")
async def get_patient_full_history(
    pet_id: int,
    current_user: User = Depends(get_current_vet),
    db: AsyncSession = Depends(get_db),
):
    # LGPD: vet só vê histórico se o tutor concedeu acesso à clínica do vet
    accessible_ids = await _vet_accessible_pet_ids(db, current_user)
    if pet_id not in accessible_ids:
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. O tutor precisa autorizar sua clínica a acessar este pet.",
        )

    result = await db.execute(
        select(Pet)
        .options(
            selectinload(Pet.breed),
            selectinload(Pet.owner),
            selectinload(Pet.vaccines),
            selectinload(Pet.exams),
            selectinload(Pet.anamneses),
            selectinload(Pet.reminders),
        )
        .where(Pet.id == pet_id)
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    return {
        "pet": {
            "id": pet.id,
            "name": pet.name,
            "species": pet.species,
            "breed": pet.breed.name if pet.breed else "SRD",
            "birth_date": pet.birth_date,
            "weight": pet.weight,
            "color": pet.color,
            "gender": pet.gender,
            "neutered": pet.neutered,
            "microchip": pet.microchip,
            "bio": pet.bio,
        },
        "owner": {
            "name": pet.owner.name,
            "email": pet.owner.email,
            "phone": pet.owner.phone,
        },
        "vaccines": [
            {
                "id": v.id,
                "name": v.name,
                "date_given": v.date_given,
                "next_due": v.next_due,
                "lot_number": v.lot_number,
                "veterinarian": v.veterinarian,
                "notes": v.notes,
            }
            for v in pet.vaccines
        ],
        "exams": [
            {
                "id": e.id,
                "name": e.name,
                "type": e.type,
                "date": e.date,
                "result": e.result,
                "notes": e.notes,
            }
            for e in pet.exams
        ],
        "anamneses": [
            {
                "id": a.id,
                "created_at": a.created_at,
                "symptoms": a.symptoms,
                "duration": a.duration,
                "appetite": a.appetite,
                "energy_level": a.energy_level,
                "behavior_changes": a.behavior_changes,
                "current_medications": a.current_medications,
                "ai_analysis": a.ai_analysis,
            }
            for a in pet.anamneses
        ],
    }


@router.post("/consultation")
async def add_consultation(
    pet_id: int,
    notes: str,
    diagnosis: str = None,
    treatment: str = None,
    follow_up_date: datetime = None,
    current_user: User = Depends(get_current_vet),
    db: AsyncSession = Depends(get_db),
):
    # Auth: vet precisa ter acesso ao pet via PetClinicAccess
    accessible_ids = await _vet_accessible_pet_ids(db, current_user)
    if pet_id not in accessible_ids:
        raise HTTPException(status_code=403, detail="Acesso negado")

    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    # FIX: json.dumps em vez de string interpolation (era vetor de injeção)
    anamnesis = Anamnesis(
        pet_id=pet_id,
        symptoms=notes,
        ai_analysis=json.dumps({
            "diagnosis": diagnosis or "",
            "treatment": treatment or "",
            "vet": current_user.name,
        }, ensure_ascii=False),
    )
    db.add(anamnesis)

    if follow_up_date:
        reminder = Reminder(
            user_id=pet.user_id,
            pet_id=pet_id,
            type="vet_appointment",
            title=f"Retorno veterinário - {current_user.name}",
            description=f"Retorno após consulta. Diagnóstico: {diagnosis or 'ver prontuário'}",
            due_date=follow_up_date,
            is_completed=False,
        )
        db.add(reminder)

    await db.commit()
    return {
        "message": "Consulta registrada com sucesso",
        "pet_id": pet_id,
        "vet": current_user.name,
        "follow_up": follow_up_date,
    }


@router.get("/appointments")
async def get_vet_appointments(
    current_user: User = Depends(get_current_vet),
    db: AsyncSession = Depends(get_db),
):
    accessible_ids = await _vet_accessible_pet_ids(db, current_user)
    if not accessible_ids:
        return []
    result = await db.execute(
        select(Reminder)
        .where(
            Reminder.type == "vet_appointment",
            Reminder.pet_id.in_(accessible_ids),
        )
        .order_by(Reminder.due_date)
    )
    reminders = result.scalars().all()

    appointments = []
    for r in reminders:
        pet_result = await db.execute(
            select(Pet).options(selectinload(Pet.owner)).where(Pet.id == r.pet_id)
        )
        pet = pet_result.scalar_one_or_none()
        appointments.append({
            "reminder_id": r.id,
            "title": r.title,
            "description": r.description,
            "due_date": r.due_date,
            "is_completed": r.is_completed,
            "pet_name": pet.name if pet else None,
            "owner_name": pet.owner.name if pet else None,
        })

    return appointments


# ─── Endpoints do TUTOR: conceder/revogar acesso da clínica ──────────────────

@router.post("/pet/{pet_id}/share-clinic/{clinic_id}")
async def share_pet_with_clinic(
    pet_id: int,
    clinic_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tutor concede acesso a uma clínica veterinária pra ver o histórico do pet.
    Pré-requisito por LGPD pra qualquer vet acessar dados de saúde do pet.
    """
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, Pet.user_id == current_user.id))
    pet = pet_q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    clinic_q = await db.execute(select(VetClinic).where(VetClinic.id == clinic_id))
    clinic = clinic_q.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clínica não encontrada")

    # Já tem acesso ativo?
    existing_q = await db.execute(
        select(PetClinicAccess).where(
            PetClinicAccess.pet_id == pet_id,
            PetClinicAccess.clinic_id == clinic_id,
            PetClinicAccess.revoked_at.is_(None),
        )
    )
    if existing_q.scalar_one_or_none():
        return {"message": "Acesso já concedido", "clinic": clinic.name}

    access = PetClinicAccess(
        pet_id=pet_id,
        clinic_id=clinic_id,
        granted_by_user_id=current_user.id,
        granted_at=datetime.utcnow(),
    )
    db.add(access)
    await db.commit()
    return {"message": "Acesso concedido à clínica", "clinic": clinic.name}


@router.delete("/pet/{pet_id}/share-clinic/{clinic_id}")
async def revoke_clinic_access(
    pet_id: int,
    clinic_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, Pet.user_id == current_user.id))
    if not pet_q.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    access_q = await db.execute(
        select(PetClinicAccess).where(
            PetClinicAccess.pet_id == pet_id,
            PetClinicAccess.clinic_id == clinic_id,
            PetClinicAccess.revoked_at.is_(None),
        )
    )
    access = access_q.scalar_one_or_none()
    if not access:
        return {"message": "Não havia acesso ativo"}

    access.revoked_at = datetime.utcnow()
    await db.commit()
    return {"message": "Acesso revogado"}
