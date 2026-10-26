'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { PawPrint, MessageCircle, ChevronRight, CheckCircle2, Circle } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import {
  pets as petsApi,
  vaccines as vaccinesApi,
  walks as walksApi,
  reminders as remindersApi,
  heatCycles as heatCyclesApi,
  protections as protectionsApi,
  support as supportApi,
} from '@/lib/api'
import { useCached, invalidate } from '@/lib/cache'
import { buildCareSummaries, overallState, type CareKind } from '@/lib/care'
import { formatDate } from '@/lib/utils'
import { syncHealthNotifications } from '@/lib/notifications'
import { initPush } from '@/lib/push'
import { trackHappyMoment } from '@/lib/review'
import { PageHeader } from '@/components/ui/PageHeader'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { SkeletonHero, SkeletonRow } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Section } from '@/components/ui/Section'
import { Card } from '@/components/ui/Card'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import { useRingCelebrate } from '@/components/ui/ProtectionRing'
import { DailyCheckin } from '@/components/health/DailyCheckin'
import { ProtectionCard, type ProtectionCardHandle } from '@/components/health/ProtectionCard'
import { SupportAnnouncement } from '@/components/growth/SupportAnnouncement'
import { OnboardingChecklist } from '@/components/growth/OnboardingChecklist'
import { HomeHero } from '@/components/home/HomeHero'
import { AttentionList } from '@/components/home/AttentionList'
import { PushCard } from '@/components/home/PushCard'
import { QuickActions } from '@/components/home/QuickActions'

export default function DashboardPage() {
  const { user } = useAuth()
  const t = useT()
  const firstName = user?.name?.split(' ')[0]

  const petsQ = useCached('pets', () => petsApi.list())
  const vaxQ = useCached('vaccines', () => vaccinesApi.list())
  const protQ = useCached('protections', () => protectionsApi.summary())
  const remQ = useCached('reminders:upcoming', () => remindersApi.getUpcoming(7))

  const pets = useMemo(() => petsQ.data ?? [], [petsQ.data])
  const vaccines = useMemo(() => vaxQ.data ?? [], [vaxQ.data])
  const reminders = remQ.data ?? []

  // Situação por pet, pior primeiro — só a dose mais recente de cada vacina
  // (corrige as vencidas que sumiam: a rota "upcoming" filtra next_due >= hoje).
  const summaries = useMemo(
    () => buildCareSummaries(pets, vaccines, protQ.data?.pets ?? []),
    [pets, vaccines, protQ.data],
  )
  const overall = overallState(summaries)

  const [supUnread, setSupUnread] = useState(0)
  const [hasWalk, setHasWalk] = useState(false)
  const protRef = useRef<ProtectionCardHandle>(null)
  const ring = useRingCelebrate()
  const [pulsePet, setPulsePet] = useState<number | null>(null)

  useEffect(() => {
    supportApi.unread().then(r => setSupUnread(r.unread)).catch(() => {})
    walksApi.list({ limit: 1 }).then(w => setHasWalk((w?.length ?? 0) > 0)).catch(() => {})
  }, [])

  // Avisos: registra o push só se já permitido e agenda os locais — sem pedir
  // permissão a frio (o pedido vem com contexto, pelo PushPrimer).
  const synced = useRef(false)
  const vaxSettled = vaxQ.data !== undefined || !!vaxQ.error
  const remSettled = remQ.data !== undefined || !!remQ.error
  useEffect(() => {
    if (synced.current || !petsQ.data || !vaxSettled || !remSettled) return
    synced.current = true
    void initPush()
    const hasAny = vaxQ.data ? vaxQ.data.length > 0 : true
    void Promise.allSettled([vaccinesApi.getUpcoming(30), heatCyclesApi.upcoming()]).then(([up, heats]) =>
      syncHealthNotifications(
        up.status === 'fulfilled' ? up.value : [],
        remQ.data ?? [],
        petsQ.data ?? [],
        hasAny,
        heats.status === 'fulfilled' ? heats.value : [],
      ),
    )
  }, [petsQ.data, vaxSettled, remSettled, vaxQ.data, remQ.data])

  const onRefresh = useCallback(async () => {
    invalidate('vaccines')
    invalidate('protections')
    invalidate('pets')
    invalidate('reminders:upcoming')
    await Promise.all([petsQ.refresh(), vaxQ.refresh(), protQ.refresh(), remQ.refresh()])
  }, [petsQ, vaxQ, protQ, remQ])

  const onRegister = useCallback((petId: number, kind: 'vermifugo' | 'antipulgas') => {
    protRef.current?.openRegister(petId, kind)
  }, [])

  const onProtectionSaved = useCallback(
    (petId: number, kind: CareKind) => {
      setPulsePet(petId)
      ring.celebrate(kind)
    },
    [ring],
  )

  const loading = petsQ.loading || (pets.length > 0 && (vaxQ.loading || protQ.loading))

  // Subtítulo honesto: nunca "Tudo em dia" com pendência.
  const subtitle = (() => {
    if (loading) return undefined
    if (pets.length === 0) return t('home.sub.noPets')
    if (overall === 'overdue') {
      const late = summaries.filter(s => s.worst === 'overdue')
      return late.length === 1 ? t('home.sub.overduePet', { name: late[0].pet.name }) : t('home.sub.overdueMany', { n: late.length })
    }
    if (overall === 'soon') return t('home.sub.soon')
    if (overall === 'never') return t('home.sub.never')
    return t('home.sub.allOk')
  })()

  const top = summaries[0]
  const exclude = top?.next ? { petId: top.pet.id, kind: top.next.kind, vaccineId: top.next.vaccineId } : null
  const pushTarget = summaries.find(s => s.items[0].vaccineName && (s.items[0].state === 'overdue' || s.items[0].state === 'soon')) ?? top
  const pulse = ring.pulseKind && pulsePet != null ? { petId: pulsePet, kind: ring.pulseKind } : null

  return (
    <DashboardLayout>
      <PageHeader title={firstName ? t('home.hello', { name: firstName }) : t('home.helloNoName')} subtitle={subtitle} />

      <PullToRefresh onRefresh={onRefresh}>
        {loading ? (
          <div role="status" aria-busy="true" className="space-y-3">
            <span className="sr-only">{t('home.loading')}</span>
            <SkeletonHero />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : pets.length === 0 ? (
          <Card padding="lg" className="rounded-3xl">
            <EmptyState
              icon={PawPrint}
              title={t('home.empty.title')}
              text={t('home.empty.text')}
              ctaLabel={t('home.empty.cta')}
              ctaHref="/pets/new"
            />
          </Card>
        ) : (
          <>
            {/* Resposta do suporte esperando — o aviso mais importante */}
            {supUnread > 0 && (
              <Link
                href="/suporte"
                className="pressable flex items-center gap-3 mb-4 rounded-2xl border tone-brand-bg p-3 min-h-[56px]"
              >
                <span className="w-10 h-10 rounded-xl bg-white text-primary-700 dark:bg-surface-900 dark:text-primary-300 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" aria-hidden />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-primary-900 dark:text-primary-100">{t('g.sup.replyBanner')}</span>
                  <span className="block text-xs text-primary-800 dark:text-primary-200">{t('g.sup.replyCta')}</span>
                </span>
                <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center tabular-nums shrink-0">
                  {supUnread}
                </span>
                <ChevronRight className="w-4 h-4 text-primary-700 dark:text-primary-300 shrink-0" aria-hidden />
              </Link>
            )}

            <HomeHero summaries={summaries} pulse={pulse} onRegister={onRegister} />

            <Stagger gap={0.05}>
              <StaggerItem>
                <AttentionList summaries={summaries} vaccines={vaccines} exclude={exclude} onRegister={onRegister} />
              </StaggerItem>

              <StaggerItem>
                <PushCard
                  hasVaccine={vaccines.length > 0}
                  petName={pushTarget?.pet.name ?? ''}
                  vaccineName={pushTarget?.items[0].vaccineName}
                />
              </StaggerItem>

              {top && (
                <StaggerItem className="mb-5">
                  <DailyCheckin key={top.pet.id} pet={top.pet} onDone={() => trackHappyMoment('checkin')} />
                </StaggerItem>
              )}

              <StaggerItem>
                <ProtectionCard ref={protRef} pets={pets} onSaved={onProtectionSaved} />
              </StaggerItem>

              <StaggerItem>
                <Section title={t('home.rem.title')} className="mb-5">
                  {reminders.length === 0 ? (
                    <p className="text-sm text-surface-600 dark:text-surface-400 -mt-1">{t('home.rem.empty')}</p>
                  ) : (
                    <Card padding="none">
                      <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                        {reminders.slice(0, 5).map(r => {
                          const Icon = r.is_completed ? CheckCircle2 : Circle
                          return (
                            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 min-h-[52px]">
                              <Icon
                                className={r.is_completed ? 'w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400' : 'w-5 h-5 shrink-0 text-surface-400 dark:text-surface-500'}
                                aria-hidden
                              />
                              <div className="flex-1 min-w-0">
                                <div className={r.is_completed ? 'text-sm font-medium truncate line-through text-surface-500 dark:text-surface-400' : 'text-sm font-medium truncate text-surface-900 dark:text-surface-100'}>
                                  {r.title}
                                </div>
                                <div className="text-xs text-surface-600 dark:text-surface-400">
                                  {[r.pet?.name, formatDate(r.due_date)].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </Card>
                  )}
                </Section>
              </StaggerItem>

              {top && (
                <StaggerItem>
                  <OnboardingChecklist pet={pets[0]} hasVaccine={vaccines.length > 0} hasWalk={hasWalk} firstName={firstName} />
                </StaggerItem>
              )}

              {top && (
                <StaggerItem>
                  <QuickActions petId={top.pet.id} />
                </StaggerItem>
              )}
            </Stagger>
          </>
        )}
      </PullToRefresh>

      {/* Anúncio único do canal de suporte (1x por aparelho) */}
      <SupportAnnouncement />
    </DashboardLayout>
  )
}
