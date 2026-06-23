'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  PawPrint, LayoutDashboard, Heart, Syringe, FlaskConical,
  Route, Trophy, MapPin, Settings, LogOut, Menu, X, Brain, MailOpen,
  ChevronDown, ChevronRight, Plus, CreditCard, Footprints, Crown
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn, getSpeciesEmoji } from '@/lib/utils'
import type { Pet } from '@/lib/api'

interface SidebarProps {
  pets?: Pet[]
  activePetId?: number
  onPetChange?: (pet: Pet) => void
}

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
  children?: { href: string; label: string; icon: React.ReactNode }[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { href: '/pets', icon: <PawPrint className="w-5 h-5" />, label: 'Meus Pets' },
  {
    href: '/health',
    icon: <Heart className="w-5 h-5" />,
    label: 'Saúde',
    children: [
      { href: '/health/vaccines', label: 'Vacinas', icon: <Syringe className="w-4 h-4" /> },
      { href: '/health/vaccines/carteirinha/__PET__', label: 'Carteirinha Digital', icon: <CreditCard className="w-4 h-4" /> },
      { href: '/health/exams', label: 'Exames', icon: <FlaskConical className="w-4 h-4" /> },
    ],
  },
  { href: '/walks', icon: <Footprints className="w-5 h-5" />, label: 'Passeios' },
  { href: '/routines', icon: <Route className="w-5 h-5" />, label: 'Rotinas' },
  { href: '/challenges', icon: <Trophy className="w-5 h-5" />, label: 'Desafios' },
  { href: '/nearby', icon: <MapPin className="w-5 h-5" />, label: 'Buscar Clínicas' },
  { href: '/behavior', icon: <Brain className="w-5 h-5" />, label: 'Planos Comportamentais' },
  { href: '/convites', icon: <MailOpen className="w-5 h-5" />, label: 'Convites' },
  { href: '/plans', icon: <Crown className="w-5 h-5" />, label: 'Planos' },
  { href: '/settings', icon: <Settings className="w-5 h-5" />, label: 'Configurações' },
]

export function Sidebar({ pets = [], activePetId, onPetChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(pathname.startsWith('/health'))
  const [petSelectOpen, setPetSelectOpen] = useState(false)

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
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-surface-100">
        <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center shrink-0">
          <PawPrint className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-surface-900">PetLife</span>
        <button
          className="ml-auto md:hidden text-surface-500 hover:text-surface-700"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User */}
      {user && (
        <div className="px-4 py-4 border-b border-surface-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-surface-900 truncate">{user.name}</div>
              <div className="text-xs text-surface-500 truncate">{user.email}</div>
            </div>
          </div>
        </div>
      )}

      {/* Pet selector */}
      {pets.length > 0 && (
        <div className="px-4 py-3 border-b border-surface-100">
          <div className="relative">
            <button
              onClick={() => setPetSelectOpen(v => !v)}
              className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-surface-200 hover:border-primary-300 hover:bg-primary-50 transition text-left"
            >
              <span className="text-xl">{getSpeciesEmoji(activePet?.species)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-surface-900 truncate">
                  {activePet?.name ?? 'Selecionar pet'}
                </div>
                <div className="text-xs text-surface-500 truncate">{activePet?.breed?.name ?? 'Pet ativo'}</div>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-surface-400 transition-transform', petSelectOpen && 'rotate-180')} />
            </button>

            {petSelectOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {pets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { onPetChange?.(p); setPetSelectOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2.5 hover:bg-primary-50 transition text-left',
                      p.id === activePetId && 'bg-primary-50'
                    )}
                  >
                    <span>{getSpeciesEmoji(p.species)}</span>
                    <span className="text-sm text-surface-900">{p.name}</span>
                    {p.id === activePetId && <span className="ml-auto text-xs text-primary-600">✓</span>}
                  </button>
                ))}
                <Link
                  href="/pets/new"
                  className="flex items-center gap-2 px-3 py-2.5 border-t border-surface-100 text-primary-600 hover:bg-primary-50 transition"
                  onClick={() => setPetSelectOpen(false)}
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Adicionar pet</span>
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
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                  )}
                >
                  <span className={isActive(item.href) ? 'text-primary-600' : 'text-surface-500'}>
                    {item.icon}
                  </span>
                  {item.label}
                  <ChevronRight className={cn('w-4 h-4 ml-auto transition-transform', healthOpen && 'rotate-90')} />
                </button>
                {healthOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-primary-100 pl-3">
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
                              ? 'bg-primary-100 text-primary-700 font-medium'
                              : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                          )}
                        >
                          <span>{child.icon}</span>
                          {child.label}
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
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
              )}
            >
              <span className={isActive(item.href) ? 'text-primary-600' : 'text-surface-500'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-4 py-4 border-t border-surface-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-600 hover:bg-red-50 hover:text-red-600 transition"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        aria-label="Abrir menu"
        className="fixed top-safe left-3 z-50 md:hidden bg-white/95 backdrop-blur shadow-md rounded-xl p-2 border border-surface-200 tap-target flex items-center justify-center"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-5 h-5 text-surface-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-72 bg-white border-r border-surface-200 z-50 transition-transform md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen bg-white border-r border-surface-200 fixed top-0 left-0 bottom-0">
        <SidebarContent />
      </aside>
    </>
  )
}
