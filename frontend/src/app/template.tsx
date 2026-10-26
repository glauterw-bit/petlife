'use client'

/**
 * Transição de tela das rotas do tutor — só entrada, só opacity + transform
 * (o framer deixa transform:none no fim, então position:fixed/sticky dos
 * filhos não quebra). Sem AnimatePresence.
 *
 * - Troca entre raízes de aba (TAB_ROOTS): só fade de 140 ms. Abas são
 *   lugares lado a lado, não uma pilha — deslizar daria a ideia errada.
 * - Telas empilhadas (entrar numa ficha, voltar dela): deslize de 14 px +
 *   fade em 200 ms; ao voltar, entra pela esquerda.
 * - Reduzir movimento: fade de 120 ms em tudo.
 *
 * Fora das rotas do tutor devolve só o children (a clínica tem o próprio
 * template; não pode haver transição dupla).
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { isTutorRoute, isTabRoot } from '@/components/layout/shell'
import { consumeNavDirection, peekNavDirection, setNavDirection, easeOut, type NavDirection } from '@/lib/motion'

/** Rota anterior — em módulo porque o template remonta a cada navegação. */
let prevPathname: string | null = null

type Kind = 'tab' | 'stack'

export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const reduced = useReducedMotion()
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
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0.12 : 0.14, ease: easeOut as unknown as [number, number, number, number] }}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, x: dir === 'back' ? -14 : 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: easeOut as unknown as [number, number, number, number] }}
    >
      {children}
    </motion.div>
  )
}
