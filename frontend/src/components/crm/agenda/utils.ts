import type { Appt } from '@/lib/crmApi'
import { APPT_STATUS, APPT_TYPE, toDate } from '../ui'

/** Altura de uma hora na grade, em px. */
export const HOUR_PX = 64
export const SNAP_MIN = 15
export const DEFAULT_START_HOUR = 7
export const DEFAULT_END_HOUR = 21

/** Situações que não se arrastam nem entram em conflito. */
export const LOCKED_STATUS = ['concluido', 'cancelado', 'faltou']
/** Situações em que ainda dá para ir ao caixa. */
export const OPEN_STATUS = ['agendado', 'confirmado', 'chegou', 'em_atendimento', 'pronto']

export const startOf = (a: Appt) => toDate(a.starts_at)
export const durationOf = (a: Appt) => {
  if (a.duration_min && a.duration_min > 0) return a.duration_min
  if (a.ends_at) {
    const m = Math.round((toDate(a.ends_at).getTime() - toDate(a.starts_at).getTime()) / 60000)
    if (m > 0) return m
  }
  return 30
}
export const endOf = (a: Appt) => new Date(startOf(a).getTime() + durationOf(a) * 60000)

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
export const fmtDuration = (min: number) => {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export const serviceOf = (a: Appt) => a.item_name || APPT_TYPE[a.type] || 'Atendimento'
export const statusLabel = (s: string) => APPT_STATUS[s]?.label ?? s

/** Texto do leitor de tela para um atendimento: '10:30, Thor, Banho, Confirmado'. */
export const apptAria = (a: Appt) =>
  [hhmm(startOf(a)), a.patient_name || a.client_name || 'Sem pet', serviceOf(a), statusLabel(a.status), a.is_fit_in ? 'encaixe' : '']
    .filter(Boolean).join(', ')

const WD_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Mensagem de confirmação pelo WhatsApp (sem emoji, curta). */
export function confirmText(a: Appt, clinicName?: string | null) {
  const first = (a.client_name || '').trim().split(/\s+/)[0]
  const d = startOf(a)
  const today = new Date()
  const when = sameDay(d, today) ? 'hoje' : sameDay(d, addDays(today, 1)) ? 'amanhã'
    : `${WD_LONG[d.getDay()]}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
  const what = serviceOf(a).toLowerCase()
  const pet = a.patient_name ? ` de ${a.patient_name}` : ''
  const where = clinicName ? ` na ${clinicName}` : ''
  return `Olá${first ? `, ${first}` : ''}! Passando para confirmar ${what}${pet}${where} ${when} às ${hhmm(d)}. Podemos confirmar?`
}

/** Mensagem de "pet pronto para retirar". */
export function readyText(a: Appt, clinicName?: string | null) {
  const first = (a.client_name || '').trim().split(/\s+/)[0]
  const pet = a.patient_name || 'Seu pet'
  return `Olá${first ? `, ${first}` : ''}! ${pet} já está pronto para retirar${clinicName ? ` na ${clinicName}` : ''}. Esperamos você.`
}

export interface Placed { appt: Appt; startMin: number; endMin: number; lane: number; lanes: number }

/**
 * Posiciona atendimentos que se sobrepõem lado a lado: agrupa por interseção
 * e distribui cada grupo em faixas (a primeira faixa livre).
 */
export function layoutColumn(list: Appt[], day: Date): Placed[] {
  const base = startOfDay(day).getTime()
  const items = list
    .map(a => {
      const s = Math.round((startOf(a).getTime() - base) / 60000)
      return { appt: a, startMin: s, endMin: s + Math.max(durationOf(a), 15), lane: 0, lanes: 1 }
    })
    .sort((x, y) => x.startMin - y.startMin || y.endMin - x.endMin)
  const out: Placed[] = []
  let group: Placed[] = []
  let laneEnds: number[] = []
  let groupEnd = -Infinity
  const flush = () => {
    const n = laneEnds.length || 1
    group.forEach(p => { p.lanes = n })
    out.push(...group)
    group = []
    laneEnds = []
  }
  for (const it of items) {
    if (it.startMin >= groupEnd && group.length) flush()
    let lane = laneEnds.findIndex(e => e <= it.startMin)
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(it.endMin) } else laneEnds[lane] = it.endMin
    it.lane = lane
    group.push(it)
    groupEnd = Math.max(groupEnd === -Infinity ? it.endMin : groupEnd, it.endMin)
  }
  if (group.length) flush()
  return out
}

/** Faixa de horas visível: 07–21, ampliada para caber tudo o que houver. */
export function hourRange(list: Appt[]): [number, number] {
  let a = DEFAULT_START_HOUR
  let b = DEFAULT_END_HOUR
  for (const x of list) {
    const s = startOf(x)
    const e = endOf(x)
    a = Math.min(a, s.getHours())
    const endH = sameDay(s, e) ? e.getHours() + (e.getMinutes() > 0 ? 1 : 0) : 24
    b = Math.max(b, endH)
  }
  return [Math.max(0, a), Math.min(24, b)]
}

export const roundTo = (min: number, step = SNAP_MIN) => Math.round(min / step) * step

const LS_KEY = 'crm_agenda_v1'
export type AgendaView = 'dia' | 'semana' | 'lista'
export function readPrefs(): { view?: AgendaView; staff?: number | null } {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw)
    const view = p?.view === 'dia' || p?.view === 'semana' || p?.view === 'lista' ? p.view as AgendaView : undefined
    const staff = typeof p?.staff === 'number' ? p.staff : null
    return { view, staff }
  } catch {
    return {}
  }
}
export function writePrefs(p: { view: AgendaView; staff: number | null }) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)) } catch { /* sem armazenamento: segue sem lembrar */ }
}
