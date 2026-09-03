"""País/cidade do usuário a partir do IP — para o painel admin.

Por que assim:
- O painel só localizava por GPS de passeio e DDD de telefone: enxergava só
  Brasil. Com o app publicado em 175 territórios (e UE voltando), precisamos
  saber DE ONDE vêm os usuários.
- LGPD: guardamos apenas o derivado grosseiro (país/UF/cidade), nunca o IP.
- Fonte: ipapi.co, gratuito até 1.000 consultas/dia — nosso volume é ~20
  logins/dia, e ainda limitamos a 1 consulta por usuário a cada 30 dias.
- Falha em silêncio: geolocalização é enfeite de painel, jamais pode custar
  uma requisição de produto.
"""
from __future__ import annotations

import asyncio
import ipaddress
from datetime import datetime, timedelta
from typing import Optional

REFRESH_DAYS = 30


def client_ip(headers, fallback: Optional[str]) -> Optional[str]:
    """Primeiro IP do X-Forwarded-For (Railway fica atrás de proxy)."""
    xff = headers.get("x-forwarded-for") or ""
    ip = xff.split(",")[0].strip() or (fallback or "")
    if not ip:
        return None
    try:
        if ipaddress.ip_address(ip).is_private or ipaddress.ip_address(ip).is_loopback:
            return None
    except ValueError:
        return None
    return ip


async def lookup(ip: str) -> Optional[dict]:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.5) as c:
            r = await c.get(f"https://ipapi.co/{ip}/json/")
        if r.status_code != 200:
            return None
        d = r.json()
        if d.get("error"):
            return None
        return {
            "country": (d.get("country_code") or "")[:2] or None,
            "region": (d.get("region") or "")[:60] or None,
            "city": (d.get("city") or "")[:80] or None,
        }
    except Exception:
        return None


def precisa_atualizar(user) -> bool:
    if not getattr(user, "geo_country", None):
        return True
    at = getattr(user, "geo_updated_at", None)
    return at is None or datetime.utcnow() - at > timedelta(days=REFRESH_DAYS)


def agenda_geolocalizacao(user_id: int, ip: Optional[str]) -> None:
    """Dispara a consulta fora do ciclo da requisição (fire-and-forget)."""
    if not ip:
        return

    async def _run():
        geo = await lookup(ip)
        if not geo or not geo.get("country"):
            return
        try:
            from database import AsyncSessionLocal
            from models import User
            from sqlalchemy import select
            async with AsyncSessionLocal() as db:
                u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
                if u:
                    u.geo_country = geo["country"]
                    u.geo_region = geo["region"]
                    u.geo_city = geo["city"]
                    u.geo_updated_at = datetime.utcnow()
                    await db.commit()
        except Exception:
            pass

    try:
        asyncio.get_running_loop().create_task(_run())
    except RuntimeError:
        pass
