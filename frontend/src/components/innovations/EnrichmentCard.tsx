'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { enrichment, type EnrichmentDay } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { VyronAvatar } from '@/components/ai/VyronAvatar'

const TYPE_BADGE: Record<string, string> = {
  mental: '🧠 mental',
  fisica: '🏃 física',
  vinculo: '💚 vínculo',
}

/**
 * Bem-estar mental do pet: 3 atividades de enriquecimento do dia geradas pela
 * Vyron. Cacheia por dia no localStorage pra não gastar quota à toa.
 */
export function EnrichmentCard({ petId, petName }: { petId: number; petName: string }) {
  const { error } = useToast()
  const [data, setData] = useState<EnrichmentDay | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<Record<number, boolean>>({})
  const cacheKey = `petlife_enrich_${petId}_${new Date().toISOString().slice(0, 10)}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        setData(parsed.data)
        setDone(parsed.done || {})
      }
    } catch {}
  }, [cacheKey])

  async function generate() {
    setLoading(true)
    try {
      const res = await enrichment.get(petId)
      setData(res)
      setDone({})
      try { localStorage.setItem(cacheKey, JSON.stringify({ data: res, done: {} })) } catch {}
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Não foi possível gerar agora.')
    } finally { setLoading(false) }
  }

  function toggleDone(i: number) {
    const next = { ...done, [i]: !done[i] }
    setDone(next)
    try { localStorage.setItem(cacheKey, JSON.stringify({ data, done: next })) } catch {}
  }

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-500" /> Bem-estar de hoje
        </h3>
        {data && (
          <button onClick={generate} disabled={loading}
            className="pressable flex items-center gap-1 text-xs font-semibold text-primary-600 px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Novas
          </button>
        )}
      </div>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
        Atividades de enriquecimento pra deixar {petName} mais feliz — criadas pela Vyron.
      </p>

      {!data ? (
        <div className="text-center py-4">
          <div className="flex justify-center mb-3"><VyronAvatar size={56} state={loading ? 'thinking' : 'idle'} /></div>
          <button onClick={generate} disabled={loading}
            className="pressable inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Vyron pensando…' : 'Gerar atividades do dia'}
          </button>
          <p className="text-[11px] text-surface-400 mt-2">3 atividades de 5–15 min com itens de casa</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.activities.map((a, i) => (
            <button
              key={i}
              onClick={() => toggleDone(i)}
              className={`pressable reveal w-full text-left rounded-xl border p-3 transition ${
                done[i]
                  ? 'border-primary-300 bg-primary-50/60 dark:bg-primary-900/20 dark:border-primary-700'
                  : 'border-surface-200 dark:border-surface-700'
              }`}
              style={{ ['--i' as string]: i }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{a.emoji}</span>
                <span className={`font-semibold text-sm flex-1 ${done[i] ? 'line-through text-surface-400' : 'text-surface-900 dark:text-white'}`}>
                  {a.title}
                </span>
                <span className="text-[10px] bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-300 rounded-full px-2 py-0.5">
                  {TYPE_BADGE[a.type] ?? a.type} · {a.minutes} min
                </span>
              </div>
              {!done[i] && (
                <>
                  <p className="text-xs text-surface-600 dark:text-surface-300 mt-1.5 leading-relaxed">{a.how}</p>
                  <p className="text-[11px] text-primary-600 dark:text-primary-300 mt-1">✦ {a.benefit}</p>
                </>
              )}
            </button>
          ))}
          {data.tip && (
            <div className="flex items-start gap-2 rounded-xl bg-primary-50/70 dark:bg-primary-900/20 p-3 mt-1">
              <VyronAvatar size={26} state="idle" />
              <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed pt-1">
                <b className="text-primary-700 dark:text-primary-300">Dica da Vyron:</b> {data.tip}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
