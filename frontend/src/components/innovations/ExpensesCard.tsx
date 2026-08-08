'use client'

import { useEffect, useState } from 'react'
import { Wallet, Plus, Trash2, Loader2 } from 'lucide-react'
import { expenses, type PetExpense, type ExpenseSummary } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useChartTheme } from '@/lib/charts'

const CATEGORIES = [
  { value: 'alimentacao', label: 'Alimentação', emoji: '🍖' },
  { value: 'saude', label: 'Saúde', emoji: '💊' },
  { value: 'higiene', label: 'Higiene', emoji: '🧼' },
  { value: 'acessorios', label: 'Acessórios', emoji: '🧸' },
  { value: 'servicos', label: 'Serviços', emoji: '✂️' },
  { value: 'outros', label: 'Outros', emoji: '📦' },
]

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ExpensesCard({ petId }: { petId: number }) {
  const { success, error } = useToast()
  const { palette } = useChartTheme()
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [items, setItems] = useState<PetExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ category: 'alimentacao', amount: '', description: '' })

  async function refresh() {
    try {
      const [s, l] = await Promise.all([expenses.summary(petId), expenses.list(petId)])
      setSummary(s)
      setItems(l)
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [petId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const amount = parseFloat(form.amount.replace(',', '.'))
    if (!amount || amount <= 0) { error('Informe um valor válido.'); return }
    setSaving(true)
    try {
      await expenses.add(petId, { category: form.category, amount, description: form.description || undefined })
      setForm({ category: 'alimentacao', amount: '', description: '' })
      setShowForm(false)
      success('Gasto registrado!')
      refresh()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  async function remove(id: number) {
    try { await expenses.remove(petId, id); refresh() } catch {}
  }

  if (loading) return null
  const maxMonth = Math.max(...(summary?.months.map(m => m.total) ?? [0]), 1)

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary-500" /> Gastos do pet
        </h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="pressable flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" /> Registrar
        </button>
      </div>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-3">
        Este mês: <strong className="text-surface-900 dark:text-white tabular-nums">{brl(summary?.month_total ?? 0)}</strong>
      </p>

      {showForm && (
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 mb-4 space-y-2 animate-slide-up">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setForm(f => ({ ...f, category: c.value }))}
                className={`pressable text-xs px-2.5 py-1.5 rounded-full border font-medium ${
                  form.category === c.value
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-400 text-primary-700 dark:text-primary-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text" inputMode="decimal" placeholder="R$ 0,00" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-28 px-3 py-2 text-sm border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="text" placeholder="descrição (opcional)" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="flex-1 px-3 py-2 text-sm border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button onClick={save} disabled={saving}
              className="pressable bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 rounded-xl disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'OK'}
            </button>
          </div>
        </div>
      )}

      {/* barras dos últimos 6 meses */}
      {summary && summary.months.some(m => m.total > 0) && (
        <div className="flex items-end gap-2 h-20 mb-1">
          {summary.months.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-surface-400 tabular-nums">{m.total > 0 ? brl(m.total).replace(/,\d+$/, '') : ''}</span>
              <div
                className="w-full max-w-[34px] rounded-t-md transition-all"
                style={{ height: `${Math.max((m.total / maxMonth) * 56, m.total > 0 ? 4 : 1)}px`, background: palette[0], opacity: 0.85 }}
              />
              <span className="text-[9px] text-surface-400">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
            </div>
          ))}
        </div>
      )}

      {/* por categoria no mês */}
      {summary && summary.by_category.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {summary.by_category.map(c => (
            <span key={c.category} className="text-[11px] bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 rounded-full px-2.5 py-1 tabular-nums">
              {CATEGORIES.find(x => x.value === c.category)?.emoji} {c.label}: <b>{brl(c.total)}</b>
            </span>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-surface-400 text-center py-4">Nenhum gasto registrado ainda.</p>
      ) : (
        <div className="max-h-36 overflow-y-auto space-y-1">
          {items.slice(0, 8).map(e => (
            <div key={e.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-surface-100 dark:border-surface-700 last:border-0">
              <span>{CATEGORIES.find(x => x.value === e.category)?.emoji ?? '📦'}</span>
              <span className="text-surface-600 dark:text-surface-300 flex-1 truncate">
                {e.description || e.category_label}
              </span>
              <span className="text-surface-400">{new Date(e.spent_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
              <span className="font-semibold text-surface-900 dark:text-white tabular-nums">{brl(e.amount)}</span>
              <button onClick={() => remove(e.id)} aria-label="Excluir" className="text-surface-300 hover:text-red-400 p-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
