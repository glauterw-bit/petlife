'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Brain, Sparkles, ChevronRight, HeartCrack, CloudLightning, Zap, ShieldAlert, Hammer, Volume2, Package,
  type LucideIcon,
} from 'lucide-react'
import { pets as petsApi, innovations, type Pet, type BehaviorPlanSummary, type BehaviorIssueType } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { cn } from '@/lib/utils'
import { hapticSelect, hapticSuccess } from '@/lib/feedback'
import { useHideAssistant } from '@/components/layout/shell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { cardClasses } from '@/components/ui/Card'

const ISSUE_OPTIONS: Array<{ value: BehaviorIssueType; labelKey: string; Icon: LucideIcon; species: 'dog' | 'cat' | 'both' }> = [
  { value: 'separation_anxiety', labelKey: 'g.beh.issue.separationAnxiety', Icon: HeartCrack, species: 'both' },
  { value: 'fear', labelKey: 'g.beh.issue.fear', Icon: CloudLightning, species: 'both' },
  { value: 'reactivity', labelKey: 'g.beh.issue.reactivity', Icon: Zap, species: 'dog' },
  { value: 'aggression', labelKey: 'g.beh.issue.aggression', Icon: ShieldAlert, species: 'both' },
  { value: 'destruction', labelKey: 'g.beh.issue.destruction', Icon: Hammer, species: 'dog' },
  { value: 'barking', labelKey: 'g.beh.issue.barking', Icon: Volume2, species: 'dog' },
  { value: 'cat_litter', labelKey: 'g.beh.issue.catLitter', Icon: Package, species: 'cat' },
]

const optionCls = (active: boolean) =>
  cn(
    'pressable w-full min-h-[48px] flex items-center gap-3 p-3 rounded-xl border text-left transition-colors',
    active
      ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-500/15 dark:text-primary-100'
      : 'border-surface-200 text-surface-800 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-100 dark:hover:bg-surface-800',
  )

const INTENSITY_OPTIONS = [
  { value: 'leve', labelKey: 'g.beh.int.leve', descKey: 'g.beh.int.leveDesc' },
  { value: 'moderada', labelKey: 'g.beh.int.moderada', descKey: 'g.beh.int.moderadaDesc' },
  { value: 'alta', labelKey: 'g.beh.int.alta', descKey: 'g.beh.int.altaDesc' },
] as const

/** Rótulos dos valores que voltam do backend. */
const INTENSITY_KEY: Record<string, string> = {
  leve: 'g.beh.int.leve',
  moderada: 'g.beh.int.moderada',
  alta: 'g.beh.int.alta',
}
const STATUS_KEY: Record<string, string> = {
  active: 'g.beh.status.active',
  completed: 'g.beh.status.completed',
  abandoned: 'g.beh.status.abandoned',
}

export default function BehaviorPlansPage() {
  const t = useT()
  const router = useRouter()
  const { success, error } = useToast()
  const [plans, setPlans] = useState<BehaviorPlanSummary[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  // Wizard state
  const [selectedPet, setSelectedPet] = useState<number | null>(null)
  const [issueType, setIssueType] = useState<BehaviorIssueType | ''>('')
  const [intensity, setIntensity] = useState<'leve' | 'moderada' | 'alta' | ''>('')
  const [context, setContext] = useState('')
  const ctxId = useId()
  useHideAssistant(showWizard)

  useEffect(() => {
    Promise.all([innovations.listBehaviorPlans(), petsApi.list()])
      .then(([p, pp]) => { setPlans(p); setPets(pp) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function createPlan() {
    if (!selectedPet || !issueType || !intensity) return
    setCreating(true)
    try {
      const plan = await innovations.createBehaviorPlan(selectedPet, issueType, intensity, context || undefined)
      void hapticSuccess()
      success(t('g.beh.created'))
      router.push(`/behavior/${plan.id}`)
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.beh.errGenerate'))
    } finally {
      setCreating(false)
    }
  }

  const petSpecies = pets.find(p => p.id === selectedPet)?.species
  const availableIssues = ISSUE_OPTIONS.filter(o => o.species === 'both' || o.species === petSpecies)

  function openWizard() {
    if (!selectedPet && pets.length === 1) setSelectedPet(pets[0].id)
    setShowWizard(true)
  }

  const statusChip = (status: string) =>
    status === 'active' ? 'chip-info' : status === 'completed' ? 'chip-success' : 'chip-neutral'

  return (
    <>
      <PageHeader
        title={t('g.beh.title')}
        subtitle={t('g.beh.subtitle')}
        actions={
          <Button size="sm" leftIcon={Plus} onClick={openWizard} disabled={!pets.length} aria-label={t('g.beh.newPlan')}>
            <span className="hidden xs:inline">{t('g.beh.newPlan')}</span>
          </Button>
        }
      />

      {loading ? (
        <SkeletonList count={2} />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={t('g.beh.emptyTitle')}
          text={t('g.beh.emptyText')}
          ctaLabel={pets.length ? t('g.beh.emptyCta') : undefined}
          onCta={openWizard}
        />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3 pb-6">
          {plans.map(p => {
            const issue = ISSUE_OPTIONS.find(o => o.value === p.issue_type)
            const Icon = issue?.Icon ?? Brain
            return (
              <li key={p.id} className="list-none">
                <Link href={`/behavior/${p.id}`} className={cardClasses({ interactive: true, padding: 'md' })}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-11 h-11 rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" aria-hidden />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-surface-900 dark:text-white">{p.pet_name}</h3>
                      <p className="text-sm text-surface-600 dark:text-surface-400">{issue ? t(issue.labelKey) : null}</p>
                    </div>
                    <span className={cn('chip', statusChip(p.status))}>{STATUS_KEY[p.status] ? t(STATUS_KEY[p.status]) : p.status}</span>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-surface-500 dark:text-surface-400">{t('g.beh.intensity')}</dt>
                      <dd className="font-semibold text-surface-800 dark:text-surface-100 capitalize">{INTENSITY_KEY[p.intensity] ? t(INTENSITY_KEY[p.intensity]) : p.intensity}</dd>
                    </div>
                    <div>
                      <dt className="text-surface-500 dark:text-surface-400">{t('g.beh.checkins')}</dt>
                      <dd className="font-semibold text-surface-800 dark:text-surface-100 tabular-nums">{p.check_ins_count}/{p.duration_weeks * 7}</dd>
                    </div>
                    {p.average_progress !== null && (
                      <div>
                        <dt className="text-surface-500 dark:text-surface-400">{t('g.beh.avgProgress')}</dt>
                        <dd className="font-semibold text-surface-800 dark:text-surface-100 tabular-nums">{p.average_progress.toFixed(1)}/10</dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet
        open={showWizard}
        onClose={() => setShowWizard(false)}
        title={t('g.beh.wizTitle')}
        description={t('g.beh.wizSubtitle')}
        size="tall"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setShowWizard(false)}>{t('common.cancel')}</Button>
            <Button
              fullWidth
              leftIcon={Sparkles}
              loading={creating}
              disabled={!selectedPet || !issueType || !intensity}
              onClick={createPlan}
            >
              {creating ? t('g.beh.generating') : t('g.beh.createPlan')}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 pb-1">
          <fieldset>
            <legend className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">{t('g.beh.wizPet')}</legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {pets.map(p => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedPet === p.id}
                  onClick={() => { void hapticSelect(); setSelectedPet(p.id); setIssueType('') }}
                  className={optionCls(selectedPet === p.id)}
                >
                  <PetAvatar pet={p} size={36} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-sm truncate">{p.name}</span>
                    <span className="block text-xs text-surface-600 dark:text-surface-400 truncate">{p.breed?.name ?? t('g.misc.srd')}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {selectedPet && (
            <fieldset>
              <legend className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">{t('g.beh.wizIssue')}</legend>
              <div role="radiogroup" className="space-y-1.5">
                {availableIssues.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={issueType === o.value}
                    onClick={() => { void hapticSelect(); setIssueType(o.value) }}
                    className={optionCls(issueType === o.value)}
                  >
                    <o.Icon className="w-5 h-5 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden />
                    <span className="flex-1 text-sm font-medium">{t(o.labelKey)}</span>
                    <ChevronRight className="w-4 h-4 text-surface-400" aria-hidden />
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {issueType && (
            <fieldset>
              <legend className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">{t('g.beh.wizIntensity')}</legend>
              <div role="radiogroup" className="space-y-1.5">
                {INTENSITY_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={intensity === o.value}
                    onClick={() => { void hapticSelect(); setIntensity(o.value) }}
                    className={optionCls(intensity === o.value)}
                  >
                    <span className="flex flex-col">
                      <span className="font-semibold text-sm">{t(o.labelKey)}</span>
                      <span className="text-xs text-surface-600 dark:text-surface-400">{t(o.descKey)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {intensity && (
            <div>
              <label htmlFor={ctxId} className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">{t('g.beh.wizContext')}</label>
              <textarea
                id={ctxId}
                value={context}
                onChange={e => setContext(e.target.value)}
                rows={3}
                placeholder={t('g.beh.wizContextPh')}
                className="w-full p-3 border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          )}
        </div>
      </Sheet>
    </>
  )
}
