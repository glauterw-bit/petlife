'use client'

import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { crm, type CrmMe } from '@/lib/crmApi'
import { useCrm } from '@/components/crm/CrmShell'
import { Btn, Field, Input, Select } from '@/components/crm/ui'
import { useToast } from '@/components/ui/ToastContext'
import { Section } from './shared'

const BUSINESS: Array<[string, string]> = [
  ['clinica', 'Clínica veterinária'],
  ['petshop', 'Pet shop'],
  ['banho_tosa', 'Banho e tosa'],
  ['hospital', 'Hospital veterinário'],
  ['ambos', 'Clínica e pet shop'],
]
type Clinic = CrmMe['clinic']
type Form = { name: string; cnpj: string; phone: string; email: string; address: string; city: string; state: string; business_type: string }
const toForm = (c: Clinic): Form => ({
  name: c.name ?? '', cnpj: c.cnpj ?? '', phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '',
  city: c.city ?? '', state: c.state ?? '', business_type: c.business_type || 'clinica',
})

/** Dados da clínica usados no timbre de receitas, atestados e recibos. */
export function ClinicForm() {
  const { me, reload } = useCrm()
  const { error, success } = useToast()
  const [f, setF] = useState<Form>(() => toForm(me.clinic))
  const [errs, setErrs] = useState<Partial<Record<keyof Form, string>>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => { setF(toForm(me.clinic)) }, [me.clinic])
  const dirty = JSON.stringify(f) !== JSON.stringify(toForm(me.clinic))
  const set = (k: keyof Form) => (v: string) => { setF(p => ({ ...p, [k]: v })); setErrs(p => ({ ...p, [k]: undefined })) }

  async function save() {
    if (busy) return
    const e: Partial<Record<keyof Form, string>> = {}
    if (!f.name.trim()) e.name = 'Informe o nome da clínica.'
    if (f.state && !/^[A-Za-z]{2}$/.test(f.state.trim())) e.state = 'Use a sigla com 2 letras.'
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'E-mail inválido.'
    setErrs(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await crm.updateClinic({
        name: f.name.trim(), cnpj: f.cnpj.trim(), phone: f.phone.trim(), email: f.email.trim(), address: f.address.trim(),
        city: f.city.trim(), state: f.state.trim().toUpperCase(), business_type: f.business_type,
      })
      success('Dados da clínica salvos.')
      reload()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível salvar.'
      if (/cnpj/i.test(msg)) setErrs({ cnpj: msg })
      else if (/nome/i.test(msg)) setErrs({ name: msg })
      else error(msg)
    } finally {
      setBusy(false)
    }
  }

  const has = new Set(BUSINESS.map(b => b[0]))
  return (
    <Section title="Dados da clínica" sub="Esses dados saem no timbre das receitas, atestados, termos e recibos.">
      <form className="space-y-4 max-w-3xl" onSubmit={ev => { ev.preventDefault(); save() }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome" error={errs.name}><Input value={f.name} onChange={e => set('name')(e.target.value)} maxLength={200} required /></Field>
          <Field label="Tipo de negócio">
            <Select value={f.business_type} onChange={e => set('business_type')(e.target.value)}>
              {BUSINESS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {!has.has(f.business_type) && <option value={f.business_type}>{f.business_type}</option>}
            </Select>
          </Field>
          <Field label="CNPJ" error={errs.cnpj}><Input value={f.cnpj} onChange={e => set('cnpj')(e.target.value)} inputMode="numeric" maxLength={20} placeholder="00.000.000/0000-00" /></Field>
          <Field label="Telefone"><Input value={f.phone} onChange={e => set('phone')(e.target.value)} inputMode="tel" maxLength={20} placeholder="(11) 99999-9999" /></Field>
          <Field label="E-mail" error={errs.email} className="sm:col-span-2"><Input type="email" value={f.email} onChange={e => set('email')(e.target.value)} maxLength={200} /></Field>
          <Field label="Endereço" className="sm:col-span-2"><Input value={f.address} onChange={e => set('address')(e.target.value)} maxLength={500} placeholder="Rua, número, bairro" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4">
          <Field label="Cidade"><Input value={f.city} onChange={e => set('city')(e.target.value)} maxLength={100} /></Field>
          <Field label="UF" error={errs.state}><Input value={f.state} onChange={e => set('state')(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} maxLength={2} placeholder="SP" /></Field>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted"><FileText className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />Mostramos só os campos preenchidos no timbre.</p>
          <div className="flex gap-2">
            {dirty && <Btn variant="ghost" onClick={() => { setF(toForm(me.clinic)); setErrs({}) }}>Descartar</Btn>}
            <Btn type="submit" loading={busy} disabled={!dirty}>Salvar</Btn>
          </div>
        </div>
      </form>
    </Section>
  )
}
