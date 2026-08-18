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
const ENGAGE_BASE = 700_000

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
  /** true = o tutor já registrou ao menos 1 vacina (não é o mesmo que ter vacina vencendo). */
  hasAnyVaccine = true,
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

    // 🐾 Loop de engajamento — o motivo de voltar TODO dia.
    // Sem isso o app só avisa de vacina (raro) e aniversário (1x/ano): quem
    // cadastra o pet e não registra vacina nunca mais recebe nada.
    // Reagendado a cada abertura, então a janela de 7 dias anda junto.
    const first = pets[0]
    if (first) {
      const nome = first.name
      const semVacina = !hasAnyVaccine

      // Convite diário pro check-in (19h) — alimenta o streak
      const CHECKIN_COPY = [
        { t: `Como o ${nome} está hoje?`, b: 'Leva 5 segundos e mantém sua sequência de cuidado 🔥' },
        { t: `Tudo bem com o ${nome}? 🐾`, b: 'Faça o check-in de hoje e acompanhe o Score de Saúde.' },
        { t: `Um minutinho pro ${nome}?`, b: 'Registre como ele está e não perca sua sequência.' },
        { t: `${nome} merece esse cuidado 💚`, b: 'Check-in rápido de hoje no PetLife.' },
      ]
      for (let d = 0; d < 7; d++) {
        const at = new Date()
        at.setDate(at.getDate() + d)
        at.setHours(19, 0, 0, 0)
        if (at.getTime() <= now) continue
        const c = CHECKIN_COPY[d % CHECKIN_COPY.length]
        notifs.push({ id: ENGAGE_BASE + d, title: `🐾 ${c.t}`, body: c.b, schedule: { at } })
      }

      // Empurrão pra completar a carteirinha (só enquanto não houver vacina):
      // é a ação que destrava o valor real do app e liga os lembretes futuros.
      if (semVacina) {
        const DIAS = [1, 3, 7]
        for (let i = 0; i < DIAS.length; i++) {
          const at = new Date()
          at.setDate(at.getDate() + DIAS[i])
          at.setHours(10, 0, 0, 0)
          notifs.push({
            id: ENGAGE_BASE + 100 + i,
            title: `💉 A carteirinha do ${nome} está vazia`,
            body: 'Adicione a 1ª vacina e o PetLife avisa você antes de cada reforço vencer.',
            schedule: { at },
          })
        }
      }
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
