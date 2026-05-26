"""Email service via Resend.

Setup:
  1. Sign up at https://resend.com (free tier: 100 emails/day, 3k/month)
  2. Set RESEND_API_KEY env var (Railway dashboard)
  3. Set RESEND_FROM_EMAIL (default: onboarding@resend.dev — works for testing
     without domain verification; for production verify your own domain)

When RESEND_API_KEY is not set, emails are logged but not sent (dev mode).
"""
import os
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "PetLife <onboarding@resend.dev>")
RESEND_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> bool:
    """Returns True if delivery succeeded (or dev-logged), False on transport error."""
    if not RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY not set — email NOT sent. Would send to=%s subject=%r",
            to, subject,
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
