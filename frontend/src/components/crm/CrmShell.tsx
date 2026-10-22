'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, MotionConfig, motion, useMotionValueEvent, useScroll } from 'framer-motion'
import {
  BarChart3, Bell, CalendarDays, CalendarPlus, ClipboardList, LayoutDashboard, LogOut, Menu as MenuIcon, Moon, Package,
  PanelLeftClose, PanelLeftOpen, PawPrint, Plus, Search, ShoppingCart, Smartphone, Sun, UserCog, UserPlus, Users, Wallet,
  type LucideIcon,
} from 'lucide-react'
import { crm, type CrmMe, type Role } from '@/lib/crmApi'
import { useTheme } from '@/contexts/ThemeContext'
import { ROLE } from './ui'
import { spring } from './motion'
import { ApptModal, ClientModal } from './forms'
import { ConfirmProvider } from './kit/ConfirmDialog'
import { CommandPalette } from './kit/CommandPalette'
import { DropdownMenu, type MenuItem } from './kit/DropdownMenu'
import { ErrorState } from './kit/ErrorState'
import { PersonAvatar } from './kit/PetAvatar'
import { Sheet } from './kit/Sheet'
import { Skeleton } from './kit/Skeleton'
import { useHotkey } from './kit/hooks'
import { Switch } from './kit/Inputs'

export { emitCrmChange, useCrmChange, type CrmChangeKind } from './kit/events'

/**
 * Moldura do PetLife Clínica: menu lateral recolhível (filtrado pelo papel),
 * cabeçalho com busca global (Ctrl/Cmd+K) e "Novo", barra inferior no
 * celular e controle de acesso: quem não é da equipe volta ao login.
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

export interface NavItem { href: string; label: string; Icon: LucideIcon; roles: Role[] }
export interface NavGroup { label: string; items: NavItem[] }

const ALL: Role[] = ['vet', 'recepcao', 'banho_tosa']
export const NAV: NavGroup[] = [
  {
    label: 'Atendimento',
    items: [
      { href: '/clinica', label: 'Painel', Icon: LayoutDashboard, roles: ALL },
      { href: '/clinica/recepcao', label: 'Recepção', Icon: ClipboardList, roles: ALL },
      { href: '/clinica/agenda', label: 'Agenda', Icon: CalendarDays, roles: ALL },
      { href: '/clinica/clientes', label: 'Clientes e pets', Icon: Users, roles: ALL },
      { href: '/clinica/lembretes', label: 'Lembretes', Icon: Bell, roles: ['vet', 'recepcao'] },
    ],
  },
  {
    label: 'Vendas',
    items: [
      { href: '/clinica/caixa', label: 'Caixa', Icon: ShoppingCart, roles: ALL },
      { href: '/clinica/estoque', label: 'Estoque e serviços', Icon: Package, roles: ['recepcao'] },
      { href: '/clinica/financeiro', label: 'Financeiro', Icon: Wallet, roles: [] },
      { href: '/clinica/relatorios', label: 'Relatórios', Icon: BarChart3, roles: [] },
    ],
  },
  {
    label: 'Clínica',
    items: [
      { href: '/clinica/app', label: 'Clientes do app', Icon: Smartphone, roles: ['vet', 'recepcao'] },
      { href: '/clinica/equipe', label: 'Equipe e clínica', Icon: UserCog, roles: [] },
    ],
  },
]
const BOTTOM = ['/clinica', '/clinica/agenda', '/clinica/caixa', '/clinica/clientes']
const SHORT: Record<string, string> = { '/clinica': 'Painel', '/clinica/agenda': 'Agenda', '/clinica/caixa': 'Caixa', '/clinica/clientes': 'Clientes' }

function isActivePath(pathname: string, href: string) {
  if (href === '/clinica') return pathname === '/clinica'
  if (href === '/clinica/clientes') return pathname.startsWith('/clinica/clientes') || pathname.startsWith('/clinica/pacientes')
  return pathname === href || pathname.startsWith(href + '/')
}

function logout() {
  try {
    localStorage.removeItem('petlife_token')
    localStorage.removeItem('petlife_user')
    localStorage.removeItem('petlife_is_vet')
  } catch { /* sem armazenamento: só sai */ }
  window.location.assign('/vet/login')
}

export function CrmShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [me, setMe] = useState<CrmMe | null>(null)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    crm.me().then(m => { setMe(m); setError(null) }).catch((e: Error & { status?: number }) => {
      if (e.status === 401 || e.status === 403) {
        setDenied(true)
        setTimeout(() => router.replace('/vet/login?next=/clinica'), 1200)
      } else {
        setError(e.message || 'Sem resposta do servidor.')
      }
    })
  }, [router])
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  let body: ReactNode
  if (denied) {
    body = (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6 text-center">
        <div>
          <span className="mx-auto h-12 w-12 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 inline-flex items-center justify-center">
            <PawPrint className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <p className="mt-3 text-sm font-semibold text-ink">Acesso restrito à equipe da clínica.</p>
          <p className="mt-1 text-sm text-muted">Levando você ao login das clínicas…</p>
        </div>
      </div>
    )
  } else if (!me && error) {
    body = (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="bg-panel rounded-2xl shadow-crm-card w-full max-w-md"><ErrorState message={error} onRetry={load} /></div>
      </div>
    )
  } else if (!me) {
    body = <FrameSkeleton />
  } else {
    body = (
      <CrmCtx.Provider value={{ me, reload: load }}>
        <Frame me={me}>{children}</Frame>
      </CrmCtx.Provider>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <ConfirmProvider>{body}</ConfirmProvider>
    </MotionConfig>
  )
}

function FrameSkeleton() {
  return (
    <div className="min-h-screen bg-bg flex" role="status" aria-label="Carregando PetLife Clínica">
      <div className="hidden md:flex w-60 shrink-0 flex-col gap-3 border-r border-line bg-panel p-4">
        <div className="flex items-center gap-2"><Skeleton className="h-9 w-9 rounded-xl" /><Skeleton className="h-4 w-28" /></div>
        <div className="mt-6 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-14 border-b border-line px-4 md:px-6 flex items-center gap-3">
          <Skeleton className="h-8 w-40 md:w-80" /><Skeleton className="h-8 w-8 ml-auto rounded-full" />
        </div>
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-4">
          <Skeleton className="h-7 w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

function Frame({ me, children }: { me: CrmMe; children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() || '/clinica'
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [cmdk, setCmdk] = useState(false)
  const [more, setMore] = useState(false)
  const [apptOpen, setApptOpen] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', v => setScrolled(v > 4))

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('crm_sidebar') === '1') } catch { /* padrão aberto */ }
  }, [])
  const toggleCollapsed = () => setCollapsed(c => {
    try { localStorage.setItem('crm_sidebar', c ? '0' : '1') } catch { /* só nesta visita */ }
    return !c
  })
  useEffect(() => { setMore(false); setCmdk(false) }, [pathname])
  useHotkey('k', e => { e.preventDefault(); setCmdk(o => !o) }, { meta: true })

  const role = me.user.role
  const groups = NAV.map(g => ({ ...g, items: g.items.filter(n => can(role, ...n.roles)) })).filter(g => g.items.length)
  const flat = groups.flatMap(g => g.items)
  const bottom = BOTTOM.map(h => flat.find(n => n.href === h)).filter((n): n is NavItem => !!n)
  const moreItems = flat.filter(n => BOTTOM.indexOf(n.href) < 0)
  const moreActive = moreItems.some(n => isActivePath(pathname, n.href))
  const dark = theme === 'dark'
  const toggleTheme = () => setTheme(dark ? 'light' : 'dark')

  const runAction = (a: 'appt' | 'client' | 'sale') => {
    if (a === 'appt') setApptOpen(true)
    else if (a === 'client') setClientOpen(true)
    else router.push('/clinica/caixa')
  }
  const newItems: MenuItem[] = [
    { label: 'Agendamento', icon: CalendarPlus, onSelect: () => runAction('appt') },
    { label: 'Venda', icon: ShoppingCart, onSelect: () => runAction('sale') },
    { label: 'Cliente', icon: UserPlus, onSelect: () => runAction('client') },
  ]
  const userItems: Array<MenuItem | 'separator'> = [
    ...(role === 'admin' ? [{ label: 'Equipe e clínica', icon: UserCog, onSelect: () => router.push('/clinica/equipe') }] : []),
    { label: dark ? 'Tema claro' : 'Tema escuro', icon: dark ? Sun : Moon, onSelect: toggleTheme },
    'separator',
    { label: 'Sair', icon: LogOut, onSelect: logout, danger: true },
  ]

  return (
    <>
      <a href="#crm-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-panel focus:px-3 focus:py-2 focus:shadow-crm-pop">
        Pular para o conteúdo
      </a>
      <div className="min-h-screen bg-bg text-ink flex">
        {/* menu lateral (computador) */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 64 : 240 }}
          transition={spring.soft}
          className="hidden md:flex sticky top-0 h-screen shrink-0 flex-col bg-panel border-r border-line z-20 overflow-hidden"
          aria-label="Menu principal"
        >
          <div className={`flex items-center gap-2.5 h-14 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
            <span className="h-8 w-8 shrink-0 rounded-lg bg-primary-600 dark:bg-primary-500 inline-flex items-center justify-center">
              <PawPrint className="w-[18px] h-[18px] text-white dark:text-surface-950" strokeWidth={1.75} />
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-display font-extrabold text-sm text-ink leading-tight whitespace-nowrap">PetLife Clínica</p>
                <p className="text-2xs text-muted truncate">{me.clinic.name}</p>
              </div>
            )}
          </div>
          <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pb-3">
            {groups.map(g => (
              <div key={g.label} className="mt-3 first:mt-1">
                {collapsed
                  ? <div className="mx-3 my-2 h-px bg-line" aria-hidden />
                  : <p className="px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted whitespace-nowrap">{g.label}</p>}
                <ul className="space-y-0.5">
                  {g.items.map(n => {
                    const active = isActivePath(pathname, n.href)
                    return (
                      <li key={n.href}>
                        <Link href={n.href} aria-current={active ? 'page' : undefined}
                          title={collapsed ? n.label : undefined} aria-label={collapsed ? n.label : undefined}
                          className={`relative flex items-center gap-3 h-9 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center px-0' : 'px-2.5'}
                            ${active ? 'text-primary-700 dark:text-primary-300' : 'text-ink/75 hover:text-ink hover:bg-panel-2'}`}>
                          {active && <motion.span layoutId="nav-active" transition={spring.snappy} className="absolute inset-0 rounded-lg bg-primary-50 dark:bg-primary-500/15" />}
                          <n.Icon className="relative w-[18px] h-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                          {!collapsed && <span className="relative truncate">{n.label}</span>}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className={`shrink-0 border-t border-line p-2 ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
            {!collapsed ? (
              <div className="flex items-center gap-2.5 px-2 py-2">
                <PersonAvatar name={me.user.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">{me.user.name}</p>
                  <p className="text-2xs text-muted truncate">{ROLE[role]}</p>
                </div>
                <button type="button" onClick={logout} title="Sair" aria-label="Sair"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 dark:hover:text-red-400">
                  <LogOut className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={logout} title="Sair" aria-label="Sair"
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15">
                <LogOut className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
            <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Abrir menu lateral' : 'Recolher menu lateral'} title={collapsed ? 'Abrir menu' : 'Recolher menu'}
              className={`h-9 inline-flex items-center gap-3 rounded-lg text-sm text-muted hover:text-ink hover:bg-panel-2 ${collapsed ? 'w-9 justify-center' : 'w-full px-2.5'}`}>
              {collapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.75} /> : <><PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.75} /><span>Recolher</span></>}
            </button>
          </div>
        </motion.aside>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* cabeçalho */}
          <header className={`sticky top-0 z-30 shrink-0 flex items-center gap-2 px-4 md:px-6 transition-[background-color,border-color,backdrop-filter] duration-200
            ${scrolled ? 'bg-bg/80 backdrop-blur-md border-b border-line' : 'bg-bg border-b border-transparent'}`}
            style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(56px + env(safe-area-inset-top))' }}>
            <div className="md:hidden flex items-center gap-2 min-w-0 flex-1">
              <span className="h-8 w-8 shrink-0 rounded-lg bg-primary-600 dark:bg-primary-500 inline-flex items-center justify-center">
                <PawPrint className="w-[18px] h-[18px] text-white dark:text-surface-950" strokeWidth={1.75} />
              </span>
              <span className="font-display font-extrabold text-ink truncate">{me.clinic.name}</span>
            </div>
            <button type="button" onClick={() => setCmdk(true)} aria-label="Buscar tutor, pet ou telefone"
              className="hidden md:flex items-center gap-2.5 h-9 w-full max-w-md rounded-lg bg-panel px-3 text-sm text-muted shadow-crm-card hover:text-ink transition-colors">
              <Search className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="flex-1 text-left truncate">Buscar tutor, pet ou telefone</span>
              <ShortcutHint />
            </button>
            <button type="button" onClick={() => setCmdk(true)} aria-label="Buscar tutor, pet ou telefone"
              className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink hover:bg-panel-2">
              <Search className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>
            <div className="hidden md:block flex-1" />
            <div className="hidden md:block">
              <DropdownMenu ariaLabel="Novo" align="end" items={newItems}
                triggerClassName="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm dark:bg-primary-500 dark:hover:bg-primary-400 dark:text-surface-950 transition-colors"
                trigger={<><Plus className="w-4 h-4" strokeWidth={2} aria-hidden />Novo</>} />
            </div>
            <button type="button" onClick={toggleTheme} aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'} title={dark ? 'Tema claro' : 'Tema escuro'}
              className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink hover:bg-panel-2 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={dark ? 'sun' : 'moon'} initial={{ rotate: -60, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 60, opacity: 0 }} transition={{ duration: 0.16 }}>
                  {dark ? <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} /> : <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />}
                </motion.span>
              </AnimatePresence>
            </button>
            <div className="hidden md:block">
              <DropdownMenu ariaLabel={`Conta de ${me.user.name}`} align="end" items={userItems}
                triggerClassName="h-9 w-9 inline-flex items-center justify-center rounded-full hover:ring-2 hover:ring-line"
                trigger={<PersonAvatar name={me.user.name} size="sm" />} />
            </div>
          </header>

          <main id="crm-main" tabIndex={-1} className="flex-1 min-w-0 outline-none">
            <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 md:pt-6 pb-24 md:pb-8">{children}</div>
          </main>
        </div>
      </div>

      {/* celular: barra inferior + botão Novo */}
      <nav aria-label="Navegação" className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-panel/95 backdrop-blur-md border-t border-line"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ul className="grid grid-cols-5 h-16">
          {bottom.map(n => {
            const active = isActivePath(pathname, n.href)
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={active ? 'page' : undefined}
                  className={`relative h-full flex flex-col items-center justify-center gap-1 text-2xs font-semibold ${active ? 'text-primary-700 dark:text-primary-300' : 'text-muted'}`}>
                  <span className="relative inline-flex h-7 w-12 items-center justify-center">
                    {active && <motion.span layoutId="bnav-active" transition={spring.snappy} className="absolute inset-0 rounded-full bg-primary-50 dark:bg-primary-500/15" />}
                    <n.Icon className="relative w-5 h-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  {SHORT[n.href] ?? n.label}
                </Link>
              </li>
            )
          })}
          <li>
            <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more}
              className={`relative w-full h-full flex flex-col items-center justify-center gap-1 text-2xs font-semibold ${moreActive ? 'text-primary-700 dark:text-primary-300' : 'text-muted'}`}>
              <span className="relative inline-flex h-7 w-12 items-center justify-center">
                {moreActive && <motion.span layoutId="bnav-active" transition={spring.snappy} className="absolute inset-0 rounded-full bg-primary-50 dark:bg-primary-500/15" />}
                <MenuIcon className="relative w-5 h-5" strokeWidth={1.75} aria-hidden />
              </span>
              Mais
            </button>
          </li>
        </ul>
      </nav>
      <div className="md:hidden fixed right-4 z-40" style={{ bottom: 'calc(64px + 16px + env(safe-area-inset-bottom))' }}>
        <DropdownMenu ariaLabel="Novo" align="end" items={newItems}
          triggerClassName="h-14 w-14 rounded-full bg-primary-600 text-white shadow-crm-pop inline-flex items-center justify-center active:scale-95 transition-transform dark:bg-primary-500 dark:text-surface-950"
          trigger={<Plus className="w-6 h-6" strokeWidth={2} aria-hidden />} />
      </div>

      <Sheet open={more} onClose={() => setMore(false)} title="Mais opções" initialFocus={false}>
        <div className="space-y-5">
          {groups.map(g => {
            const list = g.items.filter(n => BOTTOM.indexOf(n.href) < 0)
            if (!list.length) return null
            return (
              <div key={g.label}>
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-1.5">{g.label}</p>
                <ul className="-mx-2">
                  {list.map(n => {
                    const active = isActivePath(pathname, n.href)
                    return (
                      <li key={n.href}>
                        <Link href={n.href} aria-current={active ? 'page' : undefined} onClick={() => setMore(false)}
                          className={`flex items-center gap-3 h-12 px-2 rounded-lg text-[15px] font-medium ${active ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300' : 'text-ink hover:bg-panel-2'}`}>
                          <n.Icon className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden /> {n.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          <div className="border-t border-line pt-4">
            <Switch checked={dark} onChange={v => setTheme(v ? 'dark' : 'light')} label="Tema escuro" />
          </div>
          <div className="border-t border-line pt-4 flex items-center gap-3">
            <PersonAvatar name={me.user.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate">{me.user.name}</p>
              <p className="text-xs text-muted">{ROLE[role]} · {me.clinic.name}</p>
            </div>
            <button type="button" onClick={logout}
              className="h-9 px-3 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-500/15 dark:text-red-300">
              <LogOut className="w-4 h-4" strokeWidth={1.75} /> Sair
            </button>
          </div>
        </div>
      </Sheet>

      <CommandPalette open={cmdk} onClose={() => setCmdk(false)} onAction={runAction} />
      <ApptModal open={apptOpen} onClose={() => setApptOpen(false)} onSaved={() => { /* a agenda e o painel recarregam pelo emitCrmChange */ }} />
      <ClientModal open={clientOpen} onClose={() => setClientOpen(false)} onSaved={c => router.push(`/clinica/clientes/${c.id}`)} />
    </>
  )
}

function ShortcutHint() {
  const [mac, setMac] = useState(false)
  useEffect(() => {
    try { setMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) } catch { /* padrão Ctrl */ }
  }, [])
  return <kbd className="shrink-0 inline-flex h-5 items-center rounded border border-line px-1.5 text-2xs font-medium text-muted">{mac ? '⌘K' : 'Ctrl K'}</kbd>
}
