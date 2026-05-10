from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./petlife.db"
    SECRET_KEY: str = "petlife-super-secret-key-2024-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    ANTHROPIC_API_KEY: str = ""
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10485760
    APP_NAME: str = "PetLife"
    PORT: int = 8030

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        from models import Base as ModelBase
        await conn.run_sync(ModelBase.metadata.create_all)
    await _run_migrations()


async def drop_tables():
    async with engine.begin() as conn:
        from models import Base as ModelBase
        await conn.run_sync(ModelBase.metadata.drop_all)


async def _run_migrations():
    """Migrações leves idempotentes — adiciona colunas que faltam em tabelas
    pré-existentes. Necessário porque create_all não altera schemas existentes.
    """
    from sqlalchemy import text

    migrations = [
        "ALTER TABLE users ADD COLUMN password_reset_code VARCHAR(6)",
        "ALTER TABLE users ADD COLUMN password_reset_expires DATETIME",
    ]
    async with engine.begin() as conn:
        for stmt in migrations:
            try:
                await conn.execute(text(stmt))
            except Exception:
                # Coluna já existe ou tabela ainda não foi criada — seguro ignorar.
                pass
