from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey,
    Enum as SAEnum, JSON, or_, select as _select
)
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import enum


class SpeciesEnum(str, enum.Enum):
    dog = "dog"
    cat = "cat"


class SizeEnum(str, enum.Enum):
    small = "small"
    medium = "medium"
    large = "large"
    giant = "giant"


class GenderEnum(str, enum.Enum):
    male = "male"
    female = "female"


class ReminderTypeEnum(str, enum.Enum):
    vaccine = "vaccine"
    exam = "exam"
    medication = "medication"
    walk = "walk"
    grooming = "grooming"
    vet_appointment = "vet_appointment"
    other = "other"


class ChallengeStatusEnum(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    avatar = Column(String(500), nullable=True)
    is_vet = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    password_reset_code = Column(String(6), nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
    # ─── Assinatura (Apple IAP) ──────────────────────────────────────────────
    premium_tier = Column(String(20), default="free", nullable=False)  # free|plus|pro
    premium_expires_at = Column(DateTime, nullable=True)  # null = sem assinatura ativa
    active_product_sku = Column(String(64), nullable=True)  # ex: pro_monthly
    apple_original_transaction_id = Column(String(128), nullable=True, index=True)
    trial_used = Column(Boolean, default=False, nullable=False)
    # Última atividade (atualizado com throttle no get_current_user) — base de DAU/WAU/MAU
    last_seen_at = Column(DateTime, nullable=True, index=True)
    # ─── Indicação (recompensa dupla) ────────────────────────────────────────
    referral_code = Column(String(12), unique=True, nullable=True, index=True)
    referred_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    pets = relationship("Pet", back_populates="owner", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="user", cascade="all, delete-orphan")
    points = relationship("UserPoints", back_populates="user", uselist=False, cascade="all, delete-orphan")
    challenges = relationship("UserChallenge", back_populates="user", cascade="all, delete-orphan")
    clinic_vets = relationship("ClinicVet", back_populates="user")


class PetExpense(Base):
    """Controle de gastos do pet — alimentação, saúde, higiene etc.
    Base pros insights de custo mensal (paridade com líderes do nicho)."""
    __tablename__ = "pet_expenses"

    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(30), nullable=False)  # alimentacao|saude|higiene|acessorios|servicos|outros
    amount = Column(Float, nullable=False)  # BRL
    description = Column(String(200), nullable=True)
    spent_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PasswordResetRequest(Base):
    """Pedido de redefinição de senha quando não há transporte de e-mail.
    O tutor pede pelo app; o admin resolve em 1 clique (gera código e manda
    por WhatsApp). Some quando o SMTP estiver configurado."""
    __tablename__ = "password_reset_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    email = Column(String(200), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    resolved_at = Column(DateTime, nullable=True)


class UsageEvent(Base):
    """Evento de uso (telemetria própria, LGPD-friendly: só user_id + nome do evento).
    Alimenta o painel admin: aberturas do app, funções usadas, funil do paywall."""
    __tablename__ = "usage_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event = Column(String(40), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class QuotaUsage(Base):
    """Contador mensal de uso de recursos com quota (IA). Reseta por mês-calendário.
    `month` no formato 'YYYY-MM' (UTC). Uma linha por (user, mês)."""
    __tablename__ = "quota_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    month = Column(String(7), nullable=False, index=True)  # 'YYYY-MM'
    ai_chat = Column(Integer, default=0, nullable=False)
    ai_analysis = Column(Integer, default=0, nullable=False)


class IapTransaction(Base):
    """Log de transações Apple IAP — auditoria de verifyReceipt + webhooks S2S."""
    __tablename__ = "iap_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    original_transaction_id = Column(String(128), nullable=True, index=True)
    transaction_id = Column(String(128), nullable=True)
    product_id = Column(String(128), nullable=True)
    tier = Column(String(20), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    source = Column(String(20), nullable=True)  # verify_receipt | webhook
    notification_type = Column(String(60), nullable=True)  # p/ eventos S2S
    environment = Column(String(20), nullable=True)  # Sandbox | Production
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class Breed(Base):
    __tablename__ = "breeds"

    id = Column(Integer, primary_key=True, index=True)
    species = Column(SAEnum(SpeciesEnum), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    name_en = Column(String(200), nullable=True)
    origin = Column(String(200), nullable=True)
    size = Column(SAEnum(SizeEnum), nullable=True)
    weight_range = Column(String(50), nullable=True)
    life_expectancy = Column(String(50), nullable=True)
    temperament = Column(JSON, nullable=True)
    energy_level = Column(Integer, nullable=True)
    grooming_level = Column(Integer, nullable=True)
    health_issues = Column(JSON, nullable=True)
    exercise_needs = Column(Text, nullable=True)
    feeding_guide = Column(Text, nullable=True)
    care_tips = Column(JSON, nullable=True)
    ideal_environment = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)

    pets = relationship("Pet", back_populates="breed")


class Pet(Base):
    __tablename__ = "pets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    species = Column(SAEnum(SpeciesEnum), nullable=False)
    breed_id = Column(Integer, ForeignKey("breeds.id"), nullable=True)
    birth_date = Column(DateTime, nullable=True)
    weight = Column(Float, nullable=True)
    color = Column(String(100), nullable=True)
    gender = Column(SAEnum(GenderEnum), nullable=True)
    neutered = Column(Boolean, default=False)
    microchip = Column(String(50), nullable=True)
    photo = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_lost = Column(Boolean, default=False, nullable=False)
    lost_at = Column(DateTime, nullable=True)
    lost_last_seen = Column(String(500), nullable=True)
    lost_reward = Column(String(200), nullable=True)
    # Memorial mode
    is_deceased = Column(Boolean, default=False, nullable=False)
    deceased_at = Column(DateTime, nullable=True)
    memorial_text = Column(Text, nullable=True)
    # Perfil público compartilhável (petlife.app/p/<slug>) — opt-in do tutor
    is_public = Column(Boolean, default=False, nullable=False)
    public_slug = Column(String(80), unique=True, nullable=True, index=True)

    owner = relationship("User", back_populates="pets")
    breed = relationship("Breed", back_populates="pets")
    vaccines = relationship("Vaccine", back_populates="pet", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="pet", cascade="all, delete-orphan")
    anamneses = relationship("Anamnesis", back_populates="pet", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="pet", cascade="all, delete-orphan")
    walk_routines = relationship("WalkRoutine", back_populates="pet", cascade="all, delete-orphan")
    walk_sessions = relationship("WalkSession", back_populates="pet", cascade="all, delete-orphan")
    challenges = relationship("UserChallenge", back_populates="pet", cascade="all, delete-orphan")


class Vaccine(Base):
    __tablename__ = "vaccines"

    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    date_given = Column(DateTime, nullable=False)
    next_due = Column(DateTime, nullable=True)
    lot_number = Column(String(100), nullable=True)
    veterinarian = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    document_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pet = relationship("Pet", back_populates="vaccines")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    type = Column(String(100), nullable=True)
    date = Column(DateTime, nullable=False)
    result = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pet = relationship("Pet", back_populates="exams")


class Anamnesis(Base):
    __tablename__ = "anamneses"

    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"), nullable=False, index=True)
    symptoms = Column(Text, nullable=True)
    duration = Column(String(100), nullable=True)
    appetite = Column(String(50), nullable=True)
    water_intake = Column(String(50), nullable=True)
    energy_level = Column(String(50), nullable=True)
    behavior_changes = Column(Text, nullable=True)
    previous_conditions = Column(Text, nullable=True)
    current_medications = Column(Text, nullable=True)
    allergies = Column(Text, nullable=True)
    last_vet_visit = Column(DateTime, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pet = relationship("Pet", back_populates="anamneses")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"), nullable=True)
    type = Column(SAEnum(ReminderTypeEnum), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=False)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reminders")
    pet = relationship("Pet", back_populates="reminders")


class WalkRoutine(Base):
    __tablename__ = "walk_routines"

    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"), nullable=False, index=True)
    frequency_per_day = Column(Integer, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    time_slots = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    pet = relationship("Pet", back_populates="walk_routines")


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    points = Column(Integer, default=0)
    badge_icon = Column(String(100), nullable=True)
    difficulty = Column(String(50), nullable=True)
    requirements = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user_challenges = relationship("UserChallenge", back_populates="challenge")


class UserChallenge(Base):
    __tablename__ = "user_challenges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"), nullable=True)
    status = Column(SAEnum(ChallengeStatusEnum), default=ChallengeStatusEnum.not_started)
    completed_at = Column(DateTime, nullable=True)
    progress = Column(Integer, default=0)

    user = relationship("User", back_populates="challenges")
    challenge = relationship("Challenge", back_populates="user_challenges")
    pet = relationship("Pet", back_populates="challenges")


class UserPoints(Base):
    __tablename__ = "user_points"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    total_points = Column(Integer, default=0)
    level = Column(Integer, default=1)
    badges = Column(JSON, default=list)

    user = relationship("User", back_populates="points")


class VetClinic(Base):
    __tablename__ = "vet_clinics"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    cnpj = Column(String(20), nullable=True, unique=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(200), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(2), nullable=True)
    zip_code = Column(String(10), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    specialty = Column(String(200), nullable=True)
    plan = Column(String(50), default="free")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vets = relationship("ClinicVet", back_populates="clinic", cascade="all, delete-orphan")


class ClinicVet(Base):
    __tablename__ = "clinic_vets"

    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("vet_clinics.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    crmv = Column(String(50), nullable=True)
    specialty = Column(String(200), nullable=True)

    clinic = relationship("VetClinic", back_populates="vets")
    user = relationship("User", back_populates="clinic_vets")


class PetWeightHistory(Base):
    """Historico de peso pra grafico de crescimento + alertas obesidade."""
    __tablename__ = "pet_weight_history"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    weight_kg = Column(Float, nullable=False)
    measured_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    source = Column(String(50), nullable=True)  # 'manual'|'iot'|'vet'|'snapshot_ia'
    body_condition_score = Column(Integer, nullable=True)  # 1-9 WSAVA
    notes = Column(Text, nullable=True)


class BehaviorPlan(Base):
    """Plano comportamental gerado por IA — 6 semanas estruturadas."""
    __tablename__ = "behavior_plans"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    issue_type = Column(String(100), nullable=False)  # separation_anxiety|fear|reactivity|aggression|destruction|barking|cat_litter
    intensity = Column(String(20), nullable=False)  # leve|moderada|alta
    status = Column(String(20), default="active", nullable=False)  # active|completed|paused|abandoned
    duration_weeks = Column(Integer, default=6, nullable=False)
    plan_data = Column(JSON, nullable=False)  # curriculum gerado pela IA
    context_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    check_ins = relationship("BehaviorCheckIn", back_populates="plan", cascade="all, delete-orphan")


class BehaviorCheckIn(Base):
    """Check-in diario do tutor sobre progresso do plano."""
    __tablename__ = "behavior_check_ins"
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("behavior_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    day_number = Column(Integer, nullable=False)
    progress_score = Column(Integer, nullable=False)  # 0-10
    notes = Column(Text, nullable=True)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    plan = relationship("BehaviorPlan", back_populates="check_ins")


class PetShare(Base):
    """Compartilhamento de pet com co-tutores, sitters, familia.
    Owner original mantem controle total; shares tem permissoes limitadas por role.
    """
    __tablename__ = "pet_shares"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # null antes do aceite
    invite_email = Column(String(200), nullable=False, index=True)  # email convidado
    invited_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(30), default="co_tutor", nullable=False)  # co_tutor | sitter | familia
    invite_token = Column(String(80), unique=True, index=True, nullable=False)
    invited_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending", nullable=False)  # pending | accepted | revoked | declined


class PetRelation(Base):
    """Arvore genealogica/social entre pets — irmaos, pais, filhotes, parceiros.
    Requer confirmacao mutua dos dois tutores pra evitar spam.
    """
    __tablename__ = "pet_relations"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    related_pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    relation = Column(String(30), nullable=False)  # sibling | parent | offspring | mate | friend
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending", nullable=False)  # pending | confirmed | declined


class PetBehaviorLog(Base):
    """Check-in diario de bem-estar — base pra deteccao de padroes."""
    __tablename__ = "pet_behavior_logs"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    mood = Column(String(30), nullable=True)  # feliz | neutro | apatico | ansioso | agitado
    energy = Column(Integer, nullable=True)  # 1-5
    appetite = Column(String(20), nullable=True)  # normal | reduzido | aumentado | recusou
    water_intake = Column(String(20), nullable=True)  # normal | reduzido | aumentado
    stool_quality = Column(Integer, nullable=True)  # 1-7 escala fecal
    activity_minutes = Column(Integer, nullable=True)  # tempo de atividade fisica
    notes = Column(Text, nullable=True)


class PetStory(Base):
    """Stories — feed fotografico com captions geradas por IA."""
    __tablename__ = "pet_stories"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    photo_url = Column(String(500), nullable=False)
    user_caption = Column(Text, nullable=True)
    ai_caption = Column(Text, nullable=True)
    ai_emotion = Column(String(30), nullable=True)  # alegre, curioso, sonolento, etc
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class PetClinicAccess(Base):
    """Consentimento explícito do tutor pra clínica acessar histórico do pet.
    Obrigatório por LGPD — vet só vê pets com acesso liberado pelo tutor.
    """
    __tablename__ = "pet_clinic_access"

    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey("vet_clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    granted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    revoked_at = Column(DateTime, nullable=True)


class PetshopLocation(Base):
    __tablename__ = "petshop_locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(2), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    services = Column(JSON, nullable=True)
    rating = Column(Float, nullable=True)


class WalkSession(Base):
    """Sessão de passeio cronometrada (estilo Strava)."""
    __tablename__ = "walk_sessions"

    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=False, default=0)
    distance_meters = Column(Float, nullable=False, default=0.0)

    # Lista de pontos: [{lat, lng, ts, alt?, acc?}, ...]
    # Amostragem ~5s ou a cada 5m percorridos (o que vier antes)
    route_points = Column(JSON, nullable=True)

    # Fotos tiradas durante o passeio: ["url1", "url2", ...]
    photos = Column(JSON, nullable=True)

    note = Column(Text, nullable=True)
    weather = Column(JSON, nullable=True)  # {temp_c, condition, humidity}
    avg_pace_seconds_per_km = Column(Float, nullable=True)
    avg_speed_kmh = Column(Float, nullable=True)
    calories_estimated = Column(Float, nullable=True)
    elevation_gain_m = Column(Float, nullable=True)

    # Pet mood at end: happy, normal, tired
    mood = Column(String(20), nullable=True)

    is_shared = Column(Boolean, default=False, nullable=False)
    shared_at = Column(DateTime, nullable=True)
    share_image_url = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    pet = relationship("Pet", back_populates="walk_sessions")
    user = relationship("User")


# ─── Walk social: kudos/likes ────────────────────────────────────────────────
class WalkKudos(Base):
    """Curtidas em walks compartilhados (estilo Strava)."""
    __tablename__ = "walk_kudos"
    id = Column(Integer, primary_key=True, index=True)
    walk_id = Column(Integer, ForeignKey("walk_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ─── Activity log: auditoria multi-tutor ─────────────────────────────────────
class PetActivityLog(Base):
    """Log de atividade pra família/co-tutores verem quem fez o quê."""
    __tablename__ = "pet_activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(60), nullable=False)  # e.g. "weight_added", "behavior_logged", "story_created"
    summary = Column(String(300), nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


# ─── Notification: in-app notifications pra co-tutores ───────────────────────
class Notification(Base):
    """Notificações in-app — fan-out quando um co-tutor faz algo no pet."""
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id", ondelete="CASCADE"), nullable=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    type = Column(String(60), nullable=False)  # weight_added | behavior_logged | walk_finished | story_created | invite_accepted | etc
    title = Column(String(200), nullable=False)
    body = Column(String(500), nullable=True)
    link = Column(String(300), nullable=True)  # rota relativa: /pets/123, /walks/456, etc
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


# ─── Multi-tutor access helper ───────────────────────────────────────────────
def pet_accessible_filter(user_id: int):
    """SQL filter: pet acessível por owner ou share aceito (multi-tutor sharing)."""
    return or_(
        Pet.user_id == user_id,
        Pet.id.in_(
            _select(PetShare.pet_id).where(
                PetShare.user_id == user_id,
                PetShare.status == "accepted",
            )
        ),
    )


async def log_pet_activity(db, pet_id: int, user_id: int, action: str, summary: str = None, meta: dict = None):
    """Helper pra registrar ação de tutor no activity log (não levanta exceção em falha)."""
    try:
        log = PetActivityLog(pet_id=pet_id, user_id=user_id, action=action, summary=summary, meta=meta)
        db.add(log)
        await db.flush()
    except Exception:
        pass


async def user_has_pet_access(db, pet_id: int, user_id: int) -> bool:
    """True se user é dono OU share aceito do pet. Usar pra autorizar reads/writes comuns."""
    q = await db.execute(_select(Pet.id).where(Pet.id == pet_id, pet_accessible_filter(user_id)))
    return q.scalar_one_or_none() is not None


async def notify_pet_collaborators(
    db,
    pet_id: int,
    actor_user_id: int,
    *,
    type: str,
    title: str,
    body: str = None,
    link: str = None,
):
    """Cria Notification pra todos os tutores do pet exceto o autor da ação.
    Não levanta exceção em falha — best-effort."""
    try:
        owner_q = await db.execute(_select(Pet.user_id).where(Pet.id == pet_id))
        owner_id = owner_q.scalar_one_or_none()
        recipients = set()
        if owner_id and owner_id != actor_user_id:
            recipients.add(owner_id)
        shares_q = await db.execute(
            _select(PetShare.user_id).where(
                PetShare.pet_id == pet_id,
                PetShare.status == "accepted",
                PetShare.user_id.is_not(None),
            )
        )
        for (uid,) in shares_q.all():
            if uid != actor_user_id:
                recipients.add(uid)
        for uid in recipients:
            db.add(Notification(
                user_id=uid,
                pet_id=pet_id,
                actor_user_id=actor_user_id,
                type=type,
                title=title,
                body=body,
                link=link,
            ))
        await db.flush()
    except Exception:
        pass


class Feedback(Base):
    """Feedback dos usuários — pesquisa de satisfação e sugestões de melhoria."""

    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=True)          # 1-5 (satisfação geral)
    likes_most = Column(Text, nullable=True)         # o que mais gosta
    suggestion = Column(Text, nullable=True)         # o que melhorar / o que falta
    can_contact = Column(Boolean, default=False, nullable=False)
    source = Column(String(40), nullable=True)       # de onde veio (popup_2026_08)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class AiTopicLog(Base):
    """Tema das perguntas feitas à Vyron IA — SEM o texto da pergunta.

    Só a categoria (ver ai_topics.py) é gravada, para mapear o que os tutores
    mais precisam sem armazenar conteúdo pessoal.
    """

    __tablename__ = "ai_topic_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    topic = Column(String(40), nullable=False, index=True)
    species = Column(String(10), nullable=True)   # dog/cat — dá pra cruzar tema x espécie
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
