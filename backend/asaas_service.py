"""Asaas — assinatura pela web (PIX, boleto ou cartão) para quem usa o navegador.

No app de iPhone a Apple exige a compra pela App Store, e no app Android
distribuído pelo Google Play o Google exige o Play Billing. Por isso o checkout
web só é oferecido a quem acessa pelo navegador.

A conta Asaas é compartilhada com o ARKA: toda referência do PetLife começa com
"petlife:", e o webhook descarta eventos sem esse prefixo.

Env: ASAAS_API_KEY, ASAAS_ENV (sandbox | production), ASAAS_WEBHOOK_TOKEN.
"""
from __future__ import annotations

import os
from datetime import date

import httpx

BASE = {
    "sandbox": "https://api-sandbox.asaas.com/v3",
    "production": "https://api.asaas.com/v3",
}
REF_PREFIX = "petlife:"


def configured() -> bool:
    return bool((os.getenv("ASAAS_API_KEY") or "").strip())


def environment() -> str:
    return "production" if (os.getenv("ASAAS_ENV") or "").strip() == "production" else "sandbox"


async def _request(method: str, path: str, *, json: dict | None = None, params: dict | None = None) -> dict:
    key = (os.getenv("ASAAS_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("ASAAS_API_KEY não configurada")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.request(
            method, BASE[environment()] + path, json=json, params=params,
            headers={"access_token": key, "accept": "application/json", "User-Agent": "PetLife"},
        )
    if r.status_code >= 400:
        raise RuntimeError(f"Asaas {method} {path} → {r.status_code}: {r.text[:300]}")
    return r.json()


def reference(user_id: int, sku: str) -> str:
    return f"{REF_PREFIX}user:{user_id}:{sku}"


def parse_reference(ref: str | None) -> tuple[int, str] | None:
    """'petlife:user:42:plus_annual' → (42, 'plus_annual'). Qualquer outra coisa → None."""
    if not ref or not ref.startswith(REF_PREFIX + "user:"):
        return None
    parts = ref.split(":")
    if len(parts) != 4:
        return None
    try:
        return int(parts[2]), parts[3]
    except ValueError:
        return None


async def ensure_customer(*, user_id: int, name: str, email: str, cpf: str) -> str:
    ext = f"{REF_PREFIX}user:{user_id}"
    found = await _request("GET", "/customers", params={"externalReference": ext})
    if found.get("data"):
        return found["data"][0]["id"]
    created = await _request("POST", "/customers", json={
        "name": name, "email": email, "cpfCnpj": cpf, "externalReference": ext,
    })
    return created["id"]


async def create_subscription(*, customer_id: str, value: float, cycle: str,
                              description: str, ref: str) -> dict:
    # UNDEFINED: o cliente escolhe PIX, boleto ou cartão na página da fatura
    return await _request("POST", "/subscriptions", json={
        "customer": customer_id, "billingType": "UNDEFINED", "cycle": cycle,
        "value": value, "nextDueDate": date.today().isoformat(),
        "description": description, "externalReference": ref,
    })


async def first_invoice_url(subscription_id: str) -> str | None:
    payments = await _request("GET", f"/subscriptions/{subscription_id}/payments")
    for p in payments.get("data", []):
        if p.get("invoiceUrl"):
            return p["invoiceUrl"]
    return None


async def subscription_reference(subscription_id: str) -> str | None:
    sub = await _request("GET", f"/subscriptions/{subscription_id}")
    return sub.get("externalReference")
