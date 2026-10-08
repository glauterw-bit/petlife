"""Telemetria própria (leve, LGPD-friendly): eventos de uso pro painel admin.
Só grava user_id + nome do evento — nenhum conteúdo/PII no evento."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from auth import get_current_user
from models import User, UsageEvent, AppInstall

_limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/events", tags=["Telemetria"])

# Whitelist — evento fora daqui é descartado (400)
ALLOWED = {
    "app_open",        # abertura do app (1x por sessão do navegador/app)
    "plans_view",      # visitou a tela de planos
    "paywall_shown",   # bateu na quota e viu o modal de upgrade
    "recap_share",     # compartilhou o recap do mês
    "carteirinha_share",
    "carteirinha_whatsapp",       # botão WhatsApp da carteirinha
    "carteirinha_send_hotel",     # "enviar para quem cuida" → hotel/creche
    "carteirinha_send_groomer",   # → banho e tosa
    "carteirinha_send_vet",       # → veterinário
    "lost_marked",         # marcou o pet como perdido
    "lost_found",          # desmarcou (pet voltou)
    "lost_share",          # compartilhou o alerta
    "lost_qr_print",       # imprimiu o QR da coleira
    "rate_prompt_shown",   # modal de avaliação exibido
    "rate_prompt_store",   # clicou em "Avaliar na loja"
    "rate_prompt_later",   # dispensou o modal ("Agora não")
    "rate_prompt_native",  # chamou as estrelas nativas da Apple (nota 4-5)
    "support_open",        # abriu a tela do suporte
    "announce_suporte_shown",  # viu o anúncio do canal de suporte
    "announce_suporte_cta",    # clicou em "conhecer o suporte"
    "quickstart_shown",    # quick-start de vacinas exibido após cadastrar pet
    "quickstart_saved",    # registrou ao menos uma vacina pelo quick-start
    "quickstart_skipped",  # pulou o quick-start
    "quickstart_invite",   # abriu o convite de co-tutor no fim do quick-start
    "species_fix",         # confirmou a espécie num pet com raça divergente
    "soft_upsell_shown",   # convite de plano num momento de valor (PDF, recap, 3º pet)
    "soft_upsell_cta",     # tocou em "ver planos" no convite
    "web_checkout_start",  # abriu o pagamento pela web (Asaas)
    "start_shown",         # primeira abertura guiada (/start) exibida
    "start_pet_done",      # informou nome + espécie do pet antes da conta
    "apple_signin_start",  # tocou em "Continuar com a Apple"
    "apple_signin_ok",     # entrou/criou conta pela Apple
    "page_view",           # abriu uma tela (path normalizado, sem ids)
    "ui_error",            # o app mostrou uma mensagem de erro ao tutor
    "client_error",        # erro de JavaScript na tela
    "api_error",           # o servidor respondeu erro a uma ação
    "apple_signin_error",  # login com a Apple falhou
    "register_view",       # abriu a tela de cadastro
    "login_view",          # abriu a tela de login
    "start_step",          # avançou um passo da primeira abertura
    "store_invite_shown",  # convite de avaliação na App Store (usuários ativos)
    "store_invite_cta",    # tocou em "avaliar na App Store"
    "store_invite_later",  # dispensou o convite
}


# Eventos que valem SEM login (primeira abertura, cadastro, erros) — por aparelho
ANON_ALLOWED = {
    "page_view", "ui_error", "client_error", "api_error",
    "start_shown", "start_step", "start_pet_done", "register_view", "login_view",
    "apple_signin_start", "apple_signin_error",
}


class EventIn(BaseModel):
    event: str
    platform: str | None = None
    device_id: str | None = None
    path: str | None = None
    meta: str | None = None
    app_version: str | None = None


def _clean(body: "EventIn") -> dict:
    return {
        "platform": body.platform if body.platform in ("ios", "android", "web") else None,
        "device_id": (body.device_id or "").strip()[:64] or None,
        "path": (body.path or "").strip()[:80] or None,
        "meta": (body.meta or "").strip()[:120] or None,
        "app_version": (body.app_version or "").strip()[:16] or None,
    }


async def track_event(db: AsyncSession, user_id: int | None, event: str, platform: str | None = None,
                      *, device_id: str | None = None, path: str | None = None,
                      meta: str | None = None, app_version: str | None = None) -> None:
    """Uso interno (server-side) — não valida whitelist, não levanta exceção."""
    try:
        db.add(UsageEvent(user_id=user_id, event=event, platform=platform, device_id=device_id,
                          path=path, meta=meta, app_version=app_version))
        await db.flush()
    except Exception:
        pass


@router.post("", status_code=204)
@_limiter.limit("900/hour")
async def post_event(
    request: Request,
    body: EventIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.event not in ALLOWED:
        raise HTTPException(status_code=400, detail="Evento desconhecido")
    await track_event(db, current_user.id, body.event, **_clean(body))
    await db.commit()


@router.post("/anon", status_code=204)
@_limiter.limit("300/hour")
async def post_anon_event(request: Request, body: EventIn, db: AsyncSession = Depends(get_db)):
    """Evento sem login — só o id aleatório do aparelho, nenhum dado pessoal."""
    if body.event not in ANON_ALLOWED:
        raise HTTPException(status_code=400, detail="Evento desconhecido")
    c = _clean(body)
    if not c["device_id"] or len(c["device_id"]) < 16:
        raise HTTPException(status_code=400, detail="device_id inválido")
    await track_event(db, None, body.event, **c)
    await db.commit()


class InstallIn(BaseModel):
    device_id: str
    platform: str | None = None
    existing: bool = False  # já estava logado quando o contador chegou


@router.post("/install", status_code=204)
@_limiter.limit("30/hour")
async def post_install(request: Request, body: InstallIn, db: AsyncSession = Depends(get_db)):
    """Primeira abertura do app (sem login). Idempotente por aparelho."""
    from sqlalchemy import select
    dev = (body.device_id or "").strip()[:64]
    if len(dev) < 16:
        raise HTTPException(status_code=400, detail="device_id inválido")
    platform = body.platform if body.platform in ("ios", "android") else None
    if platform is None:
        return  # web não é download
    ja = (await db.execute(select(AppInstall.id).where(AppInstall.device_id == dev))).scalar_one_or_none()
    if ja:
        return
    db.add(AppInstall(device_id=dev, platform=platform, is_new=not body.existing))
    try:
        await db.commit()
    except Exception:
        await db.rollback()  # corrida entre duas chamadas do mesmo aparelho
