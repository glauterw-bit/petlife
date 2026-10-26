from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from database import get_db
from models import Reminder, Pet, user_has_pet_access
from schemas import ReminderCreate, ReminderUpdate, ReminderResponse
from auth import get_current_user
from models import User

router = APIRouter(prefix="/reminders", tags=["Lembretes"])


async def _get_reminder_verified(reminder_id: int, user_id: int, db: AsyncSession) -> Reminder:
    result = await db.execute(select(Reminder).where(Reminder.id == reminder_id))
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Lembrete não encontrado")
    if reminder.user_id != user_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return reminder


@router.post("", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.pet_id:
        result = await db.execute(select(Pet).where(Pet.id == data.pet_id))
        pet = result.scalar_one_or_none()
        if not pet:
            raise HTTPException(status_code=404, detail="Pet não encontrado")
        if not await user_has_pet_access(db, pet.id, current_user.id):
            raise HTTPException(status_code=403, detail="Acesso negado")

    reminder = Reminder(
        user_id=current_user.id,
        pet_id=data.pet_id,
        type=data.type,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        is_completed=False,
        repeat_days=data.repeat_days,
        repeat_until=data.repeat_until,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.get("", response_model=list[ReminderResponse])
async def list_reminders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Reminder)
        .where(Reminder.user_id == current_user.id)
        .order_by(Reminder.due_date)
    )
    return result.scalars().all()


@router.get("/upcoming", response_model=list[ReminderResponse])
async def get_upcoming_reminders(
    days_ahead: int = 7,
    include_overdue: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Próximos lembretes não concluídos. Com include_overdue=true, inclui
    também os vencidos (due_date < agora) — o Início não pode esconder o que
    já passou da data."""
    now = datetime.utcnow()
    future = now + timedelta(days=days_ahead)
    window = Reminder.due_date <= future if include_overdue else and_(Reminder.due_date >= now, Reminder.due_date <= future)
    result = await db.execute(
        select(Reminder).where(
            and_(
                Reminder.user_id == current_user.id,
                Reminder.is_completed == False,
                window,
            )
        ).order_by(Reminder.due_date)
    )
    return result.scalars().all()


@router.get("/{reminder_id}", response_model=ReminderResponse)
async def get_reminder(
    reminder_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_reminder_verified(reminder_id, current_user.id, db)


@router.put("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: int,
    data: ReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reminder = await _get_reminder_verified(reminder_id, current_user.id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(reminder, field, value)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reminder = await _get_reminder_verified(reminder_id, current_user.id, db)
    await db.delete(reminder)
    await db.commit()


@router.patch("/{reminder_id}/complete", response_model=ReminderResponse)
async def complete_reminder(
    reminder_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Conclui o lembrete. Idempotente: concluir de novo não faz nada.
    Com repetição, cria a próxima ocorrência (due_date + repeat_days) na mesma
    transação, desde que não passe de repeat_until."""
    reminder = await _get_reminder_verified(reminder_id, current_user.id, db)
    if reminder.is_completed:
        return reminder
    reminder.is_completed = True
    if reminder.repeat_days:
        next_due = reminder.due_date + timedelta(days=reminder.repeat_days)
        if reminder.repeat_until is None or next_due <= reminder.repeat_until:
            db.add(Reminder(
                user_id=reminder.user_id,
                pet_id=reminder.pet_id,
                type=reminder.type,
                title=reminder.title,
                description=reminder.description,
                due_date=next_due,
                is_completed=False,
                repeat_days=reminder.repeat_days,
                repeat_until=reminder.repeat_until,
            ))
    await db.commit()
    await db.refresh(reminder)
    return reminder
