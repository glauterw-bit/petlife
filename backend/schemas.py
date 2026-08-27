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
    # "Manter conectado": sessão longa para não pedir login toda hora.
    remember: bool = True


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
    veterinarian: Optional[str] = None
    notes: Optional[str] = None


class ExamUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    date: Optional[datetime] = None
    result: Optional[str] = None
    veterinarian: Optional[str] = None
    notes: Optional[str] = None


class ExamResponse(BaseModel):
    id: int
    pet_id: int
    name: str
    type: Optional[str] = None
    date: datetime
    result: Optional[str] = None
    veterinarian: Optional[str] = None
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
    # Objeto, não string. A coluna guarda json.dumps(...), e o app tratava o
    # retorno como objeto: `ai_analysis.recommendations.length` numa string dá
    # undefined.length e derrubava a aba de anamnese do pet. Normalizamos aqui,
    # com os mesmos nomes de AIAnalysisResponse.
    ai_analysis: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _parse_analysis(cls, v: Any) -> Any:
        if isinstance(v, dict):
            return v
        raw = getattr(v, "ai_analysis", None)
        data = {f: getattr(v, f, None) for f in cls.model_fields if f != "ai_analysis"}
        data["ai_analysis"] = _normalize_analysis(raw)
        return data


def _normalize_analysis(raw: Any) -> Optional[dict]:
    """Converte o dump da IA no formato que o app consome.

    A IA devolve `full_analysis`; o app lê `analysis`. Listas sempre voltam
    lista — nunca None — pra que `.map()` no cliente não estoure.
    """
    if not raw:
        return None
    if isinstance(raw, str):
        import json
        try:
            raw = json.loads(raw)
        except Exception:
            # texto solto de versões antigas: entrega como análise mesmo
            return {"analysis": raw, "urgency_level": "media",
                    "recommendations": [], "possible_conditions": []}
    if not isinstance(raw, dict):
        return None
    return {
        "analysis": raw.get("full_analysis") or raw.get("analysis") or "",
        "urgency_level": raw.get("urgency_level") or "media",
        "urgency_explanation": raw.get("urgency_explanation"),
        "recommendations": list(raw.get("recommendations") or []),
        "possible_conditions": list(raw.get("possible_conditions") or []),
        "warning_signs": list(raw.get("warning_signs") or []),
        "home_care": list(raw.get("home_care") or []),
        "vet_visit_recommended": raw.get("vet_visit_recommended"),
        "vet_visit_timeframe": raw.get("vet_visit_timeframe"),
    }


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
    """Resposta da rotina de passeio.

    Os nomes aqui são os que o app consome (walks_per_day/walk_times/…), que
    NÃO são os nomes das colunas (frequency_per_day/time_slots/…). Antes o
    schema devolvia os nomes do banco e o app lia os outros: `walk_times` vinha
    `undefined`, o `.map()` estourava e a tela inteira virava "Application
    error: a client-side exception has occurred".

    Os nomes das colunas seguem no fim, para não quebrar nenhum outro cliente.
    """
    id: int
    pet_id: int
    walks_per_day: Optional[int] = None
    walk_duration_minutes: Optional[int] = None
    walk_times: List[str] = []
    exercise_type: Optional[str] = None
    tips: List[str] = []
    precautions: List[str] = []
    equipment: List[str] = []
    weekly_plan: Optional[dict] = None
    notes: Optional[str] = None
    ai_generated: bool
    created_at: datetime

    # aliases legados (nomes das colunas)
    frequency_per_day: Optional[int] = None
    duration_minutes: Optional[int] = None
    time_slots: List[str] = []

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _expand(cls, v: Any) -> Any:
        if isinstance(v, dict):
            return v

        details = _routine_details(v)
        times = list(getattr(v, "time_slots", None) or details.get("time_slots") or [])
        freq = getattr(v, "frequency_per_day", None) or details.get("frequency_per_day")
        dur = getattr(v, "duration_minutes", None) or details.get("duration_minutes")

        return {
            "id": v.id,
            "pet_id": v.pet_id,
            "walks_per_day": freq,
            "walk_duration_minutes": dur,
            "walk_times": times,
            "exercise_type": details.get("intensity"),
            "tips": list(details.get("tips") or []),
            "precautions": list(details.get("precautions") or []),
            "equipment": list(details.get("equipment_needed") or []),
            "weekly_plan": details.get("weekly_plan"),
            # a nota legível é a da IA; o dump completo mora em `details`
            "notes": details.get("notes") or _plain_notes(getattr(v, "notes", None)),
            "ai_generated": v.ai_generated,
            "created_at": v.created_at,
            "frequency_per_day": freq,
            "duration_minutes": dur,
            "time_slots": times,
        }


def _routine_details(routine: Any) -> dict:
    """Payload completo da IA. Novo: coluna `details` (JSON).

    Linhas antigas guardavam `str(dict)` dentro de `notes` — um repr de Python,
    não JSON. Recuperamos com literal_eval pra não perder as dicas que já foram
    geradas (e pagas) antes desta correção.
    """
    d = getattr(routine, "details", None)
    if isinstance(d, dict):
        return d
    if isinstance(d, str) and d.strip():
        try:
            import json
            parsed = json.loads(d)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    raw = getattr(routine, "notes", None)
    if isinstance(raw, str) and raw.strip().startswith("{"):
        import ast
        try:
            parsed = ast.literal_eval(raw)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {}


def _plain_notes(raw: Any) -> Optional[str]:
    """Não devolve o repr do dict como se fosse texto pro tutor ler."""
    if isinstance(raw, str) and raw.strip().startswith("{"):
        return None
    return raw


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
    """Pontos e nível do tutor.

    `badges_earned` existe porque é o nome que o app lê. Antes só existia
    `badges`, então `points.badges_earned.length` estourava e derrubava a tela
    de desafios inteira. É sempre lista — nunca None.

    O progresso também vem daqui: o app calculava a barra com 1000 pontos por
    nível enquanto o backend sobe de nível a cada 100, então a barra ficava em
    ~10% do valor real.
    """
    id: int
    user_id: int
    total_points: int
    level: int
    badges: List[str] = []
    badges_earned: List[str] = []
    points_in_level: int = 0
    points_per_level: int = 100
    points_to_next_level: int = 0

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _expand(cls, v: Any) -> Any:
        if isinstance(v, dict):
            return v
        from routers.gamification import POINTS_PER_LEVEL

        total = v.total_points or 0
        badges = list(v.badges or [])
        in_level = total % POINTS_PER_LEVEL
        return {
            "id": v.id,
            "user_id": v.user_id,
            "total_points": total,
            "level": v.level,
            "badges": badges,
            "badges_earned": badges,
            "points_in_level": in_level,
            "points_per_level": POINTS_PER_LEVEL,
            "points_to_next_level": POINTS_PER_LEVEL - in_level,
        }


# ─── Vet Clinic Schemas ───────────────────────────────────────────────────────

class ConsultationCreate(BaseModel):
    """Consulta lançada pela clínica.

    Antes os campos eram argumentos soltos da função, ou seja, query params —
    e o app mandava JSON no corpo. Resultado: a clínica nunca conseguiu
    registrar consulta.
    """
    pet_id: int
    notes: str
    # A tela manda `date`; antes o campo era ignorado e a consulta ficava com a
    # data do servidor, não a que o veterinário escolheu.
    date: Optional[datetime] = None
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    follow_up_date: Optional[datetime] = None


class ConsultationResponse(BaseModel):
    """Consulta devolvida pelo portal.

    Existe também pra deixar o endpoint visível no OpenAPI: sem response_model
    ele não aparece no schema, e nenhuma ferramenta de contrato consegue
    conferir se o app lê os campos certos.
    """
    id: int
    pet_id: int
    date: datetime
    created_at: datetime
    notes: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    vet_name: Optional[str] = None
    follow_up_date: Optional[datetime] = None


class VetClinicSelfRegister(BaseModel):
    """Payload da tela /vet/register — cria conta e clínica juntas.

    Os nomes seguem o que a tela já envia (`clinic_name`, não `name`).
    """
    clinic_name: str
    email: EmailStr
    password: str
    cnpj: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    specialty: Optional[str] = None

    @field_validator("password")
    @classmethod
    def _min_len(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("A senha precisa ter ao menos 6 caracteres")
        return v


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
