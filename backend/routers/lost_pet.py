"""Lost-pet: marca pet como perdido + página pública verificável por QR-tag.
QR-tag física na coleira aponta para /public/lost/<pet_id>.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db, AsyncSessionLocal
from models import Pet, User, user_has_pet_access
from auth import get_current_user

router = APIRouter(prefix="/pets", tags=["Lost Pet"])


class LostPetUpdate(BaseModel):
    is_lost: bool
    last_seen: Optional[str] = None
    reward: Optional[str] = None


@router.post("/{pet_id}/lost")
async def toggle_lost(
    pet_id: int,
    payload: LostPetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    if not await user_has_pet_access(db, pet.id, current_user.id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    pet.is_lost = payload.is_lost
    pet.lost_at = datetime.utcnow() if payload.is_lost else None
    pet.lost_last_seen = payload.last_seen if payload.is_lost else None
    pet.lost_reward = payload.reward if payload.is_lost else None
    await db.commit()
    return {
        "pet_id": pet.id,
        "is_lost": pet.is_lost,
        "lost_at": pet.lost_at.isoformat() if pet.lost_at else None,
        "last_seen": pet.lost_last_seen,
        "reward": pet.lost_reward,
    }


# Endpoint público (sem auth) — chamado quando alguém escaneia o QR-tag
async def public_lost_pet(pet_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Pet).options(selectinload(Pet.breed), selectinload(Pet.owner)).where(Pet.id == pet_id)
        )
        pet = result.scalar_one_or_none()
        if not pet:
            raise HTTPException(status_code=404, detail="Pet não cadastrado")

        return {
            "pet": {
                "id": pet.id,
                "name": pet.name,
                "species": pet.species.value if hasattr(pet.species, "value") else pet.species,
                "breed": pet.breed.name if pet.breed else None,
                "color": pet.color,
                "photo": pet.photo,
                "microchip": pet.microchip,
            },
            "is_lost": pet.is_lost,
            "lost_at": pet.lost_at.isoformat() if pet.lost_at else None,
            "last_seen": pet.lost_last_seen,
            "reward": pet.lost_reward,
            "owner_contact": {
                "name": pet.owner.name,
                # Não expõe email completo; só telefone se opt-in
                "phone": pet.owner.phone,
            } if pet.is_lost else None,
        }


# ── "Encontrei este pet" — quem escaneia o QR avisa o tutor sem ver o telefone ──
class FoundReport(BaseModel):
    message: str = Field(..., min_length=3, max_length=500)
    contact: Optional[str] = Field(None, max_length=120)


async def public_found_report(pet_id: int, data: FoundReport) -> dict:
    """Push + e-mail pro tutor. Funciona mesmo se o pet NÃO foi marcado como
    perdido — o normal é alguém achar o pet antes do tutor abrir o app."""
    import asyncio
    from html import escape
    from email_service import send_email

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Pet).options(selectinload(Pet.owner)).where(Pet.id == pet_id))
        pet = res.scalar_one_or_none()
        if not pet or not pet.owner:
            raise HTTPException(status_code=404, detail="Pet não cadastrado")
        owner = pet.owner
        msg = data.message.strip()
        contato = (data.contact or "").strip()

        html = (
            f"<p>Oi, {escape((owner.name or '').split(' ')[0] or 'tutor(a)')}!</p>"
            f"<p>Alguém leu o QR do <b>{escape(pet.name)}</b> e mandou esta mensagem pelo PetLife:</p>"
            f"<blockquote style='border-left:3px solid #ef4444;padding-left:12px'>{escape(msg)}</blockquote>"
            + (f"<p><b>Contato deixado:</b> {escape(contato)}</p>" if contato else "")
            + "<p>Se o seu pet não está com você, responda a essa pessoa o quanto antes. 🐾</p>"
        )
        asyncio.ensure_future(send_email(owner.email, f"🐾 Alguém encontrou o {pet.name}?", html))

        try:
            import push_service
            if push_service.configured():
                from routers.push import _deliver
                await _deliver(
                    db, owner.id, f"found:{pet.id}:{int(datetime.utcnow().timestamp())}", "pet_encontrado",
                    f"🐾 Alguém leu o QR do {pet.name}",
                    (msg + (f" — contato: {contato}" if contato else ""))[:150],
                )
                await db.commit()
        except Exception:
            pass
    return {"ok": True}
