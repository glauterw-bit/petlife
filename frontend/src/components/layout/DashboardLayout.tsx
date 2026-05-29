'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { NotificationBell } from './NotificationBell'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { AIChatWidget } from '@/components/ai/AIChatWidget'
import { pets as petsApi, type Pet } from '@/lib/api'

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
    if (user && !isVetUser) {
      petsApi.list().then(data => {
        setPets(data)
        if (data.length > 0) setActivePetId(data[0].id)
      }).catch(() => {})
    }
  }, [user, isVetUser])

  if (isLoading) return <PageLoader text="Carregando PetLife..." />
  if (!user) return null

  return (
    <div className="flex min-h-screen bg-surface-50">
      <Sidebar
        pets={pets}
        activePetId={activePetId}
        onPetChange={p => setActivePetId(p.id)}
      />
      <main className="flex-1 md:ml-64 min-h-screen pb-nav md:pb-0">
        <div className="px-4 pt-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] pb-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
      {!isVetUser && <NotificationBell />}
      {!isVetUser && <AIChatWidget pets={pets} />}
      {!isVetUser && <BottomNav />}
      {!isVetUser && <OnboardingModal />}
    </div>
  )
}
