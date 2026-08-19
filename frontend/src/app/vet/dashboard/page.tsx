'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, PawPrint, AlertTriangle, Calendar, Phone, ArrowRight, Users, Stethoscope } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { vet, type VetPatient } from '@/lib/api'
import { formatDate, getSpeciesEmoji } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'

export default function VetDashboardPage() {
  const { user } = useAuth()
  const t = useT()
  const [patients, setPatients] = useState<VetPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    vet.getPatients().then(setPatients).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleSearch(q: string) {
    setSearchQ(q)
    if (q.length < 2) {
      if (q.length === 0) {
        setSearching(true)
        vet.getPatients().then(setPatients).catch(() => {}).finally(() => setSearching(false))
      }
      return
    }
    setSearching(true)
    try {
      const res = await vet.getPatients(q)
      setPatients(res)
    } finally { setSearching(false) }
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
              {t('v.vetdash.greeting', { name: user?.name ?? t('v.vetdash.defaultName') })}
            </h1>
            <p className="text-surface-500 dark:text-surface-400 text-sm">{t('v.vetdash.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-primary-50 rounded-2xl p-4 border border-primary-100">
          <Users className="w-6 h-6 text-primary-500 mb-2" />
          <div className="text-2xl font-bold text-primary-700">{patients.length}</div>
          <div className="text-sm text-primary-600">{t('v.vetdash.statPatients')}</div>
        </div>
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
          <AlertTriangle className="w-6 h-6 text-red-500 mb-2" />
          <div className="text-2xl font-bold text-red-700">
            {patients.filter(p => p.alerts && p.alerts.length > 0).length}
          </div>
          <div className="text-sm text-red-600">{t('v.vetdash.statAlerts')}</div>
        </div>
        <div className="bg-accent-50 rounded-2xl p-4 border border-accent-100">
          <Calendar className="w-6 h-6 text-accent-500 mb-2" />
          <div className="text-2xl font-bold text-accent-700">
            {patients.filter(p => p.last_visit).length}
          </div>
          <div className="text-sm text-accent-600">{t('v.vetdash.statVisits')}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
        )}
        <input
          type="text"
          placeholder={t('v.vetdash.searchPh')}
          value={searchQ}
          onChange={e => handleSearch(e.target.value)}
          className="w-full max-w-lg pl-10 pr-10 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Patient list */}
      {loading ? <PageLoader /> : (
        patients.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
            <div className="text-6xl mb-3">🐾</div>
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-2">
              {searchQ ? t('v.vetdash.emptySearchTitle') : t('v.vetdash.emptyTitle')}
            </h2>
            <p className="text-surface-500 dark:text-surface-400 text-sm">
              {searchQ ? t('v.vetdash.emptySearchText') : t('v.vetdash.emptyText')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {patients.map(p => (
              <Link
                key={p.pet_id}
                href={`/vet/patient/${p.pet_id}`}
                className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5 hover:border-primary-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center overflow-hidden shrink-0">
                    {p.photo_url ? (
                      <Image src={p.photo_url} alt={p.pet_name} width={56} height={56} className="object-cover w-full h-full rounded-2xl" />
                    ) : (
                      <span className="text-3xl">{getSpeciesEmoji(p.species)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-surface-900 dark:text-white group-hover:text-primary-600 transition">{p.pet_name}</h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">{p.breed ?? getSpeciesEmoji(p.species)}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-1 transition" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
                    <PawPrint className="w-4 h-4 text-surface-400" />
                    <span>{t('v.vetdash.ownerLabel')}: <span className="font-medium text-surface-800 dark:text-surface-100">{p.owner_name}</span></span>
                  </div>
                  {p.owner_phone && (
                    <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
                      <Phone className="w-4 h-4 text-surface-400" />
                      <span>{p.owner_phone}</span>
                    </div>
                  )}
                  {p.last_visit && (
                    <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
                      <Calendar className="w-4 h-4 text-surface-400" />
                      <span>{t('v.vetdash.lastVisit')}: {formatDate(p.last_visit)}</span>
                    </div>
                  )}
                </div>

                {p.alerts && p.alerts.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {p.alerts.map((alert, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {alert}
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )
      )}
    </DashboardLayout>
  )
}
