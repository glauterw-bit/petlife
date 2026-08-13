"""Growth: programa de indicação (recompensa dupla) + perfil público do pet.

Indicação: cada usuário tem um código (ex.: PET-A3F9K2). Quem se cadastra com um
código ganha 30 dias de PetLife+ — e quem indicou também. Bônus nunca rebaixa
tier pago ativo: para assinante ativo, apenas estende a expiração.

Perfil público: tutor ativa e ganha /p/<slug> — página bonita e segura (só nome,
espécie, raça, idade, foto, bio e stats agregadas; nunca dados do tutor).
"""
import re
import secrets
import string
import unicodedata
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import Pet, User, WalkSession, Vaccine, user_has_pet_access
from auth import get_current_user

router = APIRouter(tags=["Growth"])

BONUS_DAYS = 30
BONUS_TIER = "plus"


# ─── Indicação ───────────────────────────────────────────────────────────────

def _gen_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "PET-" + "".join(secrets.choice(alphabet) for _ in range(6))


async def ensure_referral_code(db: AsyncSession, user: User) -> str:
    """Garante que o usuário tem um código de indicação (lazy)."""
    if user.referral_code:
        return user.referral_code
    for _ in range(5):
        code = _gen_code()
        exists = await db.execute(select(User.id).where(User.referral_code == code))
        if not exists.scalar_one_or_none():
            user.referral_code = code
            await db.commit()
            return code
    raise HTTPException(status_code=500, detail="Não foi possível gerar o código")


def grant_bonus(user: User) -> None:
    """+30 dias de PetLife+. Assinante ativo só ganha extensão (nunca rebaixa)."""
    now = datetime.utcnow()
    active = user.premium_expires_at and user.premium_expires_at > now
    if active:
        user.premium_expires_at = user.premium_expires_at + timedelta(days=BONUS_DAYS)
    else:
        user.premium_tier = BONUS_TIER
        user.premium_expires_at = now + timedelta(days=BONUS_DAYS)
        user.active_product_sku = "referral_bonus"


@router.get("/referrals/me")
async def my_referral(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    code = await ensure_referral_code(db, current_user)
    count_q = await db.execute(
        select(func.count(User.id)).where(User.referred_by_id == current_user.id)
    )
    return {
        "code": code,
        "referred_count": count_q.scalar() or 0,
        "bonus_days": BONUS_DAYS,
        "bonus_tier": BONUS_TIER,
    }


async def redeem_referral(db: AsyncSession, new_user: User, code: str) -> bool:
    """Aplica o código no cadastro. Chamado pelo register. Silencioso se inválido."""
    code = (code or "").strip().upper()
    if not code:
        return False
    ref_q = await db.execute(select(User).where(User.referral_code == code))
    referrer = ref_q.scalar_one_or_none()
    if not referrer or referrer.id == new_user.id:
        return False
    new_user.referred_by_id = referrer.id
    grant_bonus(new_user)
    grant_bonus(referrer)
    return True


# ─── Perfil público do pet ───────────────────────────────────────────────────

def _slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:60] or "pet"


class PublicToggle(BaseModel):
    is_public: bool


@router.post("/pets/{pet_id}/public-profile")
async def toggle_public_profile(
    pet_id: int,
    payload: PublicToggle,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    if not await user_has_pet_access(db, pet.id, current_user.id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    pet.is_public = payload.is_public
    if payload.is_public and not pet.public_slug:
        base = _slugify(pet.name)
        slug = base
        for i in range(2, 50):
            exists = await db.execute(select(Pet.id).where(Pet.public_slug == slug))
            if not exists.scalar_one_or_none():
                break
            slug = f"{base}-{i}"
        pet.public_slug = slug
    await db.commit()
    return {"is_public": pet.is_public, "public_slug": pet.public_slug}


@router.get("/public/pet-profile/{slug}")
async def public_pet_profile(slug: str, db: AsyncSession = Depends(get_db)):
    """Dados públicos e seguros do pet — sem autenticação, sem dados do tutor."""
    result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.breed))
        .where(Pet.public_slug == slug, Pet.is_public == True)  # noqa: E712
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    walks_q = await db.execute(
        select(func.count(WalkSession.id), func.coalesce(func.sum(WalkSession.distance_meters), 0))
        .where(WalkSession.pet_id == pet.id, WalkSession.ended_at.isnot(None))
    )
    walks_count, walks_m = walks_q.one()

    now = datetime.utcnow()
    vac_total_q = await db.execute(
        select(func.count(Vaccine.id)).where(Vaccine.pet_id == pet.id)
    )
    vac_overdue_q = await db.execute(
        select(func.count(Vaccine.id)).where(
            Vaccine.pet_id == pet.id, Vaccine.next_due.isnot(None), Vaccine.next_due < now
        )
    )
    vaccines_total = vac_total_q.scalar() or 0
    vaccines_ok = (vac_overdue_q.scalar() or 0) == 0

    return {
        "name": pet.name,
        "species": pet.species.value if hasattr(pet.species, "value") else str(pet.species),
        "breed": pet.breed.name if pet.breed else None,
        "birth_date": pet.birth_date.isoformat() if pet.birth_date else None,
        "photo": pet.photo,
        "bio": pet.bio,
        "gender": pet.gender.value if pet.gender else None,
        "is_deceased": pet.is_deceased,
        "stats": {
            "walks_count": int(walks_count or 0),
            "walks_km": round(float(walks_m or 0) / 1000, 1),
            "vaccines_total": vaccines_total,
            "vaccines_ok": vaccines_ok,
            "member_since": pet.created_at.isoformat() if pet.created_at else None,
        },
    }
