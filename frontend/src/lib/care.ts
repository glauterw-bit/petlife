/**
 * Situação de cuidado por pet — lógica pura (sem React), calculada no cliente.
 *
 * Responde "meu pet está protegido?" item a item (vacinas, vermífugo,
 * antipulgas), sempre com texto além da cor. Nada de nota agregada.
 *
 * Por que no cliente: a rota /reminders/upcoming filtra next_due >= hoje, então
 * vacinas VENCIDAS sumiam do Início. E doses antigas (já reforçadas) ficavam
 * "atrasadas" para sempre. Aqui só a dose mais recente de cada vacina conta.
 */
import type { Pet, Vaccine, ProtectionPetSummary } from '@/lib/api'

export type CareState = 'ok' | 'soon' | 'overdue' | 'never'
export type CareKind = 'vaccines' | 'vermifugo' | 'antipulgas'

export interface CareItem {
  kind: CareKind
  state: CareState
  /** Dias até vencer (negativo = atrasado). null quando não há data. */
  daysLeft: number | null
  dueDate: string | null
  /** Só no item de vacinas: a vacina que define a situação (a pior). */
  vaccineName?: string
  vaccineId?: number
}

export interface PetCareSummary {
  pet: Pet
  items: [CareItem, CareItem, CareItem]
  worst: CareState
  /** O item mais urgente entre atrasado e vence em breve, ou null. */
  next: CareItem | null
}

/** Janela de "vence em breve", em dias. */
export const SOON_DAYS = 30

/** Peso de gravidade — maior = pior. "Sem registro" fica entre em breve e em dia. */
const SEVERITY: Record<CareState, number> = { overdue: 3, soon: 2, never: 1, ok: 0 }

export function severity(s: CareState): number {
  return SEVERITY[s]
}

export function normalizeVaccineName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Data local (meia-noite) a partir de 'YYYY-MM-DD' ou ISO completo. */
function parseDay(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(iso)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function today(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

/** Dias inteiros de hoje até a data (0 = hoje, negativo = no passado). */
export function daysUntil(iso: string): number {
  const ms = parseDay(iso).getTime() - today().getTime()
  return Math.round(ms / 86_400_000)
}

function timeOf(iso: string | undefined | null): number {
  if (!iso) return 0
  const t = parseDay(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

function doseKey(v: Vaccine): string {
  return `${v.pet_id}::${normalizeVaccineName(v.name)}`
}

/** A dose de maior date_given por (pet, nome normalizado). */
export function latestDoses(vaccines: Vaccine[]): Vaccine[] {
  const best = new Map<string, Vaccine>()
  for (const v of vaccines) {
    const k = doseKey(v)
    const cur = best.get(k)
    if (
      !cur ||
      timeOf(v.date_given) > timeOf(cur.date_given) ||
      (timeOf(v.date_given) === timeOf(cur.date_given) && v.id > cur.id)
    ) {
      best.set(k, v)
    }
  }
  return Array.from(best.values())
}

/** True quando existe dose mais recente da mesma vacina para o mesmo pet. */
export function isSuperseded(v: Vaccine, all: Vaccine[]): boolean {
  const k = doseKey(v)
  return all.some(
    o =>
      o.id !== v.id &&
      doseKey(o) === k &&
      (timeOf(o.date_given) > timeOf(v.date_given) ||
        (timeOf(o.date_given) === timeOf(v.date_given) && o.id > v.id)),
  )
}

export function vaccineState(v: Vaccine): Exclude<CareState, 'never'> {
  if (!v.next_due) return 'ok'
  const d = daysUntil(v.next_due)
  if (d < 0) return 'overdue'
  if (d <= SOON_DAYS) return 'soon'
  return 'ok'
}

/** Atrasadas > vencendo > em dia; dentro do grupo, a data mais próxima primeiro. */
export function sortByUrgency(vaccines: Vaccine[]): Vaccine[] {
  return [...vaccines].sort((a, b) => {
    const s = SEVERITY[vaccineState(b)] - SEVERITY[vaccineState(a)]
    if (s !== 0) return s
    const da = a.next_due ? timeOf(a.next_due) : Number.POSITIVE_INFINITY
    const db = b.next_due ? timeOf(b.next_due) : Number.POSITIVE_INFINITY
    if (da !== db) return da - db
    return a.name.localeCompare(b.name)
  })
}

const RABIES = ['antirrab', 'antirab', 'raiva', 'rabies', 'rabica', 'rabia']

/** A dose mais recente de antirrábica do pet, ou null. */
export function findRabies(vaccines: Vaccine[], petId: number): Vaccine | null {
  let best: Vaccine | null = null
  for (const v of vaccines) {
    if (v.pet_id !== petId) continue
    const n = normalizeVaccineName(v.name)
    if (!RABIES.some(r => n.includes(r))) continue
    if (!best || timeOf(v.date_given) > timeOf(best.date_given)) best = v
  }
  return best
}

function vaccinesItem(petVaccines: Vaccine[]): CareItem {
  const latest = latestDoses(petVaccines)
  if (latest.length === 0) {
    return { kind: 'vaccines', state: 'never', daysLeft: null, dueDate: null }
  }
  const [top] = sortByUrgency(latest)
  return {
    kind: 'vaccines',
    state: vaccineState(top),
    daysLeft: top.next_due ? daysUntil(top.next_due) : null,
    dueDate: top.next_due ?? null,
    vaccineName: top.name,
    vaccineId: top.id,
  }
}

function protectionItem(kind: 'vermifugo' | 'antipulgas', p: ProtectionPetSummary | undefined): CareItem {
  const k = p?.kinds.find(x => x.kind === kind)
  if (!k || k.status === 'never') {
    return { kind, state: 'never', daysLeft: null, dueDate: null }
  }
  const state: CareState = k.status === 'due_soon' ? 'soon' : k.status
  const daysLeft = k.next_due ? daysUntil(k.next_due) : k.days_left
  return { kind, state, daysLeft: daysLeft ?? null, dueDate: k.next_due }
}

function pickNext(items: CareItem[]): CareItem | null {
  const urgent = items.filter(i => i.state === 'overdue' || i.state === 'soon')
  if (!urgent.length) return null
  urgent.sort((a, b) => {
    const s = SEVERITY[b.state] - SEVERITY[a.state]
    if (s !== 0) return s
    return (a.daysLeft ?? 0) - (b.daysLeft ?? 0)
  })
  return urgent[0]
}

function worstOf(states: CareState[]): CareState {
  let w: CareState = 'ok'
  for (const s of states) if (SEVERITY[s] > SEVERITY[w]) w = s
  return w
}

/**
 * Um resumo por pet, com o pior primeiro. Pets sem nenhuma vacina recebem o
 * item de vacinas 'never'. Proteções: due_soon → soon; o resto igual.
 */
export function buildCareSummaries(
  pets: Pet[],
  vaccines: Vaccine[],
  protections: ProtectionPetSummary[],
): PetCareSummary[] {
  const byPet = new Map<number, Vaccine[]>()
  for (const v of vaccines) {
    const arr = byPet.get(v.pet_id)
    if (arr) arr.push(v)
    else byPet.set(v.pet_id, [v])
  }
  const protByPet = new Map(protections.map(p => [p.pet_id, p]))

  const out = pets.map((pet, index) => {
    const items: [CareItem, CareItem, CareItem] = [
      vaccinesItem(byPet.get(pet.id) ?? []),
      protectionItem('vermifugo', protByPet.get(pet.id)),
      protectionItem('antipulgas', protByPet.get(pet.id)),
    ]
    return { summary: { pet, items, worst: worstOf(items.map(i => i.state)), next: pickNext(items) }, index }
  })

  out.sort((a, b) => {
    const s = SEVERITY[b.summary.worst] - SEVERITY[a.summary.worst]
    if (s !== 0) return s
    const an = a.summary.next?.daysLeft ?? Number.POSITIVE_INFINITY
    const bn = b.summary.next?.daysLeft ?? Number.POSITIVE_INFINITY
    if (an !== bn) return an - bn
    return a.index - b.index // estável: mantém a ordem original dos pets
  })
  return out.map(o => o.summary)
}

/** Pior situação entre todos os pets ('never' quando não há pet). */
export function overallState(s: PetCareSummary[]): CareState {
  if (!s.length) return 'never'
  return worstOf(s.map(x => x.worst))
}

// ── Intervalos e idade ────────────────────────────────────────────────────

/**
 * Opções de intervalo (em dias) oferecidas no registro de antiparasitário.
 * São OPÇÕES, não recomendação: cada produto tem o seu intervalo. A UI sempre
 * mostra "siga o intervalo da bula" junto destas opções.
 */
export const PROTECTION_INTERVALS = {
  vermifugo: [15, 30, 60, 90, 180],
  antipulgas: [30, 35, 60, 84, 90, 240],
} as const

/** Idade em semanas completas a partir de 'YYYY-MM-DD' (ou ISO). null sem data válida ou no futuro. */
export function ageInWeeks(birth_date?: string | null): number | null {
  if (!birth_date) return null
  const b = parseDay(birth_date)
  const t = b.getTime()
  if (!Number.isFinite(t)) return null
  const days = Math.round((today().getTime() - t) / 86_400_000)
  if (days < 0) return null
  return Math.floor(days / 7)
}

/**
 * Prazo padrão da próxima dose ao registrar uma vacina.
 *
 * WSAVA 2024 (Guidelines for the Vaccination of Dogs and Cats): a série de
 * filhote é repetida a cada 2 a 4 semanas até 16 semanas de idade ou mais.
 * Por isso, abaixo de 16 semanas sugerimos 21 dias; depois, 365 dias (o
 * tutor/vet pode ajustar — é sugestão, não prescrição).
 */
export function vaccineNextDueDays(birth_date?: string | null): { days: number; puppy: boolean } {
  const w = ageInWeeks(birth_date)
  if (w != null && w < 16) return { days: 21, puppy: true }
  return { days: 365, puppy: false }
}

// ── Sugestões coerentes com o estado real ──────────────────────────────────

/**
 * Grupos de vacina reconhecidos nos títulos das sugestões (backend
 * health_protocols.py) e nos nomes digitados pelo tutor. Nomes comerciais
 * variam; aqui só casamos famílias inequívocas.
 */
const VACCINE_GROUPS: { id: string; test: (n: string) => boolean }[] = [
  { id: 'rabies', test: n => RABIES.some(r => n.includes(r)) },
  // Múltipla/polivalente em pt, es e en: as sugestões em inglês chegam como
  // "DHPP"/"FVRCP" e em espanhol como "polivalente"/"trivalente felina".
  { id: 'multi', test: n => /\bv\s?(3|4|5|8|10)\b/.test(n) || /\b(dhpp|da2pp|dapp|dhlpp|fvrcp)\b/.test(n) || /polivalente|multipla|multiple|trivalente|triplice|quadrupla|quintupla/.test(n) },
  { id: 'felv', test: n => n.includes('felv') || n.includes('leucemia') },
  { id: 'giardia', test: n => n.includes('giardia') },
  { id: 'kennel', test: n => n.includes('bordetella') || n.includes('tosse') || n.includes('gripe') || n.includes('influenza') },
  { id: 'leish', test: n => n.includes('leish') },
]

export interface ReconciledSuggestion {
  /** Estado real do item pedido pela sugestão; null quando não dá para casar. */
  state: CareState | null
  kind?: CareKind
  vaccineName?: string
  vaccineId?: number
}

/**
 * Casa uma sugestão da ficha ("Reforço anual antirrábica", "Vermífugo
 * trimestral"...) com o que o pet já tem registrado, para a ficha nunca
 * sugerir com "prioridade" algo que está em dia, nem esconder que venceu.
 *
 * - 'vacina': compara pelo nome normalizado da dose MAIS RECENTE de cada
 *   vacina do pet. Se o título cita mais de um grupo (ex.: "antirrábica +
 *   V8/V10"), devolve o pior estado; se cita um grupo que o pet não tem,
 *   devolve 'never'.
 * - 'vermífugo' → item vermifugo do resumo; 'parasitas' → item antipulgas.
 * - Qualquer outra categoria (consulta, exame...) → state null.
 */
export function reconcileSuggestion(
  s: { category: string; title: string },
  summary: PetCareSummary,
  vaccines: Vaccine[],
): ReconciledSuggestion {
  const cat = normalizeVaccineName(s.category)
  if (cat.startsWith('vermifug')) {
    const it = summary.items.find(i => i.kind === 'vermifugo')
    return { state: it?.state ?? 'never', kind: 'vermifugo' }
  }
  if (cat.startsWith('parasita')) {
    const it = summary.items.find(i => i.kind === 'antipulgas')
    return { state: it?.state ?? 'never', kind: 'antipulgas' }
  }
  if (!cat.startsWith('vacina')) return { state: null }

  const title = normalizeVaccineName(s.title)
  const wanted = VACCINE_GROUPS.filter(g => g.test(title))
  if (!wanted.length) return { state: null, kind: 'vaccines' }

  const petId = summary.pet.id
  const latest = latestDoses(vaccines.filter(v => v.pet_id === petId))
  let worst: { state: CareState; dose?: Vaccine } | null = null
  for (const g of wanted) {
    const doses = latest.filter(v => g.test(normalizeVaccineName(v.name)))
    let cand: { state: CareState; dose?: Vaccine }
    if (!doses.length) {
      cand = { state: 'never' }
    } else {
      // Várias marcas do mesmo grupo: vale a aplicada por último.
      const dose = doses.reduce((a, b) => (timeOf(b.date_given) > timeOf(a.date_given) ? b : a))
      cand = { state: vaccineState(dose), dose }
    }
    if (!worst || SEVERITY[cand.state] > SEVERITY[worst.state]) worst = cand
  }
  return {
    state: worst!.state,
    kind: 'vaccines',
    vaccineName: worst!.dose?.name,
    vaccineId: worst!.dose?.id,
  }
}

// ── Idade em "anos humanos" (só cães) ──────────────────────────────────────

/**
 * Idade aproximada em anos humanos para CÃES com 1 ano ou mais.
 *
 * Fonte: Wang T. et al. "Quantitative Translation of Dog-to-Human Aging by
 * Conserved Remodeling of the DNA Methylome". Cell Systems 11, 2020.
 * doi:10.1016/j.cels.2020.06.006 — idade humana ≈ 16·ln(idade do cão) + 31.
 * O estudo usou Labradores; raças de outros portes envelhecem em ritmos
 * diferentes, então a UI sempre mostra isto como aproximação, com a ressalva.
 * Abaixo de 1 ano o ajuste do log não é confiável → null.
 * Para gatos não há fórmula equivalente com fonte → não usamos.
 */
export function dogHumanAge(pet: Pick<Pet, 'species' | 'birth_date'>): number | null {
  if (pet.species !== 'dog' || !pet.birth_date) return null
  const b = parseDay(pet.birth_date).getTime()
  if (!Number.isFinite(b)) return null
  const years = (today().getTime() - b) / (365.25 * 86_400_000)
  if (!(years >= 1)) return null
  return Math.round(16 * Math.log(years) + 31)
}
