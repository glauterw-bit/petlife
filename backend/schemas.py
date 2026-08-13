from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class SpeciesEnum(str, Enum):
    dog = "dog"
    cat = "cat"


class SizeEnum(str, Enum):
    small = "small"
    medium = "medium"
    large = "large"
    giant = "giant"


class GenderEnum(str, Enum):
    male = "male"
    female = "female"


class ReminderTypeEnum(str, Enum):
    vaccine = "vaccine"
    exam = "exam"
    medication = "medication"
    walk = "walk"
    grooming = "grooming"
    vet_appointment = "vet_appointment"
    other = "other"


class ChallengeStatusEnum(str, Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    referral_code: Optional[str] = None  # código de indicação (recompensa dupla)

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("A senha deve ter pelo menos 6 caracteres")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    # Em produção: campo `code` é None e o código é enviado por e-mail.
    # Em dev (sem SMTP configurado): retorna o código direto pra desbloquear o fluxo.
    code: Optional[str] = None
    expires_in_minutes: int = 30
    # False quando o servidor não tem transporte de e-mail (Resend/SMTP) —
    # a UI usa isso pra orientar o usuário a falar com o suporte em vez de
    # esperar um e-mail que nunca vai chegar.
    email_configured: bool = True


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("A senha deve ter pelo menos 6 caracteres")
        return v

    @field_validator("code")
    @classmethod
    def code_format(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit() or len(v) != 6:
            raise ValueError("Código deve conter 6 dígitos")
        return v


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    avatar: Optional[str] = None
    is_vet: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("A nova senha deve ter pelo menos 6 caracteres")
        return v


# ─── Breed Schemas ────────────────────────────────────────────────────────────

class BreedBase(BaseModel):
    species: SpeciesEnum
    name: str
    name_en: Optional[str] = None
    origin: Optional[str] = None
    size: Optional[SizeEnum] = None
    weight_range: Optional[str] = None
    life_expectancy: Optional[str] = None
    temperament: Optional[List[str]] = None
    energy_level: Optional[int] = None
    grooming_level: Optional[int] = None
    health_issues: Optional[List[str]] = None
    exercise_needs: Optional[str] = None
    feeding_guide: Optional[str] = None
    care_tips: Optional[List[str]] = None
    ideal_environment: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None


class BreedCreate(BreedBase):
    pass


class BreedResponse(BreedBase):
    id: int

    model_config = {"from_attributes": True}


# ─── Pet Schemas ──────────────────────────────────────────────────────────────

class PetCreate(BaseModel):
    name: str
    species: SpeciesEnum
    breed_id: Optional[int] = None
    birth_date: Optional[datetime] = None
    weight: Optional[float] = None
    color: Optional[str] = None
    gender: Optional[GenderEnum] = None
    neutered: bool = False
    microchip: Optional[str] = None
    bio: Optional[str] = None


class PetUpdate(BaseModel):
    name: Optional[str] = None
    breed_id: Optional[int] = None
    birth_date: Optional[datetime] = None
    weight: Optional[float] = None
    color: Optional[str] = None
    gender: Optional[GenderEnum] = None
    neutered: Optional[bool] = None
    microchip: Optional[str] = None
    bio: Optional[str] = None


class PetResponse(BaseModel):
    id: int
    user_id: int
    name: str
    species: SpeciesEnum
    breed_id: Optional[int] = None
    birth_date: Optional[datetime] = None
    weight: Optional[float] = None
    color: Optional[str] = None
    gender: Optional[GenderEnum] = None
    neutered: bool
    microchip: Optional[str] = None
    photo: Optional[str] = None
    photo_url: Optional[str] = None  # alias retrocompatível: frontend usa photo_url
    bio: Optional[str] = None
    created_at: datetime
    breed: Optional[BreedResponse] = None
    is_public: bool = False
    public_slug: Optional[str] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def _fill_photo_url(self):
        # Popula photo_url ABSOLUTA a partir de photo (campo do DB).
        # model_validator roda também na serialização do FastAPI (o classmethod
        # antigo não rodava — fotos voltavam null e caíam no emoji).
        if self.photo and not self.photo_url:
            from media import absolute_media_url
            self.photo_url = absolute_media_url(self.photo)
        return self


class PetFullProfile(PetResponse):
    vaccines: List["VaccineResponse"] = []
    exams: List["ExamResponse"] = []
    anamneses: List["AnamnesisResponse"] = []
    reminders: List["ReminderResponse"] = []
    walk_routines: List["WalkRoutineResponse"] = []


# ─── Vaccine Schemas ──────────────────────────────────────────────────────────

class VaccineCreate(BaseModel):
    pet_id: int
    name: str
    date_given: datetime
    next_due: Optional[datetime] = None
    lot_number: Optional[str] = None
    veterinarian: Optional[str] = None
    notes: Optional[str] = None


class VaccineUpdate(BaseModel):
    name: Optional[str] = None
    date_given: Optional[datetime] = None
    next_due: Optional[datetime] = None
    lot_number: Optional[str] = None
    veterinarian: Optional[str] = None
    notes: Optional[str] = None


class VaccineResponse(BaseModel):
    id: int
    pet_id: int
    name: str
    date_given: datetime
    next_due: Optional[datetime] = None
    lot_number: Optional[str] = None
    veterinarian: Optional[str] = None
    notes: Optional[str] = None
    document_path: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Exam Schemas ─────────────────────────────────────────────────────────────

class ExamCreate(BaseModel):
    pet_id: int
    name: str
    type: Optional[str] = None
    date: datetime
    result: Optional[str] = None
    notes: Optional[str] = None


class ExamUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    date: Optional[datetime] = None
    result: Optional[str] = None
    notes: Optional[str] = None


class ExamResponse(BaseModel):
    id: int
    pet_id: int
    name: str
    type: Optional[str] = None
    date: datetime
    result: Optional[str] = None
    notes: Optional[str] = None
    file_path: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Anamnesis Schemas ────────────────────────────────────────────────────────

class AnamnesisCreate(BaseModel):
    pet_id: int
    symptoms: Optional[str] = None
    duration: Optional[str] = None
    appetite: Optional[str] = None
    water_intake: Optional[str] = None
    energy_level: Optional[str] = None
    behavior_changes: Optional[str] = None
    previous_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    last_vet_visit: Optional[datetime] = None


class AnamnesisResponse(BaseModel):
    id: int
    pet_id: int
    symptoms: Optional[str] = None
    duration: Optional[str] = None
    appetite: Optional[str] = None
    water_intake: Optional[str] = None
    energy_level: Optional[str] = None
    behavior_changes: Optional[str] = None
    previous_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    last_vet_visit: Optional[datetime] = None
    ai_analysis: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Reminder Schemas ─────────────────────────────────────────────────────────

class ReminderCreate(BaseModel):
    pet_id: Optional[int] = None
    type: ReminderTypeEnum
    title: str
    description: Optional[str] = None
    due_date: datetime


class ReminderUpdate(BaseModel):
    type: Optional[ReminderTypeEnum] = None
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    is_completed: Optional[bool] = None


class ReminderResponse(BaseModel):
    id: int
    user_id: int
    pet_id: Optional[int] = None
    type: ReminderTypeEnum
    title: str
    description: Optional[str] = None
    due_date: datetime
    is_completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Walk Routine Schemas ─────────────────────────────────────────────────────

class WalkRoutineCreate(BaseModel):
    pet_id: int
    frequency_per_day: Optional[int] = None
    duration_minutes: Optional[int] = None
    time_slots: Optional[List[str]] = None
    notes: Optional[str] = None


class WalkRoutineUpdate(BaseModel):
    frequency_per_day: Optional[int] = None
    duration_minutes: Optional[int] = None
    time_slots: Optional[List[str]] = None
    notes: Optional[str] = None


class WalkRoutineGenerateRequest(BaseModel):
    pet_id: int


class WalkRoutineResponse(BaseModel):
    id: int
    pet_id: int
    frequency_per_day: Optional[int] = None
    duration_minutes: Optional[int] = None
    time_slots: Optional[List[str]] = None
    notes: Optional[str] = None
    ai_generated: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Challenge Schemas ────────────────────────────────────────────────────────

class ChallengeResponse(BaseModel):
    id: int
    title: str
    description: str
    category: Optional[str] = None
    points: int
    badge_icon: Optional[str] = None
    difficulty: Optional[str] = None
    requirements: Optional[Any] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserChallengeResponse(BaseModel):
    id: int
    user_id: int
    challenge_id: int
    pet_id: Optional[int] = None
    status: ChallengeStatusEnum
    completed_at: Optional[datetime] = None
    progress: int
    challenge: Optional[ChallengeResponse] = None

    model_config = {"from_attributes": True}


class UserPointsResponse(BaseModel):
    id: int
    user_id: int
    total_points: int
    level: int
    badges: Optional[List[str]] = None

    model_config = {"from_attributes": True}


# ─── Vet Clinic Schemas ───────────────────────────────────────────────────────

class VetClinicCreate(BaseModel):
    name: str
    cnpj: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    specialty: Optional[str] = None


class VetClinicResponse(BaseModel):
    id: int
    name: str
    cnpj: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    specialty: Optional[str] = None
    plan: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Search Schemas ───────────────────────────────────────────────────────────

class NearbyLocation(BaseModel):
    id: Optional[str] = None
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    latitude: float
    longitude: float
    distance_km: Optional[float] = None
    type: str
    services: Optional[List[str]] = None
    rating: Optional[float] = None
    opening_hours: Optional[str] = None


# ─── AI Chat Schemas ──────────────────────────────────────────────────────────

class AIChatRequest(BaseModel):
    pet_id: Optional[int] = None
    question: str
    conversation_history: Optional[List[dict]] = None


class AIChatResponse(BaseModel):
    response: str
    pet_name: Optional[str] = None


class AIAnalysisRequest(BaseModel):
    anamnesis_id: int


class AIAnalysisResponse(BaseModel):
    analysis: str
    urgency_level: str
    recommendations: List[str]


# ─── Leaderboard Schemas ──────────────────────────────────────────────────────

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    user_name: str
    total_points: int
    level: int
    badges_count: int


# ─── Walk Session Schemas (Strava-style) ─────────────────────────────────────

class RoutePoint(BaseModel):
    lat: float
    lng: float
    ts: int  # unix ms
    alt: Optional[float] = None  # altitude meters
    acc: Optional[float] = None  # accuracy meters


class WalkSessionStart(BaseModel):
    pet_id: int


class WalkSessionFinish(BaseModel):
    ended_at: datetime
    duration_seconds: int
    distance_meters: float
    route_points: Optional[List[RoutePoint]] = None
    photos: Optional[List[str]] = None
    note: Optional[str] = None
    mood: Optional[str] = None  # happy, normal, tired
    weather: Optional[dict] = None
    elevation_gain_m: Optional[float] = None


class WalkSessionResponse(BaseModel):
    id: int
    pet_id: int
    user_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: int
    distance_meters: float
    route_points: Optional[List[dict]] = None
    photos: Optional[List[str]] = None
    note: Optional[str] = None
    mood: Optional[str] = None
    weather: Optional[dict] = None
    avg_pace_seconds_per_km: Optional[float] = None
    avg_speed_kmh: Optional[float] = None
    calories_estimated: Optional[float] = None
    elevation_gain_m: Optional[float] = None
    is_shared: bool
    shared_at: Optional[datetime] = None
    share_image_url: Optional[str] = None
    created_at: datetime
    pet_name: Optional[str] = None
    pet_photo: Optional[str] = None

    model_config = {"from_attributes": True}


class WalkSessionListItem(BaseModel):
    """Versão enxuta pra listagens (sem route_points pesados)."""
    id: int
    pet_id: int
    pet_name: Optional[str] = None
    pet_photo: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: int
    distance_meters: float
    avg_pace_seconds_per_km: Optional[float] = None
    photos_count: int = 0
    mood: Optional[str] = None
    is_shared: bool

    model_config = {"from_attributes": True}


class WalkSessionUpdate(BaseModel):
    note: Optional[str] = None
    mood: Optional[str] = None
    is_shared: Optional[bool] = None


# Allow forward references
PetFullProfile.model_rebuild()
Token.model_rebuild()
