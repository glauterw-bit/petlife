'use client'

import { useEffect, useState } from 'react'
import { crm, type Member, type Role } from '@/lib/crmApi'
import { useCrm } from '@/components/crm/CrmShell'
import { Card, PageHead, Btn, Field, Input, Select, Empty, ROLE } from '@/components/crm/ui'
import { useToast } from '@/components/ui/ToastContext'

export default function Equipe() {
  const { me, reload } = useCrm()
  const { error, success } = useToast()
  const [team, setTeam] = useState<Member[]>([])
  const [n, setN] = useState({ name: '', email: '', password: '', role: 'recepcao' as Role, crmv: '' })
  const [cl, setCl] = useState(me.clinic)
  const [pw, setPw] = useState<string | null>(null)
  const load = () => crm.team().then(setTeam).catch(e => error(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!n.name.trim() || !n.email.includes('@')) { error('Informe nome e e-mail.'); return }
    try {
      const r = await crm.addMember({ name: n.name.trim(), email: n.email.trim(), password: n.password || undefined, role: n.role, crmv: n.crmv || undefined })
      setPw(r.temporary_password); success('Pessoa adicionada à equipe.'); setN({ name: '', email: '', password: '', role: 'recepcao', crmv: '' }); load()
    } catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }
  async function saveClinic() {
    try { await crm.updateClinic(cl); success('Dados da clínica salvos.'); reload() } catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }
  return (
    <div>
      <PageHead title="Equipe e clínica" />
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-bold text-surface-900 dark:text-white mb-3">Equipe</h2>
          {team.length === 0 ? <Empty>—</Empty> : team.map(m => (
            <div key={m.id} className="flex items-center gap-2 py-2 border-b border-surface-50 dark:border-surface-700/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{m.name}{m.is_me ? ' (você)' : ''}</p>
                <p className="text-xs text-surface-500 truncate">{m.email}{m.crmv ? ` · CRMV ${m.crmv}` : ''}</p>
              </div>
              <Select className="!w-auto !py-1 text-xs" value={m.role} disabled={m.is_me} onChange={e => crm.patchMember(m.id, { role: e.target.value as Role }).then(load).catch(er => error(er.message))}>
                {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              {!m.is_me && <button className="text-xs text-red-500" onClick={() => confirm(`Remover ${m.name} da equipe?`) && crm.removeMember(m.id).then(load)}>remover</button>}
            </div>
          ))}
          <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-700 space-y-2">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">Adicionar pessoa</p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nome" value={n.name} onChange={e => setN({ ...n, name: e.target.value })} />
              <Input placeholder="E-mail" type="email" value={n.email} onChange={e => setN({ ...n, email: e.target.value })} />
              <Select value={n.role} onChange={e => setN({ ...n, role: e.target.value as Role })}>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
              <Input placeholder="CRMV (vet)" value={n.crmv} onChange={e => setN({ ...n, crmv: e.target.value })} />
              <Input placeholder="Senha inicial (opcional)" value={n.password} onChange={e => setN({ ...n, password: e.target.value })} className="col-span-2" />
            </div>
            <Btn onClick={add}>Adicionar</Btn>
            {pw && <p className="text-xs text-emerald-700 dark:text-emerald-300">Senha provisória gerada: <b className="font-mono">{pw}</b> — envie à pessoa. Ela entra em <b>/vet/login</b>.</p>}
            <p className="text-[11px] text-surface-500">Recepção: agenda, clientes e caixa. Veterinário(a): + prontuário. Banho e tosa: agenda e registros de banho/tosa. Financeiro e equipe: só administrador.</p>
          </div>
        </Card>
        <Card>
          <h2 className="font-bold text-surface-900 dark:text-white mb-3">Dados da clínica</h2>
          <div className="space-y-3">
            <Field label="Nome"><Input value={cl.name ?? ''} onChange={e => setCl({ ...cl, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de negócio"><Select value={cl.business_type} onChange={e => setCl({ ...cl, business_type: e.target.value })}>
                <option value="clinica">Clínica veterinária</option><option value="petshop">Pet shop / banho e tosa</option><option value="ambos">Clínica + pet shop</option>
              </Select></Field>
              <Field label="CNPJ"><Input value={cl.cnpj ?? ''} onChange={e => setCl({ ...cl, cnpj: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={cl.phone ?? ''} onChange={e => setCl({ ...cl, phone: e.target.value })} /></Field>
              <Field label="E-mail"><Input value={cl.email ?? ''} onChange={e => setCl({ ...cl, email: e.target.value })} /></Field>
            </div>
            <Field label="Endereço"><Input value={cl.address ?? ''} onChange={e => setCl({ ...cl, address: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Cidade" className="col-span-2"><Input value={cl.city ?? ''} onChange={e => setCl({ ...cl, city: e.target.value })} /></Field>
              <Field label="UF"><Input maxLength={2} value={cl.state ?? ''} onChange={e => setCl({ ...cl, state: e.target.value.toUpperCase() })} /></Field>
            </div>
            <Btn onClick={saveClinic}>Salvar</Btn>
          </div>
        </Card>
      </div>
    </div>
  )
}
