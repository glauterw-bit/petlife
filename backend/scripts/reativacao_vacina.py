#!/usr/bin/env python3
"""E-mail de reativação: tutor cadastrou o pet e nunca registrou vacina.

POR QUE
-------
104 dos 143 usuários têm pet e nenhuma vacina. Sem vacina não há lembrete, e
sem lembrete o app não tem motivo para ser reaberto — 13% voltam em algum dia
posterior ao cadastro.

O push do servidor resolve isso daqui pra frente, mas depende de chave APNs e
de o usuário abrir o app ao menos uma vez para registrar o aparelho. Para quem
já sumiu, e-mail é o único canal que existe hoje.

Regras que este script respeita:
  - só quem TEM pet e NÃO tem vacina (quem já registrou não é incomodado)
  - uma vez por pessoa (grava em usage_events com o evento 'reativacao_email')
  - dry-run por padrão: só envia com --enviar

Uso:
    railway run python3 scripts/reativacao_vacina.py            # simula
    railway run python3 scripts/reativacao_vacina.py --enviar   # envia
    railway run python3 scripts/reativacao_vacina.py --enviar --limite 5
"""
import asyncio
import os
import smtplib
import ssl
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

APP_URL = "https://petlife-frontend-production.up.railway.app"
EVENTO = "reativacao_email"


def montar(nome: str, pet: str) -> tuple[str, str, str]:
    primeiro = (nome or "").split(" ")[0] or "Oi"
    assunto = f"{pet} está sem nenhuma vacina registrada 🐾"
    link = f"{APP_URL}/health/vaccines"
    html = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.6">
  <div style="text-align:center;padding:24px 0">
    <div style="font-size:28px;font-weight:800;color:#10b981">PetLife 🐾</div>
  </div>

  <p>Oi, {primeiro}!</p>

  <p>Vi que você cadastrou o <strong>{pet}</strong> no PetLife — que bom ter vocês por aqui.</p>

  <p>Só que a carteirinha dele ainda está vazia. E é justamente ela que faz o app
  trabalhar por você: <strong>a gente avisa antes de cada reforço vencer</strong>,
  para você não descobrir em cima da hora — ou na porta do hotelzinho.</p>

  <p style="text-align:center;margin:28px 0">
    <a href="{link}"
       style="background:#10b981;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;display:inline-block">
      Registrar a primeira vacina
    </a>
  </p>

  <p style="background:#f0fdf4;border-left:3px solid #10b981;padding:12px 16px;font-size:14px">
    <strong>Não está com a caderneta agora?</strong> Tudo bem. Dá para
    <strong>fotografar</strong> a carteirinha e deixar a IA preencher, ou marcar
    só o mês aproximado — o importante é ativar o lembrete. Você corrige depois.
  </p>

  <p>Qualquer dúvida, é só responder este e-mail. 💚</p>
  <p style="margin-top:24px">Abraço,<br><strong>Equipe PetLife</strong></p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
  <p style="font-size:12px;color:#6b7280">
    Você recebeu isto porque tem uma conta no PetLife. Se não quiser mais
    e-mails como este, responda com "sair" que a gente remove.
  </p>
</div>
"""
    texto = f"""\
Oi, {primeiro}!

Vi que voce cadastrou o {pet} no PetLife.

A carteirinha dele ainda esta vazia — e e ela que faz o app trabalhar por voce:
a gente avisa antes de cada reforco vencer.

Registrar a primeira vacina:
{link}

Nao esta com a caderneta agora? Da para fotografar a carteirinha e deixar a IA
preencher, ou marcar so o mes aproximado. O importante e ativar o lembrete.

Abraco,
Equipe PetLife

--
Se nao quiser mais e-mails como este, responda com "sair".
"""
    return assunto, html, texto


def enviar_smtp(to: str, assunto: str, html: str, texto: str) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    pwd = os.getenv("SMTP_PASS", "").strip()
    sender = os.getenv("SMTP_FROM", "").strip() or user
    if not (host and user and pwd):
        raise RuntimeError("SMTP não configurado")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = assunto
    msg["From"] = f"PetLife <{sender}>"
    msg["To"] = to
    msg.attach(MIMEText(texto, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(host, port, timeout=30) as s:
        s.starttls(context=ctx)
        s.login(user, pwd)
        s.sendmail(sender, [to], msg.as_string())


async def main() -> int:
    enviar = "--enviar" in sys.argv
    limite = None
    if "--limite" in sys.argv:
        limite = int(sys.argv[sys.argv.index("--limite") + 1])

    from sqlalchemy import text
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        q = await db.execute(text("""
            SELECT u.id, u.name, u.email,
                   (SELECT p2.name FROM pets p2 WHERE p2.user_id = u.id
                     ORDER BY p2.created_at LIMIT 1) AS pet
            FROM users u
            WHERE EXISTS (SELECT 1 FROM pets p WHERE p.user_id = u.id)
              AND NOT EXISTS (
                    SELECT 1 FROM vaccines v JOIN pets p3 ON p3.id = v.pet_id
                    WHERE p3.user_id = u.id)
              AND NOT EXISTS (
                    SELECT 1 FROM usage_events e
                    WHERE e.user_id = u.id AND e.event = :ev)
              AND u.email NOT LIKE '%@petlifeqa.com'
            ORDER BY u.created_at DESC
        """), {"ev": EVENTO})
        alvos = q.fetchall()

    if limite:
        alvos = alvos[:limite]

    print(f"{'ENVIANDO' if enviar else 'SIMULAÇÃO'} — {len(alvos)} destinatário(s)\n")
    ok = falhas = 0
    for uid, nome, email, pet in alvos:
        assunto, html, texto = montar(nome, pet or "seu pet")
        if not enviar:
            print(f"  [simulado] {email:<42} pet={pet}")
            continue
        try:
            enviar_smtp(email, assunto, html, texto)
            async with AsyncSessionLocal() as db:
                await db.execute(text(
                    "INSERT INTO usage_events (user_id, event, created_at) VALUES (:u, :e, now())"
                ), {"u": uid, "e": EVENTO})
                await db.commit()
            ok += 1
            print(f"  ✅ {email:<42} pet={pet}")
            await asyncio.sleep(1.2)   # não estourar limite do provedor
        except Exception as e:
            falhas += 1
            print(f"  ❌ {email:<42} {str(e)[:70]}")

    if enviar:
        print(f"\nenviados: {ok} | falhas: {falhas}")
    else:
        print("\nnada foi enviado. Use --enviar para disparar de verdade.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
