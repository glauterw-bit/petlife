'use client'

/**
 * Notificações locais de saúde (vacinas + lembretes) — agendadas no aparelho.
 * Sem servidor/APNs: usa @capacitor/local-notifications, funciona offline.
 * No web (fora do app nativo) é no-op silencioso.
 *
 * Estratégia: a cada carga do dashboard, cancela as pendentes do app
 * (faixa de IDs própria) e reagenda a partir dos dados frescos — idempotente.
 */
import type { Vaccine, Reminder, Pet } from './api'

// Faixas de ID determinísticas (permitem cancelar/reagendar sem duplicar)
const VACCINE_BASE = 100_000
const REMINDER_BASE = 500_000
const BDAY_BASE = 900_000

function isNative(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }
  return !!w.Capacitor?.isNativePlatform?.()
}

/** Data-alvo às 9h locais, `daysBefore` dias antes do vencimento. */
function at9am(dateStr: string, daysBefore = 0): Date {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - daysBefore)
  d.setHours(9, 0, 0, 0)
  return d
}

/**
 * Sincroniza as notificações locais com as vacinas/lembretes próximos.
 * Pede permissão na primeira vez (em contexto — só roda quando há dados de saúde).
 * Retorna true se agendou.
 */
export async function syncHealthNotifications(
  vaccines: Vaccine[],
  reminders: Reminder[],
  pets: Pet[] = [],
): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    let perm = await LocalNotifications.checkPermissions()
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
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
    const notifs: Array<{ id: number; title: string; body: string; schedule: { at: Date } }> = []

    for (const v of vaccines) {
      if (!v.next_due_date) continue
      const petName = v.pet?.name ? ` de ${v.pet.name}` : ''
      const before = at9am(v.next_due_date, 1)
      const dayOf = at9am(v.next_due_date)
      if (before.getTime() > now) {
        notifs.push({
          id: VACCINE_BASE + v.id * 2 + 1,
          title: '💉 Vacina vence amanhã',
          body: `${v.name}${petName} vence amanhã. Já agendou com o veterinário?`,
          schedule: { at: before },
        })
      }
      if (dayOf.getTime() > now) {
        notifs.push({
          id: VACCINE_BASE + v.id * 2,
          title: '💉 Vacina vence hoje',
          body: `${v.name}${petName} vence hoje. Não deixa atrasar!`,
          schedule: { at: dayOf },
        })
      }
    }

    for (const r of reminders) {
      if (!r.due_date || r.completed) continue
      const dayOf = at9am(r.due_date)
      if (dayOf.getTime() > now) {
        notifs.push({
          id: REMINDER_BASE + r.id * 2,
          title: '🔔 Lembrete do PetLife',
          body: r.title,
          schedule: { at: dayOf },
        })
      }
    }

    // 🎂 aniversários: próxima ocorrência de cada pet, às 9h
    for (const p of pets) {
      if (!p.birth_date) continue
      const b = new Date(p.birth_date)
      const nowD = new Date()
      const next = new Date(nowD.getFullYear(), b.getMonth(), b.getDate(), 9, 0, 0)
      if (next.getTime() <= now) next.setFullYear(next.getFullYear() + 1)
      notifs.push({
        id: BDAY_BASE + p.id,
        title: `🎂 Hoje é aniversário de ${p.name}!`,
        body: 'Abra o PetLife pra celebrar e compartilhar o momento 🎉',
        schedule: { at: next },
      })
    }

    // iOS tolera até 64 pendentes por app — mantém margem
    if (notifs.length) {
      await LocalNotifications.schedule({ notifications: notifs.slice(0, 60) })
    }
    return notifs.length > 0
  } catch {
    return false // plugin ausente no build atual ou erro — nunca quebra a UI
  }
}
