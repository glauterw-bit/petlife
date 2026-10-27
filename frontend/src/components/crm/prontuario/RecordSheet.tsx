'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { BookmarkPlus, ChevronDown, FileText, Settings2, Smartphone, Sparkles, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastContext'
import { crm, isCrmError, type Patient, type RecordEntry, type RecordInput, type RecordTemplate } from '@/lib/crmApi'
import { Btn, Field, Input, Select, TextArea, RECORD_KIND, RECORD_META, fmtDay, parseDecimal, toDate, ymd } from '@/components/crm/ui'
import { Sheet, Segmented, DecimalInput, DropdownMenu, EmptyState, useConfirm, type MenuItem } from '@/components/crm/kit'
import { emitCrmChange } from '@/components/crm/CrmShell'
import { dur } from '@/components/crm/motion'
import { addDays, doseNumber, findProtocol, protocolsFor } from './protocols'

const SOAP_KINDS = ['consulta', 'cirurgia', 'exame', 'retorno']
export const MUCOSAS = ['Normocoradas', 'Hipocoradas', 'Hipercoradas', 'Ictéricas', 'Cianóticas']
export const HYDRATION = ['Normal', 'Desidratação leve', 'Desidratação moderada', 'Desidratação grave']

const grid2 = 'grid grid-cols-1 sm:grid-cols-2 gap-3'
const errMsg = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f)

type Form = {
  title: string; body: string; subjective: string; objective: string; assessment: string; plan: string
  weight: string; temp: string; hr: string; rr: string; mucosa: string; hydration: string; ecc: string
  vaccine_name: string; vaccine_lot: string; performed: string; next_due: string
}
const blank = (): Form => ({
  title: '', body: '', subjective: '', objective: '', assessment: '', plan: '',
  weight: '', temp: '', hr: '', rr: '', mucosa: '', hydration: '', ecc: '',
  vaccine_name: '', vaccine_lot: '', performed: ymd(new Date()), next_due: '',
})
const num = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

function fromRecord(r: RecordEntry): Form {
  return {
    title: r.title ?? '', body: r.body ?? '', subjective: r.subjective ?? '', objective: r.objective ?? '',
    assessment: r.assessment ?? '', plan: r.plan ?? '',
    weight: num(r.weight_kg), temp: num(r.temperature_c), hr: num(r.heart_rate), rr: num(r.resp_rate),
    mucosa: r.mucosa ?? '', hydration: r.hydration ?? '', ecc: r.body_score != null ? String(r.body_score) : '',
    vaccine_name: r.vaccine_name ?? '', vaccine_lot: r.vaccine_lot ?? '',
    performed: r.performed_at ? ymd(toDate(r.performed_at)) : ymd(new Date()),
    next_due: r.next_due ? r.next_due.slice(0, 10) : '',
  }
}

/** Registro do prontuário (SOAP, vacina ou anotação), novo ou em edição. */
export function RecordSheet({ open, onClose, onSaved, patient, kind: kindProp, initial, appointmentId, allowedKinds, records }: {
  open: boolean; onClose: () => void; onSaved: (r: RecordEntry) => void; patient: Patient; kind: string
  initial?: RecordEntry | null; appointmentId?: number; allowedKinds?: string[]
  /** registros do paciente, para deduzir a dose do protocolo de vacina */
  records?: RecordEntry[]
}) {
  const { success, error, info } = useToast()
  const { confirm, prompt } = useConfirm()
  const [kind, setKind] = useState(kindProp)
  const [f, setF] = useState<Form>(blank)
  const [nextTouched, setNextTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errs, setErrs] = useState<Partial<Record<keyof Form, string>>>({})
  const [vitalsOpen, setVitalsOpen] = useState(true)
  const [templates, setTemplates] = useState<RecordTemplate[] | null>(null)
  const [manage, setManage] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setKind(initial.kind)
      setF(fromRecord(initial))
      setNextTouched(true)
    } else {
      setKind(kindProp)
      setF(blank())
      setNextTouched(false)
    }
    setErrs({})
    setVitalsOpen(true)
  }, [open, initial, kindProp])

  const isVac = kind === 'vacina'
  const isSoap = SOAP_KINDS.indexOf(kind) >= 0
  const isGroom = kind === 'banho_tosa'

  // modelos do tipo atual
  const loadTemplates = () => {
    if (isVac) { setTemplates([]); return }
    crm.recordTemplates(kind).then(setTemplates).catch(() => setTemplates([]))
  }
  useEffect(() => { if (open) { setTemplates(null); loadTemplates() } }, [open, kind]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value
    setF(x => ({ ...x, [k]: v }))
    if (errs[k]) setErrs(x => ({ ...x, [k]: undefined }))
  }
  const setV = (k: keyof Form) => (v: string) => {
    setF(x => ({ ...x, [k]: v }))
    if (errs[k]) setErrs(x => ({ ...x, [k]: undefined }))
  }

  /* ── protocolo de vacina ── */
  const protocol = isVac ? findProtocol(f.vaccine_name, patient.species) : null
  const suggestion = useMemo(() => {
    if (!protocol || !f.performed) return null
    const prev = (records ?? [])
      .filter(r => r.kind === 'vacina' && !r.voided_at && r.id !== initial?.id)
      .map(r => ({ name: r.vaccine_name || r.title, date: ymd(toDate(r.performed_at)) }))
    const dose = doseNumber(protocol, f.performed, prev, patient.species)
    return { date: addDays(f.performed, protocol.next(dose)), dose }
  }, [protocol, f.performed, records, initial?.id, patient.species])

  useEffect(() => {
    if (suggestion && !nextTouched) setF(x => (x.next_due === suggestion.date ? x : { ...x, next_due: suggestion.date }))
  }, [suggestion, nextTouched])

  /* ── modelos ── */
  const applyTemplate = (t: RecordTemplate) => {
    setF(x => ({
      ...x,
      title: t.title ?? x.title, body: t.body ?? x.body,
      subjective: t.subjective ?? x.subjective, objective: t.objective ?? x.objective,
      assessment: t.assessment ?? x.assessment, plan: t.plan ?? x.plan,
    }))
    info(`Modelo "${t.name}" aplicado. Revise antes de salvar.`)
  }
  async function saveTemplate() {
    const name = await prompt({ title: 'Salvar como modelo', label: 'Nome do modelo', placeholder: 'Ex.: Consulta de rotina', confirmLabel: 'Salvar' })
    if (!name) return
    try {
      const t = await crm.createRecordTemplate({
        kind, name, title: f.title.trim() || null, body: f.body.trim() || null,
        subjective: isSoap ? f.subjective.trim() || null : null, objective: isSoap ? f.objective.trim() || null : null,
        assessment: isSoap ? f.assessment.trim() || null : null, plan: isSoap ? f.plan.trim() || null : null,
      })
      setTemplates(ts => [...(ts ?? []), t])
      success('Modelo salvo.')
    } catch (e) { error(errMsg(e, 'Não foi possível salvar o modelo.')) }
  }
  async function removeTemplate(t: RecordTemplate) {
    const ok = await confirm({ title: `Excluir o modelo "${t.name}"?`, message: 'Os registros já feitos com ele não mudam.', tone: 'danger', confirmLabel: 'Excluir' })
    if (!ok) return
    try {
      await crm.deleteRecordTemplate(t.id)
      setTemplates(ts => (ts ?? []).filter(x => x.id !== t.id))
      success('Modelo excluído.')
    } catch (e) { error(errMsg(e, 'Não foi possível excluir o modelo.')) }
  }
  const templateItems: Array<MenuItem | 'separator'> = [
    ...(templates ?? []).map(t => ({ label: t.name, icon: FileText, onSelect: () => applyTemplate(t) })),
    ...((templates ?? []).length ? ['separator' as const] : []),
    { label: 'Salvar como modelo', icon: BookmarkPlus, onSelect: () => { void saveTemplate() } },
    { label: 'Gerenciar modelos', icon: Settings2, onSelect: () => setManage(true), disabled: !(templates ?? []).length },
  ]

  /* ── salvar ── */
  async function save() {
    if (busy) return
    const ne: Partial<Record<keyof Form, string>> = {}
    const opt = (s: string) => (s.trim() ? parseDecimal(s) : null)
    const weight = opt(f.weight), temp = opt(f.temp), hr = opt(f.hr), rr = opt(f.rr)
    if (f.weight.trim() && (weight == null || weight <= 0 || weight > 200)) ne.weight = 'Peso inválido. Ex.: 8,5'
    if (f.temp.trim() && (temp == null || temp < 30 || temp > 45)) ne.temp = 'Entre 30 e 45 °C.'
    if (f.hr.trim() && (hr == null || hr < 1 || hr > 400 || !Number.isInteger(hr))) ne.hr = 'Número inteiro.'
    if (f.rr.trim() && (rr == null || rr < 1 || rr > 200 || !Number.isInteger(rr))) ne.rr = 'Número inteiro.'
    if (isVac && !f.vaccine_name.trim()) ne.vaccine_name = 'Informe a vacina.'
    if (!f.performed) ne.performed = 'Informe a data.'
    else if (f.performed > ymd(new Date())) ne.performed = 'A data não pode estar no futuro.'
    if (f.next_due && f.performed && f.next_due < f.performed) ne.next_due = 'Precisa ser depois da aplicação.'
    if (!isVac && !isSoap && !f.title.trim() && !f.body.trim()) ne.body = 'Escreva a descrição.'
    setErrs(ne)
    if (Object.keys(ne).length) return

    const label = RECORD_KIND[kind] ?? 'Registro'
    const title = f.title.trim() || (isVac ? `Vacina ${f.vaccine_name.trim()}` : label)
    const t = (s: string) => s.trim() || null
    const payload: RecordInput = {
      kind, title, body: t(f.body),
      subjective: isSoap ? t(f.subjective) : null, objective: isSoap ? t(f.objective) : null,
      assessment: isSoap ? t(f.assessment) : null, plan: isSoap ? t(f.plan) : null,
      weight_kg: isSoap || isGroom ? weight : null, temperature_c: isSoap ? temp : null,
      heart_rate: isSoap ? hr : null, resp_rate: isSoap ? rr : null,
      mucosa: isSoap ? t(f.mucosa) : null, hydration: isSoap ? t(f.hydration) : null,
      body_score: isSoap && f.ecc ? Number(f.ecc) : null,
      vaccine_name: isVac ? t(f.vaccine_name) : null, vaccine_lot: isVac ? t(f.vaccine_lot) : null,
      next_due: (isVac || isSoap) && f.next_due ? `${f.next_due}T12:00:00` : null,
    }
    const performedChanged = !initial || ymd(toDate(initial.performed_at)) !== f.performed
    if (performedChanged) payload.performed_at = `${f.performed}T12:00:00`
    if (!initial && appointmentId) payload.appointment_id = appointmentId

    setBusy(true)
    try {
      const r = initial ? await crm.updateRecord(initial.id, payload) : await crm.addRecord(patient.id, payload)
      if (r.sent_to_app && isVac) success(initial ? 'Registro atualizado. A vacina também foi atualizada na carteirinha do tutor.' : 'Registrado. A vacina também foi para a carteirinha do tutor.')
      else success(initial ? 'Registro atualizado.' : 'Registrado no prontuário.')
      emitCrmChange('record')
      onSaved(r)
      onClose()
    } catch (e) {
      error(errMsg(e, 'Não foi possível salvar o registro.'))
      if (isCrmError(e) && e.status === 409) { emitCrmChange('record'); onClose() }
    } finally { setBusy(false) }
  }

  const kinds = (allowedKinds ?? Object.keys(RECORD_KIND)).filter(k => RECORD_KIND[k])
  const vacOptions = protocolsFor(patient.species)
  const listId = `vac-list-${patient.id}`

  return (
    <>
      <Sheet open={open} onClose={onClose} onSubmit={save} size="lg"
        title={initial ? `Editar registro · ${patient.name}` : `Novo registro · ${patient.name}`}
        description={initial ? 'Registros podem ser editados por 24 horas. Depois, use Adendo ou Anular.' : undefined}
        footer={<>
          <span className="mr-auto hidden sm:inline text-2xs text-muted">Ctrl + Enter salva</span>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={save} loading={busy}>{initial ? 'Salvar alterações' : 'Registrar'}</Btn>
        </>}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {!initial && kinds.length > 1 && (
              <Segmented id="rec-kind" ariaLabel="Tipo de registro" size="sm" value={kind} onChange={v => { setKind(v); setErrs({}) }}
                options={kinds.map(k => ({ value: k, label: RECORD_KIND[k], icon: RECORD_META[k]?.Icon }))} />
            )}
            {initial && <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{RECORD_KIND[kind] ?? kind}</span>}
            {!isVac && (
              <div className="ml-auto">
                <DropdownMenu ariaLabel="Modelos de registro" align="end" items={templateItems}
                  triggerClassName="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold text-ink bg-panel shadow-crm-card hover:bg-panel-2 transition-colors"
                  trigger={<><Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden /> Usar modelo <ChevronDown className="w-3.5 h-3.5 text-muted" strokeWidth={1.75} aria-hidden /></>} />
              </div>
            )}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <m.div key={isVac ? 'vac' : isSoap ? 'soap' : 'note'} className="space-y-4"
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: dur.fast }}>
              {isVac ? (
                <>
                  <div className={grid2}>
                    <Field label="Vacina *" error={errs.vaccine_name}>
                      <Input value={f.vaccine_name} onChange={set('vaccine_name')} list={listId} placeholder="Ex.: V10, Antirrábica" data-autofocus autoComplete="off" />
                      <datalist id={listId}>{vacOptions.map(p => <option key={p.id} value={p.name} />)}</datalist>
                    </Field>
                    <Field label="Lote"><Input value={f.vaccine_lot} onChange={set('vaccine_lot')} autoComplete="off" /></Field>
                  </div>
                  <div className={grid2}>
                    <Field label="Data de aplicação *" error={errs.performed} hint="Pode ser uma data passada.">
                      <Input type="date" value={f.performed} onChange={set('performed')} max={ymd(new Date())} />
                    </Field>
                    <Field label="Próxima dose" error={errs.next_due}>
                      <Input type="date" value={f.next_due} min={f.performed || undefined}
                        onChange={e => { setNextTouched(true); set('next_due')(e) }} />
                    </Field>
                  </div>
                  <AnimatePresence initial={false}>
                    {protocol && suggestion && (
                      <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: dur.base }} className="overflow-hidden">
                        <div className="flex items-start gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-3 py-2.5 text-xs text-blue-800 dark:text-blue-200">
                          <Sparkles className="w-4 h-4 shrink-0 mt-px" strokeWidth={1.75} aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p>Sugestão pelo protocolo: {protocol.name}, {protocol.rule}. Confira.</p>
                            <p className="mt-0.5 tabular-nums">
                              Próxima dose sugerida: <strong>{fmtDay(suggestion.date)}</strong>
                              {suggestion.dose < 99 ? ` (esta é a ${suggestion.dose}ª dose registrada da série)` : ' (reforço)'}
                            </p>
                          </div>
                          {f.next_due !== suggestion.date && (
                            <button type="button" onClick={() => { setNextTouched(false); setF(x => ({ ...x, next_due: suggestion.date })) }}
                              className="shrink-0 font-semibold underline underline-offset-2">Usar</button>
                          )}
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                  <Field label="Observações"><TextArea rows={2} value={f.body} onChange={set('body')} placeholder="Reações, local de aplicação…" /></Field>
                  {patient.consent_active === true && (
                    <p className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                      <Smartphone className="w-4 h-4 shrink-0 mt-px" strokeWidth={1.75} aria-hidden />
                      Este pet está ligado ao app PetLife: a vacina também vai para a carteirinha do tutor, com aviso no celular.
                    </p>
                  )}
                </>
              ) : isSoap ? (
                <>
                  <div className={grid2}>
                    <Field label="Título" className="sm:col-span-2">
                      <Input value={f.title} onChange={set('title')} placeholder={`Ex.: ${RECORD_KIND[kind] ?? 'Consulta'} de rotina`} data-autofocus />
                    </Field>
                  </div>
                  <Field label="Queixa / Subjetivo" hint="O que o tutor relata: queixa, histórico, alimentação.">
                    <TextArea rows={3} value={f.subjective} onChange={set('subjective')} />
                  </Field>
                  <Field label="Exame físico / Objetivo">
                    <TextArea rows={3} value={f.objective} onChange={set('objective')} />
                  </Field>

                  <div className="rounded-xl bg-panel-2/70">
                    <button type="button" onClick={() => setVitalsOpen(v => !v)} aria-expanded={vitalsOpen}
                      className="w-full flex items-center justify-between h-10 px-3 text-2xs font-semibold uppercase tracking-wider text-muted">
                      Sinais vitais
                      <m.span animate={{ rotate: vitalsOpen ? 180 : 0 }} transition={{ duration: dur.base }}>
                        <ChevronDown className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                      </m.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {vitalsOpen && (
                        <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: dur.base }} className="overflow-hidden">
                          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 gap-3 px-3 pb-3">
                            <Field label="Peso" error={errs.weight}><DecimalInput value={f.weight} onChange={setV('weight')} suffix="kg" placeholder="0,0" /></Field>
                            <Field label="Temperatura" error={errs.temp}><DecimalInput value={f.temp} onChange={setV('temp')} suffix="°C" placeholder="38,5" /></Field>
                            <Field label="Freq. cardíaca" error={errs.hr}><DecimalInput value={f.hr} onChange={setV('hr')} suffix="bpm" inputMode="numeric" /></Field>
                            <Field label="Freq. respiratória" error={errs.rr}><DecimalInput value={f.rr} onChange={setV('rr')} suffix="mpm" inputMode="numeric" /></Field>
                            <Field label="Mucosas">
                              <Select value={f.mucosa} onChange={set('mucosa')}>
                                <option value="">Não avaliado</option>
                                {MUCOSAS.map(m => <option key={m} value={m}>{m}</option>)}
                              </Select>
                            </Field>
                            <Field label="Hidratação">
                              <Select value={f.hydration} onChange={set('hydration')}>
                                <option value="">Não avaliado</option>
                                {HYDRATION.map(m => <option key={m} value={m}>{m}</option>)}
                              </Select>
                            </Field>
                            <Field label="Escore corporal (ECC)">
                              <Select value={f.ecc} onChange={set('ecc')}>
                                <option value="">Não avaliado</option>
                                {Array.from({ length: 9 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}/9</option>)}
                              </Select>
                            </Field>
                          </div>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <Field label="Avaliação / Diagnóstico"><TextArea rows={2} value={f.assessment} onChange={set('assessment')} /></Field>
                  <Field label="Plano / Conduta" hint="Tratamento, exames pedidos, orientações."><TextArea rows={3} value={f.plan} onChange={set('plan')} /></Field>
                  {initial?.body && (
                    <Field label="Anotação (formato antigo)"><TextArea rows={3} value={f.body} onChange={set('body')} /></Field>
                  )}
                  <div className={grid2}>
                    <Field label="Data do atendimento *" error={errs.performed}>
                      <Input type="date" value={f.performed} onChange={set('performed')} max={ymd(new Date())} />
                    </Field>
                    <Field label="Retorno" error={errs.next_due} hint="Entra nos lembretes da recepção.">
                      <Input type="date" value={f.next_due} onChange={set('next_due')} min={f.performed || undefined} />
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Título">
                    <Input value={f.title} onChange={set('title')} data-autofocus
                      placeholder={isGroom ? 'Ex.: Banho e tosa higiênica' : kind === 'prescricao' ? 'Ex.: Receita pós-consulta' : 'Ex.: Contato com o tutor'} />
                  </Field>
                  <Field label="Descrição" error={errs.body}><TextArea rows={6} value={f.body} onChange={set('body')} /></Field>
                  <div className={grid2}>
                    <Field label="Data *" error={errs.performed}>
                      <Input type="date" value={f.performed} onChange={set('performed')} max={ymd(new Date())} />
                    </Field>
                    {isGroom && (
                      <Field label="Peso" error={errs.weight}><DecimalInput value={f.weight} onChange={setV('weight')} suffix="kg" placeholder="0,0" /></Field>
                    )}
                  </div>
                </>
              )}
            </m.div>
          </AnimatePresence>
        </div>
      </Sheet>

      <Sheet open={manage} onClose={() => setManage(false)} title="Modelos" description={`Modelos de ${(RECORD_KIND[kind] ?? kind).toLowerCase()}`} size="md"
        footer={<Btn variant="ghost" onClick={() => setManage(false)}>Fechar</Btn>}>
        {(templates ?? []).length ? (
          <ul className="divide-y divide-line">
            {(templates ?? []).map(t => (
              <li key={t.id} className="flex items-center gap-3 min-h-14 md:min-h-11 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{t.name}</p>
                  {t.title && <p className="text-xs text-muted truncate">{t.title}</p>}
                </div>
                <Btn size="sm" variant="ghost" onClick={() => { applyTemplate(t); setManage(false) }}>Usar</Btn>
                <Btn size="sm" variant="danger" icon={Trash2} aria-label={`Excluir modelo ${t.name}`} onClick={() => { void removeTemplate(t) }} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileText} title="Nenhum modelo" hint="Preencha um registro e use Salvar como modelo." compact />
        )}
      </Sheet>
    </>
  )
}
