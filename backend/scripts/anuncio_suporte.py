"""Anúncio do canal de suporte para toda a base — nasceu dos feedbacks.

Uso:
  python3 scripts/anuncio_suporte.py            # dry-run (lista destinatários)
  python3 scripts/anuncio_suporte.py --enviar   # envia de verdade

Env: DATABASE_URL, SMTP_HOST/PORT/USER/PASS/FROM. Pacing de 5s entre envios.
Idempotente: pula quem já tem usage_event 'anuncio_suporte'.
"""
import asyncio
import os
import smtplib
import ssl
import sys
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import asyncpg

EVENTO = "anuncio_suporte"
APP_URL = "https://petlife-frontend-production.up.railway.app"
PACING_S = 5

EXCLUIR_LIKE = ["%petlifeqa%", "%@example.com", "%@x.com", "%@test.com", "%@petlife.app"]

HTML = """
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
  <div style="font-size:40px;text-align:center">💬🐾</div>
  <h2 style="text-align:center;color:#0f766e">Agora tem gente do outro lado</h2>
  <p>Oi, {nome}!</p>
  <p>Uma novidade que nasceu <b>dos feedbacks de vocês</b>: o PetLife agora tem um
  <b>canal de suporte direto dentro do app</b>. Dúvida, problema, ideia ou só um oi —
  você escreve lá e <b>eu mesmo respondo</b> (sou o Glauter, criador do app).</p>
  <p style="text-align:center;margin:28px 0">
    <a href="{APP_URL}/suporte"
       style="background:#14b8a6;color:#fff;padding:14px 28px;border-radius:14px;
              text-decoration:none;font-weight:600;display:inline-block">
      💬 Falar com o suporte
    </a>
  </p>
  <p>É só abrir o app → menu → <b>Suporte</b>. A resposta chega no app e também no seu e-mail.</p>
  <p style="margin-top:24px">E continua valendo: se algo no PetLife te incomoda ou está
  faltando, <b>me conta</b> — foi ouvindo vocês que o app chegou até aqui, e é assim que
  ele vai continuar melhorando. Pode responder este e-mail direto, se preferir.</p>
  <p style="margin-top:28px">Um carinho no seu pet! 🐶🐱<br><b>Glauter · PetLife</b></p>
</div>
"""


async def main() -> None:
    enviar = "--enviar" in sys.argv
    db = await asyncpg.connect(os.environ["DATABASE_URL"])

    cond = " AND ".join(f"email NOT LIKE '{p}'" for p in EXCLUIR_LIKE)
    rows = await db.fetch(f"""
        SELECT u.id, u.name, u.email
        FROM users u
        WHERE {cond}
          AND position('@' in u.email) > 1
          AND NOT EXISTS (
            SELECT 1 FROM usage_events e
            WHERE e.user_id = u.id AND e.event = '{EVENTO}'
          )
        ORDER BY u.id
    """)
    print(f"destinatários: {len(rows)}")
    if not enviar:
        for r in rows[:10]:
            print("  ", r["email"])
        if len(rows) > 10:
            print(f"   … +{len(rows) - 10}")
        await db.close()
        return

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    pw = os.environ["SMTP_PASS"]
    from_ = os.environ.get("SMTP_FROM", user)
    ctx = ssl.create_default_context()

    ok = 0
    for r in rows:
        nome = (r["name"] or "").split(" ")[0] or "tutor(a)"
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Novidade no PetLife: agora tem gente do outro lado 💬"
        msg["From"] = from_
        msg["To"] = r["email"]
        msg.attach(MIMEText(HTML.replace("{nome}", nome).replace("{APP_URL}", APP_URL), "html", "utf-8"))
        try:
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.starttls(context=ctx)
                s.login(user, pw)
                s.sendmail(from_, [r["email"]], msg.as_string())
            await db.execute(
                "INSERT INTO usage_events (user_id, event, created_at) VALUES ($1, $2, now())",
                r["id"], EVENTO,
            )
            ok += 1
            print(f"  ✅ {r['email']}", flush=True)
        except Exception as e:
            print(f"  ❌ {r['email']}: {e}", flush=True)
        time.sleep(PACING_S)

    print(f"enviados: {ok}/{len(rows)}")
    await db.close()


asyncio.run(main())
