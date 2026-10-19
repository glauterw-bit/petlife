'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CalendarDays, Users, ShoppingCart, Package, Wallet, Bell, Smartphone, UserCog, LogOut, Menu, X, PawPrint,
} from 'lucide-react'
import { crm, type CrmMe, type Role } from '@/lib/crmApi'
import { ROLE } from './ui'

/**
 * Moldura do PetLife Clínica: menu lateral (filtrado pelo papel da pessoa),
 * cabeçalho com a clínica e controle de acesso — quem não é da equipe de uma
 * clínica volta para o login das clínicas.
 */
const CrmCtx = createContext<{ me: CrmMe; reload: () => void } | null>(null)
export function useCrm() {
  const c = useContext(CrmCtx)
  if (!c) throw new Error('useCrm fora do CrmShell')
  return c
}
export function can(role: Role, ...allowed: Role[]) {
  return role === 'admin' || allowed.includes(role)
}

const NAV: Array<{ href: string; label: string; Icon: typeof LayoutDashboard; roles: Role[] }> = [
  { href: '/clinica', label: 'Painel', Icon: LayoutDashboard, roles: ['vet', 'recepcao', 'banho_tosa'] },
  { href: '/clinica/agenda', label: 'Agenda', Icon: CalendarDays, roles: ['vet', 'recepcao', 'banho_tosa'] },
  { href: '/clinica/clientes', label: 'Clientes e pets', Icon: Users, roles: ['vet', 'recepcao', 'banho_tosa'] },
  { href: '/clinica/caixa', label: 'Caixa e vendas', Icon: ShoppingCart, roles: ['vet', 'recepcao', 'banho_tosa'] },
  { href: '/clinica/estoque', label: 'Serviços e estoque', Icon: Package, roles: ['recepcao'] },
  { href: '/clinica/financeiro', label: 'Financeiro', Icon: Wallet, roles: [] },
  { href: '/clinica/lembretes', label: 'Lembretes', Icon: Bell, roles: ['vet', 'recepcao'] },
  { href: '/clinica/app', label: 'Clientes do app', Icon: Smartphone, roles: ['vet', 'recepcao'] },
  { href: '/clinica/equipe', label: 'Equipe e clínica', Icon: UserCog, roles: [] },
]

export function CrmShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<CrmMe | null>(null)
  const [denied, setDenied] = useState(false)
  const [open, setOpen] = useState(false)

  const load = () => {
    crm.me().then(setMe).catch((e: Error & { status?: number }) => {
      if (e.status === 401 || e.status === 403) {
        setDenied(true)
        setTimeout(() => router.replace('/vet/login?next=/clinica'), 1200)
      }
    })
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setOpen(false), [pathname])

  if (denied) return <div className="min-h-screen flex items-center justify-center text-surface-500">Acesso restrito à equipe da clínica. Redirecionando…</div>
  if (!me) return <div className="min-h-screen flex items-center justify-center text-surface-500">Carregando PetLife Clínica…</div>

  const items = NAV.filter(n => can(me.user.role, ...n.roles))
  const isActive = (href: string) => (href === '/clinica' ? pathname === '/clinica' : pathname.startsWith(href))
  const logout = () => {
    try { localStorage.removeItem('petlife_token'); localStorage.removeItem('petlife_user'); localStorage.removeItem('petlife_is_vet') } catch {}
    window.location.assign('/vet/login')
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, Icon }) => (
        <Link key={href} href={href}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${isActive(href)
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
            : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/50'}`}>
          <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" /> {label}
        </Link>
      ))}
    </nav>
  )

  return (
    <CrmCtx.Provider value={{ me, reload: load }}>
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex">
        <aside className={`fixed md:sticky top-0 z-40 h-screen w-64 shrink-0 bg-white dark:bg-surface-800 border-r border-surface-100 dark:border-surface-700 p-4 flex flex-col transition-transform ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="flex items-center gap-2 mb-6 px-1">
            <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center"><PawPrint className="w-5 h-5 text-white" /></div>
            <div className="min-w-0">
              <p className="font-bold text-surface-900 dark:text-white leading-tight">PetLife Clínica</p>
              <p className="text-[11px] text-surface-500 dark:text-surface-400 truncate">{me.clinic.name}</p>
            </div>
            <button className="md:hidden ml-auto p-1" onClick={() => setOpen(false)} aria-label="Fechar menu"><X className="w-5 h-5" /></button>
          </div>
          {nav}
          <div className="mt-auto pt-4 border-t border-surface-100 dark:border-surface-700">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100 truncate">{me.user.name}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">{ROLE[me.user.role]}</p>
            <button onClick={logout} className="mt-3 flex items-center gap-2 text-sm text-surface-500 hover:text-red-600"><LogOut className="w-4 h-4" /> Sair</button>
          </div>
        </aside>
        {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}
        <main className="flex-1 min-w-0">
          <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-surface-800 border-b border-surface-100 dark:border-surface-700 px-4 py-3 flex items-center gap-3">
            <button onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="w-5 h-5" /></button>
            <span className="font-semibold text-surface-900 dark:text-white truncate">{me.clinic.name}</span>
          </div>
          <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
        </main>
      </div>
    </CrmCtx.Provider>
  )
}
