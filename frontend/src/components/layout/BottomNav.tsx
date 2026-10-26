'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Home, PawPrint, Footprints, ShieldCheck, LayoutGrid,
  Trophy, Route, MapPin, Brain, MailOpen, Crown, FlaskConical, Camera,
  Settings, MessageCircleHeart, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import { hapticLight, hapticSelect } from '@/lib/feedback'
import { spring } from '@/lib/motion'
import { Sheet } from '@/components/ui/Sheet'

/**
 * Navegação mobile: 4 abas principais + "Mais" (folha com o resto).
 * Vive no TutorShell (montada uma vez), então a pílula da aba ativa desliza
 * de uma aba para outra em vez de reaparecer.
 */
const TABS: { href: string; labelKey: string; Icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: '/dashboard', labelKey: 'nav.home', Icon: Home, match: p => p === '/dashboard' },
  { href: '/pets', labelKey: 'nav.pets', Icon: PawPrint, match: p => p.startsWith('/pets') },
  { href: '/walks', labelKey: 'nav.walks', Icon: Footprints, match: p => p.startsWith('/walks') },
  {
    href: '/health/vaccines',
    labelKey: 'nav.health',
    Icon: ShieldCheck,
    match: p => p.startsWith('/health') && !p.startsWith('/health/exams'),
  },
]

const MORE: { href: string; labelKey: string; Icon: LucideIcon }[] = [
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
  useEffect(() => { setMoreOpen(false); setPendingHref(null) }, [pathname])

  const moreActive = moreItems.some(m => pathname === m.href || pathname.startsWith(m.href + '/'))
  const activeIndex = TABS.findIndex(tab => tab.match(pathname))
  const activeKey = moreOpen ? 'more' : pendingHref ?? (activeIndex >= 0 ? TABS[activeIndex].href : moreActive ? 'more' : null)

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
                  onClick={() => void hapticLight()}
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
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/80 dark:bg-surface-950/80 backdrop-blur-xl backdrop-saturate-150 border-t border-surface-200/80 dark:border-surface-800 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, labelKey, Icon }) => {
            const active = activeKey === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    if (active) return
                    void hapticSelect()
                    setPendingHref(href)
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 px-1 min-h-[58px] transition-colors active:opacity-70',
                    active ? 'text-primary-700 dark:text-primary-300' : 'text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200',
                  )}
                >
                  <span className="relative flex items-center justify-center w-14 h-8">
                    {active && (
                      <motion.span
                        layoutId="tabPill"
                        transition={spring.snappy}
                        className="absolute inset-0 rounded-full bg-primary-100 dark:bg-primary-500/20"
                        aria-hidden
                      />
                    )}
                    <Icon className="relative w-[22px] h-[22px]" aria-hidden strokeWidth={active ? 2.3 : 1.9} />
                  </span>
                  <span className={cn('text-[11px] leading-none', active ? 'font-semibold' : 'font-medium')}>
                    {t(labelKey)}
                  </span>
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => {
                void hapticLight()
                setMoreOpen(v => !v)
              }}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              aria-label={t('nav.moreAria')}
              className={cn(
                'w-full flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 px-1 min-h-[58px] transition-colors active:opacity-70',
                moreActive || moreOpen ? 'text-primary-700 dark:text-primary-300' : 'text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200',
              )}
            >
              <span className="relative flex items-center justify-center w-14 h-8">
                {activeKey === 'more' && (
                  <motion.span
                    layoutId="tabPill"
                    transition={spring.snappy}
                    className="absolute inset-0 rounded-full bg-primary-100 dark:bg-primary-500/20"
                    aria-hidden
                  />
                )}
                <LayoutGrid className="relative w-[22px] h-[22px]" aria-hidden strokeWidth={moreActive || moreOpen ? 2.3 : 1.9} />
              </span>
              <span className={cn('text-[11px] leading-none', moreActive || moreOpen ? 'font-semibold' : 'font-medium')}>
                {t('nav.more')}
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
