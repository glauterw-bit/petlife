import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlalchemy import select
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import create_tables, settings

# ─── Sentry (error tracking) ──────────────────────────────────────────────────
# Configure SENTRY_DSN env var em produção pra ativar.
_SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if _SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.1")),
        environment=os.getenv("RAILWAY_ENVIRONMENT_NAME", "production"),
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        send_default_pii=False,  # LGPD-friendly: nao envia user_id, email etc por padrao
    )

# ─── Rate Limiting ────────────────────────────────────────────────────────────
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["300/minute"],  # default por IP — generoso, evita abuse simples
    storage_uri=os.getenv("RATE_LIMIT_REDIS_URL", "memory://"),
)
from routers import (
    auth_router,
    pets,
    breeds,
    vaccines,
    exams,
    anamnesis,
    routines,
    gamification,
    reminders,
    search,
    vet_portal,
    ai_chat,
    lost_pet,
    innovations,
    walks,
    notifications,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # SEGURANÇA: refuse-to-boot se config insegura em produção
    is_prod = os.getenv("RAILWAY_ENVIRONMENT_NAME") == "production"
    if is_prod:
        if "change-in-production" in (settings.SECRET_KEY or "") or len(settings.SECRET_KEY or "") < 32:
            raise RuntimeError(
                "SECRET_KEY inseguro em produção. Configure SECRET_KEY (>=32 chars, gerado aleatoriamente) "
                "nas variáveis de ambiente do Railway."
            )
        # CORS sem localhost em prod
        bad_origins = [o for o in ALLOWED_ORIGINS if "localhost" in o or "127.0.0.1" in o]
        if bad_origins:
            print(f"⚠️ AVISO: CORS contém origens locais em produção: {bad_origins}")

    await create_tables()

    from seed import seed_breeds, seed_challenges
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        await seed_breeds(session)
        await seed_challenges(session)

    upload_dir = settings.UPLOAD_DIR
    for subdir in ["pets", "vaccines", "exams", "avatars"]:
        os.makedirs(os.path.join(upload_dir, subdir), exist_ok=True)

    print(f"PetLife backend iniciado na porta {settings.PORT}")
    yield
    print("PetLife backend encerrado.")


app = FastAPI(
    title="PetLife API",
    description=(
        "Sistema completo de gestão de saúde para pets com IA. "
        "Gerencie vacinas, exames, anamneses, rotinas de passeio e mais."
    ),
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3030,http://127.0.0.1:3030,http://localhost:3000,http://127.0.0.1:3000").split(",")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_dir = settings.UPLOAD_DIR
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

app.include_router(auth_router.router)
app.include_router(pets.router)
app.include_router(breeds.router)
app.include_router(vaccines.router)
app.include_router(exams.router)
app.include_router(anamnesis.router)
app.include_router(routines.router)
app.include_router(gamification.router)
app.include_router(reminders.router)
app.include_router(search.router)
app.include_router(vet_portal.router)
app.include_router(ai_chat.router)
app.include_router(lost_pet.router)
app.include_router(innovations.router)
app.include_router(walks.router)
app.include_router(notifications.router)


@app.get("/public/lost/{pet_id}", tags=["Público"])
async def public_lost_pet_endpoint(pet_id: int):
    """QR-tag físico na coleira aponta pra essa URL."""
    return await lost_pet.public_lost_pet(pet_id)


@app.get("/", tags=["Status"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.1.0",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/public/carteirinha/{pet_id}", tags=["Público"])
async def public_vaccination_card(pet_id: int):
    from database import AsyncSessionLocal
    from models import Pet, User as UserModel
    from sqlalchemy.orm import selectinload
    from datetime import datetime

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Pet)
            .options(selectinload(Pet.breed), selectinload(Pet.vaccines), selectinload(Pet.owner))
            .where(Pet.id == pet_id)
        )
        pet = result.scalar_one_or_none()
        if not pet:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Pet não encontrado")

        vaccines_sorted = sorted(pet.vaccines, key=lambda v: v.date_given, reverse=True)

        return {
            "pet": {
                "id": pet.id,
                "name": pet.name,
                "species": pet.species,
                "breed": pet.breed.name if pet.breed else None,
                "birth_date": pet.birth_date.isoformat() if pet.birth_date else None,
                "weight": pet.weight,
                "color": pet.color,
                "gender": pet.gender,
                "neutered": pet.neutered,
                "microchip": pet.microchip,
                "photo": pet.photo,
            },
            "owner": {
                "name": pet.owner.name,
            },
            "vaccines": [
                {
                    "id": v.id,
                    "name": v.name,
                    "date_given": v.date_given.isoformat(),
                    "next_due": v.next_due.isoformat() if v.next_due else None,
                    "lot_number": v.lot_number,
                    "veterinarian": v.veterinarian,
                    "notes": v.notes,
                }
                for v in vaccines_sorted
            ],
            "generated_at": datetime.utcnow().isoformat(),
        }


@app.get("/health", tags=["Status"])
async def health_check():
    return JSONResponse(
        content={
            "status": "healthy",
            "app": settings.APP_NAME,
            "port": settings.PORT,
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        log_level="info",
    )
