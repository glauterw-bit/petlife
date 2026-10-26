'use client'

import { useState } from 'react'
import { X, Camera, Sparkles, AlertCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { innovations, type StoolAnalysisResult } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

interface StoolAnalysisModalProps {
  petId: number
  petName: string
  open: boolean
  onClose: () => void
}

const URGENCY_CONFIG = {
  rotina: { color: 'emerald', labelKey: 'g.stool.urg.rotina', Icon: CheckCircle },
  acompanhar: { color: 'amber', labelKey: 'g.stool.urg.acompanhar', Icon: Clock },
  vet_agendar: { color: 'orange', labelKey: 'g.stool.urg.vetAgendar', Icon: AlertTriangle },
  vet_urgente: { color: 'red', labelKey: 'g.stool.urg.vetUrgente', Icon: AlertCircle },
} as const

const COLOR_LABEL_KEY: Record<string, string> = {
  marrom_claro: 'g.stool.color.marromClaro', marrom_escuro: 'g.stool.color.marromEscuro',
  amarelo: 'g.stool.color.amarelo', verde: 'g.stool.color.verde',
  preto_alcatrao: 'g.stool.color.pretoAlcatrao', avermelhado: 'g.stool.color.avermelhado',
  cinza: 'g.stool.color.cinza', outro: 'g.stool.color.outro',
}

export function StoolAnalysisModal({ petId, petName, open, onClose }: StoolAnalysisModalProps) {
  const t = useT()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<StoolAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null)
  }
  async function run() {
    if (!file) return
    setLoading(true); setError(null)
    try { setResult(await innovations.stoolAnalysis(petId, file)) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : t('g.misc.error')) }
    finally { setLoading(false) }
  }
  function reset() { setFile(null); setPreview(null); setResult(null); setError(null) }

  const cfg = result ? URGENCY_CONFIG[result.urgency] : null

  return (
    <Modal open={open} onClose={onClose} title={t('g.stool.title', { name: petName })} size="lg">
      <div className="space-y-4">
          {!result && (
            <>
              <p className="text-sm text-surface-600 dark:text-surface-300">
                {t('g.stool.desc', { name: petName })}
              </p>
              {!preview ? (
                <label className="block">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile} />
                  <div className="border-2 border-dashed border-amber-200 dark:border-amber-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-2xl p-8 text-center cursor-pointer transition">
                    <Camera className="w-10 h-10 mx-auto text-amber-600 mb-2" />
                    <p className="text-sm font-semibold text-surface-800 dark:text-white">{t('g.stool.takePhoto')}</p>
                  </div>
                </label>
              ) : (
                <div className="space-y-3">
                  <img src={preview} alt="" className="w-full rounded-2xl object-cover max-h-72 border" />
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer text-center text-sm bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 px-3 min-h-[44px] rounded-xl">
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile} />
                      {t('g.misc.change')}
                    </label>
                    <button onClick={run} disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-primary-700 hover:bg-primary-800 text-white dark:bg-primary-500 dark:text-surface-950 px-3 min-h-[44px] rounded-xl disabled:opacity-60">
                      {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {loading ? t('g.misc.analyzing') : t('g.misc.analyze')}
                    </button>
                  </div>
                </div>
              )}
              {error && <div className="flex items-center gap-2 border tone-danger-bg text-red-700 dark:text-red-300 rounded-xl p-3 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            </>
          )}

          {result && cfg && (
            <>
              {result.image_quality === 'ruim' ? (
                <div className="border tone-warning-bg rounded-2xl p-4">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">{t('g.stool.badPhoto')}</p>
                  <p className="text-sm text-amber-800 dark:text-amber-100">{result.image_quality_notes}</p>
                </div>
              ) : (
                <>
                  <div className={cn(
                    'rounded-2xl p-4 border-2',
                    cfg.color === 'emerald' && 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40',
                    cfg.color === 'amber' && 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40',
                    cfg.color === 'orange' && 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/40',
                    cfg.color === 'red' && 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/40',
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <cfg.Icon className={cn(
                        'w-6 h-6',
                        cfg.color === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
                        cfg.color === 'amber' && 'text-amber-600 dark:text-amber-400',
                        cfg.color === 'orange' && 'text-orange-600 dark:text-orange-400',
                        cfg.color === 'red' && 'text-red-600',
                      )} />
                      <p className="font-bold text-surface-900 dark:text-white">{t(cfg.labelKey)}</p>
                      {result.fecal_score && (
                        <span className="ml-auto text-lg font-bold">{result.fecal_score}/7</span>
                      )}
                    </div>
                    <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-1">{t('g.stool.ideal', { range: result.ideal_range })}</p>
                    <p className="text-sm text-surface-700 dark:text-surface-200">{result.summary}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-3">
                      <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 font-semibold">{t('g.stool.colorLabel')}</p>
                      <p className="text-sm font-semibold text-surface-900 dark:text-white mt-0.5">
                        {COLOR_LABEL_KEY[result.color] ? t(COLOR_LABEL_KEY[result.color]) : result.color}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{result.color_notes}</p>
                    </div>
                    {result.fecal_score && (
                      <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-3">
                        <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 font-semibold">{t('g.stool.fecalScore')}</p>
                        <p className="text-2xl font-bold text-surface-900 dark:text-white mt-0.5">{result.fecal_score}</p>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{result.consistency_notes}</p>
                      </div>
                    )}
                  </div>

                  {result.alerts?.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-xl p-3">
                      <p className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300 font-bold mb-1.5">{t('g.stool.alerts')}</p>
                      <ul className="space-y-1">
                        {result.alerts.map((a, i) => (
                          <li key={i} className="text-sm text-red-800 dark:text-red-200">• {a}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.recommendations?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 font-semibold mb-1.5">{t('g.misc.recommendations')}</p>
                      <ul className="space-y-1">
                        {result.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-200">
                            <span className="text-amber-600">•</span><span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-surface-500 dark:text-surface-400 italic">{result.disclaimer}</p>
                </>
              )}
              <button onClick={reset} className="w-full bg-surface-100 dark:bg-surface-700 font-semibold py-3 rounded-xl">
                {t('g.stool.again')}
              </button>
            </>
          )}
      </div>
    </Modal>
  )
}
