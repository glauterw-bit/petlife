'use client'

/**
 * Shell persistente das telas do tutor — montado UMA vez no layout raiz.
 *
 * Barra inferior, sino, Vyron, modais globais e celebração vivem aqui e não
 * remontam ao trocar de tela. Isso destrava a pílula deslizante da barra, a
 * transição curta entre telas (app/template.tsx), a rolagem que volta ao
 * lugar e o cache de dados entre telas (lib/cache).
 *
 * Fora das rotas do tutor (clínica, admin, vet, páginas públicas, login),
 * devolve só o children.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MotionConfig } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import { pets as petsApi, type Pet } from '@/lib/api'
import { trackAppOpenOnce } from '@/lib/track'
import { useCached, clearCache } from '@/lib/cache'
import { clearRemotePushState } from '@/lib/push'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ShellSkeleton } from '@/components/ui/Skeleton'
import { CelebrationOverlay, celebrate } from '@/components/ui/CelebrationOverlay'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { FeedbackModal } from '@/components/feedback/FeedbackModal'
import { StoreInvite } from '@/components/feedback/StoreInvite'
import { AIChatWidget } from '@/components/ai/AIChatWidget'
import { QuotaUpsellModal } from '@/components/billing/QuotaUpsellModal'
import { SoftUpsell } from '@/components/billing/SoftUpsell'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileBackBar } from './MobileBackBar'
import { NotificationBell } from './NotificationBell'
import { ShellContext, isTutorRoute, type ShellContextValue } from './shell'

const EMPTY_PETS: Pet[] = []

/** Usuário dono do conteúdo atual do cache (undefined = ainda ninguém). */
let cacheOwner: number | null | undefined

export function TutorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  if (!isTutorRoute(pathname)) return <>{children}</>
  return <TutorShellInner>{children}</TutorShellInner>
}

function TutorShellInner({ children }: { children: ReactNode }) {
  const { user, isLoading, isVetUser } = useAuth()
  const router = useRouter()
  const t = useT()
  const pathname = usePathname() ?? ''

  // ── sessão ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !user) router.push('/auth/login')
  }, [user, isLoading, router])

  useEffect(() => {
    if (user) trackAppOpenOnce()
  }, [user])

  // Troca de usuário: nada do cache anterior pode vazar para a nova conta.
  // useLayoutEffect limpa antes da pintura; o dono fica no módulo porque o
  // shell desmonta no login/logout (rotas /auth ficam fora dele).
  const userId = user?.id ?? null
  useLayoutEffect(() => {
    if (cacheOwner !== undefined && cacheOwner !== userId) {
      clearCache()
      // O token de push estava registrado para a conta anterior: registra de novo.
      clearRemotePushState()
    }
    cacheOwner = userId
  }, [userId])

  // ── pets (cache 'pets', compartilhado com as telas) ────────────────────
  const petsKey = user && !isVetUser ? 'pets' : null
  const { data: petsData, refresh } = useCached<Pet[]>(petsKey, () => petsApi.list())
  const pets = petsData ?? EMPTY_PETS
  const [activePetId, setActivePetId] = useState<number | undefined>()
  useEffect(() => {
    if (!pets.length) return
    setActivePetId(cur => (cur && pets.some(p => p.id === cur) ? cur : pets[0].id))
  }, [pets])

  // Aniversário do pet — pico emocional + cartão compartilhável (1x/ano por pet)
  const bdayChecked = useRef(false)
  useEffect(() => {
    if (bdayChecked.current || !pets.length) return
    bdayChecked.current = true
    const today = new Date()
    for (const p of pets) {
      if (!p.birth_date) continue
      const b = new Date(p.birth_date)
      if (b.getDate() !== today.getDate() || b.getMonth() !== today.getMonth()) continue
      const key = `petlife_bday_${p.id}_${today.getFullYear()}`
      try {
        if (localStorage.getItem(key)) continue
        localStorage.setItem(key, '1')
      } catch {
        continue
      }
      const idade = today.getFullYear() - b.getFullYear()
      const many = idade > 1
      celebrate({
        title: t('v.layout.bdayTitle', { name: p.name }),
        message: many ? t('v.layout.bdayMsg', { years: idade }) : t('v.layout.bdayMsgOne'),
        trackEvent: 'recap_share',
        shareText: t('v.layout.bdayShare', { name: p.name }),
        card: {
          title: many
            ? t('v.layout.bdayCard', { name: p.name, years: idade })
            : t('v.layout.bdayCardOne', { name: p.name }),
          subtitle: t('v.layout.bdaySubtitle'),
          emoji: p.species === 'cat' ? '🐱' : '🐶',
          petPhotoUrl: p.photo_url || null,
          stats: [
            { label: many ? t('v.layout.bdayYears') : t('v.layout.bdayYearsOne'), value: String(idade) },
            { label: t('v.layout.bdayHeart'), value: '💚' },
          ],
        },
      })
      break
    }
  }, [pets, t])

  // ── cabeçalhos e Vyron ─────────────────────────────────────────────────
  const [headerCount, setHeaderCount] = useState(0)
  const [hideCount, setHideCount] = useState(0)
  const registerHeader = useCallback(() => {
    setHeaderCount(c => c + 1)
    return () => setHeaderCount(c => Math.max(0, c - 1))
  }, [])
  const hideAssistant = useCallback(() => {
    setHideCount(c => c + 1)
    return () => setHideCount(c => Math.max(0, c - 1))
  }, [])

  const refreshPets = useCallback(async () => {
    await refresh()
  }, [refresh])

  const ctx = useMemo<ShellContextValue>(
    () => ({
      inShell: true,
      pets,
      refreshPets,
      registerHeader,
      hasHeader: headerCount > 0,
      hideAssistant,
    }),
    [pets, refreshPets, registerHeader, headerCount, hideAssistant],
  )

  // ── rolagem que volta ao lugar ─────────────────────────────────────────
  useScrollRestoration(pathname)

  if (isLoading) return <ShellSkeleton label={t('shell.loading')} />
  if (!user) return null

  const hasHeader = headerCount > 0

  return (
    <ShellContext.Provider value={ctx}>
      <MotionConfig reducedMotion="user">
        <div className="flex min-h-screen bg-surface-50 dark:bg-surface-950 w-full max-w-full overflow-x-clip">
          <Sidebar pets={pets} activePetId={activePetId} onPetChange={p => setActivePetId(p.id)} />
          {/* pb-nav: barra inferior + 76 px do lançador do Vyron + área segura,
              para o último conteúdo nunca ficar embaixo dos dois. */}
          <main className="flex-1 min-w-0 md:ml-64 min-h-screen pb-nav md:pb-0 overflow-x-clip">
            <div className="w-full max-w-7xl mx-auto px-4 pt-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] pb-4 md:p-8">
              {!hasHeader && <MobileBackBar />}
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </main>
          {!isVetUser && !hasHeader && <NotificationBell />}
          {!isVetUser && <AIChatWidget pets={pets} hidden={hideCount > 0} />}
          {!isVetUser && <BottomNav />}
          {!isVetUser && <OnboardingModal />}
          {!isVetUser && <StoreInvite />}
          {!isVetUser && <FeedbackModal />}
          {!isVetUser && <QuotaUpsellModal />}
          {!isVetUser && <SoftUpsell />}
          <CelebrationOverlay />
        </div>
      </MotionConfig>
    </ShellContext.Provider>
  )
}

/**
 * Guarda a rolagem de cada rota e devolve ao voltar (botão voltar, gesto,
 * PageHeader). Em navegação para frente, começa do topo. Como a tela nova pode
 * ainda estar carregando, tenta por até ~600 ms até a página ter altura.
 */
function useScrollRestoration(pathname: string) {
  const positions = useRef(new Map<string, number>())
  const isPop = useRef(false)
  const current = useRef(pathname)

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    const onPop = () => {
      isPop.current = true
    }
    const onScroll = () => {
      positions.current.set(current.current, window.scrollY)
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    if (current.current === pathname) return
    current.current = pathname
    const pop = isPop.current
    isPop.current = false
    if (!pop) return
    const target = positions.current.get(pathname) ?? 0
    if (target <= 0) return
    let tries = 0
    let raf = 0
    const attempt = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max >= target - 4 || tries > 36) {
        window.scrollTo(0, Math.min(target, Math.max(0, max)))
        return
      }
      tries++
      raf = requestAnimationFrame(attempt)
    }
    raf = requestAnimationFrame(attempt)
    return () => cancelAnimationFrame(raf)
  }, [pathname])
}
