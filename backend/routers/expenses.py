"""Gastos do pet — registro simples + resumo mensal por categoria."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user
from models import Pet, User, PetExpense, pet_accessible_filter, user_has_pet_access

router = APIRouter(prefix="/pets", tags=["Gastos"])

Category = Literal["alimentacao", "saude", "higiene", "acessorios", "servicos", "outros"]

CATEGORY_LABEL = {
    "alimentacao": "Alimentação", "saude": "Saúde", "higiene": "Higiene",
    "acessorios": "Acessórios", "servicos": "Serviços", "outros": "Outros",
}


class ExpenseCreate(BaseModel):
    category: Category
    amount: float = Field(gt=0, le=100_000)
    description: Optional[str] = None
    spent_at: Optional[datetime] = None


async def _require_access(db: AsyncSession, pet_id: int, user_id: int) -> None:
    if not await user_has_pet_access(db, pet_id, user_id):
        raise HTTPException(status_code=404, detail="Pet não encontrado")


@router.post("/{pet_id}/expenses", status_code=status.HTTP_201_CREATED)
async def add_expense(
    pet_id: int,
    body: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_access(db, pet_id, current_user.id)
    exp = PetExpense(
        pet_id=pet_id, user_id=current_user.id, category=body.category,
        amount=round(body.amount, 2), description=(body.description or "").strip() or None,
        spent_at=body.spent_at or datetime.utcnow(),
    )
    db.add(exp)
    await db.commit()
    return {"id": exp.id, "ok": True}


@router.get("/{pet_id}/expenses")
async def list_expenses(
    pet_id: int,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_access(db, pet_id, current_user.id)
    q = await db.execute(
        select(PetExpense).where(PetExpense.pet_id == pet_id)
        .order_by(PetExpense.spent_at.desc()).limit(min(limit, 100))
    )
    return [
        {
            "id": e.id, "category": e.category, "category_label": CATEGORY_LABEL.get(e.category, e.category),
            "amount": e.amount, "description": e.description,
            "spent_at": e.spent_at.isoformat(),
        }
        for e in q.scalars().all()
    ]


@router.delete("/{pet_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    pet_id: int,
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_access(db, pet_id, current_user.id)
    q = await db.execute(
        select(PetExpense).where(PetExpense.id == expense_id, PetExpense.pet_id == pet_id)
    )
    exp = q.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Gasto não encontrado")
    await db.delete(exp)
    await db.commit()


@router.get("/{pet_id}/expenses/summary")
async def expenses_summary(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resumo: total do mês atual, por categoria, e últimos 6 meses (pro gráfico)."""
    await _require_access(db, pet_id, current_user.id)
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    # total + por categoria no mês
    q = await db.execute(
        select(PetExpense.category, func.sum(PetExpense.amount))
        .where(PetExpense.pet_id == pet_id, PetExpense.spent_at >= month_start)
        .group_by(PetExpense.category)
    )
    by_category = [
        {"category": c, "label": CATEGORY_LABEL.get(c, c), "total": round(t or 0, 2)}
        for c, t in q.all()
    ]
    month_total = round(sum(x["total"] for x in by_category), 2)

    # últimos 6 meses
    months = []
    for i in range(5, -1, -1):
        y, m = now.year, now.month - i
        while m <= 0:
            y, m = y - 1, m + 12
        start = datetime(y, m, 1)
        end = datetime(y + (1 if m == 12 else 0), 1 if m == 12 else m + 1, 1)
        tq = await db.execute(
            select(func.sum(PetExpense.amount))
            .where(PetExpense.pet_id == pet_id, PetExpense.spent_at >= start, PetExpense.spent_at < end)
        )
        months.append({"month": f"{y:04d}-{m:02d}", "total": round(tq.scalar() or 0, 2)})

    return {"month_total": month_total, "by_category": by_category, "months": months}
