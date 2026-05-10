import os
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta, datetime

from database import get_db, settings
from models import User, UserPoints
from schemas import (
    UserRegister, UserLogin, Token, UserResponse, UserUpdate, ChangePassword,
    ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest,
)
from auth import get_password_hash, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticação"])

# Quando SMTP_ENABLED=false (default), retornamos o código direto na response
# para desbloquear o fluxo enquanto não há servidor de e-mail configurado.
# Em produção real, configurar Resend/SendGrid e setar SMTP_ENABLED=true.
SMTP_ENABLED = os.getenv("SMTP_ENABLED", "false").lower() == "true"
RESET_CODE_TTL_MINUTES = 30


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
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
    await db.commit()
    await db.refresh(user)

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
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


@router.put("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
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
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Gera um código de 6 dígitos válido por 30 min.
    SEMPRE retorna sucesso (não revela se o e-mail existe — proteção contra enumeração).
    Quando SMTP_ENABLED=false, devolve o código na própria response (modo dev).
    """
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    code = f"{secrets.randbelow(900000) + 100000}"

    if user:
        user.password_reset_code = code
        user.password_reset_expires = datetime.utcnow() + timedelta(minutes=RESET_CODE_TTL_MINUTES)
        await db.commit()

        if SMTP_ENABLED:
            # TODO: integrar Resend/SendGrid e enviar e-mail real
            # await send_reset_email(user.email, code)
            pass

    if SMTP_ENABLED:
        return ForgotPasswordResponse(
            message="Se este e-mail existir, enviaremos instruções com o código de redefinição.",
            code=None,
            expires_in_minutes=RESET_CODE_TTL_MINUTES,
        )

    # Modo dev: retorna o código direto (apenas se o usuário existe)
    return ForgotPasswordResponse(
        message=(
            "Código gerado (modo desenvolvimento — sem SMTP configurado). "
            "Em produção, este código será enviado por e-mail."
        ) if user else "Se este e-mail existir, enviaremos instruções por e-mail.",
        code=code if user else None,
        expires_in_minutes=RESET_CODE_TTL_MINUTES,
    )


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
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
