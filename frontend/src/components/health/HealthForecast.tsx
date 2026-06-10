'use client'

import { useState } from 'react'
import { Sparkles, TrendingUp, ShieldCheck, AlertTriangle, Loader2, Stethoscope } from 'lucide-react'
import { innovations, type HealthForecast as Forecast, type Pet } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { hapticMedium } from '@/lib/feedback'

const RISK_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  baixo: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', label: 'Risco baixo' },
  moderado: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', label: 'Risco moderado' },
  atencao: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-600 dark:text-red-400', label: 'Requer atenção' },
}

const LIKELIHOOD_COLOR: Record<string, string> = {
  baixa: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  alta: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

/**
 * Health Forecast — previsão preventiva por IA (6-12 meses).
 * Sob demanda (chamada de IA): botão "Gerar previsão" → riscos + prevenção.
 */
export function HealthForecast({ pet }: { pet: Pet }) {
  const { error } = useToast()
  const [data, setData] = useState<Forecast | null>(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    void hapticMedium()
    try {
      const res = await innovations.healthForecast(pet.id)
      setData(res)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Não foi possível gerar a previsão.')
    } finally {
      setLoading(false)
    }
  }

  if (!data) {
    return (
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/30 rounded-2xl border border-violet-100 dark:border-violet-900 p-5 text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center mb-3">
          <TrendingUp className="w-6 h-6 text-violet-600 dark:text-violet-400" />
        </div>
        <h3 className="text-base font-bold text-surface-900 dark:text-white mb-1">Previsão de Saúde</h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 mb-4 max-w-xs mx-auto">
          A IA analisa raça, idade, peso e histórico do {pet.name} pra antecipar riscos dos próximos 6-12 meses e como preveni-los.
        </p>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-medium transition tap-target shadow-lg shadow-violet-200 dark:shadow-violet-950"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Analisando…' : 'Gerar previsão'}
        </button>
      </div>
    )
  }

  const rk = RISK_STYLE[data.overall_risk] ?? RISK_STYLE.baixo

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5 animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-violet-500" />
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200">Previsão de Saúde · {pet.name}</h3>
      </div>

      <div className={`rounded-xl p-3 mb-4 ${rk.bg}`}>
        <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${rk.text}`}>{rk.label}</div>
        <p className="text-sm text-surface-700 dark:text-surface-200">{data.summary}</p>
      </div>

      <div className="space-y-3">
        {data.risks.map((risk, i) => (
          <div key={i} className="border border-surface-100 dark:border-surface-700 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm font-semibold text-surface-900 dark:text-white truncate">{risk.condition}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${LIKELIHOOD_COLOR[risk.likelihood] ?? LIKELIHOOD_COLOR.baixa}`}>
                {risk.likelihood} · {risk.window}
              </span>
            </div>
            <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">{risk.why}</p>
            <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-xs text-emerald-800 dark:text-emerald-300">{risk.prevention}</span>
            </div>
          </div>
        ))}
      </div>

      {data.checkups_recommended?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-700">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-4 h-4 text-primary-500" />
            <span className="text-xs font-semibold text-surface-700 dark:text-surface-200">Check-ups recomendados</span>
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

      <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-4 leading-relaxed">{data.disclaimer}</p>
    </div>
  )
}
