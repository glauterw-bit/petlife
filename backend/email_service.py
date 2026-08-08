"""Email service — Resend OU SMTP genérico (ex.: Gmail), o que estiver configurado.

Opção A — Resend (conta em resend.com):
  RESEND_API_KEY + RESEND_FROM_EMAIL

Opção B — SMTP (qualquer provedor; Gmail funciona com App Password, sem conta nova):
  SMTP_HOST (ex.: smtp.gmail.com), SMTP_PORT (587), SMTP_USER, SMTP_PASS,
  SMTP_FROM (opcional; default = SMTP_USER)
  Gmail: myaccount.google.com/apppasswords (requer 2FA na conta Google).

Sem nenhum dos dois: e-mails são logados mas NÃO enviados (modo dev), e
`email_configured()` retorna False pra UI poder avisar o usuário com honestidade.
"""
import asyncio
import os
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "PetLife <onboarding@resend.dev>")
RESEND_URL = "https://api.resend.com/emails"

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASS = os.getenv("SMTP_PASS", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", "").strip() or SMTP_USER


def email_configured() -> bool:
    """True se existe algum transporte real de e-mail (Resend ou SMTP)."""
    return bool(RESEND_API_KEY) or bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def _send_smtp_sync(to: str, subject: str, html: str, text: Optional[str]) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to
    if text:
        msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
        s.starttls()
        s.login(SMTP_USER, SMTP_PASS)
        s.sendmail(SMTP_FROM, [to], msg.as_string())


async def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> bool:
    """Returns True if delivery succeeded (or dev-logged), False on transport error."""
    # Sem Resend, tenta SMTP (ex.: Gmail) antes de cair no modo dev
    if not RESEND_API_KEY:
        if SMTP_HOST and SMTP_USER and SMTP_PASS:
            try:
                await asyncio.to_thread(_send_smtp_sync, to, subject, html, text)
                logger.info("Email sent via SMTP to=%s subject=%r", to, subject)
                return True
            except Exception as e:
                logger.error("SMTP send failed to=%s: %s", to, e)
                return False
        logger.warning(
            "No email transport configured (RESEND_API_KEY/SMTP_*) — email NOT sent. "
            "Would send to=%s subject=%r", to, subject,
        )
        return True  # dev mode — treat as success so the API doesn't fail

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                RESEND_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
        if r.status_code >= 400:
            logger.error("Resend rejected: %s — %s", r.status_code, r.text)
            return False
        logger.info("Email sent via Resend to=%s id=%s", to, r.json().get("id"))
        return True
    except httpx.HTTPError as e:
        logger.exception("Resend transport error: %s", e)
        return False


async def send_password_reset_email(to: str, code: str, ttl_minutes: int) -> bool:
    subject = "PetLife — Código de redefinição de senha"
    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>{subject}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f4;">
  <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:32px 24px;text-align:center;">
      <div style="font-size:48px;line-height:1;">🐾</div>
      <h1 style="color:#fff;font-size:22px;margin:12px 0 4px;">PetLife</h1>
      <p style="color:#d1fae5;font-size:14px;margin:0;">Redefinição de senha</p>
    </div>
    <div style="padding:28px 24px;color:#292524;">
      <p style="font-size:16px;line-height:1.5;margin:0 0 16px;">Olá!</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 20px;">
        Recebemos um pedido pra redefinir a senha da sua conta PetLife.
        Use o código abaixo no app pra criar uma nova senha:
      </p>
      <div style="background:#ecfdf5;border:2px dashed #10b981;border-radius:12px;padding:18px;text-align:center;margin:24px 0;">
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#047857;font-family:'Courier New',monospace;">
          {code}
        </div>
      </div>
      <p style="font-size:13px;color:#78716c;margin:16px 0 0;line-height:1.55;">
        ⏱ Esse código expira em <strong>{ttl_minutes} minutos</strong>.<br>
        Se você não pediu redefinição, ignore este e-mail — sua senha continua segura.
      </p>
    </div>
    <div style="background:#fafaf9;padding:16px 24px;text-align:center;border-top:1px solid #e7e5e4;">
      <p style="font-size:11px;color:#a8a29e;margin:0;">
        Este é um e-mail automático. Por favor, não responda.<br>
        PetLife — Saúde do seu pet em um app.
      </p>
    </div>
  </div>
</body>
</html>"""
    text = (
        f"PetLife — Redefinição de senha\n\n"
        f"Seu código: {code}\n"
        f"Válido por {ttl_minutes} minutos.\n\n"
        f"Se você não pediu redefinição, ignore este e-mail."
    )
    return await send_email(to, subject, html, text)
