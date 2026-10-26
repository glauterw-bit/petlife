'use client'

/**
 * Transição de tela das rotas do tutor — em CSS (compositor), não em JS:
 * a animação roda mesmo com a thread principal ocupada montando a tela nova.
 * Só entrada, só opacity + transform; com `backwards` o estado final é o
 * do próprio elemento (sem transform), então position:fixed/sticky dos
 * filhos não quebra. Sem AnimatePresence.
 *
 * - Troca entre raízes de aba (TAB_ROOTS): .page-fade (140 ms). Abas são
 *   lugares lado a lado, não uma pilha — deslizar daria a ideia errada.
 * - Telas empilhadas (entrar numa ficha, voltar dela): .page-in, deslize de
 *   14 px + fade em 200 ms; ao voltar, entra pela esquerda (--dx negativo).
 * - Reduzir movimento: .page-fade (globals.css já zera a duração).
 *
 * Fora das rotas do tutor devolve só o children (a clínica tem o próprio
 * template; não pode haver transição dupla).
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { isTutorRoute, isTabRoot } from '@/components/layout/shell'
import { consumeNavDirection, peekNavDirection, setNavDirection, usePrefersReducedMotion, type NavDirection } from '@/lib/motion'

/** Rota anterior — em módulo porque o template remonta a cada navegação. */
let prevPathname: string | null = null

type Kind = 'tab' | 'stack'

export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const reduced = usePrefersReducedMotion()
  const tutor = isTutorRoute(pathname)

  // Direção e tipo decididos uma vez por rota.
  const decided = useRef<{ path: string; dir: NavDirection; kind: Kind } | null>(null)
  if (decided.current?.path !== pathname) {
    const from = prevPathname
    const kind: Kind = from != null && from !== pathname && isTabRoot(from) && isTabRoot(pathname) ? 'tab' : 'stack'
    decided.current = { path: pathname, dir: peekNavDirection(), kind }
  }
  const { dir, kind } = decided.current

  useEffect(() => {
    consumeNavDirection()
    prevPathname = pathname
  }, [pathname])

  // Voltar do navegador / gesto do sistema
  useEffect(() => {
    const onPop = () => setNavDirection('back')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (!tutor) return <>{children}</>

  if (reduced || kind === 'tab') {
    return (
      <div key={pathname} className="page-fade">
        {children}
      </div>
    )
  }

  return (
    <div key={pathname} className="page-in" style={{ '--dx': dir === 'back' ? '-14px' : '14px' } as CSSProperties}>
      {children}
    </div>
  )
}
