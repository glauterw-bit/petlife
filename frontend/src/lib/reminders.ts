/**
 * Lembretes com hora e repetição — lógica pura (sem React).
 *
 * DATAS: o app manda due_date "ingênuo", na hora LOCAL e sem 'Z'
 * ('2026-10-26T08:00:00'), e o backend guarda como chega. Por isso aqui
 * nunca passamos por toISOString() (que converteria para UTC) nem por
 * new Date(iso) em strings sem fuso de forma ambígua: lemos os números.
 *
 * Tolerante a servidores antigos: repeat_days / repeat_until podem faltar.
 */
import { BellRing, Pill, Scissors, Stethoscope, type LucideIcon } from 'lucide-react'
import { reminders as remindersApi, type Reminder } from '@/lib/api'

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DDTHH:mm:00' na hora local, sem fuso. */
export function toNaiveISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

/**
 * Date local a partir do ISO do backend, sem conversão de fuso: os números
 * de data e hora são lidos como hora local. Aceita 'YYYY-MM-DD',
 * 'YYYY-MM-DDTHH:mm[:ss[.fff]]' e ignora um sufixo 'Z'/'+hh:mm' se vier.
 */
export function parseReminderDate(iso: string | null | undefined): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(iso || '')
  if (!m) {
    const d = new Date(iso || '')
    return Number.isFinite(d.getTime()) ? d : new Date(NaN)
  }
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    m[4] ? Number(m[4]) : 0,
    m[5] ? Number(m[5]) : 0,
    m[6] ? Number(m[6]) : 0,
  )
}

/** True quando o lembrete tem hora marcada (diferente de 00:00). */
export function reminderHasTime(r: Pick<Reminder, 'due_date'>): boolean {
  const d = parseReminderDate(r.due_date)
  return Number.isFinite(d.getTime()) && (d.getHours() !== 0 || d.getMinutes() !== 0)
}

/** Fim do dia local de repeat_until (a repetição vale o dia inteiro). */
function untilLimit(r: Pick<Reminder, 'repeat_until'>): number {
  if (!r.repeat_until) return Number.POSITIVE_INFINITY
  const u = parseReminderDate(r.repeat_until)
  if (!Number.isFinite(u.getTime())) return Number.POSITIVE_INFINITY
  return new Date(u.getFullYear(), u.getMonth(), u.getDate(), 23, 59, 59, 999).getTime()
}

/**
 * Próximas ocorrências do lembrete de `fromDate` até `fromDate + maxDays`
 * (inclusive), respeitando repeat_until. Sem repetição, devolve a própria
 * data se cair na janela. Lembrete concluído não gera ocorrências (o
 * servidor cria a próxima ao concluir).
 */
export function nextOccurrences(
  r: Pick<Reminder, 'due_date' | 'repeat_days' | 'repeat_until' | 'is_completed'>,
  fromDate: Date = new Date(),
  maxDays = 7,
): Date[] {
  if (r.is_completed) return []
  const first = parseReminderDate(r.due_date)
  if (!Number.isFinite(first.getTime())) return []
  const from = fromDate.getTime()
  const to = from + maxDays * 86_400_000
  const limit = untilLimit(r)
  const step = r.repeat_days && r.repeat_days > 0 ? Math.floor(r.repeat_days) : 0

  if (!step) {
    const t = first.getTime()
    return t >= from && t <= to ? [first] : []
  }

  const out: Date[] = []
  // Pula direto para a primeira ocorrência >= from (sem laço longo).
  let k = 0
  if (first.getTime() < from) {
    const daysBehind = (from - first.getTime()) / 86_400_000
    k = Math.ceil(daysBehind / step)
  }
  for (let guard = 0; guard < 400; guard++, k++) {
    // setDate mantém a hora local mesmo com horário de verão.
    const d = new Date(first)
    d.setDate(first.getDate() + k * step)
    const t = d.getTime()
    if (t < from) continue
    if (t > to || t > limit) break
    out.push(d)
  }
  return out
}

/** Vencido = não concluído e com data/hora no passado. */
export function isReminderOverdue(r: Pick<Reminder, 'due_date' | 'is_completed'>, now: Date = new Date()): boolean {
  if (r.is_completed) return false
  const d = parseReminderDate(r.due_date)
  if (!Number.isFinite(d.getTime())) return false
  // Sem hora marcada, só vence quando o dia acaba.
  if (!reminderHasTime(r)) {
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    return endOfDay.getTime() < now.getTime()
  }
  return d.getTime() < now.getTime()
}

/**
 * Agenda: vencidos não concluídos + próximos `days` dias, ordenados por data.
 * Funciona com servidor antigo (sem include_overdue): busca a lista completa
 * e filtra aqui, então nunca esconde um lembrete vencido.
 */
export async function fetchAgenda(days = 7): Promise<Reminder[]> {
  const all = await remindersApi.list()
  const now = new Date()
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59, 999).getTime()
  return all
    .filter(r => !r.is_completed)
    .filter(r => {
      const t = parseReminderDate(r.due_date).getTime()
      return Number.isFinite(t) && (t <= horizon || isReminderOverdue(r, now))
    })
    .sort((a, b) => parseReminderDate(a.due_date).getTime() - parseReminderDate(b.due_date).getTime())
}

/** Tipos de lembrete criados pela tela de Lembretes (valores do enum do backend). */
export type ReminderKind = 'grooming' | 'vet_appointment' | 'medication' | 'other'

export const REMINDER_KINDS: { kind: ReminderKind; Icon: LucideIcon }[] = [
  { kind: 'medication', Icon: Pill },
  { kind: 'vet_appointment', Icon: Stethoscope },
  { kind: 'grooming', Icon: Scissors },
  { kind: 'other', Icon: BellRing },
]

/** Ícone por tipo (inclui tipos criados por outras telas, como vaccine/exam). */
export function reminderKindIcon(type: string): LucideIcon {
  return REMINDER_KINDS.find(k => k.kind === type)?.Icon ?? BellRing
}
