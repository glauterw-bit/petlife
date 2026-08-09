'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, PawPrint, Footprints, ShieldCheck, LayoutGrid, X,
  Trophy, Route, MapPin, Brain, MailOpen, Crown, FlaskConical,
  Settings, CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Navegação mobile completa: 4 abas principais + "Mais" (sheet com o resto).
 * Nenhuma tela depende da sidebar no celular — tudo a um toque do polegar.
 */
const TABS = [
  { href: '/dashboard', label: 'Início', Icon: Home, match: (p: string) => p === '/dashboard' },
  { href: '/pets', label: 'Pets', Icon: PawPrint, match: (p: string) => p.startsWith('/pets') },
  { href: '/walks', label: 'Passeios', Icon: Footprints, match: (p: string) => p.startsWith('/walks') },
  { href: '/health/vaccines', label: 'Saúde', Icon: ShieldCheck, match: (p: string) => p.startsWith('/health') },
]

const MORE = [
  { href: '/challenges', label: 'Desafios', Icon: Trophy, tint: 'text-accent-600 bg-accent-50 dark:text-accent-300 dark:bg-accent-500/15' },
  { href: '/routines', label: 'Rotinas', Icon: Route, tint: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15' },
  { href: '/nearby', label: 'Clínicas', Icon: MapPin, tint: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15' },
  { href: '/behavior', label: 'Comportamento', Icon: Brain, tint: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-500/15' },
  { href: '/health/exams', label: 'Exames', Icon: FlaskConical, tint: 'text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/15' },
  { href: '/convites', label: 'Convites', Icon: MailOpen, tint: 'text-pink-600 bg-pink-50 dark:text-pink-300 dark:bg-pink-500/15' },
  { href: '/plans', label: 'Planos', Icon: Crown, tint: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15' },
  { href: '/settings', label: 'Perfil', Icon: Settings, tint: 'text-surface-600 bg-surface-100 dark:text-surface-300 dark:bg-surface-700' },
]

const ADMIN_ITEM = { href: '/admin', label: 'Admin', Icon: LayoutGrid, tint: 'text-primary-700 bg-primary-100 dark:text-primary-300 dark:bg-primary-500/20' }

export function BottomNav() {
  const pathname = usePathname() ?? ''
  const { user } = useAuth()
  const isAdmin = user?.email?.toLowerCase() === 'glauterw@gmail.com'
  const moreItems = isAdmin ? [...MORE, ADMIN_ITEM] : MORE
  const [moreOpen, setMoreOpen] = useState(false)

  // fecha o sheet ao navegar e trava o scroll enquanto aberto
  useEffect(() => { setMoreOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = moreOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [moreOpen])

  const moreActive = moreItems.some(m => pathname.startsWith(m.href))

  return (
    <>
      {/* Sheet "Mais" */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 inset-x-0 bg-white dark:bg-surface-800 rounded-t-3xl p-5 pb-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)] shadow-2xl animate-sheet-up"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Mais seções"
          >
            <div className="w-10 h-1 rounded-full bg-surface-200 dark:bg-surface-600 mx-auto mb-4" aria-hidden />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-surface-900 dark:text-white">Tudo do PetLife</h3>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 tap-target"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {moreItems.map(({ href, label, Icon, tint }, i) => (
                <Link
                  key={href}
                  href={href}
                  className="pressable reveal flex flex-col items-center gap-1.5 py-2 rounded-2xl"
                  style={{ ['--i' as string]: i }}
                >
                  <span className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', tint)}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-medium text-surface-700 dark:text-surface-200 text-center leading-tight">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Navegação principal"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-surface-900/95 backdrop-blur border-t border-surface-200 dark:border-surface-700 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, label, Icon, match }) => {
            const active = match(pathname)
            return (
              <li key={href} className="relative">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'pressable flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 min-h-[60px] tap-target transition',
                    active ? 'text-primary-600' : 'text-surface-500 dark:text-surface-400 hover:text-surface-800',
                  )}
                >
                  <Icon className={cn('w-5 h-5 transition-transform', active && 'scale-110 fill-primary-100/40')} aria-hidden />
                  <span className={cn('text-[10px] font-medium leading-tight', active && 'font-semibold')}>
                    {label}
                  </span>
                  {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-b-full" aria-hidden />}
                </Link>
              </li>
            )
          })}
          <li className="relative">
            <button
              onClick={() => setMoreOpen(v => !v)}
              aria-expanded={moreOpen}
              className={cn(
                'pressable w-full flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 min-h-[60px] tap-target transition',
                moreActive || moreOpen ? 'text-primary-600' : 'text-surface-500 dark:text-surface-400 hover:text-surface-800',
              )}
            >
              <LayoutGrid className={cn('w-5 h-5 transition-transform', moreOpen && 'rotate-90 scale-110')} aria-hidden />
              <span className={cn('text-[10px] font-medium leading-tight', (moreActive || moreOpen) && 'font-semibold')}>Mais</span>
              {moreActive && !moreOpen && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-b-full" aria-hidden />}
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
