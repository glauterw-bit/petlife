'use client'

/**
 * Transição de tela das rotas do tutor: entrada curta e direcional
 * (deslize de 14 px + fade em 200 ms; ao voltar, entra pela esquerda).
 * Só entrada — sem AnimatePresence — e só opacity + transform: o framer deixa
 * transform:none no fim, então position:fixed/sticky dos filhos não quebra.
 *
 * Fora das rotas do tutor devolve só o children (a clínica tem o próprio
 * template; não pode haver transição dupla).
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { isTutorRoute } from '@/components/layout/shell'
import { consumeNavDirection, peekNavDirection, setNavDirection, easeOut, type NavDirection } from '@/lib/motion'

export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const reduced = useReducedMotion()
  const tutor = isTutorRoute(pathname)

  // Direção decidida uma vez por rota (o template não remonta entre /pets e /pets/1).
  const dirRef = useRef<{ path: string; dir: NavDirection } | null>(null)
  if (dirRef.current?.path !== pathname) {
    dirRef.current = { path: pathname, dir: peekNavDirection() }
  }
  const dir = dirRef.current.dir

  useEffect(() => {
    consumeNavDirection()
  }, [pathname])

  // Voltar do navegador / gesto do sistema
  useEffect(() => {
    const onPop = () => setNavDirection('back')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (!tutor) return <>{children}</>

  return (
    <motion.div
      key={pathname}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir === 'back' ? -14 : 14 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={reduced ? { duration: 0.12 } : { duration: 0.2, ease: easeOut }}
    >
      {children}
    </motion.div>
  )
}
