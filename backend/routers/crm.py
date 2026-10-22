"""PetLife Clínica — CRM para clínicas veterinárias e pet shops.

Uma clínica (VetClinic) tem equipe (ClinicVet com papel), clientes, pacientes,
agenda, prontuário, catálogo (serviços e produtos com estoque), vendas/caixa e
despesas. Tudo filtrado por clinic_id da pessoa logada.

Ponte com o app PetLife: o tutor libera o pet para a clínica no app
(PetClinicAccess) — direto no app ou aceitando o convite por link que a clínica
gera (CrmInvite). A partir daí, cada vacina registrada no prontuário cai também
na carteirinha do tutor, com aviso no celular dele. O tutor pode retirar o
acesso quando quiser.

Papéis: admin (tudo) · vet (agenda, clientes, prontuário, vendas) ·
recepcao (agenda, clientes, vendas) · banho_tosa (agenda e prontuário de banho/tosa).

Datas: as colunas são TIMESTAMP em UTC sem fuso. Tudo que vem do navegador passa
por _naive(). "Dia" e "mês" seguem o horário de Brasília (UTC−3 fixo), e o
agrupamento por dia é feito em Python para funcionar no SQLite e no Postgres.
"""
from __future__ import annotations

import calendar
import secrets
from datetime import datetime, timedelta, date, timezone
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_, text, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user, get_password_hash
from models import (
    User, VetClinic, ClinicVet, Pet, Vaccine, PetClinicAccess,
    CrmClient, CrmPatient, CrmItem, CrmStockMove, CrmAppointment, CrmRecord,
    CrmSale, CrmSaleItem, CrmExpense, CrmWaitlist, CrmRecordAddendum, CrmRecordTemplate,
    CrmCashSession, CrmCashMove, CrmCommissionRate, CrmInvite,
)

router = APIRouter(prefix="/crm", tags=["PetLife Clínica (CRM)"])

ROLES = ("admin", "vet", "recepcao", "banho_tosa")
APPT_TYPES = ("consulta", "vacina", "retorno", "banho", "tosa", "banho_tosa", "cirurgia", "exame", "outro")
APPT_STATUS = ("agendado", "confirmado", "chegou", "em_atendimento", "pronto", "concluido", "faltou", "cancelado")
APPT_INACTIVE = ("cancelado", "faltou")
STATUS_STAMP = {"confirmado": "confirmed_at", "chegou": "checked_in_at", "em_atendimento": "started_at",
                "pronto": "ready_at", "concluido": "finished_at"}
RECORD_KINDS = ("consulta", "vacina", "exame", "prescricao", "banho_tosa", "observacao", "cirurgia")
PAY_METHODS = ("dinheiro", "pix", "debito", "credito", "boleto", "fiado")
CASH_METHODS = ("pix", "dinheiro", "debito", "credito", "boleto")
STOCK_REASONS = ("entrada", "ajuste", "perda", "devolucao")
PET_SIZES = ("mini", "pequeno", "medio", "grande", "gigante")
TEMPERAMENTS = ("docil", "agitado", "medroso", "agressivo")
WAIT_PERIODS = ("manha", "tarde", "qualquer")
WAIT_STATUS = ("aguardando", "agendado", "cancelado")
LOCK_HOURS = 24
INVITE_DAYS = 14
BRT = timedelta(hours=3)          # Brasília = UTC−3 (sem horário de verão desde 2019)
LOCKED_MSG = "Registro travado. Use Adendo ou Anular."


# ── Contexto da pessoa logada ─────────────────────────────────────────────────
class Ctx:
    def __init__(self, user: User, member: ClinicVet, clinic: VetClinic):
        self.user, self.member, self.clinic = user, member, clinic
        self.clinic_id = clinic.id
        self.role = member.role or "admin"

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

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


# ── Utilidades de data ────────────────────────────────────────────────────────
def _naive(v: Optional[datetime]) -> Optional[datetime]:
    """Datas de filtro chegam do navegador com fuso ("…Z"); as colunas são sem fuso (UTC)."""
    if v is None:
        return None
    return v.astimezone(timezone.utc).replace(tzinfo=None) if v.tzinfo else v


def _dt(v: Optional[datetime]) -> Optional[str]:
    return v.isoformat() if v else None


def _now() -> datetime:
    return datetime.utcnow()


def _brt_day(v: datetime) -> date:
    """Dia (no horário de Brasília) de um instante gravado em UTC."""
    return (v - BRT).date()


def _due_day(v: datetime) -> date:
    """Dia de um vencimento. Vencimento sem hora (00:00) é uma data pura; com hora, é um instante UTC."""
    if v.hour == 0 and v.minute == 0 and v.second == 0:
        return v.date()
    return _brt_day(v)


def _today_brt() -> date:
    return _brt_day(_now())


def _brt_midnight_utc(d: date) -> datetime:
    """Meia-noite de Brasília daquele dia, em UTC sem fuso."""
    return datetime(d.year, d.month, d.day) + BRT


def _month_bounds(y: int, m: int) -> tuple[datetime, datetime]:
    start = datetime(y, m, 1) + BRT
    end = datetime(y + (m == 12), 1 if m == 12 else m + 1, 1) + BRT
    return start, end


def _add_months(d: datetime, n: int) -> datetime:
    y, m = divmod(d.month - 1 + n, 12)
    y, m = d.year + y, m + 1
    return d.replace(year=y, month=m, day=min(d.day, calendar.monthrange(y, m)[1]))


def _fill_days(first: date, last: date, totals: dict) -> list:
    out, d = [], first
    while d <= last:
        out.append({"day": d.isoformat(), "total": round(totals.get(d, 0.0), 2)})
        d += timedelta(days=1)
    return out


def _r2(v) -> float:
    return round(float(v or 0), 2)


# ── Acesso e validações ───────────────────────────────────────────────────────
async def _own(db: AsyncSession, model, obj_id: int, ctx: Ctx):
    obj = await db.get(model, obj_id)
    if not obj or obj.clinic_id != ctx.clinic_id:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    return obj


async def _check_staff(db: AsyncSession, ctx: Ctx, user_id: Optional[int]) -> None:
    if user_id is None:
        return
    row = (await db.execute(select(ClinicVet.id).where(
        ClinicVet.clinic_id == ctx.clinic_id, ClinicVet.user_id == user_id))).first()
    if not row:
        raise HTTPException(status_code=400, detail="Profissional não é da equipe.")


async def _user_names(db: AsyncSession, ids) -> dict:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return {u.id: u.name for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars()}


async def _has_consent(db: AsyncSession, pet_id: int, clinic_id: int) -> bool:
    row = (await db.execute(select(PetClinicAccess.id).where(
        PetClinicAccess.pet_id == pet_id, PetClinicAccess.clinic_id == clinic_id, PetClinicAccess.revoked_at.is_(None)
    ))).first()
    return row is not None


async def _consent_set(db: AsyncSession, clinic_id: int, pet_ids) -> set:
    pet_ids = {p for p in pet_ids if p}
    if not pet_ids:
        return set()
    return {pid for (pid,) in (await db.execute(select(PetClinicAccess.pet_id).where(
        PetClinicAccess.clinic_id == clinic_id, PetClinicAccess.revoked_at.is_(None),
        PetClinicAccess.pet_id.in_(pet_ids)))).all()}


async def _patient_flags(db: AsyncSession, clinic_id: int, patients: list) -> tuple[set, set]:
    """(ids de pacientes com consentimento ativo, ids com convite pendente) — em lote."""
    consent = await _consent_set(db, clinic_id, [p.petlife_pet_id for p in patients])
    consent_ids = {p.id for p in patients if p.petlife_pet_id and p.petlife_pet_id in consent}
    pids = [p.id for p in patients]
    pending = set()
    if pids:
        pending = {pid for (pid,) in (await db.execute(select(CrmInvite.patient_id).where(
            CrmInvite.clinic_id == clinic_id, CrmInvite.patient_id.in_(pids), CrmInvite.used_at.is_(None),
            CrmInvite.expires_at > _now()))).all()}
    return consent_ids, pending


# ── Serializadores ────────────────────────────────────────────────────────────
def s_client(c: CrmClient) -> dict:
    return {"id": c.id, "name": c.name, "phone": c.phone, "email": c.email, "document": c.document,
            "address": c.address, "notes": c.notes, "petlife_linked": c.petlife_user_id is not None,
            "created_at": _dt(c.created_at)}


def s_patient(p: CrmPatient, consent_active: bool = False, invite_pending: bool = False) -> dict:
    return {"id": p.id, "client_id": p.client_id, "name": p.name, "species": p.species, "breed": p.breed,
            "sex": p.sex, "birth_date": _dt(p.birth_date), "weight_kg": p.weight_kg, "neutered": p.neutered,
            "microchip": p.microchip, "color": p.color, "notes": p.notes, "deceased": p.deceased,
            "allergies": p.allergies, "size": p.size, "coat": p.coat, "temperament": p.temperament,
            "grooming_notes": p.grooming_notes,
            "petlife_linked": p.petlife_pet_id is not None, "consent_active": bool(consent_active),
            "invite_pending": bool(invite_pending), "created_at": _dt(p.created_at)}


async def s_patient_one(db: AsyncSession, ctx: Ctx, p: CrmPatient) -> dict:
    consent, pending = await _patient_flags(db, ctx.clinic_id, [p])
    return s_patient(p, p.id in consent, p.id in pending)


def s_item(i: CrmItem) -> dict:
    return {"id": i.id, "kind": i.kind, "category": i.category, "name": i.name, "sku": i.sku, "price": i.price,
            "cost": i.cost, "stock_qty": i.stock_qty, "min_stock": i.min_stock, "unit": i.unit,
            "duration_min": i.duration_min, "active": i.active,
            "low_stock": bool(i.kind == "product" and i.min_stock is not None and (i.stock_qty or 0) <= i.min_stock)}


def _duration(a: CrmAppointment) -> int:
    if a.starts_at and a.ends_at and a.ends_at > a.starts_at:
        return max(1, int(round((a.ends_at - a.starts_at).total_seconds() / 60)))
    return 30


def s_appt(a: CrmAppointment, client: Optional[CrmClient] = None, patient: Optional[CrmPatient] = None,
           staff: Optional[User] = None, item: Optional[CrmItem] = None) -> dict:
    return {"id": a.id, "client_id": a.client_id, "patient_id": a.patient_id, "item_id": a.item_id,
            "staff_user_id": a.staff_user_id, "type": a.type, "status": a.status, "starts_at": _dt(a.starts_at),
            "ends_at": _dt(a.ends_at), "price": a.price, "notes": a.notes,
            "client_name": client.name if client else None, "client_phone": client.phone if client else None,
            "patient_name": patient.name if patient else None, "patient_species": patient.species if patient else None,
            "staff_name": staff.name if staff else None, "item_name": item.name if item else None,
            "is_fit_in": bool(a.is_fit_in), "duration_min": _duration(a),
            "confirmed_at": _dt(a.confirmed_at), "checked_in_at": _dt(a.checked_in_at),
            "started_at": _dt(a.started_at), "ready_at": _dt(a.ready_at), "finished_at": _dt(a.finished_at),
            "confirm_sent_at": _dt(a.confirm_sent_at), "ready_notified_at": _dt(a.ready_notified_at)}


def _locked(r: CrmRecord) -> bool:
    return r.voided_at is not None or (_now() - r.created_at) > timedelta(hours=LOCK_HOURS)


def s_record(r: CrmRecord, staff_name: Optional[str] = None, addenda: Optional[list] = None,
             voided_by_name: Optional[str] = None) -> dict:
    return {"id": r.id, "patient_id": r.patient_id, "appointment_id": r.appointment_id,
            "staff_user_id": r.staff_user_id, "kind": r.kind, "title": r.title, "body": r.body,
            "subjective": r.subjective, "objective": r.objective, "assessment": r.assessment, "plan": r.plan,
            "weight_kg": r.weight_kg, "temperature_c": r.temperature_c, "heart_rate": r.heart_rate,
            "resp_rate": r.resp_rate, "mucosa": r.mucosa, "hydration": r.hydration, "body_score": r.body_score,
            "vaccine_name": r.vaccine_name, "vaccine_lot": r.vaccine_lot, "next_due": _dt(r.next_due),
            "sent_to_app": r.petlife_vaccine_id is not None, "staff_name": staff_name,
            "performed_at": _dt(r.performed_at or r.created_at), "created_at": _dt(r.created_at),
            "locked": _locked(r), "voided_at": _dt(r.voided_at), "void_reason": r.void_reason,
            "voided_by_name": voided_by_name, "updated_at": _dt(r.updated_at), "reminded_at": _dt(r.reminded_at),
            "addenda": addenda or []}


async def _records_out(db: AsyncSession, recs: list) -> list:
    """Serializa registros com nomes e adendos em lote."""
    ids = [r.id for r in recs]
    adds: dict[int, list] = {}
    add_rows = []
    if ids:
        add_rows = (await db.execute(select(CrmRecordAddendum).where(CrmRecordAddendum.record_id.in_(ids))
                                     .order_by(CrmRecordAddendum.created_at))).scalars().all()
    names = await _user_names(db, [r.staff_user_id for r in recs] + [r.voided_by_user_id for r in recs]
                              + [a.staff_user_id for a in add_rows])
    for a in add_rows:
        adds.setdefault(a.record_id, []).append({"id": a.id, "body": a.body, "staff_name": names.get(a.staff_user_id),
                                                 "created_at": _dt(a.created_at)})
    return [s_record(r, names.get(r.staff_user_id), adds.get(r.id, []), names.get(r.voided_by_user_id)) for r in recs]


async def _record_one(db: AsyncSession, r: CrmRecord) -> dict:
    return (await _records_out(db, [r]))[0]


def s_sale(s: CrmSale, client: Optional[CrmClient] = None, items: Optional[list] = None,
           patient_name: Optional[str] = None, user_name: Optional[str] = None,
           staff_names: Optional[dict] = None) -> dict:
    d = {"id": s.id, "client_id": s.client_id, "patient_id": s.patient_id, "appointment_id": s.appointment_id,
         "subtotal": s.subtotal, "discount": s.discount, "total": s.total, "payment_method": s.payment_method,
         "status": s.status, "due_date": _dt(s.due_date), "paid_at": _dt(s.paid_at), "notes": s.notes,
         "created_at": _dt(s.created_at), "client_name": client.name if client else None,
         "client_phone": client.phone if client else None, "cash_session_id": s.cash_session_id,
         "patient_name": patient_name, "user_name": user_name}
    if items is not None:
        sn = staff_names or {}
        d["items"] = [{"id": x.id, "item_id": x.item_id, "description": x.description, "qty": x.qty,
                       "unit_price": x.unit_price, "total": x.total, "staff_user_id": x.staff_user_id,
                       "staff_name": sn.get(x.staff_user_id)} for x in items]
    return d


async def _sales_out(db: AsyncSession, sales: list, with_items: bool = False) -> list:
    cm = {c.id: c for c in (await db.execute(select(CrmClient).where(
        CrmClient.id.in_({s.client_id for s in sales if s.client_id} or {0})))).scalars()}
    pm = {p.id: p.name for p in (await db.execute(select(CrmPatient).where(
        CrmPatient.id.in_({s.patient_id for s in sales if s.patient_id} or {0})))).scalars()}
    items_by: dict[int, list] = {}
    if with_items and sales:
        for li in (await db.execute(select(CrmSaleItem).where(CrmSaleItem.sale_id.in_([s.id for s in sales]))
                                    .order_by(CrmSaleItem.id))).scalars():
            items_by.setdefault(li.sale_id, []).append(li)
    names = await _user_names(db, [s.user_id for s in sales]
                              + [li.staff_user_id for lst in items_by.values() for li in lst])
    return [s_sale(s, cm.get(s.client_id), items_by.get(s.id, []) if with_items else None,
                   pm.get(s.patient_id), names.get(s.user_id), names) for s in sales]


async def _sale_one(db: AsyncSession, s: CrmSale) -> dict:
    return (await _sales_out(db, [s], with_items=True))[0]


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
        "user": {"id": ctx.user.id, "name": ctx.user.name, "email": ctx.user.email, "role": ctx.role,
                 "crmv": ctx.member.crmv},
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
    vals = data.model_dump(exclude_unset=True)
    if "name" in vals and not (vals["name"] or "").strip():
        raise HTTPException(status_code=400, detail="Informe o nome da clínica.")
    if (vals.get("cnpj") or "").strip():
        cnpj = vals["cnpj"].strip()
        dup = (await db.execute(select(VetClinic.id).where(VetClinic.cnpj == cnpj, VetClinic.id != c.id))).first()
        if dup:
            raise HTTPException(status_code=400, detail="Este CNPJ já está cadastrado em outra clínica.")
    for k, v in vals.items():
        if hasattr(c, k):
            setattr(c, k, ((v or "").strip() or None) if isinstance(v, str) else v)
    if "name" in vals:
        c.name = vals["name"].strip()
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


def _client_search(stmt, ctx: Ctx, q: str):
    if q.strip():
        like = f"%{q.strip()}%"
        sub = select(CrmPatient.client_id).where(CrmPatient.clinic_id == ctx.clinic_id, CrmPatient.name.ilike(like))
        stmt = stmt.where(or_(CrmClient.name.ilike(like), CrmClient.phone.ilike(like), CrmClient.email.ilike(like),
                              CrmClient.id.in_(sub)))
    return stmt


async def _pets_by_client(db: AsyncSession, ids: list) -> dict:
    pets: dict[int, list] = {}
    if ids:
        for p in (await db.execute(select(CrmPatient).where(CrmPatient.client_id.in_(ids)).order_by(CrmPatient.name))).scalars():
            pets.setdefault(p.client_id, []).append({"id": p.id, "name": p.name, "species": p.species})
    return pets


async def _last_visits(db: AsyncSession, clinic_id: int, client_ids: Optional[list] = None,
                       before: Optional[datetime] = None) -> dict:
    """Última visita por cliente: atendimento concluído ou venda paga."""
    a_stmt = select(CrmAppointment.client_id, func.max(CrmAppointment.starts_at)).where(
        CrmAppointment.clinic_id == clinic_id, CrmAppointment.status == "concluido")
    s_stmt = select(CrmSale.client_id, func.max(CrmSale.paid_at)).where(
        CrmSale.clinic_id == clinic_id, CrmSale.status == "paga", CrmSale.client_id.is_not(None),
        CrmSale.paid_at.is_not(None))
    if client_ids is not None:
        a_stmt = a_stmt.where(CrmAppointment.client_id.in_(client_ids or [0]))
        s_stmt = s_stmt.where(CrmSale.client_id.in_(client_ids or [0]))
    if before is not None:
        a_stmt = a_stmt.where(CrmAppointment.starts_at < before)
        s_stmt = s_stmt.where(CrmSale.paid_at < before)
    out: dict[int, datetime] = {}
    for stmt in (a_stmt.group_by(CrmAppointment.client_id), s_stmt.group_by(CrmSale.client_id)):
        for cid, last in (await db.execute(stmt)).all():
            if last is None:
                continue
            if isinstance(last, str):        # SQLite devolve texto em agregações
                last = datetime.fromisoformat(last)
            if cid not in out or last > out[cid]:
                out[cid] = last
    return out


@router.get("/clients")
async def list_clients(q: str = "", limit: int = 200, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    stmt = _client_search(select(CrmClient).where(CrmClient.clinic_id == ctx.clinic_id), ctx, q)
    clients = (await db.execute(stmt.order_by(CrmClient.name).limit(max(1, min(limit, 500))))).scalars().all()
    pets = await _pets_by_client(db, [c.id for c in clients])
    return [{**s_client(c), "patients": pets.get(c.id, [])} for c in clients]


@router.get("/clients/page")
async def clients_page(q: str = "", offset: int = 0, limit: int = 50, ctx: Ctx = Depends(crm_ctx),
                       db: AsyncSession = Depends(get_db)):
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    base = _client_search(select(CrmClient).where(CrmClient.clinic_id == ctx.clinic_id), ctx, q)
    total = int((await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0)
    clients = (await db.execute(base.order_by(CrmClient.name, CrmClient.id).offset(offset).limit(limit))).scalars().all()
    ids = [c.id for c in clients]
    pets = await _pets_by_client(db, ids)
    balances = {}
    if ids:
        balances = {cid: float(t or 0) for cid, t in (await db.execute(
            select(CrmSale.client_id, func.sum(CrmSale.total)).where(
                CrmSale.client_id.in_(ids), CrmSale.status == "aberta").group_by(CrmSale.client_id))).all()}
    last = await _last_visits(db, ctx.clinic_id, ids)
    return {"items": [{**s_client(c), "patients": pets.get(c.id, []), "open_balance": _r2(balances.get(c.id)),
                       "last_visit": _dt(last.get(c.id))} for c in clients],
            "total": total}


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
    open_balance = (await db.execute(select(func.coalesce(func.sum(CrmSale.total), 0)).where(
        CrmSale.client_id == c.id, CrmSale.status == "aberta"))).scalar()
    total_spent = (await db.execute(select(func.coalesce(func.sum(CrmSale.total), 0)).where(
        CrmSale.client_id == c.id, CrmSale.status == "paga"))).scalar()
    consent, pending = await _patient_flags(db, ctx.clinic_id, pats)
    return {**s_client(c), "patients": [s_patient(p, p.id in consent, p.id in pending) for p in pats],
            "appointments": await _appt_out(db, appts),
            "sales": await _sales_out(db, sales), "open_balance": _r2(open_balance),
            "total_spent": _r2(total_spent)}


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
    allergies: Optional[str] = Field(None, max_length=500)
    size: Optional[str] = Field(None, max_length=10)
    coat: Optional[str] = Field(None, max_length=60)
    temperament: Optional[str] = Field(None, max_length=20)
    grooming_notes: Optional[str] = Field(None, max_length=500)


def _patient_vals(data: PatientIn) -> dict:
    vals = data.model_dump()
    for k in ("allergies", "size", "coat", "temperament", "grooming_notes"):
        if isinstance(vals.get(k), str):
            vals[k] = vals[k].strip() or None
    if vals.get("size") and vals["size"] not in PET_SIZES:
        raise HTTPException(status_code=400, detail="Porte inválido.")
    if vals.get("temperament") and vals["temperament"] not in TEMPERAMENTS:
        raise HTTPException(status_code=400, detail="Temperamento inválido.")
    vals["birth_date"] = _naive(vals.get("birth_date"))
    return vals


@router.post("/patients", status_code=201)
async def create_patient(data: PatientIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    await _own(db, CrmClient, data.client_id, ctx)
    p = CrmPatient(clinic_id=ctx.clinic_id, **_patient_vals(data))
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return await s_patient_one(db, ctx, p)


@router.put("/patients/{patient_id}")
async def update_patient(patient_id: int, data: PatientIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    p = await _own(db, CrmPatient, patient_id, ctx)
    await _own(db, CrmClient, data.client_id, ctx)
    for k, v in _patient_vals(data).items():
        setattr(p, k, v)
    await db.commit()
    return await s_patient_one(db, ctx, p)


@router.get("/patients/{patient_id}")
async def get_patient(patient_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    p = await _own(db, CrmPatient, patient_id, ctx)
    c = await db.get(CrmClient, p.client_id)
    recs = (await db.execute(select(CrmRecord).where(CrmRecord.patient_id == p.id)
                             .order_by(func.coalesce(CrmRecord.performed_at, CrmRecord.created_at).desc(),
                                       CrmRecord.id.desc()).limit(200))).scalars().all()
    appts = (await db.execute(select(CrmAppointment).where(CrmAppointment.patient_id == p.id)
                              .order_by(CrmAppointment.starts_at.desc()).limit(30))).scalars().all()
    weights = sorted(
        ({"date": _dt(r.performed_at or r.created_at), "kg": r.weight_kg, "_t": r.performed_at or r.created_at}
         for r in (await db.execute(select(CrmRecord).where(
             CrmRecord.patient_id == p.id, CrmRecord.voided_at.is_(None), CrmRecord.weight_kg.is_not(None)))).scalars()),
        key=lambda w: w["_t"])
    consent, pending = await _patient_flags(db, ctx.clinic_id, [p])
    # vacinas que o tutor registrou no app (somente leitura, com consentimento)
    app_vaccines = []
    if p.id in consent:
        clinic_vac_ids = {r.petlife_vaccine_id for r in recs if r.petlife_vaccine_id}
        for v in (await db.execute(select(Vaccine).where(Vaccine.pet_id == p.petlife_pet_id)
                                   .order_by(Vaccine.date_given.desc()))).scalars():
            if v.id in clinic_vac_ids:
                continue
            app_vaccines.append({"name": v.name, "date_given": _dt(v.date_given), "next_due": _dt(v.next_due),
                                 "veterinarian": v.veterinarian})
    return {**s_patient(p, p.id in consent, p.id in pending), "client": s_client(c) if c else None,
            "records": await _records_out(db, recs), "appointments": await _appt_out(db, appts),
            "app_vaccines": app_vaccines, "weights": [{"date": w["date"], "kg": w["kg"]} for w in weights]}


class RecordIn(BaseModel):
    kind: str = "consulta"
    title: str = Field(..., min_length=1, max_length=200)
    body: Optional[str] = Field(None, max_length=20000)
    subjective: Optional[str] = Field(None, max_length=20000)
    objective: Optional[str] = Field(None, max_length=20000)
    assessment: Optional[str] = Field(None, max_length=20000)
    plan: Optional[str] = Field(None, max_length=20000)
    weight_kg: Optional[float] = Field(None, ge=0, le=500)
    temperature_c: Optional[float] = Field(None, ge=20, le=50)
    heart_rate: Optional[int] = Field(None, ge=0, le=600)
    resp_rate: Optional[int] = Field(None, ge=0, le=300)
    mucosa: Optional[str] = Field(None, max_length=40)
    hydration: Optional[str] = Field(None, max_length=40)
    body_score: Optional[int] = Field(None, ge=1, le=9)
    vaccine_name: Optional[str] = Field(None, max_length=120)
    vaccine_lot: Optional[str] = Field(None, max_length=60)
    next_due: Optional[datetime] = None
    performed_at: Optional[datetime] = None
    appointment_id: Optional[int] = None


class RecordPatch(BaseModel):
    kind: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    body: Optional[str] = Field(None, max_length=20000)
    subjective: Optional[str] = Field(None, max_length=20000)
    objective: Optional[str] = Field(None, max_length=20000)
    assessment: Optional[str] = Field(None, max_length=20000)
    plan: Optional[str] = Field(None, max_length=20000)
    weight_kg: Optional[float] = Field(None, ge=0, le=500)
    temperature_c: Optional[float] = Field(None, ge=20, le=50)
    heart_rate: Optional[int] = Field(None, ge=0, le=600)
    resp_rate: Optional[int] = Field(None, ge=0, le=300)
    mucosa: Optional[str] = Field(None, max_length=40)
    hydration: Optional[str] = Field(None, max_length=40)
    body_score: Optional[int] = Field(None, ge=1, le=9)
    vaccine_name: Optional[str] = Field(None, max_length=120)
    vaccine_lot: Optional[str] = Field(None, max_length=60)
    next_due: Optional[datetime] = None
    performed_at: Optional[datetime] = None
    appointment_id: Optional[int] = None


def _require_record_role(ctx: Ctx, kind: str) -> None:
    if kind == "banho_tosa":
        ctx.require("vet", "banho_tosa")
    else:
        ctx.require("vet")


def _check_performed(v: Optional[datetime]) -> Optional[datetime]:
    v = _naive(v)
    if v is not None and v > _now() + timedelta(days=1):
        raise HTTPException(status_code=400, detail="A data do atendimento não pode estar no futuro.")
    return v


async def _latest_weight_time(db: AsyncSession, patient_id: int, exclude_id: Optional[int] = None) -> Optional[datetime]:
    stmt = select(CrmRecord).where(CrmRecord.patient_id == patient_id, CrmRecord.voided_at.is_(None),
                                   CrmRecord.weight_kg.is_not(None))
    if exclude_id:
        stmt = stmt.where(CrmRecord.id != exclude_id)
    times = [r.performed_at or r.created_at for r in (await db.execute(stmt)).scalars()]
    return max(times) if times else None


async def _refresh_patient_weight(db: AsyncSession, p: CrmPatient) -> None:
    """Peso do paciente = peso do registro não anulado mais recente (se houver)."""
    recs = (await db.execute(select(CrmRecord).where(
        CrmRecord.patient_id == p.id, CrmRecord.voided_at.is_(None), CrmRecord.weight_kg.is_not(None)))).scalars().all()
    if recs:
        p.weight_kg = max(recs, key=lambda r: (r.performed_at or r.created_at, r.id)).weight_kg


@router.post("/patients/{patient_id}/records", status_code=201)
async def add_record(patient_id: int, data: RecordIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    if data.kind not in RECORD_KINDS:
        raise HTTPException(status_code=400, detail="Tipo de registro inválido.")
    _require_record_role(ctx, data.kind)
    p = await _own(db, CrmPatient, patient_id, ctx)
    if data.appointment_id:
        a = await _own(db, CrmAppointment, data.appointment_id, ctx)
        if a.patient_id and a.patient_id != p.id:
            raise HTTPException(status_code=400, detail="O atendimento é de outro pet.")
    vals = data.model_dump()
    vals["performed_at"] = _check_performed(data.performed_at)
    vals["next_due"] = _naive(data.next_due)
    when = vals["performed_at"] or _now()
    if data.weight_kg:
        latest = await _latest_weight_time(db, p.id)
        if latest is None or when >= latest:
            p.weight_kg = data.weight_kg
    r = CrmRecord(clinic_id=ctx.clinic_id, patient_id=p.id, staff_user_id=ctx.user.id, **vals)
    db.add(r)
    await db.flush()

    # Ponte com o app: vacina registrada na clínica vai para a carteirinha do tutor
    sent = False
    if data.kind == "vacina" and data.vaccine_name and p.petlife_pet_id and await _has_consent(db, p.petlife_pet_id, ctx.clinic_id):
        v = Vaccine(pet_id=p.petlife_pet_id, name=data.vaccine_name, date_given=when,
                    next_due=vals["next_due"], lot_number=data.vaccine_lot,
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
                           f"{ctx.clinic.name} registrou a vacina de {pet.name}",
                           f"{data.vaccine_name} já está na carteirinha do app.")
        except Exception:
            pass
    return {**(await _record_one(db, r)), "sent_to_app": sent}


@router.put("/records/{record_id}")
async def update_record(record_id: int, data: RecordPatch, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    r = await _own(db, CrmRecord, record_id, ctx)
    _require_record_role(ctx, r.kind)
    if _locked(r):
        raise HTTPException(status_code=409, detail=LOCKED_MSG)
    if r.staff_user_id != ctx.user.id and not ctx.is_admin:
        raise HTTPException(status_code=403, detail="Só quem fez o registro ou o administrador pode editar.")
    vals = data.model_dump(exclude_unset=True)
    if "kind" in vals:
        if vals["kind"] not in RECORD_KINDS:
            raise HTTPException(status_code=400, detail="Tipo de registro inválido.")
        _require_record_role(ctx, vals["kind"])
    if "title" in vals and not (vals["title"] or "").strip():
        raise HTTPException(status_code=400, detail="Informe o título.")
    if vals.get("appointment_id"):
        await _own(db, CrmAppointment, vals["appointment_id"], ctx)
    if "performed_at" in vals:
        vals["performed_at"] = _check_performed(vals["performed_at"])
    if "next_due" in vals:
        vals["next_due"] = _naive(vals["next_due"])
    for k, v in vals.items():
        setattr(r, k, v)
    r.updated_at = _now()
    if r.petlife_vaccine_id:
        v = await db.get(Vaccine, r.petlife_vaccine_id)
        if v:
            if r.vaccine_name:
                v.name = r.vaccine_name
            v.lot_number = r.vaccine_lot
            v.next_due = r.next_due
            v.date_given = r.performed_at or r.created_at
    if "weight_kg" in vals or "performed_at" in vals:
        await db.flush()
        p = await db.get(CrmPatient, r.patient_id)
        if p:
            await _refresh_patient_weight(db, p)
    await db.commit()
    return await _record_one(db, r)


class VoidIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=300)


async def _drop_linked_vaccine(db: AsyncSession, r: CrmRecord) -> None:
    if r.petlife_vaccine_id:
        v = await db.get(Vaccine, r.petlife_vaccine_id)
        r.petlife_vaccine_id = None
        if v:
            await db.delete(v)


@router.post("/records/{record_id}/void")
async def void_record(record_id: int, data: VoidIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    r = await _own(db, CrmRecord, record_id, ctx)
    _require_record_role(ctx, r.kind)
    if r.voided_at:
        raise HTTPException(status_code=409, detail="Este registro já foi anulado.")
    reason = data.reason.strip()
    if len(reason) < 3:
        raise HTTPException(status_code=400, detail="Explique o motivo da anulação.")
    r.voided_at, r.void_reason, r.voided_by_user_id = _now(), reason, ctx.user.id
    await _drop_linked_vaccine(db, r)
    await db.flush()
    p = await db.get(CrmPatient, r.patient_id)
    if p and r.weight_kg is not None:
        await _refresh_patient_weight(db, p)
    await db.commit()
    return await _record_one(db, r)


class AddendumIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)


@router.post("/records/{record_id}/addenda", status_code=201)
async def add_addendum(record_id: int, data: AddendumIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    r = await _own(db, CrmRecord, record_id, ctx)
    _require_record_role(ctx, r.kind)
    body = data.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Escreva o adendo.")
    db.add(CrmRecordAddendum(clinic_id=ctx.clinic_id, record_id=r.id, staff_user_id=ctx.user.id, body=body))
    await db.commit()
    return await _record_one(db, r)


@router.delete("/records/{record_id}")
async def delete_record(record_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    r = await _own(db, CrmRecord, record_id, ctx)
    _require_record_role(ctx, r.kind)
    if _locked(r) or (r.staff_user_id != ctx.user.id and not ctx.is_admin):
        raise HTTPException(status_code=409, detail=LOCKED_MSG)
    await _drop_linked_vaccine(db, r)
    await db.execute(sa_delete(CrmRecordAddendum).where(CrmRecordAddendum.record_id == r.id))
    p = await db.get(CrmPatient, r.patient_id)
    had_weight = r.weight_kg is not None
    await db.delete(r)
    await db.flush()
    if p and had_weight:
        await _refresh_patient_weight(db, p)
    await db.commit()
    return {"ok": True}


@router.post("/records/{record_id}/reminded")
async def mark_reminded(record_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao")
    r = await _own(db, CrmRecord, record_id, ctx)
    r.reminded_at = _now()
    await db.commit()
    return {"ok": True}


# ── Modelos de prontuário ─────────────────────────────────────────────────────
class TemplateIn(BaseModel):
    kind: str = "consulta"
    name: str = Field(..., min_length=1, max_length=120)
    title: Optional[str] = Field(None, max_length=200)
    body: Optional[str] = Field(None, max_length=20000)
    subjective: Optional[str] = Field(None, max_length=20000)
    objective: Optional[str] = Field(None, max_length=20000)
    assessment: Optional[str] = Field(None, max_length=20000)
    plan: Optional[str] = Field(None, max_length=20000)


class TemplatePatch(BaseModel):
    kind: Optional[str] = None
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    title: Optional[str] = Field(None, max_length=200)
    body: Optional[str] = Field(None, max_length=20000)
    subjective: Optional[str] = Field(None, max_length=20000)
    objective: Optional[str] = Field(None, max_length=20000)
    assessment: Optional[str] = Field(None, max_length=20000)
    plan: Optional[str] = Field(None, max_length=20000)


def s_template(t: CrmRecordTemplate) -> dict:
    return {"id": t.id, "kind": t.kind, "name": t.name, "title": t.title, "body": t.body,
            "subjective": t.subjective, "objective": t.objective, "assessment": t.assessment, "plan": t.plan}


@router.get("/record-templates")
async def list_templates(kind: str = "", ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "banho_tosa")
    stmt = select(CrmRecordTemplate).where(CrmRecordTemplate.clinic_id == ctx.clinic_id)
    if ctx.role == "banho_tosa":
        stmt = stmt.where(CrmRecordTemplate.kind == "banho_tosa")
    if kind:
        stmt = stmt.where(CrmRecordTemplate.kind == kind)
    return [s_template(t) for t in (await db.execute(stmt.order_by(CrmRecordTemplate.name))).scalars()]


@router.post("/record-templates", status_code=201)
async def create_template(data: TemplateIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    if data.kind not in RECORD_KINDS:
        raise HTTPException(status_code=400, detail="Tipo de registro inválido.")
    _require_record_role(ctx, data.kind)
    t = CrmRecordTemplate(clinic_id=ctx.clinic_id, created_by=ctx.user.id, **data.model_dump())
    t.name = t.name.strip()
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return s_template(t)


@router.put("/record-templates/{template_id}")
async def update_template(template_id: int, data: TemplatePatch, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    t = await _own(db, CrmRecordTemplate, template_id, ctx)
    _require_record_role(ctx, t.kind)
    vals = data.model_dump(exclude_unset=True)
    if "kind" in vals:
        if vals["kind"] not in RECORD_KINDS:
            raise HTTPException(status_code=400, detail="Tipo de registro inválido.")
        _require_record_role(ctx, vals["kind"])
    if "name" in vals and not (vals["name"] or "").strip():
        raise HTTPException(status_code=400, detail="Dê um nome ao modelo.")
    for k, v in vals.items():
        setattr(t, k, v)
    await db.commit()
    return s_template(t)


@router.delete("/record-templates/{template_id}")
async def delete_template(template_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    t = await _own(db, CrmRecordTemplate, template_id, ctx)
    _require_record_role(ctx, t.kind)
    await db.delete(t)
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
    existing = (await db.execute(select(CrmPatient).where(CrmPatient.clinic_id == ctx.clinic_id, CrmPatient.petlife_pet_id == pet_id))).scalars().first()
    if existing:
        return {"patient_id": existing.id, "client_id": existing.client_id, "already": True}
    client = (await db.execute(select(CrmClient).where(CrmClient.clinic_id == ctx.clinic_id, CrmClient.petlife_user_id == owner.id))).scalars().first()
    if not client and owner.email:
        client = (await db.execute(select(CrmClient).where(CrmClient.clinic_id == ctx.clinic_id, func.lower(CrmClient.email) == owner.email.lower()))).scalars().first()
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


@router.post("/patients/{patient_id}/invite")
async def invite_patient(patient_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    """Link para o tutor ligar este paciente ao app, com consentimento explícito."""
    ctx.require("vet", "recepcao")
    p = await _own(db, CrmPatient, patient_id, ctx)
    if p.petlife_pet_id and await _has_consent(db, p.petlife_pet_id, ctx.clinic_id):
        raise HTTPException(status_code=409, detail="Este pet já está ligado ao app do tutor.")
    now = _now()
    inv = (await db.execute(select(CrmInvite).where(
        CrmInvite.clinic_id == ctx.clinic_id, CrmInvite.patient_id == p.id, CrmInvite.used_at.is_(None),
        CrmInvite.expires_at > now).order_by(CrmInvite.created_at.desc()))).scalars().first()
    if not inv:
        inv = CrmInvite(clinic_id=ctx.clinic_id, patient_id=p.id, code=secrets.token_urlsafe(16),
                        expires_at=now + timedelta(days=INVITE_DAYS), created_by=ctx.user.id)
        db.add(inv)
        await db.commit()
    return {"code": inv.code, "path": f"/clinica-convite/{inv.code}", "expires_at": _dt(inv.expires_at)}


@router.get("/invites")
async def list_invites(ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao")
    rows = (await db.execute(
        select(CrmInvite, CrmPatient, CrmClient).join(CrmPatient, CrmPatient.id == CrmInvite.patient_id)
        .join(CrmClient, CrmClient.id == CrmPatient.client_id)
        .where(CrmInvite.clinic_id == ctx.clinic_id).order_by(CrmInvite.created_at.desc()).limit(100)
    )).all()
    now = _now()
    return [{"id": i.id, "patient_id": p.id, "patient_name": p.name, "client_name": c.name, "client_phone": c.phone,
             "created_at": _dt(i.created_at), "expires_at": _dt(i.expires_at), "used_at": _dt(i.used_at),
             "status": "aceito" if i.used_at else ("expirado" if i.expires_at <= now else "pendente")}
            for i, p, c in rows]


# ── Catálogo e estoque ────────────────────────────────────────────────────────
class ItemIn(BaseModel):
    kind: str = "service"
    category: Optional[str] = Field(None, max_length=40)
    name: str = Field(..., min_length=1, max_length=200)
    sku: Optional[str] = Field(None, max_length=60)
    price: float = Field(0, ge=0)
    cost: Optional[float] = Field(None, ge=0)
    min_stock: Optional[float] = None
    unit: Optional[str] = Field("un", max_length=10)
    duration_min: Optional[int] = Field(None, ge=0, le=1440)
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
    if data.kind not in ("service", "product"):
        raise HTTPException(status_code=400, detail="Tipo de item inválido.")
    i = CrmItem(clinic_id=ctx.clinic_id, stock_qty=0 if data.kind == "product" else None, **data.model_dump())
    db.add(i)
    await db.commit()
    await db.refresh(i)
    return s_item(i)


@router.put("/items/{item_id}")
async def update_item(item_id: int, data: ItemIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    i = await _own(db, CrmItem, item_id, ctx)
    if data.kind not in ("service", "product"):
        raise HTTPException(status_code=400, detail="Tipo de item inválido.")
    for k, v in data.model_dump().items():
        setattr(i, k, v)
    if i.kind == "product" and i.stock_qty is None:
        i.stock_qty = 0
    await db.commit()
    return s_item(i)


@router.delete("/items/{item_id}")
async def delete_item(item_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    """Item já usado em venda ou agendamento só é desativado (o histórico continua)."""
    ctx.require("recepcao")
    i = await _own(db, CrmItem, item_id, ctx)
    used = (await db.execute(select(CrmSaleItem.id).where(CrmSaleItem.item_id == i.id).limit(1))).first() or \
        (await db.execute(select(CrmAppointment.id).where(CrmAppointment.item_id == i.id).limit(1))).first()
    if used:
        i.active = False
        await db.commit()
        return {"ok": True, "deactivated": True}
    await db.execute(sa_delete(CrmStockMove).where(CrmStockMove.item_id == i.id))
    await db.delete(i)
    await db.commit()
    return {"ok": True, "deactivated": False}


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
    if data.reason not in STOCK_REASONS:
        raise HTTPException(status_code=400, detail="Motivo inválido. Use entrada, ajuste, perda ou devolução.")
    if data.qty == 0:
        raise HTTPException(status_code=400, detail="Informe a quantidade.")
    if data.reason in ("entrada", "devolucao") and data.qty <= 0:
        raise HTTPException(status_code=400, detail="A quantidade de entrada precisa ser maior que zero.")
    qty = -abs(data.qty) if data.reason == "perda" else data.qty
    i.stock_qty = round((i.stock_qty or 0) + qty, 3)
    db.add(CrmStockMove(clinic_id=ctx.clinic_id, item_id=i.id, qty=qty, reason=data.reason, note=data.note, user_id=ctx.user.id))
    await db.commit()
    return s_item(i)


@router.get("/items/{item_id}/moves")
async def stock_moves(item_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    await _own(db, CrmItem, item_id, ctx)
    rows = (await db.execute(select(CrmStockMove).where(CrmStockMove.item_id == item_id)
                             .order_by(CrmStockMove.created_at.desc(), CrmStockMove.id.desc()).limit(100))).scalars().all()
    names = await _user_names(db, [m.user_id for m in rows])
    return [{"id": m.id, "qty": m.qty, "reason": m.reason, "note": m.note, "user_name": names.get(m.user_id),
             "at": _dt(m.created_at)} for m in rows]


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
    price: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=2000)
    is_fit_in: bool = False
    allow_conflict: bool = False


class ApptPatchIn(BaseModel):
    status: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    staff_user_id: Optional[int] = None
    patient_id: Optional[int] = None
    item_id: Optional[int] = None
    notes: Optional[str] = Field(None, max_length=2000)
    price: Optional[float] = Field(None, ge=0)
    type: Optional[str] = None
    is_fit_in: Optional[bool] = None
    allow_conflict: bool = False
    mark_confirm_sent: bool = False
    mark_ready_notified: bool = False


async def _appt_out(db: AsyncSession, appts: list) -> list:
    cids = {a.client_id for a in appts}
    pids = {a.patient_id for a in appts if a.patient_id}
    uids = {a.staff_user_id for a in appts if a.staff_user_id}
    iids = {a.item_id for a in appts if a.item_id}
    cm = {c.id: c for c in (await db.execute(select(CrmClient).where(CrmClient.id.in_(cids or {0})))).scalars()}
    pm = {p.id: p for p in (await db.execute(select(CrmPatient).where(CrmPatient.id.in_(pids or {0})))).scalars()}
    um = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(uids or {0})))).scalars()}
    im = {i.id: i for i in (await db.execute(select(CrmItem).where(CrmItem.id.in_(iids or {0})))).scalars()}
    return [s_appt(a, cm.get(a.client_id), pm.get(a.patient_id), um.get(a.staff_user_id), im.get(a.item_id)) for a in appts]


async def _check_conflict(db: AsyncSession, ctx: Ctx, staff_id: Optional[int], starts: datetime, ends: datetime,
                          status: str, exclude_id: Optional[int], allow: bool) -> bool:
    """True se há sobreposição (e foi permitida como encaixe). Sem permissão, responde 409."""
    if staff_id is None or status in APPT_INACTIVE:
        return False
    stmt = select(CrmAppointment).where(
        CrmAppointment.clinic_id == ctx.clinic_id, CrmAppointment.staff_user_id == staff_id,
        CrmAppointment.status.not_in(APPT_INACTIVE), CrmAppointment.starts_at < ends,
        CrmAppointment.starts_at > starts - timedelta(days=1))
    if exclude_id:
        stmt = stmt.where(CrmAppointment.id != exclude_id)
    others = [o for o in (await db.execute(stmt.order_by(CrmAppointment.starts_at))).scalars()
              if (o.ends_at or o.starts_at + timedelta(minutes=30)) > starts]
    if not others:
        return False
    if allow:
        return True
    staff = await db.get(User, staff_id)
    raise HTTPException(status_code=409, detail={
        "code": "conflict", "message": f"Horário ocupado para {staff.name if staff else 'este profissional'}.",
        "conflicts": await _appt_out(db, others)})


@router.get("/appointments")
async def list_appts(start: datetime, end: datetime, staff_user_id: Optional[int] = None,
                     ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    start, end = _naive(start), _naive(end)
    if (end - start).days > 62:
        raise HTTPException(status_code=400, detail="Período máximo de 2 meses.")
    stmt = select(CrmAppointment).where(
        CrmAppointment.clinic_id == ctx.clinic_id, CrmAppointment.starts_at >= start, CrmAppointment.starts_at < end)
    if staff_user_id:
        stmt = stmt.where(CrmAppointment.staff_user_id == staff_user_id)
    appts = (await db.execute(stmt.order_by(CrmAppointment.starts_at))).scalars().all()
    return await _appt_out(db, appts)


@router.get("/appointments/{appt_id}")
async def get_appt(appt_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    a = await _own(db, CrmAppointment, appt_id, ctx)
    return (await _appt_out(db, [a]))[0]


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
    await _check_staff(db, ctx, data.staff_user_id)
    vals = data.model_dump(exclude={"allow_conflict"})
    vals["starts_at"] = _naive(data.starts_at)
    vals["ends_at"] = _naive(data.ends_at)
    if data.item_id:
        it = await _own(db, CrmItem, data.item_id, ctx)
        if vals.get("price") is None:
            vals["price"] = it.price
        if not vals.get("ends_at") and it.duration_min:
            vals["ends_at"] = vals["starts_at"] + timedelta(minutes=it.duration_min)
    if not vals.get("ends_at") or vals["ends_at"] <= vals["starts_at"]:
        vals["ends_at"] = vals["starts_at"] + timedelta(minutes=30)
    if await _check_conflict(db, ctx, data.staff_user_id, vals["starts_at"], vals["ends_at"], data.status, None,
                             data.allow_conflict or data.is_fit_in):
        vals["is_fit_in"] = True
    a = CrmAppointment(clinic_id=ctx.clinic_id, **vals)
    stamp = STATUS_STAMP.get(data.status)
    if stamp:
        setattr(a, stamp, _now())
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return (await _appt_out(db, [a]))[0]


@router.patch("/appointments/{appt_id}")
async def patch_appt(appt_id: int, data: ApptPatchIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    a = await _own(db, CrmAppointment, appt_id, ctx)
    vals = data.model_dump(exclude_unset=True, exclude={"allow_conflict", "mark_confirm_sent", "mark_ready_notified"})
    if "status" in vals and vals["status"] not in APPT_STATUS:
        raise HTTPException(status_code=400, detail="Situação inválida.")
    if "type" in vals and vals["type"] not in APPT_TYPES:
        raise HTTPException(status_code=400, detail="Tipo inválido.")
    if "status" in vals and vals["status"] is None:
        vals.pop("status")
    if "type" in vals and vals["type"] is None:
        vals.pop("type")
    if vals.get("patient_id"):
        p = await _own(db, CrmPatient, vals["patient_id"], ctx)
        if p.client_id != a.client_id:
            raise HTTPException(status_code=400, detail="O pet não pertence a esse cliente.")
    if vals.get("item_id"):
        await _own(db, CrmItem, vals["item_id"], ctx)
    if "staff_user_id" in vals:
        await _check_staff(db, ctx, vals["staff_user_id"])
    if "is_fit_in" in vals and vals["is_fit_in"] is None:
        vals.pop("is_fit_in")

    old_start, old_end = a.starts_at, a.ends_at or (a.starts_at + timedelta(minutes=30))
    if vals.get("starts_at") is None:
        vals.pop("starts_at", None)
    else:
        vals["starts_at"] = _naive(vals["starts_at"])
    if "ends_at" in vals:
        vals["ends_at"] = _naive(vals["ends_at"])
    new_start = vals.get("starts_at", old_start)
    if "starts_at" in vals and not vals.get("ends_at"):
        vals["ends_at"] = new_start + (old_end - old_start)      # remarcar mantém a duração
    new_end = vals.get("ends_at") or old_end
    if new_end <= new_start:
        raise HTTPException(status_code=400, detail="O fim precisa ser depois do início.")
    vals["ends_at"] = new_end

    new_status = vals.get("status", a.status)
    new_staff = vals.get("staff_user_id", a.staff_user_id)
    moved = new_start != old_start or new_end != old_end or new_staff != a.staff_user_id or \
        (a.status in APPT_INACTIVE and new_status not in APPT_INACTIVE)
    if moved:
        fit = vals.get("is_fit_in", a.is_fit_in)
        if await _check_conflict(db, ctx, new_staff, new_start, new_end, new_status, a.id, data.allow_conflict or bool(fit)):
            vals["is_fit_in"] = True

    for k, v in vals.items():
        setattr(a, k, v)
    stamp = STATUS_STAMP.get(new_status)
    if "status" in vals and stamp and getattr(a, stamp) is None:
        setattr(a, stamp, _now())
    if data.mark_confirm_sent:
        a.confirm_sent_at = _now()
    if data.mark_ready_notified:
        a.ready_notified_at = _now()
    await db.commit()
    return (await _appt_out(db, [a]))[0]


@router.delete("/appointments/{appt_id}")
async def delete_appt(appt_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao")
    a = await _own(db, CrmAppointment, appt_id, ctx)
    await db.delete(a)
    await db.commit()
    return {"ok": True}


# ── Lista de espera ───────────────────────────────────────────────────────────
class WaitIn(BaseModel):
    client_id: int
    patient_id: Optional[int] = None
    item_id: Optional[int] = None
    staff_user_id: Optional[int] = None
    period: str = "qualquer"
    days: Optional[str] = Field(None, max_length=40)
    notes: Optional[str] = Field(None, max_length=500)


class WaitPatch(BaseModel):
    status: Optional[str] = None
    period: Optional[str] = None
    days: Optional[str] = Field(None, max_length=40)
    notes: Optional[str] = Field(None, max_length=500)
    appointment_id: Optional[int] = None
    patient_id: Optional[int] = None
    item_id: Optional[int] = None
    staff_user_id: Optional[int] = None


async def _wait_out(db: AsyncSession, rows: list) -> list:
    cm = {c.id: c for c in (await db.execute(select(CrmClient).where(
        CrmClient.id.in_({w.client_id for w in rows} or {0})))).scalars()}
    pm = {p.id: p.name for p in (await db.execute(select(CrmPatient).where(
        CrmPatient.id.in_({w.patient_id for w in rows if w.patient_id} or {0})))).scalars()}
    im = {i.id: i.name for i in (await db.execute(select(CrmItem).where(
        CrmItem.id.in_({w.item_id for w in rows if w.item_id} or {0})))).scalars()}
    names = await _user_names(db, [w.staff_user_id for w in rows])
    out = []
    for w in rows:
        c = cm.get(w.client_id)
        out.append({"id": w.id, "client_id": w.client_id, "client_name": c.name if c else "",
                    "client_phone": c.phone if c else None, "patient_id": w.patient_id,
                    "patient_name": pm.get(w.patient_id), "item_id": w.item_id, "item_name": im.get(w.item_id),
                    "staff_user_id": w.staff_user_id, "staff_name": names.get(w.staff_user_id),
                    "period": w.period, "days": w.days, "notes": w.notes, "status": w.status,
                    "appointment_id": w.appointment_id, "created_at": _dt(w.created_at)})
    return out


async def _wait_validate(db: AsyncSession, ctx: Ctx, client_id: int, vals: dict) -> None:
    if vals.get("patient_id"):
        p = await _own(db, CrmPatient, vals["patient_id"], ctx)
        if p.client_id != client_id:
            raise HTTPException(status_code=400, detail="O pet não pertence a esse cliente.")
    if vals.get("item_id"):
        await _own(db, CrmItem, vals["item_id"], ctx)
    if "staff_user_id" in vals:
        await _check_staff(db, ctx, vals["staff_user_id"])
    if "period" in vals and vals["period"] not in WAIT_PERIODS:
        raise HTTPException(status_code=400, detail="Período inválido.")
    if "status" in vals and vals["status"] not in WAIT_STATUS:
        raise HTTPException(status_code=400, detail="Situação inválida.")
    if vals.get("appointment_id"):
        await _own(db, CrmAppointment, vals["appointment_id"], ctx)


@router.get("/waitlist")
async def list_wait(status: str = "aguardando", ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    if status not in WAIT_STATUS:
        raise HTTPException(status_code=400, detail="Situação inválida.")
    rows = (await db.execute(select(CrmWaitlist).where(CrmWaitlist.clinic_id == ctx.clinic_id, CrmWaitlist.status == status)
                             .order_by(CrmWaitlist.created_at, CrmWaitlist.id).limit(500))).scalars().all()
    return await _wait_out(db, rows)


@router.post("/waitlist", status_code=201)
async def create_wait(data: WaitIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    await _own(db, CrmClient, data.client_id, ctx)
    vals = data.model_dump()
    await _wait_validate(db, ctx, data.client_id, vals)
    w = CrmWaitlist(clinic_id=ctx.clinic_id, status="aguardando", **vals)
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return (await _wait_out(db, [w]))[0]


@router.patch("/waitlist/{wait_id}")
async def patch_wait(wait_id: int, data: WaitPatch, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    w = await _own(db, CrmWaitlist, wait_id, ctx)
    vals = data.model_dump(exclude_unset=True)
    for k in ("status", "period"):
        if k in vals and vals[k] is None:
            vals.pop(k)
    await _wait_validate(db, ctx, w.client_id, vals)
    for k, v in vals.items():
        setattr(w, k, v)
    await db.commit()
    return (await _wait_out(db, [w]))[0]


@router.delete("/waitlist/{wait_id}")
async def delete_wait(wait_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    w = await _own(db, CrmWaitlist, wait_id, ctx)
    await db.delete(w)
    await db.commit()
    return {"ok": True}


# ── Caixa diário ──────────────────────────────────────────────────────────────
async def _open_session(db: AsyncSession, clinic_id: int) -> Optional[CrmCashSession]:
    return (await db.execute(select(CrmCashSession).where(
        CrmCashSession.clinic_id == clinic_id, CrmCashSession.closed_at.is_(None))
        .order_by(CrmCashSession.opened_at.desc()))).scalars().first()


def _cash_closed_error() -> HTTPException:
    return HTTPException(status_code=409, detail={"code": "cash_closed",
                                                  "message": "Abra o caixa para registrar vendas pagas."})


async def _cash_for_payment(db: AsyncSession, ctx: Ctx, allow_without_cash: bool) -> Optional[int]:
    sess = await _open_session(db, ctx.clinic_id)
    if sess:
        return sess.id
    if ctx.is_admin and allow_without_cash:
        return None
    raise _cash_closed_error()


async def _sessions_out(db: AsyncSession, sessions: list, with_moves: bool = True) -> list:
    ids = [s.id for s in sessions]
    totals: dict[int, dict] = {i: {} for i in ids}
    counts: dict[int, int] = {i: 0 for i in ids}
    moves: dict[int, list] = {i: [] for i in ids}
    if ids:
        for sid, method, total, n in (await db.execute(
                select(CrmSale.cash_session_id, CrmSale.payment_method, func.sum(CrmSale.total), func.count(CrmSale.id))
                .where(CrmSale.cash_session_id.in_(ids), CrmSale.status == "paga")
                .group_by(CrmSale.cash_session_id, CrmSale.payment_method))).all():
            totals[sid][method or "pix"] = totals[sid].get(method or "pix", 0.0) + float(total or 0)
            counts[sid] += int(n or 0)
        for m in (await db.execute(select(CrmCashMove).where(CrmCashMove.session_id.in_(ids))
                                   .order_by(CrmCashMove.created_at, CrmCashMove.id))).scalars():
            moves[m.session_id].append(m)
    names = await _user_names(db, [s.opened_by for s in sessions] + [s.closed_by for s in sessions]
                              + [m.user_id for lst in moves.values() for m in lst])
    out = []
    for s in sessions:
        by_method = {k: 0.0 for k in CASH_METHODS}
        for k, v in totals[s.id].items():
            by_method[k] = by_method.get(k, 0.0) + v
        by_method = {k: _r2(v) for k, v in by_method.items()}
        sangrias = _r2(sum(m.amount for m in moves[s.id] if m.kind == "sangria"))
        reforcos = _r2(sum(m.amount for m in moves[s.id] if m.kind == "reforco"))
        live_expected = dict(by_method)
        live_expected["dinheiro"] = _r2((s.opening_amount or 0) + by_method.get("dinheiro", 0) + reforcos - sangrias)
        closed = s.closed_at is not None
        expected = {k: _r2(v) for k, v in (s.expected or {}).items()} if closed and s.expected else live_expected
        counted = {k: _r2(v) for k, v in (s.counted or {}).items()} if s.counted is not None else None
        difference = None
        if counted is not None:
            keys = set(expected) | set(counted)
            difference = {k: _r2(counted.get(k, 0) - expected.get(k, 0)) for k in keys}
        out.append({
            "id": s.id, "status": "fechado" if closed else "aberto", "opened_at": _dt(s.opened_at),
            "opened_by_name": names.get(s.opened_by), "opening_amount": _r2(s.opening_amount),
            "closed_at": _dt(s.closed_at), "closed_by_name": names.get(s.closed_by), "sales_count": counts[s.id],
            "totals_by_method": by_method, "sangrias": sangrias, "reforcos": reforcos, "expected": expected,
            "counted": counted, "difference": difference,
            "difference_total": _r2(s.difference) if s.difference is not None else
            (_r2(sum(difference.values())) if difference is not None else None),
            "moves": [{"id": m.id, "kind": m.kind, "amount": _r2(m.amount), "note": m.note,
                       "user_name": names.get(m.user_id), "created_at": _dt(m.created_at)}
                      for m in moves[s.id]] if with_moves else [],
            "notes": s.notes,
        })
    return out


async def _session_one(db: AsyncSession, s: CrmCashSession) -> dict:
    return (await _sessions_out(db, [s]))[0]


class CashOpenIn(BaseModel):
    opening_amount: float = Field(0, ge=0)
    notes: Optional[str] = Field(None, max_length=300)


class CashMoveIn(BaseModel):
    kind: Literal["sangria", "reforco"]
    amount: float = Field(..., gt=0)
    note: Optional[str] = Field(None, max_length=200)


class CashCloseIn(BaseModel):
    counted: dict[str, float] = Field(default_factory=dict)
    notes: Optional[str] = Field(None, max_length=300)


@router.get("/cash/current")
async def cash_current(ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    s = await _open_session(db, ctx.clinic_id)
    return {"session": await _session_one(db, s) if s else None}


@router.post("/cash/open", status_code=201)
async def cash_open(data: CashOpenIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    if await _open_session(db, ctx.clinic_id):
        raise HTTPException(status_code=409, detail="Já existe um caixa aberto.")
    s = CrmCashSession(clinic_id=ctx.clinic_id, opened_by=ctx.user.id, opened_at=_now(),
                       opening_amount=round(data.opening_amount, 2), notes=(data.notes or "").strip() or None)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return await _session_one(db, s)


@router.post("/cash/moves", status_code=201)
async def cash_move(data: CashMoveIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    s = await _open_session(db, ctx.clinic_id)
    if not s:
        raise HTTPException(status_code=409, detail="Não há caixa aberto.")
    if data.kind == "sangria":
        cur = await _session_one(db, s)
        if round(data.amount, 2) > cur["expected"].get("dinheiro", 0) + 0.004:
            raise HTTPException(status_code=400, detail="A sangria é maior que o dinheiro esperado no caixa.")
    db.add(CrmCashMove(clinic_id=ctx.clinic_id, session_id=s.id, kind=data.kind, amount=round(data.amount, 2),
                       note=(data.note or "").strip() or None, user_id=ctx.user.id))
    await db.commit()
    return await _session_one(db, s)


@router.post("/cash/close")
async def cash_close(data: CashCloseIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    s = await _open_session(db, ctx.clinic_id)
    if not s:
        raise HTTPException(status_code=409, detail="Não há caixa aberto.")
    counted = {}
    for k, v in data.counted.items():
        if k not in PAY_METHODS:
            raise HTTPException(status_code=400, detail="Forma de pagamento inválida na conferência.")
        if v is None or v < 0:
            raise HTTPException(status_code=400, detail="Os valores contados não podem ser negativos.")
        counted[k] = round(float(v), 2)
    cur = await _session_one(db, s)
    expected = cur["expected"]
    diff = round(sum(counted.get(k, 0) - expected.get(k, 0) for k in set(expected) | set(counted)), 2)
    s.expected, s.counted, s.difference = expected, counted, diff
    s.closed_at, s.closed_by = _now(), ctx.user.id
    if data.notes and data.notes.strip():
        s.notes = ((s.notes + " · ") if s.notes else "") + data.notes.strip()
        s.notes = s.notes[:300]
    await db.commit()
    return await _session_one(db, s)


@router.get("/cash/sessions")
async def cash_sessions(limit: int = 30, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    rows = (await db.execute(select(CrmCashSession).where(CrmCashSession.clinic_id == ctx.clinic_id)
                             .order_by(CrmCashSession.opened_at.desc()).limit(max(1, min(limit, 100))))).scalars().all()
    return await _sessions_out(db, rows, with_moves=False)


@router.get("/cash/sessions/{session_id}")
async def cash_session(session_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    s = await _own(db, CrmCashSession, session_id, ctx)
    return await _session_one(db, s)


# ── Vendas ────────────────────────────────────────────────────────────────────
class SaleItemIn(BaseModel):
    item_id: Optional[int] = None
    description: Optional[str] = Field(None, max_length=200)
    qty: float = Field(1, gt=0)
    unit_price: Optional[float] = Field(None, ge=0)
    staff_user_id: Optional[int] = None


class SaleIn(BaseModel):
    client_id: Optional[int] = None
    patient_id: Optional[int] = None
    appointment_id: Optional[int] = None
    items: list[SaleItemIn] = Field(..., min_length=1)
    discount: float = Field(0, ge=0)
    payment_method: Optional[str] = "pix"
    status: str = "paga"            # paga | aberta
    due_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=300)
    allow_without_cash: bool = False


@router.post("/sales", status_code=201)
async def create_sale(data: SaleIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("vet", "recepcao", "banho_tosa")
    if data.status not in ("paga", "aberta"):
        raise HTTPException(status_code=400, detail="Situação inválida.")
    if data.payment_method and data.payment_method not in PAY_METHODS:
        raise HTTPException(status_code=400, detail="Forma de pagamento inválida.")
    if data.client_id:
        await _own(db, CrmClient, data.client_id, ctx)
    if data.patient_id:
        p = await _own(db, CrmPatient, data.patient_id, ctx)
        if data.client_id and p.client_id != data.client_id:
            raise HTTPException(status_code=400, detail="O pet não pertence a esse cliente.")
    appt = await _own(db, CrmAppointment, data.appointment_id, ctx) if data.appointment_id else None
    session_id = await _cash_for_payment(db, ctx, data.allow_without_cash) if data.status == "paga" else None

    lines, subtotal = [], 0.0
    for li in data.items:
        it = await _own(db, CrmItem, li.item_id, ctx) if li.item_id else None
        desc = (li.description or (it.name if it else "")).strip()
        if not desc:
            raise HTTPException(status_code=400, detail="Item sem descrição.")
        await _check_staff(db, ctx, li.staff_user_id)
        staff = li.staff_user_id
        if staff is None and appt and appt.staff_user_id and (it is None or it.kind == "service"):
            staff = appt.staff_user_id
        price = li.unit_price if li.unit_price is not None else (it.price if it else 0)
        qty = round(li.qty, 3)
        total = round(price * qty, 2)
        subtotal += total
        lines.append((it, desc, qty, price, total, staff))
    discount = max(0.0, min(data.discount or 0, subtotal))
    now = _now()
    sale = CrmSale(clinic_id=ctx.clinic_id, client_id=data.client_id, patient_id=data.patient_id,
                   appointment_id=data.appointment_id, user_id=ctx.user.id, subtotal=round(subtotal, 2),
                   discount=round(discount, 2), total=round(subtotal - discount, 2),
                   payment_method=data.payment_method, status=data.status, due_date=_naive(data.due_date),
                   paid_at=now if data.status == "paga" else None, notes=data.notes, cash_session_id=session_id)
    db.add(sale)
    await db.flush()
    warnings = []
    for it, desc, qty, price, total, staff in lines:
        db.add(CrmSaleItem(sale_id=sale.id, item_id=it.id if it else None, description=desc, qty=qty,
                           unit_price=price, total=total, staff_user_id=staff))
        if it and it.kind == "product":
            it.stock_qty = round((it.stock_qty or 0) - qty, 3)
            db.add(CrmStockMove(clinic_id=ctx.clinic_id, item_id=it.id, qty=-qty, reason="venda", note=f"Venda #{sale.id}", user_id=ctx.user.id))
            if it.stock_qty < 0:
                q = f"{it.stock_qty:g}".replace(".", ",")
                warnings.append(f"Estoque de {it.name} ficou em {q}.")
    if appt:
        appt.status = "concluido"
        if appt.finished_at is None:
            appt.finished_at = now
    await db.commit()
    return {**(await _sale_one(db, sale)), "warnings": warnings}


@router.get("/sales")
async def list_sales(start: datetime, end: datetime, status: str = "", ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("recepcao", "vet", "banho_tosa")
    start, end = _naive(start), _naive(end)
    stmt = select(CrmSale).where(CrmSale.clinic_id == ctx.clinic_id, CrmSale.created_at >= start, CrmSale.created_at < end)
    if status:
        stmt = stmt.where(CrmSale.status == status)
    sales = (await db.execute(stmt.order_by(CrmSale.created_at.desc()).limit(500))).scalars().all()
    return await _sales_out(db, sales)


@router.get("/receivables")
async def receivables(ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("recepcao", "vet", "banho_tosa")
    sales = (await db.execute(select(CrmSale).where(CrmSale.clinic_id == ctx.clinic_id, CrmSale.status == "aberta")
                              .order_by(CrmSale.due_date.is_(None), CrmSale.due_date, CrmSale.created_at)
                              .limit(500))).scalars().all()
    return await _sales_out(db, sales)


@router.get("/sales/{sale_id}")
async def get_sale(sale_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    s = await _own(db, CrmSale, sale_id, ctx)
    return await _sale_one(db, s)


class PayIn(BaseModel):
    payment_method: str = "pix"
    allow_without_cash: bool = False


@router.post("/sales/{sale_id}/pay")
async def pay_sale(sale_id: int, data: PayIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require("recepcao", "vet", "banho_tosa")
    s = await _own(db, CrmSale, sale_id, ctx)
    if s.status != "aberta":
        raise HTTPException(status_code=400, detail="Essa venda não está em aberto.")
    if data.payment_method not in PAY_METHODS:
        raise HTTPException(status_code=400, detail="Forma de pagamento inválida.")
    s.cash_session_id = await _cash_for_payment(db, ctx, data.allow_without_cash)
    s.status, s.payment_method, s.paid_at = "paga", data.payment_method, _now()
    await db.commit()
    return await _sale_one(db, s)


@router.post("/sales/{sale_id}/cancel")
async def cancel_sale(sale_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    s = await _own(db, CrmSale, sale_id, ctx)
    if s.status == "cancelada":
        return await _sale_one(db, s)
    for li in (await db.execute(select(CrmSaleItem).where(CrmSaleItem.sale_id == s.id))).scalars():
        if li.item_id:
            it = await db.get(CrmItem, li.item_id)
            if it and it.kind == "product":
                it.stock_qty = round((it.stock_qty or 0) + li.qty, 3)
                db.add(CrmStockMove(clinic_id=ctx.clinic_id, item_id=it.id, qty=li.qty, reason="ajuste", note=f"Cancelamento da venda #{s.id}", user_id=ctx.user.id))
    s.status = "cancelada"
    await db.commit()
    return await _sale_one(db, s)


# ── Despesas ──────────────────────────────────────────────────────────────────
class ExpenseIn(BaseModel):
    description: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=40)
    amount: float = Field(..., gt=0)
    due_date: Optional[datetime] = None
    paid: bool = True
    repeat_months: int = Field(0, ge=0, le=11)


class ExpensePatch(BaseModel):
    description: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=40)
    amount: Optional[float] = Field(None, gt=0)
    due_date: Optional[datetime] = None


def s_expense(e: CrmExpense) -> dict:
    return {"id": e.id, "description": e.description, "category": e.category, "amount": e.amount,
            "due_date": _dt(e.due_date), "paid_at": _dt(e.paid_at), "created_at": _dt(e.created_at)}


@router.get("/expenses")
async def list_expenses(start: datetime, end: datetime, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    start, end = _naive(start), _naive(end)
    ctx.require()
    rows = (await db.execute(select(CrmExpense).where(
        CrmExpense.clinic_id == ctx.clinic_id,
        or_(and_(CrmExpense.paid_at >= start, CrmExpense.paid_at < end),
            and_(CrmExpense.paid_at.is_(None), or_(CrmExpense.due_date.is_(None), CrmExpense.due_date < end))),
    ).order_by(CrmExpense.created_at.desc()).limit(500))).scalars()
    return [s_expense(e) for e in rows]


@router.post("/expenses", status_code=201)
async def create_expense(data: ExpenseIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    due = _naive(data.due_date)
    desc = data.description.strip()
    e = CrmExpense(clinic_id=ctx.clinic_id, description=desc, category=data.category, amount=round(data.amount, 2),
                   due_date=due, paid_at=_now() if data.paid else None)
    db.add(e)
    created = 1
    if not data.paid and due and data.repeat_months > 0:
        for i in range(1, data.repeat_months + 1):
            db.add(CrmExpense(clinic_id=ctx.clinic_id, description=desc, category=data.category,
                              amount=round(data.amount, 2), due_date=_add_months(due, i), paid_at=None))
            created += 1
    await db.commit()
    return {"ok": True, "id": e.id, "created": created}


@router.put("/expenses/{expense_id}")
async def update_expense(expense_id: int, data: ExpensePatch, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    e = await _own(db, CrmExpense, expense_id, ctx)
    vals = data.model_dump(exclude_unset=True)
    if "description" in vals:
        if not (vals["description"] or "").strip():
            raise HTTPException(status_code=400, detail="Informe a descrição.")
        e.description = vals["description"].strip()
    if "category" in vals:
        e.category = (vals["category"] or "").strip() or None
    if vals.get("amount") is not None:
        e.amount = round(vals["amount"], 2)
    if "due_date" in vals:
        e.due_date = _naive(vals["due_date"])
    await db.commit()
    return s_expense(e)


@router.post("/expenses/{expense_id}/pay")
async def pay_expense(expense_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    e = await _own(db, CrmExpense, expense_id, ctx)
    e.paid_at = _now()
    await db.commit()
    return {"ok": True}


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    e = await _own(db, CrmExpense, expense_id, ctx)
    await db.delete(e)
    await db.commit()
    return {"ok": True}


# ── Financeiro ────────────────────────────────────────────────────────────────
async def _revenue_by_day(db: AsyncSession, clinic_id: int, y: int, m: int) -> list:
    start, end = _month_bounds(y, m)
    first = date(y, m, 1)
    last_of_month = date(y, m, calendar.monthrange(y, m)[1])
    today = _today_brt()
    if first > today:
        return []
    last = min(last_of_month, today)
    totals: dict[date, float] = {}
    for paid_at, total in (await db.execute(select(CrmSale.paid_at, CrmSale.total).where(
            CrmSale.clinic_id == clinic_id, CrmSale.status == "paga", CrmSale.paid_at >= start,
            CrmSale.paid_at < end))).all():
        d = _brt_day(paid_at)
        totals[d] = totals.get(d, 0.0) + float(total or 0)
    return _fill_days(first, last, totals)


@router.get("/finance")
async def finance(month: str = "", ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    today = _today_brt()
    try:
        y, m = (int(month[:4]), int(month[5:7])) if len(month) == 7 else (today.year, today.month)
        if not 1 <= m <= 12:
            raise ValueError
    except ValueError:
        raise HTTPException(status_code=400, detail="Mês inválido. Use AAAA-MM.")
    start, end = _month_bounds(y, m)
    q = lambda sql, **p: db.execute(text(sql), {"c": ctx.clinic_id, "s": start, "e": end, **p})
    by_day = await _revenue_by_day(db, ctx.clinic_id, y, m)
    by_method = [{"method": r[0] or "—", "total": _r2(r[1]), "count": int(r[2])} for r in (await q(
        "SELECT payment_method, sum(total), count(*) FROM crm_sales WHERE clinic_id=:c AND status='paga' AND paid_at>=:s AND paid_at<:e GROUP BY 1 ORDER BY 2 DESC")).all()]
    by_category = [{"category": r[0] or "outros", "total": _r2(r[1])} for r in (await q(
        """SELECT coalesce(i.category, i.kind, 'outros'), sum(si.total) FROM crm_sale_items si
           JOIN crm_sales s ON s.id = si.sale_id LEFT JOIN crm_items i ON i.id = si.item_id
           WHERE s.clinic_id=:c AND s.status='paga' AND s.paid_at>=:s AND s.paid_at<:e GROUP BY 1 ORDER BY 2 DESC""")).all()]
    expenses_by_category = [{"category": r[0] or "outros", "total": _r2(r[1])} for r in (await q(
        "SELECT coalesce(category, 'outros'), sum(amount) FROM crm_expenses WHERE clinic_id=:c AND paid_at>=:s AND paid_at<:e GROUP BY 1 ORDER BY 2 DESC")).all()]
    revenue = float((await q("SELECT coalesce(sum(total),0) FROM crm_sales WHERE clinic_id=:c AND status='paga' AND paid_at>=:s AND paid_at<:e")).scalar() or 0)
    expenses = float((await q("SELECT coalesce(sum(amount),0) FROM crm_expenses WHERE clinic_id=:c AND paid_at>=:s AND paid_at<:e")).scalar() or 0)
    receivable = float((await q("SELECT coalesce(sum(total),0) FROM crm_sales WHERE clinic_id=:c AND status='aberta'")).scalar() or 0)
    payable = float((await q("SELECT coalesce(sum(amount),0) FROM crm_expenses WHERE clinic_id=:c AND paid_at IS NULL")).scalar() or 0)
    count = int((await q("SELECT count(*) FROM crm_sales WHERE clinic_id=:c AND status='paga' AND paid_at>=:s AND paid_at<:e")).scalar() or 0)
    return {"month": f"{y:04d}-{m:02d}", "revenue": round(revenue, 2), "expenses": round(expenses, 2),
            "profit": round(revenue - expenses, 2), "sales_count": count,
            "avg_ticket": round(revenue / count, 2) if count else 0, "receivable_open": round(receivable, 2),
            "payable_open": round(payable, 2), "by_day": by_day, "by_method": by_method, "by_category": by_category,
            "expenses_by_category": expenses_by_category}


@router.get("/cashflow")
async def cashflow(days: int = 30, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    """Previsão: a receber (vendas em aberto) × a pagar (despesas não pagas), dia a dia."""
    ctx.require()
    days = max(1, min(days, 120))
    today = _today_brt()
    last = today + timedelta(days=days - 1)
    ins: dict[date, float] = {}
    outs: dict[date, float] = {}
    rec_over = pay_over = no_in = no_out = 0.0
    for due, total in (await db.execute(select(CrmSale.due_date, CrmSale.total).where(
            CrmSale.clinic_id == ctx.clinic_id, CrmSale.status == "aberta"))).all():
        if due is None:
            no_in += float(total or 0)
            continue
        d = _due_day(due)
        if d < today:
            rec_over += float(total or 0)
        elif d <= last:
            ins[d] = ins.get(d, 0.0) + float(total or 0)
    for due, amount in (await db.execute(select(CrmExpense.due_date, CrmExpense.amount).where(
            CrmExpense.clinic_id == ctx.clinic_id, CrmExpense.paid_at.is_(None)))).all():
        if due is None:
            no_out += float(amount or 0)
            continue
        d = _due_day(due)
        if d < today:
            pay_over += float(amount or 0)
        elif d <= last:
            outs[d] = outs.get(d, 0.0) + float(amount or 0)
    out, d = [], today
    while d <= last:
        out.append({"day": d.isoformat(), "in": _r2(ins.get(d)), "out": _r2(outs.get(d))})
        d += timedelta(days=1)
    return {"days": out, "receivable_overdue": _r2(rec_over), "payable_overdue": _r2(pay_over),
            "no_due_in": _r2(no_in), "no_due_out": _r2(no_out)}


# ── Relatórios ────────────────────────────────────────────────────────────────
@router.get("/reports/summary")
async def report_summary(start: datetime, end: datetime, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    start, end = _naive(start), _naive(end)
    if end <= start:
        raise HTTPException(status_code=400, detail="Período inválido.")
    if (end - start).days > 400:
        raise HTTPException(status_code=400, detail="Período máximo de 1 ano.")
    sales = (await db.execute(select(CrmSale).where(
        CrmSale.clinic_id == ctx.clinic_id, CrmSale.status == "paga", CrmSale.paid_at >= start,
        CrmSale.paid_at < end))).scalars().all()
    revenue = sum(float(s.total or 0) for s in sales)
    count = len(sales)
    by_method: dict[str, list] = {}
    for s in sales:
        k = s.payment_method or "—"
        by_method.setdefault(k, [0.0, 0])
        by_method[k][0] += float(s.total or 0)
        by_method[k][1] += 1

    rows = []
    if sales:
        rows = (await db.execute(select(CrmSaleItem, CrmItem).outerjoin(CrmItem, CrmItem.id == CrmSaleItem.item_id)
                                 .where(CrmSaleItem.sale_id.in_([s.id for s in sales])))).all()
    by_item: dict[tuple, list] = {}
    by_cat: dict[str, float] = {}
    by_staff: dict[Optional[int], list] = {}
    for li, it in rows:
        name = it.name if it else li.description
        kind = it.kind if it else "avulso"
        e = by_item.setdefault((name, kind), [0.0, 0.0])
        e[0] += float(li.qty or 0)
        e[1] += float(li.total or 0)
        cat = (it.category or it.kind) if it else "outros"
        by_cat[cat or "outros"] = by_cat.get(cat or "outros", 0.0) + float(li.total or 0)
        st = by_staff.setdefault(li.staff_user_id, [0.0, 0])
        st[0] += float(li.total or 0)
        st[1] += 1
    names = await _user_names(db, by_staff.keys())
    items_sorted = sorted(by_item.items(), key=lambda kv: kv[1][1], reverse=True)

    appts = (await db.execute(select(CrmAppointment.status, func.count(CrmAppointment.id)).where(
        CrmAppointment.clinic_id == ctx.clinic_id, CrmAppointment.starts_at >= start, CrmAppointment.starts_at < end)
        .group_by(CrmAppointment.status))).all()
    st_count = {s: int(n) for s, n in appts}
    done, no_show = st_count.get("concluido", 0), st_count.get("faltou", 0)

    last = await _last_visits(db, ctx.clinic_id, before=end)
    cutoff = end - timedelta(days=90)
    lapsed = sorted(((cid, t) for cid, t in last.items() if t < cutoff), key=lambda x: x[1])
    lapsed_items = []
    if lapsed:
        cm = {c.id: c for c in (await db.execute(select(CrmClient).where(
            CrmClient.id.in_([cid for cid, _ in lapsed[:100]])))).scalars()}
        lapsed_items = [{"client_id": cid, "name": cm[cid].name, "phone": cm[cid].phone, "last_visit": _dt(t)}
                        for cid, t in lapsed[:100] if cid in cm]

    return {
        "revenue": _r2(revenue), "sales_count": count, "avg_ticket": _r2(revenue / count) if count else 0,
        "by_item": [{"name": n, "kind": k, "qty": round(v[0], 3), "total": _r2(v[1])} for (n, k), v in items_sorted[:20]],
        "by_category": [{"category": c, "total": _r2(t)} for c, t in sorted(by_cat.items(), key=lambda kv: kv[1], reverse=True)],
        "by_staff": [{"user_id": uid, "name": names.get(uid, "Profissional removido") if uid else "Sem profissional",
                      "total": _r2(v[0]), "count": v[1]}
                     for uid, v in sorted(by_staff.items(), key=lambda kv: kv[1][0], reverse=True)],
        "by_method": [{"method": k, "total": _r2(v[0]), "count": v[1]}
                      for k, v in sorted(by_method.items(), key=lambda kv: kv[1][0], reverse=True)],
        "top_products": [{"name": n, "qty": round(v[0], 3), "total": _r2(v[1])}
                         for (n, k), v in items_sorted if k == "product"][:10],
        "appointments": {"total": sum(st_count.values()), "done": done, "no_show": no_show,
                         "cancelled": st_count.get("cancelado", 0),
                         "no_show_rate": round(no_show / (done + no_show), 4) if (done + no_show) else 0},
        "lapsed_clients": {"count": len(lapsed), "items": lapsed_items},
    }


class CommissionIn(BaseModel):
    user_id: int
    category: Optional[str] = Field(None, max_length=40)
    pct: float = Field(..., ge=0, le=100)


async def _rate_out(db: AsyncSession, rates: list) -> list:
    names = await _user_names(db, [r.user_id for r in rates])
    return [{"id": r.id, "user_id": r.user_id, "user_name": names.get(r.user_id, ""), "category": r.category,
             "pct": r.pct} for r in rates]


@router.get("/commission-rates")
async def commission_rates(ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    rows = (await db.execute(select(CrmCommissionRate).where(CrmCommissionRate.clinic_id == ctx.clinic_id)
                             .order_by(CrmCommissionRate.user_id, CrmCommissionRate.category))).scalars().all()
    return await _rate_out(db, rows)


@router.put("/commission-rates")
async def set_commission_rate(data: CommissionIn, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    await _check_staff(db, ctx, data.user_id)
    cat = (data.category or "").strip() or None
    stmt = select(CrmCommissionRate).where(CrmCommissionRate.clinic_id == ctx.clinic_id,
                                           CrmCommissionRate.user_id == data.user_id)
    stmt = stmt.where(CrmCommissionRate.category.is_(None) if cat is None else CrmCommissionRate.category == cat)
    r = (await db.execute(stmt)).scalars().first()
    if r:
        r.pct = round(data.pct, 2)
    else:
        r = CrmCommissionRate(clinic_id=ctx.clinic_id, user_id=data.user_id, category=cat, pct=round(data.pct, 2))
        db.add(r)
    await db.commit()
    await db.refresh(r)
    return (await _rate_out(db, [r]))[0]


@router.delete("/commission-rates/{rate_id}")
async def delete_commission_rate(rate_id: int, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    r = await _own(db, CrmCommissionRate, rate_id, ctx)
    await db.delete(r)
    await db.commit()
    return {"ok": True}


@router.get("/reports/commissions")
async def commission_report(start: datetime, end: datetime, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    ctx.require()
    start, end = _naive(start), _naive(end)
    rates: dict[int, dict] = {}
    for r in (await db.execute(select(CrmCommissionRate).where(CrmCommissionRate.clinic_id == ctx.clinic_id))).scalars():
        rates.setdefault(r.user_id, {})[r.category] = r.pct
    rows = (await db.execute(
        select(CrmSaleItem, CrmItem).join(CrmSale, CrmSale.id == CrmSaleItem.sale_id)
        .outerjoin(CrmItem, CrmItem.id == CrmSaleItem.item_id)
        .where(CrmSale.clinic_id == ctx.clinic_id, CrmSale.status == "paga", CrmSale.paid_at >= start,
               CrmSale.paid_at < end, CrmSaleItem.staff_user_id.is_not(None)))).all()
    acc: dict[int, dict] = {}
    for li, it in rows:
        uid = li.staff_user_id
        a = acc.setdefault(uid, {"items_count": 0, "services_total": 0.0, "products_total": 0.0, "commission": 0.0})
        total = float(li.total or 0)
        a["items_count"] += 1
        if it and it.kind == "product":
            a["products_total"] += total
        else:
            a["services_total"] += total
        user_rates = rates.get(uid, {})
        cat = it.category if it else None
        pct = user_rates.get(cat) if cat is not None and cat in user_rates else user_rates.get(None, 0)
        a["commission"] += total * (pct or 0) / 100
    names = await _user_names(db, acc.keys())
    out = [{"user_id": uid, "name": names.get(uid, "Profissional removido"), "items_count": a["items_count"],
            "services_total": _r2(a["services_total"]), "products_total": _r2(a["products_total"]),
            "base_total": _r2(a["services_total"] + a["products_total"]), "commission": _r2(a["commission"])}
           for uid, a in acc.items()]
    return sorted(out, key=lambda x: x["commission"], reverse=True)


# ── Painel do dia e lembretes ─────────────────────────────────────────────────
@router.get("/dashboard")
async def dashboard(ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    today_d = _today_brt()
    day0 = _brt_midnight_utc(today_d)
    day1 = day0 + timedelta(days=1)
    month0 = _month_bounds(today_d.year, today_d.month)[0]
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
    imported = select(CrmPatient.petlife_pet_id).where(CrmPatient.clinic_id == ctx.clinic_id,
                                                       CrmPatient.petlife_pet_id.is_not(None))
    pending_app = await sc(select(func.count(func.distinct(PetClinicAccess.pet_id))).where(
        PetClinicAccess.clinic_id == ctx.clinic_id, PetClinicAccess.revoked_at.is_(None),
        PetClinicAccess.pet_id.not_in(imported)))
    revenue_by_day = await _revenue_by_day(db, ctx.clinic_id, today_d.year, today_d.month) \
        if ctx.role in ("admin", "recepcao") else []
    return {
        "today": await _appt_out(db, today),
        "today_by_status": {st: sum(1 for a in today if a.status == st) for st in APPT_STATUS},
        "revenue_today": round(rev_today, 2), "revenue_month": round(rev_month, 2),
        "new_clients_month": int(new_clients), "total_clients": int(total_clients), "total_patients": int(total_patients),
        "low_stock": [s_item(i) for i in low], "reminders_due": len(await _reminders(ctx, db, 15)),
        "app_patients_pending": int(pending_app), "revenue_by_day": revenue_by_day,
        "in_clinic": sum(1 for a in today if a.status in ("chegou", "em_atendimento", "pronto")),
    }


async def _reminders(ctx: Ctx, db: AsyncSession, days: int) -> list:
    """Próximas doses e retornos. Só o registro mais recente de cada (paciente, vacina) conta:
    a dose seguinte substitui a anterior, mesmo que a anterior esteja fora da janela."""
    now = _now()
    today = _today_brt()
    rows = (await db.execute(
        select(CrmRecord, CrmPatient, CrmClient).join(CrmPatient, CrmPatient.id == CrmRecord.patient_id)
        .join(CrmClient, CrmClient.id == CrmPatient.client_id)
        .where(CrmRecord.clinic_id == ctx.clinic_id, CrmRecord.next_due.is_not(None),
               CrmRecord.voided_at.is_(None), CrmPatient.deceased.is_(False))
    )).all()
    rows.sort(key=lambda x: (x[0].performed_at or x[0].created_at, x[0].id), reverse=True)
    seen, latest = set(), []
    for r, p, c in rows:
        key = (p.id, (r.vaccine_name or r.title or "").strip().lower()) if r.kind == "vacina" else (p.id, "retorno", r.kind)
        if key in seen:
            continue
        seen.add(key)
        latest.append((r, p, c))
    lo, hi = now - timedelta(days=60), now + timedelta(days=days)
    window = [(r, p, c) for r, p, c in latest if lo <= r.next_due <= hi]
    if not window:
        return []
    # retorno já feito: atendimento concluído do paciente depois do registro
    pids = {p.id for r, p, c in window if r.kind != "vacina"}
    done_after: dict[int, datetime] = {}
    if pids:
        for pid, last in (await db.execute(select(CrmAppointment.patient_id, func.max(CrmAppointment.starts_at)).where(
                CrmAppointment.clinic_id == ctx.clinic_id, CrmAppointment.status == "concluido",
                CrmAppointment.patient_id.in_(pids)).group_by(CrmAppointment.patient_id))).all():
            if isinstance(last, str):
                last = datetime.fromisoformat(last)
            if last:
                done_after[pid] = last
    consent = await _consent_set(db, ctx.clinic_id, [p.petlife_pet_id for r, p, c in window])
    out = []
    for r, p, c in window:
        if r.kind != "vacina" and p.id in done_after and done_after[p.id] > r.created_at:
            continue
        days_left = (_due_day(r.next_due) - today).days
        consent_active = bool(p.petlife_pet_id and p.petlife_pet_id in consent)
        out.append({"record_id": r.id, "kind": r.kind, "what": r.vaccine_name or r.title, "next_due": _dt(r.next_due),
                    "overdue": days_left < 0, "days_left": days_left, "patient_id": p.id, "patient_name": p.name,
                    "client_id": c.id, "client_name": c.name, "client_phone": c.phone,
                    "in_app": r.kind == "vacina" and consent_active, "consent_active": consent_active,
                    "reminded_at": _dt(r.reminded_at)})
    return sorted(out, key=lambda x: x["next_due"])


@router.get("/reminders")
async def reminders(days: int = 30, ctx: Ctx = Depends(crm_ctx), db: AsyncSession = Depends(get_db)):
    return await _reminders(ctx, db, max(1, min(days, 120)))
