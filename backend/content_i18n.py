"""
Tradução do conteúdo dinâmico gerado pelo backend (Health Score, conquistas).

Mesmo padrão de `health_protocols_i18n`: a lógica continua emitindo português
e traduzimos a saída casando pela string exata. Sem isso o app aparece em
inglês mas com "Constância" e "Primeira caminhada" no meio — foi exatamente o
que apareceu nas screenshots de loja em EN/ES.

`missing()` lista strings emitidas pelo código que ainda não têm tradução,
para o teste de cobertura acusar quando alguém editar o texto em PT.
"""
from typing import Dict, Optional

DEFAULT_LOCALE = "pt-BR"


def normalize_locale(loc: Optional[str]) -> str:
    if not loc:
        return DEFAULT_LOCALE
    l = loc.strip().lower()
    if l.startswith("pt"):
        return "pt-BR"
    if l.startswith("es"):
        return "es"
    if l.startswith("en"):
        return "en"
    return DEFAULT_LOCALE


def locale_from_header(accept_language: Optional[str]) -> str:
    if not accept_language:
        return DEFAULT_LOCALE
    return normalize_locale(accept_language.split(",")[0])


# ── Health Score: rótulos das dimensões ──────────────────────────────────
DIM_LABELS: Dict[str, Dict[str, str]] = {
    "Vacinação": {"en": "Vaccination", "es": "Vacunación"},
    "Peso & corpo": {"en": "Weight & body", "es": "Peso y cuerpo"},
    "Atividade": {"en": "Activity", "es": "Actividad"},
    "Bem-estar": {"en": "Wellbeing", "es": "Bienestar"},
    "Constância": {"en": "Consistency", "es": "Constancia"},
}

# ── Health Score: mensagens de cada dimensão ─────────────────────────────
MESSAGES: Dict[str, Dict[str, str]] = {
    "Cadastre as vacinas pra acompanhar a imunização": {
        "en": "Add vaccines to track immunization",
        "es": "Registra las vacunas para seguir la inmunización",
    },
    "Vacinação em dia ✓": {"en": "Vaccinations up to date ✓", "es": "Vacunación al día ✓"},
    "Registre o peso pra acompanhar a condição corporal": {
        "en": "Log the weight to track body condition",
        "es": "Registra el peso para seguir la condición corporal",
    },
    "Peso ideal ✓": {"en": "Ideal weight ✓", "es": "Peso ideal ✓"},
    "Condição corporal levemente fora do ideal": {
        "en": "Body condition slightly off ideal",
        "es": "Condición corporal ligeramente fuera de lo ideal",
    },
    "Atenção ao peso — fora da faixa ideal": {
        "en": "Watch the weight — outside the ideal range",
        "es": "Atención al peso — fuera del rango ideal",
    },
    "Condição corporal precisa de cuidado veterinário": {
        "en": "Body condition needs veterinary care",
        "es": "La condición corporal necesita atención veterinaria",
    },
    "Peso estável": {"en": "Stable weight", "es": "Peso estable"},
    "Variação de peso recente — fique de olho": {
        "en": "Recent weight change — keep an eye on it",
        "es": "Cambio de peso reciente — mantente atento",
    },
    "Peso registrado": {"en": "Weight logged", "es": "Peso registrado"},
    "Nenhum passeio essa semana — que tal sair hoje?": {
        "en": "No walks this week — how about going out today?",
        "es": "Ningún paseo esta semana — ¿qué tal salir hoy?",
    },
    "Faça um check-in diário pra acompanhar o bem-estar": {
        "en": "Do a daily check-in to track wellbeing",
        "es": "Haz un check-in diario para seguir el bienestar",
    },
    "Bem-estar ótimo ✓": {"en": "Great wellbeing ✓", "es": "Bienestar excelente ✓"},
    "Bem-estar estável": {"en": "Stable wellbeing", "es": "Bienestar estable"},
    "Humor pra baixo — observe sinais": {
        "en": "Low mood — watch for signs",
        "es": "Ánimo bajo — observa las señales",
    },
    "Comece a registrar o dia a dia do seu pet": {
        "en": "Start logging your pet's daily routine",
        "es": "Empieza a registrar el día a día de tu mascota",
    },
}

# ── Conquistas de passeio (nome + descrição) ─────────────────────────────
BADGES: Dict[str, Dict[str, str]] = {
    "Primeira caminhada": {"en": "First walk", "es": "Primera caminata"},
    "Explorador iniciante": {"en": "Rookie explorer", "es": "Explorador principiante"},
    "Caminhante dedicado": {"en": "Dedicated walker", "es": "Caminante dedicado"},
    "Maratonista pet": {"en": "Pet marathoner", "es": "Maratonista pet"},
    "Primeiros 10 km": {"en": "First 10 km", "es": "Primeros 10 km"},
    "50 km lifetime": {"en": "50 km lifetime", "es": "50 km en total"},
    "100 km lifetime": {"en": "100 km lifetime", "es": "100 km en total"},
    "Semana perfeita": {"en": "Perfect week", "es": "Semana perfecta"},
    "Hábito de ouro": {"en": "Golden habit", "es": "Hábito de oro"},
    "Fotógrafo de pet": {"en": "Pet photographer", "es": "Fotógrafo de mascotas"},
    "Compartilhador": {"en": "Sharer", "es": "Compartidor"},
    "Madrugador": {"en": "Early bird", "es": "Madrugador"},
    "Coruja noturna": {"en": "Night owl", "es": "Búho nocturno"},
    # descrições
    "Finalize seu primeiro passeio": {"en": "Finish your first walk", "es": "Termina tu primer paseo"},
    "10 caminhadas registradas": {"en": "10 walks logged", "es": "10 caminatas registradas"},
    "50 caminhadas registradas": {"en": "50 walks logged", "es": "50 caminatas registradas"},
    "100 caminhadas registradas": {"en": "100 walks logged", "es": "100 caminatas registradas"},
    "10 km acumulados": {"en": "10 km accumulated", "es": "10 km acumulados"},
    "50 km totais percorridos": {"en": "50 km total distance", "es": "50 km recorridos en total"},
    "100 km totais percorridos": {"en": "100 km total distance", "es": "100 km recorridos en total"},
    "7 dias seguidos caminhando": {"en": "7 days walking in a row", "es": "7 días seguidos caminando"},
    "30 dias seguidos caminhando": {"en": "30 days walking in a row", "es": "30 días seguidos caminando"},
    "10 fotos em caminhadas": {"en": "10 photos on walks", "es": "10 fotos en caminatas"},
    "Compartilhe um passeio nas redes": {"en": "Share a walk on social media", "es": "Comparte un paseo en redes"},
    "Caminhada antes das 7h": {"en": "A walk before 7am", "es": "Caminata antes de las 7h"},
    "Caminhada depois das 22h": {"en": "A walk after 10pm", "es": "Caminata después de las 22h"},
}

# Tudo junto: a tradução casa pela string exata, então um único mapa basta.
_ALL: Dict[str, Dict[str, str]] = {**DIM_LABELS, **MESSAGES, **BADGES}

# ── Mensagens com número interpolado ─────────────────────────────────────
# Ex.: "3 dias ativos — tente manter o hábito". Como o número varia, o mapa
# exato não serve: casamos por padrão e remontamos no idioma alvo.
import re as _re

PATTERNS = [
    (
        _re.compile(r"^(\d+) passeios essa semana ✓$"),
        {"en": "{n} walks this week ✓", "es": "{n} paseos esta semana ✓"},
    ),
    (
        _re.compile(r"^(\d+) passeios — quase na meta$"),
        {"en": "{n} walks — almost at the goal", "es": "{n} paseos — casi en la meta"},
    ),
    (
        _re.compile(r"^(\d+) passeios — pode passear mais$"),
        {"en": "{n} walks — you could walk more", "es": "{n} paseos — puedes pasear más"},
    ),
    (
        _re.compile(r"^(\d+) dias ativos — que constância! ✓$"),
        {"en": "{n} active days — great consistency! ✓", "es": "{n} días activos — ¡qué constancia! ✓"},
    ),
    (
        _re.compile(r"^(\d+) dias ativos nas últimas 2 semanas$"),
        {"en": "{n} active days in the last 2 weeks", "es": "{n} días activos en las últimas 2 semanas"},
    ),
    (
        _re.compile(r"^(\d+) dias ativos — tente manter o hábito$"),
        {"en": "{n} active days — try to keep the habit", "es": "{n} días activos — intenta mantener el hábito"},
    ),
]


def tr(text: Optional[str], locale: str) -> Optional[str]:
    """Traduz uma string emitida pelo backend. Sem tradução, devolve o original."""
    if not text:
        return text
    loc = normalize_locale(locale)
    if loc == DEFAULT_LOCALE:
        return text
    entry = _ALL.get(text)
    if entry:
        return entry.get(loc, text)
    for rx, tpl in PATTERNS:
        m = rx.match(text)
        if m:
            return tpl.get(loc, text).replace("{n}", m.group(1))
    return text


def localize_health_score(score: Dict, locale: str) -> Dict:
    """Traduz labels/mensagens do Health Score (breakdown + próximo passo)."""
    loc = normalize_locale(locale)
    if loc == DEFAULT_LOCALE:
        return score
    out = dict(score)
    out["breakdown"] = [
        {**d, "label": tr(d.get("label"), loc), "message": tr(d.get("message"), loc)}
        for d in score.get("breakdown", [])
    ]
    ta = score.get("top_action")
    if isinstance(ta, dict):
        out["top_action"] = {**ta, "label": tr(ta.get("label"), loc), "message": tr(ta.get("message"), loc)}
    return out


def localize_badges(badges: list, locale: str) -> list:
    """Traduz nome e descrição das conquistas de passeio."""
    loc = normalize_locale(locale)
    if loc == DEFAULT_LOCALE:
        return badges
    return [
        {**b, "name": tr(b.get("name"), loc), "description": tr(b.get("description"), loc)}
        for b in badges
    ]


def missing() -> list:
    """Strings emitidas pelo código que ainda não têm tradução."""
    import re
    from pathlib import Path

    here = Path(__file__).parent
    found = set()
    hs = (here / "health_score.py").read_text(encoding="utf-8")
    found |= set(re.findall(r'return [^,]+, "([^"]{6,})"', hs))
    found |= set(re.findall(r'^\s*"(?:vaccination|weight|activity|wellbeing|consistency)": "([^"]+)"', hs, re.M))
    w = (here / "routers" / "walks.py").read_text(encoding="utf-8")
    for _k, name, _e, desc in re.findall(r'badge\("([^"]+)",\s*"([^"]+)",\s*"([^"]*)",\s*"([^"]+)"', w):
        found |= {name, desc}
    def has_pattern(x: str) -> bool:
        return any(rx.match(x) for rx, _ in PATTERNS)

    # f-strings viram "{...} passeios ..." na leitura do código: normalizamos
    # o placeholder para um número e testamos contra os padrões.
    def normalized(x: str) -> str:
        return _re.sub(r"\{[^}]+\}", "1", x)

    return sorted(
        s for s in found
        if s not in _ALL and not has_pattern(s) and not has_pattern(normalized(s))
    )


if __name__ == "__main__":
    m = missing()
    print(f"strings mapeadas: {len(_ALL)}")
    if m:
        print(f"SEM TRADUÇÃO ({len(m)}):")
        for s in m:
            print("  -", s)
        raise SystemExit(1)
    print("cobertura 100% ✅")
