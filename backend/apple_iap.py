"""Integração Apple IAP (StoreKit) — validação de recibo + decode de notificações S2S V2.

- verify_receipt(): valida o recibo na Apple (production, com fallback sandbox)
  e devolve a transação mais recente do produto.
- decode_jws_payload(): decodifica o payload de um JWS (App Store Server
  Notifications V2). NÃO verifica a assinatura (POC) — em produção, validar a
  cadeia x5c com a CA da Apple usando a lib `jose`/`cryptography`.

Env vars:
  - APPLE_SHARED_SECRET: App-Specific Shared Secret (ASC → App → General).
  - APPLE_BUNDLE_ID: app.petlife (opcional, p/ sanity-check do webhook).
"""
from __future__ import annotations

import base64
import json
import os

import httpx

APPLE_PROD_URL = "https://buy.itunes.apple.com/verifyReceipt"
APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt"


def _shared_secret() -> str:
    return os.getenv("APPLE_SHARED_SECRET", "").strip()


async def _post_verify(receipt_data: str, url: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(
            url,
            json={
                "receipt-data": receipt_data,
                "password": _shared_secret(),
                "exclude-old-transactions": True,
            },
        )
        return res.json()


async def verify_receipt(receipt_data: str, apple_product_id: str) -> dict:
    """Valida o recibo e retorna dados da assinatura ativa do produto.

    Retorna dict: {ok, status, product_id, expires_ms, original_transaction_id,
                   transaction_id, is_trial, environment}. Lança ValueError em erro.
    """
    result = await _post_verify(receipt_data, APPLE_PROD_URL)

    # 21007 = recibo de sandbox enviado pra produção → refaz no sandbox
    if result.get("status") == 21007:
        result = await _post_verify(receipt_data, APPLE_SANDBOX_URL)
        environment = "Sandbox"
    else:
        environment = result.get("environment") or "Production"

    status = result.get("status")
    if status != 0:
        raise ValueError(f"Apple verifyReceipt status {status}")

    # latest_receipt_info: transações de assinatura mais recentes
    infos = result.get("latest_receipt_info") or []
    matches = [r for r in infos if r.get("product_id") == apple_product_id]
    if not matches:
        raise ValueError("Transação do produto não encontrada no recibo")

    # mais recente por expires_date_ms
    latest = max(matches, key=lambda r: int(r.get("expires_date_ms", 0)))
    expires_ms = int(latest.get("expires_date_ms", 0))

    return {
        "ok": True,
        "status": status,
        "product_id": apple_product_id,
        "expires_ms": expires_ms,
        "original_transaction_id": latest.get("original_transaction_id"),
        "transaction_id": latest.get("transaction_id"),
        "is_trial": latest.get("is_trial_period") in (True, "true"),
        "environment": environment,
    }


def decode_jws_payload(jws: str) -> dict | None:
    """Decodifica o payload (2º segmento) de um JWS sem verificar assinatura."""
    try:
        parts = jws.split(".")
        if len(parts) < 2:
            return None
        payload = parts[1]
        # base64url sem padding
        padding = "=" * (-len(payload) % 4)
        raw = base64.urlsafe_b64decode(payload + padding)
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return None
