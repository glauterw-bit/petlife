'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchX, Smartphone, UserPlus, Users } from 'lucide-react'
import { crm, type ClientRow } from '@/lib/crmApi'
import { useCrmChange } from '@/components/crm/CrmShell'
import { Badge, Btn, Card, PageHead, brl, fmtDate, fmtPhone } from '@/components/crm/ui'
import { ClientModal } from '@/components/crm/forms'
import { DataList, EmptyState, PersonAvatar, PetAvatar, SearchInput, useDebounced, type Column } from '@/components/crm/kit'

const PAGE = 50

function PetChips({ pets }: { pets: ClientRow['patients'] }) {
  if (!pets.length) return <span className="text-muted">—</span>
  const shown = pets.slice(0, 3)
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      {shown.map(p => (
        <span key={p.id} className="inline-flex items-center gap-1.5 h-7 pl-0.5 pr-2.5 rounded-full bg-panel-2 text-xs font-medium text-ink max-w-[140px]">
          <PetAvatar name={p.name} species={p.species} size="sm" />
          <span className="truncate">{p.name}</span>
        </span>
      ))}
      {pets.length > 3 && <span className="text-xs font-semibold text-muted tabular-nums">+{pets.length - 3}</span>}
    </span>
  )
}

export default function Clientes() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 250)
  const [rows, setRows] = useState<ClientRow[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const req = useRef(0)

  const load = (search: string) => {
    const id = ++req.current
    setLoading(true)
    crm.clientsPage(search, 0, PAGE).then(r => {
      if (id !== req.current) return
      setRows(r.items); setTotal(r.total); setError(null)
    }).catch(e => {
      if (id !== req.current) return
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.')
    }).finally(() => { if (id === req.current) setLoading(false) })
  }
  useEffect(() => { load(dq) }, [dq]) // eslint-disable-line react-hooks/exhaustive-deps
  useCrmChange(['client', 'patient', 'sale'], () => load(dq))

  async function loadMore() {
    if (!rows || more) return
    const id = req.current
    setMore(true)
    try {
      const r = await crm.clientsPage(dq, rows.length, PAGE)
      if (id !== req.current) return
      setRows(x => {
        const seen = new Set((x ?? []).map(c => c.id))
        return [...(x ?? []), ...r.items.filter(c => !seen.has(c.id))]
      })
      setTotal(r.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.')
    } finally { setMore(false) }
  }

  const open = (c: ClientRow) => router.push(`/clinica/clientes/${c.id}`)
  const columns: Column<ClientRow>[] = [
    {
      key: 'tutor', header: 'Tutor', cell: c => (
        <span className="flex items-center gap-2.5 min-w-0">
          <PersonAvatar name={c.name} size="sm" />
          <span className="min-w-0">
            <span className="block font-medium text-ink truncate">{c.name}</span>
            {c.phone && <span className="block text-xs text-muted tabular-nums">{fmtPhone(c.phone)}</span>}
          </span>
        </span>
      ),
    },
    { key: 'pets', header: 'Pets', cell: c => <PetChips pets={c.patients} /> },
    {
      key: 'open', header: 'Em aberto', align: 'right', cell: c => c.open_balance > 0
        ? <span className="font-semibold text-red-600 dark:text-red-400">{brl(c.open_balance)}</span>
        : <span className="text-muted">—</span>,
    },
    { key: 'last', header: 'Último atendimento', hideBelow: 'lg', cell: c => <span className={`tabular-nums ${c.last_visit ? '' : 'text-muted'}`}>{c.last_visit ? fmtDate(c.last_visit) : 'Nunca'}</span> },
    { key: 'app', header: 'App', cell: c => c.petlife_linked ? <Badge tone="good">No app</Badge> : null },
  ]

  const sub = total == null ? undefined : total === 1 ? '1 cliente' : `${total.toLocaleString('pt-BR')} clientes`
  const searching = !!dq

  return (
    <div>
      <PageHead title="Clientes e pets" sub={searching && total != null ? `${sub} para "${dq}"` : sub}
        actions={<Btn icon={UserPlus} onClick={() => setModal(true)}>Novo cliente</Btn>} />

      <SearchInput value={q} onChange={setQ} shortcut="/" autoFocus={false} className="h-11 mb-4 [&_input]:text-[15px]"
        placeholder="Buscar por tutor, pet, telefone ou e-mail" ariaLabel="Buscar clientes" />

      <Card className="!p-2 md:!p-3">
        <DataList
          ariaLabel="Clientes"
          rows={rows}
          loading={loading}
          error={error}
          onRetry={() => load(dq)}
          columns={columns}
          rowKey={c => c.id}
          onRowClick={open}
          renderMobile={c => (
            <div className="flex items-center gap-3 min-w-0">
              <PersonAvatar name={c.name} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium text-ink">
                  <span className="truncate">{c.name}</span>
                  {c.petlife_linked && <Smartphone className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-label="No app" />}
                </p>
                <p className="text-xs text-muted truncate tabular-nums">
                  {[fmtPhone(c.phone), c.patients.map(p => p.name).join(', ')].filter(Boolean).join(' · ') || 'Sem pets'}
                </p>
              </div>
              {c.open_balance > 0 && <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums shrink-0">{brl(c.open_balance)}</span>}
            </div>
          )}
          empty={searching
            ? <EmptyState icon={SearchX} title={`Ninguém encontrado para "${dq}"`} hint="Confira a grafia ou busque pelo telefone." compact />
            : <EmptyState icon={Users} title="Cadastre o primeiro cliente" hint="Tutor e pet em um só cadastro."
                action={<Btn icon={UserPlus} onClick={() => setModal(true)}>Novo cliente</Btn>} />}
          footer={rows && total != null && rows.length < total ? (
            <div className="flex flex-col items-center gap-1 pb-1">
              <Btn variant="outline" onClick={loadMore} loading={more}>Carregar mais</Btn>
              <span className="text-2xs text-muted tabular-nums">Mostrando {rows.length} de {total}</span>
            </div>
          ) : undefined}
        />
      </Card>

      <ClientModal open={modal} onClose={() => setModal(false)} onSaved={c => router.push(`/clinica/clientes/${c.id}`)} />
    </div>
  )
}
