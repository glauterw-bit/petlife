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
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from media import absolute_media_url

from database import get_db, settings
from auth import get_current_user
from models import User, Pet, WalkSession, WalkKudos, pet_accessible_filter, user_has_pet_access, log_pet_activity, notify_pet_collaborators, Notification
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
        "pet_photo": absolute_media_url(walk.pet.photo) if walk.pet else None,
    }
    if include_route:
        data["route_points"] = walk.route_points or []
    return data


async def _get_pet_owned(pet_id: int, user_id: int, db: AsyncSession) -> Pet:
    """Aceita owner ou co-tutor (multi-tutor sharing)."""
    result = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(user_id)))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    return pet


async def _get_walk_owned(walk_id: int, user_id: int, db: AsyncSession) -> WalkSession:
    """Acesso ao walk: criador OU co-tutor do pet (apenas read).
    Para edit/delete, usar _get_walk_for_edit."""
    result = await db.execute(
        select(WalkSession)
        .options(selectinload(WalkSession.pet))
        .where(WalkSession.id == walk_id)
    )
    walk = result.scalar_one_or_none()
    if not walk:
        raise HTTPException(status_code=404, detail="Passeio não encontrado")
    if walk.user_id == user_id:
        return walk
    if await user_has_pet_access(db, walk.pet_id, user_id):
        return walk
    raise HTTPException(status_code=404, detail="Passeio não encontrado")


async def _get_walk_for_edit(walk_id: int, user_id: int, db: AsyncSession) -> WalkSession:
    """Apenas o criador do walk pode editar/deletar."""
    result = await db.execute(
        select(WalkSession)
        .options(selectinload(WalkSession.pet))
        .where(WalkSession.id == walk_id, WalkSession.user_id == user_id)
    )
    walk = result.scalar_one_or_none()
    if not walk:
        raise HTTPException(status_code=404, detail="Passeio não encontrado ou sem permissão de edição")
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
    walk = await _get_walk_for_edit(walk_id, current_user.id, db)

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

    km = round(walk.distance_meters / 1000, 2)
    actor_first = current_user.name.split()[0]
    pet_name = walk.pet.name if walk.pet else "pet"
    await log_pet_activity(
        db, walk.pet_id, current_user.id,
        action="walk_finished",
        summary=f"{actor_first} finalizou passeio de {km} km",
        meta={"walk_id": walk.id, "km": km, "duration_seconds": walk.duration_seconds},
    )
    await notify_pet_collaborators(
        db, walk.pet_id, current_user.id,
        type="walk_finished",
        title=f"{actor_first} terminou um passeio com {pet_name}",
        body=f"{km} km percorridos",
        link=f"/walks/{walk.id}",
    )

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
    """Lista passeios do usuário ou de pets compartilhados (não inclui route_points pesados)."""
    # Pets aos quais o usuário tem acesso (owner ou share)
    pet_q = await db.execute(select(Pet.id).where(pet_accessible_filter(current_user.id)))
    accessible_pet_ids = [row[0] for row in pet_q.all()]

    q = (
        select(WalkSession)
        .options(selectinload(WalkSession.pet))
        .where(WalkSession.pet_id.in_(accessible_pet_ids) if accessible_pet_ids else False)
        .where(WalkSession.ended_at.is_not(None))
        .order_by(desc(WalkSession.started_at))
        .limit(limit)
        .offset(offset)
    )
    if pet_id is not None:
        q = q.where(WalkSession.pet_id == pet_id)

    result = await db.execute(q)
    walks = result.scalars().all()

    # Conta kudos por walk (1 query)
    walk_ids = [w.id for w in walks]
    kudos_counts: dict[int, int] = {}
    if walk_ids:
        kq = await db.execute(
            select(WalkKudos.walk_id, func.count(WalkKudos.id))
            .where(WalkKudos.walk_id.in_(walk_ids))
            .group_by(WalkKudos.walk_id)
        )
        kudos_counts = {wid: c for wid, c in kq.all()}

    return [
        {
            "id": w.id,
            "pet_id": w.pet_id,
            "pet_name": w.pet.name if w.pet else None,
            "pet_photo": absolute_media_url(w.pet.photo) if w.pet else None,
            "user_id": w.user_id,
            "started_at": w.started_at,
            "ended_at": w.ended_at,
            "duration_seconds": w.duration_seconds,
            "distance_meters": w.distance_meters,
            "avg_pace_seconds_per_km": w.avg_pace_seconds_per_km,
            "photos_count": len(w.photos or []),
            "mood": w.mood,
            "is_shared": w.is_shared,
            "kudos_count": kudos_counts.get(w.id, 0),
        }
        for w in walks
    ]


@router.get("/active", response_model=Optional[WalkSessionResponse])
async def get_active_walk(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna a sessão ativa do próprio usuário (started but not finished), se houver."""
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
    """Resumo agregado: total passeios, distância, duração, esta semana, etc.
    Inclui walks do próprio usuário + walks em pets compartilhados (família/co-tutor).
    """
    # Pets acessíveis (próprios ou compartilhados)
    pet_q = await db.execute(select(Pet.id).where(pet_accessible_filter(current_user.id)))
    accessible_pet_ids = [row[0] for row in pet_q.all()]

    if not accessible_pet_ids:
        return {
            "total_walks": 0,
            "total_distance_meters": 0.0,
            "total_duration_seconds": 0,
            "current_streak_days": 0,
            "avg_distance_meters": 0.0,
            "week_distance_meters": 0.0,
            "week_walks": 0,
        }

    q = (
        select(WalkSession)
        .where(WalkSession.pet_id.in_(accessible_pet_ids))
        .where(WalkSession.ended_at.is_not(None))
    )
    if pet_id is not None:
        q = q.where(WalkSession.pet_id == pet_id)

    result = await db.execute(q)
    walks = result.scalars().all()

    total = len(walks)
    total_distance = sum(w.distance_meters for w in walks)
    total_duration = sum(w.duration_seconds for w in walks)

    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=6)  # janela de 7 dias incluindo hoje
    week_walks_list = [w for w in walks if w.started_at.date() >= week_ago]
    week_distance = sum(w.distance_meters for w in week_walks_list)

    # streak: dias consecutivos com pelo menos 1 passeio terminando em hoje OU ontem.
    dates_set = {w.started_at.date() for w in walks}
    streak = 0
    if today in dates_set:
        cursor = today
    elif (today - timedelta(days=1)) in dates_set:
        cursor = today - timedelta(days=1)
    else:
        cursor = None
    while cursor is not None and cursor in dates_set:
        streak += 1
        cursor -= timedelta(days=1)

    return {
        "total_walks": total,
        "total_distance_meters": round(total_distance, 1),
        "total_duration_seconds": total_duration,
        "current_streak_days": streak,
        "avg_distance_meters": round(total_distance / total, 1) if total else 0,
        "week_distance_meters": round(week_distance, 1),
        "week_walks": len(week_walks_list),
    }


@router.get("/badges")
async def walk_badges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna conquistas de walks do usuário com progresso.
    Cálculo on-the-fly (sem tabela dedicada) baseado em WalkSession agregado.
    """
    pet_q = await db.execute(select(Pet.id).where(pet_accessible_filter(current_user.id)))
    pet_ids = [r[0] for r in pet_q.all()]
    if not pet_ids:
        return {"badges": [], "earned_count": 0}

    walks_q = await db.execute(
        select(WalkSession)
        .where(WalkSession.pet_id.in_(pet_ids))
        .where(WalkSession.ended_at.is_not(None))
    )
    user_walks = walks_q.scalars().all()

    total = len(user_walks)
    total_distance_m = sum(w.distance_meters for w in user_walks)
    total_distance_km = total_distance_m / 1000.0
    total_photos = sum(len(w.photos or []) for w in user_walks)
    total_shared = sum(1 for w in user_walks if w.is_shared)
    has_early_walk = any(w.started_at.hour < 7 for w in user_walks)
    has_night_walk = any(w.started_at.hour >= 22 for w in user_walks)

    # Streak calc reutilizado
    dates_set = {w.started_at.date() for w in user_walks}
    today = datetime.utcnow().date()
    cursor = today if today in dates_set else (today - timedelta(days=1) if (today - timedelta(days=1)) in dates_set else None)
    streak = 0
    while cursor is not None and cursor in dates_set:
        streak += 1
        cursor -= timedelta(days=1)

    def badge(key: str, name: str, emoji: str, description: str, current: float, target: float) -> dict:
        unlocked = current >= target
        return {
            "key": key,
            "name": name,
            "emoji": emoji,
            "description": description,
            "current": round(current, 1) if isinstance(current, float) else current,
            "target": target,
            "unlocked": unlocked,
            "progress": min(1.0, current / target) if target > 0 else 0,
        }

    badges = [
        badge("first_walk", "Primeira caminhada", "🐾", "Finalize seu primeiro passeio", min(total, 1), 1),
        badge("walks_10", "Explorador iniciante", "🚶", "10 caminhadas registradas", min(total, 10), 10),
        badge("walks_50", "Caminhante dedicado", "🏃", "50 caminhadas registradas", min(total, 50), 50),
        badge("walks_100", "Maratonista pet", "🏅", "100 caminhadas registradas", min(total, 100), 100),
        badge("distance_10km", "Primeiros 10 km", "📍", "10 km acumulados", min(total_distance_km, 10), 10),
        badge("distance_50km", "50 km lifetime", "🗺️", "50 km totais percorridos", min(total_distance_km, 50), 50),
        badge("distance_100km", "100 km lifetime", "🌍", "100 km totais percorridos", min(total_distance_km, 100), 100),
        badge("streak_7", "Semana perfeita", "🔥", "7 dias seguidos caminhando", min(streak, 7), 7),
        badge("streak_30", "Hábito de ouro", "💎", "30 dias seguidos caminhando", min(streak, 30), 30),
        badge("photographer", "Fotógrafo de pet", "📸", "10 fotos em caminhadas", min(total_photos, 10), 10),
        badge("social", "Compartilhador", "💬", "Compartilhe um passeio nas redes", min(total_shared, 1), 1),
        badge("early_bird", "Madrugador", "🌅", "Caminhada antes das 7h", 1 if has_early_walk else 0, 1),
        badge("night_owl", "Coruja noturna", "🌙", "Caminhada depois das 22h", 1 if has_night_walk else 0, 1),
    ]
    earned = sum(1 for b in badges if b["unlocked"])
    return {"badges": badges, "earned_count": earned, "total_count": len(badges)}


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
    walk = await _get_walk_for_edit(walk_id, current_user.id, db)
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
    walk = await _get_walk_for_edit(walk_id, current_user.id, db)
    await db.delete(walk)
    await db.commit()


ALLOWED_PHOTO_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
ALLOWED_PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


# ─── Kudos (likes) em walks compartilhados — estilo Strava ───────────────────

@router.post("/{walk_id}/kudos", status_code=status.HTTP_201_CREATED)
async def give_kudos(
    walk_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dar kudos em walk compartilhado. Idempotente (não duplica)."""
    walk = await _get_walk_owned(walk_id, current_user.id, db)
    if not walk.is_shared and walk.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Passeio não está compartilhado")
    # Idempotência
    existing = await db.execute(
        select(WalkKudos).where(WalkKudos.walk_id == walk_id, WalkKudos.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        count_q = await db.execute(select(func.count(WalkKudos.id)).where(WalkKudos.walk_id == walk_id))
        return {"walk_id": walk_id, "kudos_count": count_q.scalar() or 0, "given": True}
    db.add(WalkKudos(walk_id=walk_id, user_id=current_user.id))
    # Notifica o autor do walk (se não for ele mesmo)
    if walk.user_id != current_user.id:
        actor_first = current_user.name.split()[0]
        pet_name = walk.pet.name if walk.pet else "pet"
        db.add(Notification(
            user_id=walk.user_id,
            pet_id=walk.pet_id,
            actor_user_id=current_user.id,
            type="kudos_received",
            title=f"{actor_first} curtiu seu passeio",
            body=f"Passeio com {pet_name}",
            link=f"/walks/{walk_id}",
        ))
    await db.commit()
    count_q = await db.execute(select(func.count(WalkKudos.id)).where(WalkKudos.walk_id == walk_id))
    return {"walk_id": walk_id, "kudos_count": count_q.scalar() or 0, "given": True}


@router.delete("/{walk_id}/kudos", status_code=status.HTTP_200_OK)
async def remove_kudos(
    walk_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove kudos do walk."""
    existing = await db.execute(
        select(WalkKudos).where(WalkKudos.walk_id == walk_id, WalkKudos.user_id == current_user.id)
    )
    k = existing.scalar_one_or_none()
    if k:
        await db.delete(k)
        await db.commit()
    count_q = await db.execute(select(func.count(WalkKudos.id)).where(WalkKudos.walk_id == walk_id))
    return {"walk_id": walk_id, "kudos_count": count_q.scalar() or 0, "given": False}


@router.get("/{walk_id}/kudos")
async def list_kudos(
    walk_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista usuários que deram kudos no walk + flag se eu já dei."""
    await _get_walk_owned(walk_id, current_user.id, db)
    q = await db.execute(
        select(User.id, User.name)
        .join(WalkKudos, WalkKudos.user_id == User.id)
        .where(WalkKudos.walk_id == walk_id)
        .order_by(WalkKudos.created_at.desc())
        .limit(50)
    )
    users = [{"id": uid, "name": name} for uid, name in q.all()]
    given_by_me = any(u["id"] == current_user.id for u in users)
    return {"walk_id": walk_id, "users": users, "kudos_count": len(users), "given_by_me": given_by_me}


@router.post("/{walk_id}/photo", response_model=WalkSessionResponse)
async def add_walk_photo(
    walk_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Adiciona uma foto à galeria do passeio."""
    walk = await _get_walk_for_edit(walk_id, current_user.id, db)

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
