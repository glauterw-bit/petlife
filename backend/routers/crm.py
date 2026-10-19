"""PetLife Clínica — CRM para clínicas veterinárias e pet shops.

Uma clínica (VetClinic) tem equipe (ClinicVet com papel), clientes, pacientes,
agenda, prontuário, catálogo (serviços e produtos com estoque), vendas/caixa e
despesas. Tudo filtrado por clinic_id da pessoa logada.

Ponte com o app PetLife: o tutor libera o pet para a clínica no app
(PetClinicAccess). A clínica importa esse pet como paciente ligado
(petlife_pet_id) e, a partir daí, cada vacina registrada no prontuário cai
também na carteirinha do tutor — com aviso no celular dele.

Papéis: admin (tudo) · vet (agenda, clientes, prontuário, vendas) ·
recepcao (agenda, clientes, vendas) · banho_tosa (agenda e prontuário de banho/tosa).
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user, get_password_hash
from models import (
    User, VetClinic, ClinicVet, Pet, Vaccine, PetClinicAccess,
    CrmClient, CrmPatient, CrmItem, CrmStockMove, CrmAppointment, CrmRecord,
    CrmSale, CrmSaleItem, CrmExpense,
)

router = APIRouter(prefix="/crm", tags=["PetLife Clínica (CRM)"])

ROLES = ("admin", "vet", "recepcao", "banho_tosa")
APPT_TYPES = ("consulta", "vacina", "retorno", "banho", "tosa", "banho_tosa", "cirurgia", "exame", "outro")
APPT_STATUS = ("agendado", "confirmado", "chegou", "em_atendimento", "concluido", "faltou", "cancelado")
RECORD_KINDS = ("consulta", "vacina", "exame", "prescricao", "banho_tosa", "observacao", "cirurgia")
PAY_METHODS = ("dinheiro", "pix", "debito", "credito", "boleto", "fiado")


# ── Contexto da pessoa logada ─────────────────────────────────────────────────
class Ctx:
    def __init__(self, user: User, member: ClinicVet, clinic: VetClinic):
        self.user, self.member, self.clinic = user, member, clinic
        self.clinic_id = clinic.id
        self.role = member.role or "admin"

    def require(self, *roles: str) -> None:
        if self.role != "admin" and self.role not in roles:
            raise HTTPException(status_code=403, detail="Seu perfil não tem acesso a esta área.")


async def crm_ctx(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> Ctx:
    member = (await db.execute(
        select(ClinicVet).where(ClinicVet.user_id == current_user.id).order_by(ClinicVet.id)
    )).scalars().first()
    if not member:
        raise HTTPException(status_code=403, detail="Esta conta não pertence a nenhuma clínica.")
    clinic = await db.get(VetClinic, member.clinic_id)
    if not clinic or clinic.is_active is False:
        raise HTTPException(status_code=403, detail="Clínica inativa.")
    return Ctx(current_user, member, clinic)


def _naive(v: datetime) -> datetime:
    """Datas de filtro chegam do navegador com fuso ("…Z"); as colunas são sem fuso (UTC)."""
    from datetime import timezone
    return v.astimezone(timezone.utc).replace(tzinfo=None) if v.tzinfo else v


def _dt(v: Optional[datetime]) -> Optional[str]:
    return v.isoformat() if v else None


async def _own(db: AsyncSession, model, obj_id: int, ctx: Ctx):
    obj = await db.get(model, obj_id)
    if not obj or obj.clinic_id != ctx.clinic_id:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    return obj


# ── Serializadores ────────────────────────────────────────────────────────────
def s_client(c: CrmClient) -> dict:
    return {"id": c.id, "name": c.name, "phone": c.phone, "email": c.email, "document": c.document,
            "address": c.address, "notes": c.notes, "petlife_linked": c.petlife_user_id is not None,
            "created_at": _dt(c.created_at)}


def s_patient(p: CrmPatient) -> dict:
    return {"id": p.id, "client_id": p.client_id, "name": p.name, "species": p.species, "breed": p.breed,
            "sex": p.sex, "birth_date": _dt(p.birth_date), "weight_kg": p.weight_kg, "neutered": p.neutered,
            "microchip": p.microchip, "color": p.color, "notes": p.notes, "deceased": p.deceased,
            "petlife_linked": p.petlife_pet_id is not None, "created_at": _dt(p.created_at)}


def s_item(i: CrmItem) -> dict:
    return {"id": i.id, "kind": i.kind, "category": i.category, "name": i.name, "sku": i.sku, "price": i.price,
            "cost": i.cost, "stock_qty": i.stock_qty, "min_stock": i.min_stock, "unit": i.unit,
            "duration_min": i.duration_min, "active": i.active,
            "low_stock": bool(i.kind == "product" and i.min_stock is not None and (i.stock_qty or 0) <= i.min_stock)}


def s_appt(a: CrmAppointment, client: Optional[CrmClient] = None, patient: Optional[CrmPatient] = None,
           staff: Optional[User] = None) -> dict:
    return {"id": a.id, "client_id": a.client_id, "patient_id": a.patient_id, "item_id": a.item_id,
            "staff_user_id": a.staff_user_id, "type": a.type, "status": a.status, "starts_at": _dt(a.starts_at),
            "ends_at": _dt(a.ends_at), "price": a.price, "notes": a.notes,
            "client_name": client.name if client else None, "client_phone": client.phone if client else None,
            "patient_name": patient.name if patient else None, "patient_species": patient.species if patient else None,
            "staff_name": staff.name if staff else None}


def s_record(r: CrmRecord, staff: Optional[User] = None) -> dict:
    return {"id": r.id, "patient_id": r.patient_id, "kind": r.kind, "title": r.title, "body": r.body,
            "weight_kg": r.weight_kg, "temperature_c": r.temperature_c, "vaccine_name": r.vaccine_name,
            "vaccine_lot": r.vaccine_lot, "next_due": _dt(r.next_due), "sent_to_app": r.petlife_vaccine_id is not None,
            "staff_name": staff.name if staff else None, "created_at": _dt(r.created_at)}


def s_sale(s: CrmSale, client: Optional[CrmClient] = None, items: Optional[list] = None) -> dict:
    d = {"id": s.id, "client_id": s.client_id, "patient_id": s.patient_id, "appointment_id": s.appointment_id,
         "subtotal": s.subtotal, "discount": s.discount, "total": s.total, "payment_method": s.payment_method,
         "status": s.status, "due_date": _dt(s.due_date), "paid_at": _dt(s.paid_at), "notes": s.notes,
         "created_at": _dt(s.created_at), "client_name": client.name if client else None}
    if items is not None:
        d["items"] = [{"id": x.id, "item_id": x.item_id, "description": x.description, "qty": x.qty,
                       "unit_price": x.unit_price, "total": x.total} for x in items]
    return d


# ── Clínica, equipe e catálogo inicial ────────────────────────────────────────
DEFAULT_CATALOG = [
    ("service", "consulta", "Consulta clínica", 150, 30), ("service", "consulta", "Retorno", 0, 20),
    ("service", "consulta", "Consulta de emergência", 250, 30),
    ("service", "vacina", "Vacina V10 (cão)", 120, 15), ("service", "vacina", "Vacina antirrábica", 80, 15),
    ("service", "vacina", "Vacina V5 / quíntupla (gato)", 130, 15), ("service", "vacina", "Vacina gripe canina", 110, 15),
    ("service", "vacina", "Vacina giárdia", 100, 15),
    ("service", "banho_tosa", "Banho — porte pequeno", 60, 60), ("service", "banho_tosa", "Banho — porte médio", 80, 75),
    ("service", "banho_tosa", "Banho — porte grande", 110, 90), ("service", "banho_tosa", "Banho e tosa higiênica", 90, 90),
    ("service", "banho_tosa", "Tosa completa", 120, 120),
    ("service", "exame", "Hemograma", 90, 15), ("service", "exame", "Ultrassom abdominal", 220, 30),
    ("service", "cirurgia", "Castração (fêmea)", 650, 120), ("service", "cirurgia", "Castração (macho)", 450, 90),
    ("product", "medicamento", "Vermífugo (comprimido)", 35, None), ("product", "medicamento", "Antipulgas (dose)", 75, None),
    ("product", "racao", "Ração premium 1 kg", 45, None), ("product", "acessorio", "Coleira", 40, None),
]


@router.get("/me")
async def crm_me(ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    """Clínica + papel da pessoa. Na primeira entrada, cria um catálogo inicial."""
    has_items = (await db.execute(select(func.count(CrmItem.id)).where(CrmItem.clinic_id == ctx.clinic_id))).scalar()
    if not has_items:
        for kind, cat, name, price, dur in DEFAULT_CATALOG:
            db.add(CrmItem(clinic_id=ctx.clinic_id, kind=kind, category=cat, name=name, price=price,
                           duration_min=dur, stock_qty=0 if kind == "product" else None,
                           min_stock=3 if kind == "product" else None))
        await db.commit()
    c = ctx.clinic
    return {
        "user": {"id": ctx.user.id, "name": ctx.user.name, "email": ctx.user.email, "role": ctx.role},
        "clinic": {"id": c.id, "name": c.name, "cnpj": c.cnpj, "phone": c.phone, "email": c.email,
                   "address": c.address, "city": c.city, "state": c.state, "plan": c.plan,
                   "business_type": getattr(c, "business_type", None) or "clinica"},
    }


class ClinicUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    cnpj: Optional[str] = Field(None, max_length=20)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=2)
    business_type: Optional[str] = Field(None, max_length=20)


@router.put("/clinic")
async def update_clinic(data: ClinicUpdate, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    c = await db.get(VetClinic, ctx.clinic_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        if hasattr(c, k):
            setattr(c, k, (v or None) if isinstance(v, str) else v)
    await db.commit()
    return {"ok": True}


class StaffIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., max_length=200)
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    role: str = "recepcao"
    crmv: Optional[str] = Field(None, max_length=50)


@router.get("/team")
async def team(ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(ClinicVet, User).join(User, User.id == ClinicVet.user_id).where(ClinicVet.clinic_id == ctx.clinic_id)
        .order_by(ClinicVet.id)
    )).all()
    return [{"id": cv.id, "user_id": u.id, "name": u.name, "email": u.email, "role": cv.role or "admin",
             "crmv": cv.crmv, "is_me": u.id == ctx.user.id} for cv, u in rows]


@router.post("/team", status_code=201)
async def add_staff(data: StaffIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    """Adiciona alguém à equipe. Se o e-mail não existe, cria o acesso com a senha informada."""
    ctx.require()
    if data.role not in ROLES:
        raise HTTPException(status_code=400, detail="Papel inválido.")
    email = data.email.strip().lower()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    temp_password = None
    if not user:
        temp_password = data.password or secrets.token_urlsafe(6)
        user = User(name=data.name.strip(), email=email, password_hash=get_password_hash(temp_password), is_vet=True)
        db.add(user)
        await db.flush()
    else:
        user.is_vet = True
    dup = (await db.execute(select(ClinicVet).where(ClinicVet.clinic_id == ctx.clinic_id, ClinicVet.user_id == user.id))).scalar_one_or_none()
    if dup:
        raise HTTPException(status_code=400, detail="Essa pessoa já faz parte da equipe.")
    db.add(ClinicVet(clinic_id=ctx.clinic_id, user_id=user.id, role=data.role, crmv=data.crmv))
    await db.commit()
    return {"ok": True, "temporary_password": temp_password if not data.password else None}


class StaffPatch(BaseModel):
    role: Optional[str] = None
    crmv: Optional[str] = Field(None, max_length=50)


@router.patch("/team/{member_id}")
async def patch_staff(member_id: int, data: StaffPatch, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    cv = await db.get(ClinicVet, member_id)
    if not cv or cv.clinic_id != ctx.clinic_id:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada.")
    if data.role is not None:
        if data.role not in ROLES:
            raise HTTPException(status_code=400, detail="Papel inválido.")
        if cv.user_id == ctx.user.id and data.role != "admin":
            raise HTTPException(status_code=400, detail="Você não pode tirar o seu próprio acesso de administrador.")
        cv.role = data.role
    if data.crmv is not None:
        cv.crmv = data.crmv or None
    await db.commit()
    return {"ok": True}


@router.delete("/team/{member_id}")
async def remove_staff(member_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    cv = await db.get(ClinicVet, member_id)
    if not cv or cv.clinic_id != ctx.clinic_id:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada.")
    if cv.user_id == ctx.user.id:
        raise HTTPException(status_code=400, detail="Você não pode se remover da própria clínica.")
    await db.delete(cv)
    await db.commit()
    return {"ok": True}


# ── Clientes ──────────────────────────────────────────────────────────────────
class ClientIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=200)
    document: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=2000)


@router.get("/clients")
async def list_clients(q: str = "", limit: int = 200, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    stmt = select(CrmClient).where(CrmClient.clinic_id == ctx.clinic_id)
    if q.strip():
        like = f"%{q.strip()}%"
        sub = select(CrmPatient.client_id).where(CrmPatient.clinic_id == ctx.clinic_id, CrmPatient.name.ilike(like))
        stmt = stmt.where(or_(CrmClient.name.ilike(like), CrmClient.phone.ilike(like), CrmClient.email.ilike(like),
                              CrmClient.id.in_(sub)))
    clients = (await db.execute(stmt.order_by(CrmClient.name).limit(min(limit, 500)))).scalars().all()
    ids = [c.id for c in clients]
    pets: dict[int, list] = {}
    if ids:
        for p in (await db.execute(select(CrmPatient).where(CrmPatient.client_id.in_(ids)).order_by(CrmPatient.name))).scalars():
            pets.setdefault(p.client_id, []).append({"id": p.id, "name": p.name, "species": p.species})
    return [{**s_client(c), "patients": pets.get(c.id, [])} for c in clients]


@router.post("/clients", status_code=201)
async def create_client(data: ClientIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    c = CrmClient(clinic_id=ctx.clinic_id, **data.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return s_client(c)


@router.get("/clients/{client_id}")
async def get_client(client_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    c = await _own(db, CrmClient, client_id, ctx)
    pats = (await db.execute(select(CrmPatient).where(CrmPatient.client_id == c.id).order_by(CrmPatient.name))).scalars().all()
    appts = (await db.execute(select(CrmAppointment).where(CrmAppointment.client_id == c.id)
                              .order_by(CrmAppointment.starts_at.desc()).limit(30))).scalars().all()
    sales = (await db.execute(select(CrmSale).where(CrmSale.client_id == c.id).order_by(CrmSale.created_at.desc()).limit(30))).scalars().all()
    pmap = {p.id: p for p in pats}
    open_balance = sum(s.total for s in sales if s.status == "aberta")
    return {**s_client(c), "patients": [s_patient(p) for p in pats],
            "appointments": [s_appt(a, c, pmap.get(a.patient_id)) for a in appts],
            "sales": [s_sale(s, c) for s in sales], "open_balance": round(open_balance, 2),
            "total_spent": round(sum(s.total for s in sales if s.status == "paga"), 2)}


@router.put("/clients/{client_id}")
async def update_client(client_id: int, data: ClientIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    c = await _own(db, CrmClient, client_id, ctx)
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    await db.commit()
    return s_client(c)


@router.delete("/clients/{client_id}")
async def delete_client(client_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    c = await _own(db, CrmClient, client_id, ctx)
    await db.delete(c)
    await db.commit()
    return {"ok": True}


# ── Pacientes e prontuário ────────────────────────────────────────────────────
class PatientIn(BaseModel):
    client_id: int
    name: str = Field(..., min_length=1, max_length=120)
    species: str = "dog"
    breed: Optional[str] = Field(None, max_length=120)
    sex: Optional[str] = None
    birth_date: Optional[datetime] = None
    weight_kg: Optional[float] = None
    neutered: Optional[bool] = None
    microchip: Optional[str] = Field(None, max_length=40)
    color: Optional[str] = Field(None, max_length=60)
    notes: Optional[str] = Field(None, max_length=2000)
    deceased: bool = False


@router.post("/patients", status_code=201)
async def create_patient(data: PatientIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    await _own(db, CrmClient, data.client_id, ctx)
    p = CrmPatient(clinic_id=ctx.clinic_id, **data.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return s_patient(p)


@router.put("/patients/{patient_id}")
async def update_patient(patient_id: int, data: PatientIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    p = await _own(db, CrmPatient, patient_id, ctx)
    await _own(db, CrmClient, data.client_id, ctx)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    await db.commit()
    return s_patient(p)


@router.get("/patients/{patient_id}")
async def get_patient(patient_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    p = await _own(db, CrmPatient, patient_id, ctx)
    c = await db.get(CrmClient, p.client_id)
    recs = (await db.execute(select(CrmRecord, User).outerjoin(User, User.id == CrmRecord.staff_user_id)
                             .where(CrmRecord.patient_id == p.id).order_by(CrmRecord.created_at.desc()))).all()
    appts = (await db.execute(select(CrmAppointment).where(CrmAppointment.patient_id == p.id)
                              .order_by(CrmAppointment.starts_at.desc()).limit(30))).scalars().all()
    # vacinas que o tutor registrou no app (somente leitura, com consentimento)
    app_vaccines = []
    if p.petlife_pet_id and await _has_consent(db, p.petlife_pet_id, ctx.clinic_id):
        for v in (await db.execute(select(Vaccine).where(Vaccine.pet_id == p.petlife_pet_id)
                                   .order_by(Vaccine.date_given.desc()))).scalars():
            app_vaccines.append({"name": v.name, "date_given": _dt(v.date_given), "next_due": _dt(v.next_due),
                                 "veterinarian": v.veterinarian})
    return {**s_patient(p), "client": s_client(c) if c else None,
            "records": [s_record(r, u) for r, u in recs], "appointments": [s_appt(a, c, p) for a in appts],
            "app_vaccines": app_vaccines}


async def _has_consent(db: AsyncSession, pet_id: int, clinic_id: int) -> bool:
    row = (await db.execute(select(PetClinicAccess.id).where(
        PetClinicAccess.pet_id == pet_id, PetClinicAccess.clinic_id == clinic_id, PetClinicAccess.revoked_at.is_(None)
    ))).first()
    return row is not None


class RecordIn(BaseModel):
    kind: str = "consulta"
    title: str = Field(..., min_length=1, max_length=200)
    body: Optional[str] = Field(None, max_length=20000)
    weight_kg: Optional[float] = None
    temperature_c: Optional[float] = None
    vaccine_name: Optional[str] = Field(None, max_length=120)
    vaccine_lot: Optional[str] = Field(None, max_length=60)
    next_due: Optional[datetime] = None
    appointment_id: Optional[int] = None


@router.post("/patients/{patient_id}/records", status_code=201)
async def add_record(patient_id: int, data: RecordIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    if data.kind not in RECORD_KINDS:
        raise HTTPException(status_code=400, detail="Tipo de registro inválido.")
    if data.kind == "banho_tosa":
        ctx.require("vet", "banho_tosa")
    else:
        ctx.require("vet")
    p = await _own(db, CrmPatient, patient_id, ctx)
    r = CrmRecord(clinic_id=ctx.clinic_id, patient_id=p.id, staff_user_id=ctx.user.id, **data.model_dump())
    if data.weight_kg:
        p.weight_kg = data.weight_kg
    db.add(r)
    await db.flush()

    # Ponte com o app: vacina registrada na clínica vai para a carteirinha do tutor
    sent = False
    if data.kind == "vacina" and data.vaccine_name and p.petlife_pet_id and await _has_consent(db, p.petlife_pet_id, ctx.clinic_id):
        v = Vaccine(pet_id=p.petlife_pet_id, name=data.vaccine_name, date_given=datetime.utcnow(),
                    next_due=data.next_due, lot_number=data.vaccine_lot,
                    veterinarian=f"{ctx.user.name} · {ctx.clinic.name}"[:200],
                    notes="Registrada pela clínica no PetLife Clínica")
        db.add(v)
        await db.flush()
        r.petlife_vaccine_id = v.id
        sent = True
    await db.commit()

    if sent:
        try:
            pet = await db.get(Pet, p.petlife_pet_id)
            from routers.push import _deliver
            await _deliver(db, pet.user_id, f"crm-vac:{r.id}", "vacina_clinica",
                           f"💉 {ctx.clinic.name} registrou a vacina de {pet.name}",
                           f"{data.vaccine_name} já está na carteirinha do app.")
        except Exception:
            pass
    return {**s_record(r, ctx.user), "sent_to_app": sent}


@router.delete("/records/{record_id}")
async def delete_record(record_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet")
    r = await _own(db, CrmRecord, record_id, ctx)
    await db.delete(r)
    await db.commit()
    return {"ok": True}


# ── Integração com o app: pacientes liberados pelos tutores ───────────────────
@router.get("/app-patients")
async def app_patients(ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    """Pets que tutores do app liberaram para esta clínica (com ou sem importação)."""
    rows = (await db.execute(
        select(Pet, User, PetClinicAccess).join(PetClinicAccess, PetClinicAccess.pet_id == Pet.id)
        .join(User, User.id == Pet.user_id)
        .where(PetClinicAccess.clinic_id == ctx.clinic_id, PetClinicAccess.revoked_at.is_(None))
        .order_by(PetClinicAccess.granted_at.desc())
    )).all()
    imported = {pid for (pid,) in (await db.execute(
        select(CrmPatient.petlife_pet_id).where(CrmPatient.clinic_id == ctx.clinic_id, CrmPatient.petlife_pet_id.is_not(None))
    )).all()}
    return [{"pet_id": pet.id, "pet_name": pet.name, "species": getattr(pet.species, "value", pet.species),
             "owner_name": u.name, "owner_email": u.email, "owner_phone": u.phone,
             "granted_at": _dt(acc.granted_at), "imported": pet.id in imported} for pet, u, acc in rows]


@router.post("/app-patients/{pet_id}/import", status_code=201)
async def import_app_patient(pet_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao")
    if not await _has_consent(db, pet_id, ctx.clinic_id):
        raise HTTPException(status_code=403, detail="O tutor não liberou este pet para a clínica.")
    pet = await db.get(Pet, pet_id)
    owner = await db.get(User, pet.user_id)
    existing = (await db.execute(select(CrmPatient).where(CrmPatient.clinic_id == ctx.clinic_id, CrmPatient.petlife_pet_id == pet_id))).scalar_one_or_none()
    if existing:
        return {"patient_id": existing.id, "client_id": existing.client_id, "already": True}
    client = (await db.execute(select(CrmClient).where(CrmClient.clinic_id == ctx.clinic_id, CrmClient.petlife_user_id == owner.id))).scalar_one_or_none()
    if not client and owner.email:
        client = (await db.execute(select(CrmClient).where(CrmClient.clinic_id == ctx.clinic_id, func.lower(CrmClient.email) == owner.email.lower()))).scalar_one_or_none()
        if client:
            client.petlife_user_id = owner.id
    if not client:
        client = CrmClient(clinic_id=ctx.clinic_id, name=owner.name, email=owner.email, phone=owner.phone, petlife_user_id=owner.id)
        db.add(client)
        await db.flush()
    sp = getattr(pet.species, "value", pet.species)
    patient = CrmPatient(clinic_id=ctx.clinic_id, client_id=client.id, name=pet.name, species=sp if sp in ("dog", "cat") else "other",
                         breed=None, sex=getattr(pet.gender, "value", pet.gender) if getattr(pet, "gender", None) else None,
                         birth_date=pet.birth_date, weight_kg=pet.weight, neutered=pet.neutered, microchip=pet.microchip,
                         color=pet.color, petlife_pet_id=pet.id)
    db.add(patient)
    await db.commit()
    return {"patient_id": patient.id, "client_id": client.id, "already": False}


# ── Catálogo e estoque ────────────────────────────────────────────────────────
class ItemIn(BaseModel):
    kind: str = "service"
    category: Optional[str] = Field(None, max_length=40)
    name: str = Field(..., min_length=1, max_length=200)
    sku: Optional[str] = Field(None, max_length=60)
    price: float = 0
    cost: Optional[float] = None
    min_stock: Optional[float] = None
    unit: Optional[str] = Field("un", max_length=10)
    duration_min: Optional[int] = None
    active: bool = True


@router.get("/items")
async def list_items(kind: str = "", include_inactive: bool = False, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    stmt = select(CrmItem).where(CrmItem.clinic_id == ctx.clinic_id)
    if kind in ("service", "product"):
        stmt = stmt.where(CrmItem.kind == kind)
    if not include_inactive:
        stmt = stmt.where(CrmItem.active.is_(True))
    return [s_item(i) for i in (await db.execute(stmt.order_by(CrmItem.kind, CrmItem.category, CrmItem.name))).scalars()]


@router.post("/items", status_code=201)
async def create_item(data: ItemIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    i = CrmItem(clinic_id=ctx.clinic_id, stock_qty=0 if data.kind == "product" else None, **data.model_dump())
    db.add(i)
    await db.commit()
    await db.refresh(i)
    return s_item(i)


@router.put("/items/{item_id}")
async def update_item(item_id: int, data: ItemIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    i = await _own(db, CrmItem, item_id, ctx)
    for k, v in data.model_dump().items():
        setattr(i, k, v)
    await db.commit()
    return s_item(i)


class StockIn(BaseModel):
    qty: float
    reason: str = "entrada"
    note: Optional[str] = Field(None, max_length=200)


@router.post("/items/{item_id}/stock")
async def move_stock(item_id: int, data: StockIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("recepcao")
    i = await _own(db, CrmItem, item_id, ctx)
    if i.kind != "product":
        raise HTTPException(status_code=400, detail="Só produtos têm estoque.")
    qty = data.qty if data.reason == "entrada" else (-abs(data.qty) if data.reason in ("perda", "venda") else data.qty)
    i.stock_qty = round((i.stock_qty or 0) + qty, 3)
    db.add(CrmStockMove(clinic_id=ctx.clinic_id, item_id=i.id, qty=qty, reason=data.reason, note=data.note, user_id=ctx.user.id))
    await db.commit()
    return s_item(i)


@router.get("/items/{item_id}/moves")
async def stock_moves(item_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    await _own(db, CrmItem, item_id, ctx)
    rows = (await db.execute(select(CrmStockMove).where(CrmStockMove.item_id == item_id).order_by(CrmStockMove.created_at.desc()).limit(100))).scalars()
    return [{"qty": m.qty, "reason": m.reason, "note": m.note, "at": _dt(m.created_at)} for m in rows]


# ── Agenda ────────────────────────────────────────────────────────────────────
class ApptIn(BaseModel):
    client_id: int
    patient_id: Optional[int] = None
    item_id: Optional[int] = None
    staff_user_id: Optional[int] = None
    type: str = "consulta"
    status: str = "agendado"
    starts_at: datetime
    ends_at: Optional[datetime] = None
    price: Optional[float] = None
    notes: Optional[str] = Field(None, max_length=2000)


class ApptPatch(BaseModel):
    status: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    staff_user_id: Optional[int] = None
    notes: Optional[str] = Field(None, max_length=2000)
    price: Optional[float] = None
    type: Optional[str] = None


async def _appt_out(db: AsyncSession, appts: list) -> list:
    cids = {a.client_id for a in appts}
    pids = {a.patient_id for a in appts if a.patient_id}
    uids = {a.staff_user_id for a in appts if a.staff_user_id}
    cm = {c.id: c for c in (await db.execute(select(CrmClient).where(CrmClient.id.in_(cids or {0})))).scalars()}
    pm = {p.id: p for p in (await db.execute(select(CrmPatient).where(CrmPatient.id.in_(pids or {0})))).scalars()}
    um = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(uids or {0})))).scalars()}
    return [s_appt(a, cm.get(a.client_id), pm.get(a.patient_id), um.get(a.staff_user_id)) for a in appts]


@router.get("/appointments")
async def list_appts(start: datetime, end: datetime, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    start, end = _naive(start), _naive(end)
    if (end - start).days > 62:
        raise HTTPException(status_code=400, detail="Período máximo de 2 meses.")
    appts = (await db.execute(select(CrmAppointment).where(
        CrmAppointment.clinic_id == ctx.clinic_id, CrmAppointment.starts_at >= start, CrmAppointment.starts_at < end
    ).order_by(CrmAppointment.starts_at))).scalars().all()
    return await _appt_out(db, appts)


@router.post("/appointments", status_code=201)
async def create_appt(data: ApptIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    if data.type not in APPT_TYPES or data.status not in APPT_STATUS:
        raise HTTPException(status_code=400, detail="Tipo ou situação inválidos.")
    await _own(db, CrmClient, data.client_id, ctx)
    if data.patient_id:
        p = await _own(db, CrmPatient, data.patient_id, ctx)
        if p.client_id != data.client_id:
            raise HTTPException(status_code=400, detail="O pet não pertence a esse cliente.")
    vals = data.model_dump()
    if data.item_id:
        it = await _own(db, CrmItem, data.item_id, ctx)
        if vals.get("price") is None:
            vals["price"] = it.price
        if not vals.get("ends_at") and it.duration_min:
            vals["ends_at"] = data.starts_at + timedelta(minutes=it.duration_min)
    if not vals.get("ends_at"):
        vals["ends_at"] = data.starts_at + timedelta(minutes=30)
    a = CrmAppointment(clinic_id=ctx.clinic_id, **vals)
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return (await _appt_out(db, [a]))[0]


@router.patch("/appointments/{appt_id}")
async def patch_appt(appt_id: int, data: ApptPatch, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    a = await _own(db, CrmAppointment, appt_id, ctx)
    vals = data.model_dump(exclude_unset=True)
    if "status" in vals and vals["status"] not in APPT_STATUS:
        raise HTTPException(status_code=400, detail="Situação inválida.")
    if "type" in vals and vals["type"] not in APPT_TYPES:
        raise HTTPException(status_code=400, detail="Tipo inválido.")
    for k, v in vals.items():
        setattr(a, k, v)
    await db.commit()
    return (await _appt_out(db, [a]))[0]


@router.delete("/appointments/{appt_id}")
async def delete_appt(appt_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao")
    a = await _own(db, CrmAppointment, appt_id, ctx)
    await db.delete(a)
    await db.commit()
    return {"ok": True}


# ── Vendas / caixa ────────────────────────────────────────────────────────────
class SaleItemIn(BaseModel):
    item_id: Optional[int] = None
    description: Optional[str] = Field(None, max_length=200)
    qty: float = Field(1, gt=0)
    unit_price: Optional[float] = None


class SaleIn(BaseModel):
    client_id: Optional[int] = None
    patient_id: Optional[int] = None
    appointment_id: Optional[int] = None
    items: list[SaleItemIn] = Field(..., min_length=1)
    discount: float = 0
    payment_method: Optional[str] = "pix"
    status: str = "paga"            # paga | aberta
    due_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=300)


@router.post("/sales", status_code=201)
async def create_sale(data: SaleIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    if data.status not in ("paga", "aberta"):
        raise HTTPException(status_code=400, detail="Situação inválida.")
    if data.payment_method and data.payment_method not in PAY_METHODS:
        raise HTTPException(status_code=400, detail="Forma de pagamento inválida.")
    if data.client_id:
        await _own(db, CrmClient, data.client_id, ctx)
    lines, subtotal = [], 0.0
    for li in data.items:
        it = await _own(db, CrmItem, li.item_id, ctx) if li.item_id else None
        desc = (li.description or (it.name if it else "")).strip()
        if not desc:
            raise HTTPException(status_code=400, detail="Item sem descrição.")
        price = li.unit_price if li.unit_price is not None else (it.price if it else 0)
        total = round(price * li.qty, 2)
        subtotal += total
        lines.append((it, desc, li.qty, price, total))
    discount = max(0.0, min(data.discount or 0, subtotal))
    sale = CrmSale(clinic_id=ctx.clinic_id, client_id=data.client_id, patient_id=data.patient_id,
                   appointment_id=data.appointment_id, user_id=ctx.user.id, subtotal=round(subtotal, 2),
                   discount=round(discount, 2), total=round(subtotal - discount, 2),
                   payment_method=data.payment_method, status=data.status, due_date=data.due_date,
                   paid_at=datetime.utcnow() if data.status == "paga" else None, notes=data.notes)
    db.add(sale)
    await db.flush()
    for it, desc, qty, price, total in lines:
        db.add(CrmSaleItem(sale_id=sale.id, item_id=it.id if it else None, description=desc, qty=qty, unit_price=price, total=total))
        if it and it.kind == "product":
            it.stock_qty = round((it.stock_qty or 0) - qty, 3)
            db.add(CrmStockMove(clinic_id=ctx.clinic_id, item_id=it.id, qty=-qty, reason="venda", note=f"Venda #{sale.id}", user_id=ctx.user.id))
    if data.appointment_id:
        a = await _own(db, CrmAppointment, data.appointment_id, ctx)
        a.status = "concluido"
    await db.commit()
    items = (await db.execute(select(CrmSaleItem).where(CrmSaleItem.sale_id == sale.id))).scalars().all()
    client = await db.get(CrmClient, sale.client_id) if sale.client_id else None
    return s_sale(sale, client, items)


@router.get("/sales")
async def list_sales(start: datetime, end: datetime, status: str = "", ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    start, end = _naive(start), _naive(end)
    ctx.require("recepcao", "vet")
    stmt = select(CrmSale).where(CrmSale.clinic_id == ctx.clinic_id, CrmSale.created_at >= start, CrmSale.created_at < end)
    if status:
        stmt = stmt.where(CrmSale.status == status)
    sales = (await db.execute(stmt.order_by(CrmSale.created_at.desc()).limit(500))).scalars().all()
    cm = {c.id: c for c in (await db.execute(select(CrmClient).where(CrmClient.id.in_({s.client_id for s in sales if s.client_id} or {0})))).scalars()}
    return [s_sale(s, cm.get(s.client_id)) for s in sales]


@router.get("/sales/{sale_id}")
async def get_sale(sale_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    s = await _own(db, CrmSale, sale_id, ctx)
    items = (await db.execute(select(CrmSaleItem).where(CrmSaleItem.sale_id == s.id))).scalars().all()
    client = await db.get(CrmClient, s.client_id) if s.client_id else None
    return s_sale(s, client, items)


class PayIn(BaseModel):
    payment_method: str = "pix"


@router.post("/sales/{sale_id}/pay")
async def pay_sale(sale_id: int, data: PayIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("recepcao", "vet")
    s = await _own(db, CrmSale, sale_id, ctx)
    if s.status != "aberta":
        raise HTTPException(status_code=400, detail="Essa venda não está em aberto.")
    if data.payment_method not in PAY_METHODS:
        raise HTTPException(status_code=400, detail="Forma de pagamento inválida.")
    s.status, s.payment_method, s.paid_at = "paga", data.payment_method, datetime.utcnow()
    await db.commit()
    return s_sale(s)


@router.post("/sales/{sale_id}/cancel")
async def cancel_sale(sale_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    s = await _own(db, CrmSale, sale_id, ctx)
    if s.status == "cancelada":
        return s_sale(s)
    for li in (await db.execute(select(CrmSaleItem).where(CrmSaleItem.sale_id == s.id))).scalars():
        if li.item_id:
            it = await db.get(CrmItem, li.item_id)
            if it and it.kind == "product":
                it.stock_qty = round((it.stock_qty or 0) + li.qty, 3)
                db.add(CrmStockMove(clinic_id=ctx.clinic_id, item_id=it.id, qty=li.qty, reason="ajuste", note=f"Cancelamento da venda #{s.id}", user_id=ctx.user.id))
    s.status = "cancelada"
    await db.commit()
    return s_sale(s)


# ── Despesas ──────────────────────────────────────────────────────────────────
class ExpenseIn(BaseModel):
    description: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=40)
    amount: float = Field(..., gt=0)
    due_date: Optional[datetime] = None
    paid: bool = True


@router.get("/expenses")
async def list_expenses(start: datetime, end: datetime, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    start, end = _naive(start), _naive(end)
    ctx.require()
    rows = (await db.execute(select(CrmExpense).where(
        CrmExpense.clinic_id == ctx.clinic_id,
        or_(and_(CrmExpense.paid_at >= start, CrmExpense.paid_at < end),
            and_(CrmExpense.paid_at.is_(None), or_(CrmExpense.due_date.is_(None), CrmExpense.due_date < end))),
    ).order_by(CrmExpense.created_at.desc()))).scalars()
    return [{"id": e.id, "description": e.description, "category": e.category, "amount": e.amount,
             "due_date": _dt(e.due_date), "paid_at": _dt(e.paid_at)} for e in rows]


@router.post("/expenses", status_code=201)
async def create_expense(data: ExpenseIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    e = CrmExpense(clinic_id=ctx.clinic_id, description=data.description, category=data.category, amount=data.amount,
                   due_date=data.due_date, paid_at=datetime.utcnow() if data.paid else None)
    db.add(e)
    await db.commit()
    return {"ok": True, "id": e.id}


@router.post("/expenses/{expense_id}/pay")
async def pay_expense(expense_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    e = await _own(db, CrmExpense, expense_id, ctx)
    e.paid_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    e = await _own(db, CrmExpense, expense_id, ctx)
    await db.delete(e)
    await db.commit()
    return {"ok": True}


# ── Financeiro (resumo do mês) ────────────────────────────────────────────────
@router.get("/finance")
async def finance(month: str = "", ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    now = datetime.utcnow()
    y, m = (int(month[:4]), int(month[5:7])) if len(month) == 7 else (now.year, now.month)
    start = datetime(y, m, 1)
    end = datetime(y + (m == 12), 1 if m == 12 else m + 1, 1)
    q = lambda sql, **p: db.execute(text(sql), {"c": ctx.clinic_id, "s": start, "e": end, **p})
    by_day = [{"day": str(r[0]), "total": float(r[1])} for r in (await q(
        "SELECT date(paid_at), sum(total) FROM crm_sales WHERE clinic_id=:c AND status='paga' AND paid_at>=:s AND paid_at<:e GROUP BY 1 ORDER BY 1")).all()]
    by_method = [{"method": r[0] or "—", "total": float(r[1]), "count": int(r[2])} for r in (await q(
        "SELECT payment_method, sum(total), count(*) FROM crm_sales WHERE clinic_id=:c AND status='paga' AND paid_at>=:s AND paid_at<:e GROUP BY 1 ORDER BY 2 DESC")).all()]
    by_category = [{"category": r[0] or "outros", "total": float(r[1])} for r in (await q(
        """SELECT coalesce(i.category, i.kind, 'outros'), sum(si.total) FROM crm_sale_items si
           JOIN crm_sales s ON s.id = si.sale_id LEFT JOIN crm_items i ON i.id = si.item_id
           WHERE s.clinic_id=:c AND s.status='paga' AND s.paid_at>=:s AND s.paid_at<:e GROUP BY 1 ORDER BY 2 DESC""")).all()]
    revenue = sum(d["total"] for d in by_day)
    expenses = float((await q("SELECT coalesce(sum(amount),0) FROM crm_expenses WHERE clinic_id=:c AND paid_at>=:s AND paid_at<:e")).scalar() or 0)
    receivable = float((await q("SELECT coalesce(sum(total),0) FROM crm_sales WHERE clinic_id=:c AND status='aberta'")).scalar() or 0)
    payable = float((await q("SELECT coalesce(sum(amount),0) FROM crm_expenses WHERE clinic_id=:c AND paid_at IS NULL")).scalar() or 0)
    count = int((await q("SELECT count(*) FROM crm_sales WHERE clinic_id=:c AND status='paga' AND paid_at>=:s AND paid_at<:e")).scalar() or 0)
    return {"month": f"{y:04d}-{m:02d}", "revenue": round(revenue, 2), "expenses": round(expenses, 2),
            "profit": round(revenue - expenses, 2), "sales_count": count,
            "avg_ticket": round(revenue / count, 2) if count else 0, "receivable_open": round(receivable, 2),
            "payable_open": round(payable, 2), "by_day": by_day, "by_method": by_method, "by_category": by_category}


# ── Painel do dia e lembretes ─────────────────────────────────────────────────
@router.get("/dashboard")
async def dashboard(ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    # dia de hoje no horário de Brasília (UTC-3)
    day0 = datetime.combine((now - timedelta(hours=3)).date(), datetime.min.time()) + timedelta(hours=3)
    day1 = day0 + timedelta(days=1)
    month0 = datetime((now - timedelta(hours=3)).year, (now - timedelta(hours=3)).month, 1) + timedelta(hours=3)
    today = (await db.execute(select(CrmAppointment).where(
        CrmAppointment.clinic_id == ctx.clinic_id, CrmAppointment.starts_at >= day0, CrmAppointment.starts_at < day1
    ).order_by(CrmAppointment.starts_at))).scalars().all()

    async def sc(stmt) -> float:
        return float((await db.execute(stmt)).scalar() or 0)

    rev_today = await sc(select(func.coalesce(func.sum(CrmSale.total), 0)).where(
        CrmSale.clinic_id == ctx.clinic_id, CrmSale.status == "paga", CrmSale.paid_at >= day0, CrmSale.paid_at < day1))
    rev_month = await sc(select(func.coalesce(func.sum(CrmSale.total), 0)).where(
        CrmSale.clinic_id == ctx.clinic_id, CrmSale.status == "paga", CrmSale.paid_at >= month0))
    new_clients = await sc(select(func.count(CrmClient.id)).where(CrmClient.clinic_id == ctx.clinic_id, CrmClient.created_at >= month0))
    total_clients = await sc(select(func.count(CrmClient.id)).where(CrmClient.clinic_id == ctx.clinic_id))
    total_patients = await sc(select(func.count(CrmPatient.id)).where(CrmPatient.clinic_id == ctx.clinic_id))
    low = (await db.execute(select(CrmItem).where(
        CrmItem.clinic_id == ctx.clinic_id, CrmItem.kind == "product", CrmItem.active.is_(True),
        CrmItem.min_stock.is_not(None), CrmItem.stock_qty <= CrmItem.min_stock).limit(10))).scalars().all()
    pending_app = len([x for x in await app_patients(ctx, db) if not x["imported"]])
    return {
        "today": await _appt_out(db, today),
        "today_by_status": {st: sum(1 for a in today if a.status == st) for st in APPT_STATUS},
        "revenue_today": round(rev_today, 2), "revenue_month": round(rev_month, 2),
        "new_clients_month": int(new_clients), "total_clients": int(total_clients), "total_patients": int(total_patients),
        "low_stock": [s_item(i) for i in low], "reminders_due": len(await _reminders(ctx, db, 15)),
        "app_patients_pending": pending_app,
    }


async def _reminders(ctx: Ctx, db: AsyncSession, days: int) -> list:
    now = datetime.utcnow()
    rows = (await db.execute(
        select(CrmRecord, CrmPatient, CrmClient).join(CrmPatient, CrmPatient.id == CrmRecord.patient_id)
        .join(CrmClient, CrmClient.id == CrmPatient.client_id)
        .where(CrmRecord.clinic_id == ctx.clinic_id, CrmRecord.next_due.is_not(None),
               CrmRecord.next_due <= now + timedelta(days=days), CrmRecord.next_due >= now - timedelta(days=60),
               CrmPatient.deceased.is_(False))
        .order_by(CrmRecord.next_due)
    )).all()
    # só o registro mais recente de cada (paciente, título) — a dose seguinte substitui a anterior
    seen, out = set(), []
    for r, p, c in sorted(rows, key=lambda x: x[0].created_at, reverse=True):
        key = (p.id, (r.vaccine_name or r.title).lower())
        if key in seen:
            continue
        seen.add(key)
        out.append({"record_id": r.id, "kind": r.kind, "what": r.vaccine_name or r.title, "next_due": _dt(r.next_due),
                    "overdue": r.next_due < now, "patient_id": p.id, "patient_name": p.name, "client_id": c.id,
                    "client_name": c.name, "client_phone": c.phone, "in_app": p.petlife_pet_id is not None})
    return sorted(out, key=lambda x: x["next_due"])


@router.get("/reminders")
async def reminders(days: int = 30, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    return await _reminders(ctx, db, max(1, min(days, 120)))
