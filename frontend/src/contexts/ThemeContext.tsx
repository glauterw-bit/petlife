'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

/**
 * Tema do PetLife: CLARO é o padrão do app; escuro é escolha explícita do
 * usuário nas Configurações. Não seguimos mais o tema do sistema — usuários
 * com o celular no escuro reclamavam do app "mudar sozinho".
 */
type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Aplica o tema no <html> e acerta a cor dos ícones da barra de status no app nativo. */
function applyTheme(t: Theme) {
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem('petlife_theme') } catch {}
    // Migração: quem tinha 'system' passa a claro (novo padrão). Só 'dark' explícito persiste.
    const initial: Theme = stored === 'dark' ? 'dark' : 'light'
    setThemeState(initial)
    applyTheme(initial)
    if (stored !== 'dark' && stored !== 'light') {
      try { localStorage.setItem('petlife_theme', initial) } catch {}
    }
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem('petlife_theme', t) } catch {}
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
