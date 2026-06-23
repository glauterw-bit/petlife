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
    receipt: str
    apple_product_id: str


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


# ─── Validação de recibo (chamado pelo app após compra/restauração) ──────────
async def _apply_receipt(db: AsyncSession, user: User, receipt: str, apple_product_id: str) -> dict:
    tier = pricing.tier_for_apple_product(apple_product_id)
    if not tier:
        raise HTTPException(status_code=400, detail="Produto desconhecido")

    try:
        info = await apple_iap.verify_receipt(receipt, apple_product_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Recibo inválido: {e}")
    except Exception:
        raise HTTPException(status_code=503, detail="Não foi possível validar com a Apple. Tente novamente.")

    expires_at = datetime.utcfromtimestamp(info["expires_ms"] / 1000) if info["expires_ms"] else None
    if not expires_at or expires_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Assinatura expirada ou inválida.")

    product = pricing.product_by_apple_id(apple_product_id)
    user.premium_tier = tier
    user.premium_expires_at = expires_at
    user.active_product_sku = product["sku"] if product else None
    user.apple_original_transaction_id = info.get("original_transaction_id")
    if info.get("is_trial"):
        user.trial_used = True

    db.add(IapTransaction(
        user_id=user.id,
        original_transaction_id=info.get("original_transaction_id"),
        transaction_id=info.get("transaction_id"),
        product_id=apple_product_id,
        tier=tier,
        expires_at=expires_at,
        source="verify_receipt",
        environment=info.get("environment"),
    ))
    await db.commit()

    return {
        "ok": True,
        "tier": tier,
        "active_product_sku": user.active_product_sku,
        "premium_expires_at": expires_at.isoformat(),
    }


@router.post("/iap/verify")
async def verify_iap(
    body: IapVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _apply_receipt(db, current_user, body.receipt, body.apple_product_id)


@router.post("/iap/restore")
async def restore_iap(
    body: IapVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restaurar compras: o app reenvia o recibo após store.restorePurchases()."""
    return await _apply_receipt(db, current_user, body.receipt, body.apple_product_id)


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
