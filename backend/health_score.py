"""
Pet Health Score — score 0-100 atualizado diariamente, cruzando 5 dimensões:
  1. Vacinação (em dia?)         peso 25
  2. Peso/condição corporal      peso 20
  3. Atividade (passeios)        peso 25
  4. Bem-estar (behavior logs)   peso 20
  5. Consistência de cuidado     peso 10

Não é diagnóstico — é um indicador de engajamento + saúde preventiva.
Cada dimensão retorna 0-1; o score final é a soma ponderada * 100.

Funções puras (sem I/O) pra facilitar teste. O router monta os inputs.
"""
from __future__ import annotations
from datetime import datetime, timedelta, date
from typing import Optional


# ─── Pesos das dimensões (somam 100) ─────────────────────────────────────────
WEIGHTS = {
    "vaccination": 25,
    "weight": 20,
    "activity": 25,
    "wellbeing": 20,
    "consistency": 10,
}


def _to_date(d) -> Optional[date]:
    if d is None:
        return None
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    return None


def _age_months(birth_date, today: date) -> Optional[int]:
    bd = _to_date(birth_date)
    if not bd:
        return None
    return (today.year - bd.year) * 12 + (today.month - bd.month)


# ─── Dimensão 1: Vacinação ───────────────────────────────────────────────────
def score_vaccination(next_due_dates: list, today: date) -> tuple[float, str]:
    """next_due_dates: lista de datas de próxima dose (datetime/date), pode ter None.
    Penaliza vacinas vencidas; bonifica quem está em dia."""
    dues = [_to_date(d) for d in next_due_dates if d is not None]
    if not dues:
        # sem registro de vacina → score neutro-baixo (incentiva cadastrar)
        return 0.5, "Cadastre as vacinas pra acompanhar a imunização"
    overdue = [d for d in dues if d < today]
    soon = [d for d in dues if today <= d <= today + timedelta(days=14)]
    if overdue:
        # cada vacina vencida derruba bastante
        penalty = min(1.0, 0.35 * len(overdue))
        return max(0.0, 0.7 - penalty), f"{len(overdue)} vacina(s) vencida(s) — agende o reforço"
    if soon:
        return 0.85, f"{len(soon)} vacina(s) vencendo em breve"
    return 1.0, "Vacinação em dia ✓"


# ─── Dimensão 2: Peso / condição corporal ────────────────────────────────────
def score_weight(body_condition_score: Optional[int], weight_trend: Optional[str],
                 has_weight_record: bool) -> tuple[float, str]:
    """body_condition_score: 1-9 (WSAVA BCS). Ideal = 4-5.
    weight_trend: 'stable' | 'up' | 'down' | None."""
    if not has_weight_record:
        return 0.5, "Registre o peso pra acompanhar a condição corporal"
    if body_condition_score is not None:
        if 4 <= body_condition_score <= 5:
            return 1.0, "Peso ideal ✓"
        if body_condition_score in (3, 6):
            return 0.75, "Condição corporal levemente fora do ideal"
        if body_condition_score in (2, 7):
            return 0.5, "Atenção ao peso — fora da faixa ideal"
        return 0.3, "Condição corporal precisa de cuidado veterinário"
    # sem BCS mas tem peso registrado: usa só a tendência
    if weight_trend == "stable":
        return 0.85, "Peso estável"
    if weight_trend in ("up", "down"):
        return 0.7, "Variação de peso recente — fique de olho"
    return 0.8, "Peso registrado"


# ─── Dimensão 3: Atividade (passeios) ────────────────────────────────────────
def score_activity(walks_last_7d: int, total_distance_7d_m: float,
                   species: str, energy_level: Optional[int]) -> tuple[float, str]:
    """Meta de passeios/semana ajustada por espécie + energia da raça.
    Gato: meta menor (brincadeira). Cão de alta energia: meta maior."""
    if species == "cat":
        target_walks = 3
    else:
        # cão: base 5, ajusta pela energia (1-5)
        e = energy_level or 3
        target_walks = 4 + e  # energia 1→5 passeios, energia 5→9
    ratio = min(1.0, walks_last_7d / target_walks) if target_walks else 0.0
    if walks_last_7d == 0:
        return 0.2, "Nenhum passeio essa semana — que tal sair hoje?"
    if ratio >= 1.0:
        return 1.0, f"{walks_last_7d} passeios essa semana ✓"
    if ratio >= 0.6:
        return 0.8, f"{walks_last_7d} passeios — quase na meta"
    return 0.5, f"{walks_last_7d} passeios — pode passear mais"


# ─── Dimensão 4: Bem-estar (behavior logs) ───────────────────────────────────
_MOOD_SCORE = {
    "feliz": 1.0, "happy": 1.0,
    "neutro": 0.7, "normal": 0.7,
    "agitado": 0.5,
    "ansioso": 0.4,
    "apatico": 0.25, "apático": 0.25,
}


def score_wellbeing(recent_moods: list[str], recent_appetite: list[str],
                    logs_count_7d: int) -> tuple[float, str]:
    """recent_moods: humores dos últimos logs (mais recente primeiro)."""
    if logs_count_7d == 0:
        return 0.5, "Faça um check-in diário pra acompanhar o bem-estar"
    mood_vals = [_MOOD_SCORE.get((m or "").lower(), 0.6) for m in recent_moods]
    avg_mood = sum(mood_vals) / len(mood_vals) if mood_vals else 0.6
    # alerta se apetite ruim recorrente
    bad_appetite = sum(1 for a in recent_appetite if a in ("reduzido", "recusou"))
    if bad_appetite >= 2:
        return min(avg_mood, 0.5), "Apetite reduzido nos últimos dias — atenção"
    if avg_mood >= 0.85:
        return avg_mood, "Bem-estar ótimo ✓"
    if avg_mood >= 0.6:
        return avg_mood, "Bem-estar estável"
    return avg_mood, "Humor pra baixo — observe sinais"


# ─── Dimensão 5: Consistência de cuidado ─────────────────────────────────────
def score_consistency(active_days_14d: int) -> tuple[float, str]:
    """active_days_14d: quantos dias (de 14) tiveram alguma atividade
    (passeio, peso, check-in, foto). Recompensa o hábito."""
    ratio = min(1.0, active_days_14d / 10)  # 10+ dias ativos = nota cheia
    if active_days_14d == 0:
        return 0.2, "Comece a registrar o dia a dia do seu pet"
    if ratio >= 1.0:
        return 1.0, f"{active_days_14d} dias ativos — que constância! ✓"
    if ratio >= 0.5:
        return 0.7, f"{active_days_14d} dias ativos nas últimas 2 semanas"
    return 0.45, f"{active_days_14d} dias ativos — tente manter o hábito"


# ─── Agregação ───────────────────────────────────────────────────────────────
def compute_health_score(dimensions: dict[str, tuple[float, str]]) -> dict:
    """dimensions: {nome: (score_0_1, mensagem)}. Retorna score final + breakdown."""
    total = 0.0
    breakdown = []
    for key, weight in WEIGHTS.items():
        val, msg = dimensions.get(key, (0.5, ""))
        val = max(0.0, min(1.0, val))
        contribution = val * weight
        total += contribution
        breakdown.append({
            "key": key,
            "label": _LABELS[key],
            "score": round(val * 100),
            "weight": weight,
            "points": round(contribution, 1),
            "message": msg,
            "status": _status_for(val),
        })
    final = round(total)
    return {
        "score": final,
        "grade": _grade(final),
        "tier": _tier(final),
        "breakdown": breakdown,
    }


_LABELS = {
    "vaccination": "Vacinação",
    "weight": "Peso & corpo",
    "activity": "Atividade",
    "wellbeing": "Bem-estar",
    "consistency": "Constância",
}


def _status_for(v: float) -> str:
    if v >= 0.8:
        return "great"
    if v >= 0.6:
        return "good"
    if v >= 0.4:
        return "warn"
    return "bad"


def _grade(score: int) -> str:
    if score >= 90:
        return "A+"
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 55:
        return "C"
    if score >= 40:
        return "D"
    return "E"


def _tier(score: int) -> str:
    if score >= 80:
        return "excelente"
    if score >= 60:
        return "saudavel"
    if score >= 40:
        return "atencao"
    return "cuidado"
