'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Syringe, Scale, Footprints, Pill, Bug, Image as ImageIcon, Activity, History, Flag, ChevronRight, type LucideIcon } from 'lucide-react'
import {
  vaccines as vaccinesApi, innovations, walks as walksApi, protections as protectionsApi,
  type Pet, type Vaccine, type WeightHistory, type WalkListItem, type ProtectionEntry, type StoryEntry, type PetActivityEntry,
} from '@/lib/api'
import { useCached } from '@/lib/cache'
import { formatDate, localeTag, cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { Stagger, StaggerItem } from '@/components/ui/Motion'

type Kind = 'vaccine' | 'weight' | 'walk' | 'vermifugo' | 'antipulgas' | 'protection' | 'moment' | 'activity'

interface TimelineEvent {
  id: string
  date: string
  kind: Kind
  title: string
  detail?: string
  href?: string
  milestone?: string
  photo?: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'
const absUrl = (u: string) => (/^https?:\/\//.test(u) ? u : `${API_URL}${u}`)

const ICON: Record<Kind, LucideIcon> = {
  vaccine: Syringe,
  weight: Scale,
  walk: Footprints,
  vermifugo: Pill,
  antipulgas: Bug,
  protection: Pill,
  moment: ImageIcon,
  activity: Activity,
}

/** Ações do registro de atividade que já aparecem por outra fonte (evita evento duplicado). */
const COVERED_ACTIONS = new Set(['walk_finished', 'weight_added', 'story_created'])

interface Sources {
  vaccines: Vaccine[] | null
  weights: WeightHistory | null
  walks: WalkListItem[] | null
  protections: ProtectionEntry[] | null
  stories: StoryEntry[] | null
  activity: PetActivityEntry[] | null
  failed: number
}

async function loadSources(petId: number): Promise<Sources> {
  const r = await Promise.allSettled([
    vaccinesApi.list(petId),
    innovations.weightHistory(petId),
    walksApi.list({ pet_id: petId, limit: 50 }),
    protectionsApi.list(petId),
    innovations.listStories(petId),
    innovations.listPetActivity(petId),
  ])
  const v = <T,>(x: PromiseSettledResult<T>): T | null => (x.status === 'fulfilled' ? x.value : null)
  return {
    vaccines: v(r[0]),
    weights: v(r[1]),
    walks: v(r[2]),
    protections: v(r[3]),
    stories: v(r[4]),
    activity: v(r[5]),
    failed: r.filter(x => x.status === 'rejected').length,
  }
}

const ts = (iso: string) => {
  const n = new Date(iso).getTime()
  return Number.isNaN(n) ? 0 : n
}

/** Linha do tempo do pet, montada no cliente a partir do que já está registrado. Nada é inventado. */
export function PetTimeline({ pet }: { pet: Pet }) {
  const t = useT()
  const { data, loading } = useCached<Sources>(`pet:${pet.id}:timeline`, () => loadSources(pet.id))

  const events = useMemo<TimelineEvent[]>(() => {
    if (!data) return []
    const nf = new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 2 })
    const out: TimelineEvent[] = []

    for (const v of data.vaccines ?? []) {
      out.push({
        id: `v${v.id}`,
        date: v.date_given,
        kind: 'vaccine',
        title: t('petx.tl.vaccine', { name: v.name }),
        detail: v.next_due ? t('petx.tl.nextDose', { date: formatDate(v.next_due) }) : v.veterinarian || undefined,
        href: `/health/vaccines?pet=${pet.id}`,
      })
    }
    for (const w of data.weights?.entries ?? []) {
      out.push({
        id: `w${w.id}`,
        date: w.measured_at,
        kind: 'weight',
        title: t('petx.tl.weight', { kg: nf.format(w.weight_kg) }),
        detail: w.notes || undefined,
      })
    }
    for (const w of data.walks ?? []) {
      if (!w.ended_at) continue // passeio em andamento ainda não é história
      out.push({
        id: `k${w.id}`,
        date: w.started_at,
        kind: 'walk',
        title: t('petx.tl.walk', { km: nf.format(Math.round(w.distance_meters / 10) / 100) }),
        detail: w.duration_seconds ? t('petx.tl.walkMin', { min: Math.max(1, Math.round(w.duration_seconds / 60)) }) : undefined,
        href: `/walks/${w.id}`,
      })
    }
    for (const p of data.protections ?? []) {
      const kind: Kind = p.kind === 'vermifugo' ? 'vermifugo' : p.kind === 'antipulgas' ? 'antipulgas' : 'protection'
      out.push({
        id: `p${p.id}`,
        date: p.applied_at,
        kind,
        title: t(kind === 'vermifugo' ? 'petx.tl.vermifugo' : kind === 'antipulgas' ? 'petx.tl.antipulgas' : 'petx.tl.protection'),
        detail: p.product || undefined,
      })
    }
    for (const s of data.stories ?? []) {
      out.push({
        id: `s${s.id}`,
        date: s.created_at,
        kind: 'moment',
        title: t('petx.tl.moment'),
        detail: s.user_caption || s.ai_caption || undefined,
        photo: s.photo_url ? absUrl(s.photo_url) : undefined,
        href: `/pets/${pet.id}?tab=stories`,
      })
    }
    for (const a of data.activity ?? []) {
      if (COVERED_ACTIONS.has(a.action)) continue
      const mood = typeof a.meta?.mood === 'string' ? (a.meta.mood as string) : null
      const isMood = a.action === 'behavior_logged'
      const parts = [
        isMood && mood ? t(`g.blog.mood.${mood}`) : !isMood ? a.summary : null,
        !a.is_me && a.user_name ? t('petx.tl.by', { name: a.user_name.split(' ')[0] }) : null,
      ].filter(Boolean)
      out.push({
        id: `a${a.id}`,
        date: a.created_at,
        kind: 'activity',
        title: isMood ? t('petx.tl.mood') : t('petx.tl.activity'),
        detail: parts.join(' · ') || undefined,
      })
    }

    // Marcos: só a partir de registro real — o mais antigo de cada tipo.
    const markFirst = (kind: Kind, label: string) => {
      let first: TimelineEvent | null = null
      for (const e of out) if (e.kind === kind && (!first || ts(e.date) < ts(first.date))) first = e
      if (first) first.milestone = label
    }
    markFirst('walk', t('petx.tl.firstWalk'))
    markFirst('vaccine', t('petx.tl.firstVaccine'))
    markFirst('weight', t('petx.tl.firstWeight'))

    return out.filter(e => ts(e.date) > 0).sort((a, b) => ts(b.date) - ts(a.date))
  }, [data, pet.id, t])

  const groups = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(localeTag(), { month: 'long', year: 'numeric' })
    const m = new Map<string, { label: string; items: TimelineEvent[] }>()
    for (const e of events) {
      const d = new Date(e.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      let g = m.get(key)
      if (!g) {
        g = { label: fmt.format(d), items: [] }
        m.set(key, g)
      }
      g.items.push(e)
    }
    return Array.from(m.values())
  }, [events])

  if (loading && !data) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={t('ui.loading')}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    )
  }

  if (!events.length) {
    return (
      <EmptyState
        icon={History}
        title={t('petx.tl.emptyTitle', { name: pet.name })}
        text={t('petx.tl.emptyText')}
        ctaLabel={t('petx.tl.emptyCta')}
        ctaHref={`/health/vaccines?pet=${pet.id}&add=1`}
      />
    )
  }

  return (
    <div>
      {data && data.failed > 0 && (
        <p role="status" className="mb-4 text-sm rounded-xl px-3 py-2 tone-warning-bg text-amber-800 dark:text-amber-200">
          {t('petx.tl.partial')}
        </p>
      )}
      <Stagger gap={0.035} className="space-y-6">
        {groups.map(g => (
          <section key={g.label} aria-label={g.label}>
            <StaggerItem>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-400 mb-2 first-letter:uppercase">
                {g.label}
              </h3>
            </StaggerItem>
            <ol className="relative">
              {/* linha vertical */}
              <span aria-hidden className="absolute left-[19px] top-3 bottom-3 w-px bg-surface-200 dark:bg-surface-800" />
              {g.items.map(e => (
                <StaggerItem as="li" key={e.id} className="relative">
                  <TimelineRow e={e} milestoneLabel={t('petx.tl.milestone')} />
                </StaggerItem>
              ))}
            </ol>
          </section>
        ))}
      </Stagger>
    </div>
  )
}

function TimelineRow({ e, milestoneLabel }: { e: TimelineEvent; milestoneLabel: string }) {
  const Icon = ICON[e.kind]
  const inner = (
    <>
      <span
        className={cn(
          'relative z-[1] w-10 h-10 rounded-full flex items-center justify-center shrink-0 ring-4 ring-surface-50 dark:ring-surface-950',
          e.milestone
            ? 'bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950'
            : 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
        )}
      >
        <Icon className="w-[18px] h-[18px]" aria-hidden />
      </span>
      <span className="flex-1 min-w-0 py-0.5">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-semibold text-surface-900 dark:text-white">{e.title}</span>
          {e.milestone && (
            <span className="chip chip-success">
              <Flag className="w-3 h-3" aria-hidden />
              {milestoneLabel}: {e.milestone}
            </span>
          )}
        </span>
        <span className="block text-[13px] text-surface-600 dark:text-surface-400">
          {formatDate(e.date)}
          {e.detail ? ` · ${e.detail}` : ''}
        </span>
      </span>
      {e.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.photo} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 bg-surface-100 dark:bg-surface-800" loading="lazy" />
      )}
      {e.href && <ChevronRight className="w-4 h-4 text-surface-400 shrink-0" aria-hidden />}
    </>
  )
  const cls = 'flex items-start gap-3 py-2 min-h-[44px]'
  return e.href ? (
    <Link href={e.href} className={cn(cls, 'pressable rounded-xl -mx-2 px-2 hover:bg-surface-100 dark:hover:bg-surface-900')}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}
