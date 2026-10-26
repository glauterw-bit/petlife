'use client'

/**
 * Cabeçalho de tela no estilo iOS: barra fixa no topo (com área segura) que
 * vira vidro ao rolar, título grande que some enquanto o título compacto
 * aparece na barra. Ao montar, avisa o shell para esconder o sino fixo e a
 * barra de voltar (o cabeçalho traz os dois).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { hapticLight } from '@/lib/feedback'
import { setNavDirection, usePrefersReducedMotion } from '@/lib/motion'
import { useShell } from '@/components/layout/shell'
import { NotificationBell } from '@/components/layout/NotificationBell'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  back?: boolean | string
  actions?: ReactNode
  /** Título grande abaixo da barra (padrão true). */
  large?: boolean
  /** Sino de notificações à direita (padrão true). */
  showBell?: boolean
  /**
   * Não desenha o título grande (a tela já tem um herói com o nome, ex.: a
   * ficha do pet). O título compacto da barra só aparece depois de rolar.
   */
  hideLargeTitle?: boolean
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  large = true,
  showBell = true,
  hideLargeTitle = false,
  className,
}: PageHeaderProps) {
  const t = useT()
  const router = useRouter()
  const shell = useShell()
  const reduced = usePrefersReducedMotion()
  const registerHeader = shell?.registerHeader

  useEffect(() => {
    if (!registerHeader) return
    return registerHeader()
  }, [registerHeader])

  // Com hideLargeTitle o compacto se comporta como se houvesse título grande:
  // escondido no topo, aparece ao rolar (o herói da tela faz o papel do título).
  const revealOnScroll = large || hideLargeTitle
  const { scrollY } = useScroll()
  const glass = useTransform(scrollY, [0, 8], [0, 1])
  // Sem título grande, o nome está no herói, mais abaixo: o compacto entra mais tarde.
  const reveal: [number, number] = hideLargeTitle ? [120, 160] : [28, 60]
  const compactOpacity = useTransform(scrollY, revealOnScroll ? reveal : [0, 1], revealOnScroll ? [0, 1] : [1, 1])
  const compactY = useTransform(scrollY, reveal, [6, 0])
  const largeOpacity = useTransform(scrollY, [0, 44], [1, 0])
  // Puxar para baixo cresce no máximo 4% (mais que isso parece zoom quebrado)
  const largeScale = useTransform(scrollY, [-80, 0], [1.04, 1], { clamp: true })

  // Com "reduzir movimento": troca seca, sem interpolar.
  const [scrolled, setScrolled] = useState({ glass: false, compact: !revealOnScroll })
  useMotionValueEvent(scrollY, 'change', v => {
    if (!reduced) return
    const next = { glass: v > 8, compact: !revealOnScroll || v > (hideLargeTitle ? 140 : 44) }
    setScrolled(prev => (prev.glass === next.glass && prev.compact === next.compact ? prev : next))
  })

  function goBack() {
    setNavDirection('back')
    void hapticLight()
    if (typeof back === 'string') {
      router.push(back)
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/dashboard')
    }
  }

  const hasRight = !!actions || showBell

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-30 -mx-4 px-4 md:-mx-8 md:px-8',
          // compensa o padding-top do conteúdo do shell (mesma fórmula)
          '-mt-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] md:-mt-8',
          'pt-[env(safe-area-inset-top)]',
          className,
        )}
      >
        {/* fundo de vidro que aparece ao rolar */}
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-surface-50/[0.92] dark:bg-surface-950/[0.92] backdrop-blur-xl backdrop-saturate-150 border-b border-surface-200/70 dark:border-surface-800/80"
          style={reduced ? { opacity: scrolled.glass ? 1 : 0 } : { opacity: glass }}
        />
        <div className="relative flex items-center gap-1 h-[52px]">
          <div className="flex items-center min-w-[44px] -ml-2">
            {back && (
              <button
                type="button"
                onClick={goBack}
                aria-label={t('nav.back')}
                className="pressable inline-flex items-center h-11 pl-1 pr-2 rounded-xl text-primary-700 dark:text-primary-300 hover:bg-surface-100 dark:hover:bg-surface-800"
              >
                <ChevronLeft className="w-6 h-6" aria-hidden strokeWidth={2.4} />
                <span className="text-[15px] font-medium md:inline hidden">{t('nav.back')}</span>
              </button>
            )}
          </div>
          <motion.div
            className="flex-1 min-w-0 text-center pointer-events-none"
            style={
              reduced
                ? { opacity: scrolled.compact ? 1 : 0 }
                : { opacity: compactOpacity, y: revealOnScroll ? compactY : 0 }
            }
            aria-hidden={revealOnScroll}
          >
            <span className="block truncate text-[17px] font-semibold text-surface-900 dark:text-white">{title}</span>
          </motion.div>
          <div className={cn('flex items-center justify-end gap-1.5 min-w-[44px]', hasRight && '-mr-1')}>
            {actions}
            {showBell && <NotificationBell variant="inline" />}
          </div>
        </div>
      </header>

      {large && !hideLargeTitle ? (
        <motion.div
          className="mb-4 mt-1"
          style={
            reduced
              ? { opacity: scrolled.compact ? 0 : 1 }
              : { opacity: largeOpacity, scale: largeScale, transformOrigin: 'left bottom' }
          }
        >
          <h1 className="text-[28px] leading-[1.15] font-display font-extrabold tracking-tight text-surface-900 dark:text-white">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-[15px] text-surface-600 dark:text-surface-400">{subtitle}</p>}
        </motion.div>
      ) : (
        <>
          <h1 className="sr-only">{title}</h1>
          {subtitle && <p className="mb-3 text-sm text-surface-600 dark:text-surface-400">{subtitle}</p>}
        </>
      )}
    </>
  )
}
