"""Textos dos avisos do servidor (push, e-mail do fim do teste) no idioma do usuário.

O idioma vem do Accept-Language que o app manda em toda chamada e fica salvo
em users.locale (atualizado no /auth/me e no registro do aparelho). Sem
idioma salvo, vale pt-BR, como antes.
"""
from typing import Dict, Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import health_protocols_i18n

T: Dict[str, Dict[str, str]] = {
    "pt-BR": {
        "vac7.title": "Faltam 7 dias",
        "vac7.body": "A {vac} de {pet} vence em 7 dias.",
        "vac0.title": "É hoje",
        "vac0.body": "A {vac} de {pet} vence hoje.",
        "vacLate.title": "Vacina atrasada",
        "vacLate.body": "A {vac} de {pet} venceu há 3 dias.",
        "noVac.title": "{pet} está sem vacinas",
        "noVac.body": "Registre a carteirinha e a gente avisa antes de cada reforço vencer.",
        "heat.title": "🌸 Cio de {pet} chegando",
        "heat.body": "O próximo cio de {pet} deve começar {when}. {tip}",
        "heat.today": "hoje",
        "heat.tomorrow": "amanhã",
        "heat.inDays": "em {n} dias ({date})",
        "heat.tipCat": "Mantenha as janelas teladas e fique de olho nos sinais.",
        "heat.tipDog": "Passeios só na guia e longe de machos não castrados.",
        "support.title": "💬 O suporte do PetLife respondeu você",
        "found.title": "🐾 Alguém leu o QR do {pet}",
        "found.contact": " — contato: {c}",
        "clinicVac.title": "{clinic} registrou a vacina de {pet}",
        "clinicVac.body": "{vac} já está na carteirinha do app.",
        "trial.push.title": "Seu teste grátis do {plan} termina em {date}",
        "trial.push.body": "Toque para ver a mensagem do Glauter no suporte.",
        "trial.hi": "Oi, {name}! Aqui é o Glauter, do PetLife.",
        "trial.ends": "Seu teste grátis do {plan} termina em {date}.",
        "trial.kept": "Até aqui você organizou {pets} pet(s) e {vacs} vacina(s) no app, e tudo isso continua salvo em qualquer plano.",
        "trial.limit": "Só um aviso: o plano grátis vai até 3 pets, e você tem {pets}.",
        "trial.annual": "Se quiser continuar, o plano anual sai mais em conta: o PetLife+ fica em menos de R$ 12,50 por mês. Qualquer dúvida, é só responder aqui.",
        "trial.reply": "Responder no app",
        "trial.fallbackName": "tutor(a)",
        "date": "{d}/{m}",
    },
    "en": {
        "vac7.title": "7 days to go",
        "vac7.body": "{pet}'s {vac} is due in 7 days.",
        "vac0.title": "Due today",
        "vac0.body": "{pet}'s {vac} is due today.",
        "vacLate.title": "Vaccine overdue",
        "vacLate.body": "{pet}'s {vac} was due 3 days ago.",
        "noVac.title": "{pet} has no vaccines yet",
        "noVac.body": "Add the vaccine record and we'll remind you before each booster is due.",
        "heat.title": "🌸 {pet}'s heat is coming",
        "heat.body": "{pet}'s next heat should start {when}. {tip}",
        "heat.today": "today",
        "heat.tomorrow": "tomorrow",
        "heat.inDays": "in {n} days ({date})",
        "heat.tipCat": "Keep windows screened and watch for the signs.",
        "heat.tipDog": "Walks on the leash only, away from unneutered males.",
        "support.title": "💬 PetLife support replied to you",
        "found.title": "🐾 Someone scanned {pet}'s QR code",
        "found.contact": " — contact: {c}",
        "clinicVac.title": "{clinic} recorded {pet}'s vaccine",
        "clinicVac.body": "{vac} is now on the vaccine record in the app.",
        "trial.push.title": "Your {plan} free trial ends on {date}",
        "trial.push.body": "Tap to read Glauter's message in Support.",
        "trial.hi": "Hi, {name}! This is Glauter from PetLife.",
        "trial.ends": "Your {plan} free trial ends on {date}.",
        "trial.kept": "So far you have added {pets} pet(s) and {vacs} vaccine(s), and all of it stays saved on any plan.",
        "trial.limit": "Just so you know: the free plan covers up to 3 pets, and you have {pets}.",
        "trial.annual": "If you'd like to continue, the yearly plan costs less per month. Any questions, just reply here.",
        "trial.reply": "Reply in the app",
        "trial.fallbackName": "there",
        "date": "{m}/{d}",
    },
    "es": {
        "vac7.title": "Faltan 7 días",
        "vac7.body": "La {vac} de {pet} vence en 7 días.",
        "vac0.title": "Es hoy",
        "vac0.body": "La {vac} de {pet} vence hoy.",
        "vacLate.title": "Vacuna atrasada",
        "vacLate.body": "La {vac} de {pet} venció hace 3 días.",
        "noVac.title": "{pet} no tiene vacunas registradas",
        "noVac.body": "Registra la cartilla y te avisamos antes de que venza cada refuerzo.",
        "heat.title": "🌸 Se acerca el celo de {pet}",
        "heat.body": "El próximo celo de {pet} debería empezar {when}. {tip}",
        "heat.today": "hoy",
        "heat.tomorrow": "mañana",
        "heat.inDays": "en {n} días ({date})",
        "heat.tipCat": "Mantén las ventanas con malla y atento a las señales.",
        "heat.tipDog": "Paseos solo con correa y lejos de machos sin castrar.",
        "support.title": "💬 El soporte de PetLife te respondió",
        "found.title": "🐾 Alguien escaneó el QR de {pet}",
        "found.contact": " — contacto: {c}",
        "clinicVac.title": "{clinic} registró la vacuna de {pet}",
        "clinicVac.body": "{vac} ya está en la cartilla de la app.",
        "trial.push.title": "Tu prueba gratis de {plan} termina el {date}",
        "trial.push.body": "Toca para ver el mensaje de Glauter en soporte.",
        "trial.hi": "¡Hola, {name}! Soy Glauter, de PetLife.",
        "trial.ends": "Tu prueba gratis de {plan} termina el {date}.",
        "trial.kept": "Hasta ahora registraste {pets} mascota(s) y {vacs} vacuna(s), y todo sigue guardado en cualquier plan.",
        "trial.limit": "Un aviso: el plan gratis cubre hasta 3 mascotas, y tienes {pets}.",
        "trial.annual": "Si quieres continuar, el plan anual sale más barato por mes. Cualquier duda, responde aquí.",
        "trial.reply": "Responder en la app",
        "trial.fallbackName": "",
        "date": "{d}/{m}",
    },
}


def norm(locale: Optional[str]) -> str:
    loc = health_protocols_i18n.normalize_locale(locale) if locale else "pt-BR"
    return loc if loc in T else "pt-BR"


def t(locale: Optional[str], key: str, **kw) -> str:
    raw = T[norm(locale)].get(key) or T["pt-BR"][key]
    return raw.format(**kw) if kw else raw


def fmt_date(locale: Optional[str], d) -> str:
    return t(locale, "date", d=f"{d.day:02d}", m=f"{d.month:02d}")


def remember(user, accept_language: Optional[str]) -> bool:
    """Atualiza users.locale a partir do header. Devolve True se mudou."""
    if not accept_language:
        return False
    loc = norm(health_protocols_i18n.locale_from_header(accept_language))
    if getattr(user, "locale", None) != loc:
        user.locale = loc
        return True
    return False


async def locales_for(db: AsyncSession, user_ids: Iterable[int]) -> Dict[int, str]:
    from models import User
    ids = list({i for i in user_ids if i is not None})
    if not ids:
        return {}
    rows = await db.execute(select(User.id, User.locale).where(User.id.in_(ids)))
    return {uid: norm(loc) for uid, loc in rows.all()}


async def locale_of(db: AsyncSession, user_id: int) -> str:
    return (await locales_for(db, [user_id])).get(user_id, "pt-BR")
