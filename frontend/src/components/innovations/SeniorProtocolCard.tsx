'use client'

import { useEffect, useState } from 'react'
import { Crown, AlertCircle, Loader2 } from 'lucide-react'
import { innovations, type SeniorProtocolResult } from '@/lib/api'
import { useT } from '@/contexts/LocaleContext'

export function SeniorProtocolCard({ petId }: { petId: number }) {
  const t = useT()
  const [data, setData] = useState<SeniorProtocolResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    innovations.seniorProtocol(petId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [petId])

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-surface-400" /></div>
  if (!data || !data.is_senior) return null

  return (
    <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/20 border-2 border-amber-300 dark:border-amber-700/50 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-surface-900 dark:text-white">{t('g.sen.title')}</h3>
          <p className="text-xs text-amber-700 dark:text-amber-300 capitalize">{data.life_stage} • {t('g.misc.years', { n: data.age_years ?? '' })}</p>
        </div>
      </div>

      {data.exams_protocol && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300 font-semibold mb-2">{t('g.sen.exams')}</p>
          <div className="space-y-1.5">
            {data.exams_protocol.map((e, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-surface-900 dark:text-white">{e.name}</span>
                  <span className="text-amber-700 dark:text-amber-300 shrink-0 capitalize">{e.frequency}</span>
                </div>
                <p className="text-surface-600 dark:text-surface-300 mt-0.5">{e.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.lifestyle_recommendations && (
        <div className="mb-3">
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300 font-semibold mb-1.5">{t('g.sen.lifestyle')}</p>
          <ul className="text-xs text-surface-700 dark:text-surface-200 space-y-1">
            {data.lifestyle_recommendations.slice(0, 4).map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}

      {data.early_warning_signs && (
        <details className="text-xs text-amber-800 dark:text-amber-200">
          <summary className="cursor-pointer font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {t('g.sen.warnings')}
          </summary>
          <ul className="mt-2 space-y-1 pl-5">
            {data.early_warning_signs.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </details>
      )}

      {data.disclaimer && (
        <p className="text-[10px] text-surface-500 dark:text-surface-400 italic mt-3">{data.disclaimer}</p>
      )}
    </div>
  )
}
