'use client'

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'

/**
 * Tema do PetLife: CLARO é o padrão do app; escuro é escolha explícita do
 * usuário nas Configurações. Não seguimos o tema do sistema por padrão —
 * usuários com o celular no escuro reclamavam do app "mudar sozinho".
 *
 * "Automático" ('system') existe, mas só vale se o usuário escolher: aí o
 * app acompanha o aparelho (matchMedia + listener de mudança) e
 * `resolvedTheme` diz qual está em uso.
 *
 * Armazenamento (localStorage 'petlife_theme'): 'light' | 'dark' | 'auto'.
 * O valor antigo 'system' (de antes do padrão claro) NÃO é a escolha nova:
 * continua migrando para claro. Por isso a escolha nova grava 'auto'.
 */
export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'petlife_theme'
const STORED_SYSTEM = 'auto'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemTheme(): ResolvedTheme {
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Aplica o tema no <html> e acerta a cor dos ícones da barra de status no app nativo. */
function applyTheme(t: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
  void (async () => {
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) return
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      // Style.Dark = texto claro (fundo escuro); Style.Light = texto escuro
      await StatusBar.setStyle({ style: t === 'dark' ? Style.Dark : Style.Light })
    } catch {
      /* plugin ausente — segue sem */
    }
  })()
}

function readStored(): Theme {
  let stored: string | null = null
  try { stored = localStorage.getItem(STORAGE_KEY) } catch {}
  if (stored === 'dark') return 'dark'
  if (stored === STORED_SYSTEM) return 'system'
  return 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [resolvedTheme, setResolved] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const initial = readStored()
    setThemeState(initial)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      // Migração: qualquer valor desconhecido (inclusive o 'system' antigo) vira claro.
      if (stored !== 'dark' && stored !== 'light' && stored !== STORED_SYSTEM) localStorage.setItem(STORAGE_KEY, 'light')
    } catch {}
  }, [])

  // Resolve e aplica; no Automático, acompanha a troca do aparelho.
  useEffect(() => {
    if (theme !== 'system') {
      setResolved(theme)
      applyTheme(theme)
      return
    }
    const sync = () => {
      const r = systemTheme()
      setResolved(r)
      applyTheme(r)
    }
    sync()
    let mq: MediaQueryList | null = null
    try { mq = window.matchMedia(DARK_QUERY) } catch {}
    mq?.addEventListener('change', sync)
    return () => mq?.removeEventListener('change', sync)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem(STORAGE_KEY, t === 'system' ? STORED_SYSTEM : t) } catch {}
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
