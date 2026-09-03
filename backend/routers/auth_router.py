import os
import logging
import secrets
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta, datetime
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

# Limiter compartilhado com main.py — declarado aqui pra decorar endpoints
_auth_limiter = Limiter(key_func=get_remote_address)

from database import get_db, settings
from models import User, UserPoints
from schemas import (
    UserRegister, UserLogin, Token, UserResponse, UserUpdate, ChangePassword,
    ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest,
)
from pydantic import BaseModel
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from email_service import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Autenticação"])

RESET_CODE_TTL_MINUTES = 30


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@_auth_limiter.limit("5/hour")
async def register(request: Request, user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="E-mail já cadastrado",
        )

    user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        phone=user_data.phone,
    )
    db.add(user)
    await db.flush()

    points = UserPoints(user_id=user.id, total_points=0, level=1, badges=[])
    db.add(points)

    # Indicação (recompensa dupla): aplica bônus pros dois lados se o código valer
    if user_data.referral_code:
        from routers.growth import redeem_referral
        await redeem_referral(db, user, user_data.referral_code)

    await db.commit()
    await db.refresh(user)

    # Quem acabou de se cadastrar já entra com sessão longa.
    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.REMEMBER_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
@_auth_limiter.limit("10/minute")
async def login(request: Request, credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # "Manter conectado": sessão de 1 ano. Sem isso o tutor precisava logar
    # de novo a cada 7 dias.
    minutes = (
        settings.REMEMBER_TOKEN_EXPIRE_MINUTES
        if credentials.remember
        else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    token = create_access_token(data={"sub": str(user.id)}, expires_delta=timedelta(minutes=minutes))

    # País/cidade pro painel admin — o login é o momento natural de captura
    # (o hook do get_current_user cobre sessões longas que nunca relogam).
    try:
        import geo_service
        if geo_service.precisa_atualizar(user):
            ip = geo_service.client_ip(request.headers, request.client.host if request.client else None)
            geo_service.agenda_geolocalizacao(user.id, ip)
    except Exception:
        pass

    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if update_data.name is not None:
        current_user.name = update_data.name
    if update_data.phone is not None:
        current_user.phone = update_data.phone
    if update_data.avatar is not None:
        current_user.avatar = update_data.avatar

    await db.commit()
    await db.refresh(current_user)
    return current_user


class DeleteAccountRequest(BaseModel):
    password: str
    confirmation: str  # tutor digita "APAGAR MINHA CONTA" pra confirmar


@router.delete("/me", status_code=status.HTTP_200_OK)
@_auth_limiter.limit("3/hour")
async def delete_account(
    request: Request,
    data: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apagamento de conta — exigência Apple App Store 5.1.1(v) + LGPD.
    Hard delete do user e todos os dados associados (cascade).
    Pets, vacinas, exames, anamneses, fotos, behavior logs, stories — tudo apagado.
    """
    if not verify_password(data.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Senha incorreta")

    if data.confirmation.strip() != "APAGAR MINHA CONTA":
        raise HTTPException(
            status_code=400,
            detail='Digite exatamente "APAGAR MINHA CONTA" para confirmar.',
        )

    user_id = current_user.id
    user_email = current_user.email

    # Limpa tabelas que referenciam User mas não têm CASCADE configurado
    from models import (
        PetShare, PetClinicAccess, PetRelation, BehaviorPlan, PetStory, ClinicVet
    )
    from sqlalchemy import delete as sql_delete, or_

    # Pet shares (user_id ou invited_by_user_id)
    await db.execute(sql_delete(PetShare).where(
        or_(PetShare.user_id == user_id, PetShare.invited_by_user_id == user_id)
    ))
    # Pet clinic access concedido pelo user
    await db.execute(sql_delete(PetClinicAccess).where(PetClinicAccess.granted_by_user_id == user_id))
    # Relações criadas pelo user
    await db.execute(sql_delete(PetRelation).where(PetRelation.created_by_user_id == user_id))
    # Behavior plans, stories (user_id direto, não vão por cascade do Pet)
    await db.execute(sql_delete(BehaviorPlan).where(BehaviorPlan.user_id == user_id))
    await db.execute(sql_delete(PetStory).where(PetStory.user_id == user_id))
    # Vínculo com clínicas (se for vet)
    await db.execute(sql_delete(ClinicVet).where(ClinicVet.user_id == user_id))

    # Hard delete user — cascade apaga pets, points, reminders, challenges
    # (configurado em User.relationship cascade="all, delete-orphan")
    await db.delete(current_user)
    await db.commit()

    return {
        "message": "Conta e todos os dados associados foram apagados permanentemente.",
        "deleted_user_email": user_email,
        "deleted_at": datetime.utcnow().isoformat(),
    }


@router.put("/change-password", status_code=status.HTTP_200_OK)
@_auth_limiter.limit("5/hour")
async def change_password(
    request: Request,
    data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta",
        )
    current_user.password_hash = get_password_hash(data.new_password)
    await db.commit()
    return {"message": "Senha alterada com sucesso"}


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@_auth_limiter.limit("3/hour")
async def forgot_password(request: Request, data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Gera um código de 6 dígitos válido por 30 min e envia por email via Resend.
    SEMPRE retorna sucesso (não revela se o e-mail existe — proteção contra enumeração).
    """
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    code = f"{secrets.randbelow(900000) + 100000}"

    if user:
        user.password_reset_code = code
        user.password_reset_expires = datetime.utcnow() + timedelta(minutes=RESET_CODE_TTL_MINUTES)
        await db.commit()

        sent = await send_password_reset_email(user.email, code, RESET_CODE_TTL_MINUTES)
        if not sent:
            logger.error("Failed to send password reset email to %s", user.email)

    from email_service import email_configured
    configured = email_configured()

    # Sem transporte de e-mail: registra o pedido pro admin resolver em 1 clique
    if user and not configured:
        try:
            from models import PasswordResetRequest
            db.add(PasswordResetRequest(user_id=user.id, email=user.email))
            await db.commit()
        except Exception:
            pass
    return ForgotPasswordResponse(
        message=(
            "Se este e-mail existir, enviaremos instruções com o código de redefinição em alguns minutos."
            if configured
            else "Recebemos seu pedido! Nosso suporte vai te enviar o código de redefinição no WhatsApp ou e-mail em instantes."
        ),
        code=None,
        expires_in_minutes=RESET_CODE_TTL_MINUTES,
        email_configured=configured,
    )


@router.post("/admin/generate-reset")
@_auth_limiter.limit("10/hour")
async def admin_generate_reset(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Gera código de redefinição SEM depender de e-mail — para o suporte/dono.

    Protegido pelo header X-Admin-Secret (env ADMIN_RESET_SECRET). Permite
    atender usuários que esqueceram a senha enquanto não há transporte de
    e-mail configurado: o suporte gera o código e passa por outro canal
    (WhatsApp etc.); o usuário digita o código + nova senha em /auth/reset.
    """
    import hmac as _hmac
    admin_secret = os.getenv("ADMIN_RESET_SECRET", "")
    provided = request.headers.get("X-Admin-Secret", "")
    if not admin_secret:
        raise HTTPException(status_code=503, detail="Recurso desabilitado (ADMIN_RESET_SECRET não configurado).")
    if not provided or not _hmac.compare_digest(provided, admin_secret):
        raise HTTPException(status_code=403, detail="Não autorizado.")

    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    code = f"{secrets.randbelow(900000) + 100000}"
    user.password_reset_code = code
    user.password_reset_expires = datetime.utcnow() + timedelta(minutes=RESET_CODE_TTL_MINUTES)
    await db.commit()
    logger.info("Admin reset code generated for %s", user.email)
    return {"email": user.email, "code": code, "expires_in_minutes": RESET_CODE_TTL_MINUTES}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
@_auth_limiter.limit("5/hour")
async def reset_password(request: Request, data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not user.password_reset_code or not user.password_reset_expires:
        raise HTTPException(status_code=400, detail="Código inválido ou expirado.")

    if user.password_reset_expires < datetime.utcnow():
        user.password_reset_code = None
        user.password_reset_expires = None
        await db.commit()
        raise HTTPException(status_code=400, detail="Código expirado. Solicite um novo.")

    if user.password_reset_code != data.code.strip():
        raise HTTPException(status_code=400, detail="Código incorreto.")

    user.password_hash = get_password_hash(data.new_password)
    user.password_reset_code = None
    user.password_reset_expires = None
    await db.commit()
    return {"message": "Senha redefinida com sucesso. Faça login com a nova senha."}
