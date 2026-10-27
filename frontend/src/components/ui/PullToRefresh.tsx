'use client'

/**
 * Puxar para atualizar. Só ativa no topo da página (scrollY === 0), com toque
 * (pointer coarse) e sem "reduzir movimento". Resistência no arraste, limiar
 * de 72 px, vibração leve ao cruzar o limiar e indicador até a promise acabar.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { m, useMotionValue, useTransform, animate } from 'framer-motion'
import { PawPrint, Loader2 } from 'lucide-react'
import { useT } from '@/contexts/LocaleContext'
import { hapticLight } from '@/lib/feedback'
import { spring } from '@/lib/motion'

const THRESHOLD = 72
const MAX = 120

export function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
}: {
  onRefresh: () => Promise<unknown>
  children: ReactNode
  disabled?: boolean
}) {
  const t = useT()
  const [enabled, setEnabled] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [armed, setArmed] = useState(false)
  const y = useMotionValue(0)
  const rotate = useTransform(y, [0, MAX], [0, 300])
  const opacity = useTransform(y, [0, 24, THRESHOLD], [0, 0.6, 1])
  const scale = useTransform(y, [0, THRESHOLD], [0.6, 1])
  const indicatorY = useTransform(y, v => v - 40)
  const start = useRef<{ y: number; x: number } | null>(null)
  const pulling = useRef(false)
  const armedRef = useRef(false)
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setEnabled(coarse.matches && !reduced.matches)
    update()
    coarse.addEventListener('change', update)
    reduced.addEventListener('change', update)
    return () => {
      coarse.removeEventListener('change', update)
      reduced.removeEventListener('change', update)
    }
  }, [])

  const run = useCallback(async () => {
    setRefreshing(true)
    animate(y, 56, spring.snappy)
    try {
      await refreshRef.current()
    } catch {
      /* a tela mostra o erro */
    } finally {
      setRefreshing(false)
      animate(y, 0, spring.snappy)
    }
  }, [y])

  useEffect(() => {
    if (!enabled || disabled) return
    function onStart(e: TouchEvent) {
      if (refreshing || window.scrollY > 0 || e.touches.length !== 1) return
      // não sequestrar gestos dentro de folhas/diálogos
      if ((e.target as HTMLElement).closest('[role="dialog"]')) return
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX }
      pulling.current = false
    }
    function onMove(e: TouchEvent) {
      if (!start.current || refreshing) return
      const dy = e.touches[0].clientY - start.current.y
      const dx = Math.abs(e.touches[0].clientX - start.current.x)
      if (!pulling.current) {
        if (dy > 6 && dy > dx && window.scrollY <= 0) pulling.current = true
        else if (dy < 0 || dx > 10) {
          start.current = null
          return
        } else return
      }
      if (e.cancelable) e.preventDefault()
      // resistência: quanto mais puxa, menos anda
      const d = Math.min(MAX, dy * 0.5 - (dy * dy) / 6000)
      y.set(Math.max(0, d))
      const isArmed = d >= THRESHOLD
      if (isArmed !== armedRef.current) {
        armedRef.current = isArmed
        setArmed(isArmed)
        if (isArmed) void hapticLight()
      }
    }
    function onEnd() {
      if (!start.current) return
      start.current = null
      if (!pulling.current) return
      pulling.current = false
      if (armedRef.current) {
        armedRef.current = false
        setArmed(false)
        void run()
      } else {
        animate(y, 0, spring.snappy)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled, disabled, refreshing, run, y])

  if (!enabled || disabled) {
    // Sem gesto (desktop ou movimento reduzido): só um indicador estático enquanto atualiza.
    return (
      <>
        {refreshing && (
          <div role="status" className="flex justify-center py-2 text-surface-500 dark:text-surface-400">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
            <span className="sr-only">{t('ui.ptr.loading')}</span>
          </div>
        )}
        {children}
      </>
    )
  }

  return (
    <div className="relative">
      <m.div
        aria-hidden={!refreshing}
        role={refreshing ? 'status' : undefined}
        className="pointer-events-none absolute left-0 right-0 -top-2 flex flex-col items-center gap-1"
        style={{ opacity, y: indicatorY }}
      >
        <m.span
          className="w-9 h-9 rounded-full bg-white dark:bg-surface-800 shadow-card border border-surface-200/70 dark:border-surface-700 flex items-center justify-center text-primary-700 dark:text-primary-300"
          style={{ rotate: refreshing ? undefined : rotate, scale }}
        >
          {refreshing ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <PawPrint className="w-[18px] h-[18px]" />}
        </m.span>
        <span className="text-[11px] font-medium text-surface-500 dark:text-surface-400">
          {refreshing ? t('ui.ptr.loading') : armed ? t('ui.ptr.release') : t('ui.ptr.pull')}
        </span>
      </m.div>
      <m.div style={{ y }}>{children}</m.div>
    </div>
  )
}
