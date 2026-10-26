'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, PawPrint } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PetCard } from '@/components/pets/PetCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconButton } from '@/components/ui/IconButton'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import { useT } from '@/contexts/LocaleContext'
import { useCareData } from './useCareData'

export default function PetsPage() {
  const t = useT()
  const router = useRouter()
  const { pets, petsLoading, summaries, byPetId, refreshAll } = useCareData()
  const [search, setSearch] = useState('')

  const petList = pets ?? []
  // pior situação primeiro (quando já há resumo); senão, a ordem da API
  const ordered = summaries ? summaries.map(s => s.pet) : petList
  const q = search.trim().toLowerCase()
  const filtered = q
    ? ordered.filter(p => p.name.toLowerCase().includes(q) || (p.breed?.name ?? '').toLowerCase().includes(q))
    : ordered

  const subtitle = pets
    ? petList.length === 0
      ? undefined
      : petList.length > 1
        ? t('pw.pets.countMany', { count: petList.length })
        : t('pw.pets.countOne', { count: petList.length })
    : undefined

  return (
    <DashboardLayout>
      <PageHeader
        title={t('petx.list.title')}
        subtitle={subtitle}
        actions={
          <IconButton icon={Plus} label={t('petx.list.add')} variant="solid" onClick={() => router.push('/pets/new')} />
        }
      />

      <PullToRefresh onRefresh={refreshAll}>
        {petList.length > 3 && (
          <div className="relative mb-4">
            <label htmlFor="pet-search" className="sr-only">{t('petx.list.searchLabel')}</label>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500 dark:text-surface-400 pointer-events-none" aria-hidden />
            <input
              id="pet-search"
              type="search"
              placeholder={t('pw.pets.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-md pl-11 pr-4 min-h-[44px] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl text-[15px] text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}

        {petsLoading && !pets ? (
          <div className="space-y-3" aria-busy="true" aria-label={t('ui.loading')}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : petList.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title={t('pw.pets.emptyTitle')}
            text={t('pw.pets.emptyText')}
            ctaLabel={t('petx.list.add')}
            ctaHref="/pets/new"
          />
        ) : filtered.length === 0 ? (
          <p className="text-center py-10 text-surface-600 dark:text-surface-400">{t('pw.pets.noResults', { query: search })}</p>
        ) : (
          <Stagger as="ul" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(pet => (
              <StaggerItem as="li" key={pet.id}>
                <PetCard pet={pet} summary={byPetId.get(pet.id) ?? null} />
              </StaggerItem>
            ))}
            <StaggerItem as="li">
              <Link
                href="/pets/new"
                className="pressable flex items-center justify-center gap-3 min-h-[96px] h-full rounded-2xl border-2 border-dashed border-primary-300 dark:border-primary-500/40 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center">
                  <Plus className="w-5 h-5" aria-hidden />
                </span>
                <span className="text-[15px] font-semibold">{t('petx.list.addCard')}</span>
              </Link>
            </StaggerItem>
          </Stagger>
        )}
      </PullToRefresh>
    </DashboardLayout>
  )
}
