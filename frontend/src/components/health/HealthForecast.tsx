'use client'

import { useState } from 'react'
import { Sparkles, ShieldCheck, Lightbulb, Loader2, Stethoscope } from 'lucide-react'
import { innovations, type HealthForecast as Forecast, type Pet } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { haptic } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'

/**
 * Pontos de prevenção sugeridos por IA a partir do cadastro do pet.
 * Sob demanda (chamada de IA). Sem promessa de "prever riscos", sem
 * probabilidade nem janela de tempo: a IA não tem fonte para números de
 * risco — mostramos só o tema, o porquê e a prevenção, e lembramos que não
 * substitui o veterinário.
 */
export function HealthForecast({ pet }: { pet: Pet }) {
  const t = useT()
  const { error } = useToast()
  const [data, setData] = useState<Forecast | null>(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    haptic('tap')
    try {
      const res = await innovations.healthForecast(pet.id)
      setData(res)
    } catch (e) {
      error(e instanceof Error ? e.message : t('pet2.fc.error'))
    } finally {
      setLoading(false)
    }
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-surface-200/70 dark:border-surface-800 bg-white dark:bg-surface-900 p-4">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-primary-700 dark:text-primary-300" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-surface-900 dark:text-white">{t('pet2.fc.title')}</h3>
            <p className="mt-0.5 text-sm text-surface-600 dark:text-surface-300">{t('pet2.fc.intro', { name: pet.name })}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="pressable mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-primary-50 text-primary-800 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-200 dark:hover:bg-primary-500/25 disabled:opacity-60 px-4 text-[15px] font-semibold transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Sparkles className="w-4 h-4" aria-hidden />}
          {loading ? t('pet2.fc.analyzing') : t('pet2.fc.generate')}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/70 dark:border-surface-800 p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
        <h3 className="font-display font-bold text-surface-900 dark:text-white">{t('pet2.fc.titleWithPet', { name: pet.name })}</h3>
      </div>
      <p className="text-[13px] text-surface-600 dark:text-surface-300 mb-3">{t('pet2.fc.intro', { name: pet.name })}</p>

      {data.summary && <p className="text-sm text-surface-700 dark:text-surface-200 mb-4">{data.summary}</p>}

      <div className="space-y-3">
        {data.risks.map((risk, i) => (
          <div key={i} className="border border-surface-200/70 dark:border-surface-800 rounded-xl p-3">
            <p className="text-sm font-semibold text-surface-900 dark:text-white mb-1">{risk.condition}</p>
            {risk.why && <p className="text-[13px] text-surface-600 dark:text-surface-300 mb-2">{risk.why}</p>}
            {risk.prevention && (
              <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5" aria-hidden />
                <span className="text-[13px] text-emerald-900 dark:text-emerald-200">{risk.prevention}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {data.checkups_recommended?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
            <span className="text-[13px] font-semibold text-surface-700 dark:text-surface-200">{t('pet2.fc.checkups')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.checkups_recommended.map((c, i) => (
              <span key={i} className="text-xs bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-full">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-surface-600 dark:text-surface-400 mt-4 leading-relaxed">{t('pet2.fc.note')}</p>
    </div>
  )
}
