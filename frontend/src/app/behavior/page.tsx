'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Brain, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { pets as petsApi, innovations, type Pet, type BehaviorPlanSummary, type BehaviorIssueType } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'

const ISSUE_OPTIONS: Array<{ value: BehaviorIssueType; label: string; emoji: string; species: 'dog' | 'cat' | 'both' }> = [
  { value: 'separation_anxiety', label: 'Ansiedade de separação', emoji: '😟', species: 'both' },
  { value: 'fear', label: 'Medo (barulhos, estranhos)', emoji: '😨', species: 'both' },
  { value: 'reactivity', label: 'Reatividade (latir/atacar outros pets)', emoji: '⚠️', species: 'dog' },
  { value: 'aggression', label: 'Agressividade', emoji: '😾', species: 'both' },
  { value: 'destruction', label: 'Destruição (móveis, sapatos)', emoji: '💥', species: 'dog' },
  { value: 'barking', label: 'Latidos excessivos', emoji: '🔊', species: 'dog' },
  { value: 'cat_litter', label: 'Caixa de areia (urina fora)', emoji: '🚫', species: 'cat' },
]

const INTENSITY_OPTIONS = [
  { value: 'leve', label: 'Leve', desc: 'Acontece ocasionalmente, não afeta muito o dia a dia' },
  { value: 'moderada', label: 'Moderada', desc: 'Vários episódios por semana' },
  { value: 'alta', label: 'Alta', desc: 'Diário ou comportamento perigoso/destrutivo' },
] as const

export default function BehaviorPlansPage() {
  const router = useRouter()
  const { success, error } = useToast()
  const [plans, setPlans] = useState<BehaviorPlanSummary[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  // Wizard state
  const [selectedPet, setSelectedPet] = useState<number | null>(null)
  const [issueType, setIssueType] = useState<BehaviorIssueType | ''>('')
  const [intensity, setIntensity] = useState<'leve' | 'moderada' | 'alta' | ''>('')
  const [context, setContext] = useState('')

  useEffect(() => {
    Promise.all([innovations.listBehaviorPlans(), petsApi.list()])
      .then(([p, pp]) => { setPlans(p); setPets(pp) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function createPlan() {
    if (!selectedPet || !issueType || !intensity) return
    setCreating(true)
    try {
      const plan = await innovations.createBehaviorPlan(selectedPet, issueType, intensity, context || undefined)
      success('Plano criado pelo IA!')
      router.push(`/behavior/${plan.id}`)
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro ao gerar plano.')
    } finally {
      setCreating(false)
    }
  }

  const petSpecies = pets.find(p => p.id === selectedPet)?.species
  const availableIssues = ISSUE_OPTIONS.filter(o => o.species === 'both' || o.species === petSpecies)

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-600" />
            Planos Comportamentais
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Planos de 6 semanas baseados em etologia, gerados pela IA Vyron.</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2.5 rounded-xl font-semibold transition shadow-lg shadow-purple-500/30"
        >
          <Plus className="w-4 h-4" />
          Novo plano
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
          <Brain className="w-12 h-12 text-purple-300 mx-auto mb-3" />
          <h3 className="font-bold text-surface-900 dark:text-white mb-1">Nenhum plano ativo</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">Comece um plano comportamental personalizado pelo Vyron IA.</p>
          <button
            onClick={() => setShowWizard(true)}
            className="bg-purple-500 hover:bg-purple-600 text-white px-5 py-2.5 rounded-xl font-semibold"
          >
            Criar primeiro plano
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {plans.map(p => {
            const issue = ISSUE_OPTIONS.find(o => o.value === p.issue_type)
            return (
              <Link
                key={p.id}
                href={`/behavior/${p.id}`}
                className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5 hover:border-purple-300 dark:hover:border-purple-700 transition"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">{issue?.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-surface-900 dark:text-white">{p.pet_name}</h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">{issue?.label}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.status === 'active' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
                    p.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-surface-100 text-surface-600'
                  }`}>{p.status}</span>
                </div>
                <div className="text-xs text-surface-500 space-y-1">
                  <div>Intensidade: <strong className="capitalize">{p.intensity}</strong></div>
                  <div>Check-ins: <strong>{p.check_ins_count}/{p.duration_weeks * 7}</strong></div>
                  {p.average_progress !== null && (
                    <div>Progresso médio: <strong>{p.average_progress.toFixed(1)}/10</strong></div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Wizard modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowWizard(false)}>
          <div className="bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 sticky top-0 bg-white/95 dark:bg-surface-800/95 backdrop-blur z-10">
              <h2 className="font-bold text-surface-900 dark:text-white">Criar plano comportamental</h2>
              <p className="text-xs text-surface-500 mt-0.5">3 perguntas — IA cria o curriculum</p>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">Para qual pet?</label>
                <div className="grid grid-cols-2 gap-2">
                  {pets.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPet(p.id); setIssueType('') }}
                      className={`p-3 rounded-xl border text-left transition ${
                        selectedPet === p.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                      }`}
                    >
                      <p className="font-semibold text-sm">{p.name}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">{p.species === 'dog' ? '🐕' : '🐈'} {p.breed?.name ?? 'SRD'}</p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedPet && (
                <div>
                  <label className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">Qual o comportamento?</label>
                  <div className="space-y-1.5">
                    {availableIssues.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setIssueType(o.value)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                          issueType === o.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                        }`}
                      >
                        <span className="text-xl">{o.emoji}</span>
                        <span className="text-sm font-medium">{o.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {issueType && (
                <div>
                  <label className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">Intensidade</label>
                  <div className="space-y-1.5">
                    {INTENSITY_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setIntensity(o.value)}
                        className={`w-full p-3 rounded-xl border text-left transition ${
                          intensity === o.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                        }`}
                      >
                        <p className="font-semibold text-sm">{o.label}</p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">{o.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {intensity && (
                <div>
                  <label className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">Contexto (opcional)</label>
                  <textarea
                    value={context}
                    onChange={e => setContext(e.target.value)}
                    rows={3}
                    placeholder="Quando começou? Algum gatilho específico? O que já tentou?"
                    className="w-full p-3 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowWizard(false)} className="flex-1 py-3 rounded-xl bg-surface-100 dark:bg-surface-700 font-semibold text-surface-700 dark:text-surface-200">
                  Cancelar
                </button>
                <button
                  onClick={createPlan}
                  disabled={!selectedPet || !issueType || !intensity || creating}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold disabled:opacity-60 shadow-lg shadow-purple-500/30"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {creating ? 'Gerando…' : 'Criar plano'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
