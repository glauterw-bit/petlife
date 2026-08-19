'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, AlertCircle, Copy, Check, FileText, Mic } from 'lucide-react'
import { innovations, type VetScribeResult } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'

export default function VetScribePage() {
  const params = useParams()
  const router = useRouter()
  const t = useT()
  const { isVetUser, isLoading } = useAuth()
  const petId = Number(params.petId)

  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VetScribeResult | null>(null)
  const [recording, setRecording] = useState(false)
  const [recognitionRef, setRecognitionRef] = useState<unknown | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isVetUser) router.push('/vet/login')
  }, [isLoading, isVetUser, router])

  async function generate() {
    if (transcript.trim().length < 30) {
      setError(t('v.scribe.errShort'))
      return
    }
    setLoading(true); setError(null)
    try {
      setResult(await innovations.vetScribe(petId, transcript.trim()))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('v.scribe.errGenerate'))
    } finally {
      setLoading(false)
    }
  }

  // Ditado por voz (Web Speech API) — funciona em Chrome/Safari, gratuito
  function toggleRecording() {
    if (typeof window === 'undefined') return
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    if (!SR) { setError(t('v.scribe.errSpeech')); return }

    if (recording && recognitionRef) {
      (recognitionRef as { stop: () => void }).stop()
      setRecording(false)
      return
    }
    const rec = new (SR as new () => {
      lang: string; continuous: boolean; interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void;
      onerror: () => void; onend: () => void; start: () => void; stop: () => void;
    })()
    rec.lang = 'pt-BR'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        finalText += e.results[i][0].transcript + ' '
      }
      setTranscript(prev => prev + finalText)
    }
    rec.onerror = () => { setRecording(false) }
    rec.onend = () => { setRecording(false) }
    rec.start()
    setRecording(true)
    setRecognitionRef(rec)
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  function shareToWhatsApp() {
    if (!result?.owner_friendly_summary) return
    const text = encodeURIComponent(
      `${t('v.scribe.waMessage', { name: result.pet_name })}\n\n${result.owner_friendly_summary}\n\n${t('v.scribe.waSignature')}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  if (isLoading || !isVetUser) {
    return <div className="min-h-screen flex items-center justify-center text-surface-500 dark:text-surface-400">{t('common.loading')}</div>
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary-600" />
              {t('v.scribe.title')}
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">{t('v.scribe.subtitle')}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Input lado esquerdo */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-surface-900 dark:text-white">{t('v.scribe.notesTitle')}</h2>
              <button
                onClick={toggleRecording}
                className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl transition ${
                  recording
                    ? 'bg-red-500 text-white animate-pulse-soft'
                    : 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 hover:bg-primary-100'
                }`}
              >
                <Mic className="w-4 h-4" />
                {recording ? t('v.scribe.stopDictate') : t('v.scribe.dictate')}
              </button>
            </div>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder={t('v.scribe.notesPh')}
              rows={12}
              className="w-full p-3 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono"
            />
            <div className="flex items-center justify-between mt-3 text-xs text-surface-500 dark:text-surface-400">
              <span>{t('v.scribe.chars', { count: transcript.length })}</span>
            </div>
            <button
              onClick={generate}
              disabled={loading || transcript.trim().length < 30}
              className="w-full mt-3 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 shadow-lg shadow-primary-500/30"
            >
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? t('v.scribe.generating') : t('v.scribe.generate')}
            </button>
            {error && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl p-3 text-sm mt-3">
                <AlertCircle className="w-4 h-4" />{error}
              </div>
            )}
          </div>

          {/* Output lado direito */}
          <div className="space-y-3">
            {!result ? (
              <div className="bg-surface-100 dark:bg-surface-800/50 rounded-2xl p-8 text-center text-surface-500 dark:text-surface-400 text-sm border-2 border-dashed border-surface-200 dark:border-surface-700">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                {t('v.scribe.empty')}
              </div>
            ) : (
              <>
                <SoapSection title={t('v.scribe.subjective')} content={result.subjective} onCopy={() => copy(result.subjective, 'S')} copied={copied === 'S'} copyLabel={t('v.scribe.copy')} copiedLabel={t('v.scribe.copied')} />
                <SoapSection title={t('v.scribe.objective')} content={result.objective} onCopy={() => copy(result.objective, 'O')} copied={copied === 'O'} copyLabel={t('v.scribe.copy')} copiedLabel={t('v.scribe.copied')} />
                <SoapSection title={t('v.scribe.assessment')} content={result.assessment} onCopy={() => copy(result.assessment, 'A')} copied={copied === 'A'} copyLabel={t('v.scribe.copy')} copiedLabel={t('v.scribe.copied')} />
                <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-4">
                  <h3 className="font-bold text-surface-900 dark:text-white mb-2">{t('v.scribe.plan')}</h3>
                  {result.plan.diagnostic?.length ? <PlanList label={t('v.scribe.planDiagnostic')} items={result.plan.diagnostic} /> : null}
                  {result.plan.therapeutic?.length ? <PlanList label={t('v.scribe.planTherapeutic')} items={result.plan.therapeutic} /> : null}
                  {result.plan.preventive?.length ? <PlanList label={t('v.scribe.planPreventive')} items={result.plan.preventive} /> : null}
                  {result.plan.recommendations?.length ? <PlanList label={t('v.scribe.planRecommendations')} items={result.plan.recommendations} /> : null}
                  {result.plan.follow_up && (
                    <div className="mt-3 text-sm">
                      <span className="font-semibold text-surface-700 dark:text-surface-200">{t('v.scribe.followUp')}</span> {result.plan.follow_up}
                    </div>
                  )}
                </div>

                {result.owner_friendly_summary && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/50 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-emerald-800 dark:text-emerald-200">{t('v.scribe.ownerSummary')}</h3>
                      <button onClick={shareToWhatsApp} className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline">
                        {t('v.scribe.sendWhatsapp')}
                      </button>
                    </div>
                    <p className="text-sm text-emerald-900 dark:text-emerald-100 leading-relaxed">{result.owner_friendly_summary}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SoapSection({ title, content, onCopy, copied, copyLabel, copiedLabel }: {
  title: string; content: string; onCopy: () => void; copied: boolean; copyLabel: string; copiedLabel: string
}) {
  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-surface-900 dark:text-white">{title}</h3>
        <button onClick={onCopy} className="text-xs flex items-center gap-1 text-surface-500 dark:text-surface-400 hover:text-surface-700">
          {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> {copiedLabel}</> : <><Copy className="w-3.5 h-3.5" /> {copyLabel}</>}
        </button>
      </div>
      <p className="text-sm text-surface-700 dark:text-surface-200 leading-relaxed whitespace-pre-wrap">{content || '—'}</p>
    </div>
  )
}

function PlanList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-2">
      <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 font-semibold mb-1">{label}</p>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-surface-700 dark:text-surface-200 flex items-start gap-2">
            <span className="text-primary-500">•</span><span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
