'use client'

/**
 * Avisos locais do aparelho (@capacitor/local-notifications). Funcionam
 * offline; fora do app nativo são no-op silencioso.
 *
 * Regra: avisar quando há algo concreto a fazer, nunca para "manter sequência".
 * - Vacinas: só quando o push do servidor NÃO está ativo (isRemotePushActive).
 *   Com ele ativo, o servidor já manda 7 dias antes, no dia e 3 dias depois —
 *   agendar aqui também duplicaria. Sem ele: 7 dias antes, no dia e 3 dias
 *   depois (só se a dose mais recente continua sendo a vencida), às 9h.
 *   O PushPrimer cita "7 dias antes" — mantenha os dois em sincronia.
 * - Resumo semanal: nos próximos 2 domingos às 10h, o que vence nos 14 dias
 *   seguintes (vacinas, lembretes, vermífugo/antipulgas). Sem nada, sem aviso.
 * - Check-in diário (19h): só para quem já criou o hábito (sequência ≥ 3 dias).
 * - Carteirinha vazia (dias 1, 3 e 7), aniversário, cio e lembretes do tutor.
 *
 * Todos os textos passam por tr() (idioma do aparelho) e usam o nome do pet
 * sem artigo nem pronome, para valer para qualquer pet.
 *
 * Idempotente: a cada carga do Início, cancela as pendentes da nossa faixa de
 * IDs e reagenda a partir dos dados frescos.
 */
import type { Vaccine, Reminder, Pet, HeatUpcoming, ProtectionPetSummary } from './api'
import { tr } from './i18n/translate'
import { isRemotePushActive } from './push'
import { latestDoses } from './care'

// Faixas de ID determinísticas (permitem cancelar/reagendar sem duplicar)
const VACCINE_BASE = 100_000
const REMINDER_BASE = 500_000
const ENGAGE_BASE = 700_000 // +0..6 check-in · +100..102 carteirinha · +200..201 resumo semanal
const HEAT_BASE = 800_000
const BDAY_BASE = 900_000

const DAY = 86_400_000

function isNative(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }
  return !!w.Capacitor?.isNativePlatform?.()
}

/** 'YYYY-MM-DD' (ou ISO) → meia-noite LOCAL daquele dia. `new Date('2026-11-04')` seria UTC e cairia na véspera no Brasil. */
function localDay(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Às `hour` locais, `offsetDays` dias depois (negativo = antes) da data. */
function atHour(dateStr: string, offsetDays: number, hour: number): Date {
  const d = localDay(dateStr)
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, 0, 0, 0)
  return d
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from); a.setHours(0, 0, 0, 0)
  const b = new Date(to); b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / DAY)
}

/** Próximos `count` domingos às 10h locais (hoje conta se ainda não passou das 10h). */
function nextSundays(count: number, now: number): Date[] {
  const out: Date[] = []
  const d = new Date(now)
  d.setHours(10, 0, 0, 0)
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  if (d.getTime() <= now) d.setDate(d.getDate() + 7)
  for (let i = 0; i < count; i++) {
    out.push(new Date(d))
    d.setDate(d.getDate() + 7)
  }
  return out
}

interface DueItem { petName: string; what: string; due: Date }

type Notif = { id: number; title: string; body: string; schedule: { at: Date } }

/**
 * Sincroniza os avisos locais com os dados do Início.
 * Só agenda se a permissão já foi dada, a menos que opts.ask seja true.
 * Retorna true se agendou algo.
 */
export async function syncHealthNotifications(
  /** Todas as vacinas (o cálculo usa só a dose mais recente de cada uma). */
  vaccines: Vaccine[],
  reminders: Reminder[],
  pets: Pet[] = [],
  /** true = o tutor já registrou ao menos 1 vacina (não é o mesmo que ter vacina vencendo). */
  hasAnyVaccine = true,
  /** Cios previstos (GET /heat-cycles/upcoming). */
  heats: HeatUpcoming[] = [],
  /** ask=true pede a permissão se ainda não foi decidida. Padrão: não pede (o pedido é feito com contexto pelo PushPrimer). */
  opts?: { ask?: boolean },
  /** Vermífugo/antipulgas por pet (protections.summary().pets) — entram no resumo semanal. */
  protections: ProtectionPetSummary[] = [],
  /** Sequência de check-in do pet do check-in. O diário só é agendado com 3+ dias. */
  checkinStreak?: number,
  /** Pet do check-in (o mesmo do cartão do Início). Padrão: o primeiro. */
  checkinPetId?: number,
): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    let perm = await LocalNotifications.checkPermissions()
    if (opts?.ask && (perm.display === 'prompt' || perm.display === 'prompt-with-rationale')) {
      perm = await LocalNotifications.requestPermissions()
    }
    if (perm.display !== 'granted') return false

    // Cancela as nossas pendentes (não mexe em notificações de outros recursos)
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter(n => n.id >= VACCINE_BASE)
    if (ours.length) {
      await LocalNotifications.cancel({ notifications: ours.map(n => ({ id: n.id })) })
    }

    const now = Date.now()
    const notifs: Notif[] = []
    const push = (n: Notif) => { if (n.schedule.at.getTime() > now) notifs.push(n) }
    const petName = new Map(pets.map(p => [p.id, p.name]))
    const latest = latestDoses(vaccines).filter(v => !!v.next_due && petName.has(v.pet_id))

    // ── Vacinas (só sem push do servidor) ────────────────────────────────
    if (!isRemotePushActive()) {
      for (const v of latest) {
        const vars = { vaccine: v.name, name: petName.get(v.pet_id) ?? v.pet?.name ?? '' }
        const due = v.next_due as string
        push({ id: VACCINE_BASE + v.id * 3 + 0, title: tr('ntf.vac.in7.t'), body: tr('ntf.vac.in7', vars), schedule: { at: atHour(due, -7, 9) } })
        push({ id: VACCINE_BASE + v.id * 3 + 1, title: tr('ntf.vac.today.t'), body: tr('ntf.vac.today', vars), schedule: { at: atHour(due, 0, 9) } })
        // Reagendado a cada abertura a partir da dose mais recente: se uma dose
        // nova for registrada antes, este aviso some na próxima sincronização.
        push({ id: VACCINE_BASE + v.id * 3 + 2, title: tr('ntf.vac.late3.t'), body: tr('ntf.vac.late3', vars), schedule: { at: atHour(due, 3, 9) } })
      }
    }

    // ── Lembretes do tutor ───────────────────────────────────────────────
    for (const r of reminders) {
      if (!r.due_date || r.is_completed) continue
      push({ id: REMINDER_BASE + r.id * 2, title: tr('ntf.rem.t'), body: r.title, schedule: { at: atHour(r.due_date, 0, 9) } })
    }

    // ── Cio previsto: alguns dias antes (cadela 7, gata 2) e no dia ─────
    for (const h of heats) {
      if (h.lead_days > 0) {
        push({
          id: HEAT_BASE + h.pet_id * 2 + 1,
          title: tr('ntf.heat.soon.t', { name: h.pet_name }),
          body: tr(h.species === 'cat' ? 'ntf.heat.soon.cat' : 'ntf.heat.soon.dog', { n: h.lead_days }),
          schedule: { at: atHour(h.next_start, -h.lead_days, 9) },
        })
      }
      push({
        id: HEAT_BASE + h.pet_id * 2,
        title: tr('ntf.heat.today.t', { name: h.pet_name }),
        body: tr('ntf.heat.today.b'),
        schedule: { at: atHour(h.next_start, 0, 9) },
      })
    }

    // ── Aniversários: próxima ocorrência de cada pet, às 9h ─────────────
    for (const p of pets) {
      if (!p.birth_date) continue
      const b = localDay(p.birth_date)
      const next = new Date(new Date(now).getFullYear(), b.getMonth(), b.getDate(), 9, 0, 0)
      if (next.getTime() <= now) next.setFullYear(next.getFullYear() + 1)
      push({ id: BDAY_BASE + p.id, title: tr('ntf.bday.t', { name: p.name }), body: tr('ntf.bday.b'), schedule: { at: next } })
    }

    // ── Resumo semanal: o que vence nos 14 dias após cada domingo ───────
    const due: DueItem[] = []
    for (const v of latest) due.push({ petName: petName.get(v.pet_id) ?? '', what: v.name, due: localDay(v.next_due as string) })
    for (const r of reminders) {
      if (!r.due_date || r.is_completed) continue
      const name = (r.pet_id != null ? petName.get(r.pet_id) : undefined) ?? r.pet?.name
      if (name) due.push({ petName: name, what: r.title, due: localDay(r.due_date) })
    }
    for (const p of protections) {
      const name = petName.get(p.pet_id) ?? p.pet_name
      for (const k of p.kinds) {
        if (!k.next_due) continue
        due.push({ petName: name, what: tr(`ntf.kind.${k.kind}`), due: localDay(k.next_due) })
      }
    }
    nextSundays(2, now).forEach((sunday, i) => {
      const items = due
        .map(d => ({ ...d, n: daysBetween(sunday, d.due) }))
        .filter(d => d.n >= 0 && d.n <= 14)
        .sort((a, b) => a.n - b.n)
        .slice(0, 3)
      if (items.length === 0) return
      const body = items
        .map(d => {
          const vars = { name: d.petName, what: d.what, n: d.n }
          return tr(d.n === 0 ? 'ntf.week.itemToday' : d.n === 1 ? 'ntf.week.itemTomorrow' : 'ntf.week.item', vars)
        })
        .join(' · ')
      push({ id: ENGAGE_BASE + 200 + i, title: tr('ntf.week.t'), body, schedule: { at: sunday } })
    })

    // ── Check-in diário: só para quem já tem o hábito (3+ dias seguidos) ─
    const checkinPet = pets.find(p => p.id === checkinPetId) ?? pets[0]
    if (checkinPet && (checkinStreak ?? 0) >= 3) {
      for (let d = 0; d < 7; d++) {
        const at = new Date(now)
        at.setDate(at.getDate() + d)
        at.setHours(19, 0, 0, 0)
        push({ id: ENGAGE_BASE + d, title: tr('ntf.checkin.t', { name: checkinPet.name }), body: tr('ntf.checkin.b'), schedule: { at } })
      }
    }

    // ── Carteirinha vazia: só enquanto não houver nenhuma vacina ────────
    const first = checkinPet ?? pets[0]
    if (first && !hasAnyVaccine) {
      ;[1, 3, 7].forEach((days, i) => {
        const at = new Date(now)
        at.setDate(at.getDate() + days)
        at.setHours(10, 0, 0, 0)
        push({ id: ENGAGE_BASE + 100 + i, title: tr('ntf.card.t', { name: first.name }), body: tr('ntf.card.b'), schedule: { at } })
      })
    }

    // iOS tolera até 64 pendentes por app — mantém margem, mais próximos primeiro
    notifs.sort((a, b) => a.schedule.at.getTime() - b.schedule.at.getTime())
    if (notifs.length) {
      await LocalNotifications.schedule({ notifications: notifs.slice(0, 60) })
    }
    return notifs.length > 0
  } catch {
    return false // plugin ausente no build atual ou erro — nunca quebra a UI
  }
}
