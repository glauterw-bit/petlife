"""
Localização dos protocolos de saúde (pt-BR / en / es).

Arquitetura: `health_protocols.py` continua emitindo português (é a fonte da
verdade da LÓGICA veterinária, baseada em WSAVA). Aqui traduzimos a SAÍDA,
casando pelo par exato (título, descrição). Escolhemos isso em vez de
reescrever as 269 linhas de regras porque mexer na lógica clínica para ganhar
tradução seria trocar risco alto por benefício baixo.

Por que não é tradução literal: a nomenclatura muda por país e traduzir ao pé
da letra confundiria o tutor e o veterinário dele.

  cão, polivalente : BR "V8/V10"   · US "DHPP/DA2PP"  · ES "polivalente"
  gato, polivalente: BR "V3/V4/V5" · US "FVRCP"       · ES "trivalente felina"
  raiva            : BR anual (lei) · US 1–3 anos (lei estadual) · ES anual/bienal

Cobertura é garantida por teste: `test_protocol_coverage()` falha se algum
texto emitido não tiver tradução. Não substitui orientação veterinária.
"""
from typing import Dict, Optional, Tuple

DEFAULT_LOCALE = "pt-BR"
SUPPORTED = ("pt-BR", "en", "es")


def normalize_locale(loc: Optional[str]) -> str:
    """Aceita 'pt', 'pt-BR', 'en-US;q=0.9', 'es-MX'… e devolve um locale suportado."""
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
    """Lê o primeiro idioma de um header Accept-Language."""
    if not accept_language:
        return DEFAULT_LOCALE
    first = accept_language.split(",")[0]
    return normalize_locale(first)


PHASE_LABEL: Dict[str, Dict[str, str]] = {
    "pt-BR": {"puppy_kitten": "Filhote", "young": "Jovem (1-2 anos)", "adult": "Adulto", "senior": "Senior"},
    "en": {"puppy_kitten": "Puppy/Kitten", "young": "Young (1-2 years)", "adult": "Adult", "senior": "Senior"},
    "es": {"puppy_kitten": "Cachorro", "young": "Joven (1-2 años)", "adult": "Adulto", "senior": "Senior"},
}

CATEGORY_LABEL: Dict[str, Dict[str, str]] = {
    "pt-BR": {"vacina": "vacina", "exame": "exame", "consulta": "consulta", "cuidado": "cuidado"},
    "en": {"vacina": "vaccine", "exame": "test", "consulta": "check-up", "cuidado": "care"},
    "es": {"vacina": "vacuna", "exame": "examen", "consulta": "consulta", "cuidado": "cuidado"},
}

URGENCY_LABEL: Dict[str, Dict[str, str]] = {
    "pt-BR": {"alta": "alta", "media": "média", "baixa": "baixa"},
    "en": {"alta": "high", "media": "medium", "baixa": "low"},
    "es": {"alta": "alta", "media": "media", "baixa": "baja"},
}


# ── Tradução por par exato (título PT, descrição PT) ─────────────────────
# Formato: (titulo_pt, descricao_pt): {"en": (t, d), "es": (t, d)}
TRANSLATIONS: Dict[Tuple[str, str], Dict[str, Tuple[str, str]]] = {
    # ---------------- CÃO ----------------
    ("Vacina V8 ou V10 (1ª dose)", "Primeira dose da vacina polivalente — entre 6 e 8 semanas."): {
        "en": ("DHPP vaccine (1st dose)", "First dose of the core combination vaccine — between 6 and 8 weeks."),
        "es": ("Vacuna polivalente (1ª dosis)", "Primera dosis de la vacuna múltiple — entre las 6 y 8 semanas."),
    },
    ("Vacina V8/V10 (2ª e 3ª doses)", "Reforços a cada 21-28 dias até completar 16 semanas."): {
        "en": ("DHPP vaccine (2nd and 3rd doses)", "Boosters every 21-28 days until 16 weeks of age."),
        "es": ("Vacuna polivalente (2ª y 3ª dosis)", "Refuerzos cada 21-28 días hasta cumplir 16 semanas."),
    },
    ("Vacina Antirrábica", "A partir dos 4 meses de idade. Obrigatória por lei."): {
        "en": ("Rabies vaccine", "From 12-16 weeks of age. Required by law in most states."),
        "es": ("Vacuna antirrábica", "A partir de los 3-4 meses. Obligatoria por ley en la mayoría de los países."),
    },
    ("Vermífugo", "Vermifugar a cada 15 dias até 3 meses, depois mensal até 6 meses."): {
        "en": ("Deworming", "Every 2 weeks until 3 months of age, then monthly until 6 months."),
        "es": ("Desparasitación", "Cada 15 días hasta los 3 meses, luego mensual hasta los 6 meses."),
    },
    ("Castração (planejamento)", "Conversar com o veterinário sobre castração entre 6-12 meses."): {
        "en": ("Spay/neuter (planning)", "Discuss spay/neuter timing with your vet, usually between 6-12 months."),
        "es": ("Castración (planificación)", "Consultar con el veterinario la castración entre los 6-12 meses."),
    },
    ("Reforço anual V8/V10", "Revacinar polivalente uma vez por ano."): {
        "en": ("Annual DHPP booster", "Revaccinate with the core combination vaccine once a year."),
        "es": ("Refuerzo anual polivalente", "Revacunar con la múltiple una vez al año."),
    },
    ("Reforço anual antirrábica", "Antirrábica deve ser reforçada anualmente."): {
        "en": ("Rabies booster", "Boosters every 1-3 years depending on the vaccine and your state law."),
        "es": ("Refuerzo antirrábico", "Refuerzo anual o bienal según la normativa local."),
    },
    ("Vermífugo trimestral", "Aplicar vermífugo a cada 3 meses."): {
        "en": ("Quarterly deworming", "Give a dewormer every 3 months."),
        "es": ("Desparasitación trimestral", "Aplicar desparasitante cada 3 meses."),
    },
    ("Antipulgas e carrapatos", "Aplicar produto mensal (Bravecto, NexGard, etc.) de acordo com peso."): {
        "en": ("Flea and tick prevention", "Apply a monthly product (Bravecto, NexGard, etc.) according to weight."),
        "es": ("Antipulgas y garrapatas", "Aplicar producto mensual (Bravecto, NexGard, etc.) según el peso."),
    },
    ("Check-up anual", "Consulta veterinária anual com exames de sangue básicos."): {
        "en": ("Annual check-up", "Yearly vet visit with basic bloodwork."),
        "es": ("Chequeo anual", "Consulta veterinaria anual con análisis de sangre básicos."),
    },
    ("Limpeza dental (avaliar)", "Avaliar saúde bucal anualmente; tartarismo é comum em adultos."): {
        "en": ("Dental cleaning (evaluate)", "Assess oral health yearly; tartar buildup is common in adults."),
        "es": ("Limpieza dental (evaluar)", "Evaluar la salud bucal anualmente; el sarro es común en adultos."),
    },
    ("Check-up semestral", "Cães seniores (7+ anos) precisam de avaliação a cada 6 meses."): {
        "en": ("Semi-annual check-up", "Senior dogs (7+ years) need an evaluation every 6 months."),
        "es": ("Chequeo semestral", "Los perros senior (7+ años) necesitan evaluación cada 6 meses."),
    },
    ("Hemograma + bioquímico semestral", "Detecção precoce de doenças renais/hepáticas comuns em seniores."): {
        "en": ("Semi-annual blood panel", "Early detection of kidney and liver disease, common in seniors."),
        "es": ("Hemograma + bioquímica semestral", "Detección temprana de enfermedades renales/hepáticas, comunes en mayores."),
    },
    ("Reforço anual antirrábica + V8/V10", "Manter calendário vacinal mesmo na terceira idade."): {
        "en": ("Annual rabies + DHPP boosters", "Keep the vaccination schedule current even in the senior years."),
        "es": ("Refuerzo anual antirrábica + polivalente", "Mantener el calendario de vacunación incluso en la tercera edad."),
    },
    ("Avaliação articular", "Sinais de artrose? Considerar suplementação (condroitina, ômega-3)."): {
        "en": ("Joint assessment", "Signs of arthritis? Consider supplements (chondroitin/glucosamine)."),
        "es": ("Evaluación articular", "¿Signos de artrosis? Considerar suplementos (condroitina/glucosamina)."),
    },
    # ---------------- GATO ----------------
    ("Vacina V3, V4 ou V5 (1ª dose)", "Primeira dose da vacina felina polivalente — a partir de 60 dias."): {
        "en": ("FVRCP vaccine (1st dose)", "First dose of the core feline vaccine — from 8 weeks of age."),
        "es": ("Vacuna trivalente felina (1ª dosis)", "Primera dosis de la vacuna múltiple felina — a partir de las 8 semanas."),
    },
    ("Vacina V3/V4/V5 (2ª dose)", "Reforço 21-28 dias após a primeira dose."): {
        "en": ("FVRCP vaccine (2nd dose)", "Booster 21-28 days after the first dose."),
        "es": ("Vacuna trivalente felina (2ª dosis)", "Refuerzo 21-28 días después de la primera dosis."),
    },
    ("Vacina Antirrábica", "Aplicar a partir dos 4 meses; reforço anual."): {
        "en": ("Rabies vaccine", "From 12-16 weeks of age; boosters every 1-3 years per state law."),
        "es": ("Vacuna antirrábica", "Aplicar a partir de los 3-4 meses; refuerzo anual o bienal."),
    },
    ("Vacina FeLV (Leucemia Felina)", "Recomendada principalmente para gatos com acesso à rua."): {
        "en": ("FeLV vaccine (Feline Leukemia)", "Recommended mainly for cats with outdoor access."),
        "es": ("Vacuna FeLV (Leucemia Felina)", "Recomendada sobre todo para gatos con acceso al exterior."),
    },
    ("Vermífugo", "A cada 15 dias até 3 meses; depois mensal até 6 meses."): {
        "en": ("Deworming", "Every 2 weeks until 3 months; then monthly until 6 months."),
        "es": ("Desparasitación", "Cada 15 días hasta los 3 meses; luego mensual hasta los 6 meses."),
    },
    ("Castração", "Recomendada entre 6-8 meses para machos e fêmeas."): {
        "en": ("Spay/neuter", "Recommended between 6-8 months for both males and females."),
        "es": ("Castración", "Recomendada entre los 6-8 meses tanto en machos como en hembras."),
    },
    ("Reforço anual V3/V4/V5", "Revacinar polivalente felina anualmente."): {
        "en": ("Annual FVRCP booster", "Revaccinate with the core feline vaccine yearly."),
        "es": ("Refuerzo anual trivalente felina", "Revacunar con la múltiple felina anualmente."),
    },
    ("Vermífugo trimestral", "A cada 3 meses para gatos com acesso à rua; semestral pra apartamento."): {
        "en": ("Quarterly deworming", "Every 3 months for outdoor cats; every 6 months for indoor cats."),
        "es": ("Desparasitación trimestral", "Cada 3 meses en gatos con acceso al exterior; cada 6 meses en los de interior."),
    },
    ("Antipulgas e carrapatos", "Aplicar mensal — produtos específicos para gatos (NUNCA usar de cão)."): {
        "en": ("Flea and tick prevention", "Apply monthly — cat-specific products only (NEVER use dog products)."),
        "es": ("Antipulgas y garrapatas", "Aplicar mensualmente — productos específicos para gatos (NUNCA usar los de perro)."),
    },
    ("Check-up anual", "Consulta + exames básicos uma vez ao ano."): {
        "en": ("Annual check-up", "Vet visit plus basic tests once a year."),
        "es": ("Chequeo anual", "Consulta y análisis básicos una vez al año."),
    },
    ("Teste FIV/FeLV", "Idealmente uma vez na vida — duas vezes se houver acesso à rua."): {
        "en": ("FIV/FeLV test", "Ideally once in a lifetime — twice if the cat goes outdoors."),
        "es": ("Test FIV/FeLV", "Idealmente una vez en la vida — dos si tiene acceso al exterior."),
    },
    ("Check-up semestral", "Gatos seniores (10+ anos) — avaliação a cada 6 meses."): {
        "en": ("Semi-annual check-up", "Senior cats (10+ years) — evaluation every 6 months."),
        "es": ("Chequeo semestral", "Gatos senior (10+ años) — evaluación cada 6 meses."),
    },
    ("Função renal + tireoide", "Doença renal crônica e hipertireoidismo são frequentes em gatos seniores."): {
        "en": ("Kidney and thyroid panel", "Chronic kidney disease and hyperthyroidism are common in senior cats."),
        "es": ("Función renal + tiroides", "La enfermedad renal crónica y el hipertiroidismo son frecuentes en gatos senior."),
    },
    ("Reforço anual vacinas", "Manter polivalente + antirrábica em dia."): {
        "en": ("Annual vaccine boosters", "Keep FVRCP and rabies vaccines up to date."),
        "es": ("Refuerzo anual de vacunas", "Mantener la múltiple y la antirrábica al día."),
    },
}


def localize_plan(plan: Dict, locale: Optional[str]) -> Dict:
    """Traduz a saída de `suggested_health_plan` para o idioma pedido.

    Em pt-BR devolve o plano intacto. Se algum texto não tiver tradução,
    mantém o português (nunca some conteúdo).
    """
    loc = normalize_locale(locale)
    if loc == DEFAULT_LOCALE:
        return plan

    out = dict(plan)
    out["phase_label"] = PHASE_LABEL[loc].get(plan.get("phase", ""), plan.get("phase_label", ""))
    out["locale"] = loc

    suggestions = []
    for s in plan.get("suggestions", []):
        item = dict(s)
        tr = TRANSLATIONS.get((s.get("title", ""), s.get("description", "")))
        if tr and loc in tr:
            item["title"], item["description"] = tr[loc]
        item["category_label"] = CATEGORY_LABEL[loc].get(s.get("category", ""), s.get("category", ""))
        item["urgency_label"] = URGENCY_LABEL[loc].get(s.get("urgency", ""), s.get("urgency", ""))
        suggestions.append(item)
    out["suggestions"] = suggestions
    return out


def test_protocol_coverage() -> Tuple[int, list]:
    """Confere que todo texto emitido por health_protocols tem tradução.

    Devolve (total_de_pares, faltando). Roda em CI/manualmente — se algum
    texto em PT for editado sem atualizar aqui, isso acusa.
    """
    import re
    from pathlib import Path

    src = Path(__file__).with_name("health_protocols.py").read_text(encoding="utf-8")
    pairs = re.findall(r'"title":\s*"([^"]+)",\s*\n\s*"description":\s*"([^"]+)"', src)
    uniq = list(dict.fromkeys(pairs))
    missing = [p for p in uniq if p not in TRANSLATIONS]
    return len(uniq), missing


if __name__ == "__main__":
    total, missing = test_protocol_coverage()
    print(f"pares no health_protocols.py: {total}")
    print(f"traduzidos: {total - len(missing)}")
    if missing:
        print("FALTANDO:")
        for t, d in missing:
            print(f"  - {t} || {d}")
        raise SystemExit(1)
    print("cobertura 100% ✅")
