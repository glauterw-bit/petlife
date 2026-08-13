'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileBackBar } from './MobileBackBar'
import { NotificationBell } from './NotificationBell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { AIChatWidget } from '@/components/ai/AIChatWidget'
import { QuotaUpsellModal } from '@/components/billing/QuotaUpsellModal'
import { CelebrationOverlay, celebrate } from '@/components/ui/CelebrationOverlay'
import { pets as petsApi, type Pet } from '@/lib/api'
import { trackAppOpenOnce } from '@/lib/track'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, isLoading, isVetUser } = useAuth()
  const router = useRouter()
  const [pets, setPets] = useState<Pet[]>([])
  const [activePetId, setActivePetId] = useState<number | undefined>()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (user) trackAppOpenOnce()
  }, [user])

  useEffect(() => {
    if (user && !isVetUser) {
      petsApi.list().then(data => {
        setPets(data)
        if (data.length > 0) setActivePetId(data[0].id)
        // 🎂 Aniversário do pet — pico emocional + card compartilhável (1x/ano por pet)
        const today = new Date()
        for (const p of data) {
          if (!p.birth_date) continue
          const b = new Date(p.birth_date)
          if (b.getDate() === today.getDate() && b.getMonth() === today.getMonth()) {
            const key = `petlife_bday_${p.id}_${today.getFullYear()}`
            if (localStorage.getItem(key)) continue
            localStorage.setItem(key, '1')
            const idade = today.getFullYear() - b.getFullYear()
            celebrate({
              title: `Hoje é aniversário de ${p.name}! 🎂`,
              message: `${idade} ano${idade > 1 ? 's' : ''} de muito amor. Parabéns! 🎉`,
              trackEvent: 'recap_share',
              shareText: `Hoje é aniversário do ${p.name}! 🎂🐾`,
              card: {
                title: `${p.name} faz ${idade} ano${idade > 1 ? 's' : ''}! 🎂`,
                subtitle: 'Aniversário PetLife',
                emoji: p.species === 'cat' ? '🐱' : '🐶',
                petPhotoUrl: p.photo_url || null,
                stats: [
                  { label: 'anos de amor', value: String(idade) },
                  { label: 'sempre no coração', value: '💚' },
                ],
              },
            })
            break
          }
        }
      }).catch(() => {})
    }
  }, [user, isVetUser])

  if (isLoading) return <PageLoader text="Carregando PetLife..." />
  if (!user) return null

  return (
    <div className="flex min-h-screen bg-surface-50 dark:bg-surface-900/60 w-full max-w-full overflow-x-hidden">
      <Sidebar
        pets={pets}
        activePetId={activePetId}
        onPetChange={p => setActivePetId(p.id)}
      />
      <main className="flex-1 min-w-0 md:ml-64 min-h-screen pb-nav md:pb-0 overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto px-4 pt-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] pb-4 md:p-8 animate-fade-in">
          <MobileBackBar />
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
      {!isVetUser && <NotificationBell />}
      {!isVetUser && <AIChatWidget pets={pets} />}
      {!isVetUser && <BottomNav />}
      {!isVetUser && <OnboardingModal />}
      {!isVetUser && <QuotaUpsellModal />}
      <CelebrationOverlay />
    </div>
  )
}
