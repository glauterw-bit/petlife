'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { DICTS } from '@/lib/i18n/dict'
import { setDateLocale } from '@/lib/utils'
import { DEFAULT_LOCALE, coerceLocale, detectLocale, type Locale } from '@/lib/i18n/types'
const STORAGE_KEY = 'petlife_locale'

interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  /** Traduz uma chave. `vars` substitui {placeholders}. */
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Começa no padrão para o HTML do servidor bater com o do cliente;
  // a detecção real acontece no efeito abaixo.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    let initial: Locale | null = null
    try {
      initial = coerceLocale(localStorage.getItem(STORAGE_KEY))
    } catch { /* sem storage */ }
    const resolved = initial ?? detectLocale()
    setLocaleState(resolved)
    setDateLocale(resolved)
    document.documentElement.lang = resolved
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    setDateLocale(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch {}
    document.documentElement.lang = l
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      // Cai para pt-BR quando a chave ainda não foi traduzida — nunca mostra
      // a chave crua pro usuário.
      const raw = DICTS[locale]?.[key] ?? DICTS['pt-BR'][key] ?? key
      if (!vars) return raw
      return raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  // Fora do provider (ex.: páginas públicas) devolve pt-BR sem quebrar.
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key, vars) => {
        const raw = DICTS['pt-BR'][key] ?? key
        return vars ? raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : raw
      },
    }
  }
  return ctx
}

/** Atalho mais curto para usar nos componentes. */
export function useT() {
  return useLocale().t
}
