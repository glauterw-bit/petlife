'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    on()
    if (mq.addEventListener) mq.addEventListener('change', on)
    else mq.addListener(on)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', on)
      else mq.removeListener(on)
    }
  }, [q])
  return m
}

export function useDebounced<T>(v: T, ms = 250): T {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

function inEditable(t: EventTarget | null) {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
}

/** Atalho de teclado. meta = Ctrl ou Cmd. Sem meta, não dispara enquanto se digita num campo. */
export function useHotkey(key: string, cb: (e: KeyboardEvent) => void, opts?: { meta?: boolean; when?: boolean; allowInInputs?: boolean }): void {
  const cbRef = useRef(cb)
  cbRef.current = cb
  const meta = !!opts?.meta
  const when = opts?.when ?? true
  const allowIn = opts?.allowInInputs ?? meta
  useEffect(() => {
    if (!when || !key) return
    const h = (e: KeyboardEvent) => {
      if (!e.key || e.key.toLowerCase() !== key.toLowerCase()) return
      const mod = e.metaKey || e.ctrlKey
      if (meta !== mod) return
      if (!meta && e.altKey) return
      if (!allowIn && inEditable(e.target)) return
      cbRef.current(e)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [key, meta, when, allowIn])
}

export function useNow(intervalMs = 60000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** Carrega dados guardando a última resposta: recarregar não apaga a tela. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): {
  data: T | null; error: string | null; loading: boolean; reload: () => void; setData: (d: T | null) => void
} {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const reqId = useRef(0)
  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    let p: Promise<T>
    try { p = fnRef.current() } catch (e) { p = Promise.reject(e) }
    p.then(d => {
      if (id !== reqId.current) return
      setData(d); setError(null); setLoading(false)
    }).catch((e: unknown) => {
      if (id !== reqId.current) return
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.')
      setLoading(false)
    })
  }, [...deps, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setTick(t => t + 1), [])
  return { data, error, loading, reload, setData }
}
