import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from database import get_db, settings
from models import (
    User, VetClinic, ClinicVet, Pet, Vaccine, Exam, Anamnesis, Reminder, WalkRoutine, Breed,
    PetClinicAccess, pet_accessible_filter,
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
from schemas import (
    VetClinicCreate, VetClinicSelfRegister, VetClinicResponse,
    ConsultationCreate, ConsultationResponse, UserLogin, Token, UserResponse,
)
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


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_clinic_selfservice(
    data: VetClinicSelfRegister,
    db: AsyncSession = Depends(get_db),
):
    """Cadastro autônomo de clínica: cria a conta e a clínica de uma vez.

    A tela /vet/register sempre chamou POST /vet/register, que não existia —
    só havia /vet/clinic/register, e essa exige um usuário JÁ logado. Ou seja:
    nenhuma clínica conseguiu se cadastrar pelo portal, nunca. Toda tentativa
    voltava 404.

    Devolve {access_token, clinic}, o mesmo formato que /vet/login, porque é
    isso que a tela consome pra já entrar logada depois do cadastro.
    """
    email = data.email.strip().lower()

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe uma conta com este e-mail. Entre pelo login.",
        )

    if data.cnpj:
        dup = await db.execute(select(VetClinic).where(VetClinic.cnpj == data.cnpj))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="CNPJ já cadastrado")

    user = User(
        name=data.clinic_name,
        email=email,
        password_hash=get_password_hash(data.password),
        is_vet=True,
    )
    db.add(user)
    await db.flush()

    clinic = VetClinic(
        name=data.clinic_name,
        cnpj=data.cnpj,
        phone=data.phone,
        email=email,
        address=data.address,
        specialty=data.specialty,
    )
    db.add(clinic)
    await db.flush()

    db.add(ClinicVet(clinic_id=clinic.id, user_id=user.id))
    await db.commit()
    await db.refresh(clinic)

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "clinic": {
            "id": clinic.id,
            "clinic_name": clinic.name,
            "cnpj": clinic.cnpj,
            "phone": clinic.phone,
            "email": clinic.email,
            "address": clinic.address,
            "specialty": clinic.specialty,
        },
    }


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
        # `anamnesis` (singular) é o nome que o portal lê. Antes só existia
        # "anamneses": a tela desestruturava `anamnesis` e `consultations`,
        # ambos vinham undefined e `anamnesis.length` derrubava a página do
        # paciente inteira.
        "anamnesis": [_anamnesis_row(a) for a in pet.anamneses if not _is_consultation(a)],
        "anamneses": [_anamnesis_row(a) for a in pet.anamneses if not _is_consultation(a)],
        # Consulta lançada pela clínica: é uma Anamnesis cujo ai_analysis tem
        # diagnóstico/tratamento. Separamos pra tela poder listar as duas coisas.
        "consultations": [_consultation_row(a) for a in pet.anamneses if _is_consultation(a)],
    }


def _parsed_analysis(a) -> dict:
    if not a.ai_analysis:
        return {}
    try:
        parsed = json.loads(a.ai_analysis)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _is_consultation(a) -> bool:
    return "diagnosis" in _parsed_analysis(a)


def _anamnesis_row(a) -> dict:
    from schemas import _normalize_analysis
    return {
        "id": a.id,
        "created_at": a.created_at,
        "symptoms": a.symptoms,
        "duration": a.duration,
        "appetite": a.appetite,
        "energy_level": a.energy_level,
        "behavior_changes": a.behavior_changes,
        "current_medications": a.current_medications,
        "ai_analysis": _normalize_analysis(a.ai_analysis),
    }


def _consultation_row(a) -> dict:
    d = _parsed_analysis(a)
    return {
        "id": a.id,
        "pet_id": a.pet_id,
        "date": a.created_at,
        "created_at": a.created_at,
        "notes": a.symptoms,
        "diagnosis": d.get("diagnosis") or None,
        "treatment": d.get("treatment") or None,
        "vet_name": d.get("vet") or None,
        "follow_up_date": d.get("follow_up_date"),
    }


@router.post("/consultation", response_model=ConsultationResponse)
async def add_consultation(
    body: ConsultationCreate,
    current_user: User = Depends(get_current_vet),
    db: AsyncSession = Depends(get_db),
):
    pet_id = body.pet_id
    notes = body.notes
    diagnosis = body.diagnosis
    treatment = body.treatment
    follow_up_date = body.follow_up_date

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
        created_at=body.date or datetime.utcnow(),
        ai_analysis=json.dumps({
            "diagnosis": diagnosis or "",
            "treatment": treatment or "",
            "vet": current_user.name,
            "follow_up_date": follow_up_date.isoformat() if follow_up_date else None,
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
    await db.refresh(anamnesis)
    # Devolve a consulta criada (não uma mensagem): a tela insere o retorno
    # direto na lista, e antes `c.id` e `c.date` vinham undefined.
    return _consultation_row(anamnesis)


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
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
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
    pet_q = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
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


# ─── Convite da clínica (PetLife Clínica → app do tutor) ─────────────────────
# A clínica gera um link para um paciente. O tutor, logado no app, vê o que
# será compartilhado, escolhe (ou cria) o pet e consente. O acesso pode ser
# retirado a qualquer momento em Configurações › Clínicas com acesso.
from pydantic import BaseModel as _BaseModel
from typing import Optional as _Optional
import unicodedata as _ud
from models import CrmInvite, CrmPatient, CrmClient, CrmRecord
import subscriptions as _subscriptions

CLINIC_INVITE_SHARES = ["Vacinas aplicadas na clínica", "Próximas doses e lembretes"]


def _norm_name(s: "str | None") -> str:
    s = _ud.normalize("NFKD", (s or "").strip().lower())
    return "".join(ch for ch in s if not _ud.combining(ch))


def _species_val(v) -> str:
    return getattr(v, "value", v) or ""


async def _load_clinic_invite(db: AsyncSession, code: str):
    inv = (await db.execute(select(CrmInvite).where(CrmInvite.code == code))).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")
    clinic = await db.get(VetClinic, inv.clinic_id)
    patient = await db.get(CrmPatient, inv.patient_id)
    if inv.used_at or inv.expires_at <= datetime.utcnow() or not clinic or clinic.is_active is False or not patient:
        raise HTTPException(status_code=410, detail="Este convite expirou ou já foi usado.")
    return inv, clinic, patient


async def _clinic_vaccine_records(db: AsyncSession, patient_id: int) -> list:
    return (await db.execute(select(CrmRecord).where(
        CrmRecord.patient_id == patient_id, CrmRecord.kind == "vacina", CrmRecord.voided_at.is_(None),
        CrmRecord.petlife_vaccine_id.is_(None), CrmRecord.vaccine_name.is_not(None),
    ).order_by(CrmRecord.created_at))).scalars().all()


@router.get("/clinic-invite/{code}")
async def clinic_invite_info(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    inv, clinic, patient = await _load_clinic_invite(db, code)
    pets = (await db.execute(
        select(Pet).where(pet_accessible_filter(current_user.id), Pet.is_deceased.is_(False)).order_by(Pet.created_at)
    )).scalars().all()
    shared = set()
    if pets:
        shared = {pid for (pid,) in (await db.execute(select(PetClinicAccess.pet_id).where(
            PetClinicAccess.clinic_id == clinic.id, PetClinicAccess.revoked_at.is_(None),
            PetClinicAccess.pet_id.in_([p.id for p in pets])))).all()}
    target, sp = _norm_name(patient.name), patient.species
    suggested = None
    if patient.petlife_pet_id and any(p.id == patient.petlife_pet_id for p in pets):
        suggested = patient.petlife_pet_id
    else:
        for p in pets:
            if _norm_name(p.name) == target and _species_val(p.species) == sp:
                suggested = p.id
                break
    past = await _clinic_vaccine_records(db, patient.id)
    return {
        "clinic": {"id": clinic.id, "name": clinic.name, "city": clinic.city, "state": clinic.state},
        "patient": {"name": patient.name, "species": patient.species},
        "expires_at": inv.expires_at.isoformat(),
        "shares": CLINIC_INVITE_SHARES,
        "pets": [{"id": p.id, "name": p.name, "species": _species_val(p.species), "already_shared": p.id in shared}
                 for p in pets],
        "suggested_pet_id": suggested,
        "past_vaccines_count": len(past),
    }


class ClinicInviteAccept(_BaseModel):
    pet_id: _Optional[int] = None
    create_pet: bool = False
    import_past_vaccines: bool = True


@router.post("/clinic-invite/{code}/accept")
async def clinic_invite_accept(
    code: str,
    data: ClinicInviteAccept,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    inv, clinic, patient = await _load_clinic_invite(db, code)
    if data.create_pet:
        if patient.species not in ("dog", "cat"):
            raise HTTPException(status_code=400, detail="O app aceita só cães e gatos. Escolha um pet que já está no app.")
        await _subscriptions.check_quota(db, current_user, "pets")
        pet = Pet(user_id=current_user.id, name=patient.name[:100], species=patient.species,
                  birth_date=patient.birth_date, weight=patient.weight_kg, color=patient.color,
                  neutered=bool(patient.neutered), microchip=patient.microchip)
        db.add(pet)
        await db.flush()
    else:
        if not data.pet_id:
            raise HTTPException(status_code=400, detail="Escolha o pet ou crie um novo.")
        pet = (await db.execute(select(Pet).where(Pet.id == data.pet_id, pet_accessible_filter(current_user.id)))).scalar_one_or_none()
        if not pet:
            raise HTTPException(status_code=404, detail="Pet não encontrado")
    if patient.petlife_pet_id and patient.petlife_pet_id != pet.id:
        raise HTTPException(status_code=409, detail="Este paciente já está ligado a outro pet no app.")
    other = (await db.execute(select(CrmPatient.id).where(
        CrmPatient.clinic_id == clinic.id, CrmPatient.petlife_pet_id == pet.id, CrmPatient.id != patient.id))).first()
    if other:
        raise HTTPException(status_code=409, detail="Este pet já está ligado a outro cadastro desta clínica.")

    active = (await db.execute(select(PetClinicAccess).where(
        PetClinicAccess.pet_id == pet.id, PetClinicAccess.clinic_id == clinic.id, PetClinicAccess.revoked_at.is_(None)
    ))).scalars().first()
    now = datetime.utcnow()
    if not active:
        db.add(PetClinicAccess(pet_id=pet.id, clinic_id=clinic.id, granted_by_user_id=current_user.id, granted_at=now))
    patient.petlife_pet_id = pet.id
    client = await db.get(CrmClient, patient.client_id)
    if client and client.petlife_user_id is None:
        client.petlife_user_id = current_user.id
    inv.used_at, inv.used_by_user_id = now, current_user.id

    imported = 0
    if data.import_past_vaccines:
        existing = {(_norm_name(v.name), v.date_given.date()) for v in (await db.execute(
            select(Vaccine).where(Vaccine.pet_id == pet.id))).scalars() if v.date_given}
        recs = await _clinic_vaccine_records(db, patient.id)
        staff_ids = {r.staff_user_id for r in recs if r.staff_user_id}
        staff = {u.id: u.name for u in (await db.execute(select(User).where(User.id.in_(staff_ids or {0})))).scalars()}
        for r in recs:
            given = r.performed_at or r.created_at
            key = (_norm_name(r.vaccine_name), given.date())
            if key in existing:
                continue
            who = staff.get(r.staff_user_id)
            v = Vaccine(pet_id=pet.id, name=r.vaccine_name, date_given=given, next_due=r.next_due,
                        lot_number=r.vaccine_lot,
                        veterinarian=(f"{who} · {clinic.name}" if who else clinic.name)[:200],
                        notes="Registrada pela clínica no PetLife Clínica")
            db.add(v)
            await db.flush()
            r.petlife_vaccine_id = v.id
            existing.add(key)
            imported += 1
    await db.commit()
    return {"ok": True, "pet_id": pet.id, "clinic_name": clinic.name, "imported_vaccines": imported}


@router.get("/my-clinic-access")
async def my_clinic_access(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(PetClinicAccess, Pet, VetClinic)
        .join(Pet, Pet.id == PetClinicAccess.pet_id)
        .join(VetClinic, VetClinic.id == PetClinicAccess.clinic_id)
        .where(pet_accessible_filter(current_user.id), PetClinicAccess.revoked_at.is_(None))
        .order_by(PetClinicAccess.granted_at.desc())
    )).all()
    return [{"pet_id": pet.id, "pet_name": pet.name, "clinic_id": c.id, "clinic_name": c.name,
             "clinic_city": c.city, "granted_at": acc.granted_at.isoformat() if acc.granted_at else None}
            for acc, pet, c in rows]
