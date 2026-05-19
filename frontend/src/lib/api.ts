const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('petlife_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Erro ${res.status}`
    try {
      const data = await res.json()
      message = data.detail || data.message || message
    } catch {}
    throw new Error(message)
  }
  const text = await res.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

// ── Auth ──────────────────────────────────────────────
export const auth = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return handleResponse<{ access_token: string; token_type: string; user: User }>(res)
  },

  register: async (data: { name: string; email: string; password: string; phone?: string }) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse<{ access_token: string; token_type: string; user: User }>(res)
  },

  getMe: async () => {
    const res = await fetch(`${API_URL}/auth/me`, { headers: getAuthHeaders() })
    return handleResponse<User>(res)
  },

  updateProfile: async (data: Partial<User>) => {
    const res = await fetch(`${API_URL}/auth/me`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<User>(res)
  },

  forgotPassword: async (email: string) => {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return handleResponse<{ message: string; code: string | null; expires_in_minutes: number }>(res)
  },

  resetPassword: async (email: string, code: string, new_password: string) => {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, new_password }),
    })
    return handleResponse<{ message: string }>(res)
  },
}

// ── Pets ──────────────────────────────────────────────
export const pets = {
  list: async () => {
    const res = await fetch(`${API_URL}/pets`, { headers: getAuthHeaders() })
    return handleResponse<Pet[]>(res)
  },

  getById: async (id: number) => {
    const res = await fetch(`${API_URL}/pets/${id}`, { headers: getAuthHeaders() })
    return handleResponse<Pet>(res)
  },

  create: async (data: CreatePetData) => {
    const res = await fetch(`${API_URL}/pets`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Pet>(res)
  },

  update: async (id: number, data: Partial<CreatePetData>) => {
    const res = await fetch(`${API_URL}/pets/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Pet>(res)
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_URL}/pets/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    return handleResponse<{ message: string }>(res)
  },

  uploadPhoto: async (id: number, file: File) => {
    const token = localStorage.getItem('petlife_token')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/pets/${id}/photo`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })
    return handleResponse<{ photo_url: string }>(res)
  },

  getFullProfile: async (id: number) => {
    const res = await fetch(`${API_URL}/pets/${id}/full-profile`, { headers: getAuthHeaders() })
    return handleResponse<PetFullProfile>(res)
  },

  toggleLost: async (petId: number, payload: { is_lost: boolean; last_seen?: string; reward?: string }) => {
    const res = await fetch(`${API_URL}/pets/${petId}/lost`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    return handleResponse<{
      pet_id: number; is_lost: boolean; lost_at: string | null;
      last_seen: string | null; reward: string | null;
    }>(res)
  },
}

// ── Breeds ────────────────────────────────────────────
export const breeds = {
  list: async (params?: { species?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.species) qs.set('species', params.species)
    if (params?.search) qs.set('search', params.search)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    const res = await fetch(`${API_URL}/breeds?${qs}`, { headers: getAuthHeaders() })
    return handleResponse<Breed[]>(res)
  },

  getById: async (id: number) => {
    const res = await fetch(`${API_URL}/breeds/${id}`, { headers: getAuthHeaders() })
    return handleResponse<Breed>(res)
  },

  search: async (query: string, species?: string) => {
    const qs = new URLSearchParams({ q: query })
    if (species) qs.set('species', species)
    const res = await fetch(`${API_URL}/breeds/search?${qs}`, { headers: getAuthHeaders() })
    return handleResponse<Breed[]>(res)
  },

  getCareGuide: async (id: number) => {
    const res = await fetch(`${API_URL}/breeds/${id}/care-guide`, { headers: getAuthHeaders() })
    return handleResponse<CareGuide>(res)
  },

  petHealthSuggestions: async (petId: number) => {
    const res = await fetch(`${API_URL}/breeds/pet/${petId}/health-suggestions`, { headers: getAuthHeaders() })
    return handleResponse<{
      pet_id: number
      pet_name: string
      phase: string
      phase_label: string
      age_months: number | null
      suggestions: Array<{
        title: string
        description: string
        category: string
        urgency: 'baixa' | 'media' | 'alta'
      }>
    }>(res)
  },

  identifyFromPhoto: async (file: File) => {
    const fd = new FormData()
    fd.append('photo', file)
    const token = typeof window !== 'undefined' ? localStorage.getItem('petlife_token') : null
    const res = await fetch(`${API_URL}/breeds/identify-from-photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    })
    return handleResponse<{
      species: string
      candidates: Array<{
        breed: string
        name_en?: string
        confidence: number
        reasoning?: string
        breed_id: number | null
      }>
      is_mixed_likely: boolean
      notes: string
    }>(res)
  },
}

// ── Vaccines ──────────────────────────────────────────
export const vaccines = {
  list: async (petId?: number) => {
    const qs = petId ? `?pet_id=${petId}` : ''
    const res = await fetch(`${API_URL}/vaccines${qs}`, { headers: getAuthHeaders() })
    return handleResponse<Vaccine[]>(res)
  },

  create: async (data: CreateVaccineData) => {
    const res = await fetch(`${API_URL}/vaccines`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Vaccine>(res)
  },

  update: async (id: number, data: Partial<CreateVaccineData>) => {
    const res = await fetch(`${API_URL}/vaccines/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Vaccine>(res)
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_URL}/vaccines/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    return handleResponse<{ message: string }>(res)
  },

  getUpcoming: async (days?: number) => {
    const qs = days ? `?days=${days}` : ''
    const res = await fetch(`${API_URL}/vaccines/upcoming${qs}`, { headers: getAuthHeaders() })
    return handleResponse<Vaccine[]>(res)
  },

  uploadDocument: async (id: number, file: File) => {
    const token = localStorage.getItem('petlife_token')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/vaccines/${id}/document`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })
    return handleResponse<{ document_url: string }>(res)
  },
}

// ── Exams ─────────────────────────────────────────────
export const exams = {
  list: async (petId?: number) => {
    const qs = petId ? `?pet_id=${petId}` : ''
    const res = await fetch(`${API_URL}/exams${qs}`, { headers: getAuthHeaders() })
    return handleResponse<Exam[]>(res)
  },

  create: async (data: CreateExamData) => {
    const res = await fetch(`${API_URL}/exams`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Exam>(res)
  },

  update: async (id: number, data: Partial<CreateExamData>) => {
    const res = await fetch(`${API_URL}/exams/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Exam>(res)
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_URL}/exams/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    return handleResponse<{ message: string }>(res)
  },

  uploadFile: async (id: number, file: File) => {
    const token = localStorage.getItem('petlife_token')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/exams/${id}/file`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })
    return handleResponse<{ file_url: string }>(res)
  },
}

// ── Anamnesis ─────────────────────────────────────────
export const anamnesis = {
  create: async (data: CreateAnamnesisData) => {
    const res = await fetch(`${API_URL}/anamnesis`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Anamnesis>(res)
  },

  getByPet: async (petId: number) => {
    const res = await fetch(`${API_URL}/anamnesis/pet/${petId}`, { headers: getAuthHeaders() })
    return handleResponse<Anamnesis[]>(res)
  },

  getById: async (id: number) => {
    const res = await fetch(`${API_URL}/anamnesis/${id}`, { headers: getAuthHeaders() })
    return handleResponse<Anamnesis>(res)
  },
}

// ── Routines ──────────────────────────────────────────
export const routines = {
  generate: async (petId: number) => {
    const res = await fetch(`${API_URL}/routines/generate/${petId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    return handleResponse<Routine>(res)
  },

  getByPet: async (petId: number) => {
    const res = await fetch(`${API_URL}/routines/pet/${petId}`, { headers: getAuthHeaders() })
    return handleResponse<Routine[]>(res)
  },

  update: async (id: number, data: Partial<Routine>) => {
    const res = await fetch(`${API_URL}/routines/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Routine>(res)
  },
}

// ── Gamification ──────────────────────────────────────
export const gamification = {
  getChallenges: async () => {
    const res = await fetch(`${API_URL}/gamification/challenges`, { headers: getAuthHeaders() })
    return handleResponse<Challenge[]>(res)
  },

  getUserChallenges: async () => {
    const res = await fetch(`${API_URL}/gamification/user-challenges`, { headers: getAuthHeaders() })
    return handleResponse<UserChallenge[]>(res)
  },

  startChallenge: async (challengeId: number) => {
    const res = await fetch(`${API_URL}/gamification/challenges/${challengeId}/start`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    return handleResponse<UserChallenge>(res)
  },

  completeChallenge: async (userChallengeId: number) => {
    const res = await fetch(`${API_URL}/gamification/user-challenges/${userChallengeId}/complete`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    return handleResponse<UserChallenge>(res)
  },

  getLeaderboard: async () => {
    const res = await fetch(`${API_URL}/gamification/leaderboard`, { headers: getAuthHeaders() })
    return handleResponse<LeaderboardEntry[]>(res)
  },

  getUserPoints: async () => {
    const res = await fetch(`${API_URL}/gamification/points`, { headers: getAuthHeaders() })
    return handleResponse<UserPoints>(res)
  },
}

// ── Reminders ─────────────────────────────────────────
export const reminders = {
  list: async () => {
    const res = await fetch(`${API_URL}/reminders`, { headers: getAuthHeaders() })
    return handleResponse<Reminder[]>(res)
  },

  create: async (data: CreateReminderData) => {
    const res = await fetch(`${API_URL}/reminders`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Reminder>(res)
  },

  update: async (id: number, data: Partial<CreateReminderData>) => {
    const res = await fetch(`${API_URL}/reminders/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Reminder>(res)
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_URL}/reminders/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    return handleResponse<{ message: string }>(res)
  },

  getUpcoming: async (days?: number) => {
    const qs = days ? `?days=${days}` : ''
    const res = await fetch(`${API_URL}/reminders/upcoming${qs}`, { headers: getAuthHeaders() })
    return handleResponse<Reminder[]>(res)
  },

  complete: async (id: number) => {
    const res = await fetch(`${API_URL}/reminders/${id}/complete`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    return handleResponse<Reminder>(res)
  },
}

// ── Search / Nearby ───────────────────────────────────
export const search = {
  nearby: async (lat: number, lon: number, type: string, radius?: number) => {
    const backendType = type === 'veterinary' ? 'vet' : type
    const qs = new URLSearchParams({ lat: String(lat), lon: String(lon), type: backendType })
    if (radius) qs.set('radius', String(radius))
    const res = await fetch(`${API_URL}/search/nearby?${qs}`, { headers: getAuthHeaders() })
    type RawPlace = NearbyPlace & { latitude?: number; longitude?: number }
    const raw = await handleResponse<RawPlace[]>(res)
    return raw.map(p => ({
      ...p,
      lat: p.lat ?? p.latitude,
      lon: p.lon ?? p.longitude,
    })) as NearbyPlace[]
  },
}

// ── Innovations (Bedtime Story + Snapshot Triage) ─────
export const innovations = {
  bedtimeStory: async (pet_id: number, mood: 'carinhoso' | 'aventura' | 'engraçado' | 'calmo' = 'carinhoso') => {
    const res = await fetch(`${API_URL}/innovations/bedtime-story`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pet_id, mood }),
    })
    return handleResponse<{ story: string; pet_name: string; mood: string }>(res)
  },

  snapshotTriage: async (pet_id: number, photo: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('petlife_token') : null
    const fd = new FormData()
    fd.append('pet_id', String(pet_id))
    fd.append('photo', photo)
    const res = await fetch(`${API_URL}/innovations/snapshot-triage`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    })
    return handleResponse<SnapshotTriageResult>(res)
  },

  painAssessment: async (pet_id: number, photo: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('petlife_token') : null
    const fd = new FormData()
    fd.append('pet_id', String(pet_id))
    fd.append('photo', photo)
    const res = await fetch(`${API_URL}/innovations/pain-assessment`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    })
    return handleResponse<PainAssessmentResult>(res)
  },

  stoolAnalysis: async (pet_id: number, photo: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('petlife_token') : null
    const fd = new FormData()
    fd.append('pet_id', String(pet_id))
    fd.append('photo', photo)
    const res = await fetch(`${API_URL}/innovations/stool-analysis`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    })
    return handleResponse<StoolAnalysisResult>(res)
  },

  vetScribe: async (pet_id: number, transcript: string) => {
    const res = await fetch(`${API_URL}/innovations/vet-scribe`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pet_id, transcript }),
    })
    return handleResponse<VetScribeResult>(res)
  },

  // Weight history
  addWeight: async (pet_id: number, weight_kg: number, opts?: { body_condition_score?: number; notes?: string; measured_at?: string }) => {
    const res = await fetch(`${API_URL}/innovations/pets/${pet_id}/weight`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ weight_kg, ...opts }),
    })
    return handleResponse<{ id: number; weight_kg: number; measured_at: string }>(res)
  },

  weightHistory: async (pet_id: number) => {
    const res = await fetch(`${API_URL}/innovations/pets/${pet_id}/weight-history`, { headers: getAuthHeaders() })
    return handleResponse<WeightHistory>(res)
  },

  // Behavior Plans
  createBehaviorPlan: async (pet_id: number, issue_type: BehaviorIssueType, intensity: 'leve' | 'moderada' | 'alta', context?: string) => {
    const res = await fetch(`${API_URL}/innovations/behavior-plans`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pet_id, issue_type, intensity, context }),
    })
    return handleResponse<BehaviorPlanDetail>(res)
  },

  listBehaviorPlans: async () => {
    const res = await fetch(`${API_URL}/innovations/behavior-plans`, { headers: getAuthHeaders() })
    return handleResponse<BehaviorPlanSummary[]>(res)
  },

  getBehaviorPlan: async (id: number) => {
    const res = await fetch(`${API_URL}/innovations/behavior-plans/${id}`, { headers: getAuthHeaders() })
    return handleResponse<BehaviorPlanDetail>(res)
  },

  behaviorCheckIn: async (plan_id: number, day_number: number, progress_score: number, notes?: string) => {
    const res = await fetch(`${API_URL}/innovations/behavior-plans/${plan_id}/check-in`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ day_number, progress_score, notes }),
    })
    return handleResponse<{ id: number; day_number: number; progress_score: number }>(res)
  },

  petlifeWrapped: async (pet_id: number, year?: number) => {
    const qs = year ? `?year=${year}` : ''
    const res = await fetch(`${API_URL}/innovations/petlife-wrapped/${pet_id}${qs}`, { headers: getAuthHeaders() })
    return handleResponse<PetLifeWrapped>(res)
  },

  // Behavior Log
  addBehaviorLog: async (pet_id: number, body: BehaviorLogEntry) => {
    const res = await fetch(`${API_URL}/innovations/pets/${pet_id}/behavior-log`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    })
    return handleResponse<{ id: number; logged_at: string }>(res)
  },

  getBehaviorLogs: async (pet_id: number, days = 30) => {
    const res = await fetch(`${API_URL}/innovations/pets/${pet_id}/behavior-log?days=${days}`, { headers: getAuthHeaders() })
    return handleResponse<BehaviorLogsResponse>(res)
  },

  analyzeBehaviorPatterns: async (pet_id: number, days = 30) => {
    const res = await fetch(`${API_URL}/innovations/pets/${pet_id}/behavior-patterns?days=${days}`, { headers: getAuthHeaders() })
    return handleResponse<BehaviorPatternsResult>(res)
  },

  // Senior protocol
  seniorProtocol: async (pet_id: number) => {
    const res = await fetch(`${API_URL}/innovations/pets/${pet_id}/senior-protocol`, { headers: getAuthHeaders() })
    return handleResponse<SeniorProtocolResult>(res)
  },

  // Memorial
  setMemorial: async (pet_id: number, owner_message?: string, deceased_at?: string) => {
    const res = await fetch(`${API_URL}/innovations/pets/${pet_id}/memorial`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ owner_message, deceased_at }),
    })
    return handleResponse<MemorialResult>(res)
  },

  // Stories
  addStory: async (pet_id: number, photo: File, user_caption?: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('petlife_token') : null
    const fd = new FormData()
    fd.append('photo', photo)
    if (user_caption) fd.append('user_caption', user_caption)
    const res = await fetch(`${API_URL}/innovations/pets/${pet_id}/stories`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    })
    return handleResponse<StoryEntry>(res)
  },

  listStories: async (pet_id: number) => {
    const res = await fetch(`${API_URL}/innovations/pets/${pet_id}/stories`, { headers: getAuthHeaders() })
    return handleResponse<StoryEntry[]>(res)
  },

  deleteStory: async (story_id: number) => {
    const res = await fetch(`${API_URL}/innovations/stories/${story_id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('Erro ao apagar')
  },
}

export interface BehaviorLogEntry {
  mood?: 'feliz' | 'neutro' | 'apatico' | 'ansioso' | 'agitado'
  energy?: number
  appetite?: 'normal' | 'reduzido' | 'aumentado' | 'recusou'
  water_intake?: 'normal' | 'reduzido' | 'aumentado'
  stool_quality?: number
  activity_minutes?: number
  notes?: string
}

export interface BehaviorLogsResponse {
  pet_id: number
  pet_name: string
  days_requested: number
  logs: Array<BehaviorLogEntry & { id: number; logged_at: string }>
}

export interface BehaviorPatternsResult {
  summary: string
  patterns: Array<{ observation: string; significance: string }>
  trends?: { mood_trend?: string; energy_trend?: string; appetite_trend?: string }
  alerts: Array<{ signal: string; concern: string; severity: string; action: string }>
  recommendations?: string[]
  disclaimer?: string
  logs_count: number
}

export interface SeniorProtocolResult {
  is_senior: boolean
  pet_name?: string
  age_years?: number
  species?: string
  life_stage?: string
  becomes_senior_at?: string
  message?: string
  exams_protocol?: Array<{ name: string; frequency: string; reason: string }>
  supplements_to_discuss?: Array<{ name: string; purpose: string }>
  lifestyle_recommendations?: string[]
  early_warning_signs?: string[]
  disclaimer?: string
}

export interface MemorialResult {
  pet_id: number
  pet_name: string
  deceased_at: string
  memorial_text: string
  epitaph?: string
  comfort_message?: string
  memorial_url: string
}

export interface StoryEntry {
  id: number
  photo_url: string
  user_caption: string | null
  ai_caption: string | null
  ai_emotion: string | null
  created_at: string
}

export type BehaviorIssueType = 'separation_anxiety' | 'fear' | 'reactivity' | 'aggression' | 'destruction' | 'barking' | 'cat_litter'

export interface WeightHistory {
  pet_id: number
  pet_name: string
  breed_weight_range: string | null
  current_weight: number | null
  entries: Array<{
    id: number
    weight_kg: number
    body_condition_score: number | null
    source: string
    measured_at: string
    notes: string | null
  }>
  alert: { type: 'ganho' | 'perda'; severity: 'media' | 'alta'; message: string } | null
}

export interface BehaviorPlanSummary {
  id: number
  pet_id: number
  pet_name: string
  issue_type: BehaviorIssueType
  intensity: 'leve' | 'moderada' | 'alta'
  status: 'active' | 'completed' | 'paused' | 'abandoned'
  duration_weeks: number
  created_at: string
  completed_at: string | null
  check_ins_count: number
  average_progress: number | null
}

export interface BehaviorPlanDetail extends BehaviorPlanSummary {
  plan_data: {
    issue_label: string
    summary: string
    core_principles: string[]
    warning_signs: string[]
    weeks: Array<{
      week: number
      focus: string
      daily_exercises: Array<{ day: number; title: string; duration_min: number; description: string }>
      milestone: string
    }>
    tools_needed: string[]
    when_to_seek_help: string
    disclaimer: string
  }
  context_notes: string | null
  check_ins: Array<{ day_number: number; progress_score: number; notes: string | null; completed_at: string }>
}

export interface PetLifeWrapped {
  pet_id: number
  pet_name: string
  year: number
  title: string
  subtitle: string
  highlights: Array<{ emoji: string; stat: string | number; label: string; narrative: string }>
  milestone_of_the_year?: string
  personality_tag?: string
  narrative: string
  next_year_wish?: string
  share_text: string
  raw_stats: Record<string, number | string>
}

export interface PainAssessmentResult {
  pet_name: string
  species: string
  image_quality: 'ok' | 'ruim'
  image_quality_notes?: string
  scale: string
  total_score?: number | string
  max_possible?: number | string
  pain_level: 'sem dor' | 'leve' | 'moderada' | 'severa'
  interpretation: string
  recommendations: string[]
  disclaimer: string
  // species-specific fields stored loose
  ears?: { score: number | null; notes: string }
  orbitals?: { score: number | null; notes: string }
  muzzle?: { score: number | null; notes: string }
  whiskers?: { score: number | null; notes: string }
  head_position?: { score: number | null; notes: string }
  facial_expression?: { score: number | null; notes: string }
  posture?: { score: number | null; notes: string }
  attention_to_body?: { score: number | null; notes: string }
}

export interface StoolAnalysisResult {
  pet_name: string
  image_quality: 'ok' | 'ruim'
  image_quality_notes?: string
  fecal_score: number | null
  ideal_range: string
  color: string
  color_notes: string
  alerts: string[]
  consistency_notes: string
  urgency: 'rotina' | 'acompanhar' | 'vet_agendar' | 'vet_urgente'
  summary: string
  recommendations: string[]
  disclaimer: string
}

export interface VetScribeResult {
  pet_id: number
  pet_name: string
  subjective: string
  objective: string
  assessment: string
  plan: {
    diagnostic?: string[]
    therapeutic?: string[]
    preventive?: string[]
    recommendations?: string[]
    follow_up?: string
  }
  icd_codes?: string[]
  prescription_summary?: string
  owner_friendly_summary?: string
}

export interface SnapshotTriageResult {
  pet_name: string
  image_quality: 'ok' | 'ruim'
  image_quality_notes: string
  body_condition_score: number | null
  body_condition_notes: string
  eyes: { visible: boolean; concerns: string[]; severity: string }
  dental: { visible: boolean; tartar_level: string; concerns: string[] }
  skin_coat: { concerns: string[]; severity: string }
  posture_behavior: string
  urgency_tier: 'rotina' | 'acompanhar' | 'agendar_vet' | 'vet_urgente'
  summary: string
  recommendations: string[]
  disclaimer: string
}

// ── Vet ───────────────────────────────────────────────
export const vet = {
  registerClinic: async (data: RegisterClinicData) => {
    const res = await fetch(`${API_URL}/vet/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse<{ access_token: string; clinic: Clinic }>(res)
  },

  vetLogin: async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/vet/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return handleResponse<{ access_token: string; clinic: Clinic }>(res)
  },

  getPatients: async (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : ''
    const res = await fetch(`${API_URL}/vet/patients${qs}`, { headers: getAuthHeaders() })
    return handleResponse<VetPatient[]>(res)
  },

  getPatientHistory: async (petId: number) => {
    const res = await fetch(`${API_URL}/vet/patients/${petId}/history`, { headers: getAuthHeaders() })
    return handleResponse<PatientHistory>(res)
  },

  addConsultation: async (petId: number, data: ConsultationData) => {
    const res = await fetch(`${API_URL}/vet/patients/${petId}/consultations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<Consultation>(res)
  },
}

// ── AI ────────────────────────────────────────────────
export const ai = {
  chat: async (message: string, petId?: number) => {
    const res = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message, pet_id: petId }),
    })
    return handleResponse<{ response: string }>(res)
  },

  analyzeAnamnesis: async (anamnesisId: number) => {
    const res = await fetch(`${API_URL}/ai/anamnesis/${anamnesisId}/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    return handleResponse<AIAnalysis>(res)
  },
}

// ── Types ─────────────────────────────────────────────
export interface User {
  id: number
  name: string
  email: string
  phone?: string
  avatar_url?: string
  is_vet?: boolean
  points?: number
  level?: number
  badge?: string
  created_at?: string
}

export interface Pet {
  id: number
  name: string
  species: 'dog' | 'cat' | 'other'
  breed_id?: number
  breed?: Breed
  birth_date?: string
  weight?: number
  color?: string
  gender?: 'male' | 'female'
  neutered?: boolean
  microchip?: string
  bio?: string
  photo_url?: string
  owner_id?: number
  created_at?: string
}

export interface CreatePetData {
  name: string
  species: 'dog' | 'cat' | 'other'
  breed_id?: number
  birth_date?: string
  weight?: number
  color?: string
  gender?: 'male' | 'female'
  neutered?: boolean
  microchip?: string
  bio?: string
}

export interface PetFullProfile {
  pet: Pet
  vaccines: Vaccine[]
  exams: Exam[]
  routines: Routine[]
  anamnesis: Anamnesis[]
  reminders: Reminder[]
}

export interface Breed {
  id: number
  name: string
  species: 'dog' | 'cat'
  size?: 'small' | 'medium' | 'large' | 'giant'
  energy_level?: number
  grooming_needs?: number
  temperament?: string[]
  life_expectancy_min?: number
  life_expectancy_max?: number
  weight_min?: number
  weight_max?: number
  description?: string
  characteristics?: string
}

export interface CareGuide {
  breed_id: number
  feeding_tips: string
  exercise_recommendations: string
  grooming_guide: string
  health_alerts: string
  training_tips: string
  generated_at?: string
}

export interface Vaccine {
  id: number
  pet_id: number
  pet?: Pet
  name: string
  date_applied: string
  next_due_date?: string
  vet_name?: string
  lot_number?: string
  document_url?: string
  notes?: string
  status?: 'up_to_date' | 'upcoming' | 'overdue'
}

export interface CreateVaccineData {
  pet_id: number
  name: string
  date_applied: string
  next_due_date?: string
  vet_name?: string
  lot_number?: string
  notes?: string
}

export interface Exam {
  id: number
  pet_id: number
  pet?: Pet
  name: string
  type: string
  date: string
  result?: string
  vet_name?: string
  file_url?: string
  notes?: string
  created_at?: string
}

export interface CreateExamData {
  pet_id: number
  name: string
  type: string
  date: string
  result?: string
  vet_name?: string
  notes?: string
}

export interface Anamnesis {
  id: number
  pet_id: number
  symptoms: string
  duration?: string
  behavior_changes?: string
  appetite?: string
  water_intake?: string
  medications?: string
  notes?: string
  ai_analysis?: AIAnalysis
  created_at: string
}

export interface CreateAnamnesisData {
  pet_id: number
  symptoms: string
  duration?: string
  behavior_changes?: string
  appetite?: string
  water_intake?: string
  medications?: string
  notes?: string
}

export interface AIAnalysis {
  urgency_level: 'low' | 'medium' | 'high' | 'emergency'
  summary: string
  recommendations: string[]
  possible_conditions?: string[]
  seek_vet_immediately?: boolean
}

export interface Routine {
  id: number
  pet_id: number
  walks_per_day: number
  walk_duration_minutes: number
  walk_times: string[]
  exercise_type?: string
  tips?: string[]
  generated_at?: string
  created_at?: string
}

export interface Challenge {
  id: number
  title: string
  description: string
  category: string
  points: number
  difficulty: 'easy' | 'medium' | 'hard'
  duration_days?: number
  icon?: string
  requirements?: string[]
}

export interface UserChallenge {
  id: number
  challenge_id: number
  challenge?: Challenge
  status: 'active' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  progress?: number
}

export interface LeaderboardEntry {
  rank: number
  user_id: number
  user_name: string
  points: number
  level: number
  badge?: string
}

export interface UserPoints {
  total_points: number
  level: number
  level_name: string
  badge: string
  points_to_next_level: number
  badges_earned: string[]
}

export interface Reminder {
  id: number
  pet_id?: number
  pet?: Pet
  title: string
  description?: string
  due_date: string
  type: string
  completed: boolean
  completed_at?: string
}

export interface CreateReminderData {
  pet_id?: number
  title: string
  description?: string
  due_date: string
  type: string
}

export interface NearbyPlace {
  name: string
  address: string
  phone?: string
  rating?: number
  distance_km?: number
  lat?: number
  lon?: number
  type: string
  open_now?: boolean
}

export interface RegisterClinicData {
  clinic_name: string
  cnpj: string
  phone: string
  email: string
  password: string
  address: string
  specialty?: string
}

export interface Clinic {
  id: number
  clinic_name: string
  cnpj: string
  phone: string
  email: string
  address: string
  specialty?: string
}

export interface VetPatient {
  pet_id: number
  pet_name: string
  species: string
  breed?: string
  owner_name: string
  owner_phone?: string
  last_visit?: string
  alerts?: string[]
  photo_url?: string
}

export interface PatientHistory {
  pet: Pet
  owner: User
  vaccines: Vaccine[]
  exams: Exam[]
  anamnesis: Anamnesis[]
  consultations: Consultation[]
}

export interface Consultation {
  id: number
  pet_id: number
  vet_id?: number
  date: string
  diagnosis?: string
  treatment?: string
  notes?: string
  follow_up_date?: string
  created_at?: string
}

export interface ConsultationData {
  date: string
  diagnosis?: string
  treatment?: string
  notes?: string
  follow_up_date?: string
}
