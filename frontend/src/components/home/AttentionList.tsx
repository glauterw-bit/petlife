'use client'

import type { Vaccine } from '@/lib/api'
import { latestDoses, vaccineState, daysUntil, type CareKind, type CareState, type PetCareSummary } from '@/lib/care'
import { useT } from '@/contexts/LocaleContext'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { StatusBadge, careStateLabel } from '@/components/ui/StatusBadge'
import { StaggerItem, Stagger } from '@/components/ui/Motion'
import { vaccineAddHref } from '@/components/pets/PetHero'

interface Row {
  key: string
  petId: number
  kind: CareKind
  state: Extract<CareState, 'overdue' | 'soon'>
  daysLeft: number | null
  title: string
  vaccineName?: string
  vaccineId?: number
}

const KIND_LABEL: Record<CareKind, string> = {
  vaccines: 'ui.care.vaccines',
  vermifugo: 'ui.care.vermifugo',
  antipulgas: 'ui.care.antipulgas',
}

/**
 * "Precisa de atenção": até 3 pendências de todos os pets — atrasadas antes
 * das que vencem em breve. Só a dose mais recente de cada vacina conta.
 * O item que já é a próxima ação do herói fica de fora (sem repetir).
 */
export function AttentionList({
  summaries,
  vaccines,
  exclude,
  onRegister,
}: {
  summaries: PetCareSummary[]
  vaccines: Vaccine[]
  exclude?: { petId: number; kind: CareKind; vaccineId?: number } | null
  onRegister: (petId: number, kind: 'vermifugo' | 'antipulgas') => void
}) {
  const t = useT()
  const petIds = new Set(summaries.map(s => s.pet.id))
  const byId = new Map(summaries.map(s => [s.pet.id, s.pet]))

  const rows: Row[] = []
  for (const v of latestDoses(vaccines)) {
    if (!petIds.has(v.pet_id)) continue
    const state = vaccineState(v)
    if (state !== 'overdue' && state !== 'soon') continue
    rows.push({
      key: `v-${v.id}`,
      petId: v.pet_id,
      kind: 'vaccines',
      state,
      daysLeft: v.next_due ? daysUntil(v.next_due) : null,
      title: v.name,
      vaccineName: v.name,
      vaccineId: v.id,
    })
  }
  for (const s of summaries) {
    for (const item of s.items) {
      if (item.kind === 'vaccines') continue
      if (item.state !== 'overdue' && item.state !== 'soon') continue
      rows.push({
        key: `p-${s.pet.id}-${item.kind}`,
        petId: s.pet.id,
        kind: item.kind,
        state: item.state,
        daysLeft: item.daysLeft,
        title: t(KIND_LABEL[item.kind]),
      })
    }
  }

  const visible = rows
    .filter(r => {
      if (!exclude) return true
      if (exclude.kind === 'vaccines') return !(r.kind === 'vaccines' && r.vaccineId === exclude.vaccineId)
      return !(r.petId === exclude.petId && r.kind === exclude.kind)
    })
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === 'overdue' ? -1 : 1
      return (a.daysLeft ?? 0) - (b.daysLeft ?? 0)
    })
    .slice(0, 3)

  if (visible.length === 0) return null

  return (
    <Section title={t('home.att.title')} action={{ label: t('home.att.seeAll'), href: '/health/vaccines' }} className="mb-5">
      <Stagger as="ul" className="space-y-2">
        {visible.map(r => {
          const pet = byId.get(r.petId)
          if (!pet) return null
          return (
            <StaggerItem as="li" key={r.key}>
              <div className={`rounded-2xl border p-3 ${r.state === 'overdue' ? 'tone-danger-bg' : 'tone-warning-bg'}`}>
                <div className="flex items-center gap-3">
                  <PetAvatar pet={pet} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                      {r.title} · {pet.name}
                    </div>
                    <div className="mt-1">
                      <StatusBadge state={r.state}>{careStateLabel(t, r.state, r.daysLeft)}</StatusBadge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2.5">
                  {r.kind === 'vaccines' ? (
                    <>
                      <Button size="sm" variant="secondary" href={vaccineAddHref(r.petId, r.vaccineName)} className="flex-1">
                        {t('home.att.register')}
                      </Button>
                      <Button size="sm" variant="ghost" href={`/health/vaccines/carteirinha/${r.petId}`} className="text-primary-800 dark:text-primary-200">
                        {t('home.att.card')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => onRegister(r.petId, r.kind as 'vermifugo' | 'antipulgas')}
                    >
                      {t('home.att.registerProt')}
                    </Button>
                  )}
                </div>
              </div>
            </StaggerItem>
          )
        })}
      </Stagger>
    </Section>
  )
}
