'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Copy, KeyRound, MoreHorizontal, Pencil, Trash2, UserPlus, Users, X } from 'lucide-react'
import { crm, type Member, type Role } from '@/lib/crmApi'
import { can, useCrm } from '@/components/crm/CrmShell'
import { Badge, Btn, Card, PageHead, ROLE, type Tone } from '@/components/crm/ui'
import { DataList, DropdownMenu, EmptyState, PersonAvatar, Tabs, useAsync, useConfirm, type Column } from '@/components/crm/kit'
import { dur } from '@/components/crm/motion'
import { AdminOnly, Section } from '@/components/crm/financeiro/shared'
import { MemberSheet, ROLE_HELP } from '@/components/crm/financeiro/MemberSheet'
import { CommissionsPanel } from '@/components/crm/financeiro/CommissionsPanel'
import { ClinicForm } from '@/components/crm/financeiro/ClinicForm'
import { useToast } from '@/components/ui/ToastContext'

type Tab = 'equipe' | 'comissoes' | 'clinica'
const HASH: Record<Tab, string> = { equipe: '', comissoes: '#comissoes', clinica: '#clinica' }
const ROLE_TONE: Record<Role, Tone> = { admin: 'brand', vet: 'info', recepcao: 'default', banho_tosa: 'warn' }

export default function EquipePage() {
  const { me } = useCrm()
  if (!can(me.user.role)) {
    return (
      <div>
        <PageHead title="Equipe e clínica" />
        <AdminOnly />
      </div>
    )
  }
  return <Equipe />
}

function Equipe() {
  const { error, success } = useToast()
  const { confirm } = useConfirm()
  const [tab, setTab] = useState<Tab>('equipe')
  const team = useAsync(() => crm.team(), [])
  const [sheet, setSheet] = useState<{ open: boolean; member: Member | null }>({ open: false, member: null })
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null)

  useEffect(() => {
    const read = () => {
      const h = window.location.hash
      setTab(h === '#comissoes' ? 'comissoes' : h === '#clinica' ? 'clinica' : 'equipe')
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  const changeTab = (t: Tab) => {
    setTab(t)
    try { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${HASH[t]}`) } catch { /* sem histórico */ }
  }

  async function remove(m: Member) {
    const ok = await confirm({
      title: `Remover ${m.name}?`,
      message: 'A pessoa perde o acesso ao PetLife Clínica desta clínica. Os atendimentos e vendas feitos por ela continuam no histórico.',
      confirmLabel: 'Remover', tone: 'danger',
    })
    if (!ok) return
    try { await crm.removeMember(m.id); success(`${m.name} saiu da equipe.`); team.reload() }
    catch (e) { error(e instanceof Error ? e.message : 'Não foi possível remover.') }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); success('Senha copiada.') }
    catch { error('Não foi possível copiar. Selecione e copie a senha.') }
  }

  const columns: Column<Member>[] = [
    {
      key: 'name', header: 'Pessoa', cell: m => (
        <span className="flex items-center gap-3 min-w-0">
          <PersonAvatar name={m.name} size="sm" />
          <span className="font-medium truncate">{m.name}</span>
          {m.is_me && <Badge tone="brand">Você</Badge>}
        </span>
      ),
    },
    { key: 'email', header: 'E-mail', cell: m => <span className="text-muted">{m.email}</span>, hideBelow: 'lg' },
    { key: 'role', header: 'Papel', cell: m => <Badge tone={ROLE_TONE[m.role] ?? 'default'}>{ROLE[m.role] ?? m.role}</Badge> },
    { key: 'crmv', header: 'CRMV', cell: m => <span className="tabular-nums text-muted">{m.crmv || '—'}</span> },
  ]

  const actions = (m: Member) => (
    <DropdownMenu ariaLabel={`Ações para ${m.name}`} align="end"
      triggerClassName="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-panel-2"
      trigger={<MoreHorizontal className="w-4 h-4" strokeWidth={1.75} />}
      items={[
        { label: 'Editar', icon: Pencil, onSelect: () => setSheet({ open: true, member: m }) },
        ...(m.is_me ? [] : ['separator' as const, { label: 'Remover da equipe', icon: Trash2, danger: true, onSelect: () => remove(m) }]),
      ]} />
  )

  return (
    <div>
      <PageHead title="Equipe e clínica" sub="Quem acessa o sistema, comissões e os dados que saem nos documentos."
        actions={tab === 'equipe' ? <Btn icon={UserPlus} onClick={() => setSheet({ open: true, member: null })}>Adicionar pessoa</Btn> : undefined} />

      <Tabs<Tab> id="equipe" value={tab} onChange={changeTab} className="mb-5"
        tabs={[
          { value: 'equipe', label: 'Equipe', count: team.data?.length },
          { value: 'comissoes', label: 'Comissões' },
          { value: 'clinica', label: 'Dados da clínica' },
        ]} />

      <AnimatePresence mode="wait" initial={false}>
        <m.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: dur.fast }}>
          {tab === 'equipe' && (
            <div className="space-y-4">
              <AnimatePresence>
                {created && (
                  <m.div key="pw" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: dur.base }}>
                    <Card className="ring-1 ring-amber-300 dark:ring-amber-500/40">
                      <div className="flex items-start gap-3">
                        <span className="h-9 w-9 shrink-0 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 inline-flex items-center justify-center">
                          <KeyRound className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">Senha provisória de {created.name}</p>
                          <p className="text-xs text-muted mt-0.5">Entrar com {created.email} na página de login do PetLife Clínica.</p>
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <code className="select-all rounded-lg bg-panel-2 px-3 h-9 inline-flex items-center font-mono text-sm text-ink tabular-nums">{created.password}</code>
                            <Btn size="sm" variant="outline" icon={Copy} onClick={() => copy(created.password)}>Copiar</Btn>
                          </div>
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mt-2">Anote agora: ela aparece só uma vez.</p>
                        </div>
                        <button type="button" onClick={() => setCreated(null)} aria-label="Fechar aviso da senha"
                          className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-panel-2">
                          <X className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    </Card>
                  </m.div>
                )}
              </AnimatePresence>

              <Section title="Equipe">
                <DataList<Member>
                  ariaLabel="Equipe"
                  rows={team.data}
                  loading={team.loading}
                  error={team.error}
                  onRetry={team.reload}
                  columns={columns}
                  rowKey={m => m.id}
                  rowActions={actions}
                  onRowClick={m => setSheet({ open: true, member: m })}
                  renderMobile={m => (
                    <div className="flex items-center gap-3 min-w-0">
                      <PersonAvatar name={m.name} />
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">{m.name}{m.is_me ? ' (você)' : ''}</p>
                        <p className="text-xs text-muted truncate">{ROLE[m.role] ?? m.role}{m.crmv ? ` · CRMV ${m.crmv}` : ''}</p>
                      </div>
                    </div>
                  )}
                  empty={<EmptyState icon={Users} compact title="Ninguém na equipe ainda" />}
                />
              </Section>

              <Section title="O que cada papel acessa">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(ROLE_HELP) as Role[]).map(r => (
                    <div key={r} className="rounded-xl bg-panel-2/60 px-3 py-2.5">
                      <dt><Badge tone={ROLE_TONE[r]}>{ROLE[r]}</Badge></dt>
                      <dd className="text-sm text-muted mt-1.5">{ROLE_HELP[r]}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            </div>
          )}
          {tab === 'comissoes' && <CommissionsPanel team={team.data} />}
          {tab === 'clinica' && <ClinicForm />}
        </m.div>
      </AnimatePresence>

      <MemberSheet open={sheet.open} member={sheet.member} onClose={() => setSheet(s => ({ ...s, open: false }))}
        onSaved={r => {
          team.reload()
          if (r?.temporary_password) setCreated({ name: r.name, email: r.email, password: r.temporary_password })
        }} />
    </div>
  )
}
