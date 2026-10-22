'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { CalendarPlus, Mail, MessageCircle, MoreHorizontal, Pencil, Phone, Plus, Receipt, ShoppingCart, StickyNote, Trash2, UserX } from 'lucide-react'
import { crm, type Appt, type Sale } from '@/lib/crmApi'
import { useCrm, can, useCrmChange } from '@/components/crm/CrmShell'
import { Badge, Btn, Card, Kpi, PageHead, PAY, SPECIES, ageFrom, brl, fmtDate, fmtDay, fmtPhone, waLink, type Tone } from '@/components/crm/ui'
import { ApptModal, ClientModal, PatientModal } from '@/components/crm/forms'
import { DropdownMenu, EmptyState, ErrorState, PetAvatar, Skeleton, SkeletonCard, SkeletonKpis, Tabs, useConfirm } from '@/components/crm/kit'
import { MotionItem, MotionList } from '@/components/crm/motion'
import { useToast } from '@/components/ui/ToastContext'
import { useLoad } from '@/components/crm/clientes/useLoad'
import { ApptList } from '@/components/crm/clientes/ApptList'

const SALE_STATUS: Record<string, { label: string; tone: Tone }> = {
  paga: { label: 'Paga', tone: 'good' }, aberta: { label: 'Em aberto', tone: 'warn' }, cancelada: { label: 'Cancelada', tone: 'default' },
}

function AppState({ p }: { p: { consent_active: boolean; invite_pending: boolean; petlife_linked: boolean } }) {
  if (p.consent_active) return <Badge tone="good">No app</Badge>
  if (p.invite_pending) return <Badge tone="warn">Convite enviado</Badge>
  if (p.petlife_linked) return <Badge>Acesso retirado</Badge>
  return null
}

export default function ClienteFicha() {
  const { id } = useParams<{ id: string }>()
  const cid = Number(id)
  const router = useRouter()
  const { me } = useCrm()
  const { success, error } = useToast()
  const { confirm } = useConfirm()
  const { data: c, error: err, status, loading, reload } = useLoad(() => crm.client(cid), [cid])
  useCrmChange(['client', 'patient', 'appointment', 'sale'], reload)
  const [tab, setTab] = useState<'appts' | 'sales' | 'notes'>('appts')
  const [edit, setEdit] = useState(false)
  const [newPet, setNewPet] = useState(false)
  const [appt, setAppt] = useState<{ open: boolean; initial: Appt | null }>({ open: false, initial: null })

  if (!c && status === 404) {
    return (
      <Card><EmptyState icon={UserX} title="Cliente não encontrado" hint="Ele pode ter sido excluído."
        action={<Link href="/clinica/clientes" className="text-sm font-semibold text-primary-600 dark:text-primary-400">Voltar para Clientes</Link>} /></Card>
    )
  }
  if (!c && err) return <Card><ErrorState message={err} onRetry={reload} /></Card>
  if (!c) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <SkeletonKpis count={2} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"><SkeletonCard lines={2} /><SkeletonCard lines={2} /></div>
        <SkeletonCard lines={5} />
      </div>
    )
  }

  const first = c.name.split(' ')[0]
  const wa = waLink(c.phone, `Olá, ${first}!`)
  const isAdmin = me.user.role === 'admin'

  async function remove() {
    if (!c) return
    const ok = await confirm({
      title: `Excluir ${c.name}?`, message: 'Pets, prontuários e agendamentos deste cliente serão apagados.',
      tone: 'danger', confirmLabel: 'Excluir',
    })
    if (!ok) return
    try {
      await crm.deleteClient(c.id)
      success('Cliente excluído.')
      router.push('/clinica/clientes')
    } catch (e) { error(e instanceof Error ? e.message : 'Não foi possível excluir.') }
  }

  const contact = [
    c.phone ? <span key="p" className="inline-flex items-center gap-1 tabular-nums"><Phone className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />{fmtPhone(c.phone)}</span> : null,
    c.email ? <span key="e" className="inline-flex items-center gap-1 min-w-0"><Mail className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden /><span className="truncate">{c.email}</span></span> : null,
  ].filter(Boolean)

  return (
    <div aria-busy={loading || undefined}>
      <PageHead
        back={{ href: '/clinica/clientes', label: 'Clientes' }}
        title={c.name}
        sub={contact.length ? <span className="flex flex-wrap gap-x-4 gap-y-1">{contact}{c.petlife_linked && <Badge tone="good">No app PetLife</Badge>}</span> : c.petlife_linked ? <Badge tone="good">No app PetLife</Badge> : 'Sem telefone cadastrado'}
        actions={<>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-semibold bg-panel text-ink shadow-crm-card hover:bg-panel-2 transition-colors">
              <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden /> WhatsApp
            </a>
          )}
          <Btn variant="outline" icon={CalendarPlus} onClick={() => setAppt({ open: true, initial: null })}>Agendar</Btn>
          <Btn variant="outline" icon={ShoppingCart} onClick={() => router.push(`/clinica/caixa?client=${c.id}`)}>Nova venda</Btn>
          <Btn variant="primary" icon={Pencil} onClick={() => setEdit(true)}>Editar</Btn>
          {isAdmin && (
            <DropdownMenu ariaLabel="Mais ações" align="end"
              triggerClassName="h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink hover:bg-panel-2 transition-colors"
              trigger={<MoreHorizontal className="w-4 h-4" strokeWidth={1.75} aria-hidden />}
              items={[{ label: 'Excluir cliente', icon: Trash2, danger: true, onSelect: () => { void remove() } }]} />
          )}
        </>}
      />

      <div className="grid grid-cols-2 gap-3 mb-5 max-w-xl">
        <Kpi label="Em aberto" value={c.open_balance} format={brl} tone={c.open_balance > 0 ? 'bad' : 'default'} />
        <Kpi label="Total gasto" value={c.total_spent} format={brl} />
      </div>

      <section className="mb-6" aria-labelledby="pets-h">
        <h2 id="pets-h" className="text-2xs font-semibold uppercase tracking-wider text-muted mb-2">Pets</h2>
        <MotionList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {c.patients.map((p, i) => (
            <MotionItem key={p.id} index={i}>
              <Link href={`/clinica/pacientes/${p.id}`} className="block rounded-2xl h-full focus-visible:outline-none focus-visible:shadow-crm-glow">
                <Card interactive className="h-full">
                  <div className="flex items-start gap-3">
                    <PetAvatar name={p.name} species={p.species} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-semibold text-ink">
                        <span className="truncate">{p.name}</span>
                        {p.deceased && <Badge>Falecido</Badge>}
                      </p>
                      <p className="text-xs text-muted truncate">{[SPECIES[p.species] ?? p.species, p.breed].filter(Boolean).join(' · ')}</p>
                      <p className="text-xs text-muted tabular-nums mt-0.5">
                        {[ageFrom(p.birth_date), p.weight_kg != null ? `${String(p.weight_kg).replace('.', ',')} kg` : null].filter(Boolean).join(' · ') || ' '}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <AppState p={p} />
                        {p.allergies && <Badge tone="bad">Alergias</Badge>}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </MotionItem>
          ))}
          <MotionItem index={c.patients.length}>
            <button type="button" onClick={() => setNewPet(true)}
              className="w-full h-full min-h-[96px] rounded-2xl border-2 border-dashed border-line text-muted hover:text-primary-700 hover:border-primary-300 hover:bg-primary-50/50 dark:hover:text-primary-300 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/5 transition-colors inline-flex items-center justify-center gap-2 text-sm font-semibold">
              <Plus className="w-4 h-4" strokeWidth={1.75} aria-hidden /> Adicionar pet
            </button>
          </MotionItem>
        </MotionList>
      </section>

      <Card>
        <Tabs id="cli" value={tab} onChange={setTab} className="mb-3"
          tabs={[
            { value: 'appts', label: 'Atendimentos', count: c.appointments.length },
            { value: 'sales', label: 'Compras', count: c.sales.length },
            { value: 'notes', label: 'Observações' },
          ]} />
        {tab === 'appts' && (
          <ApptList appts={c.appointments} onOpen={a => setAppt({ open: true, initial: a })}
            emptyAction={<Btn size="sm" variant="soft" icon={CalendarPlus} onClick={() => setAppt({ open: true, initial: null })}>Agendar</Btn>} />
        )}
        {tab === 'sales' && <SalesList sales={c.sales} clientId={c.id} />}
        {tab === 'notes' && (
          c.notes?.trim()
            ? <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed py-2">{c.notes}</p>
            : <EmptyState icon={StickyNote} title="Sem observações" hint="Use Editar para anotar preferências do tutor." compact />
        )}
        {c.document || c.address ? (
          <dl className="mt-4 pt-3 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {c.document && <div><dt className="text-2xs font-semibold uppercase tracking-wider text-muted">CPF</dt><dd className="text-ink tabular-nums">{c.document}</dd></div>}
            {c.address && <div><dt className="text-2xs font-semibold uppercase tracking-wider text-muted">Endereço</dt><dd className="text-ink">{c.address}</dd></div>}
          </dl>
        ) : null}
      </Card>

      <p className="text-2xs text-muted mt-3">Cliente desde {fmtDate(c.created_at)}</p>

      <ClientModal open={edit} onClose={() => setEdit(false)} onSaved={() => reload()} initial={c} />
      <PatientModal open={newPet} onClose={() => setNewPet(false)} onSaved={() => reload()} clientId={c.id} />
      <ApptModal open={appt.open} onClose={() => setAppt({ open: false, initial: null })} onSaved={() => reload()} onDeleted={() => reload()}
        presetClient={c} initial={appt.initial} />
    </div>
  )
}

function SalesList({ sales, clientId }: { sales: Sale[]; clientId: number }) {
  const router = useRouter()
  if (!sales.length) {
    return <EmptyState icon={Receipt} title="Nenhuma compra ainda" compact
      action={<Btn size="sm" variant="soft" icon={ShoppingCart} onClick={() => router.push(`/clinica/caixa?client=${clientId}`)}>Nova venda</Btn>} />
  }
  return (
    <MotionList as="ul" className="divide-y divide-line">
      {sales.map((s, i) => {
        const st = SALE_STATUS[s.status] ?? { label: s.status, tone: 'default' as Tone }
        const desc = s.items?.length ? s.items.map(x => x.description).join(', ') : `Venda nº ${s.id}`
        return (
          <MotionItem as="li" key={s.id} index={i}>
            <Link href={`/clinica/caixa?sale=${s.id}`}
              className="flex items-center gap-3 min-h-14 md:min-h-11 py-1.5 px-1 rounded-lg hover:bg-panel-2/60 focus-visible:bg-panel-2/60 transition-colors">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink truncate">{desc}</span>
                <span className="block text-xs text-muted tabular-nums truncate">
                  {fmtDate(s.paid_at || s.created_at)}
                  {s.payment_method ? ` · ${PAY[s.payment_method] ?? s.payment_method}` : ''}
                  {s.status === 'aberta' && s.due_date ? ` · vence ${fmtDay(s.due_date)}` : ''}
                </span>
              </span>
              <Badge tone={st.tone}>{st.label}</Badge>
              <span className={`w-24 text-right text-sm font-semibold tabular-nums ${s.status === 'cancelada' ? 'text-muted line-through' : 'text-ink'}`}>{brl(s.total)}</span>
            </Link>
          </MotionItem>
        )
      })}
    </MotionList>
  )
}
