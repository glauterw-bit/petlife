'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Percent, Plus, Trash2 } from 'lucide-react'
import { crm, type CommissionRate, type Member } from '@/lib/crmApi'
import { Btn, ROLE, Select, catLabel, parseDecimal } from '@/components/crm/ui'
import { DecimalInput, EmptyState, ErrorState, PersonAvatar, SkeletonCard, useAsync } from '@/components/crm/kit'
import { dur } from '@/components/crm/motion'
import { useToast } from '@/components/ui/ToastContext'
import { Section } from './shared'

const SERVICE_CATS = ['consulta', 'vacina', 'banho_tosa', 'exame', 'cirurgia']
const PRODUCT_CATS = ['medicamento', 'racao', 'acessorio', 'higiene', 'outros']
const pctText = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }))

function validPct(raw: string): number | null | 'invalid' {
  if (!raw.trim()) return null
  const n = parseDecimal(raw)
  if (n == null || n < 0 || n > 100) return 'invalid'
  return Math.round(n * 100) / 100
}

/** Percentual de comissão por profissional: um padrão e exceções por categoria. */
export function CommissionsPanel({ team }: { team: Member[] | null }) {
  const rates = useAsync(() => crm.commissionRates(), [])
  if (!rates.data && rates.error) return <Section title="Comissões"><ErrorState message={rates.error} onRetry={rates.reload} compact /></Section>
  if (!rates.data || !team) return <SkeletonCard lines={5} />
  return <Panel team={team} rates={rates.data} setRates={rates.setData} />
}

function Panel({ team, rates, setRates }: { team: Member[]; rates: CommissionRate[]; setRates: (r: CommissionRate[] | null) => void }) {
  if (!team.length) return <Section title="Comissões"><EmptyState icon={Percent} compact title="Nenhuma pessoa na equipe" /></Section>
  const upsert = (r: CommissionRate) => {
    const rest = rates.filter(x => !(x.user_id === r.user_id && (x.category ?? null) === (r.category ?? null)))
    setRates([...rest, r])
  }
  const drop = (id: number) => setRates(rates.filter(x => x.id !== id))
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted max-w-2xl">
        A comissão é calculada sobre os itens de venda paga com o profissional escolhido. Vale o percentual da categoria do item; se não houver, o padrão da pessoa.
        Veja os valores em <Link href="/clinica/relatorios" className="font-semibold text-primary-700 dark:text-primary-300 hover:underline">Relatórios</Link>.
      </p>
      {team.map(m => (
        <MemberRates key={m.id} member={m} rates={rates.filter(r => r.user_id === m.user_id)} onUpsert={upsert} onDrop={drop} />
      ))}
    </div>
  )
}

function MemberRates({ member, rates, onUpsert, onDrop }: {
  member: Member; rates: CommissionRate[]; onUpsert: (r: CommissionRate) => void; onDrop: (id: number) => void
}) {
  const { error, success } = useToast()
  const def = rates.find(r => r.category == null) ?? null
  const exceptions = useMemo(() => rates.filter(r => r.category != null).sort((a, b) => catLabel(a.category).localeCompare(catLabel(b.category))), [rates])
  const used = new Set(exceptions.map(r => r.category as string))
  const free = [...SERVICE_CATS, ...PRODUCT_CATS].filter(c => !used.has(c))
  const [newCat, setNewCat] = useState('')
  const [newPct, setNewPct] = useState('')
  const [newErr, setNewErr] = useState('')
  const [adding, setAdding] = useState(false)

  async function add() {
    const cat = newCat || free[0]
    const v = validPct(newPct)
    if (!cat) return
    if (v == null || v === 'invalid') { setNewErr('Use um valor de 0 a 100.'); return }
    setNewErr(''); setAdding(true)
    try {
      const r = await crm.setCommissionRate({ user_id: member.user_id, category: cat, pct: v })
      onUpsert(r); setNewPct(''); setNewCat('')
      success(`Comissão de ${catLabel(cat)} salva.`)
    } catch (e) { error(e instanceof Error ? e.message : 'Não foi possível salvar.') }
    finally { setAdding(false) }
  }

  return (
    <Section title={member.name} sub={ROLE[member.role] ?? member.role}
      actions={<PersonAvatar name={member.name} size="sm" />}>
      <ul className="divide-y divide-line">
        <RateRow label="Padrão" hint="Para qualquer item sem percentual próprio." rate={def} userId={member.user_id} category={null} onUpsert={onUpsert} onDrop={onDrop} />
        <AnimatePresence initial={false}>
          {exceptions.map(r => (
            <motion.li key={r.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: dur.base }}>
              <RateRow as="div" label={catLabel(r.category)} rate={r} userId={member.user_id} category={r.category} onUpsert={onUpsert} onDrop={onDrop} removable />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {free.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-2">Exceção por categoria</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 items-start">
            <Select aria-label="Categoria" value={newCat || free[0]} onChange={e => setNewCat(e.target.value)}>
              <optgroup label="Serviços">{SERVICE_CATS.filter(c => !used.has(c)).map(c => <option key={c} value={c}>{catLabel(c)}</option>)}</optgroup>
              <optgroup label="Produtos">{PRODUCT_CATS.filter(c => !used.has(c)).map(c => <option key={c} value={c}>{catLabel(c)}</option>)}</optgroup>
            </Select>
            <div>
              <DecimalInput aria-label="Percentual" suffix="%" value={newPct} onChange={setNewPct} placeholder="0"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
              {newErr && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1">{newErr}</p>}
            </div>
            <Btn variant="soft" icon={Plus} loading={adding} onClick={add}>Adicionar</Btn>
          </div>
        </div>
      )}
    </Section>
  )
}

function RateRow({ label, hint, rate, userId, category, onUpsert, onDrop, removable, as = 'li' }: {
  label: string; hint?: string; rate: CommissionRate | null; userId: number; category: string | null
  onUpsert: (r: CommissionRate) => void; onDrop: (id: number) => void; removable?: boolean; as?: 'li' | 'div'
}) {
  const { error } = useToast()
  const [val, setVal] = useState(() => pctText(rate?.pct))
  const [err, setErr] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')

  async function commit() {
    const v = validPct(val)
    if (v === 'invalid') { setErr('Use um valor de 0 a 100.'); return }
    setErr('')
    if (v === (rate?.pct ?? null)) return
    setState('saving')
    try {
      if (v == null) {
        if (rate) { await crm.deleteCommissionRate(rate.id); onDrop(rate.id) }
      } else {
        const r = await crm.setCommissionRate({ user_id: userId, category, pct: v })
        onUpsert(r)
        setVal(pctText(r.pct))
      }
      setState('saved')
      setTimeout(() => setState(s => (s === 'saved' ? 'idle' : s)), 1600)
    } catch (e) {
      setState('idle')
      error(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }
  async function remove() {
    if (!rate) return
    setState('saving')
    try { await crm.deleteCommissionRate(rate.id); onDrop(rate.id) }
    catch (e) { setState('idle'); error(e instanceof Error ? e.message : 'Não foi possível remover.') }
  }

  const C = as
  return (
    <C className="flex items-center gap-3 min-h-14 md:min-h-11 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink truncate">{label}</p>
        {hint && <p className="text-xs text-muted truncate">{hint}</p>}
        {err && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{err}</p>}
      </div>
      <span className="w-5 shrink-0 inline-flex justify-center" aria-live="polite">
        <AnimatePresence>
          {state === 'saved' && (
            <motion.span key="ok" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.fast }}>
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-label="Salvo" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <DecimalInput aria-label={`Comissão ${label}`} suffix="%" value={val} onChange={setVal} placeholder="0"
        disabled={state === 'saving'} className="w-28 shrink-0" onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() } }} />
      {removable ? (
        <button type="button" onClick={remove} aria-label={`Remover exceção de ${label}`}
          className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 dark:hover:text-red-300">
          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
        </button>
      ) : <span className="w-8 shrink-0" aria-hidden />}
    </C>
  )
}
