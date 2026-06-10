'use client'

/**
 * Persistência local do passeio em andamento + fila de finalização offline.
 * Garante que um passeio NÃO seja perdido se: o app fechar no meio, a tela
 * recarregar, ou não houver internet ao finalizar.
 *
 * Estratégia:
 *  - Enquanto rastreia, salva snapshot a cada update no localStorage.
 *  - Ao finalizar sem internet, enfileira o payload e tenta reenviar depois.
 */
import type { RoutePoint } from '@/lib/api'

const ACTIVE_KEY = 'petlife_active_walk'
const QUEUE_KEY = 'petlife_walk_finish_queue'

export interface ActiveWalkSnapshot {
  walkId: number | null
  petId: number | null
  startTs: number | null
  pausedAccum: number
  routePoints: RoutePoint[]
  distance: number
  duration: number
  savedAt: number
}

export interface QueuedFinish {
  walkId: number
  payload: {
    ended_at: string
    duration_seconds: number
    distance_meters: number
    route_points: RoutePoint[]
  }
  queuedAt: number
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key: string, val: string) {
  try { localStorage.setItem(key, val) } catch { /* quota/private mode */ }
}
function safeRemove(key: string) {
  try { localStorage.removeItem(key) } catch { /* noop */ }
}

// ── Snapshot do passeio ativo ──────────────────────────────────────────────
export function saveActiveWalk(s: ActiveWalkSnapshot) {
  safeSet(ACTIVE_KEY, JSON.stringify({ ...s, savedAt: Date.now() }))
}

export function loadActiveWalk(): ActiveWalkSnapshot | null {
  const raw = safeGet(ACTIVE_KEY)
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as ActiveWalkSnapshot
    // expira snapshot velho (>12h) pra não ressuscitar passeio fantasma
    if (Date.now() - (s.savedAt ?? 0) > 12 * 3600 * 1000) {
      clearActiveWalk()
      return null
    }
    return s
  } catch {
    return null
  }
}

export function clearActiveWalk() {
  safeRemove(ACTIVE_KEY)
}

// ── Fila de finalização offline ────────────────────────────────────────────
export function enqueueFinish(item: QueuedFinish) {
  const q = getFinishQueue()
  // evita duplicar o mesmo walk
  const filtered = q.filter(x => x.walkId !== item.walkId)
  filtered.push(item)
  safeSet(QUEUE_KEY, JSON.stringify(filtered))
}

export function getFinishQueue(): QueuedFinish[] {
  const raw = safeGet(QUEUE_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) as QueuedFinish[] } catch { return [] }
}

export function removeFromQueue(walkId: number) {
  const q = getFinishQueue().filter(x => x.walkId !== walkId)
  safeSet(QUEUE_KEY, JSON.stringify(q))
}

/**
 * Tenta reenviar todos os passeios pendentes na fila.
 * Chamar no boot do app e quando a conexão voltar.
 * `finishFn` é injetada (walks.finish) pra não acoplar à API aqui.
 */
export async function flushFinishQueue(
  finishFn: (walkId: number, payload: QueuedFinish['payload']) => Promise<unknown>,
): Promise<number> {
  const q = getFinishQueue()
  let sent = 0
  for (const item of q) {
    try {
      await finishFn(item.walkId, item.payload)
      removeFromQueue(item.walkId)
      sent++
    } catch {
      // mantém na fila pra próxima tentativa
    }
  }
  return sent
}
