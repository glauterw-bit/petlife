"""Assinatura (Apple IAP) — catálogo, status, validação de recibo e webhook S2S."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

import pricing
import apple_iap
import subscriptions
from database import get_db
from auth import get_current_user
from models import User, IapTransaction

router = APIRouter(prefix="/billing", tags=["Assinatura"])
webhook_router = APIRouter(tags=["Webhooks"])


# ─── Schemas ──────────────────────────────────────────────────────────────────
class IapVerifyRequest(BaseModel):
    # Caminho novo (App Store Server API, sem shared secret):
    transaction_id: str | None = None
    # Caminho legado (verifyReceipt, precisa de APPLE_SHARED_SECRET):
    receipt: str | None = None
    apple_product_id: str | None = None


# ─── Catálogo ─────────────────────────────────────────────────────────────────
@router.get("/products")
async def list_products():
    """Catálogo de planos + quotas. Público (não exige login)."""
    return {
        "products": pricing.PRODUCTS,
        "quotas": pricing.QUOTAS,
        "free_quotas": pricing.QUOTAS["free"],
        "currency": "BRL",
    }


@router.get("/me")
async def my_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Estado da assinatura do usuário + uso vs limite no mês."""
    tier = subscriptions.effective_tier(current_user)
    snap = await subscriptions.usage_snapshot(db, current_user)
    return {
        "tier": tier,
        "active_product_sku": current_user.active_product_sku,
        "premium_expires_at": (
            current_user.premium_expires_at.isoformat()
            if current_user.premium_expires_at else None
        ),
        "is_premium": tier != "free",
        "trial_used": current_user.trial_used,
        "usage": snap,
    }


# ─── Helpers de persistência ─────────────────────────────────────────────────
async def _grant(db: AsyncSession, user: User, *, tier: str, apple_product_id: str,
                 expires_at, original_tx, transaction_id, is_trial, environment, source) -> dict:
    if not expires_at or expires_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Assinatura expirada ou inválida.")
    product = pricing.product_by_apple_id(apple_product_id)
    user.premium_tier = tier
    user.premium_expires_at = expires_at
    user.active_product_sku = product["sku"] if product else None
    user.apple_original_transaction_id = original_tx
    if is_trial:
        user.trial_used = True
    db.add(IapTransaction(
        user_id=user.id, original_transaction_id=original_tx, transaction_id=transaction_id,
        product_id=apple_product_id, tier=tier, expires_at=expires_at,
        source=source, environment=environment,
    ))
    await db.commit()
    return {"ok": True, "tier": tier, "active_product_sku": user.active_product_sku,
            "premium_expires_at": expires_at.isoformat()}


async def _apply_transaction(db: AsyncSession, user: User, transaction_id: str) -> dict:
    """Caminho novo: valida pela App Store Server API (sem shared secret)."""
    try:
        info = await apple_iap.fetch_transaction(transaction_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Transação inválida: {e}")
    except Exception:
        raise HTTPException(status_code=503, detail="Não foi possível validar com a Apple. Tente de novo.")
    apple_product_id = info.get("productId")
    tier = pricing.tier_for_apple_product(apple_product_id) if apple_product_id else None
    if not tier:
        raise HTTPException(status_code=400, detail="Produto desconhecido")
    expires_ms = info.get("expiresDate")
    expires_at = datetime.utcfromtimestamp(expires_ms / 1000) if expires_ms else None
    return await _grant(
        db, user, tier=tier, apple_product_id=apple_product_id, expires_at=expires_at,
        original_tx=info.get("originalTransactionId"), transaction_id=info.get("transactionId"),
        is_trial=info.get("offerType") == 1 or info.get("type") == "Auto-Renewable Subscription" and info.get("offerDiscountType") == "FREE_TRIAL",
        environment=info.get("environment"), source="server_api",
    )


async def _apply_receipt(db: AsyncSession, user: User, receipt: str, apple_product_id: str) -> dict:
    """Caminho legado: verifyReceipt (precisa de APPLE_SHARED_SECRET)."""
    tier = pricing.tier_for_apple_product(apple_product_id) if apple_product_id else None
    if not tier:
        raise HTTPException(status_code=400, detail="Produto desconhecido")
    try:
        info = await apple_iap.verify_receipt(receipt, apple_product_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Recibo inválido: {e}")
    except Exception:
        raise HTTPException(status_code=503, detail="Não foi possível validar com a Apple. Tente novamente.")
    expires_at = datetime.utcfromtimestamp(info["expires_ms"] / 1000) if info["expires_ms"] else None
    return await _grant(
        db, user, tier=tier, apple_product_id=apple_product_id, expires_at=expires_at,
        original_tx=info.get("original_transaction_id"), transaction_id=info.get("transaction_id"),
        is_trial=info.get("is_trial"), environment=info.get("environment"), source="verify_receipt",
    )


async def _dispatch(db: AsyncSession, user: User, body: IapVerifyRequest) -> dict:
    # Prefere a Server API (sem shared secret) quando há transaction_id + config.
    if body.transaction_id and apple_iap.server_api_configured():
        return await _apply_transaction(db, user, body.transaction_id)
    if body.receipt and body.apple_product_id:
        return await _apply_receipt(db, user, body.receipt, body.apple_product_id)
    if body.transaction_id:
        raise HTTPException(status_code=503,
                            detail="Validação por Server API ainda não configurada no servidor.")
    raise HTTPException(status_code=400, detail="Envie transaction_id ou receipt+apple_product_id.")


@router.post("/iap/verify")
async def verify_iap(
    body: IapVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _dispatch(db, current_user, body)


@router.post("/iap/restore")
async def restore_iap(
    body: IapVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restaurar compras: o app reenvia a transação/recibo após restorePurchases()."""
    return await _dispatch(db, current_user, body)


# ─── Webhook Apple S2S Notifications V2 ───────────────────────────────────────
# Configure em ASC → App → App Store Server Notifications → Production URL:
#   https://petlife-backend-production.up.railway.app/webhooks/apple  (Versão V2)
_RENEW_EVENTS = {"SUBSCRIBED", "DID_RENEW", "OFFER_REDEEMED"}
_REVOKE_EVENTS = {"EXPIRED", "REVOKE", "REFUND", "GRACE_PERIOD_EXPIRED"}


@webhook_router.post("/webhooks/apple")
async def apple_s2s_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        return {"ok": False, "note": "invalid json"}

    signed = body.get("signedPayload")
    if not signed:
        return {"ok": False, "note": "no signedPayload"}

    notif = apple_iap.decode_jws_payload(signed)
    if not notif:
        return {"ok": False, "note": "cannot decode payload"}

    ntype = notif.get("notificationType", "")
    data = notif.get("data") or {}
    tx_signed = data.get("signedTransactionInfo")
    tx = apple_iap.decode_jws_payload(tx_signed) if tx_signed else None
    if not tx:
        return {"ok": True, "note": "no transaction info"}

    original_tx = tx.get("originalTransactionId")
    product_id = tx.get("productId")
    expires_ms = tx.get("expiresDate")
    tier = pricing.tier_for_apple_product(product_id) if product_id else None
    expires_at = datetime.utcfromtimestamp(expires_ms / 1000) if expires_ms else None

    # Auditoria sempre
    db.add(IapTransaction(
        original_transaction_id=original_tx,
        transaction_id=tx.get("transactionId"),
        product_id=product_id,
        tier=tier,
        expires_at=expires_at,
        source="webhook",
        notification_type=ntype,
        environment=data.get("environment") or notif.get("environment"),
    ))

    # Localiza usuário pela original_transaction_id (gravada na verify_receipt)
    user = None
    if original_tx:
        q = await db.execute(
            select(User).where(User.apple_original_transaction_id == original_tx)
        )
        user = q.scalar_one_or_none()

    if user and tier:
        if ntype in _RENEW_EVENTS and expires_at:
            user.premium_tier = tier
            user.premium_expires_at = expires_at
            product = pricing.product_by_apple_id(product_id)
            if product:
                user.active_product_sku = product["sku"]
        elif ntype in _REVOKE_EVENTS:
            user.premium_tier = "free"
            user.premium_expires_at = None
            user.active_product_sku = None

    await db.commit()
    return {"ok": True}
