'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, PawPrint, Footprints, ShieldCheck, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/dashboard', label: 'Início', Icon: Home, match: (p: string) => p === '/dashboard' },
  { href: '/pets', label: 'Pets', Icon: PawPrint, match: (p: string) => p.startsWith('/pets') },
  { href: '/walks', label: 'Passeios', Icon: Footprints, match: (p: string) => p.startsWith('/walks') },
  { href: '/health/vaccines', label: 'Saúde', Icon: ShieldCheck, match: (p: string) => p.startsWith('/health') },
  { href: '/settings', label: 'Perfil', Icon: User, match: (p: string) => p.startsWith('/settings') },
]

export function BottomNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-surface-200 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, Icon, match }) => {
          const active = match(pathname)
          return (
            <li key={href} className="relative">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 min-h-[60px] tap-target transition',
                  active ? 'text-primary-600' : 'text-surface-500 hover:text-surface-800',
                )}
              >
                <Icon className={cn('w-5 h-5', active && 'fill-primary-100/40')} aria-hidden />
                <span className={cn('text-[10px] font-medium leading-tight', active && 'font-semibold')}>
                  {label}
                </span>
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-b-full" aria-hidden />}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
