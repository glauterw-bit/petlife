"""Push do servidor via APNs (HTTP/2 + JWT).

POR QUE ISTO EXISTE
-------------------
O app só tinha notificação LOCAL, agendada por `@capacitor/local-notifications`
quando o app abria. Isso é estruturalmente incapaz de recuperar quem parou de
abrir — e era exatamente esse o problema: dos 125 cadastrados em 30 dias, 16
voltaram em algum dia posterior. O lembrete só alcançava quem já tinha voltado
sozinho.

CONFIGURAÇÃO (variáveis de ambiente)
------------------------------------
    APNS_KEY_ID        Key ID da chave APNs (.p8)
    APNS_TEAM_ID       Team ID da conta (ex.: 2WND53C953)
    APNS_BUNDLE_ID     Bundle do app (app.petlife)
    APNS_PRIVATE_KEY   Conteúdo do .p8 (com as linhas BEGIN/END)
    APNS_ENVIRONMENT   production | sandbox   (padrão: production)

A chave do App Store Connect NÃO serve aqui: APNs exige uma chave criada em
Certificates, Identifiers & Profiles → Keys, com "Apple Push Notifications
service (APNs)" marcado. Com as chaves erradas o APNs responde
403 InvalidProviderToken.

Sem configuração o módulo fica inerte: `configured()` devolve False e nada é
enviado — nenhuma exceção, nenhum ruído em log.
"""
from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Optional

PROD_HOST = "api.push.apple.com"
SANDBOX_HOST = "api.sandbox.push.apple.com"

# O token JWT do APNs vale no máximo 1h; a Apple recusa reemissão a cada <20min.
_TOKEN_TTL = 45 * 60
_cached: dict = {"jwt": None, "at": 0.0}


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def configured() -> bool:
    return bool(_env("APNS_KEY_ID") and _env("APNS_TEAM_ID") and _env("APNS_PRIVATE_KEY"))


def _private_key() -> str:
    # Railway costuma guardar multilinha com \n escapado.
    return _env("APNS_PRIVATE_KEY").replace("\\n", "\n")


def _provider_token() -> str:
    now = time.time()
    if _cached["jwt"] and now - _cached["at"] < _TOKEN_TTL:
        return _cached["jwt"]
    import jwt as pyjwt
    tok = pyjwt.encode(
        {"iss": _env("APNS_TEAM_ID"), "iat": int(now)},
        _private_key(),
        algorithm="ES256",
        headers={"kid": _env("APNS_KEY_ID")},
    )
    _cached.update(jwt=tok, at=now)
    return tok


async def send_one(
    device_token: str,
    title: str,
    body: str,
    *,
    environment: str = "production",
    data: Optional[dict] = None,
    collapse_id: Optional[str] = None,
) -> tuple[bool, str]:
    """Envia um push. Devolve (ok, detalhe).

    detalhe == 'Unregistered' quando o app foi desinstalado (HTTP 410): quem
    chama deve desativar o token para não seguir tentando eternamente.
    """
    if not configured():
        return False, "APNs não configurado"

    import httpx

    host = PROD_HOST if environment == "production" else SANDBOX_HOST
    payload = {
        "aps": {
            "alert": {"title": title, "body": body},
            "sound": "default",
            "badge": 1,
        }
    }
    if data:
        payload.update(data)

    headers = {
        "authorization": f"bearer {_provider_token()}",
        "apns-topic": _env("APNS_BUNDLE_ID", "app.petlife"),
        "apns-push-type": "alert",
        "apns-priority": "10",
    }
    if collapse_id:
        # Substitui a notificação anterior do mesmo assunto em vez de empilhar.
        headers["apns-collapse-id"] = collapse_id[:64]

    try:
        async with httpx.AsyncClient(http2=True, timeout=20) as c:
            r = await c.post(f"https://{host}/3/device/{device_token}",
                             json=payload, headers=headers)
        if r.status_code == 200:
            return True, "ok"
        reason = ""
        try:
            reason = (r.json() or {}).get("reason", "")
        except Exception:
            reason = r.text[:120]
        if r.status_code == 410 or reason == "Unregistered":
            return False, "Unregistered"
        return False, f"{r.status_code} {reason}"
    except Exception as e:  # rede, TLS, HTTP/2 indisponível
        return False, f"erro de envio: {str(e)[:120]}"
