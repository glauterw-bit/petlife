'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { CalendarPlus, Clock, CornerDownLeft, Loader2, Search, ShoppingCart, User, UserPlus, type LucideIcon } from 'lucide-react'
import { crm, type Client } from '@/lib/crmApi'
import { NAV, can, useCrm } from '../CrmShell'
import { fmtPhone, SpeciesIcon } from '../ui'
import { spring } from '../motion'
import { useDebounced } from './hooks'
import { useFocusTrap, useLayer } from './layers'

interface Recent { kind: 'client' | 'pet'; id: number; label: string; sub?: string; species?: string }
interface Entry { key: string; group: string; label: string; sub?: string; icon?: LucideIcon; species?: string; run: () => void }

const RECENT_KEY = 'crm_recent_v1'
function readRecent(): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(v) ? v.slice(0, 6) : []
  } catch { return [] }
}
function pushRecent(r: Recent) {
  try {
    const list = readRecent().filter(x => !(x.kind === r.kind && x.id === r.id))
    localStorage.setItem(RECENT_KEY, JSON.stringify([r, ...list].slice(0, 6)))
  } catch { /* armazenamento indisponível: segue sem recentes */ }
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function CommandPalette({ open, onClose, onAction }: { open: boolean; onClose: () => void; onAction: (a: 'appt' | 'client' | 'sale') => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>{open && <Palette key="cmdk" onClose={onClose} onAction={onAction} />}</AnimatePresence>,
    document.body,
  )
}

function Palette({ onClose, onAction }: { onClose: () => void; onAction: (a: 'appt' | 'client' | 'sale') => void }) {
  const router = useRouter()
  const { me } = useCrm()
  const { z, isTop } = useLayer(true, onClose)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, ref, isTop, 'field')
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 150)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [recent] = useState<Recent[]>(() => readRecent())

  useEffect(() => {
    if (dq.length < 2) { setClients([]); setErr(null); setLoading(false); return }
    let alive = true
    setLoading(true)
    crm.clients(dq)
      .then(r => { if (alive) { setClients(r); setErr(null) } })
      .catch((e: unknown) => { if (alive) setErr(e instanceof Error ? e.message : 'Não foi possível buscar.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dq])

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    const nq = norm(q.trim())
    const go = (href: string) => { onClose(); router.push(href) }
    const openClient = (c: { id: number; name: string; phone?: string | null }) => {
      pushRecent({ kind: 'client', id: c.id, label: c.name, sub: c.phone ? fmtPhone(c.phone) : undefined })
      go(`/clinica/clientes/${c.id}`)
    }
    const openPet = (p: { id: number; name: string; species: string }, owner: string) => {
      pushRecent({ kind: 'pet', id: p.id, label: p.name, sub: owner, species: p.species })
      go(`/clinica/pacientes/${p.id}`)
    }
    if (!nq) {
      recent.forEach(r => out.push({
        key: `r-${r.kind}-${r.id}`, group: 'Recentes', label: r.label, sub: r.sub, icon: r.kind === 'client' ? Clock : undefined, species: r.kind === 'pet' ? r.species : undefined,
        run: () => r.kind === 'client' ? openClient({ id: r.id, name: r.label }) : openPet({ id: r.id, name: r.label, species: r.species || 'other' }, r.sub || ''),
      }))
    } else if (dq.length >= 2) {
      clients.slice(0, 6).forEach(c => out.push({
        key: `c-${c.id}`, group: 'Clientes', label: c.name, icon: User,
        sub: [c.phone ? fmtPhone(c.phone) : null, (c.patients || []).map(p => p.name).join(', ')].filter(Boolean).join(' · ') || undefined,
        run: () => openClient(c),
      }))
      const pets: Entry[] = []
      clients.forEach(c => (c.patients || []).forEach(p => {
        if (norm(p.name).includes(nq)) pets.push({ key: `p-${p.id}`, group: 'Pets', label: p.name, sub: c.name, species: p.species, run: () => openPet(p, c.name) })
      }))
      out.push(...pets.slice(0, 6))
    }
    const actions: Entry[] = [
      { key: 'a-appt', group: 'Ações', label: 'Novo agendamento', icon: CalendarPlus, run: () => { onClose(); onAction('appt') } },
      { key: 'a-sale', group: 'Ações', label: 'Nova venda', icon: ShoppingCart, run: () => { onClose(); onAction('sale') } },
      { key: 'a-client', group: 'Ações', label: 'Novo cliente', icon: UserPlus, run: () => { onClose(); onAction('client') } },
    ]
    const nav: Entry[] = NAV.flatMap(g => g.items)
      .filter(n => can(me.user.role, ...n.roles))
      .map(n => ({ key: `n-${n.href}`, group: 'Ir para', label: n.label, icon: n.Icon, run: () => go(n.href) }))
    const match = (e: Entry) => !nq || norm(e.label).includes(nq)
    if (nq) {
      out.push(...nav.filter(match), ...actions.filter(match))
    } else {
      out.push(...actions, ...nav)
    }
    return out
  }, [q, dq, clients, recent, me.user.role]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActive(0) }, [q, clients])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(entries.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); entries[active]?.run() }
  }

  let lastGroup = ''
  const searching = dq.length >= 2 && (loading || q.trim() !== dq)
  return (
    <div className="crm-layer fixed inset-0 flex items-start justify-center px-3 pt-[10vh]" style={{ zIndex: z }}>
      <m.div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" aria-hidden onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} />
      <m.div ref={ref} role="dialog" aria-modal="true" aria-label="Buscar no PetLife Clínica" tabIndex={-1}
        className="relative w-full max-w-[640px] rounded-2xl bg-panel text-ink shadow-crm-pop overflow-hidden outline-none"
        initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: -8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} onKeyDown={onKey}>
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
          {searching ? <Loader2 className="w-[18px] h-[18px] text-muted animate-spin" aria-hidden /> : <Search className="w-[18px] h-[18px] text-muted" strokeWidth={1.75} aria-hidden />}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar tutor, pet ou telefone" aria-label="Buscar tutor, pet ou telefone"
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={entries[active] ? `cmdk-${entries[active].key}` : undefined}
            className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted/80 focus-visible:ring-0 focus-visible:ring-offset-0" />
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-line px-1.5 text-2xs text-muted">Esc</kbd>
        </div>
        <div ref={listRef} id="cmdk-list" role="listbox" className="max-h-[min(60vh,440px)] overflow-y-auto overscroll-contain p-2">
          {err && <p role="alert" className="px-3 py-2 text-sm text-red-600 dark:text-red-400">Não foi possível buscar: {err}</p>}
          {dq.length >= 2 && !loading && !err && clients.length === 0 && q.trim() === dq && (
            <p className="px-3 py-2 text-sm text-muted">Nenhum tutor ou pet encontrado para “{dq}”.</p>
          )}
          {q.trim().length === 1 && <p className="px-3 py-2 text-sm text-muted">Digite pelo menos 2 letras para buscar tutores e pets.</p>}
          {entries.map((e, i) => {
            const head = e.group !== lastGroup
            lastGroup = e.group
            const Icon = e.icon
            return (
              <div key={e.key}>
                {head && <p className="px-3 pt-3 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted">{e.group}</p>}
                <div id={`cmdk-${e.key}`} role="option" aria-selected={i === active} data-idx={i}
                  onMouseMove={() => active !== i && setActive(i)} onClick={() => e.run()}
                  className="relative flex items-center gap-3 h-11 px-3 rounded-lg cursor-pointer">
                  {i === active && <m.span layoutId="cmdk-active" transition={spring.snappy} className="absolute inset-0 rounded-lg bg-panel-2" />}
                  <span className="relative h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md bg-panel-2 text-muted ring-1 ring-line">
                    {e.species ? <SpeciesIcon species={e.species} className="w-4 h-4" /> : Icon ? <Icon className="w-4 h-4" strokeWidth={1.75} aria-hidden /> : null}
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{e.label}</span>
                    {e.sub && <span className="block text-xs text-muted truncate">{e.sub}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="relative w-4 h-4 text-muted shrink-0" strokeWidth={1.75} aria-hidden />}
                </div>
              </div>
            )
          })}
        </div>
      </m.div>
    </div>
  )
}
