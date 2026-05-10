import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlalchemy import select

from database import create_tables, settings
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
)


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3030,http://127.0.0.1:3030,http://localhost:3000,http://127.0.0.1:3000").split(",")

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


@app.get("/", tags=["Status"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
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
