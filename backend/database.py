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

# Railway provê DATABASE_URL no formato `postgres://...` (ou `postgresql://...`).
# SQLAlchemy 2.x exige driver explícito (`postgresql+asyncpg://`) para async.
def _normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


_db_url = _normalize_db_url(settings.DATABASE_URL)
_is_sqlite = _db_url.startswith("sqlite")

# `check_same_thread` é flag exclusiva do driver sqlite3.
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_async_engine(
    _db_url,
    echo=False,
    connect_args=_connect_args,
    pool_pre_ping=True,  # reconecta se o Postgres derruba conexões idle
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

    Usa conexão separada por statement: no Postgres uma falha em ALTER TABLE
    aborta a transação inteira, então isolamos cada DDL.
    """
    from sqlalchemy import text

    # Postgres usa TIMESTAMP, SQLite aceita DATETIME — ambos toleram VARCHAR.
    timestamp_type = "TIMESTAMP" if not _is_sqlite else "DATETIME"

    migrations = [
        f"ALTER TABLE users ADD COLUMN password_reset_code VARCHAR(6)",
        f"ALTER TABLE users ADD COLUMN password_reset_expires {timestamp_type}",
        # Lost-pet feature
        f"ALTER TABLE pets ADD COLUMN is_lost BOOLEAN DEFAULT FALSE NOT NULL",
        f"ALTER TABLE pets ADD COLUMN lost_at {timestamp_type}",
        f"ALTER TABLE pets ADD COLUMN lost_last_seen VARCHAR(500)",
        f"ALTER TABLE pets ADD COLUMN lost_reward VARCHAR(200)",
        # Indexes para performance
        "CREATE INDEX IF NOT EXISTS ix_vaccines_pet_next_due ON vaccines(pet_id, next_due)",
        "CREATE INDEX IF NOT EXISTS ix_reminders_user_due_completed ON reminders(user_id, due_date, is_completed)",
        "CREATE INDEX IF NOT EXISTS ix_pets_user_created ON pets(user_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_weight_pet_measured ON pet_weight_history(pet_id, measured_at)",
        "CREATE INDEX IF NOT EXISTS ix_behavior_plans_pet_status ON behavior_plans(pet_id, status)",
        # Memorial mode
        "ALTER TABLE pets ADD COLUMN is_deceased BOOLEAN DEFAULT FALSE NOT NULL",
        f"ALTER TABLE pets ADD COLUMN deceased_at {timestamp_type}",
        "ALTER TABLE pets ADD COLUMN memorial_text TEXT",
        # Indexes
        "CREATE INDEX IF NOT EXISTS ix_behavior_logs_pet_logged ON pet_behavior_logs(pet_id, logged_at)",
        "CREATE INDEX IF NOT EXISTS ix_stories_pet_created ON pet_stories(pet_id, created_at)",
        # Multi-tutor + family tree
        "CREATE INDEX IF NOT EXISTS ix_pet_shares_user_status ON pet_shares(user_id, status)",
        "CREATE INDEX IF NOT EXISTS ix_pet_shares_email_status ON pet_shares(invite_email, status)",
        "CREATE INDEX IF NOT EXISTS ix_pet_relations_pet_status ON pet_relations(pet_id, status)",
        # Walk sessions (Strava-style)
        "CREATE INDEX IF NOT EXISTS ix_walk_sessions_user_started ON walk_sessions(user_id, started_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_walk_sessions_pet_started ON walk_sessions(pet_id, started_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_walk_sessions_active ON walk_sessions(user_id) WHERE ended_at IS NULL",
        # Assinatura (Apple IAP)
        "ALTER TABLE users ADD COLUMN premium_tier VARCHAR(20) DEFAULT 'free' NOT NULL",
        f"ALTER TABLE users ADD COLUMN premium_expires_at {timestamp_type}",
        "ALTER TABLE users ADD COLUMN active_product_sku VARCHAR(64)",
        "ALTER TABLE users ADD COLUMN apple_original_transaction_id VARCHAR(128)",
        "ALTER TABLE users ADD COLUMN trial_used BOOLEAN DEFAULT FALSE NOT NULL",
        "CREATE INDEX IF NOT EXISTS ix_users_apple_otx ON users(apple_original_transaction_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_quota_usage_user_month ON quota_usage(user_id, month)",
        "CREATE INDEX IF NOT EXISTS ix_iap_tx_original ON iap_transactions(original_transaction_id)",
        "CREATE INDEX IF NOT EXISTS ix_pet_expenses_pet_spent ON pet_expenses(pet_id, spent_at)",
        f"ALTER TABLE users ADD COLUMN last_seen_at {timestamp_type}",
        "CREATE INDEX IF NOT EXISTS ix_users_last_seen ON users(last_seen_at)",
    ]
    for stmt in migrations:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception:
            # Coluna já existe ou tabela ainda não foi criada — seguro ignorar.
            pass
