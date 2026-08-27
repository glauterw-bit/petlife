import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db, settings
from models import Pet, Exam, user_has_pet_access, pet_accessible_filter
from schemas import ExamCreate, ExamUpdate, ExamResponse
from auth import get_current_user
from models import User

router = APIRouter(prefix="/exams", tags=["Exames"])


async def _verify_pet_ownership(pet_id: int, user_id: int, db: AsyncSession) -> Pet:
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")
    if not await user_has_pet_access(db, pet_id, user_id):
        raise HTTPException(status_code=403, detail="Acesso negado")
    return pet


async def _get_exam_verified(exam_id: int, user_id: int, db: AsyncSession) -> Exam:
    result = await db.execute(
        select(Exam).options(selectinload(Exam.pet)).where(Exam.id == exam_id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    if not await user_has_pet_access(db, exam.pet_id, user_id):
        raise HTTPException(status_code=403, detail="Acesso negado")
    return exam


@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
async def create_exam(
    data: ExamCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_pet_ownership(data.pet_id, current_user.id, db)
    exam = Exam(
        pet_id=data.pet_id,
        name=data.name,
        type=data.type,
        date=data.date,
        result=data.result,
        veterinarian=data.veterinarian,
        notes=data.notes,
    )
    db.add(exam)
    await db.commit()
    await db.refresh(exam)
    return exam


@router.get("", response_model=list[ExamResponse])
async def list_exams(
    pet_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Todos os exames dos pets acessíveis ao usuário (opcionalmente de um pet).

    O app chama GET /exams na tela de Exames. Este endpoint não existia — só
    havia POST na mesma rota — então a chamada voltava 405 Method Not Allowed e
    a lista ficava vazia para todo mundo, mesmo com exames cadastrados. Mesmo
    problema que GET /vaccines tinha.
    """
    pet_q = await db.execute(select(Pet.id).where(pet_accessible_filter(current_user.id)))
    pet_ids = [r[0] for r in pet_q.fetchall()]
    if pet_id is not None:
        if pet_id not in pet_ids:
            raise HTTPException(status_code=404, detail="Pet não encontrado")
        pet_ids = [pet_id]
    if not pet_ids:
        return []

    result = await db.execute(
        select(Exam)
        .options(selectinload(Exam.pet))
        .where(Exam.pet_id.in_(pet_ids))
        .order_by(Exam.date.desc())
    )
    return result.scalars().all()


@router.get("/pet/{pet_id}", response_model=list[ExamResponse])
async def list_exams_for_pet(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _verify_pet_ownership(pet_id, current_user.id, db)
    result = await db.execute(
        select(Exam).where(Exam.pet_id == pet_id).order_by(Exam.date.desc())
    )
    return result.scalars().all()


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_exam_verified(exam_id, current_user.id, db)


@router.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: int,
    data: ExamUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    exam = await _get_exam_verified(exam_id, current_user.id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(exam, field, value)
    await db.commit()
    await db.refresh(exam)
    return exam


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    exam = await _get_exam_verified(exam_id, current_user.id, db)
    await db.delete(exam)
    await db.commit()


ALLOWED_EXAM_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
ALLOWED_EXAM_EXTS = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


@router.post("/{exam_id}/upload", response_model=ExamResponse)
async def upload_exam_file(
    exam_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    exam = await _get_exam_verified(exam_id, current_user.id, db)

    # Validação de MIME-type (allowlist) — bloqueia HTML/JS/EXE/etc.
    if file.content_type and file.content_type.lower() not in ALLOWED_EXAM_MIME:
        raise HTTPException(
            status_code=400,
            detail="Tipo de arquivo não permitido. Aceitos: PDF, JPG, PNG, WEBP, HEIC.",
        )

    # Validação de extensão (defesa em profundidade — content_type pode ser falso)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext and ext not in ALLOWED_EXAM_EXTS:
        raise HTTPException(
            status_code=400,
            detail="Extensão de arquivo não permitida.",
        )
    if not ext:
        ext = ".pdf"

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo muito grande (máximo 10MB)")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    upload_dir = os.path.join(settings.UPLOAD_DIR, "exams")
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    exam.file_path = f"/uploads/exams/{filename}"
    await db.commit()
    await db.refresh(exam)
    return exam
