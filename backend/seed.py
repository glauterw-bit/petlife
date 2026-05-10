"""
Script de seed para popular o banco de dados com raças e desafios de gamificação.
Execute: python seed.py
"""
import asyncio
from sqlalchemy import select
from database import AsyncSessionLocal, engine
from models import Base, Breed, Challenge
from breeds_data import ALL_BREEDS


CHALLENGES = [
    {
        "title": "Primeiro Passeio",
        "description": "Registre o primeiro passeio do seu pet no PetLife.",
        "category": "passeio",
        "points": 10,
        "badge_icon": "paw",
        "difficulty": "fácil",
        "requirements": {"walks": 1},
    },
    {
        "title": "7 Dias de Caminhada",
        "description": "Faça caminhadas por 7 dias consecutivos com seu pet.",
        "category": "passeio",
        "points": 50,
        "badge_icon": "calendar-check",
        "difficulty": "médio",
        "requirements": {"consecutive_days": 7},
    },
    {
        "title": "30 Dias de Caminhada",
        "description": "Mantenha a rotina de caminhadas por 30 dias.",
        "category": "passeio",
        "points": 200,
        "badge_icon": "trophy",
        "difficulty": "difícil",
        "requirements": {"consecutive_days": 30},
    },
    {
        "title": "Vacinas em Dia",
        "description": "Mantenha todas as vacinas do seu pet em dia.",
        "category": "saúde",
        "points": 100,
        "badge_icon": "syringe",
        "difficulty": "médio",
        "requirements": {"vaccines_up_to_date": True},
    },
    {
        "title": "Primeira Vacina Registrada",
        "description": "Registre a primeira vacina do seu pet.",
        "category": "saúde",
        "points": 20,
        "badge_icon": "shield-check",
        "difficulty": "fácil",
        "requirements": {"vaccines": 1},
    },
    {
        "title": "Exame Anual Realizado",
        "description": "Registre o exame anual de saúde do seu pet.",
        "category": "saúde",
        "points": 80,
        "badge_icon": "stethoscope",
        "difficulty": "médio",
        "requirements": {"annual_exam": True},
    },
    {
        "title": "Histórico Completo",
        "description": "Preencha todos os dados do perfil do seu pet (vacinas, exames e anamnese).",
        "category": "perfil",
        "points": 150,
        "badge_icon": "clipboard-list",
        "difficulty": "difícil",
        "requirements": {"complete_profile": True},
    },
    {
        "title": "Boas-vindas ao PetLife",
        "description": "Complete o cadastro e adicione seu primeiro pet.",
        "category": "perfil",
        "points": 5,
        "badge_icon": "star",
        "difficulty": "fácil",
        "requirements": {"first_pet": True},
    },
    {
        "title": "Foto Perfeita",
        "description": "Adicione uma foto ao perfil do seu pet.",
        "category": "perfil",
        "points": 10,
        "badge_icon": "camera",
        "difficulty": "fácil",
        "requirements": {"pet_photo": True},
    },
    {
        "title": "Anamnese Completa",
        "description": "Preencha uma anamnese completa do seu pet.",
        "category": "saúde",
        "points": 30,
        "badge_icon": "file-medical",
        "difficulty": "fácil",
        "requirements": {"anamnesis": 1},
    },
    {
        "title": "Tutor Dedicado",
        "description": "Use o PetLife por 7 dias consecutivos.",
        "category": "engajamento",
        "points": 40,
        "badge_icon": "heart",
        "difficulty": "médio",
        "requirements": {"active_days": 7},
    },
    {
        "title": "Super Tutor",
        "description": "Use o PetLife por 30 dias consecutivos.",
        "category": "engajamento",
        "points": 250,
        "badge_icon": "crown",
        "difficulty": "lendário",
        "requirements": {"active_days": 30},
    },
    {
        "title": "Rotina de Caminhada Criada",
        "description": "Crie uma rotina de caminhadas personalizada com IA.",
        "category": "passeio",
        "points": 25,
        "badge_icon": "route",
        "difficulty": "fácil",
        "requirements": {"walk_routine": True},
    },
    {
        "title": "Pet Saudável",
        "description": "Registre 5 vacinas e 2 exames do mesmo pet.",
        "category": "saúde",
        "points": 120,
        "badge_icon": "heart-pulse",
        "difficulty": "difícil",
        "requirements": {"vaccines": 5, "exams": 2},
    },
    {
        "title": "Multiespécie",
        "description": "Cadastre um cão e um gato no PetLife.",
        "category": "perfil",
        "points": 60,
        "badge_icon": "paw-cat-dog",
        "difficulty": "médio",
        "requirements": {"dog": True, "cat": True},
    },
    {
        "title": "Raça Conhecida",
        "description": "Cadastre um pet com raça definida.",
        "category": "perfil",
        "points": 15,
        "badge_icon": "book-open",
        "difficulty": "fácil",
        "requirements": {"pet_with_breed": True},
    },
    {
        "title": "Lembrete Configurado",
        "description": "Configure um lembrete de saúde para seu pet.",
        "category": "saúde",
        "points": 10,
        "badge_icon": "bell",
        "difficulty": "fácil",
        "requirements": {"reminders": 1},
    },
    {
        "title": "Organizador Master",
        "description": "Tenha 5 lembretes ativos ao mesmo tempo.",
        "category": "saúde",
        "points": 50,
        "badge_icon": "bell-ring",
        "difficulty": "médio",
        "requirements": {"reminders": 5},
    },
    {
        "title": "Consultor IA",
        "description": "Use o assistente de IA 5 vezes.",
        "category": "engajamento",
        "points": 30,
        "badge_icon": "robot",
        "difficulty": "fácil",
        "requirements": {"ai_chats": 5},
    },
    {
        "title": "Pet Microchipado",
        "description": "Registre o número de microchip do seu pet.",
        "category": "segurança",
        "points": 20,
        "badge_icon": "chip",
        "difficulty": "fácil",
        "requirements": {"microchip": True},
    },
    {
        "title": "Passeador Iniciante",
        "description": "Complete 10 registros de passeios.",
        "category": "passeio",
        "points": 30,
        "badge_icon": "shoe-prints",
        "difficulty": "fácil",
        "requirements": {"walks": 10},
    },
    {
        "title": "Passeador Experiente",
        "description": "Complete 50 registros de passeios.",
        "category": "passeio",
        "points": 150,
        "badge_icon": "medal",
        "difficulty": "difícil",
        "requirements": {"walks": 50},
    },
    {
        "title": "Amigo dos Pets",
        "description": "Cadastre 3 ou mais pets no PetLife.",
        "category": "perfil",
        "points": 75,
        "badge_icon": "pets",
        "difficulty": "médio",
        "requirements": {"pets": 3},
    },
]


async def seed_breeds(session):
    result = await session.execute(select(Breed).limit(1))
    if result.scalar_one_or_none():
        print("Raças já cadastradas. Pulando seed de raças.")
        return 0

    count = 0
    for breed_data in ALL_BREEDS:
        breed = Breed(**breed_data)
        session.add(breed)
        count += 1

    await session.commit()
    print(f"{count} raças cadastradas com sucesso.")
    return count


async def seed_challenges(session):
    result = await session.execute(select(Challenge).limit(1))
    if result.scalar_one_or_none():
        print("Desafios já cadastrados. Pulando seed de desafios.")
        return 0

    count = 0
    for ch_data in CHALLENGES:
        challenge = Challenge(**ch_data)
        session.add(challenge)
        count += 1

    await session.commit()
    print(f"{count} desafios cadastrados com sucesso.")
    return count


async def run_seed():
    print("Iniciando seed do banco de dados PetLife...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tabelas verificadas/criadas.")

    async with AsyncSessionLocal() as session:
        breeds_count = await seed_breeds(session)
        challenges_count = await seed_challenges(session)

    print(f"\nSeed concluído!")
    print(f"  - Raças: {breeds_count} inseridas")
    print(f"  - Desafios: {challenges_count} inseridos")


if __name__ == "__main__":
    asyncio.run(run_seed())
