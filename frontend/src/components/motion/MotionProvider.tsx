'use client'

/**
 * LazyMotion na raiz: os componentes usam `m.*` (casca leve) e o motor de
 * animação/gestos/layout (domMax) vem num chunk separado, fora do JS inicial.
 *
 * O download começa já na avaliação deste módulo (em paralelo com a
 * hidratação), não no primeiro efeito. Até ele chegar, `m.*` renderiza no
 * estado `initial` — o mesmo HTML que o servidor já mandou.
 *
 * `strict`: em desenvolvimento, um `motion.*` esquecido acusa erro (ele
 * puxaria o bundle completo de volta). Importe `m` de 'framer-motion'.
 */
import { LazyMotion } from 'framer-motion'
import type { ReactNode } from 'react'

const featuresPromise =
  typeof window !== 'undefined' ? import('./motionFeatures').then(r => r.default) : null

const loadFeatures = () => featuresPromise ?? import('./motionFeatures').then(r => r.default)

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  )
}
