'use client'

/**
 * Cache em memória entre telas — mostra o dado antigo na hora e revalida em
 * segundo plano (stale-while-revalidate). Vive só na memória da aba/WebView:
 * nada vai para o disco. O TutorShell chama clearCache() quando o usuário muda.
 *
 * Convenção de chaves (use exatamente estas para que invalidate() funcione):
 *   'pets'                  lista de pets do tutor (o shell mantém)
 *   'vaccines'              todas as vacinas
 *   'vaccines:pet:<id>'     vacinas de um pet
 *   'protections'           protections.summary()
 *   'pet:<id>'              ficha de um pet
 *   'walks'                 lista de passeios
 *   'walks:stats'           estatísticas de passeio
 *   'reminders:upcoming'    lembretes próximos
 *   'carteirinha:<petId>'   dados da carteirinha
 *
 * invalidate('vaccines') derruba 'vaccines' e 'vaccines:pet:*'.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

interface Entry<T = unknown> {
  data?: T
  error?: unknown
  updatedAt: number
  promise?: Promise<T>
}

const store = new Map<string, Entry>()
const listeners = new Map<string, Set<() => void>>()
/** Incrementa a cada clearCache — respostas de uma "geração" antiga são descartadas. */
let generation = 0

function emit(key: string) {
  listeners.get(key)?.forEach(fn => fn())
}

function subscribe(key: string, fn: () => void) {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) listeners.delete(key)
  }
}

function fetchInto<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cur = store.get(key) as Entry<T> | undefined
  if (cur?.promise) return cur.promise
  const gen = generation
  const promise = fetcher()
    .then(data => {
      if (gen === generation) {
        store.set(key, { data, updatedAt: Date.now() })
        emit(key)
      }
      return data
    })
    .catch(err => {
      if (gen === generation) {
        const prev = store.get(key) as Entry<T> | undefined
        store.set(key, { data: prev?.data, error: err, updatedAt: prev?.updatedAt ?? 0 })
        emit(key)
      }
      throw err
    })
  store.set(key, { ...(cur ?? { updatedAt: 0 }), promise })
  emit(key)
  return promise
}

/** Dispara a busca e guarda no cache, sem renderizar nada (ex.: ao tocar num link). */
export function prefetch<T>(key: string, fetcher: () => Promise<T>): void {
  const cur = store.get(key)
  if (cur?.promise) return
  if (cur && cur.data !== undefined && Date.now() - cur.updatedAt < 60_000) return
  fetchInto(key, fetcher).catch(() => {})
}

/** Marca como velhas as chaves iguais ao prefixo ou que começam com 'prefixo:'. Telas montadas revalidam na hora. */
export function invalidate(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key === prefix || key.startsWith(prefix + ':')) {
      const e = store.get(key)
      if (e) store.set(key, { data: e.data, updatedAt: 0 })
      emit(key)
    }
  }
}

/** Esvazia tudo (troca de usuário, logout). */
export function clearCache(): void {
  generation++
  const keys = Array.from(store.keys())
  store.clear()
  keys.forEach(emit)
}

const EMPTY: Entry = { updatedAt: 0 }

export function useCached<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts?: { ttlMs?: number },
): {
  data: T | undefined
  error: unknown
  loading: boolean
  refreshing: boolean
  refresh: () => Promise<void>
  mutate: (next: T | ((prev: T | undefined) => T)) => void
} {
  const ttl = opts?.ttlMs ?? 60_000
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const entry = useSyncExternalStore(
    useCallback((fn: () => void) => (key ? subscribe(key, fn) : () => {}), [key]),
    () => (key ? store.get(key) ?? EMPTY : EMPTY),
    () => EMPTY,
  ) as Entry<T>

  // Ao montar (ou trocar de chave): busca se não há dado ou se está velho.
  // O cache só é invalidado (updatedAt = 0) por invalidate(); por isso este
  // efeito também reage a updatedAt.
  const stale = !!key && (entry.data === undefined || Date.now() - entry.updatedAt > ttl)
  useEffect(() => {
    if (!key || !stale) return
    if (store.get(key)?.promise) return
    fetchInto(key, () => fetcherRef.current()).catch(() => {})
  }, [key, stale, entry.updatedAt])

  const refresh = useCallback(async () => {
    if (!key) return
    try {
      await fetchInto(key, () => fetcherRef.current())
    } catch {
      /* erro fica em `error` */
    }
  }, [key])

  const mutate = useCallback(
    (next: T | ((prev: T | undefined) => T)) => {
      if (!key) return
      const prev = store.get(key) as Entry<T> | undefined
      const value =
        typeof next === 'function' ? (next as (p: T | undefined) => T)(prev?.data) : next
      store.set(key, { data: value, updatedAt: Date.now() })
      emit(key)
    },
    [key],
  )

  const hasData = entry.data !== undefined

  return {
    data: entry.data,
    error: entry.error,
    loading: !!key && !hasData && !entry.error,
    refreshing: !!entry.promise && hasData,
    refresh,
    mutate,
  }
}
