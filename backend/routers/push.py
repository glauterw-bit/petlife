"""Push do servidor: registro de aparelho + envio dos lembretes.

O disparo fica num endpoint protegido por segredo (`/push/run`) em vez de um
agendador embutido: o Railway reinicia o processo a qualquer momento, e um
loop em memória perderia execuções sem avisar. Assim um cron externo chama a
rota e o resultado fica registrado em `push_logs`.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import DeviceToken, PushLog, User, Pet, Vaccine, Reminder
from auth import get_current_user
import push_service

router = APIRouter(prefix="/push", tags=["Push"])


class TokenIn(BaseModel):
    token: str
    platform: str = "ios"
    environment: str = "production"


@router.post("/register", status_code=status.HTTP_204_NO_CONTENT)
async def register_token(
    body: TokenIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Guarda (ou reassocia) o token do aparelho.

    O mesmo aparelho pode trocar de dono — se duas contas usam o celular, o
    token muda de usuário em vez de duplicar. Sem isso a pessoa errada recebe
    a notificação.
    """
    tok = (body.token or "").strip()
    if not tok:
        raise HTTPException(status_code=422, detail="Token vazio")

    row = (await db.execute(select(DeviceToken).where(DeviceToken.token == tok))).scalar_one_or_none()
    if row:
        row.user_id = current_user.id
        row.platform = body.platform
        row.environment = body.environment
        row.last_seen_at = datetime.utcnow()
        row.disabled_at = None
    else:
        db.add(DeviceToken(
            user_id=current_user.id, token=tok,
            platform=body.platform, environment=body.environment,
        ))
    await db.commit()


@router.delete("/register", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_token(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(DeviceToken).where(and_(DeviceToken.token == token,
                                       DeviceToken.user_id == current_user.id))
    )).scalar_one_or_none()
    if row:
        row.disabled_at = datetime.utcnow()
        await db.commit()


async def _tokens_for(db: AsyncSession, user_id: int) -> list[DeviceToken]:
    q = await db.execute(
        select(DeviceToken).where(and_(DeviceToken.user_id == user_id,
                                       DeviceToken.disabled_at.is_(None)))
    )
    return list(q.scalars().all())


async def _deliver(db: AsyncSession, user_id: int, dedupe: str, kind: str,
                   title: str, body: str) -> bool:
    """Envia para todos os aparelhos do usuário, uma única vez por dedupe_key."""
    já = (await db.execute(select(PushLog).where(PushLog.dedupe_key == dedupe))).scalar_one_or_none()
    if já:
        return False

    tokens = await _tokens_for(db, user_id)
    if not tokens:
        return False

    ok_any, detalhe = False, ""
    for t in tokens:
        ok, det = await push_service.send_one(
            t.token, title, body, environment=t.environment, collapse_id=kind,
        )
        detalhe = det
        if ok:
            ok_any = True
        elif det == "Unregistered":
            t.disabled_at = datetime.utcnow()   # app desinstalado

    db.add(PushLog(user_id=user_id, dedupe_key=dedupe, kind=kind,
                   title=title, body=body, ok=ok_any, detail=detalhe[:300]))
    await db.commit()
    return ok_any


@router.post("/run")
async def run_push_jobs(
    x_push_secret: Optional[str] = Header(None),
    dry_run: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Roda os disparos do dia. Protegido por segredo compartilhado.

    Três avisos, em ordem de valor:
      1. vacina vencendo (7 dias antes e no dia)
      2. vacina vencida (3 dias depois)
      3. pet sem nenhuma vacina registrada (uma vez, 3+ dias após cadastrar)

    O item 3 existe porque hoje 106 dos 111 pets não têm vacina nenhuma — sem
    isso não há o que lembrar, e o app não tem motivo para ser reaberto.
    """
    segredo = (os.getenv("PUSH_RUN_SECRET") or "").strip()
    if not segredo or x_push_secret != segredo:
        raise HTTPException(status_code=403, detail="Acesso negado")

    hoje = datetime.utcnow().date()
    resultado = {"configurado": push_service.configured(), "dry_run": dry_run,
                 "vence_em_7": 0, "vence_hoje": 0, "vencida": 0, "sem_vacina": 0}

    # ── 1 e 2: vacinas com data de reforço ────────────────────────────────
    janelas = [(7, "vence_em_7", "Faltam 7 dias", "A {vac} de {pet} vence em 7 dias."),
               (0, "vence_hoje", "É hoje", "A {vac} de {pet} vence hoje."),
               (-3, "vencida", "Vacina atrasada", "A {vac} de {pet} venceu há 3 dias.")]

    for delta, chave, titulo, corpo in janelas:
        alvo = hoje + timedelta(days=delta)
        q = await db.execute(
            select(Vaccine, Pet).join(Pet, Pet.id == Vaccine.pet_id)
            .where(func.date(Vaccine.next_due) == alvo)
        )
        for vac, pet in q.all():
            resultado[chave] += 1
            if dry_run:
                continue
            await _deliver(
                db, pet.user_id, f"vac:{vac.id}:{delta}", "vacina",
                titulo, corpo.format(vac=vac.name, pet=pet.name),
            )

    # ── 3: pet cadastrado sem nenhuma vacina ──────────────────────────────
    corte = datetime.utcnow() - timedelta(days=3)
    q = await db.execute(
        select(Pet).where(and_(
            Pet.created_at < corte,
            ~Pet.id.in_(select(Vaccine.pet_id)),
        ))
    )
    for pet in q.scalars().all():
        resultado["sem_vacina"] += 1
        if dry_run:
            continue
        await _deliver(
            db, pet.user_id, f"sem-vacina:{pet.id}", "sem_vacina",
            f"{pet.name} está sem vacinas",
            "Registre a carteirinha e a gente avisa antes de cada reforço vencer.",
        )

    return resultado
