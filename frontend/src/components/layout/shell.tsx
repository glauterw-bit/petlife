'use client'

/**
 * Contrato do shell persistente do tutor.
 *
 * O TutorShell (montado uma vez no layout raiz) envolve todas as rotas do
 * tutor: barra inferior, sino e Vyron não remontam ao trocar de tela. As
 * telas falam com ele por este contexto.
 */
import { createContext, useContext, useEffect } from 'react'
import type { Pet } from '@/lib/api'

export const TUTOR_PREFIXES = [
  '/dashboard',
  '/pets',
  '/walks',
  '/health',
  '/challenges',
  '/routines',
  '/nearby',
  '/behavior',
  '/convites',
  '/momentos',
  '/suporte',
  '/plans',
  '/settings',
]

/** Rotas que ficam FORA do shell, mesmo que um prefixo futuro case com elas. */
const EXCLUDED = ['/clinica', '/admin', '/vet', '/public', '/p', '/i', '/wrapped', '/auth', '/start']

/** Casa a rota exata ou prefixo + '/'. Fora: /clinica*, /admin, /vet, /public, /p, /i, /wrapped, /auth, /start e '/'. */
export function isTutorRoute(pathname: string): boolean {
  if (!pathname || pathname === '/') return false
  if (pathname.startsWith('/clinica')) return false
  if (EXCLUDED.some(p => pathname === p || pathname.startsWith(p + '/'))) return false
  return TUTOR_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export interface ShellContextValue {
  inShell: true
  pets: Pet[]
  refreshPets(): Promise<void>
  /** A tela tem PageHeader próprio: chame ao montar; devolve a função de limpeza. */
  registerHeader(): () => void
  hasHeader: boolean
  /** Esconde o botão do Vyron; devolve a função que o mostra de novo. */
  hideAssistant(): () => void
}

export const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell(): ShellContextValue | null {
  return useContext(ShellContext)
}

/** Esconde o botão do Vyron enquanto a tela (ou um formulário) está montada e `active`. */
export function useHideAssistant(active = true): void {
  const shell = useShell()
  const hide = shell?.hideAssistant
  useEffect(() => {
    if (!active || !hide) return
    return hide()
  }, [active, hide])
}
