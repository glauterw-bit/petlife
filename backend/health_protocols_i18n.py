"""
Textos localizados dos protocolos de saúde (pt-BR / en / es).

Por que existe: a LÓGICA dos protocolos (idade → o que é recomendado) segue as
diretrizes WSAVA e é internacionalmente válida, mas a NOMENCLATURA muda por
país e traduzir ao pé da letra seria errado:

  cão, polivalente : BR "V8/V10"  · US "DHPP/DA2PP"      · ES "polivalente/séxtuple"
  gato, polivalente: BR "V3/V4/V5" · US "FVRCP"           · ES "trivalente felina"
  raiva            : BR anual      · US 1–3 anos (varia por estado, é lei) · ES anual/bienal

Um tutor americano que lê "vacina V10" não entende; um brasileiro que lê "DHPP"
também não. Por isso cada idioma tem o termo que o veterinário local usa.

Não substitui orientação veterinária presencial.
"""
from typing import Dict, Optional

DEFAULT_LOCALE = "pt-BR"
SUPPORTED = ("pt-BR", "en", "es")


def normalize_locale(loc: Optional[str]) -> str:
    """Aceita 'pt', 'pt-BR', 'en-US', 'es-MX'… e devolve um locale suportado."""
    if not loc:
        return DEFAULT_LOCALE
    l = loc.lower()
    if l.startswith("pt"):
        return "pt-BR"
    if l.startswith("es"):
        return "es"
    if l.startswith("en"):
        return "en"
    return DEFAULT_LOCALE


# ── Rótulos de apoio ─────────────────────────────────────────────────────
PHASE_LABEL: Dict[str, Dict[str, str]] = {
    "pt-BR": {
        "puppy_kitten": "Filhote",
        "young": "Jovem (1-2 anos)",
        "adult": "Adulto",
        "senior": "Senior",
    },
    "en": {
        "puppy_kitten": "Puppy/Kitten",
        "young": "Young (1-2 years)",
        "adult": "Adult",
        "senior": "Senior",
    },
    "es": {
        "puppy_kitten": "Cachorro",
        "young": "Joven (1-2 años)",
        "adult": "Adulto",
        "senior": "Senior",
    },
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


# ── Catálogo de protocolos ───────────────────────────────────────────────
# chave -> locale -> (título, descrição)
PROTOCOLS: Dict[str, Dict[str, Dict[str, str]]] = {
    # ---------- CÃO: filhote ----------
    "dog.puppy.core1": {
        "pt-BR": {"t": "Vacina V8 ou V10 (1ª dose)", "d": "Primeira dose da vacina polivalente — entre 6 e 8 semanas."},
        "en": {"t": "DHPP vaccine (1st dose)", "d": "First core combination vaccine — between 6 and 8 weeks of age."},
        "es": {"t": "Vacuna polivalente (1ª dosis)", "d": "Primera dosis de la vacuna múltiple — entre las 6 y 8 semanas."},
    },
    "dog.puppy.core23": {
        "pt-BR": {"t": "Vacina V8/V10 (2ª e 3ª doses)", "d": "Reforços a cada 21-28 dias até completar 16 semanas."},
        "en": {"t": "DHPP vaccine (2nd and 3rd doses)", "d": "Boosters every 21-28 days until 16 weeks of age."},
        "es": {"t": "Vacuna polivalente (2ª y 3ª dosis)", "d": "Refuerzos cada 21-28 días hasta las 16 semanas."},
    },
    "dog.puppy.rabies": {
        "pt-BR": {"t": "Vacina Antirrábica", "d": "A partir de 4 meses de idade. Obrigatória e anual no Brasil."},
        "en": {"t": "Rabies vaccine", "d": "From 12-16 weeks of age. Required by law in most areas; boosters every 1-3 years depending on your state."},
        "es": {"t": "Vacuna Antirrábica", "d": "A partir de los 3-4 meses. Obligatoria en la mayoría de los países; refuerzo anual o bienal según la región."},
    },
    "dog.puppy.deworm": {
        "pt-BR": {"t": "Vermífugo", "d": "Filhotes: a cada 15 dias até 3 meses, depois mensal até 6 meses."},
        "en": {"t": "Deworming", "d": "Puppies: every 2 weeks until 3 months, then monthly until 6 months."},
        "es": {"t": "Desparasitante", "d": "Cachorros: cada 15 días hasta los 3 meses, luego mensual hasta los 6 meses."},
    },
    "dog.puppy.neuter": {
        "pt-BR": {"t": "Castração (planejamento)", "d": "Converse com o veterinário sobre o melhor momento — geralmente entre 6 e 12 meses."},
        "en": {"t": "Spay/neuter (planning)", "d": "Discuss timing with your vet — usually between 6 and 12 months."},
        "es": {"t": "Castración (planificación)", "d": "Consulta con el veterinario el mejor momento — generalmente entre los 6 y 12 meses."},
    },
    # ---------- CÃO: adulto/jovem ----------
    "dog.core.annual": {
        "pt-BR": {"t": "Reforço anual V8/V10", "d": "Manter a polivalente em dia protege contra cinomose, parvovirose e leptospirose."},
        "en": {"t": "Annual DHPP booster", "d": "Keeping the core vaccine current protects against distemper, parvovirus and hepatitis."},
        "es": {"t": "Refuerzo anual polivalente", "d": "Mantener la vacuna múltiple al día protege contra moquillo, parvovirus y leptospirosis."},
    },
    "dog.rabies.annual": {
        "pt-BR": {"t": "Reforço anual antirrábica", "d": "Dose anual obrigatória no Brasil."},
        "en": {"t": "Rabies booster", "d": "Every 1-3 years depending on the vaccine and your state law."},
        "es": {"t": "Refuerzo antirrábico", "d": "Anual o bienal según la normativa local."},
    },
    "dog.rabies_core.annual": {
        "pt-BR": {"t": "Reforço anual antirrábica + V8/V10", "d": "Manter o calendário vacinal completo em dia."},
        "en": {"t": "Annual rabies + DHPP boosters", "d": "Keep the full vaccination schedule up to date."},
        "es": {"t": "Refuerzo anual antirrábica + polivalente", "d": "Mantener el calendario de vacunación completo al día."},
    },
    "deworm.quarterly": {
        "pt-BR": {"t": "Vermífugo trimestral", "d": "Adultos: a cada 3-4 meses, ou conforme orientação do veterinário."},
        "en": {"t": "Quarterly deworming", "d": "Adults: every 3-4 months, or as advised by your vet."},
        "es": {"t": "Desparasitación trimestral", "d": "Adultos: cada 3-4 meses, o según indicación veterinaria."},
    },
    "flea.tick": {
        "pt-BR": {"t": "Antipulgas e carrapatos", "d": "Aplicação mensal — previne também doenças transmitidas por carrapato."},
        "en": {"t": "Flea and tick prevention", "d": "Monthly application — also prevents tick-borne diseases."},
        "es": {"t": "Antipulgas y garrapatas", "d": "Aplicación mensual — también previene enfermedades transmitidas por garrapatas."},
    },
    "checkup.annual": {
        "pt-BR": {"t": "Check-up anual", "d": "Consulta de rotina uma vez por ano para adultos saudáveis."},
        "en": {"t": "Annual check-up", "d": "Routine visit once a year for healthy adults."},
        "es": {"t": "Chequeo anual", "d": "Consulta de rutina una vez al año para adultos sanos."},
    },
    "dental": {
        "pt-BR": {"t": "Limpeza dental (avaliar)", "d": "Tártaro é comum a partir dos 3 anos — peça avaliação na consulta."},
        "en": {"t": "Dental cleaning (evaluate)", "d": "Tartar is common from age 3 — ask for an assessment at the next visit."},
        "es": {"t": "Limpieza dental (evaluar)", "d": "El sarro es común a partir de los 3 años — solicita evaluación en la consulta."},
    },
    "checkup.semiannual": {
        "pt-BR": {"t": "Check-up semestral", "d": "Pets seniores — avaliação a cada 6 meses."},
        "en": {"t": "Semi-annual check-up", "d": "Senior pets — evaluation every 6 months."},
        "es": {"t": "Chequeo semestral", "d": "Mascotas senior — evaluación cada 6 meses."},
    },
    "bloodwork.semiannual": {
        "pt-BR": {"t": "Hemograma + bioquímico semestral", "d": "Detecta precocemente alterações renais, hepáticas e anemia."},
        "en": {"t": "Semi-annual blood panel", "d": "Detects kidney, liver changes and anemia early."},
        "es": {"t": "Hemograma + bioquímica semestral", "d": "Detecta tempranamente alteraciones renales, hepáticas y anemia."},
    },
    "joints": {
        "pt-BR": {"t": "Avaliação articular", "d": "Artrose é frequente em cães idosos — avalie mobilidade e dor."},
        "en": {"t": "Joint assessment", "d": "Arthritis is common in senior dogs — evaluate mobility and pain."},
        "es": {"t": "Evaluación articular", "d": "La artrosis es frecuente en perros mayores — evalúa movilidad y dolor."},
    },
    # ---------- GATO ----------
    "cat.kitten.core1": {
        "pt-BR": {"t": "Vacina V3, V4 ou V5 (1ª dose)", "d": "Primeira dose da polivalente felina — a partir de 8 semanas."},
        "en": {"t": "FVRCP vaccine (1st dose)", "d": "First core feline vaccine — from 8 weeks of age."},
        "es": {"t": "Vacuna trivalente felina (1ª dosis)", "d": "Primera dosis de la vacuna múltiple felina — a partir de las 8 semanas."},
    },
    "cat.kitten.core2": {
        "pt-BR": {"t": "Vacina V3/V4/V5 (2ª dose)", "d": "Reforço 21-28 dias após a primeira dose."},
        "en": {"t": "FVRCP vaccine (2nd dose)", "d": "Booster 21-28 days after the first dose."},
        "es": {"t": "Vacuna trivalente felina (2ª dosis)", "d": "Refuerzo 21-28 días después de la primera dosis."},
    },
    "cat.rabies": {
        "pt-BR": {"t": "Vacina Antirrábica", "d": "A partir de 4 meses de idade. Anual no Brasil."},
        "en": {"t": "Rabies vaccine", "d": "From 12-16 weeks of age. Required by law in most states; boosters every 1-3 years."},
        "es": {"t": "Vacuna Antirrábica", "d": "A partir de los 3-4 meses. Refuerzo anual o bienal según la región."},
    },
    "cat.felv": {
        "pt-BR": {"t": "Vacina FeLV (Leucemia Felina)", "d": "Recomendada para gatos com acesso à rua. Testar antes de vacinar."},
        "en": {"t": "FeLV vaccine (Feline Leukemia)", "d": "Recommended for cats with outdoor access. Test before vaccinating."},
        "es": {"t": "Vacuna FeLV (Leucemia Felina)", "d": "Recomendada para gatos con acceso al exterior. Realizar test antes de vacunar."},
    },
    "cat.neuter": {
        "pt-BR": {"t": "Castração", "d": "Recomendada entre 6 e 8 meses — previne doenças e comportamentos indesejados."},
        "en": {"t": "Spay/neuter", "d": "Recommended between 6 and 8 months — prevents disease and unwanted behaviors."},
        "es": {"t": "Castración", "d": "Recomendada entre los 6 y 8 meses — previene enfermedades y conductas no deseadas."},
    },
    "cat.core.annual": {
        "pt-BR": {"t": "Reforço anual V3/V4/V5", "d": "Manter a polivalente felina em dia."},
        "en": {"t": "Annual FVRCP booster", "d": "Keep the core feline vaccine up to date."},
        "es": {"t": "Refuerzo anual trivalente felina", "d": "Mantener la vacuna múltiple felina al día."},
    },
    "cat.fiv_felv_test": {
        "pt-BR": {"t": "Teste FIV/FeLV", "d": "Recomendado ao menos uma vez, principalmente para gatos com acesso à rua."},
        "en": {"t": "FIV/FeLV test", "d": "Recommended at least once, especially for cats with outdoor access."},
        "es": {"t": "Test FIV/FeLV", "d": "Recomendado al menos una vez, sobre todo en gatos con acceso al exterior."},
    },
    "cat.senior.checkup": {
        "pt-BR": {"t": "Check-up semestral", "d": "Gatos seniores (10+ anos) — avaliação a cada 6 meses."},
        "en": {"t": "Semi-annual check-up", "d": "Senior cats (10+ years) — evaluation every 6 months."},
        "es": {"t": "Chequeo semestral", "d": "Gatos senior (10+ años) — evaluación cada 6 meses."},
    },
    "cat.senior.kidney": {
        "pt-BR": {"t": "Função renal + tireoide", "d": "Doença renal crônica e hipertireoidismo são frequentes em gatos seniores."},
        "en": {"t": "Kidney and thyroid panel", "d": "Chronic kidney disease and hyperthyroidism are common in senior cats."},
        "es": {"t": "Función renal + tiroides", "d": "La enfermedad renal crónica y el hipertiroidismo son frecuentes en gatos senior."},
    },
    "cat.vaccines.annual": {
        "pt-BR": {"t": "Reforço anual vacinas", "d": "Manter polivalente + antirrábica em dia."},
        "en": {"t": "Annual vaccine boosters", "d": "Keep FVRCP + rabies up to date."},
        "es": {"t": "Refuerzo anual de vacunas", "d": "Mantener la múltiple + antirrábica al día."},
    },
}


def text(key: str, locale: str) -> Dict[str, str]:
    """Devolve {'t': título, 'd': descrição} do protocolo no idioma pedido."""
    loc = normalize_locale(locale)
    entry = PROTOCOLS.get(key)
    if not entry:
        return {"t": key, "d": ""}
    return entry.get(loc) or entry[DEFAULT_LOCALE]


def phase_label(phase: str, locale: str) -> str:
    loc = normalize_locale(locale)
    return PHASE_LABEL.get(loc, PHASE_LABEL[DEFAULT_LOCALE]).get(phase, phase)
