"""Cio da fêmea — registro dos ciclos + previsão do próximo."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user
from models import Pet, User, PetHeatCycle, GenderEnum, pet_accessible_filter, user_has_pet_access

router = APIRouter(prefix="/pets", tags=["Cio"])
# Fora de /pets: "/pets/heat-cycles/..." cairia nas rotas /pets/{pet_id}/... (422).
upcoming_router = APIRouter(prefix="/heat-cycles", tags=["Cio"])

# Referência quando o pet ainda não tem histórico próprio.
# Cadela: cio a cada ~6 meses (varia de 4 a 12), com ~2–3 semanas de duração.
# Gata: cio de ~1 semana que volta a cada ~2–3 semanas na estação reprodutiva.
SPECIES_DEFAULTS = {"dog": {"interval": 180, "duration": 21}, "cat": {"interval": 21, "duration": 7}}
# Intervalos fora da faixa são pausa (gestação, fim de estação) ou erro de
# digitação — não entram na média para não distorcer a previsão.
INTERVAL_BOUNDS = {"dog": (90, 400), "cat": (7, 120)}
DURATION_BOUNDS = (1, 60)
# Aviso do próximo cio: dias de antecedência. Cadela precisa de mais tempo pra
# planejar; o ciclo da gata é curto.
NOTIFY_LEAD_DAYS = {"dog": 7, "cat": 2}


class HeatCycleCreate(BaseModel):
    started_at: datetime
    ended_at: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class HeatCycleUpdate(BaseModel):
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None  # enviar null reabre o ciclo
    notes: Optional[str] = Field(default=None, max_length=500)


def _naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """O banco guarda DateTime sem fuso (padrão do projeto)."""
    if dt is None or dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _species(pet: Pet) -> str:
    s = getattr(pet.species, "value", pet.species)
    return s if s in SPECIES_DEFAULTS else "dog"


def _validate_dates(started: datetime, ended: Optional[datetime]) -> None:
    if started > datetime.utcnow() + timedelta(days=1):
        raise HTTPException(status_code=400, detail="A data de início não pode ser no futuro")
    if ended is not None:
        if ended < started:
            raise HTTPException(status_code=400, detail="O fim do cio precisa ser depois do início")
        if ended > datetime.utcnow() + timedelta(days=1):
            raise HTTPException(status_code=400, detail="A data de fim não pode ser no futuro")


async def _get_pet(db: AsyncSession, pet_id: int, user_id: int) -> Pet:
    if not await user_has_pet_access(db, pet_id, user_id):
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    return (await db.execute(select(Pet).where(Pet.id == pet_id))).scalar_one()


async def _get_cycle(db: AsyncSession, pet_id: int, cycle_id: int) -> PetHeatCycle:
    cycle = (await db.execute(
        select(PetHeatCycle).where(PetHeatCycle.id == cycle_id, PetHeatCycle.pet_id == pet_id)
    )).scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Registro de cio não encontrado")
    return cycle


def _duration_days(c: PetHeatCycle) -> Optional[int]:
    if c.ended_at is None:
        return None
    return (c.ended_at.date() - c.started_at.date()).days + 1


def _overview(pet: Pet, cycles: list[PetHeatCycle]) -> dict:
    species = _species(pet)
    ref = SPECIES_DEFAULTS[species]
    today = datetime.utcnow().date()
    asc = sorted(cycles, key=lambda c: c.started_at)

    lo, hi = INTERVAL_BOUNDS[species]
    intervals = [
        (b.started_at.date() - a.started_at.date()).days
        for a, b in zip(asc, asc[1:])
    ]
    intervals = [d for d in intervals if lo <= d <= hi][-4:]  # ciclos recentes pesam mais
    durations = [d for d in (_duration_days(c) for c in asc) if d and DURATION_BOUNDS[0] <= d <= DURATION_BOUNDS[1]][-4:]

    interval = round(mean(intervals)) if intervals else ref["interval"]
    duration = round(mean(durations)) if durations else ref["duration"]

    open_cycles = [c for c in asc if c.ended_at is None]
    current = None
    if open_cycles:
        c = open_cycles[-1]
        day = (today - c.started_at.date()).days + 1
        current = {
            "id": c.id,
            "started_at": c.started_at.isoformat(),
            "day": day,
            "expected_end": (c.started_at + timedelta(days=duration - 1)).isoformat(),
            # Aberto há muito mais que o normal: provavelmente esqueceram de marcar o fim.
            "overdue": day > duration * 2,
        }

    prediction = None
    if asc:
        next_start = asc[-1].started_at + timedelta(days=interval)
        prediction = {
            "next_start": next_start.isoformat(),
            "days_until": (next_start.date() - today).days,
            "interval_days": interval,
            "duration_days": duration,
            "based_on": "history" if intervals else "species",
            "cycles_used": len(intervals) + 1 if intervals else len(asc),
        }

    gender = getattr(pet.gender, "value", pet.gender)
    return {
        "species": species,
        "applicable": gender != "male",
        "neutered": bool(pet.neutered),
        "notify_lead_days": NOTIFY_LEAD_DAYS[species],
        "current": current,
        "prediction": prediction,
        "cycles": [
            {
                "id": c.id,
                "started_at": c.started_at.isoformat(),
                "ended_at": c.ended_at.isoformat() if c.ended_at else None,
                "duration_days": _duration_days(c),
                "notes": c.notes,
            }
            for c in reversed(asc)
        ],
    }


async def _load_cycles(db: AsyncSession, pet_id: int) -> list[PetHeatCycle]:
    q = await db.execute(select(PetHeatCycle).where(PetHeatCycle.pet_id == pet_id))
    return list(q.scalars().all())


@router.get("/{pet_id}/heat-cycles")
async def list_heat_cycles(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet = await _get_pet(db, pet_id, current_user.id)
    return _overview(pet, await _load_cycles(db, pet_id))


@router.post("/{pet_id}/heat-cycles", status_code=status.HTTP_201_CREATED)
async def add_heat_cycle(
    pet_id: int,
    body: HeatCycleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet = await _get_pet(db, pet_id, current_user.id)
    if getattr(pet.gender, "value", pet.gender) == "male":
        raise HTTPException(
            status_code=400,
            detail="O cio só é registrado para fêmeas. Se o sexo estiver errado, corrija no perfil do pet.",
        )
    started, ended = _naive_utc(body.started_at), _naive_utc(body.ended_at)
    _validate_dates(started, ended)

    cycles = await _load_cycles(db, pet_id)
    if ended is None and any(c.ended_at is None for c in cycles):
        raise HTTPException(status_code=409, detail="Já existe um cio em andamento. Marque o fim dele antes de registrar outro.")
    if any(c.started_at.date() == started.date() for c in cycles):
        raise HTTPException(status_code=409, detail="Já existe um cio registrado com essa data de início.")

    db.add(PetHeatCycle(
        pet_id=pet_id, user_id=current_user.id, started_at=started, ended_at=ended,
        notes=(body.notes or "").strip() or None,
    ))
    await db.commit()
    return _overview(pet, await _load_cycles(db, pet_id))


@router.put("/{pet_id}/heat-cycles/{cycle_id}")
async def update_heat_cycle(
    pet_id: int,
    cycle_id: int,
    body: HeatCycleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet = await _get_pet(db, pet_id, current_user.id)
    cycle = await _get_cycle(db, pet_id, cycle_id)
    fields = body.model_dump(exclude_unset=True)

    started = _naive_utc(fields["started_at"]) if fields.get("started_at") else cycle.started_at
    ended = _naive_utc(fields["ended_at"]) if "ended_at" in fields else cycle.ended_at
    _validate_dates(started, ended)
    if ended is None and cycle.ended_at is not None:
        others_open = any(c.ended_at is None and c.id != cycle.id for c in await _load_cycles(db, pet_id))
        if others_open:
            raise HTTPException(status_code=409, detail="Já existe outro cio em andamento.")

    cycle.started_at, cycle.ended_at = started, ended
    if "notes" in fields:
        cycle.notes = (fields["notes"] or "").strip() or None
    await db.commit()
    return _overview(pet, await _load_cycles(db, pet_id))


@router.delete("/{pet_id}/heat-cycles/{cycle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_heat_cycle(
    pet_id: int,
    cycle_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_pet(db, pet_id, current_user.id)
    cycle = await _get_cycle(db, pet_id, cycle_id)
    await db.delete(cycle)
    await db.commit()


async def heat_predictions(db: AsyncSession, *where) -> list[dict]:
    """Próximo cio previsto de cada fêmea não castrada que tem histórico.

    Fica de fora quem está em cio agora (a previsão é do ciclo seguinte, longe
    demais pra avisar) e pet em modo memorial. Usado pelo app (notificação
    local) e pelo /push/run.
    """
    pets = (await db.execute(
        select(Pet).where(
            Pet.gender == GenderEnum.female,
            Pet.neutered.is_not(True),
            Pet.is_deceased.is_(False),
            Pet.id.in_(select(PetHeatCycle.pet_id)),
            *where,
        )
    )).scalars().all()
    if not pets:
        return []
    by_pet = defaultdict(list)
    rows = await db.execute(select(PetHeatCycle).where(PetHeatCycle.pet_id.in_([p.id for p in pets])))
    for c in rows.scalars().all():
        by_pet[c.pet_id].append(c)

    out = []
    for p in pets:
        ov = _overview(p, by_pet[p.id])
        pred = ov["prediction"]
        if not pred or ov["current"]:
            continue
        out.append({
            "pet": p,
            "species": ov["species"],
            "next_start": pred["next_start"],
            "days_until": pred["days_until"],
            "lead_days": ov["notify_lead_days"],
        })
    return out


@upcoming_router.get("/upcoming")
async def upcoming_heats(
    days: int = 200,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cios previstos nos próximos `days` dias, dos pets que o usuário acessa."""
    horizon = max(0, min(days, 400))
    items = await heat_predictions(db, pet_accessible_filter(current_user.id))
    return [
        {
            "pet_id": i["pet"].id,
            "pet_name": i["pet"].name,
            "species": i["species"],
            "next_start": i["next_start"],
            "days_until": i["days_until"],
            "lead_days": i["lead_days"],
        }
        for i in items
        if 0 <= i["days_until"] <= horizon
    ]
