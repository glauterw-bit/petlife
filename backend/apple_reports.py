"""Downloads por país direto da Apple (Sales Reports API) — pro painel admin.

Motivação: o card "Países e cidades" só enxerga USUÁRIO LOGADO com IP capturado
(começou em 02/set). Download sem cadastro não existe no nosso banco — os 3
downloads dos EUA, por exemplo, nunca apareceriam ali. A fonte da verdade de
download é a Apple, e este módulo a traz pra dentro do painel.

Config (Railway):
    ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY  (chave da API do App Store
    Connect — a mesma usada localmente em ~/.cache/petlife_asc)
    ASC_VENDOR_NUMBER  (94306945 — está na tela Business)

Particularidades da API que já nos morderam:
- Relatório diário só existe para dia FECHADO, com 24–48h de atraso; dia sem
  relatório volta HTTP 500 (não 404). Tratamos 4xx/5xx como "sem dados".
- Resposta é TSV gzipado. Product Type Identifier começando em "1" = download
  novo; "7"* é update e "3"* é IAP — não somamos.
- Cache em memória por data: relatório fechado é imutável; sem cache, cada
  refresh do painel bateria na Apple 14 vezes.
"""
from __future__ import annotations

import csv
import gzip
import io
import os
import time
from datetime import date, timedelta
from typing import Optional

_TOKEN: dict = {"jwt": None, "at": 0.0}
_CACHE: dict[str, dict] = {}   # data ISO -> {"by_country": {...}} | {"missing": True}
_CACHE_MISS_TTL = 6 * 3600
_MISS_AT: dict[str, float] = {}


def configured() -> bool:
    return all(os.getenv(k, "").strip() for k in
               ("ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_PRIVATE_KEY", "ASC_VENDOR_NUMBER"))


def _token() -> str:
    now = time.time()
    if _TOKEN["jwt"] and now - _TOKEN["at"] < 15 * 60:
        return _TOKEN["jwt"]
    import jwt as pyjwt
    tok = pyjwt.encode(
        {"iss": os.getenv("ASC_ISSUER_ID", "").strip(),
         "exp": int(now) + 19 * 60, "aud": "appstoreconnect-v1"},
        os.getenv("ASC_PRIVATE_KEY", "").replace("\\n", "\n"),
        algorithm="ES256",
        headers={"kid": os.getenv("ASC_KEY_ID", "").strip()},
    )
    _TOKEN.update(jwt=tok, at=now)
    return tok


async def _fetch_day(client, d: date) -> Optional[dict]:
    iso = d.isoformat()
    if iso in _CACHE:
        return _CACHE[iso]
    if iso in _MISS_AT and time.time() - _MISS_AT[iso] < _CACHE_MISS_TTL:
        return None
    r = await client.get(
        "https://api.appstoreconnect.apple.com/v1/salesReports",
        params={
            "filter[frequency]": "DAILY",
            "filter[reportType]": "SALES",
            "filter[reportSubType]": "SUMMARY",
            "filter[vendorNumber]": os.getenv("ASC_VENDOR_NUMBER", "").strip(),
            "filter[reportDate]": iso,
        },
        # "Bearer" maiúsculo: o salesReports recusa "bearer" com 401 (testado A/B)
        headers={"Authorization": f"Bearer {_token()}"},
    )
    if r.status_code != 200:
        _MISS_AT[iso] = time.time()
        return None
    by_country: dict[str, int] = {}
    txt = gzip.decompress(r.content).decode("utf-8", errors="replace")
    for row in csv.DictReader(io.StringIO(txt), delimiter="\t"):
        if (row.get("Product Type Identifier") or "").startswith("1"):
            cc = row.get("Country Code", "??")
            by_country[cc] = by_country.get(cc, 0) + int(float(row.get("Units", 0)))
    out = {"by_country": by_country}
    _CACHE[iso] = out
    return out


async def daily_downloads(days: int = 14) -> dict:
    """Últimos `days` dias fechados: por dia e agregado por país."""
    if not configured():
        return {"available": False}
    import httpx
    hoje = date.today()
    dias, total_pais = [], {}
    async with httpx.AsyncClient(timeout=20) as c:
        for i in range(1, days + 1):
            d = hoje - timedelta(days=i)
            got = await _fetch_day(c, d)
            if got is None:
                dias.append({"date": d.isoformat(), "reported": False,
                             "total": 0, "by_country": {}})
                continue
            bc = got["by_country"]
            for k, v in bc.items():
                total_pais[k] = total_pais.get(k, 0) + v
            dias.append({"date": d.isoformat(), "reported": True,
                         "total": sum(bc.values()), "by_country": bc})
    dias.reverse()
    return {
        "available": True,
        "days": dias,
        "by_country": sorted(
            [{"country": k, "count": v} for k, v in total_pais.items()],
            key=lambda x: -x["count"]),
        "total": sum(total_pais.values()),
    }
