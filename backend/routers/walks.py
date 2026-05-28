"""Walk sessions — cronômetro de passeio estilo Strava.

Fluxo:
  1. POST /walks/start         → cria sessão, retorna walk_id + started_at
  2. POST /walks/{id}/finish   → finaliza com pontos GPS, distância, fotos, etc.
  3. GET /walks                → lista (paginada, leve, sem route_points)
  4. GET /walks/{id}           → detalhe completo
  5. PATCH /walks/{id}         → editar nota/mood, marcar shared
  6. DELETE /walks/{id}        → apagar
  7. POST /walks/{id}/photo    → adicionar foto ao passeio
"""
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db, settings
from auth import get_current_user
from models import User, Pet, WalkSession
from schemas import (
    WalkSessionStart, WalkSessionFinish, WalkSessionResponse,
    WalkSessionListItem, WalkSessionUpdate,
)

router = APIRouter(prefix="/walks", tags=["Passeios"])


def _calc_pace(distance_meters: float, duration_seconds: int) -> Optional[float]:
    if distance_meters <= 0 or duration_seconds <= 0:
        return None
    # segundos por km
    return duration_seconds / (distance_meters / 1000.0)


def _calc_speed_kmh(distance_meters: float, duration_seconds: int) -> Optional[float]:
    if duration_seconds <= 0:
        return None
    return (distance_meters / 1000.0) / (duration_seconds / 3600.0)


def _calc_calories(distance_meters: float, duration_seconds: int, pet_weight_kg: Optional[float]) -> Optional[float]:
    """Estimativa simples baseada em MET ~3.5 (caminhada moderada).
    cal = MET × peso(kg) × tempo(h). Pra pet, peso médio se não tiver.
    """
    if duration_seconds <= 0:
        return None
    weight = pet_weight_kg or 15.0
    hours = duration_seconds / 3600.0
    return round(3.5 * weight * hours, 1)


def _serialize(walk: WalkSession, include_route: bool = True) -> dict:
    data = {
        "id": walk.id,
        "pet_id": walk.pet_id,
        "user_id": walk.user_id,
        "started_at": walk.started_at,
        "ended_at": walk.ended_at,
        "duration_seconds": walk.duration_seconds,
        "distance_meters": walk.distance_meters,
        "photos": walk.photos or [],
        "note": walk.note,
        "mood": walk.mood,
        "weather": walk.weather,
        "avg_pace_seconds_per_km": walk.avg_pace_seconds_per_km,
        "avg_speed_kmh": walk.avg_speed_kmh,
        "calories_estimated": walk.calories_estimated,
        "elevation_gain_m": walk.elevation_gain_m,
        "is_shared": walk.is_shared,
        "shared_at": walk.shared_at,
        "share_image_url": walk.share_image_url,
        "created_at": walk.created_at,
        "pet_name": walk.pet.name if walk.pet else None,
        "pet_photo": walk.pet.photo if walk.pet else None,
    }
    if include_route:
        data["route_points"] = walk.route_points or []
    return data


async def _get_pet_owned(pet_id: int, user_id: int, db: AsyncSession) -> Pet:
    result = await db.execute(select(Pet).where(Pet.id == pet_id, Pet.user_id == user_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    return pet


async def _get_walk_owned(walk_id: int, user_id: int, db: AsyncSession) -> WalkSession:
    result = await db.execute(
        select(WalkSession)
        .options(selectinload(WalkSession.pet))
        .where(WalkSession.id == walk_id, WalkSession.user_id == user_id)
    )
    walk = result.scalar_one_or_none()
    if not walk:
        raise HTTPException(status_code=404, detail="Passeio não encontrado")
    return walk


@router.post("/start", response_model=WalkSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_walk(
    data: WalkSessionStart,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Inicia uma sessão de passeio. Retorna o id pra atualizar com GPS depois."""
    await _get_pet_owned(data.pet_id, current_user.id, db)

    walk = WalkSession(
        pet_id=data.pet_id,
        user_id=current_user.id,
        started_at=datetime.utcnow(),
        duration_seconds=0,
        distance_meters=0.0,
        route_points=[],
        photos=[],
    )
    db.add(walk)
    await db.commit()
    await db.refresh(walk)

    # carrega pet pra serialize
    walk_with_pet = await _get_walk_owned(walk.id, current_user.id, db)
    return _serialize(walk_with_pet)


@router.post("/{walk_id}/finish", response_model=WalkSessionResponse)
async def finish_walk(
    walk_id: int,
    data: WalkSessionFinish,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Finaliza o passeio com pontos GPS, distância, etc."""
    walk = await _get_walk_owned(walk_id, current_user.id, db)

    if walk.ended_at is not None:
        raise HTTPException(status_code=400, detail="Passeio já finalizado")

    walk.ended_at = data.ended_at
    walk.duration_seconds = max(0, data.duration_seconds)
    walk.distance_meters = max(0.0, data.distance_meters)
    walk.route_points = [p.model_dump() for p in data.route_points] if data.route_points else []
    walk.photos = data.photos or []
    walk.note = data.note
    walk.mood = data.mood
    walk.weather = data.weather
    walk.elevation_gain_m = data.elevation_gain_m

    # cálculos derivados
    walk.avg_pace_seconds_per_km = _calc_pace(walk.distance_meters, walk.duration_seconds)
    walk.avg_speed_kmh = _calc_speed_kmh(walk.distance_meters, walk.duration_seconds)
    pet_weight = walk.pet.weight if walk.pet else None
    walk.calories_estimated = _calc_calories(walk.distance_meters, walk.duration_seconds, pet_weight)

    await db.commit()
    await db.refresh(walk)
    return _serialize(walk)


@router.get("", response_model=list[WalkSessionListItem])
async def list_walks(
    pet_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista passeios do usuário (não inclui route_points pesados)."""
    q = (
        select(WalkSession)
        .options(selectinload(WalkSession.pet))
        .where(WalkSession.user_id == current_user.id)
        .where(WalkSession.ended_at.is_not(None))
        .order_by(desc(WalkSession.started_at))
        .limit(limit)
        .offset(offset)
    )
    if pet_id is not None:
        q = q.where(WalkSession.pet_id == pet_id)

    result = await db.execute(q)
    walks = result.scalars().all()

    return [
        {
            "id": w.id,
            "pet_id": w.pet_id,
            "pet_name": w.pet.name if w.pet else None,
            "pet_photo": w.pet.photo if w.pet else None,
            "started_at": w.started_at,
            "ended_at": w.ended_at,
            "duration_seconds": w.duration_seconds,
            "distance_meters": w.distance_meters,
            "avg_pace_seconds_per_km": w.avg_pace_seconds_per_km,
            "photos_count": len(w.photos or []),
            "mood": w.mood,
            "is_shared": w.is_shared,
        }
        for w in walks
    ]


@router.get("/active", response_model=Optional[WalkSessionResponse])
async def get_active_walk(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna a sessão ativa (started but not finished), se houver."""
    result = await db.execute(
        select(WalkSession)
        .options(selectinload(WalkSession.pet))
        .where(WalkSession.user_id == current_user.id)
        .where(WalkSession.ended_at.is_(None))
        .order_by(desc(WalkSession.started_at))
        .limit(1)
    )
    walk = result.scalar_one_or_none()
    if not walk:
        return None
    return _serialize(walk)


@router.get("/stats")
async def get_stats(
    pet_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resumo agregado: total passeios, distância, duração, esta semana, etc."""
    q = (
        select(WalkSession)
        .where(WalkSession.user_id == current_user.id)
        .where(WalkSession.ended_at.is_not(None))
    )
    if pet_id is not None:
        q = q.where(WalkSession.pet_id == pet_id)

    result = await db.execute(q)
    walks = result.scalars().all()

    total = len(walks)
    total_distance = sum(w.distance_meters for w in walks)
    total_duration = sum(w.duration_seconds for w in walks)

    # streak: dias consecutivos com pelo menos 1 passeio
    dates = sorted({w.started_at.date() for w in walks}, reverse=True)
    streak = 0
    today = datetime.utcnow().date()
    cursor = today
    for d in dates:
        if d == cursor:
            streak += 1
            cursor = cursor.replace(day=cursor.day) if False else cursor
            from datetime import timedelta
            cursor = cursor - timedelta(days=1)
        elif d == today and streak == 0:
            streak = 1
            from datetime import timedelta
            cursor = cursor - timedelta(days=1)
        else:
            break

    return {
        "total_walks": total,
        "total_distance_meters": round(total_distance, 1),
        "total_duration_seconds": total_duration,
        "current_streak_days": streak,
        "avg_distance_meters": round(total_distance / total, 1) if total else 0,
    }


@router.get("/{walk_id}", response_model=WalkSessionResponse)
async def get_walk(
    walk_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    walk = await _get_walk_owned(walk_id, current_user.id, db)
    return _serialize(walk)


@router.patch("/{walk_id}", response_model=WalkSessionResponse)
async def update_walk(
    walk_id: int,
    data: WalkSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    walk = await _get_walk_owned(walk_id, current_user.id, db)
    if data.note is not None:
        walk.note = data.note
    if data.mood is not None:
        walk.mood = data.mood
    if data.is_shared is not None:
        walk.is_shared = data.is_shared
        if data.is_shared and walk.shared_at is None:
            walk.shared_at = datetime.utcnow()
    await db.commit()
    await db.refresh(walk)
    return _serialize(walk)


@router.delete("/{walk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_walk(
    walk_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    walk = await _get_walk_owned(walk_id, current_user.id, db)
    await db.delete(walk)
    await db.commit()


ALLOWED_PHOTO_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
ALLOWED_PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


@router.post("/{walk_id}/photo", response_model=WalkSessionResponse)
async def add_walk_photo(
    walk_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Adiciona uma foto à galeria do passeio."""
    walk = await _get_walk_owned(walk_id, current_user.id, db)

    if file.content_type and file.content_type.lower() not in ALLOWED_PHOTO_MIME:
        raise HTTPException(status_code=400, detail="Tipo de imagem não permitido.")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext and ext not in ALLOWED_PHOTO_EXTS:
        raise HTTPException(status_code=400, detail="Extensão não permitida.")
    if not ext:
        ext = ".jpg"

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Imagem muito grande (max 10MB).")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    upload_dir = os.path.join(settings.UPLOAD_DIR, "walks")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    photo_url = f"/uploads/walks/{filename}"
    walk.photos = (walk.photos or []) + [photo_url]
    await db.commit()
    await db.refresh(walk)
    return _serialize(walk)
