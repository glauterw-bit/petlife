#!/usr/bin/env python3
"""
Envia um e-mail de suporte pontual, direto por SMTP.

Usado quando alguém pede ajuda (ex.: redefinir senha) mas não encontramos a
conta no banco — aí o caminho é pedir os dados para localizar, ou orientar o
cadastro.

Autônomo de propósito: não importa `email_service` para poder rodar fora do
container (aquele módulo depende de httpx, que só existe no deploy).

Uso (com as variáveis de produção injetadas):
    railway run python3 scripts/send_support_email.py <email>
"""
import os
import smtplib
import ssl
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

APP_URL = "https://petlife-frontend-production.up.railway.app"
SUBJECT = "PetLife — não encontramos sua conta 🐾"


def build(to: str):
    html = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.6">
  <div style="text-align:center;padding:24px 0">
    <div style="font-size:28px;font-weight:800;color:#10b981">PetLife 🐾</div>
  </div>

  <p>Oi!</p>

  <p>Recebemos seu pedido para <strong>redefinir a senha</strong>, mas ao procurar
  no sistema <strong>não encontramos nenhuma conta com este e-mail</strong> ({to}).</p>

  <p>Isso costuma acontecer por um destes motivos:</p>
  <ul>
    <li>a conta foi criada com <strong>outro e-mail</strong> (um Gmail, por exemplo);</li>
    <li>houve um <strong>erro de digitação</strong> no e-mail no cadastro;</li>
    <li>o cadastro não chegou a ser concluído.</li>
  </ul>

  <p><strong>Como podemos te ajudar:</strong></p>

  <p style="margin:16px 0"><strong>1) Se você já tem conta</strong> — responda este
  e-mail com seu <strong>nome completo</strong> e <strong>telefone</strong>. Com
  esses dados localizamos seu cadastro e liberamos o acesso.</p>

  <p style="margin:16px 0"><strong>2) Se ainda não tem conta</strong> — é rápido criar:</p>

  <p style="text-align:center;margin:24px 0">
    <a href="{APP_URL}/auth/register"
       style="background:#10b981;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;display:inline-block">
      Criar minha conta grátis
    </a>
  </p>

  <p>Qualquer dúvida, é só responder aqui. 💚</p>
  <p style="margin-top:24px">Abraço,<br><strong>Equipe PetLife</strong></p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
  <p style="font-size:12px;color:#6b7280">
    Se não foi você que pediu a redefinição, pode ignorar este e-mail — nenhuma
    conta foi criada ou alterada.
  </p>
</div>
"""
    text = f"""\
Oi!

Recebemos seu pedido para redefinir a senha, mas nao encontramos nenhuma conta
com este e-mail ({to}).

Isso costuma acontecer quando:
- a conta foi criada com outro e-mail;
- houve erro de digitacao no cadastro;
- o cadastro nao chegou a ser concluido.

Como podemos ajudar:

1) Se voce JA TEM conta: responda este e-mail com seu NOME COMPLETO e TELEFONE.
   Com esses dados localizamos seu cadastro e liberamos o acesso.

2) Se voce AINDA NAO TEM conta: crie uma, e rapido:
   {APP_URL}/auth/register

Qualquer duvida, e so responder aqui.

Abraco,
Equipe PetLife

--
Se nao foi voce que pediu a redefinicao, pode ignorar este e-mail — nenhuma
conta foi criada ou alterada.
"""
    return html, text


def main() -> int:
    if len(sys.argv) < 2:
        print("uso: send_support_email.py <email>")
        return 2
    to = sys.argv[1].strip()

    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    pwd = os.getenv("SMTP_PASS", "").strip()
    sender = os.getenv("SMTP_FROM", "").strip() or user

    if not (host and user and pwd):
        print("✗ SMTP não configurado no ambiente")
        return 1

    msg = MIMEMultipart("alternative")
    msg["Subject"] = SUBJECT
    msg["From"] = f"PetLife <{sender}>"
    msg["To"] = to
    html, text = build(to)
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(host, port, timeout=30) as s:
        s.starttls(context=ctx)
        s.login(user, pwd)
        s.sendmail(sender, [to], msg.as_string())

    print(f"✅ enviado para {to} (remetente: {sender})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
