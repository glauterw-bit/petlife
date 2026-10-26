'use client'

import { useState } from 'react'
import { X, Camera, Sparkles, AlertCircle, Heart, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { innovations, type PainAssessmentResult } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

interface PainAssessmentModalProps {
  petId: number
  petName: string
  open: boolean
  onClose: () => void
}

const PAIN_COLOR: Record<PainAssessmentResult['pain_level'], string> = {
  'sem dor': 'emerald',
  'leve': 'amber',
  'moderada': 'orange',
  'severa': 'red',
}

const PAIN_LABEL_KEY: Record<PainAssessmentResult['pain_level'], string> = {
  'sem dor': 'g.pain.lvl.none',
  'leve': 'g.pain.lvl.mild',
  'moderada': 'g.pain.lvl.moderate',
  'severa': 'g.pain.lvl.severe',
}

/** Unidades faciais/corporais avaliadas: chave da API → chave de tradução. */
const PAIN_UNITS: Array<[string, string]> = [
  ['ears', 'g.pain.unit.ears'],
  ['orbitals', 'g.pain.unit.orbitals'],
  ['muzzle', 'g.pain.unit.muzzle'],
  ['whiskers', 'g.pain.unit.whiskers'],
  ['head_position', 'g.pain.unit.headPosition'],
  ['facial_expression', 'g.pain.unit.facialExpression'],
  ['posture', 'g.pain.unit.posture'],
  ['attention_to_body', 'g.pain.unit.attentionToBody'],
]

export function PainAssessmentModal({ petId, petName, open, onClose }: PainAssessmentModalProps) {
  const t = useT()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PainAssessmentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null)
  }
  async function run() {
    if (!file) return
    setLoading(true); setError(null)
    try { setResult(await innovations.painAssessment(petId, file)) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : t('g.misc.error')) }
    finally { setLoading(false) }
  }
  function reset() { setFile(null); setPreview(null); setResult(null); setError(null) }

  const color = result ? PAIN_COLOR[result.pain_level] : 'emerald'

  return (
    <Modal open={open} onClose={onClose} title={t('g.pain.title', { name: petName })} size="lg">
      <div className="space-y-4">
          {!result && (
            <>
              <p className="text-sm text-surface-600 dark:text-surface-300">
                {t('g.pain.descA')} <strong>{t('g.pain.descFront')}</strong> {t('g.pain.descB', { name: petName })} <strong>Feline Grimace Scale</strong> {t('g.pain.descC')}
              </p>
              {!preview ? (
                <label className="block">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile} />
                  <div className="border-2 border-dashed border-rose-200 dark:border-rose-700 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl p-8 text-center cursor-pointer transition">
                    <Camera className="w-10 h-10 mx-auto text-rose-500 mb-2" />
                    <p className="text-sm font-semibold text-surface-800 dark:text-white">{t('g.pain.photoCta')}</p>
                  </div>
                </label>
              ) : (
                <div className="space-y-3">
                  <img src={preview} alt={petName} className="w-full rounded-2xl object-cover max-h-72 border border-surface-200 dark:border-surface-700" />
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer text-center text-sm bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 px-3 min-h-[44px] rounded-xl">
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile} />
                      {t('g.misc.change')}
                    </label>
                    <button onClick={run} disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-primary-700 hover:bg-primary-800 text-white dark:bg-primary-500 dark:text-surface-950 px-3 min-h-[44px] rounded-xl disabled:opacity-60">
                      {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {loading ? t('g.misc.analyzing') : t('g.pain.run')}
                    </button>
                  </div>
                </div>
              )}
              {error && <div className="flex items-center gap-2 border tone-danger-bg text-red-700 dark:text-red-300 rounded-xl p-3 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
            </>
          )}

          {result && (
            <>
              {result.image_quality === 'ruim' ? (
                <div className="border tone-warning-bg rounded-2xl p-4">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">{t('g.pain.badPhoto')}</p>
                  <p className="text-sm text-amber-800 dark:text-amber-100">{result.image_quality_notes}</p>
                </div>
              ) : (
                <>
                  <div className={cn(
                    'rounded-2xl p-4 border-2',
                    color === 'emerald' && 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40',
                    color === 'amber' && 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40',
                    color === 'orange' && 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/40',
                    color === 'red' && 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/40',
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      {color === 'red' ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <Heart className={cn('w-5 h-5', color === 'emerald' && 'text-emerald-600 dark:text-emerald-400', color === 'amber' && 'text-amber-600 dark:text-amber-400', color === 'orange' && 'text-orange-600 dark:text-orange-400')} />}
                      <p className="font-bold text-surface-900 dark:text-white">{t(PAIN_LABEL_KEY[result.pain_level] ?? 'g.pain.lvl.none')}</p>
                      {result.total_score && (
                        <span className="ml-auto text-sm font-bold">{t('g.pain.score', { score: result.total_score, max: result.max_possible ?? '' })}</span>
                      )}
                    </div>
                    <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-1">{result.scale}</p>
                    <p className="text-sm text-surface-700 dark:text-surface-200 leading-relaxed">{result.interpretation}</p>
                  </div>

                  {/* Per-unit scores */}
                  <div className="space-y-1.5">
                    {PAIN_UNITS.map(([key, labelKey]) => {
                      const item = (result as unknown as Record<string, { score: number | null; notes: string } | undefined>)[key]
                      if (!item || item.score == null) return null
                      return (
                        <div key={key} className="flex items-start gap-2 text-sm">
                          <span className="font-semibold text-surface-700 dark:text-surface-200 w-32 shrink-0">{t(labelKey)}</span>
                          <span className="font-bold text-surface-900 dark:text-white w-8 shrink-0">{item.score}</span>
                          <span className="text-surface-600 dark:text-surface-300">{item.notes}</span>
                        </div>
                      )
                    })}
                  </div>

                  {result.recommendations?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 font-semibold mb-1.5">{t('g.misc.recommendations')}</p>
                      <ul className="space-y-1">
                        {result.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-200">
                            <span className="text-rose-500">•</span><span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-surface-500 dark:text-surface-400 italic">{result.disclaimer}</p>
                </>
              )}
              <button onClick={reset} className="w-full bg-surface-100 dark:bg-surface-700 font-semibold py-3 rounded-xl">
                {t('g.pain.again')}
              </button>
            </>
          )}
      </div>
    </Modal>
  )
}
