"""Mapeamento de temas das perguntas feitas à Vyron IA.

PRIVACIDADE: nada do texto do usuário é armazenado. A pergunta é classificada
em uma categoria fixa (por palavras-chave, localmente — sem chamar IA nem
enviar nada pra fora) e só a CATEGORIA é gravada. Assim dá pra saber "o que os
tutores mais perguntam" sem guardar conteúdo pessoal sobre a saúde do pet.
"""
from __future__ import annotations

import unicodedata
import re

# Ordem importa: a primeira categoria que casar vence. As mais específicas
# (emergência, sintomas) vêm antes das genéricas.
TOPIC_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("emergencia", (
        "emergencia", "urgente", "socorro", "envenen", "intoxic", "atropel",
        "convuls", "desmai", "engasg", "sangrand", "hemorragia", "nao respira",
        "torcao", "picada de cobra", "choque",
    )),
    ("sintomas", (
        "vomit", "diarreia", "febre", "dor", "manc", "tremend", "tosse",
        "espirr", "coceira", "cocando", "ferida", "machucad", "carocc", "carocp",
        "caroco", "inchad", "apatic", "prostrad", "nao come", "sem apetite",
        "perdendo pelo", "queda de pelo", "mau halito", "cheiro ruim",
    )),
    ("vacina_vermifugo", (
        "vacina", "vermifug", "antipulga", "carrapat", "pulga", "raiva",
        "v8", "v10", "antirrabic", "imuniz",
    )),
    ("alimentacao", (
        "racao", "comida", "comer", "alimenta", "petisc", "dieta", "osso",
        "fruta", "pode dar", "pode comer", "quantas vezes por dia", "agua",
        "suplement", "caseir",
    )),
    ("comportamento", (
        "late", "latind", "morde", "mordend", "agressiv", "ansiedade", "ansios",
        "medo", "estress", "destro", "chora", "carente", "ciume", "briga",
        "xixi fora", "faz xixi", "caixa de areia", "arranha", "miando",
    )),
    ("treino", (
        "adestr", "ensinar", "comando", "senta", "obedec", "coleira", "guia",
        "socializ", "truque",
    )),
    ("medicamento", (
        "remedio", "medicament", "dose", "dipirona", "antibiotic", "anti-inflam",
        "pomada", "posso dar", "mg", "comprimido",
    )),
    ("reproducao", (
        "cio", "castr", "gravid", "prenh", "parto", "cruzar", "no cio",
        "filhotes nascer", "leite", "amamenta",
    )),
    ("higiene", (
        "banho", "tosa", "unha", "dente", "escova", "ouvido", "orelha",
        "limpar", "cheiro", "shampoo",
    )),
    ("passeio_exercicio", (
        "passei", "caminhad", "correr", "exercicio", "brincar", "brinquedo",
        "energia", "gasta energia", "parque",
    )),
    ("filhote", ("filhote", "recem nascid", "bebe", "primeiros meses", "desmam")),
    ("idoso", ("idoso", "velhinh", "idade avancada", "senil", "artrose")),
    ("peso", ("peso", "gord", "magr", "obes", "emagrec", "engord", "quilos", "kg")),
    ("viagem", ("viaj", "aviao", "carro", "transport", "hotel", "mudanca")),
    ("racas", ("raca", "srd", "vira lata", "vira-lata", "porte", "pedigree")),
    ("custos", ("preco", "custa", "valor", "quanto", "caro", "plano de saude")),
]

DEFAULT_TOPIC = "outros"

# Rótulos legíveis para o painel admin
TOPIC_LABELS = {
    "emergencia": "🚨 Emergência",
    "sintomas": "🤒 Sintomas / doença",
    "vacina_vermifugo": "💉 Vacina & vermífugo",
    "alimentacao": "🍽️ Alimentação",
    "comportamento": "🐾 Comportamento",
    "treino": "🎓 Treino & adestramento",
    "medicamento": "💊 Medicamento",
    "reproducao": "🍼 Reprodução & castração",
    "higiene": "🛁 Higiene & banho",
    "passeio_exercicio": "🏃 Passeio & exercício",
    "filhote": "🐶 Filhote",
    "idoso": "👴 Pet idoso",
    "peso": "⚖️ Peso",
    "viagem": "✈️ Viagem & transporte",
    "racas": "🐕 Raças",
    "custos": "💰 Custos",
    "outros": "❓ Outros",
}


def _normalize(text: str) -> str:
    """Minúsculas, sem acento — pra casar 'vômito' com 'vomit'."""
    s = unicodedata.normalize("NFD", text or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    return re.sub(r"\s+", " ", s)


def classify(question: str) -> str:
    """Devolve a categoria da pergunta. Nunca devolve o texto original."""
    q = _normalize(question)
    if not q.strip():
        return DEFAULT_TOPIC
    for topic, needles in TOPIC_RULES:
        for n in needles:
            if n in q:
                return topic
    return DEFAULT_TOPIC


def label(topic: str) -> str:
    return TOPIC_LABELS.get(topic, TOPIC_LABELS[DEFAULT_TOPIC])
