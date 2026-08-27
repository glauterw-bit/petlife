'use client'

import { CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react'
import { type Vaccine } from '@/lib/api'
import { formatDate, getVaccineStatus } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

interface VaccineTimelineProps {
  vaccines: Vaccine[]
  onDelete?: (id: number) => void
}

export function VaccineTimeline({ vaccines, onDelete }: VaccineTimelineProps) {
  const t = useT()

  if (vaccines.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">💉</div>
        <p className="text-surface-500 dark:text-surface-400">{t('h.timeline.empty')}</p>
        <p className="text-sm text-surface-400 mt-1">{t('h.timeline.emptyHint')}</p>
      </div>
    )
  }

  const sorted = [...vaccines].sort(
    (a, b) => new Date(b.date_given).getTime() - new Date(a.date_given).getTime()
  )

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-surface-200" />

      <div className="space-y-4">
        {sorted.map((v, i) => {
          const status = getVaccineStatus(v.next_due)
          const statusConfig = {
            up_to_date: {
              icon: <CheckCircle className="w-5 h-5 text-green-500" />,
              dot: 'bg-green-500',
              badge: 'bg-green-50 text-green-700 border-green-200',
              label: `${t('h.status.upToDate')} ✅`,
            },
            upcoming: {
              icon: <Clock className="w-5 h-5 text-yellow-500" />,
              dot: 'bg-yellow-500',
              badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',
              label: `${t('h.status.upcoming')} ⚠️`,
            },
            overdue: {
              icon: <AlertCircle className="w-5 h-5 text-red-500" />,
              dot: 'bg-red-500',
              badge: 'bg-red-50 text-red-700 border-red-200',
              label: `${t('h.status.overdue')} 🔴`,
            },
          }
          const s = statusConfig[status]

          return (
            <div key={v.id} className="relative flex gap-4 pl-12">
              {/* Dot */}
              <div className={`absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 border-white ${s.dot} shadow`} />

              <div className="flex-1 bg-white dark:bg-surface-800 rounded-xl border border-surface-100 dark:border-surface-700 p-4 hover:border-surface-200 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {s.icon}
                    <div>
                      <h4 className="font-semibold text-surface-900 dark:text-white">{v.name}</h4>
                      {v.veterinarian && (
                        <p className="text-xs text-surface-500 dark:text-surface-400">{t('h.vac.doctor', { name: v.veterinarian })}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${s.badge}`}>
                    {s.label}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                  <div className="text-xs text-surface-500 dark:text-surface-400">
                    <span className="font-medium text-surface-700 dark:text-surface-200">{t('h.vac.applied')}</span>{' '}
                    {formatDate(v.date_given)}
                  </div>
                  {v.next_due && (
                    <div className="text-xs text-surface-500 dark:text-surface-400">
                      <span className="font-medium text-surface-700 dark:text-surface-200">{t('h.vac.next')}</span>{' '}
                      {formatDate(v.next_due)}
                    </div>
                  )}
                  {v.lot_number && (
                    <div className="text-xs text-surface-500 dark:text-surface-400">
                      <span className="font-medium text-surface-700 dark:text-surface-200">{t('h.vac.lot')}</span>{' '}
                      {v.lot_number}
                    </div>
                  )}
                </div>

                {v.notes && (
                  <p className="mt-2 text-xs text-surface-500 dark:text-surface-400 italic">{v.notes}</p>
                )}

                <div className="mt-3 flex items-center gap-3">
                  {v.document_path && (
                    <a
                      href={v.document_path}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {t('h.vac.viewDoc')}
                    </a>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(v.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition ml-auto"
                    >
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
