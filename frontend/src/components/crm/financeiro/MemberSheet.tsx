'use client'

import { useEffect, useState } from 'react'
import { crm, type Member, type Role } from '@/lib/crmApi'
import { Btn, Field, Input, ROLE, Select } from '@/components/crm/ui'
import { Sheet } from '@/components/crm/kit'
import { useToast } from '@/components/ui/ToastContext'

export const ROLE_HELP: Record<Role, string> = {
  admin: 'Tudo, inclusive financeiro, relatórios, equipe e dados da clínica.',
  vet: 'Agenda, clientes, prontuário, receitas, vacinas e caixa.',
  recepcao: 'Agenda, recepção, clientes, caixa, estoque e lembretes.',
  banho_tosa: 'Agenda, fila do banho e tosa, ficha de banho e caixa.',
}
const ROLES = Object.keys(ROLE) as Role[]

/** Adicionar pessoa à equipe ou editar papel e CRMV. */
export function MemberSheet({ open, onClose, member, onSaved }: {
  open: boolean; onClose: () => void; member: Member | null
  onSaved: (r: { temporary_password: string | null; name: string; email: string } | null) => void
}) {
  const { error, success } = useToast()
  const editing = !!member
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('recepcao')
  const [crmv, setCrmv] = useState('')
  const [password, setPassword] = useState('')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrs({}); setPassword('')
    setName(member?.name ?? ''); setEmail(member?.email ?? '')
    setRole(member?.role ?? 'recepcao'); setCrmv(member?.crmv ?? '')
  }, [open, member])

  async function save() {
    if (busy) return
    const e: Record<string, string> = {}
    if (!editing) {
      if (name.trim().length < 2) e.name = 'Informe o nome.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Informe um e-mail válido.'
      if (password && password.length < 6) e.password = 'A senha precisa ter pelo menos 6 caracteres.'
    }
    setErrs(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      if (editing && member) {
        await crm.patchMember(member.id, { ...(member.is_me ? {} : { role }), crmv: crmv.trim() })
        success('Dados atualizados.')
        onSaved(null)
      } else {
        const r = await crm.addMember({
          name: name.trim(), email: email.trim(), role, password: password || undefined,
          crmv: role === 'vet' && crmv.trim() ? crmv.trim() : undefined,
        })
        success('Pessoa adicionada à equipe.')
        onSaved({ temporary_password: r.temporary_password, name: name.trim(), email: email.trim().toLowerCase() })
      }
      onClose()
    } catch (err) {
      error(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} onSubmit={save}
      title={editing ? `Editar ${member?.name}` : 'Adicionar pessoa'}
      description={editing ? member?.email : 'Se o e-mail ainda não tiver conta, o acesso é criado agora.'}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} loading={busy}>{editing ? 'Salvar' : 'Adicionar'}</Btn></>}>
      <div className="space-y-4">
        {!editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome" error={errs.name}>
              <Input value={name} onChange={ev => setName(ev.target.value)} autoComplete="off" maxLength={200} />
            </Field>
            <Field label="E-mail" error={errs.email}>
              <Input type="email" value={email} onChange={ev => setEmail(ev.target.value)} autoComplete="off" maxLength={200} />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Papel" hint={member?.is_me ? 'Você não pode mudar o seu próprio papel.' : ROLE_HELP[role]}>
            <Select value={role} disabled={!!member?.is_me} onChange={ev => setRole(ev.target.value as Role)}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE[r]}</option>)}
            </Select>
          </Field>
          {(role === 'vet' || role === 'admin' || !!crmv) && (
            <Field label="CRMV" hint="Sai nas receitas e atestados.">
              <Input value={crmv} onChange={ev => setCrmv(ev.target.value)} placeholder="Ex.: SP 12345" maxLength={50} />
            </Field>
          )}
        </div>
        {!editing && (
          <Field label="Senha inicial (opcional)" error={errs.password} hint="Deixe vazio para gerar uma senha provisória.">
            <Input type="text" value={password} onChange={ev => setPassword(ev.target.value)} autoComplete="new-password" maxLength={100} />
          </Field>
        )}
      </div>
    </Sheet>
  )
}
