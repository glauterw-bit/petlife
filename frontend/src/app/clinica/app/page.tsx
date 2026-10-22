'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Link2, MailOpen, MessageCircle, Smartphone } from 'lucide-react'
import { crm, type AppPet, type Invite } from '@/lib/crmApi'
import { useCrm, useCrmChange, emitCrmChange } from '@/components/crm/CrmShell'
import { Badge, Btn, Card, PageHead, SPECIES, fmtDate, fmtPhone, waLink, type Tone } from '@/components/crm/ui'
import { DataList, EmptyState, PetAvatar, useAsync, type Column } from '@/components/crm/kit'
import { useToast } from '@/components/ui/ToastContext'
import { errMsg, firstName } from '@/components/crm/painel/shared'

const INVITE_STATUS: Record<Invite['status'], { label: string; tone: Tone }> = {
  pendente: { label: 'Pendente', tone: 'warn' },
  aceito: { label: 'Aceito', tone: 'good' },
  expirado: { label: 'Expirado', tone: 'default' },
}

export default function ClientesDoApp() {
  const { me } = useCrm()
  const router = useRouter()
  const toast = useToast()
  const invites = useAsync(() => crm.invites(), [])
  const pets = useAsync(() => crm.appPatients(), [])
  useCrmChange(['patient'], () => { invites.reload(); pets.reload() })
  const [busyInvite, setBusyInvite] = useState<number | null>(null)
  const [busyPet, setBusyPet] = useState<number | null>(null)

  const inviteText = (inv: Invite, url: string) =>
    `Olá, ${firstName(inv.client_name)}! A ${me.clinic.name} quer registrar as vacinas de ${inv.patient_name} na carteirinha do app PetLife, com lembrete no seu celular. É grátis. Para autorizar, toque no link: ${url}`

  async function freshUrl(inv: Invite) {
    const r = await crm.invitePatient(inv.patient_id)
    return `${window.location.origin}${r.path}`
  }

  async function resend(inv: Invite) {
    // abre a aba já no clique para o navegador não bloquear
    const w = window.open('about:blank', '_blank')
    setBusyInvite(inv.id)
    try {
      const url = await freshUrl(inv)
      const wa = waLink(inv.client_phone, inviteText(inv, url))
      if (!wa) throw new Error('Este cliente não tem celular cadastrado.')
      if (w) w.location.href = wa
      else window.open(wa, '_blank', 'noopener,noreferrer')
      invites.reload()
    } catch (e) {
      w?.close()
      toast.error(errMsg(e, 'Não foi possível gerar o convite.'))
    } finally {
      setBusyInvite(null)
    }
  }

  async function copyLink(inv: Invite) {
    setBusyInvite(inv.id)
    try {
      const url = await freshUrl(inv)
      await navigator.clipboard.writeText(url)
      toast.success('Link do convite copiado.')
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível copiar o link.'))
    } finally {
      setBusyInvite(null)
    }
  }

  async function importPet(p: AppPet) {
    setBusyPet(p.pet_id)
    try {
      const r = await crm.importAppPatient(p.pet_id)
      toast.success(r.already ? `${p.pet_name} já era paciente.` : `${p.pet_name} agora é paciente da clínica.`)
      emitCrmChange('patient')
      router.push(`/clinica/pacientes/${r.patient_id}`)
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível importar.'))
      setBusyPet(null)
    }
  }

  const inviteActions = (inv: Invite) => inv.status !== 'pendente' ? null : (
    <span className="inline-flex gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
      <Btn size="sm" variant="soft" icon={MessageCircle} loading={busyInvite === inv.id} disabled={!inv.client_phone || busyInvite != null}
        title={inv.client_phone ? undefined : 'Sem celular cadastrado'} onClick={() => resend(inv)}>
        Reenviar no WhatsApp
      </Btn>
      <Btn size="sm" variant="ghost" icon={Link2} disabled={busyInvite != null} onClick={() => copyLink(inv)} aria-label="Copiar link do convite" title="Copiar link">
        <span className="sr-only sm:not-sr-only">Copiar link</span>
      </Btn>
    </span>
  )

  const inviteCols: Column<Invite>[] = [
    {
      key: 'pet', header: 'Pet', cell: i => (
        <span className="inline-flex items-center gap-2.5 min-w-0">
          <PetAvatar name={i.patient_name} size="sm" />
          <span className="font-semibold truncate">{i.patient_name}</span>
        </span>
      ),
    },
    {
      key: 'tutor', header: 'Tutor', cell: i => (
        <span className="block min-w-0">
          <span className="block truncate">{i.client_name}</span>
          {i.client_phone && <span className="block text-xs text-muted tabular-nums">{fmtPhone(i.client_phone)}</span>}
        </span>
      ),
    },
    { key: 'sent', header: 'Enviado em', hideBelow: 'lg', cell: i => <span className="tabular-nums">{fmtDate(i.created_at)}</span> },
    {
      key: 'exp', header: 'Validade', cell: i => (
        <span className="tabular-nums">{i.status === 'aceito' && i.used_at ? <span className="text-muted">aceito em {fmtDate(i.used_at)}</span> : fmtDate(i.expires_at)}</span>
      ),
    },
    { key: 'status', header: 'Situação', cell: i => <Badge tone={INVITE_STATUS[i.status].tone}>{INVITE_STATUS[i.status].label}</Badge> },
    { key: 'actions', header: '', align: 'right', cell: i => inviteActions(i) },
  ]

  const petCols: Column<AppPet>[] = [
    {
      key: 'pet', header: 'Pet', cell: p => (
        <span className="inline-flex items-center gap-2.5 min-w-0">
          <PetAvatar name={p.pet_name} species={p.species} size="sm" />
          <span className="min-w-0">
            <span className="block font-semibold truncate">{p.pet_name}</span>
            <span className="block text-xs text-muted">{SPECIES[p.species] ?? 'Pet'}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'owner', header: 'Tutor', cell: p => (
        <span className="block min-w-0">
          <span className="block truncate">{p.owner_name}</span>
          <span className="block text-xs text-muted truncate tabular-nums">{p.owner_phone ? fmtPhone(p.owner_phone) : p.owner_email}</span>
        </span>
      ),
    },
    { key: 'granted', header: 'Liberado em', hideBelow: 'lg', cell: p => <span className="tabular-nums">{fmtDate(p.granted_at)}</span> },
    {
      key: 'act', header: '', align: 'right', cell: p => p.imported
        ? <Badge tone="good">Já é paciente</Badge>
        : <Btn size="sm" icon={Download} loading={busyPet === p.pet_id} disabled={busyPet != null} onClick={() => importPet(p)}>Importar como paciente</Btn>,
    },
  ]

  const pending = (invites.data ?? []).filter(i => i.status === 'pendente').length

  return (
    <div>
      <PageHead title="Clientes do app" sub="Tutores que ligaram o pet da clínica ao app PetLife" />

      <Card className="mb-4">
        <div className="flex gap-3">
          <span className="h-10 w-10 shrink-0 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 inline-flex items-center justify-center">
            <Smartphone className="w-5 h-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Como funciona</p>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              Na ficha do pet, toque em &lsquo;Convidar para o app&rsquo;. O tutor recebe um link, entra no PetLife (grátis para iPhone e Android) e autoriza.
              A partir daí, as vacinas registradas aqui vão para a carteirinha dele, com lembrete no celular. O tutor pode retirar o acesso quando quiser.
            </p>
          </div>
        </div>
      </Card>

      <section className="mb-6" aria-labelledby="sec-invites">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h2 id="sec-invites" className="font-bold text-ink">Convites</h2>
          {pending > 0 && <span className="text-xs text-muted tabular-nums">{pending} {pending === 1 ? 'pendente' : 'pendentes'}</span>}
        </div>
        <Card>
          <DataList
            ariaLabel="Convites enviados"
            rows={invites.data}
            loading={invites.loading}
            error={invites.error}
            onRetry={invites.reload}
            columns={inviteCols}
            rowKey={i => i.id}
            onRowClick={i => router.push(`/clinica/pacientes/${i.patient_id}`)}
            renderMobile={i => (
              <div className="flex items-start gap-3">
                <PetAvatar name={i.patient_name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink truncate">{i.patient_name}</p>
                    <Badge tone={INVITE_STATUS[i.status].tone}>{INVITE_STATUS[i.status].label}</Badge>
                  </div>
                  <p className="text-xs text-muted truncate">{i.client_name} · enviado em {fmtDate(i.created_at)}</p>
                  {i.status === 'pendente' && <div className="mt-2">{inviteActions(i)}</div>}
                </div>
              </div>
            )}
            empty={<EmptyState icon={MailOpen} compact title="Nenhum convite ainda." hint="Abra a ficha de um pet e toque em Convidar para o app." />}
          />
        </Card>
      </section>

      <section aria-labelledby="sec-pets">
        <h2 id="sec-pets" className="font-bold text-ink mb-2">Pets liberados pelo app</h2>
        <Card>
          <DataList
            ariaLabel="Pets liberados pelo app"
            rows={pets.data}
            loading={pets.loading}
            error={pets.error}
            onRetry={pets.reload}
            columns={petCols}
            rowKey={p => p.pet_id}
            renderMobile={p => (
              <div className="flex items-start gap-3">
                <PetAvatar name={p.pet_name} species={p.species} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">{p.pet_name}</p>
                  <p className="text-xs text-muted truncate">{p.owner_name} · liberado em {fmtDate(p.granted_at)}</p>
                  <div className="mt-2">
                    {p.imported
                      ? <Badge tone="good">Já é paciente</Badge>
                      : <Btn size="sm" icon={Download} loading={busyPet === p.pet_id} disabled={busyPet != null} onClick={() => importPet(p)}>Importar como paciente</Btn>}
                  </div>
                </div>
              </div>
            )}
            empty={<EmptyState icon={Smartphone} compact title="Nenhum pet liberado ainda." hint="Quando um tutor aceitar o convite ou liberar o pet para a clínica no app, ele aparece aqui." />}
          />
        </Card>
      </section>
    </div>
  )
}
