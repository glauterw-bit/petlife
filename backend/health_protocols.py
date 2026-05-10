"""
Protocolos de saúde recomendados (cães e gatos) — sugestões automáticas
de vacinas, antiparasitários e check-ups baseado em espécie + idade.

Fontes: WSAVA Vaccination Guidelines (cães e gatos), CRMV-SP, AAHA.
Não substitui orientação veterinária presencial.
"""
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional


def _months_between(start: date, end: date) -> int:
    return (end.year - start.year) * 12 + (end.month - start.month)


def _to_date(d) -> Optional[date]:
    if d is None:
        return None
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    return None


def get_age_phase(species: str, birth_date) -> str:
    """Retorna 'puppy_kitten' | 'young' | 'adult' | 'senior' baseado em espécie+idade."""
    bd = _to_date(birth_date)
    if not bd:
        return "adult"
    today = date.today()
    age_months = _months_between(bd, today)

    if species == "dog":
        if age_months < 12:
            return "puppy_kitten"
        if age_months < 24:
            return "young"
        if age_months < 84:  # < 7 anos
            return "adult"
        return "senior"
    # cat
    if age_months < 12:
        return "puppy_kitten"
    if age_months < 24:
        return "young"
    if age_months < 120:  # < 10 anos
        return "adult"
    return "senior"


def suggested_health_plan(species: str, birth_date, has_vaccines: List[str]) -> Dict:
    """Retorna lista de protocolos sugeridos baseado em fase de vida + vacinas já aplicadas."""
    bd = _to_date(birth_date)
    today = date.today()
    age_months = _months_between(bd, today) if bd else None
    phase = get_age_phase(species, birth_date)
    has_lower = {v.lower() for v in (has_vaccines or [])}

    suggestions: List[Dict] = []

    if species == "dog":
        # Filhotes: V8/V10 (3 doses) entre 6-16 semanas + antirrábica aos 4 meses
        if phase == "puppy_kitten":
            if not any("v8" in v or "v10" in v or "polival" in v for v in has_lower):
                suggestions.append({
                    "title": "Vacina V8 ou V10 (1ª dose)",
                    "description": "Primeira dose da vacina polivalente — entre 6 e 8 semanas.",
                    "category": "vacina",
                    "urgency": "alta",
                })
                suggestions.append({
                    "title": "Vacina V8/V10 (2ª e 3ª doses)",
                    "description": "Reforços a cada 21-28 dias até completar 16 semanas.",
                    "category": "vacina",
                    "urgency": "alta",
                })
            if "antirrábica" not in has_lower and "antirabica" not in has_lower and "rabies" not in has_lower:
                if age_months is None or age_months >= 3:
                    suggestions.append({
                        "title": "Vacina Antirrábica",
                        "description": "A partir dos 4 meses de idade. Obrigatória por lei.",
                        "category": "vacina",
                        "urgency": "alta",
                    })
            suggestions.append({
                "title": "Vermífugo",
                "description": "Vermifugar a cada 15 dias até 3 meses, depois mensal até 6 meses.",
                "category": "vermífugo",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Castração (planejamento)",
                "description": "Conversar com o veterinário sobre castração entre 6-12 meses.",
                "category": "consulta",
                "urgency": "baixa",
            })
        elif phase in ("young", "adult"):
            suggestions.append({
                "title": "Reforço anual V8/V10",
                "description": "Revacinar polivalente uma vez por ano.",
                "category": "vacina",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Reforço anual antirrábica",
                "description": "Antirrábica deve ser reforçada anualmente.",
                "category": "vacina",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Vermífugo trimestral",
                "description": "Aplicar vermífugo a cada 3 meses.",
                "category": "vermífugo",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Antipulgas e carrapatos",
                "description": "Aplicar produto mensal (Bravecto, NexGard, etc.) de acordo com peso.",
                "category": "parasitas",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Check-up anual",
                "description": "Consulta veterinária anual com exames de sangue básicos.",
                "category": "consulta",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Limpeza dental (avaliar)",
                "description": "Avaliar saúde bucal anualmente; tartarismo é comum em adultos.",
                "category": "consulta",
                "urgency": "baixa",
            })
        elif phase == "senior":
            suggestions.append({
                "title": "Check-up semestral",
                "description": "Cães seniores (7+ anos) precisam de avaliação a cada 6 meses.",
                "category": "consulta",
                "urgency": "alta",
            })
            suggestions.append({
                "title": "Hemograma + bioquímico semestral",
                "description": "Detecção precoce de doenças renais/hepáticas comuns em seniores.",
                "category": "exame",
                "urgency": "alta",
            })
            suggestions.append({
                "title": "Reforço anual antirrábica + V8/V10",
                "description": "Manter calendário vacinal mesmo na terceira idade.",
                "category": "vacina",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Avaliação articular",
                "description": "Sinais de artrose? Considerar suplementação (condroitina, ômega-3).",
                "category": "consulta",
                "urgency": "media",
            })
    else:  # cat
        if phase == "puppy_kitten":
            if not any("v3" in v or "v4" in v or "v5" in v or "polival" in v for v in has_lower):
                suggestions.append({
                    "title": "Vacina V3, V4 ou V5 (1ª dose)",
                    "description": "Primeira dose da vacina felina polivalente — a partir de 60 dias.",
                    "category": "vacina",
                    "urgency": "alta",
                })
                suggestions.append({
                    "title": "Vacina V3/V4/V5 (2ª dose)",
                    "description": "Reforço 21-28 dias após a primeira dose.",
                    "category": "vacina",
                    "urgency": "alta",
                })
            if "antirrábica" not in has_lower and "antirabica" not in has_lower and "rabies" not in has_lower:
                if age_months is None or age_months >= 3:
                    suggestions.append({
                        "title": "Vacina Antirrábica",
                        "description": "Aplicar a partir dos 4 meses; reforço anual.",
                        "category": "vacina",
                        "urgency": "alta",
                    })
            if "felv" not in has_lower and "leucemia" not in has_lower:
                suggestions.append({
                    "title": "Vacina FeLV (Leucemia Felina)",
                    "description": "Recomendada principalmente para gatos com acesso à rua.",
                    "category": "vacina",
                    "urgency": "media",
                })
            suggestions.append({
                "title": "Vermífugo",
                "description": "A cada 15 dias até 3 meses; depois mensal até 6 meses.",
                "category": "vermífugo",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Castração",
                "description": "Recomendada entre 6-8 meses para machos e fêmeas.",
                "category": "consulta",
                "urgency": "media",
            })
        elif phase in ("young", "adult"):
            suggestions.append({
                "title": "Reforço anual V3/V4/V5",
                "description": "Revacinar polivalente felina anualmente.",
                "category": "vacina",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Reforço anual antirrábica",
                "description": "Antirrábica deve ser reforçada anualmente.",
                "category": "vacina",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Vermífugo trimestral",
                "description": "A cada 3 meses para gatos com acesso à rua; semestral pra apartamento.",
                "category": "vermífugo",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Antipulgas e carrapatos",
                "description": "Aplicar mensal — produtos específicos para gatos (NUNCA usar de cão).",
                "category": "parasitas",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Check-up anual",
                "description": "Consulta + exames básicos uma vez ao ano.",
                "category": "consulta",
                "urgency": "media",
            })
            suggestions.append({
                "title": "Teste FIV/FeLV",
                "description": "Idealmente uma vez na vida — duas vezes se houver acesso à rua.",
                "category": "exame",
                "urgency": "baixa",
            })
        elif phase == "senior":
            suggestions.append({
                "title": "Check-up semestral",
                "description": "Gatos seniores (10+ anos) — avaliação a cada 6 meses.",
                "category": "consulta",
                "urgency": "alta",
            })
            suggestions.append({
                "title": "Função renal + tireoide",
                "description": "Doença renal crônica e hipertireoidismo são frequentes em gatos seniores.",
                "category": "exame",
                "urgency": "alta",
            })
            suggestions.append({
                "title": "Reforço anual vacinas",
                "description": "Manter polivalente + antirrábica em dia.",
                "category": "vacina",
                "urgency": "media",
            })

    return {
        "phase": phase,
        "phase_label": {
            "puppy_kitten": "Filhote",
            "young": "Jovem (1-2 anos)",
            "adult": "Adulto",
            "senior": "Senior",
        }[phase],
        "age_months": age_months,
        "suggestions": suggestions,
    }
