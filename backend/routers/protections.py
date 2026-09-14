"""Proteção em dia — antiparasitários recorrentes (vermífugo e antipulgas).

Vacina é evento anual; antiparasitário vence a cada 30–90 dias. É a única
recorrência legítima da vida de um pet saudável, e por isso é o motor de
retorno do app: cada aplicação registrada arma o próximo aviso.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user
from models import User, Pet, PetProtection, pet_accessible_filter

router = APIRouter(tags=["Proteção"])

# Intervalos default (dias) — o tutor pode ajustar por aplicação.
KINDS: dict[str, int] = {
    "vermifugo": 90,
    "antipulgas": 30,
}

# Quantos dias antes do vencimento o status vira "due_soon"
SOON_DAYS = 7


class ProtectionCreate(BaseModel):
    kind: str
    product: Optional[str] = Field(None, max_length=120)
    applied_at: Optional[datetime] = None       # default: agora
    interval_days: Optional[int] = Field(None, ge=7, le=365)


class ProtectionResponse(BaseModel):
    id: int
    pet_id: int
    kind: str
    product: Optional[str]
    applied_at: datetime
    interval_days: int
    next_due: datetime

    class Config:
        from_attributes = True


async def _verify_pet(pet_id: int, user_id: int, db: AsyncSession) -> Pet:
    res = await db.execute(
        select(Pet).where(Pet.id == pet_id, pet_accessible_filter(user_id))
    )
    pet = res.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    return pet


def _status_for(next_due: Optional[datetime], now: datetime) -> str:
    if next_due is None:
        return "never"
    if next_due < now:
        return "overdue"
    if next_due <= now + timedelta(days=SOON_DAYS):
        return "due_soon"
    return "ok"


@router.post("/pets/{pet_id}/protections", response_model=ProtectionResponse,
             status_code=status.HTTP_201_CREATED)
async def register_protection(
    pet_id: int,
    data: ProtectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.kind not in KINDS:
        raise HTTPException(status_code=400, detail="Tipo desconhecido")
    await _verify_pet(pet_id, current_user.id, db)

    applied = data.applied_at or datetime.utcnow()
    interval = data.interval_days or KINDS[data.kind]
    prot = PetProtection(
        pet_id=pet_id,
        kind=data.kind,
        product=(data.product or "").strip() or None,
        applied_at=applied,
        interval_days=interval,
        next_due=applied + timedelta(days=interval),
    )
    db.add(prot)
    await db.flush()
    await db.refresh(prot)
    return prot


@router.get("/pets/{pet_id}/protections", response_model=list[ProtectionResponse])
async def list_protections(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_pet(pet_id, current_user.id, db)
    res = await db.execute(
        select(PetProtection)
        .where(PetProtection.pet_id == pet_id)
        .order_by(PetProtection.applied_at.desc())
        .limit(50)
    )
    return list(res.scalars().all())


@router.delete("/protections/{protection_id}", status_code=204)
async def delete_protection(
    protection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(PetProtection).where(PetProtection.id == protection_id))
    prot = res.scalar_one_or_none()
    if not prot:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    await _verify_pet(prot.pet_id, current_user.id, db)
    await db.delete(prot)


@router.get("/protections/summary")
async def protections_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Status por pet × tipo — alimenta o card "Proteção em dia" da home."""
    now = datetime.utcnow()
    pets_res = await db.execute(
        select(Pet.id, Pet.name, Pet.species).where(pet_accessible_filter(current_user.id))
    )
    pets = pets_res.all()
    if not pets:
        return {"pets": []}

    pet_ids = [p.id for p in pets]
    # última aplicação de cada pet × tipo, numa query só
    prot_res = await db.execute(
        select(PetProtection)
        .where(PetProtection.pet_id.in_(pet_ids))
        .order_by(PetProtection.applied_at.desc())
    )
    latest: dict[tuple[int, str], PetProtection] = {}
    for pr in prot_res.scalars().all():
        latest.setdefault((pr.pet_id, pr.kind), pr)

    out = []
    for p in pets:
        kinds = []
        for kind in KINDS:
            pr = latest.get((p.id, kind))
            st = _status_for(pr.next_due if pr else None, now)
            kinds.append({
                "kind": kind,
                "status": st,
                "next_due": pr.next_due.isoformat() if pr else None,
                "days_left": (pr.next_due - now).days if pr else None,
                "product": pr.product if pr else None,
                "interval_days": pr.interval_days if pr else KINDS[kind],
            })
        out.append({
            "pet_id": p.id,
            "pet_name": p.name,
            "species": getattr(p.species, "value", str(p.species)),
            "kinds": kinds,
        })
    return {"pets": out}
