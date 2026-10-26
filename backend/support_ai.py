"""Assistente do suporte — responde o tutor 24h, dentro do próprio servidor.

Quando o tutor escreve no Suporte, esperamos alguns segundos (a pessoa costuma
mandar várias linhas seguidas) e, se ninguém da equipe respondeu nesse meio
tempo, o assistente responde com base no que o app faz e nos dados da conta.

O que ele não resolve sozinho (dinheiro, reclamação séria, saúde urgente,
jurídico/dados pessoais, ou quando não tem certeza) vira um aviso para o admin
e uma resposta dizendo que o Glauter vai responder pessoalmente.

Liga/desliga: SUPPORT_AI_ENABLED=0 desliga sem deploy de código.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timedelta

from sqlalchemy import select, func

from database import AsyncSessionLocal
from models import User, SupportMessage, Pet, Vaccine

logger = logging.getLogger(__name__)

SENDER = "assistant"
DEBOUNCE_SECONDS = int(os.getenv("SUPPORT_AI_DEBOUNCE", "25"))
HUMAN_ACTIVE_MINUTES = 30      # se o admin respondeu há pouco, a conversa é dele
MAX_REPLIES_PER_DAY = 8        # por tutor

# Assuntos que sempre vão para o dono, mesmo que a IA ache que sabe responder
ESCALATE_RE = re.compile(
    r"reembols|estorn|devolu[cç][aã]o|dinheiro de volta|cobran[cç]a indevida|cobrad[oa] (duas|2) vezes|"
    r"procon|advogad|processo|justi[cç]a|reclame aqui|lgpd|meus dados|apagar (meus )?dados|"
    r"golpe|fraude|hackead|invadid",
    re.I,
)

KNOWLEDGE = """
Você é o Assistente do PetLife, o atendimento automático do app PetLife (Brasil). Você responde no chat de Suporte do app, em português do Brasil, com tom acolhedor, direto e curto (2 a 6 frases; passos numerados quando for um "como faço"). Sem emojis em excesso (no máximo 1). Texto puro: o chat não mostra formatação, então nada de asteriscos, negrito, markdown ou títulos. Nunca finja ser humano: se perguntarem, diga que é o assistente automático e que o Glauter, criador do app, lê todas as conversas.

O QUE É O PETLIFE
App para tutores de cães e gatos: carteirinha de vacinação digital (PDF, link e QR para mandar ao hotel, creche, banho e tosa ou veterinário), lembretes de vacina, vermífugo e antipulgas, cadastro de vacina fotografando a carteirinha de papel (a IA lê e preenche), QR da coleira para pet perdido (quem encontra avisa o tutor pelo app sem ver o telefone), co-tutor (outra pessoa da família acompanha o mesmo pet), passeios com GPS, peso, desafios com pontos, retrospectiva do ano, Vyron (assistente de IA para dúvidas do dia a dia — não substitui o veterinário).
Navegação: barra inferior com Início, Pets, Passeios, Saúde e Mais. Configurações e Suporte ficam em Mais.

COMO FAZER (caminhos do app)
- Cadastrar vacina: Saúde → registrar vacina; dá para fotografar a carteirinha de papel e conferir o que a IA leu antes de salvar. Também dá pelo botão de ação no Início.
- Editar ou apagar uma vacina: Saúde → toque na vacina → Editar.
- Carteirinha e envio: Saúde → Carteirinha do pet → Enviar (escolha hotel/creche, banho e tosa, veterinário ou outro; vai pelo WhatsApp ou como PDF/link).
- Excluir um pet: abra o pet em Pets → Editar → Excluir (apaga também vacinas, exames, passeios e fotos daquele pet; não dá para desfazer).
- Foto do pet e dados (raça, peso, nascimento): Pets → pet → Editar.
- QR da coleira / pet perdido: abra o pet → seção do QR da coleira; dá para imprimir a plaquinha, marcar como perdido e compartilhar o alerta.
- Co-tutor: abra o pet → compartilhar/convidar; a pessoa recebe um link e aceita em Convites.
- Lembretes não chegam: no iPhone, Ajustes → PetLife → Notificações → permitir; no app, confira se a vacina tem a data da próxima dose.
- Esqueci a senha: na tela de entrar → "Esqueci a senha" (chega um código por e-mail). Quem criou a conta com "Entrar com a Apple" não tem senha: é só tocar em Continuar com a Apple; para criar uma senha, Mais → Configurações.
- Apagar a conta: Mais → Configurações → Zona de perigo → Apagar conta (apaga tudo, sem volta). Para apagar só um pet, use o caminho de excluir pet.
- Convide e ganhe: código em Início/Mais; quando o amigo cadastra a primeira vacina, os dois ganham 30 dias de PetLife+. Quem já se cadastrou pode digitar o código nos primeiros 7 dias.
- Android: o app para Android está em teste fechado no Google Play; quem não está no teste pode usar pelo navegador do celular (mesma conta). No Android ainda não dá para assinar planos.

PLANOS (assinatura do app, NÃO é plano de saúde)
- Grátis: até 3 pets, vacinas, lembretes, carteirinha, QR da coleira; IA com limite de 3 análises por mês.
- PetLife+: R$ 14,90/mês ou R$ 149/ano — até 5 pets e IA sem o limite mensal. Pro: R$ 29,90/mês ou R$ 299/ano — pets ilimitados.
- O mensal tem 7 dias grátis para novos assinantes (pela App Store). O anual não tem teste grátis.
- PetLife+ e Pro NÃO são plano de saúde nem convênio: não cobrem consultas, exames, internação nem emitem "carteirinha do plano". A carteirinha do app é a de vacinação.
- Cancelar (iPhone): Ajustes do iPhone → toque no seu nome → Assinaturas → PetLife → Cancelar assinatura. O acesso continua até o fim do período pago. O app não consegue cancelar por você.
- Restaurar compra em outro iPhone: Mais → Planos → Restaurar compras (mesma conta Apple).

REGRAS
1. Use só o que está aqui e no contexto da conta. Se não souber ou o app não fizer algo, diga com honestidade e marque escalate=true. Nunca invente recurso, prazo, preço ou política.
2. Dinheiro (reembolso, estorno, cobrança contestada, pagamento duplicado): NUNCA prometa nem negue reembolso. Explique que reembolsos de compras pela App Store são decididos pela Apple em reportaproblem.apple.com, diga que o Glauter vai acompanhar pessoalmente e marque escalate=true.
3. Saúde do pet: você não dá diagnóstico nem dose de remédio. Se houver sinal de urgência (não respira bem, convulsão, sangramento, envenenamento, atropelamento, não come há dias, muita dor), diga para procurar um veterinário ou pronto-socorro veterinário AGORA, e marque escalate=true. Dúvidas gerais de cuidado: oriente de forma geral e sugira confirmar com o veterinário.
4. Reclamação séria, bug que impede usar o app, dados pessoais/LGPD, jurídico, imprensa, parceria comercial, clínica querendo usar o PetLife Clínica: responda acolhendo, diga que o Glauter vai responder pessoalmente e marque escalate=true.
5. Mensagens só de cumprimento ("oi", "olá"): responda perguntando como pode ajudar, sem escalar.
6. Não peça senha, número de cartão nem dados sensíveis.

FORMATO: responda SOMENTE com um JSON: {"reply": "<texto para o tutor>", "escalate": true|false, "reason": "<motivo curto para o admin, vazio se não escalar>"}
"""


def enabled() -> bool:
    return os.getenv("SUPPORT_AI_ENABLED", "1") != "0" and bool(os.getenv("ANTHROPIC_API_KEY"))


async def _context(db, user: User) -> str:
    pets = (await db.execute(select(Pet).where(Pet.user_id == user.id))).scalars().all()
    vac = (await db.execute(
        select(func.count(Vaccine.id)).join(Pet, Pet.id == Vaccine.pet_id).where(Pet.user_id == user.id)
    )).scalar() or 0
    now = datetime.utcnow()
    tier = user.premium_tier or "free"
    active = bool(user.premium_expires_at and user.premium_expires_at > now)
    plano = f"{tier} ativo até {user.premium_expires_at:%d/%m/%Y}" if active and tier != "free" else "grátis (sem assinatura ativa)"
    especies = {"dog": "cão", "cat": "gato"}
    lista = ", ".join(f"{p.name} ({especies.get(getattr(p.species, 'value', p.species), 'pet')})" for p in pets) or "nenhum pet cadastrado"
    criada = f"{user.created_at:%d/%m/%Y}" if user.created_at else "—"
    return (
        f"Nome do tutor: {(user.name or '').split(' ')[0] or 'tutor(a)'}\n"
        f"Plano: {plano}\n"
        f"Pets: {lista}\n"
        f"Vacinas registradas na conta: {vac}\n"
        f"Conta criada em: {criada}"
    )


def _parse(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return {"reply": text.strip(), "escalate": True, "reason": "resposta fora do formato"}
    try:
        d = json.loads(m.group())
        return {"reply": str(d.get("reply", "")).strip(), "escalate": bool(d.get("escalate")), "reason": str(d.get("reason", ""))}
    except Exception:
        return {"reply": "", "escalate": True, "reason": "JSON inválido"}


HANDOFF = ("Recebi sua mensagem e já avisei o Glauter, criador do PetLife — ele vai te responder "
           "pessoalmente aqui no Suporte o quanto antes.")


async def handle_new_message(user_id: int, message_id: int) -> None:
    """Disparado em segundo plano a cada mensagem do tutor. Nunca levanta."""
    try:
        if not enabled():
            return
        await asyncio.sleep(DEBOUNCE_SECONDS)
        async with AsyncSessionLocal() as db:
            last = (await db.execute(
                select(SupportMessage).where(SupportMessage.user_id == user_id)
                .order_by(SupportMessage.created_at.desc(), SupportMessage.id.desc()).limit(1)
            )).scalar_one_or_none()
            # outra mensagem chegou depois (ela dispara a própria resposta) ou alguém já respondeu
            if not last or last.id != message_id or last.sender != "user":
                return
            since = datetime.utcnow() - timedelta(minutes=HUMAN_ACTIVE_MINUTES)
            human = (await db.execute(
                select(func.count(SupportMessage.id)).where(
                    SupportMessage.user_id == user_id, SupportMessage.sender == "admin",
                    SupportMessage.created_at >= since)
            )).scalar() or 0
            if human:
                return
            today = (await db.execute(
                select(func.count(SupportMessage.id)).where(
                    SupportMessage.user_id == user_id, SupportMessage.sender == SENDER,
                    SupportMessage.created_at >= datetime.utcnow() - timedelta(days=1))
            )).scalar() or 0
            if today >= MAX_REPLIES_PER_DAY:
                return
            user = await db.get(User, user_id)
            if not user:
                return

            hist = list(reversed((await db.execute(
                select(SupportMessage).where(SupportMessage.user_id == user_id)
                .order_by(SupportMessage.created_at.desc(), SupportMessage.id.desc()).limit(14)
            )).scalars().all()))
            # agrupa mensagens seguidas do mesmo lado (a API exige alternância user/assistant)
            turns: list[dict] = []
            for m in hist:
                role = "user" if m.sender == "user" else "assistant"
                body = m.body if role == "user" else (("[Glauter] " if m.sender == "admin" else "") + m.body)
                if turns and turns[-1]["role"] == role:
                    turns[-1]["content"] += "\n" + body
                else:
                    turns.append({"role": role, "content": body})
            while turns and turns[0]["role"] != "user":
                turns.pop(0)
            if not turns:
                return

            pending = "\n".join(t["content"] for t in turns if t["role"] == "user")[-2000:]
            forced = bool(ESCALATE_RE.search(turns[-1]["content"]))

            import ai_service
            system = KNOWLEDGE + "\n\nCONTEXTO DA CONTA (não repita dados sem necessidade):\n" + await _context(db, user)
            try:
                resp = await ai_service._create(
                    ai_service.get_client(), model=ai_service.MODEL, max_tokens=700,
                    system=system, messages=turns,
                )
                out = _parse(resp.content[0].text)
            except Exception as e:  # sem crédito, rede etc.: só avisa o admin
                logger.warning("support_ai falhou: %s", e)
                out = {"reply": "", "escalate": True, "reason": f"IA indisponível: {type(e).__name__}"}

            escalate = out["escalate"] or forced or not out["reply"]
            reply = re.sub(r"\*\*|__|^#+\s*", "", out["reply"], flags=re.M) or HANDOFF
            if escalate and "Glauter" not in reply:
                reply = reply.rstrip() + "\n\n" + HANDOFF

            # o tutor pode ter escrito de novo enquanto a IA pensava
            newer = (await db.execute(
                select(func.count(SupportMessage.id)).where(
                    SupportMessage.user_id == user_id, SupportMessage.id > message_id)
            )).scalar() or 0
            if newer:
                return

            msg = SupportMessage(user_id=user_id, sender=SENDER, body=reply[:4000])
            db.add(msg)
            await db.flush()
            from routers.events import track_event
            await track_event(db, user_id, "support_ai_reply", meta="escalado" if escalate else "resolvido")
            if escalate:
                from admin_alerts import notify_admins
                await notify_admins(
                    db, f"supai:{msg.id}", "adm_suporte",
                    f"⚠️ Suporte precisa de você — {(user.name or 'Tutor').split(' ')[0]}",
                    (out.get("reason") or ("assunto sensível" if forced else "")) + " · " + pending[-120:],
                )
            await db.commit()

            try:
                from routers.support import _notify_user
                _notify_user(user, reply)
                import push_service
                if push_service.configured():
                    from routers.push import _deliver
                    await _deliver(db, user_id, f"support:{msg.id}", "suporte",
                                   "💬 O suporte do PetLife respondeu você", reply[:150])
                    await db.commit()
            except Exception:
                pass
    except Exception:
        logger.exception("support_ai: erro inesperado")
