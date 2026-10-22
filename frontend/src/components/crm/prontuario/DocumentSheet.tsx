'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Eye, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastContext'
import { crm, type Client, type Patient } from '@/lib/crmApi'
import { Btn, Field, Input, Select, TextArea, SPECIES, ageFrom, ymd } from '@/components/crm/ui'
import { Sheet, Segmented, Switch, PrintDoc, Letterhead, SignatureLine } from '@/components/crm/kit'
import { useCrm, can, emitCrmChange } from '@/components/crm/CrmShell'

type DocKind = 'receita' | 'controle' | 'atestado' | 'consentimento' | 'eutanasia'
const DOCS: Array<{ value: DocKind; label: string; title: string }> = [
  { value: 'receita', label: 'Receita', title: 'Receita' },
  { value: 'controle', label: 'Controle especial', title: 'Receita de controle especial' },
  { value: 'atestado', label: 'Atestado', title: 'Atestado de saúde' },
  { value: 'consentimento', label: 'Consentimento', title: 'Termo de consentimento' },
  { value: 'eutanasia', label: 'Eutanásia', title: 'Termo de autorização de eutanásia' },
]
type RxItem = { med: string; conc: string; qty: string; dose: string }
const blankItem = (): RxItem => ({ med: '', conc: '', qty: '', dose: '' })
const PURPOSE: Record<string, string> = { viagem: 'viagem', hospedagem: 'hospedagem', outro: 'apresentação a quem interessar' }

const atestadoBase = (purpose: string) =>
  `Atesto, para fins de ${PURPOSE[purpose] ?? purpose}, que examinei nesta data o animal acima identificado e que, ao exame clínico, ele não apresenta sinais aparentes de doenças infectocontagiosas ou parasitárias, estando apto para ${purpose === 'viagem' ? 'viajar' : purpose === 'hospedagem' ? 'hospedagem' : 'o fim declarado'}.`
const consentBase = 'Fui informado(a) sobre o procedimento indicado, os cuidados antes e depois dele e os riscos envolvidos, incluindo os riscos da anestesia, e tive a oportunidade de tirar minhas dúvidas.'
const eutanasiaBase = 'Fui informado(a) sobre o estado de saúde do animal, sobre as alternativas possíveis e sobre a indicação do procedimento, e tive a oportunidade de tirar minhas dúvidas.'

function longDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Receitas, atestado e termos com prévia de impressão. Textos-base genéricos: o profissional revisa. */
export function DocumentSheet({ open, onClose, patient, client }: { open: boolean; onClose: () => void; patient: Patient; client: Client | null }) {
  const { me } = useCrm()
  const { success, error } = useToast()
  const [kind, setKind] = useState<DocKind>('receita')
  const [items, setItems] = useState<RxItem[]>([blankItem()])
  const [notes, setNotes] = useState('')
  const [purpose, setPurpose] = useState('viagem')
  const [atText, setAtText] = useState(atestadoBase('viagem'))
  const [procedure, setProcedure] = useState('')
  const [risks, setRisks] = useState(consentBase)
  const [place, setPlace] = useState('')
  const [date, setDate] = useState(ymd(new Date()))
  const [crmv, setCrmv] = useState('')
  const [save, setSave] = useState(true)
  const [preview, setPreview] = useState(false)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const savedText = useRef<string | null>(null)
  const canSave = can(me.user.role, 'vet')

  useEffect(() => {
    if (!open) return
    setKind('receita'); setItems([blankItem()]); setNotes(''); setPurpose('viagem'); setAtText(atestadoBase('viagem'))
    setProcedure(''); setRisks(consentBase); setPlace(me.clinic.city ?? ''); setDate(ymd(new Date()))
    setCrmv(''); setSave(true); setErrs({}); savedText.current = null
  }, [open, me.clinic.city])

  const changeKind = (k: DocKind) => {
    setKind(k)
    setErrs({})
    setSave(k === 'receita' || k === 'controle')
    if (k === 'eutanasia') { setProcedure('Eutanásia'); setRisks(r => (r === consentBase ? eutanasiaBase : r)) }
    else if (k === 'consentimento') { setProcedure(p => (p === 'Eutanásia' ? '' : p)); setRisks(r => (r === eutanasiaBase ? consentBase : r)) }
  }
  const changePurpose = (p: string) => {
    setPurpose(p)
    setAtText(t => (t === atestadoBase(purpose) ? atestadoBase(p) : t))
  }

  const isRx = kind === 'receita' || kind === 'controle'
  const isTerm = kind === 'consentimento' || kind === 'eutanasia'
  const doc = DOCS.find(d => d.value === kind)!
  const rx = items.filter(i => i.med.trim())
  const proCrmv = me.user.crmv || crmv.trim() || null
  const where = `${place.trim() ? `${place.trim()}, ` : ''}${longDate(date)}`
  const tutor = client?.name ?? ''
  const sex = patient.sex === 'male' ? 'Macho' : patient.sex === 'female' ? 'Fêmea' : null

  function textBody(): string {
    const lines: string[] = [doc.title]
    if (isRx) {
      rx.forEach((i, n) => {
        lines.push(`${n + 1}. ${[i.med.trim(), i.conc.trim()].filter(Boolean).join(' ')}${i.qty.trim() ? ` — ${i.qty.trim()}` : ''}`)
        if (i.dose.trim()) lines.push(`   ${i.dose.trim()}`)
      })
      if (notes.trim()) lines.push('', notes.trim())
    } else if (kind === 'atestado') {
      lines.push(atText.trim())
    } else {
      lines.push(`Procedimento: ${procedure.trim()}`, risks.trim())
    }
    lines.push('', where)
    return lines.join('\n')
  }

  function openPreview() {
    const ne: Record<string, string> = {}
    if (isRx && !rx.length) ne.items = 'Inclua pelo menos um medicamento.'
    if (isTerm && !procedure.trim()) ne.procedure = 'Informe o procedimento.'
    if (kind === 'atestado' && !atText.trim()) ne.atText = 'Escreva o texto do atestado.'
    setErrs(ne)
    if (Object.keys(ne).length) return
    setPreview(true)
  }

  // grava no prontuário ao imprimir (uma vez por versão do texto)
  const saveRef = useRef<() => void>(() => {})
  saveRef.current = () => {
    if (!save || !canSave) return
    const body = textBody()
    if (savedText.current === body) return
    savedText.current = body
    crm.addRecord(patient.id, {
      kind: isRx ? 'prescricao' : 'observacao',
      title: isTerm ? `${doc.title}: ${procedure.trim()}` : doc.title,
      body, performed_at: `${date}T12:00:00`,
    }).then(() => { success('Documento salvo no prontuário.'); emitCrmChange('record') })
      .catch(e => { savedText.current = null; error(e instanceof Error ? e.message : 'Não foi possível salvar no prontuário.') })
  }
  useEffect(() => {
    if (!preview) return
    const h = () => saveRef.current()
    window.addEventListener('beforeprint', h)
    return () => window.removeEventListener('beforeprint', h)
  }, [preview])

  const setItem = (i: number, k: keyof RxItem, v: string) => setItems(xs => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  /* ── prévia ── */
  const Identification = () => (
    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[13px] mb-5">
      <p><strong>Tutor(a):</strong> {tutor || '______________________'}</p>
      <p><strong>CPF:</strong> {client?.document || '______________________'}</p>
      <p><strong>Animal:</strong> {patient.name}</p>
      <p><strong>Espécie:</strong> {SPECIES[patient.species] ?? patient.species}{patient.breed ? ` · ${patient.breed}` : ''}</p>
      <p><strong>Sexo:</strong> {sex ?? 'Não informado'}</p>
      <p><strong>Idade:</strong> {ageFrom(patient.birth_date) || 'Não informada'}</p>
      <p><strong>Peso:</strong> {patient.weight_kg != null ? `${String(patient.weight_kg).replace('.', ',')} kg` : 'Não informado'}</p>
      {patient.microchip && <p><strong>Microchip:</strong> {patient.microchip}</p>}
    </div>
  )
  const vetSign = <SignatureLine label={me.user.name} sub={proCrmv ? `Médico(a)-veterinário(a) · CRMV ${proCrmv}` : 'Médico(a)-veterinário(a)'} />
  const Page = ({ children, via }: { children: ReactNode; via?: string }) => (
    <section className="text-black">
      <Letterhead clinic={me.clinic} professional={{ name: me.user.name, crmv: proCrmv }} />
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h2 className="text-base font-bold uppercase tracking-wide">{doc.title}</h2>
        {via && <span className="text-xs font-semibold">{via}</span>}
      </div>
      <Identification />
      {children}
      <p className="mt-8 text-[13px]">{where}.</p>
      {vetSign}
    </section>
  )
  const RxList = () => (
    <div className="text-[13px]">
      <p className="text-xs font-semibold uppercase mb-2">Uso veterinário</p>
      <ol className="space-y-3">
        {rx.map((i, n) => (
          <li key={n}>
            <p className="font-semibold">{n + 1}. {[i.med.trim(), i.conc.trim()].filter(Boolean).join(' ')}
              {i.qty.trim() && <span className="font-normal"> — {i.qty.trim()}</span>}</p>
            {i.dose.trim() && <p className="ml-4 whitespace-pre-wrap">{i.dose.trim()}</p>}
          </li>
        ))}
      </ol>
      {notes.trim() && <p className="mt-4 whitespace-pre-wrap">{notes.trim()}</p>}
    </div>
  )
  const Blank = ({ label }: { label: string }) => (
    <p className="flex gap-2 text-[12px] mt-2"><span className="shrink-0">{label}:</span><span className="flex-1 border-b border-black" /></p>
  )
  const BuyerSupplier = () => (
    <div className="grid grid-cols-2 gap-6 mt-8">
      <div className="border border-black p-3">
        <p className="text-xs font-bold uppercase">Identificação do comprador</p>
        <Blank label="Nome" /><Blank label="RG" /><Blank label="Endereço" /><Blank label="Cidade/UF" /><Blank label="Telefone" />
      </div>
      <div className="border border-black p-3">
        <p className="text-xs font-bold uppercase">Identificação do fornecedor</p>
        <Blank label="Farmacêutico(a)" /><Blank label="CRF" /><Blank label="Data" /><Blank label="Assinatura" />
      </div>
    </div>
  )

  let printable: ReactNode
  if (kind === 'receita') printable = <Page><RxList /></Page>
  else if (kind === 'controle') {
    printable = (
      <>
        <div className="crm-print-break"><Page via="1ª via – Farmácia"><RxList /><BuyerSupplier /></Page></div>
        <div className="mt-10 pt-10 border-t border-dashed border-black/40 print:mt-0 print:pt-0 print:border-0">
          <Page via="2ª via – Tutor"><RxList /><BuyerSupplier /></Page>
        </div>
      </>
    )
  } else if (kind === 'atestado') printable = <Page><p className="text-[13px] leading-relaxed whitespace-pre-wrap">{atText.trim()}</p></Page>
  else {
    printable = (
      <section className="text-black">
        <Letterhead clinic={me.clinic} professional={{ name: me.user.name, crmv: proCrmv }} />
        <h2 className="text-base font-bold uppercase tracking-wide mb-4">{doc.title}</h2>
        <Identification />
        <div className="text-[13px] leading-relaxed space-y-3">
          <p>
            Eu, {tutor || '______________________________'}, CPF ______________________, tutor(a) responsável pelo animal acima identificado,
            {kind === 'eutanasia'
              ? ' autorizo a realização de eutanásia pelo(a) médico(a)-veterinário(a) abaixo identificado(a).'
              : <> autorizo a realização do procedimento <strong>{procedure.trim()}</strong> pela equipe da {me.clinic.name}.</>}
          </p>
          <p className="whitespace-pre-wrap">{risks.trim()}</p>
          {kind === 'eutanasia' && <p>Destino do corpo: ____________________________________________</p>}
        </div>
        <p className="mt-8 text-[13px]">{where}.</p>
        <div className="grid grid-cols-2 gap-8">
          <SignatureLine label="Tutor(a) responsável" sub={`Nome: ${tutor || '____________________'} · CPF: ______________`} />
          {vetSign}
        </div>
      </section>
    )
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} onSubmit={openPreview} size="lg" title={`Documento · ${patient.name}`}
        description="Textos-base genéricos. Revise antes de imprimir."
        footer={<>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn icon={Eye} onClick={openPreview}>Ver e imprimir</Btn>
        </>}>
        <div className="space-y-4">
          <Segmented id="doc-kind" ariaLabel="Tipo de documento" size="sm" value={kind} onChange={changeKind}
            options={DOCS.map(d => ({ value: d.value, label: d.label }))} />

          {isRx && (
            <div className="space-y-3">
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted">Medicamentos</p>
              {items.map((it, i) => (
                <div key={i} className="rounded-xl bg-panel-2/70 p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Medicamento" className="sm:col-span-2"><Input value={it.med} onChange={e => setItem(i, 'med', e.target.value)} placeholder="Ex.: Amoxicilina" data-autofocus={i === 0 ? true : undefined} /></Field>
                    <Field label="Concentração"><Input value={it.conc} onChange={e => setItem(i, 'conc', e.target.value)} placeholder="Ex.: 250 mg" /></Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Quantidade"><Input value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} placeholder="Ex.: 1 caixa" /></Field>
                    <Field label="Posologia" className="sm:col-span-2"><Input value={it.dose} onChange={e => setItem(i, 'dose', e.target.value)} placeholder="Ex.: 1 comprimido a cada 12 horas por 7 dias" /></Field>
                  </div>
                  {items.length > 1 && (
                    <div className="flex justify-end">
                      <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => setItems(xs => xs.filter((_, j) => j !== i))}>Remover</Btn>
                    </div>
                  )}
                </div>
              ))}
              {errs.items && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{errs.items}</p>}
              <Btn size="sm" variant="soft" icon={Plus} onClick={() => setItems(xs => [...xs, blankItem()])}>Adicionar medicamento</Btn>
              <Field label="Orientações"><TextArea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: dar junto com alimento" /></Field>
            </div>
          )}

          {kind === 'atestado' && (
            <div className="space-y-3">
              <Field label="Finalidade">
                <Select value={purpose} onChange={e => changePurpose(e.target.value)}>
                  <option value="viagem">Viagem</option><option value="hospedagem">Hospedagem</option><option value="outro">Outro</option>
                </Select>
              </Field>
              <Field label="Texto" error={errs.atText}><TextArea rows={6} value={atText} onChange={e => setAtText(e.target.value)} /></Field>
            </div>
          )}

          {isTerm && (
            <div className="space-y-3">
              <Field label="Procedimento" error={errs.procedure}>
                <Input value={procedure} onChange={e => setProcedure(e.target.value)} placeholder="Ex.: Castração com anestesia geral" disabled={kind === 'eutanasia'} />
              </Field>
              <Field label={kind === 'eutanasia' ? 'Esclarecimentos' : 'Riscos explicados'}>
                <TextArea rows={5} value={risks} onChange={e => setRisks(e.target.value)} />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Local"><Input value={place} onChange={e => setPlace(e.target.value)} placeholder="Cidade" /></Field>
            <Field label="Data"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          </div>

          {!me.user.crmv && (
            <Field label="CRMV" hint="Só para esta impressão. Cadastre seu CRMV em Equipe e clínica.">
              <Input value={crmv} onChange={e => setCrmv(e.target.value)} placeholder="Ex.: SP 12345" />
            </Field>
          )}

          {canSave && (
            <Switch checked={save} onChange={setSave} label="Salvar no prontuário"
              hint={isRx ? 'Ao imprimir, a receita vira um registro de prescrição.' : 'Ao imprimir, o texto vira uma observação no prontuário.'} />
          )}
        </div>
      </Sheet>

      <PrintDoc open={preview} onClose={() => setPreview(false)} title={doc.title}
        actions={<span className="mr-auto text-xs text-muted">Revise o texto antes de imprimir.</span>}>
        {printable}
      </PrintDoc>
    </>
  )
}
