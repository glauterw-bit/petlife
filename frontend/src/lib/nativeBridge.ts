/**
 * Ponte com o código nativo do app iOS (plugin PetLifeNative, em
 * ios/App/App/PetLifeNativePlugin.swift): dados do widget de proteção e a
 * Live Activity do passeio. Na web e no Android tudo aqui vira no-op.
 */
import type { PetCareSummary } from '@/lib/care'

type NativePlugin = {
  setWidgetData(o: { pets: WidgetPet[]; locale: string }): Promise<{ changed: boolean }>
  clearWidgetData(): Promise<void>
  startWalk(o: WalkState & { petName: string; startedAt: number; locale: string }): Promise<{ started: boolean }>
  updateWalk(o: WalkState): Promise<void>
  endWalk(o: WalkState): Promise<void>
}

type WalkState = { distanceKm: number; pausedSeconds: number; pausedAt?: number | null }

type WidgetPet = {
  id: number
  name: string
  items: { kind: string; state: string; dueMs: number | null; title: string | null }[]
}

function plugin(): NativePlugin | null {
  if (typeof window === 'undefined') return null
  const w = window as typeof window & {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: Record<string, unknown> }
  }
  if (!w.Capacitor?.isNativePlatform?.() || w.Capacitor.getPlatform?.() !== 'ios') return null
  // Builds anteriores à 1.2.12 não têm o plugin: o proxy do Capacitor existe,
  // mas a chamada falha — por isso todo uso abaixo engole o erro.
  return (w.Capacitor.Plugins?.PetLifeNative as NativePlugin | undefined) ?? null
}

/** Datas do app vêm como 'YYYY-MM-DD' (dia local) ou ISO. */
function toMs(date: string | null): number | null {
  if (!date) return null
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : new Date(date)
  const ms = d.getTime()
  return Number.isFinite(ms) ? ms : null
}

export function syncWidget(summaries: PetCareSummary[], locale: string) {
  const p = plugin()
  if (!p) return
  const pets: WidgetPet[] = summaries.map(s => ({
    id: s.pet.id,
    name: s.pet.name,
    items: s.items.map(i => ({
      kind: i.kind,
      state: i.state,
      dueMs: toMs(i.dueDate),
      title: i.vaccineName ?? null,
    })),
  }))
  p.setWidgetData({ pets, locale }).catch(() => {})
}

export function clearWidget() {
  plugin()?.clearWidgetData().catch(() => {})
}

// ── Live Activity do passeio ──────────────────────────────────────────────

export const walkActivity = {
  start(petName: string, startedAt: number, locale: string, state: WalkState) {
    plugin()?.startWalk({ petName, startedAt, locale, ...state }).catch(() => {})
  },
  update(state: WalkState) {
    plugin()?.updateWalk(state).catch(() => {})
  },
  end(state: WalkState) {
    plugin()?.endWalk(state).catch(() => {})
  },
}
