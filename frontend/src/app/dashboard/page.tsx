'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { PawPrint, MessageCircle, ChevronRight } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import {
  pets as petsApi,
  vaccines as vaccinesApi,
  walks as walksApi,
  reminders as remindersApi,
  heatCycles as heatCyclesApi,
  support as supportApi,
  type HeatUpcoming,
} from '@/lib/api'
import { useCached, invalidate } from '@/lib/cache'
import { useProtectionsQuery } from '@/lib/queries'
import { useFirstVisit } from '@/lib/motion'
import { useShell } from '@/components/layout/shell'
import { buildCareSummaries, overallState, type CareKind } from '@/lib/care'
import { syncHealthNotifications } from '@/lib/notifications'
import { initPush } from '@/lib/push'
import { trackHappyMoment } from '@/lib/review'
import { PageHeader } from '@/components/ui/PageHeader'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { SkeletonHero, SkeletonRow } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Section } from '@/components/ui/Section'
import { Card } from '@/components/ui/Card'
import { StaggerItem } from '@/components/ui/Motion'
import { useRingCelebrate } from '@/components/ui/ProtectionRing'
import { DailyCheckin } from '@/components/health/DailyCheckin'
import { ProtectionCard, type ProtectionCardHandle } from '@/components/health/ProtectionCard'
import { SupportAnnouncement } from '@/components/growth/SupportAnnouncement'
import { OnboardingChecklist } from '@/components/growth/OnboardingChecklist'
import { HomeHero } from '@/components/home/HomeHero'
import { AttentionList, WeekList, splitCareRows } from '@/components/home/AttentionList'
import { PushCard } from '@/components/home/PushCard'
import { QuickActions } from '@/components/home/QuickActions'

const REST_STAGGER = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.34 } } }

export default function DashboardPage() {
  const { user } = useAuth()
  const t = useT()
  const firstName = user?.name?.split(' ')[0]

  const petsQ = useCached('pets', () => petsApi.list())
  const vaxQ = useCached('vaccines', () => vaccinesApi.list())
  // 'protections' guarda sempre a resposta inteira ({ pets }) — ver lib/queries.
  const protQ = useProtectionsQuery()
  // Com vencidos: um lembrete atrasado nunca some da semana (servidores
  // antigos ignoram o parâmetro e devolvem só os próximos).
  const remQ = useCached('reminders:upcoming', () => remindersApi.getUpcoming(7, { includeOverdue: true }))

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
  const shell = useShell()
  // Entrada em 4 tempos só na 1ª visita da sessão; depois a tela fica parada.
  const firstVisit = useFirstVisit('home')
  // Sequência de check-in do pet do topo — vem do selo de sequência que o
  // cartão já carrega (sem chamada nova). Só decide o aviso diário.
  const [streaks, setStreaks] = useState<Record<number, number>>({})
  const onStreak = useCallback((petId: number, n: number) => {
    setStreaks(prev => (prev[petId] === n ? prev : { ...prev, [petId]: n }))
  }, [])

  useEffect(() => {
    supportApi.unread().then(r => setSupUnread(r.unread)).catch(() => {})
    walksApi.list({ limit: 1 }).then(w => setHasWalk((w?.length ?? 0) > 0)).catch(() => {})
  }, [])

  // Avisos: registra o push só se já permitido e agenda os locais — sem pedir
  // permissão a frio (o pedido vem com contexto, pelo PushPrimer). Reagenda
  // quando a sequência de check-in chega (idempotente: cancela e recria).
  const heats = useRef<HeatUpcoming[] | null>(null)
  const pushInit = useRef(false)
  const vaxSettled = vaxQ.data !== undefined || !!vaxQ.error
  const remSettled = remQ.data !== undefined || !!remQ.error
  const protSettled = protQ.data !== undefined || !!protQ.error
  const topPetId = summaries[0]?.pet.id
  const topStreak = topPetId != null ? streaks[topPetId] : undefined
  useEffect(() => {
    if (!petsQ.data || !vaxSettled || !remSettled || !protSettled) return
    if (!pushInit.current) {
      pushInit.current = true
      void initPush()
    }
    let alive = true
    const heatsP = heats.current
      ? Promise.resolve(heats.current)
      : heatCyclesApi.upcoming().catch(() => [] as HeatUpcoming[])
    void heatsP.then(h => {
      heats.current = h
      if (!alive) return
      const all = vaxQ.data ?? []
      void syncHealthNotifications(
        all,
        remQ.data ?? [],
        petsQ.data ?? [],
        vaxQ.data ? all.length > 0 : true,
        h,
        undefined,
        protQ.data?.pets ?? [],
        topStreak,
        topPetId,
      )
    })
    return () => { alive = false }
  }, [petsQ.data, vaxSettled, remSettled, protSettled, vaxQ.data, remQ.data, protQ.data, topStreak, topPetId])

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

  const onPhotoChanged = useCallback(() => {
    invalidate('pets')
    void petsQ.refresh()
    void shell?.refreshPets()
  }, [petsQ, shell])

  const onProtectionSaved = useCallback(
    (petId: number, kind: CareKind) => {
      setPulsePet(petId)
      ring.celebrate(kind)
    },
    [ring],
  )

  const loading = petsQ.loading || (pets.length > 0 && (vaxQ.loading || protQ.loading))

  // Subtítulo honesto (nunca "Tudo em dia" com pendência) e só com 2+ pets:
  // com 1 pet, o cartão já diz tudo.
  const subtitle = (() => {
    if (loading) return undefined
    if (pets.length === 0) return t('home.sub.noPets')
    if (pets.length < 2) return undefined
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
  // Sem contradição: o que já venceu ou vence em até 7 dias e não coube no
  // herói nem no "Precisa de atenção" entra em "Esta semana".
  const careSplit = useMemo(() => splitCareRows(summaries, vaccines, t, exclude), [summaries, vaccines, t, exclude?.petId, exclude?.kind, exclude?.vaccineId]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasAbove = !!top?.next || careSplit.attention.length > 0
  const topHasVaccine = !!top && top.items[0].state !== 'never'

  // O guia de primeiros passos (mesma regra do OnboardingChecklist): enquanto
  // estiver na tela, a faixa de Desafios / Convide e ganhe fica escondida.
  const [onbDismissed, setOnbDismissed] = useState(true)
  useEffect(() => {
    try { setOnbDismissed(localStorage.getItem('petlife_onboarding_v1_dismissed') === '1') } catch { setOnbDismissed(false) }
  }, [])
  const checklistActive = !!pets[0] && !onbDismissed && !(!!pets[0].photo_url && vaccines.length > 0 && hasWalk)

  // Troca esqueleto → conteúdo com um fade curto, só quando houve esqueleto.
  const sawSkeleton = useRef(false)
  if (loading) sawSkeleton.current = true

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
          <div className={sawSkeleton.current ? 'animate-fade-in' : undefined}>
            {/* Resposta do suporte esperando — o aviso mais importante */}
            {supUnread > 0 && (
              <Link
                href="/suporte"
                className="pressable-card flex items-center gap-3 mb-4 rounded-2xl border tone-brand-bg p-3 min-h-[56px]"
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

            <HomeHero
              summaries={summaries}
              pulse={pulse}
              onRegister={onRegister}
              choreo={firstVisit}
              onStreak={onStreak}
              onPhotoChanged={onPhotoChanged}
            />

            {/* O resto da tela chega depois do cartão — e só na 1ª visita. */}
            <motion.div initial={firstVisit ? 'hidden' : false} animate="show" variants={REST_STAGGER}>
              <StaggerItem>
                <AttentionList summaries={summaries} vaccines={vaccines} exclude={exclude} onRegister={onRegister} />
              </StaggerItem>

              <StaggerItem>
                <WeekList
                  summaries={summaries}
                  careRows={careSplit.week}
                  reminders={reminders}
                  hasAbove={hasAbove}
                  newHref={top ? `/reminders?new=1&pet=${top.pet.id}` : '/reminders?new=1'}
                  onRegister={onRegister}
                />
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


              {top && (
                <StaggerItem>
                  <OnboardingChecklist pet={pets[0]} hasVaccine={vaccines.length > 0} hasWalk={hasWalk} firstName={firstName} />
                </StaggerItem>
              )}

              {top && (
                <StaggerItem>
                  <QuickActions petId={top.pet.id} petName={top.pet.name} hasVaccine={topHasVaccine} showExtras={!checklistActive} />
                </StaggerItem>
              )}
            </motion.div>
          </div>
        )}
      </PullToRefresh>

      {/* Só a folha de registro: abre pelas linhas Vermífugo/Antipulgas do cartão
          do pet (onRegister). O bloco visível repetia o que o cartão já mostra. */}
      {pets.length > 0 && <ProtectionCard ref={protRef} pets={pets} onSaved={onProtectionSaved} showCard={false} />}

      {/* Anúncio único do canal de suporte (1x por aparelho) */}
      <SupportAnnouncement />
    </DashboardLayout>
  )
}
