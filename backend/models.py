from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey,
    Enum as SAEnum, JSON
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

    pets = relationship("Pet", back_populates="owner", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="user", cascade="all, delete-orphan")
    points = relationship("UserPoints", back_populates="user", uselist=False, cascade="all, delete-orphan")
    challenges = relationship("UserChallenge", back_populates="user", cascade="all, delete-orphan")
    clinic_vets = relationship("ClinicVet", back_populates="user")


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

    owner = relationship("User", back_populates="pets")
    breed = relationship("Breed", back_populates="pets")
    vaccines = relationship("Vaccine", back_populates="pet", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="pet", cascade="all, delete-orphan")
    anamneses = relationship("Anamnesis", back_populates="pet", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="pet", cascade="all, delete-orphan")
    walk_routines = relationship("WalkRoutine", back_populates="pet", cascade="all, delete-orphan")
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
