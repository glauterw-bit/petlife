import base64
import unicodedata
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional

from database import get_db
from models import Breed
from schemas import BreedResponse
from auth import get_current_user
from models import User
import ai_service
import subscriptions

router = APIRouter(prefix="/breeds", tags=["Raças"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.get("", response_model=list[BreedResponse])
async def list_breeds(
    species: Optional[str] = Query(None, description="dog ou cat"),
    size: Optional[str] = Query(None, description="small, medium, large ou giant"),
    energy_level: Optional[int] = Query(None, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
):
    query = select(Breed)
    if species:
        query = query.where(Breed.species == species)
    if size:
        query = query.where(Breed.size == size)
    if energy_level:
        query = query.where(Breed.energy_level == energy_level)
    query = query.order_by(Breed.name)
    result = await db.execute(query)
    return result.scalars().all()


def _norm(s: str | None) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return " ".join(s.replace("-", " ").split())


# Como o tutor chama a raça no dia a dia → trecho do nome no catálogo.
# Sem isso, "vira-lata" (o pet mais comum do Brasil) não achava nada.
BREED_ALIASES = {
    "vira lata": "srd", "viralata": "srd", "vira lata caramelo": "srd",
    "caramelo": "srd", "mestico": "srd", "mesticos": "srd", "sem raca": "srd",
    "misturado": "srd", "comum": "srd", "domestico": "srd",
    "sagrado da birmania": "birmanes", "sagrado": "birmanes",
    "pomeranian": "pomerania",
    "salsicha": "dachshund", "basse": "dachshund", "linguica": "dachshund",
    "pit bull": "pitbull", "pitbul": "pitbull",
    "buldogue frances": "french bulldog", "bulldog frances": "french bulldog",
    "buldogue ingles": "bulldog ingles", "york": "yorkshire",
    "shitzu": "shih tzu", "shih tsu": "shih tzu",
}


@router.get("/search", response_model=list[BreedResponse])
async def search_breeds(
    q: str = Query(..., min_length=1, description="Termo de busca"),
    species: Optional[str] = Query(None, description="dog ou cat"),
    db: AsyncSession = Depends(get_db),
):
    # O catálogo tem poucas centenas de raças: filtrar em Python deixa a busca
    # sem acento ("raca" acha "Raça") e com apelidos, igual em SQLite e Postgres.
    term = _norm(q)
    if not term:
        return []
    alias = BREED_ALIASES.get(term)
    if alias is None:
        alias = next((v for k, v in BREED_ALIASES.items() if len(term) >= 4 and k.startswith(term)), None)
    query = select(Breed).order_by(Breed.name)
    if species in ("dog", "cat"):
        query = query.where(Breed.species == species)
    breeds = (await db.execute(query)).scalars().all()

    def hit(b: Breed, t: str) -> bool:
        return t in _norm(b.name) or t in _norm(b.name_en) or t in _norm(b.origin)

    found = [b for b in breeds if hit(b, term)]
    if alias:
        found += [b for b in breeds if b not in found and hit(b, alias)]
    # Quem começa com o termo vem primeiro ("pug" antes de "Puggle").
    found.sort(key=lambda b: (not _norm(b.name).startswith(term), not (alias and alias in _norm(b.name)), b.name))
    return found


@router.get("/{breed_id}", response_model=BreedResponse)
async def get_breed(breed_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Breed).where(Breed.id == breed_id))
    breed = result.scalar_one_or_none()
    if not breed:
        raise HTTPException(status_code=404, detail="Raça não encontrada")
    return breed


@router.post("/identify-from-photo")
async def identify_breed_from_photo(
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recebe uma foto e retorna top 3 raças candidatas via Claude Vision.
    Cada candidato vem com `breed_id` cruzando o catálogo do banco quando achado."""
    # Quota mensal de análises de IA (free: 3, plus: 30, pro: ∞)
    await subscriptions.check_quota(db, current_user, "ai_analysis")

    media_type = (photo.content_type or "image/jpeg").lower()
    if media_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagem inválido. Use JPG, PNG, WEBP ou GIF.")

    contents = await photo.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Imagem maior que 5 MB. Reduza e tente novamente.")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    b64 = base64.b64encode(contents).decode("ascii")

    try:
        result = await ai_service.identify_breed_from_image(b64, media_type)
    except Exception as e:
        msg = str(e).lower()
        if "credit balance" in msg or "insufficient" in msg or "billing" in msg:
            raise HTTPException(
                status_code=503,
                detail="Identificação por foto temporariamente indisponível. (Crédito da API esgotado)",
            )
        raise HTTPException(status_code=503, detail="Não foi possível identificar agora. Tente novamente.")

    await subscriptions.consume_quota(db, current_user, "ai_analysis")

    # Cruza candidatos com o catálogo de raças do banco para devolver breed_id
    candidates = result.get("candidates") or []
    # Sem filtrar a espécie, o "SRD" de um gato casava com o SRD de cachorro.
    detected_species = {"dog": "dog", "cachorro": "dog", "cão": "dog", "cat": "cat", "gato": "cat"}.get(
        str(result.get("species") or "").strip().lower()
    )
    enriched = []
    for c in candidates:
        breed_id = None
        breed_name = (c.get("breed") or "").strip()
        if breed_name:
            conds = [or_(Breed.name.ilike(breed_name), Breed.name_en.ilike(c.get("name_en") or breed_name))]
            if detected_species:
                conds.append(Breed.species == detected_species)
            row = await db.execute(select(Breed.id, Breed.name).where(*conds).limit(1))
            r = row.first()
            if r:
                breed_id = r[0]
        enriched.append({**c, "breed_id": breed_id})

    return {
        "species": result.get("species"),
        "candidates": enriched,
        "is_mixed_likely": result.get("is_mixed_likely", False),
        "notes": result.get("notes", ""),
    }


@router.get("/pet/{pet_id}/health-suggestions")
async def pet_health_suggestions(
    pet_id: int,
    request: Request,
    lang: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sugestões automáticas de vacinas/check-ups baseado em espécie + idade.
    Cruza com vacinas já aplicadas para não sugerir o que já foi feito."""
    from models import Pet, Vaccine, pet_accessible_filter
    from health_protocols import suggested_health_plan
    import health_protocols_i18n

    result = await db.execute(select(Pet).where(Pet.id == pet_id, pet_accessible_filter(current_user.id)))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet não encontrado")

    vac_result = await db.execute(select(Vaccine.name).where(Vaccine.pet_id == pet_id))
    has_vaccines = [r[0] for r in vac_result.all()]

    plan = suggested_health_plan(pet.species.value if hasattr(pet.species, "value") else pet.species, pet.birth_date, has_vaccines)
    # Idioma: ?lang= tem prioridade; senão cai no Accept-Language do aparelho.
    locale = health_protocols_i18n.normalize_locale(lang) if lang else \
        health_protocols_i18n.locale_from_header(request.headers.get("accept-language"))
    plan = health_protocols_i18n.localize_plan(plan, locale)
    return {"pet_id": pet_id, "pet_name": pet.name, **plan}


@router.get("/{breed_id}/care-guide")
async def get_breed_care_guide(
    breed_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Breed).where(Breed.id == breed_id))
    breed = result.scalar_one_or_none()
    if not breed:
        raise HTTPException(status_code=404, detail="Raça não encontrada")

    breed_info = {
        "name": breed.name,
        "species": breed.species,
        "size": breed.size,
        "energy_level": breed.energy_level,
        "grooming_level": breed.grooming_level,
        "health_issues": breed.health_issues or [],
        "exercise_needs": breed.exercise_needs,
        "temperament": breed.temperament or [],
        "feeding_guide": breed.feeding_guide,
    }

    pet_info = {
        "name": "Seu pet",
        "age": "adulto",
        "weight": None,
        "neutered": False,
        "gender": None,
    }

    import health_protocols_i18n
    locale = health_protocols_i18n.locale_from_header(request.headers.get("accept-language"))
    guide = await ai_service.generate_care_guide(breed_info, pet_info, locale=locale)
    return {"breed_id": breed_id, "breed_name": breed.name, "care_guide": guide}
