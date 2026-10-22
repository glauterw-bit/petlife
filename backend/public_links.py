"""Resolve o pet das páginas públicas (carteirinha, pet perdido, retrospectiva).

Os links novos usam `Pet.public_token`, aleatório. Os antigos usam o id
numérico e continuam funcionando, porque já há QRs de coleira impressos e
carteirinhas enviadas a hotéis e creches com eles; o acesso por id tem um
limite de taxa mais baixo nas rotas, para não dar para percorrer a base.
"""
from sqlalchemy import select

from models import Pet


def is_legacy_id(key: str) -> bool:
    return key.isdigit()


def pet_filter(key: str):
    return Pet.id == int(key) if is_legacy_id(key) else Pet.public_token == key


async def find_pet(db, key: str, *options):
    q = select(Pet).where(pet_filter(key))
    if options:
        q = q.options(*options)
    return (await db.execute(q)).scalar_one_or_none()


def first_name(name: str | None) -> str:
    return (name or "").strip().split(" ")[0]


def mask_microchip(chip: str | None) -> str | None:
    if not chip:
        return None
    c = chip.strip()
    return ("•" * max(len(c) - 4, 0)) + c[-4:] if len(c) > 4 else c
