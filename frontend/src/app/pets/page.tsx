'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PetCard } from '@/components/pets/PetCard'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { pets as petsApi, type Pet } from '@/lib/api'
import { useT } from '@/contexts/LocaleContext'

export default function PetsPage() {
  const t = useT()
  const [petList, setPetList] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    petsApi.list().then(setPetList).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = petList.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.breed?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-5 md:mb-6 ">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight">{t('dash.myPets')}</h1>
          <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">
            {petList.length === 0
              ? t('dash.addFirstPet')
              : petList.length > 1
                ? t('pw.pets.countMany', { count: petList.length })
                : t('pw.pets.countOne', { count: petList.length })}
          </p>
        </div>
        <Link
          href="/pets/new"
          className="flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary-600 transition"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">{t('pw.pets.add')}</span>
        </Link>
      </div>

      {petList.length > 3 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            type="text"
            placeholder={t('pw.pets.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md pl-10 pr-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <div className="py-10">
          {petList.length === 0 ? (
            <EmptyState
              title={t('pw.pets.emptyTitle')}
              text={t('pw.pets.emptyText')}
              ctaLabel={t('pw.pets.emptyCta')}
              ctaHref="/pets/new"
            />
          ) : (
            <p className="text-center text-surface-500 dark:text-surface-400">{t('pw.pets.noResults', { query: search })}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(pet => <PetCard key={pet.id} pet={pet} />)}
          <Link
            href="/pets/new"
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-2xl p-8 hover:border-primary-300 hover:bg-primary-50 transition group min-h-[200px]"
          >
            <div className="w-12 h-12 rounded-xl bg-surface-100 dark:bg-surface-700 group-hover:bg-primary-100 flex items-center justify-center transition">
              <Plus className="w-6 h-6 text-surface-400 group-hover:text-primary-600 transition" />
            </div>
            <span className="text-sm font-medium text-surface-400 group-hover:text-primary-600 transition">
              {t('pw.pets.addNew')}
            </span>
          </Link>
        </div>
      )}
    </DashboardLayout>
  )
}
