"""Painel admin ao vivo: feed de atividade, quem está online, jornada de cada
usuário e os indicadores de experiência (funil da primeira abertura, telas,
erros, retenção, versões, compartilhamentos, sinais de frustração).

Tudo sai da telemetria própria (usage_events) e das tabelas do app — nenhum
serviço externo. Consultas em SQL direto (Postgres) por serem agregações.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from routers.admin_stats import require_admin

router = APIRouter(prefix="/admin", tags=["Admin ao vivo"])

QA = "u.email NOT LIKE '%petlifeqa%'"

# Eventos que valem uma linha no feed (o resto é ruído: page_view etc.)
FEED_EVENTS = (
    "app_open", "plans_view", "paywall_shown", "carteirinha_share", "carteirinha_whatsapp",
    "carteirinha_send_hotel", "carteirinha_send_groomer", "carteirinha_send_vet",
    "lost_marked", "lost_found", "lost_share", "lost_qr_print", "quickstart_saved",
    "store_invite_cta", "rate_prompt_store", "apple_signin_ok", "web_checkout_start",
    "recap_share", "quickstart_invite",
)


def _iso(d) -> str | None:
    return d.isoformat() if d else None


async def _rows(db: AsyncSession, sql: str, **p) -> list:
    return list((await db.execute(text(sql), p)).mappings().all())


@router.get("/live")
async def admin_live(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Feed das últimas 24h + quem está com o app aberto agora (5 min)."""
    now = datetime.utcnow()
    since = now - timedelta(hours=24)
    feed: list[dict] = []

    for r in await _rows(db, f"""
        SELECT e.event, e.created_at, e.platform, e.path, e.user_id, u.name
        FROM usage_events e JOIN users u ON u.id = e.user_id
        WHERE e.created_at >= :s AND e.event = ANY(:evs) AND {QA} AND e.user_id <> :me
        ORDER BY e.created_at DESC LIMIT 60""", s=since, evs=list(FEED_EVENTS), me=admin.id if admin else 0):
        feed.append({"kind": r["event"], "at": _iso(r["created_at"]), "user_id": r["user_id"],
                     "name": r["name"], "platform": r["platform"]})

    for r in await _rows(db, f"""
        SELECT u.id, u.name, u.created_at, (u.apple_sub IS NOT NULL) AS apple
        FROM users u WHERE u.created_at >= :s AND {QA} ORDER BY u.created_at DESC LIMIT 30""", s=since):
        feed.append({"kind": "signup", "at": _iso(r["created_at"]), "user_id": r["id"], "name": r["name"],
                     "detail": "Apple" if r["apple"] else "e-mail"})

    for r in await _rows(db, f"""
        SELECT p.name AS pet, p.species::text AS species, p.created_at, u.id, u.name
        FROM pets p JOIN users u ON u.id = p.user_id
        WHERE p.created_at >= :s AND {QA} ORDER BY p.created_at DESC LIMIT 30""", s=since):
        feed.append({"kind": "pet", "at": _iso(r["created_at"]), "user_id": r["id"], "name": r["name"],
                     "detail": r["pet"], "species": r["species"]})

    for r in await _rows(db, f"""
        SELECT v.name AS vac, v.created_at, p.name AS pet, u.id, u.name
        FROM vaccines v JOIN pets p ON p.id = v.pet_id JOIN users u ON u.id = p.user_id
        WHERE v.created_at >= :s AND {QA} ORDER BY v.created_at DESC LIMIT 30""", s=since):
        feed.append({"kind": "vaccine", "at": _iso(r["created_at"]), "user_id": r["id"], "name": r["name"],
                     "detail": f"{r['vac']} · {r['pet']}"})

    for r in await _rows(db, """
        SELECT platform, created_at FROM app_installs
        WHERE created_at >= :s AND is_new ORDER BY created_at DESC LIMIT 30""", s=since):
        feed.append({"kind": "install", "at": _iso(r["created_at"]), "platform": r["platform"]})

    for r in await _rows(db, f"""
        SELECT m.created_at, u.id, u.name FROM support_messages m JOIN users u ON u.id = m.user_id
        WHERE m.created_at >= :s AND m.sender = 'user' ORDER BY m.created_at DESC LIMIT 20""", s=since):
        feed.append({"kind": "support", "at": _iso(r["created_at"]), "user_id": r["id"], "name": r["name"]})

    for r in await _rows(db, """
        SELECT t.created_at, t.notification_type, t.source, t.product_id, u.id, u.name
        FROM iap_transactions t LEFT JOIN users u ON u.id = t.user_id
        WHERE t.created_at >= :s ORDER BY t.created_at DESC LIMIT 20""", s=since):
        feed.append({"kind": "billing", "at": _iso(r["created_at"]), "user_id": r["id"], "name": r["name"],
                     "detail": r["notification_type"] or r["source"], "product": r["product_id"]})

    feed.sort(key=lambda x: x["at"] or "", reverse=True)

    online = await _rows(db, f"""
        SELECT DISTINCT ON (e.user_id) e.user_id, u.name, e.path, e.platform, e.created_at
        FROM usage_events e JOIN users u ON u.id = e.user_id
        WHERE e.created_at >= :s AND {QA} AND e.user_id <> :me
        ORDER BY e.user_id, e.created_at DESC""", s=now - timedelta(minutes=5), me=admin.id if admin else 0)
    anon = (await db.execute(text("""
        SELECT count(DISTINCT device_id) FROM usage_events
        WHERE created_at >= :s AND user_id IS NULL AND device_id IS NOT NULL"""),
        {"s": now - timedelta(minutes=5)})).scalar() or 0

    return {
        "generated_at": now.isoformat(),
        "feed": feed[:70],
        "online": [{"user_id": r["user_id"], "name": r["name"], "path": r["path"],
                    "platform": r["platform"], "at": _iso(r["created_at"])} for r in online],
        "online_anonymous": int(anon),
    }


@router.get("/users/{user_id}/journey")
async def user_journey(user_id: int, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Tudo o que um usuário fez, em ordem — para suporte e para entender onde travou."""
    u = (await _rows(db, """
        SELECT id, name, email, created_at, last_seen_at, premium_tier, active_product_sku,
               premium_expires_at, (apple_sub IS NOT NULL) AS apple, geo_city, geo_region
        FROM users WHERE id = :i""", i=user_id))
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    u = dict(u[0])
    pets = await _rows(db, """
        SELECT p.id, p.name, p.species::text AS species, p.created_at,
               (SELECT count(*) FROM vaccines v WHERE v.pet_id = p.id) AS vaccines
        FROM pets p WHERE p.user_id = :i ORDER BY p.id""", i=user_id)
    events = await _rows(db, """
        SELECT event, path, meta, platform, app_version, created_at FROM usage_events
        WHERE user_id = :i ORDER BY created_at DESC LIMIT 300""", i=user_id)
    tot = (await _rows(db, """
        SELECT count(*) FILTER (WHERE event = 'app_open') AS opens,
               count(DISTINCT date(created_at)) FILTER (WHERE event = 'app_open') AS active_days,
               count(*) FILTER (WHERE event IN ('ui_error','client_error','api_error')) AS errors,
               count(*) FILTER (WHERE event = 'paywall_shown') AS paywalls,
               max(app_version) AS app_version, max(platform) FILTER (WHERE platform <> 'web') AS platform
        FROM usage_events WHERE user_id = :i""", i=user_id))[0]
    sup = (await db.execute(text("SELECT count(*) FROM support_messages WHERE user_id = :i AND sender = 'user'"),
                            {"i": user_id})).scalar() or 0
    fb = await _rows(db, "SELECT rating, suggestion, created_at FROM feedbacks WHERE user_id = :i ORDER BY created_at DESC LIMIT 3", i=user_id)
    return {
        "user": {**{k: (_iso(v) if isinstance(v, datetime) else v) for k, v in u.items()}},
        "totals": {k: (int(v) if isinstance(v, int) else v) for k, v in dict(tot).items()},
        "support_messages": int(sup),
        "feedback": [{"rating": r["rating"], "suggestion": r["suggestion"], "at": _iso(r["created_at"])} for r in fb],
        "pets": [{"id": r["id"], "name": r["name"], "species": r["species"], "vaccines": int(r["vaccines"]),
                  "at": _iso(r["created_at"])} for r in pets],
        "events": [{"event": r["event"], "path": r["path"], "meta": r["meta"], "platform": r["platform"],
                    "app_version": r["app_version"], "at": _iso(r["created_at"])} for r in events],
    }


@router.get("/insights")
async def admin_insights(days: int = 14, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Indicadores de experiência (atualiza a cada minuto no painel)."""
    days = max(1, min(days, 90))
    now = datetime.utcnow()
    since = now - timedelta(days=days)
    d1, d7 = now - timedelta(days=1), now - timedelta(days=7)

    async def scalar(sql: str, **p) -> int:
        return int((await db.execute(text(sql), p)).scalar() or 0)

    # ── Funil da primeira abertura (por aparelho até o cadastro; depois por usuário) ──
    def dev(ev: str) -> str:
        return (f"SELECT count(DISTINCT device_id) FROM usage_events "
                f"WHERE event = '{ev}' AND created_at >= :s AND device_id IS NOT NULL")
    signups = await scalar(f"SELECT count(*) FROM users u WHERE u.created_at >= :s AND {QA}", s=since)
    funnel = {
        "days": days,
        "installs": await scalar("SELECT count(*) FROM app_installs WHERE is_new AND created_at >= :s", s=since),
        "start_shown": await scalar(dev("start_shown"), s=since),
        "start_pet_done": await scalar(dev("start_pet_done"), s=since),
        "register_view": await scalar(dev("register_view"), s=since),
        "signups": signups,
        "signups_apple": await scalar(f"SELECT count(*) FROM users u WHERE u.created_at >= :s AND u.apple_sub IS NOT NULL AND {QA}", s=since),
        "with_pet": await scalar(f"SELECT count(DISTINCT u.id) FROM users u JOIN pets p ON p.user_id = u.id WHERE u.created_at >= :s AND {QA}", s=since),
        "with_vaccine": await scalar(f"SELECT count(DISTINCT u.id) FROM users u JOIN pets p ON p.user_id = u.id JOIN vaccines v ON v.pet_id = p.id WHERE u.created_at >= :s AND {QA}", s=since),
        "returned": await scalar(f"""SELECT count(DISTINCT u.id) FROM users u JOIN usage_events e ON e.user_id = u.id
            WHERE u.created_at >= :s AND e.event = 'app_open' AND date(e.created_at) > date(u.created_at) AND {QA}""", s=since),
    }

    # ── Telas mais usadas (7 dias) ──
    screens = await _rows(db, """
        SELECT path, count(*) AS views, count(DISTINCT coalesce(user_id::text, device_id)) AS people
        FROM usage_events WHERE event = 'page_view' AND created_at >= :s AND path IS NOT NULL
        GROUP BY path ORDER BY views DESC LIMIT 20""", s=d7)

    # ── Erros (24h e 7 dias) ──
    errors = await _rows(db, """
        SELECT event, coalesce(path, '—') AS path, coalesce(meta, '—') AS meta,
               count(*) FILTER (WHERE created_at >= :d1) AS last_24h, count(*) AS last_7d,
               count(DISTINCT coalesce(user_id::text, device_id)) AS people, max(created_at) AS last_at
        FROM usage_events WHERE event IN ('ui_error','client_error','api_error','apple_signin_error')
          AND created_at >= :d7
        GROUP BY event, path, meta ORDER BY last_24h DESC, last_7d DESC LIMIT 25""", d1=d1, d7=d7)

    # ── Retenção por semana de cadastro (voltou em ou depois do dia N) ──
    cohorts = await _rows(db, f"""
        WITH c AS (
          SELECT u.id, date(u.created_at) AS d0, date_trunc('week', u.created_at)::date AS wk
          FROM users u WHERE u.created_at >= :s AND {QA}),
        a AS (SELECT user_id, max(date(created_at)) AS last_day FROM usage_events
              WHERE event = 'app_open' GROUP BY user_id)
        SELECT c.wk, count(*) AS size,
               count(*) FILTER (WHERE a.last_day >= c.d0 + 1)  AS d1,
               count(*) FILTER (WHERE a.last_day >= c.d0 + 7)  AS d7,
               count(*) FILTER (WHERE a.last_day >= c.d0 + 30) AS d30
        FROM c LEFT JOIN a ON a.user_id = c.id GROUP BY c.wk ORDER BY c.wk DESC LIMIT 8""",
        s=now - timedelta(days=63))

    # ── Versão do app (quem abriu nos últimos 14 dias) ──
    versions = await _rows(db, """
        SELECT coalesce(platform, '?') AS platform, coalesce(app_version, 'sem versão') AS version,
               count(DISTINCT user_id) AS users
        FROM (SELECT DISTINCT ON (user_id) user_id, platform, app_version FROM usage_events
              WHERE created_at >= :s AND user_id IS NOT NULL AND platform IN ('ios','android')
              ORDER BY user_id, (app_version IS NULL), created_at DESC) x
        GROUP BY 1, 2 ORDER BY users DESC""", s=now - timedelta(days=14))

    # ── Compartilhamentos e QR ──
    share_events = ("carteirinha_share", "carteirinha_whatsapp", "carteirinha_send_hotel",
                    "carteirinha_send_groomer", "carteirinha_send_vet", "lost_qr_print",
                    "lost_marked", "lost_share", "recap_share", "quickstart_invite")
    shares = await _rows(db, """
        SELECT event, count(*) FILTER (WHERE created_at >= :d7) AS d7, count(*) AS d30,
               count(DISTINCT user_id) AS users
        FROM usage_events WHERE event = ANY(:evs) AND created_at >= :d30 GROUP BY event""",
        evs=list(share_events), d7=d7, d30=now - timedelta(days=30))
    found = await scalar("SELECT count(*) FROM push_logs WHERE kind = 'pet_encontrado'")

    # ── Sinais de frustração (7 dias) ──
    paywall = await _rows(db, f"""
        SELECT u.id, u.name, count(*) AS n, max(e.created_at) AS last_at
        FROM usage_events e JOIN users u ON u.id = e.user_id
        WHERE e.event = 'paywall_shown' AND e.created_at >= :s AND {QA}
        GROUP BY u.id, u.name ORDER BY n DESC LIMIT 10""", s=d7)
    repeated = await _rows(db, f"""
        SELECT u.id, u.name, e.meta, e.path, count(*) AS n, max(e.created_at) AS last_at
        FROM usage_events e JOIN users u ON u.id = e.user_id
        WHERE e.event IN ('ui_error','api_error') AND e.created_at >= :s AND {QA}
        GROUP BY u.id, u.name, e.meta, e.path HAVING count(*) >= 3 ORDER BY n DESC LIMIT 10""", s=d7)
    stuck = await _rows(db, f"""
        SELECT u.id, u.name, u.created_at FROM users u
        WHERE u.created_at >= :s AND u.created_at < :h AND {QA}
          AND NOT EXISTS (SELECT 1 FROM pets p WHERE p.user_id = u.id)
        ORDER BY u.created_at DESC LIMIT 10""", s=d7, h=now - timedelta(hours=1))

    def lst(rows, *keys):
        return [{k: (_iso(r[k]) if isinstance(r[k], datetime) else (str(r[k]) if k == "wk" else r[k])) for k in keys} for r in rows]

    return {
        "generated_at": now.isoformat(),
        "funnel": funnel,
        "screens": lst(screens, "path", "views", "people"),
        "errors": lst(errors, "event", "path", "meta", "last_24h", "last_7d", "people", "last_at"),
        "cohorts": lst(cohorts, "wk", "size", "d1", "d7", "d30"),
        "versions": lst(versions, "platform", "version", "users"),
        "shares": lst(shares, "event", "d7", "d30", "users"),
        "found_reports": found,
        "frustration": {
            "paywall": lst(paywall, "id", "name", "n", "last_at"),
            "repeated_errors": lst(repeated, "id", "name", "meta", "path", "n", "last_at"),
            "no_pet": lst(stuck, "id", "name", "created_at"),
        },
    }
