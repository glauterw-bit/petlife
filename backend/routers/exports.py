"""Exportação do histórico do pet em PDF — pra levar/mandar pro veterinário.

Gera um PDF limpo com: dados do pet, vacinas, exames, histórico de peso e
anamneses recentes. O tutor compartilha via WhatsApp direto do app (Web Share).
"""
from __future__ import annotations

import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from auth import get_current_user
from models import (
    Pet, User, Vaccine, Exam, Anamnesis, PetWeightHistory, PetStory, PetExpense,
    WalkSession, pet_accessible_filter,
)

router = APIRouter(prefix="/pets", tags=["Exportação"])

# Paleta do PetLife no PDF
EMERALD = (0x05 / 255, 0x96 / 255, 0x69 / 255)
INK = (0x1C / 255, 0x19 / 255, 0x17 / 255)
MUTED = (0x57 / 255, 0x53 / 255, 0x4E / 255)


def _fmt(d) -> str:
    return d.strftime("%d/%m/%Y") if d else "—"


def _build_pdf(pet: Pet, vaccines, exams, weights, anamneses, tutor_name: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import Color
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
        title=f"Histórico de saúde — {pet.name}",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], fontSize=20, textColor=Color(*EMERALD), spaceAfter=2)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9.5, textColor=Color(*MUTED))
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=13, textColor=Color(*INK), spaceBefore=12, spaceAfter=4)
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=9.5, textColor=Color(*INK))

    species = "Cão" if str(pet.species) in ("dog", "SpeciesEnum.dog") or getattr(pet.species, "value", "") == "dog" else "Gato"
    breed = pet.breed.name if pet.breed else "SRD"
    age = ""
    if pet.birth_date:
        days = (datetime.utcnow() - pet.birth_date).days
        age = f" · {days // 365}a {(days % 365) // 30}m"

    el = [
        Paragraph("PetLife — Histórico de Saúde", h1),
        Paragraph(
            f"<b>{pet.name}</b> · {species} · {breed}{age}"
            + (f" · {pet.weight} kg" if pet.weight else "")
            + (f" · microchip {pet.microchip}" if pet.microchip else ""),
            body,
        ),
        Paragraph(
            f"Tutor(a): {tutor_name} · Gerado em {datetime.utcnow().strftime('%d/%m/%Y')} pelo app PetLife",
            sub,
        ),
        Spacer(1, 4),
        HRFlowable(width="100%", thickness=1, color=Color(*EMERALD)),
    ]

    def table(headers, rows, widths):
        t = Table([headers] + rows, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 0), (-1, 0), Color(1, 1, 1)),
            ("BACKGROUND", (0, 0), (-1, 0), Color(*EMERALD)),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [Color(1, 1, 1), Color(0.96, 0.98, 0.97)]),
            ("GRID", (0, 0), (-1, -1), 0.4, Color(0.85, 0.85, 0.85)),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ]))
        return t

    # ── Vacinas ──
    el.append(Paragraph("Vacinas", h2))
    if vaccines:
        rows = [[v.name, _fmt(v.date_given), _fmt(v.next_due), v.veterinarian or "—", v.lot_number or "—"]
                for v in vaccines]
        el.append(table(["Vacina", "Aplicada", "Próx. dose", "Veterinário", "Lote"], rows,
                        [52 * mm, 24 * mm, 24 * mm, 42 * mm, 24 * mm]))
    else:
        el.append(Paragraph("Nenhuma vacina registrada.", sub))

    # ── Exames ──
    el.append(Paragraph("Exames", h2))
    if exams:
        rows = [[e.name, e.type or "—", _fmt(e.date), (e.result or "—")[:110]] for e in exams]
        el.append(table(["Exame", "Tipo", "Data", "Resultado (resumo)"], rows,
                        [40 * mm, 24 * mm, 22 * mm, 80 * mm]))
    else:
        el.append(Paragraph("Nenhum exame registrado.", sub))

    # ── Peso ──
    el.append(Paragraph("Histórico de peso", h2))
    if weights:
        rows = [[_fmt(w.measured_at), f"{w.weight_kg} kg",
                 str(w.body_condition_score) if w.body_condition_score else "—"] for w in weights]
        el.append(table(["Data", "Peso", "ECC (1-9)"], rows, [40 * mm, 30 * mm, 30 * mm]))
    else:
        el.append(Paragraph("Nenhuma medição registrada.", sub))

    # ── Anamneses ──
    el.append(Paragraph("Anamneses recentes", h2))
    if anamneses:
        rows = [[_fmt(a.created_at), (a.symptoms or "—")[:140], a.duration or "—"] for a in anamneses]
        el.append(table(["Data", "Sintomas relatados", "Duração"], rows, [24 * mm, 110 * mm, 32 * mm]))
    else:
        el.append(Paragraph("Nenhuma anamnese registrada.", sub))

    el.append(Spacer(1, 10))
    el.append(Paragraph(
        "Documento informativo gerado pelo tutor no app PetLife. Não substitui prontuário clínico.",
        sub,
    ))

    doc.build(el)
    return buf.getvalue()


@router.get("/{pet_id}/monthly-recap")
async def monthly_recap(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recap do mês do pet — números pro card compartilhável (sem IA, sem quota)."""
    from sqlalchemy import func

    q = await db.execute(
        select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id))
    )
    pet = q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    walks_q = await db.execute(
        select(func.count(WalkSession.id), func.coalesce(func.sum(WalkSession.distance_meters), 0.0),
               func.coalesce(func.sum(WalkSession.duration_seconds), 0))
        .where(WalkSession.pet_id == pet_id, WalkSession.ended_at.is_not(None),
               WalkSession.started_at >= month_start)
    )
    n_walks, dist_m, dur_s = walks_q.one()

    stories_q = await db.execute(
        select(func.count(PetStory.id)).where(PetStory.pet_id == pet_id, PetStory.created_at >= month_start)
    )
    vaccines_q = await db.execute(
        select(func.count(Vaccine.id)).where(Vaccine.pet_id == pet_id, Vaccine.date_given >= month_start)
    )
    expenses_q = await db.execute(
        select(func.coalesce(func.sum(PetExpense.amount), 0.0))
        .where(PetExpense.pet_id == pet_id, PetExpense.spent_at >= month_start)
    )
    # variação de peso no mês (primeira vs última medição do mês)
    w_q = await db.execute(
        select(PetWeightHistory.weight_kg).where(
            PetWeightHistory.pet_id == pet_id, PetWeightHistory.measured_at >= month_start
        ).order_by(PetWeightHistory.measured_at)
    )
    weights = [w for (w,) in w_q.all()]

    from routers.events import track_event
    await track_event(db, current_user.id, "recap_view")
    MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
             "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
    return {
        "pet_id": pet_id,
        "pet_name": pet.name,
        "month_label": f"{MESES[now.month - 1].capitalize()} de {now.year}",
        "walks": int(n_walks or 0),
        "distance_km": round((dist_m or 0) / 1000, 1),
        "active_minutes": int((dur_s or 0) // 60),
        "stories": int(stories_q.scalar() or 0),
        "vaccines": int(vaccines_q.scalar() or 0),
        "expenses_total": round(expenses_q.scalar() or 0, 2),
        "weight_delta_kg": round(weights[-1] - weights[0], 1) if len(weights) >= 2 else None,
    }


@router.get("/{pet_id}/export/pdf")
async def export_pet_pdf(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await db.execute(
        select(Pet).options(selectinload(Pet.breed))
        .where(Pet.id == pet_id, pet_accessible_filter(current_user.id))
    )
    pet = q.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    vac = (await db.execute(select(Vaccine).where(Vaccine.pet_id == pet_id).order_by(Vaccine.date_given.desc()))).scalars().all()
    exa = (await db.execute(select(Exam).where(Exam.pet_id == pet_id).order_by(Exam.date.desc()).limit(20))).scalars().all()
    pes = (await db.execute(select(PetWeightHistory).where(PetWeightHistory.pet_id == pet_id).order_by(PetWeightHistory.measured_at.desc()).limit(15))).scalars().all()
    ana = (await db.execute(select(Anamnesis).where(Anamnesis.pet_id == pet_id).order_by(Anamnesis.created_at.desc()).limit(8))).scalars().all()

    from routers.events import track_event
    await track_event(db, current_user.id, "pdf_export")
    try:
        pdf = _build_pdf(pet, vac, exa, pes, ana, current_user.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {e}")

    filename = f"petlife-{pet.name.lower().replace(' ', '-')}-historico.pdf"
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
