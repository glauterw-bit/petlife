'use client'

import { useEffect, useState } from 'react'
import { Shield, X, Check } from 'lucide-react'
import { protections, type ProtectionPetSummary, type ProtectionKindStatus, type Pet } from '@/lib/api'
import { hapticLight, hapticSuccess, celebrate } from '@/lib/feedback'
import { trackHappyMoment } from '@/lib/review'
import { useT } from '@/contexts/LocaleContext'

/**
 * Proteção em dia — vermífugo e antipulgas por pet.
 *
 * Vacina é evento anual; antiparasitário vence a cada 30–90 dias. Este card
 * é o motor de retorno legítimo do app: cada registro arma o próximo aviso.
 */

const KIND_META: Record<string, { emoji: string; labelKey: string; intervals: number[] }> = {
  vermifugo: { emoji: '🪱', labelKey: 'h.prot.vermifugo', intervals: [30, 60, 90, 180] },
  antipulgas: { emoji: '🦟', labelKey: 'h.prot.antipulgas', intervals: [30, 60, 90] },
}

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-emerald-50 dark:bg-emerald-900/25 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
  due_soon: 'bg-amber-50 dark:bg-amber-900/25 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300',
  overdue: 'bg-red-50 dark:bg-red-900/25 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300',
  never: 'bg-surface-50 dark:bg-surface-700/40 border-dashed border-surface-300 dark:border-surface-600 text-surface-500 dark:text-surface-400',
}

interface ModalState {
  petId: number
  petName: string
  k: ProtectionKindStatus
}

export function ProtectionCard({ pets }: { pets: Pet[] }) {
  const t = useT()
  const [summary, setSummary] = useState<ProtectionPetSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [product, setProduct] = useState('')
  const [interval, setIntervalDays] = useState(30)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { pets: s } = await protections.summary()
      setSummary(s)
    } catch {} finally { setLoaded(true) }
  }
  useEffect(() => { load() }, [])

  if (!loaded || pets.length === 0 || summary.length === 0) return null

  function openModal(petId: number, petName: string, k: ProtectionKindStatus) {
    void hapticLight()
    setProduct(k.product ?? '')
    setIntervalDays(k.interval_days)
    setModal({ petId, petName, k })
  }

  async function save() {
    if (!modal || saving) return
    setSaving(true)
    try {
      await protections.register(modal.petId, {
        kind: modal.k.kind,
        product: product.trim() || undefined,
        interval_days: interval,
      })
      void hapticSuccess()
      celebrate()
      trackHappyMoment('protection')
      setModal(null)
      await load()
    } catch {} finally { setSaving(false) }
  }

  function chipLabel(k: ProtectionKindStatus): string {
    if (k.status === 'never') return t('h.prot.register')
    if (k.status === 'overdue') return t('h.prot.overdue', { d: Math.abs(k.days_left ?? 0) })
    if (k.status === 'due_soon') return t('h.prot.dueSoon', { d: Math.max(0, k.days_left ?? 0) })
    return t('h.prot.ok', { d: k.days_left ?? 0 })
  }

  const meta = modal ? KIND_META[modal.k.kind] : null

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-4 mb-6">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <div className="text-sm font-bold text-surface-900 dark:text-white">{t('h.prot.title')}</div>
          <div className="text-xs text-surface-500 dark:text-surface-400">{t('h.prot.subtitle')}</div>
        </div>
      </div>

      <div className="space-y-2.5">
        {summary.map(p => (
          <div key={p.pet_id} className="flex items-center gap-2">
            <span className="text-xs font-semibold text-surface-700 dark:text-surface-200 w-20 truncate shrink-0">
              {p.pet_name}
            </span>
            <div className="flex gap-2 flex-1 min-w-0">
              {p.kinds.map(k => (
                <button
                  key={k.kind}
                  onClick={() => openModal(p.pet_id, p.pet_name, k)}
                  className={`pressable flex-1 min-w-0 px-2.5 py-2 rounded-xl border text-left transition ${STATUS_STYLE[k.status]}`}
                >
                  <div className="text-[11px] font-semibold flex items-center gap-1">
                    <span>{KIND_META[k.kind]?.emoji}</span>
                    <span className="truncate">{t(KIND_META[k.kind]?.labelKey ?? '')}</span>
                  </div>
                  <div className="text-[10px] mt-0.5 opacity-90 truncate">{chipLabel(k)}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {modal && meta && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="relative bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slide-up shadow-2xl">
            <button
              onClick={() => setModal(null)}
              aria-label={t('common.close')}
              className="absolute right-3 top-3 p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 transition"
            >
              <X className="w-4 h-4 text-surface-500 dark:text-surface-400" />
            </button>

            <div className="text-3xl mb-1">{meta.emoji}</div>
            <h3 className="font-display text-lg font-bold text-surface-900 dark:text-white">
              {t(meta.labelKey)} — {modal.petName}
            </h3>
            <p className="text-xs text-surface-500 dark:text-surface-400 mb-4">{t('h.prot.modalHint')}</p>

            <label className="block text-xs font-semibold text-surface-700 dark:text-surface-200 mb-1">
              {t('h.prot.product')} <span className="font-normal text-surface-400">({t('common.optional')})</span>
            </label>
            <input
              value={product}
              onChange={e => setProduct(e.target.value)}
              maxLength={120}
              placeholder={t('h.prot.productPh')}
              className="w-full px-3.5 py-2.5 mb-4 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />

            <label className="block text-xs font-semibold text-surface-700 dark:text-surface-200 mb-1.5">
              {t('h.prot.interval')}
            </label>
            <div className="flex gap-2 mb-5">
              {meta.intervals.map(d => (
                <button
                  key={d}
                  onClick={() => { setIntervalDays(d); void hapticLight() }}
                  aria-pressed={interval === d}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition ${
                    interval === d
                      ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/50'
                  }`}
                >
                  {t('h.prot.days', { d })}
                </button>
              ))}
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full px-4 py-3.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition shadow-md shadow-primary-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Check className="w-4 h-4" />}
              {t('h.prot.save')}
            </button>
            <p className="text-[11px] text-center text-surface-400 mt-2.5">{t('h.prot.nextHint', { d: interval })}</p>
          </div>
        </div>
      )}
    </div>
  )
}
