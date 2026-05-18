'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Plus, AlertTriangle, Loader2 } from 'lucide-react'
import { innovations, type WeightHistory } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'

interface WeightChartProps {
  petId: number
}

export function WeightChart({ petId }: WeightChartProps) {
  const { success, error } = useToast()
  const [data, setData] = useState<WeightHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [weightInput, setWeightInput] = useState('')

  useEffect(() => {
    innovations.weightHistory(petId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [petId])

  async function addWeight() {
    const w = parseFloat(weightInput.replace(',', '.'))
    if (!w || w <= 0 || w > 200) { error('Peso inválido'); return }
    setAdding(true)
    try {
      await innovations.addWeight(petId, w)
      const fresh = await innovations.weightHistory(petId)
      setData(fresh)
      setWeightInput('')
      success(`Peso ${w} kg registrado!`)
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-surface-400" /></div>
  if (!data) return null

  const entries = data.entries
  const max = entries.length > 0 ? Math.max(...entries.map(e => e.weight_kg)) : 0
  const min = entries.length > 0 ? Math.min(...entries.map(e => e.weight_kg)) : 0
  const range = max - min || 1

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-surface-900 dark:text-white">Peso ao longo do tempo</h3>
          {data.current_weight && (
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Atual: <strong>{data.current_weight} kg</strong>
              {data.breed_weight_range && <span className="ml-2 text-xs">(faixa da raça: {data.breed_weight_range})</span>}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="ex: 12.5"
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            className="w-24 px-3 py-2 text-sm border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={addWeight}
            disabled={adding || !weightInput}
            className="flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-3 py-2 rounded-xl disabled:opacity-60"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            kg
          </button>
        </div>
      </div>

      {data.alert && (
        <div className={`flex items-center gap-2 rounded-xl p-3 mb-3 text-sm ${
          data.alert.severity === 'alta'
            ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
        }`}>
          {data.alert.type === 'ganho' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{data.alert.message}</span>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-surface-400 text-center py-8">Nenhuma medição ainda. Adicione a primeira acima.</p>
      ) : (
        <>
          {/* SVG line chart */}
          <div className="relative h-32 mt-4">
            <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary-500"
                points={entries.map((e, i) => {
                  const x = entries.length === 1 ? 200 : (i / (entries.length - 1)) * 400
                  const y = 90 - ((e.weight_kg - min) / range) * 80
                  return `${x},${y}`
                }).join(' ')}
              />
              {entries.map((e, i) => {
                const x = entries.length === 1 ? 200 : (i / (entries.length - 1)) * 400
                const y = 90 - ((e.weight_kg - min) / range) * 80
                return <circle key={i} cx={x} cy={y} r="3" className="fill-primary-500" />
              })}
            </svg>
            <div className="absolute left-0 top-0 text-[10px] text-surface-400">{max.toFixed(1)} kg</div>
            <div className="absolute left-0 bottom-0 text-[10px] text-surface-400">{min.toFixed(1)} kg</div>
          </div>

          <div className="mt-4 max-h-32 overflow-y-auto space-y-1">
            {[...entries].reverse().slice(0, 6).map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs text-surface-600 dark:text-surface-300 py-1 border-b border-surface-100 dark:border-surface-700 last:border-0">
                <span>{new Date(e.measured_at).toLocaleDateString('pt-BR')}</span>
                <span className="font-semibold text-surface-900 dark:text-white">{e.weight_kg} kg</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
