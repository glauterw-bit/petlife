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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('petlife_theme') : null
    // Migração: quem tinha 'system' passa a claro (novo padrão). Só 'dark' explícito persiste.
    const initial: Theme = stored === 'dark' ? 'dark' : 'light'
    setThemeState(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')
    if (stored !== 'dark' && stored !== 'light') {
      try { localStorage.setItem('petlife_theme', initial) } catch {}
    }
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem('petlife_theme', t) } catch {}
    document.documentElement.classList.toggle('dark', t === 'dark')
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
