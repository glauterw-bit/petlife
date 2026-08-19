'use client'

import { useState } from 'react'
import { X, Camera, Sparkles, AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { innovations, type SnapshotTriageResult } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

interface SnapshotTriageModalProps {
  petId: number
  petName: string
  open: boolean
  onClose: () => void
}

const URGENCY_CONFIG: Record<SnapshotTriageResult['urgency_tier'], { labelKey: string; color: string; Icon: typeof CheckCircle }> = {
  rotina: { labelKey: 'g.tri.urg.rotina', color: 'emerald', Icon: CheckCircle },
  acompanhar: { labelKey: 'g.tri.urg.acompanhar', color: 'amber', Icon: Clock },
  agendar_vet: { labelKey: 'g.tri.urg.agendarVet', color: 'orange', Icon: AlertTriangle },
  vet_urgente: { labelKey: 'g.tri.urg.vetUrgente', color: 'red', Icon: AlertCircle },
}

export function SnapshotTriageModal({ petId, petName, open, onClose }: SnapshotTriageModalProps) {
  const t = useT()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SnapshotTriageResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }

  async function run() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const res = await innovations.snapshotTriage(petId, file)
      setResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('g.tri.errAnalyze'))
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  if (!open) return null

  const cfg = result ? URGENCY_CONFIG[result.urgency_tier] : null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 dark:border-surface-700 sticky top-0 bg-white/95 dark:bg-surface-800/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-600" />
            <h2 className="font-bold text-surface-900 dark:text-white">{t('g.tri.title', { name: petName })}</h2>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!result && (
            <>
              <p className="text-sm text-surface-600 dark:text-surface-300">
                {t('g.tri.desc', { name: petName })}
              </p>

              {!preview ? (
                <label className="block">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile} />
                  <div className="border-2 border-dashed border-primary-200 dark:border-primary-700 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-2xl p-8 text-center cursor-pointer transition">
                    <Camera className="w-10 h-10 mx-auto text-primary-500 mb-2" />
                    <p className="text-sm font-semibold text-surface-800 dark:text-white">{t('g.tri.pickPhoto')}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{t('g.tri.formats')}</p>
                  </div>
                </label>
              ) : (
                <div className="space-y-3">
                  <img src={preview} alt={petName} className="w-full rounded-2xl object-cover max-h-72 border border-surface-200 dark:border-surface-700" />
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer text-center text-sm bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 px-3 py-2 rounded-xl">
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile} />
                      {t('g.tri.changePhoto')}
                    </label>
                    <button
                      onClick={run}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded-xl disabled:opacity-60"
                    >
                      {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {loading ? t('g.misc.analyzing') : t('g.misc.analyze')}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl p-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </>
          )}

          {result && cfg && (
            <>
              {result.image_quality === 'ruim' ? (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">{t('g.tri.badPhoto')}</p>
                  <p className="text-sm text-amber-700 dark:text-amber-100">{result.image_quality_notes}</p>
                </div>
              ) : (
                <>
                  <div className={cn(
                    'rounded-2xl p-4 border-2',
                    cfg.color === 'emerald' && 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700',
                    cfg.color === 'amber' && 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
                    cfg.color === 'orange' && 'bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700',
                    cfg.color === 'red' && 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 animate-pulse-soft',
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <cfg.Icon className={cn(
                        'w-6 h-6',
                        cfg.color === 'emerald' && 'text-emerald-600',
                        cfg.color === 'amber' && 'text-amber-600',
                        cfg.color === 'orange' && 'text-orange-600',
                        cfg.color === 'red' && 'text-red-600',
                      )} />
                      <p className="font-bold text-surface-900 dark:text-white">{t(cfg.labelKey)}</p>
                    </div>
                    <p className="text-sm text-surface-700 dark:text-surface-200 leading-relaxed">{result.summary}</p>
                  </div>

                  {result.body_condition_score && (
                    <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-3">
                      <p className="text-xs uppercase tracking-wide text-surface-400 font-semibold mb-1">{t('g.tri.bcs')}</p>
                      <p className="text-2xl font-bold text-surface-900 dark:text-white">{result.body_condition_score}/9</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{result.body_condition_notes}</p>
                    </div>
                  )}

                  {result.eyes.visible && result.eyes.concerns.length > 0 && (
                    <DetailBlock title={t('g.tri.eyes')} severity={result.eyes.severity} items={result.eyes.concerns} />
                  )}
                  {result.dental.visible && (result.dental.tartar_level !== 'nenhum' || result.dental.concerns.length > 0) && (
                    <DetailBlock title={t('g.tri.dental')} severity={result.dental.tartar_level} items={result.dental.concerns} />
                  )}
                  {result.skin_coat.concerns.length > 0 && (
                    <DetailBlock title={t('g.tri.skinCoat')} severity={result.skin_coat.severity} items={result.skin_coat.concerns} />
                  )}

                  {result.recommendations.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-surface-400 font-semibold mb-2">{t('g.misc.recommendations')}</p>
                      <ul className="space-y-1.5">
                        {result.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-200">
                            <span className="text-primary-500 mt-1">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-surface-500 dark:text-surface-400 italic">{result.disclaimer}</p>
                </>
              )}

              <button
                onClick={reset}
                className="w-full bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-200 font-semibold py-3 rounded-xl"
              >
                {t('g.tri.again')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailBlock({ title, severity, items }: { title: string; severity: string; items: string[] }) {
  return (
    <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs uppercase tracking-wide text-surface-400 font-semibold">{title}</p>
        <span className="text-xs font-medium text-surface-600 dark:text-surface-300 capitalize">{severity}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((c, i) => (
          <span key={i} className="text-xs bg-white dark:bg-surface-800 px-2 py-1 rounded-md text-surface-700 dark:text-surface-200 border border-surface-200 dark:border-surface-600">{c}</span>
        ))}
      </div>
    </div>
  )
}
