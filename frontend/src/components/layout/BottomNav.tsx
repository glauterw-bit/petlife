'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, PawPrint, Footprints, ShieldCheck, LayoutGrid,
  Trophy, Route, MapPin, Brain, MailOpen, Crown, FlaskConical, Camera,
  Settings, MessageCircleHeart, BellRing, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import { haptic } from '@/lib/feedback'
import { useScrollDirection } from '@/lib/motion'
import { Sheet } from '@/components/ui/Sheet'
import { TAB_ROOTS } from './shell'

/**
 * Navegação mobile: 4 abas principais (hrefs = TAB_ROOTS de ./shell) + "Mais" (folha com o resto).
 *
 * Cápsula flutuante de vidro, 8 px acima da área segura. Vive no TutorShell
 * (montada uma vez), então a pílula da aba ativa desliza de uma aba para
 * outra — em CSS transform (compositor), com a curva linear() da mola snappy.
 *
 * Ao rolar para baixo os rótulos somem e a cápsula vai de 58 para 46 px
 * (alvos continuam ≥ 44 px); volta ao rolar para cima, no topo e no fim.
 * Com menos movimento, nunca encolhe. --bottom-nav-h fica no valor
 * expandido, então o padding das telas não pula.
 */
const [HOME, PETS, WALKS, HEALTH] = TAB_ROOTS
const TABS: { href: string; labelKey: string; Icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: HOME, labelKey: 'nav.home', Icon: Home, match: p => p === '/dashboard' },
  { href: PETS, labelKey: 'nav.pets', Icon: PawPrint, match: p => p.startsWith('/pets') },
  { href: WALKS, labelKey: 'nav.walks', Icon: Footprints, match: p => p.startsWith('/walks') },
  {
    href: HEALTH,
    labelKey: 'nav.health',
    Icon: ShieldCheck,
    match: p => p.startsWith('/health') && !p.startsWith('/health/exams'),
  },
]

const MORE: { href: string; labelKey: string; Icon: LucideIcon }[] = [
  { href: '/reminders', labelKey: 'nav.reminders', Icon: BellRing },
  { href: '/challenges', labelKey: 'nav.challenges', Icon: Trophy },
  { href: '/routines', labelKey: 'nav.routines', Icon: Route },
  { href: '/nearby', labelKey: 'nav.clinics', Icon: MapPin },
  { href: '/behavior', labelKey: 'nav.behavior', Icon: Brain },
  { href: '/health/exams', labelKey: 'nav.exams', Icon: FlaskConical },
  { href: '/convites', labelKey: 'nav.invites', Icon: MailOpen },
  { href: '/momentos', labelKey: 'nav.moments', Icon: Camera },
  { href: '/suporte', labelKey: 'nav.support', Icon: MessageCircleHeart },
  { href: '/plans', labelKey: 'nav.plans', Icon: Crown },
  { href: '/settings', labelKey: 'nav.profile', Icon: Settings },
]

const ADMIN_ITEM = { href: '/admin', labelKey: '', label: 'Admin', Icon: LayoutGrid }

export function BottomNav() {
  const pathname = usePathname() ?? ''
  const t = useT()
  const { user } = useAuth()
  const isAdmin = user?.email?.toLowerCase() === 'glauterw@gmail.com'
  const moreItems = isAdmin ? [...MORE, ADMIN_ITEM] : MORE
  const [moreOpen, setMoreOpen] = useState(false)

  // Aba tocada, antes da rota terminar de carregar: a pílula desliza na hora do toque.
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  // fecha a folha e limpa a aba pendente ao navegar
  useEffect(() => {
    setMoreOpen(false)
    setPendingHref(null)
    document.documentElement.removeAttribute('data-nav-pending')
  }, [pathname])

  // Sinal de "indo": html[data-nav-pending] esmaece o main (após 90 ms, no
  // CSS) até a rota trocar. Trava de segurança: some em 2 s de qualquer jeito.
  const pendingTimer = useRef<ReturnType<typeof setTimeout>>()
  function markPending() {
    document.documentElement.setAttribute('data-nav-pending', '')
    clearTimeout(pendingTimer.current)
    pendingTimer.current = setTimeout(() => document.documentElement.removeAttribute('data-nav-pending'), 2000)
  }
  useEffect(
    () => () => {
      clearTimeout(pendingTimer.current)
      document.documentElement.removeAttribute('data-nav-pending')
    },
    [],
  )

  const scrollDir = useScrollDirection()
  const compact = scrollDir === 'down' && !moreOpen

  const moreActive = moreItems.some(m => pathname === m.href || pathname.startsWith(m.href + '/'))
  const activeIndex = TABS.findIndex(tab => tab.match(pathname))
  const activeKey = moreOpen ? 'more' : pendingHref ?? (activeIndex >= 0 ? TABS[activeIndex].href : moreActive ? 'more' : null)
  const pillIndex = activeKey === 'more' ? TABS.length : TABS.findIndex(tab => tab.href === activeKey)

  return (
    <>
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t('nav.moreTitle')} ariaLabel={t('nav.moreAria')}>
        <ul className="grid grid-cols-4 gap-x-2 gap-y-3 pt-1 pb-1">
          {moreItems.map(({ href, labelKey, Icon, ...rest }) => {
            const label = labelKey ? t(labelKey) : (rest as { label?: string }).label ?? ''
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => haptic('tap')}
                  aria-current={active ? 'page' : undefined}
                  className="pressable flex flex-col items-center gap-1.5 py-1.5 rounded-2xl min-h-[44px]"
                >
                  <span
                    className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
                      active
                        ? 'bg-primary-100 text-primary-800 dark:bg-primary-500/20 dark:text-primary-200'
                        : 'bg-surface-100 text-primary-700 dark:bg-surface-800 dark:text-primary-300',
                    )}
                  >
                    <Icon className="w-6 h-6" aria-hidden strokeWidth={1.9} />
                  </span>
                  <span className="text-[12px] font-medium text-surface-700 dark:text-surface-200 text-center leading-tight">
                    {label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </Sheet>

      <nav
        aria-label={t('nav.mainAria')}
        data-compact={compact ? 'true' : 'false'}
        className="tabbar md:hidden fixed inset-x-3 z-50 rounded-[28px] border border-surface-200/70 dark:border-white/10 shadow-float"
      >
        <ul className="tabbar-row relative grid grid-cols-5 px-1">
          {/* Pílula única: anda por transform de uma aba para outra (1/5 da largura cada). */}
          {pillIndex >= 0 && (
            <li
              aria-hidden
              className="tabbar-pill pointer-events-none absolute inset-y-0 left-1 flex items-center justify-center"
              style={{ width: 'calc((100% - 0.5rem) / 5)', transform: `translate3d(${pillIndex * 100}%, 0, 0)` } as CSSProperties}
            >
              <span className={cn('block rounded-full bg-primary-100 dark:bg-primary-500/20 w-14 transition-transform duration-200', compact ? 'h-8 -translate-y-[2px]' : 'h-8 -translate-y-[9px]')} />
            </li>
          )}
          {TABS.map(({ href, labelKey, Icon }) => {
            const active = activeKey === href
            return (
              <li key={href} className="relative">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={compact ? t(labelKey) : undefined}
                  onClick={() => {
                    if (active) return
                    haptic('tab')
                    setPendingHref(href)
                    markPending()
                  }}
                  className={cn(
                    'h-full flex flex-col items-center justify-center gap-1 px-1 min-h-[44px] transition-colors active:opacity-70',
                    active ? 'text-primary-700 dark:text-primary-300' : 'text-surface-600 dark:text-surface-300 hover:text-surface-800 dark:hover:text-surface-100',
                  )}
                >
                  <span className="relative flex items-center justify-center w-14 h-8">
                    <Icon
                      key={active ? 'on' : 'off'}
                      className={cn('relative w-[22px] h-[22px]', active && 'icon-pop')}
                      aria-hidden
                      strokeWidth={active ? 2.3 : 1.9}
                    />
                  </span>
                  <span className={cn('tabbar-label text-[11px] leading-[14px]', active ? 'font-semibold' : 'font-medium')} aria-hidden={compact || undefined}>
                    {t(labelKey)}
                  </span>
                </Link>
              </li>
            )
          })}
          <li className="relative">
            <button
              type="button"
              onClick={() => {
                haptic('tab')
                setMoreOpen(v => !v)
              }}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              aria-label={t('nav.moreAria')}
              className={cn(
                'w-full h-full flex flex-col items-center justify-center gap-1 px-1 min-h-[44px] transition-colors active:opacity-70',
                moreActive || moreOpen ? 'text-primary-700 dark:text-primary-300' : 'text-surface-600 dark:text-surface-300 hover:text-surface-800 dark:hover:text-surface-100',
              )}
            >
              <span className="relative flex items-center justify-center w-14 h-8">
                <LayoutGrid
                  key={activeKey === 'more' ? 'on' : 'off'}
                  className={cn('relative w-[22px] h-[22px]', activeKey === 'more' && 'icon-pop')}
                  aria-hidden
                  strokeWidth={moreActive || moreOpen ? 2.3 : 1.9}
                />
              </span>
              <span className={cn('tabbar-label text-[11px] leading-[14px]', moreActive || moreOpen ? 'font-semibold' : 'font-medium')}>
                {t('nav.more')}
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
