'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isCrmError } from '@/lib/crmApi'

/** Carrega um recurso guardando o status HTTP do erro (para separar 404 de falha). */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const req = useRef(0)
  useEffect(() => {
    const id = ++req.current
    setLoading(true)
    fnRef.current().then(d => {
      if (id !== req.current) return
      setData(d); setError(null); setStatus(null); setLoading(false)
    }).catch((e: unknown) => {
      if (id !== req.current) return
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.')
      setStatus(isCrmError(e) ? e.status ?? null : null)
      setLoading(false)
    })
  }, [...deps, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setTick(t => t + 1), [])
  return { data, setData, error, status, loading, reload }
}
