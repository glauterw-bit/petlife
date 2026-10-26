'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  PawPrint, LayoutDashboard, Heart, Syringe, FlaskConical,
  Route, Trophy, MapPin, Settings, LogOut, Menu, X, Brain, MailOpen, MessageCircleHeart,
  ChevronDown, ChevronRight, Plus, CreditCard, Footprints, Crown, BarChart3, Check, Dog, Cat
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { support as supportApi } from '@/lib/api'
import { useT } from '@/contexts/LocaleContext'
import { cn } from '@/lib/utils'
import type { Pet } from '@/lib/api'

function SpeciesIcon({ species, className }: { species?: string; className?: string }) {
  const Icon = species === 'dog' ? Dog : species === 'cat' ? Cat : PawPrint
  return <Icon className={className} aria-hidden />
}

interface SidebarProps {
  pets?: Pet[]
  activePetId?: number
  onPetChange?: (pet: Pet) => void
}

interface NavItem {
  href: string
  icon: React.ReactNode
  labelKey: string
  children?: { href: string; labelKey: string; icon: React.ReactNode }[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, labelKey: 'v.side.dashboard' },
  { href: '/pets', icon: <PawPrint className="w-5 h-5" />, labelKey: 'dash.myPets' },
  {
    href: '/health',
    icon: <Heart className="w-5 h-5" />,
    labelKey: 'nav.health',
    children: [
      { href: '/health/vaccines', labelKey: 'v.side.vaccines', icon: <Syringe className="w-4 h-4" /> },
      { href: '/health/vaccines/carteirinha/__PET__', labelKey: 'v.side.card', icon: <CreditCard className="w-4 h-4" /> },
      { href: '/health/exams', labelKey: 'v.side.exams', icon: <FlaskConical className="w-4 h-4" /> },
    ],
  },
  { href: '/walks', icon: <Footprints className="w-5 h-5" />, labelKey: 'nav.walks' },
  { href: '/routines', icon: <Route className="w-5 h-5" />, labelKey: 'v.side.routines' },
  { href: '/challenges', icon: <Trophy className="w-5 h-5" />, labelKey: 'dash.challenges' },
  { href: '/nearby', icon: <MapPin className="w-5 h-5" />, labelKey: 'v.side.nearby' },
  { href: '/behavior', icon: <Brain className="w-5 h-5" />, labelKey: 'v.side.behavior' },
  { href: '/convites', icon: <MailOpen className="w-5 h-5" />, labelKey: 'v.side.invites' },
  { href: '/suporte', icon: <MessageCircleHeart className="w-5 h-5" />, labelKey: 'v.side.support' },
  { href: '/plans', icon: <Crown className="w-5 h-5" />, labelKey: 'v.side.plans' },
  { href: '/settings', icon: <Settings className="w-5 h-5" />, labelKey: 'v.side.settings' },
]

export function Sidebar({ pets = [], activePetId, onPetChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(pathname.startsWith('/health'))
  const [petSelectOpen, setPetSelectOpen] = useState(false)
  const [supUnread, setSupUnread] = useState(0)

  // A barra lateral só aparece a partir de 768 px: no celular não consulta
  // /support/unread (economiza uma requisição por minuto à toa).
  useEffect(() => {
    const mq = window.matchMedia('(min-width:768px)')
    let alive = true
    let iv: ReturnType<typeof setInterval> | undefined
    async function poll() {
      try { const { unread } = await supportApi.unread(); if (alive) setSupUnread(unread) } catch {}
    }
    function sync() {
      clearInterval(iv)
      iv = undefined
      if (!mq.matches) return
      poll()
      iv = setInterval(poll, 60_000)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => { alive = false; clearInterval(iv); mq.removeEventListener('change', sync) }
  }, [])

  const activePet = pets.find(p => p.id === activePetId) ?? pets[0]

  function handleLogout() {
    logout()
    router.push('/')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-surface-100 dark:border-surface-700">
        <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
          <PawPrint className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-surface-900 dark:text-white">PetLife</span>
        <button
          type="button"
          aria-label={t('common.close')}
          className="tap-target ml-auto md:hidden flex items-center justify-center rounded-lg text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-5 h-5" aria-hidden />
        </button>
      </div>

      {/* User */}
      {user && (
        <div className="px-4 py-4 border-b border-surface-100 dark:border-surface-700">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/60">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm shrink-0">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-surface-900 dark:text-white truncate">{user.name}</div>
              <div className="text-xs text-surface-500 dark:text-surface-400 truncate">{user.email}</div>
            </div>
          </div>
        </div>
      )}

      {/* Pet selector */}
      {pets.length > 0 && (
        <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700">
          <div className="relative">
            <button
              onClick={() => setPetSelectOpen(v => !v)}
              className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-primary-300 hover:bg-primary-50 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10 transition text-left"
            >
              <SpeciesIcon species={activePet?.species} className="w-5 h-5 text-primary-700 dark:text-primary-300" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-surface-900 dark:text-white truncate">
                  {activePet?.name ?? t('v.side.selectPet')}
                </div>
                <div className="text-xs text-surface-500 dark:text-surface-400 truncate">{activePet?.breed?.name ?? t('v.side.activePet')}</div>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-surface-400 transition-transform', petSelectOpen && 'rotate-180')} />
            </button>

            {petSelectOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg z-20 overflow-hidden">
                {pets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { onPetChange?.(p); setPetSelectOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2.5 min-h-[44px] hover:bg-primary-50 dark:hover:bg-primary-500/10 transition text-left',
                      p.id === activePetId && 'bg-primary-50 dark:bg-primary-500/15'
                    )}
                  >
                    <SpeciesIcon species={p.species} className="w-4 h-4 text-surface-500 dark:text-surface-400" />
                    <span className="text-sm text-surface-900 dark:text-white">{p.name}</span>
                    {p.id === activePetId && <Check className="ml-auto w-4 h-4 text-primary-700 dark:text-primary-300" aria-label={t('v.side.activePet')} />}
                  </button>
                ))}
                <Link
                  href="/pets/new"
                  className="flex items-center gap-2 px-3 py-2.5 min-h-[44px] border-t border-surface-100 dark:border-surface-700 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition"
                  onClick={() => setPetSelectOpen(false)}
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('v.side.addPet')}</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          if (item.children) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => setHealthOpen(v => !v)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
                      : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/40 hover:text-surface-900'
                  )}
                >
                  <span className={isActive(item.href) ? 'text-primary-600 dark:text-primary-300' : 'text-surface-500 dark:text-surface-400'}>
                    {item.icon}
                  </span>
                  {t(item.labelKey)}
                  <ChevronRight className={cn('w-4 h-4 ml-auto transition-transform', healthOpen && 'rotate-90')} />
                </button>
                {healthOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-primary-100 dark:border-primary-500/20 pl-3">
                    {item.children.map(child => {
                      const resolvedHref = child.href.includes('__PET__')
                        ? child.href.replace('__PET__', String(activePet?.id ?? pets[0]?.id ?? 0))
                        : child.href
                      const isDisabled = resolvedHref.includes('/0') && child.href.includes('__PET__') && pets.length === 0
                      return (
                        <Link
                          key={child.href}
                          href={isDisabled ? '/pets' : resolvedHref}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition',
                            pathname.startsWith(child.href.replace('__PET__', '').replace('//', '/'))
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 font-medium'
                              : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/40 hover:text-surface-900'
                          )}
                        >
                          <span>{child.icon}</span>
                          {t(child.labelKey)}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive(item.href)
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
                  : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/40 hover:text-surface-900'
              )}
            >
              <span className={isActive(item.href) ? 'text-primary-600 dark:text-primary-300' : 'text-surface-500 dark:text-surface-400'}>
                {item.icon}
              </span>
              {t(item.labelKey)}
              {item.href === '/suporte' && supUnread > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {supUnread}
                </span>
              )}
            </Link>
          )
        })}
        {user?.email?.toLowerCase() === 'glauterw@gmail.com' && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive('/admin')
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
                : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/40 hover:text-surface-900'
            )}
          >
            <span className={isActive('/admin') ? 'text-primary-600 dark:text-primary-300' : 'text-surface-500 dark:text-surface-400'}>
              <BarChart3 className="w-5 h-5" />
            </span>
            {t('v.side.admin')}
          </Link>
        )}
      </nav>

      {/* Logout */}
      <div className="px-4 py-4 border-t border-surface-100 dark:border-surface-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300 transition"
        >
          <LogOut className="w-5 h-5" />
          {t('v.side.logout')}
        </button>
      </div>
    </div>
  )

  return (
    // No mobile a navegação é 100% pela BottomNav (abas + "Mais") — sem
    // hamburger nem gaveta lateral. A sidebar existe só no desktop (md+).
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 fixed top-0 left-0 bottom-0 z-30">
      <SidebarContent />
    </aside>
  )
}
