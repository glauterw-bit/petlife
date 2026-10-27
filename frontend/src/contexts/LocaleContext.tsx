'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { FALLBACK_DICT, getDict, loadLocale } from '@/lib/i18n/dict'
// Importado também pelo efeito colateral: começa a baixar o dicionário do
// idioma salvo/do aparelho já na avaliação do módulo, antes de hidratar.
import { getLocale } from '@/lib/i18n/translate'
import { setDateLocale } from '@/lib/utils'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/types'
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
  // Sobe quando um dicionário chega depois de o idioma já estar aplicado
  // (só no caminho de falha de rede + nova tentativa), para re-renderizar.
  const [dictVersion, setDictVersion] = useState(0)
  // Último idioma pedido: evita que um download lento sobrescreva uma troca
  // feita depois (ex.: tocar en e logo es em Ajustes).
  const requested = useRef<Locale>(DEFAULT_LOCALE)

  const apply = useCallback((l: Locale) => {
    setLocaleState(l)
    setDateLocale(l)
    document.documentElement.lang = l
  }, [])

  /**
   * Aplica o idioma só quando o dicionário dele já está na memória — a tela
   * troca de uma vez, sem quadro com textos misturados. pt-BR é síncrono.
   * Se o download falhar (sem rede), aplica assim mesmo (textos caem no
   * pt-BR, como chave faltando) e tenta de novo em alguns segundos.
   */
  const switchTo = useCallback((l: Locale) => {
    requested.current = l
    if (getDict(l)) { apply(l); return }
    loadLocale(l)
      .then(() => { if (requested.current === l) apply(l) })
      .catch(() => {
        if (requested.current !== l) return
        apply(l)
        setTimeout(() => {
          loadLocale(l).then(() => setDictVersion(v => v + 1)).catch(() => {})
        }, 4000)
      })
  }, [apply])

  useEffect(() => {
    switchTo(getLocale())
  }, [switchTo])

  const setLocale = useCallback((l: Locale) => {
    try { localStorage.setItem(STORAGE_KEY, l) } catch {}
    switchTo(l)
  }, [switchTo])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      // Cai para pt-BR quando a chave ainda não foi traduzida — nunca mostra
      // a chave crua pro usuário.
      const raw = getDict(locale)?.[key] ?? FALLBACK_DICT[key] ?? key
      if (!vars) return raw
      return raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
    },
    // dictVersion: força nova função quando o dicionário chega atrasado
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, dictVersion],
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
        const raw = FALLBACK_DICT[key] ?? key
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
