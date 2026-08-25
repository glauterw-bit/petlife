"""Catálogo de planos, quotas e produtos IAP do PetLife.

Estratégia (decidida com o tutor):
  - Cobrança: Apple IAP only (iOS). Asaas/web pode ser adicionado depois.
  - 3 tiers: free / plus (PetLife+) / pro (PetLife Pro).
  - Trial de 30 dias nos planos mensais (configurado como introductory offer na ASC).

Quotas que importam (as features de IA são as caras — chamadas Claude):
  - pets:        nº de pets cadastrados (limite "ao vivo", não mensal)
  - ai_chat:     mensagens com a Vyron IA por mês
  - ai_analysis: análises de IA por mês (raça por foto, triagem, fezes, dor,
                 health forecast, bedtime story, vet scribe, etc.)

Tudo o que NÃO é IA fica ilimitado em todos os tiers (carteira de vacinas,
lembretes, clínicas próximas, passeios, gamificação, etc.).
"""
from __future__ import annotations

UNLIMITED = -1  # sentinela para quota ilimitada

# ─── Quotas por tier ──────────────────────────────────────────────────────────
QUOTAS: dict[str, dict[str, int]] = {
    # 3 pets no free: a média brasileira é 2,6 pets por domicílio (Abinpet 2025).
    # Com limite de 1, 92 dos 93 usuários com pet tinham exatamente um — batiam
    # no teto logo depois de cadastrar o primeiro, no pico do entusiasmo, e
    # paravam. Pet é o momento "aha" do app (83% cadastram); bloquear o segundo
    # mata o loop. A IA continua limitada, que é o custo real.
    "free": {"pets": 3, "ai_chat": 10, "ai_analysis": 3},
    "plus": {"pets": 5, "ai_chat": 100, "ai_analysis": 30},
    "pro":  {"pets": UNLIMITED, "ai_chat": UNLIMITED, "ai_analysis": UNLIMITED},
}

# Ranking pra comparar tiers (downgrade/upgrade)
TIER_RANK = {"free": 0, "plus": 1, "pro": 2}

# Nome amigável dos recursos (usado nas mensagens de erro)
RESOURCE_LABEL = {
    "pets": "pets",
    "ai_chat": "mensagens com a Vyron IA",
    "ai_analysis": "análises de IA",
}

# ─── Produtos (App Store Connect) ─────────────────────────────────────────────
# Bundle id do app = app.petlife. Product IDs seguem o padrão app.petlife.<tier>.<ciclo>.
PRODUCTS: list[dict] = [
    {
        "sku": "plus_monthly",
        "tier": "plus",
        "apple_product_id": "app.petlife.plus.monthly",
        "name": "PetLife+ Mensal",
        "price_brl": 14.90,
        "cadence": "monthly",
        "has_trial": True,   # 30 dias grátis
    },
    {
        "sku": "plus_annual",
        "tier": "plus",
        "apple_product_id": "app.petlife.plus.yearly",
        "name": "PetLife+ Anual",
        "price_brl": 149.00,
        "cadence": "annual",
        "has_trial": False,
    },
    {
        "sku": "pro_monthly",
        "tier": "pro",
        "apple_product_id": "app.petlife.pro.monthly",
        "name": "PetLife Pro Mensal",
        "price_brl": 29.90,
        "cadence": "monthly",
        "has_trial": True,   # 30 dias grátis
    },
    {
        "sku": "pro_annual",
        "tier": "pro",
        "apple_product_id": "app.petlife.pro.yearly",
        "name": "PetLife Pro Anual",
        "price_brl": 299.00,
        "cadence": "annual",
        "has_trial": False,
    },
]

# Índices derivados pra lookup rápido
_BY_APPLE_ID = {p["apple_product_id"]: p for p in PRODUCTS}
_BY_SKU = {p["sku"]: p for p in PRODUCTS}


def product_by_apple_id(apple_product_id: str) -> dict | None:
    return _BY_APPLE_ID.get(apple_product_id)


def product_by_sku(sku: str) -> dict | None:
    return _BY_SKU.get(sku)


def tier_for_apple_product(apple_product_id: str) -> str | None:
    p = _BY_APPLE_ID.get(apple_product_id)
    return p["tier"] if p else None


def quotas_for_tier(tier: str) -> dict[str, int]:
    return QUOTAS.get(tier, QUOTAS["free"])


def quota_limit(tier: str, resource: str) -> int:
    return quotas_for_tier(tier).get(resource, 0)
