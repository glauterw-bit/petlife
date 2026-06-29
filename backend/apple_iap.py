"""Integração Apple IAP (StoreKit) — validação de compra + decode de notificações S2S V2.

Dois caminhos de validação:
  1. App Store Server API (RECOMENDADO) — fetch_transaction(transaction_id):
     consulta a Apple direto pela transactionId usando a chave .p8 (App Store
     Connect API key). NÃO precisa de App-Specific Shared Secret nem de 2FA.
  2. verify_receipt() (legado) — valida o recibo StoreKit 1 via /verifyReceipt,
     precisa do APPLE_SHARED_SECRET. Mantido como fallback.

- decode_jws_payload(): decodifica o payload de um JWS (App Store Server
  Notifications V2 e respostas da Server API). A confiança vem de a resposta ter
  sido obtida do endpoint TLS autenticado da Apple.

Env vars:
  - App Store Server API (caminho 1): APPLE_INAPP_KEY_ID, APPLE_INAPP_ISSUER_ID,
    APPLE_INAPP_PRIVATE_KEY (conteúdo do .p8), APPLE_BUNDLE_ID (=app.petlife).
  - Legado (caminho 2): APPLE_SHARED_SECRET.
"""
from __future__ import annotations

import base64
import json
import os
import time

import httpx

APPLE_PROD_URL = "https://buy.itunes.apple.com/verifyReceipt"
APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt"

# App Store Server API (StoreKit) — produção + sandbox
SERVER_API_PROD = "https://api.storekit.itunes.apple.com"
SERVER_API_SANDBOX = "https://api.storekit-sandbox.itunes.apple.com"


def server_api_configured() -> bool:
    return all(os.getenv(k, "").strip() for k in
               ("APPLE_INAPP_KEY_ID", "APPLE_INAPP_ISSUER_ID", "APPLE_INAPP_PRIVATE_KEY"))


def _server_api_token() -> str:
    import jwt  # PyJWT
    key_id = os.getenv("APPLE_INAPP_KEY_ID", "").strip()
    issuer = os.getenv("APPLE_INAPP_ISSUER_ID", "").strip()
    bundle = os.getenv("APPLE_BUNDLE_ID", "app.petlife").strip()
    private_key = os.getenv("APPLE_INAPP_PRIVATE_KEY", "").strip().replace("\\n", "\n")
    now = int(time.time())
    return jwt.encode(
        {"iss": issuer, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1", "bid": bundle},
        private_key, algorithm="ES256", headers={"kid": key_id, "typ": "JWT"},
    )


async def fetch_transaction(transaction_id: str) -> dict:
    """Consulta a transação na App Store Server API (prod, fallback sandbox).

    Retorna o payload decodificado do signedTransactionInfo:
      {productId, expiresDate (ms), originalTransactionId, transactionId,
       bundleId, environment, ...}. Lança ValueError se não configurada/achada.
    """
    if not server_api_configured():
        raise ValueError("App Store Server API não configurada (faltam env vars APPLE_INAPP_*)")
    token = _server_api_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=20) as client:
        last = None
        for base in (SERVER_API_PROD, SERVER_API_SANDBOX):
            r = await client.get(f"{base}/inApps/v1/transactions/{transaction_id}", headers=headers)
            last = r
            if r.status_code == 200:
                signed = r.json().get("signedTransactionInfo")
                info = decode_jws_payload(signed) if signed else None
                if info:
                    info["environment"] = "Production" if base == SERVER_API_PROD else "Sandbox"
                    return info
                raise ValueError("Resposta da Apple sem signedTransactionInfo")
            if r.status_code == 404:
                continue  # tenta sandbox
            if r.status_code in (401, 403):
                raise ValueError(f"Auth da Server API recusada ({r.status_code}) — confira a chave .p8")
        raise ValueError(f"Transação não encontrada na Apple (último status {last.status_code if last else '?'})")


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
