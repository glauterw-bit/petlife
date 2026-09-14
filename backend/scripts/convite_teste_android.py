#!/usr/bin/env python3
"""Convite HONESTO para o teste fechado do Android (Google Play).

O Google exige 12 testadores aceitos por 14 dias corridos antes de liberar a
produção. Isso NÃO se simula — conta banida é permanente. Se resolve com gente
real: a nossa própria base.

Regras:
  - todo usuário real (o convite pede um aparelho Android; quem é iPhone é
    convidado a chamar alguém de Android — vira recrutador)
  - 1 vez por pessoa (usage_events: convite_teste_android)
  - dry-run por padrão; --enviar dispara
  - incentivo: 30 dias de PetLife+ para quem aceitar e ficar os 14 dias
    (mesmo tamanho do presente de indicação que já existe no app)

Uso:
  OPTIN_URL="https://play.google.com/apps/testing/app.petlife" \
      python3 scripts/convite_teste_android.py [--enviar] [--limite N]
"""
import asyncio, os, smtplib, ssl, sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EVENTO = os.getenv("EVENTO", "convite_teste_android")


def montar(nome: str, url: str):
    primeiro = (nome or "").split(" ")[0] or "Oi"
    lembrete = bool(os.getenv("LEMBRETE"))
    placar = os.getenv("PLACAR", "").strip() or "alguns"
    assunto = ("Lembrete: faltam poucos testadores pro PetLife chegar ao Android 🤖🐾" if lembrete
               else "Quer o PetLife no Android antes de todo mundo? 🤖🐾")
    aviso = (
        '<p style="background:#eff6ff;border-left:3px solid #3b82f6;padding:12px 16px;font-size:14px">'
        f'⏳ <strong>Lembrete:</strong> já somos {placar} testadores — faltam poucos pra liberar o app. '
        'Se você já aceitou e instalou, obrigado! Só mantenha o app instalado até o fim do teste.</p>'
    ) if lembrete else ""
    aviso_txt = (f"Lembrete: ja somos {placar} testadores, faltam poucos. Se voce ja aceitou, "
                 "obrigado! Mantenha o app instalado ate o fim do teste.\n\n") if lembrete else ""
    html = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.6">
  <div style="text-align:center;padding:24px 0">
    <div style="font-size:28px;font-weight:800;color:#10b981">PetLife 🐾</div>
  </div>
  <p>Oi, {primeiro}!</p>
  {aviso}
  <p>O PetLife pro <strong>Android</strong> está pronto — e o Google exige um grupo
  de testadores reais antes de liberar pra todo mundo. É aí que você entra.</p>
  <p><strong>Se você tem um celular Android</strong> (ou alguém em casa tem), são 2 passos:</p>
  <ol>
    <li>Toque no botão abaixo com a sua conta Google e aceite o convite;</li>
    <li>Instale o app e deixe ele instalado pelos próximos 14 dias — só isso.</li>
  </ol>
  <p style="text-align:center;margin:26px 0">
    <a href="{url}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;display:inline-block">
      Quero ser testador 🤖
    </a>
  </p>
  <p style="background:#f0fdf4;border-left:3px solid #10b981;padding:12px 16px;font-size:14px">
    🎁 <strong>De agradecimento:</strong> quem aceitar e ficar os 14 dias ganha
    <strong>30 dias de PetLife+</strong> — Vyron IA com 100 mensagens/mês.
  </p>
  <p><strong>Usa iPhone?</strong> Encaminha este e-mail pra aquele amigo ou parente
  de Android — cada testador nos aproxima do lançamento. 💚</p>
  <p style="margin-top:24px">Abraço,<br><strong>Equipe PetLife</strong></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
  <p style="font-size:12px;color:#6b7280">Você recebeu isto porque tem conta no PetLife.
  Pra não receber mais e-mails assim, responda com "sair".</p>
</div>"""
    texto = f"""Oi, {primeiro}!

{aviso_txt}O PetLife pro Android esta pronto — e o Google exige testadores reais antes de
liberar pra todo mundo.

Tem um celular Android (ou alguem em casa tem)? Sao 2 passos:
1) Aceite o convite com sua conta Google: {url}
2) Instale o app e deixe instalado pelos proximos 14 dias.

De agradecimento: 30 dias de PetLife+ pra quem aceitar e ficar os 14 dias.

Usa iPhone? Encaminhe este e-mail pra alguem de Android — cada testador nos
aproxima do lancamento.

Abraco, Equipe PetLife
--
Pra nao receber mais e-mails assim, responda com "sair".
"""
    return assunto, html, texto


def enviar_smtp(to, assunto, html, texto):
    host, port = os.getenv("SMTP_HOST","").strip(), int(os.getenv("SMTP_PORT","587"))
    user, pwd = os.getenv("SMTP_USER","").strip(), os.getenv("SMTP_PASS","").strip()
    sender = os.getenv("SMTP_FROM","").strip() or user
    msg = MIMEMultipart("alternative")
    msg["Subject"], msg["From"], msg["To"] = assunto, f"PetLife <{sender}>", to
    msg.attach(MIMEText(texto,"plain","utf-8")); msg.attach(MIMEText(html,"html","utf-8"))
    with smtplib.SMTP(host, port, timeout=30) as s:
        s.starttls(context=ssl.create_default_context()); s.login(user, pwd)
        s.sendmail(sender, [to], msg.as_string())


async def main():
    url = os.getenv("OPTIN_URL","").strip()
    if not url:
        print("defina OPTIN_URL com o link de opt-in do Play Console"); return 2
    enviar = "--enviar" in sys.argv
    limite = int(sys.argv[sys.argv.index("--limite")+1]) if "--limite" in sys.argv else None

    from sqlalchemy import text
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        # ALVO_EVENTO: lembrete só para quem recebeu o convite anterior
        alvo_ev = os.getenv("ALVO_EVENTO", "").strip()
        filtro_alvo = ("AND EXISTS (SELECT 1 FROM usage_events e2 WHERE e2.user_id=u.id AND e2.event=:alvo)"
                       if alvo_ev else "")
        params = {"ev": EVENTO, **({"alvo": alvo_ev} if alvo_ev else {})}
        q = await db.execute(text(f"""
            SELECT u.id, u.name, u.email FROM users u
            WHERE u.email NOT LIKE '%@petlifeqa.com'
              AND NOT EXISTS (SELECT 1 FROM usage_events e
                              WHERE e.user_id=u.id AND e.event=:ev)
              {filtro_alvo}
            ORDER BY u.created_at DESC"""), params)
        alvos = q.fetchall()
    # Convida só quem o Google ACEITOU na lista de testadores — pra ninguém
    # clicar num link que não funciona pro e-mail dele (34 foram recusados:
    # typos, contas de teste e endereços que não são conta Google).
    permitidos_path = os.getenv("PERMITIDOS", "").strip()
    if permitidos_path:
        permitidos = {l.strip().lower() for l in open(permitidos_path) if l.strip()}
        alvos = [r for r in alvos if r[2].strip().lower() in permitidos]
    if limite: alvos = alvos[:limite]
    print(f"{'ENVIANDO' if enviar else 'SIMULAÇÃO'} — {len(alvos)} destinatário(s) | link: {url}")
    ok = 0
    for uid, nome, email in alvos:
        assunto, html, texto = montar(nome, url)
        if not enviar:
            continue
        try:
            enviar_smtp(email, assunto, html, texto)
            async with AsyncSessionLocal() as db:
                await db.execute(text("INSERT INTO usage_events (user_id,event,created_at) VALUES (:u,:e,now())"),
                                 {"u": uid, "e": EVENTO})
                await db.commit()
            ok += 1; print(f"  ✅ {email}")
            await asyncio.sleep(1.2)
        except Exception as e:
            print(f"  ❌ {email} {str(e)[:60]}")
    if enviar: print(f"enviados: {ok}")
    return 0

if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
