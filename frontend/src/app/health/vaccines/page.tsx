'use client'

import { useEffect, useState, FormEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Filter, CreditCard, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { VaccineTimeline } from '@/components/health/VaccineTimeline'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { vaccines as vaccinesApi, pets as petsApi, type Vaccine, type Pet } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { getVaccineStatus } from '@/lib/utils'

/**
 * Vacinas mais comuns no Brasil, por espécie. Existem para eliminar a digitação
 * — o formulário longo era o ponto onde a maioria desistia (1 de 110 usuários
 * chegava a registrar uma vacina).
 * `annual` alimenta a sugestão automática da próxima dose.
 */
const COMMON_VACCINES: Record<string, Array<{ name: string; annual: boolean }>> = {
  dog: [
    { name: 'V10 (Polivalente)', annual: true },
    { name: 'Antirrábica', annual: true },
    { name: 'Gripe Canina', annual: true },
    { name: 'Giárdia', annual: true },
    { name: 'Vermífugo', annual: false },
    { name: 'Antipulgas', annual: false },
  ],
  cat: [
    { name: 'V4 (Quádrupla felina)', annual: true },
    { name: 'Antirrábica', annual: true },
    { name: 'Leucemia Felina (FeLV)', annual: true },
    { name: 'Vermífugo', annual: false },
    { name: 'Antipulgas', annual: false },
  ],
}

function plusOneYear(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

function VaccinesPageInner() {
  const t = useT()
  const { success, error } = useToast()
  const [vaccineList, setVaccineList] = useState<Vaccine[]>([])
  const [petList, setPetList] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPet, setFilterPet] = useState<number | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    pet_id: '',
    name: '',
    date_applied: new Date().toISOString().split('T')[0],
    next_due_date: '',
    vet_name: '',
    lot_number: '',
    notes: '',
  })
  const [docFile, setDocFile] = useState<File | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const params = useSearchParams()

  useEffect(() => {
    async function load() {
      try {
        const [v, p] = await Promise.all([vaccinesApi.list(), petsApi.list()])
        setVaccineList(v)
        setPetList(p)
        // Vindo de "cadastrar pet": já abre o formulário com o pet escolhido,
        // pra pessoa registrar a 1ª vacina sem procurar o botão.
        const fromNewPet = params?.get('novo') === '1'
        const petParam = params?.get('pet')
        const preselected = petParam && p.some(x => String(x.id) === petParam)
          ? petParam
          : (p.length > 0 ? String(p[0].id) : '')
        if (preselected) setForm(f => ({ ...f, pet_id: preselected }))
        if (fromNewPet && preselected) setShowModal(true)
      } finally { setLoading(false) }
    }
    load()
  }, [params])

  // Espécie do pet selecionado — define quais vacinas aparecem como atalho.
  const selectedSpecies = petList.find(p => String(p.id) === String(form.pet_id))?.species ?? ''

  const filtered = filterPet
    ? vaccineList.filter(v => v.pet_id === Number(filterPet))
    : vaccineList

  const stats = {
    total: vaccineList.length,
    upToDate: vaccineList.filter(v => getVaccineStatus(v.next_due_date) === 'up_to_date').length,
    upcoming: vaccineList.filter(v => getVaccineStatus(v.next_due_date) === 'upcoming').length,
    overdue: vaccineList.filter(v => getVaccineStatus(v.next_due_date) === 'overdue').length,
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.pet_id) { error(t('h.form.selectPetError')); return }
    setSubmitting(true)
    try {
      const v = await vaccinesApi.create({
        pet_id: Number(form.pet_id),
        name: form.name,
        date_applied: form.date_applied,
        next_due_date: form.next_due_date || undefined,
        vet_name: form.vet_name || undefined,
        lot_number: form.lot_number || undefined,
        notes: form.notes || undefined,
      })
      if (docFile) await vaccinesApi.uploadDocument(v.id, docFile).catch(() => {})
      setVaccineList(prev => [v, ...prev])
      success(t('h.vaccines.created'))
      setShowModal(false)
      setForm(f => ({ ...f, name: '', date_applied: new Date().toISOString().split('T')[0], next_due_date: '', vet_name: '', lot_number: '', notes: '' }))
      setDocFile(null)
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : t('h.vaccines.createError'))
    } finally { setSubmitting(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('h.vaccines.confirmDelete'))) return
    await vaccinesApi.delete(id).catch(() => {})
    setVaccineList(prev => prev.filter(v => v.id !== id))
    success(t('h.vaccines.deleted'))
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <DashboardLayout>
      {/* pr-14 reserva o canto superior direito pro sino de notificações (fixed) não cair em cima dos botões */}
      <div className="flex items-start justify-between gap-3 mb-5 md:mb-6 pr-14">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight">{t('h.vaccines.title')}</h1>
          <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">{t('h.vaccines.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {petList.length > 0 && (
            <Link
              href={`/health/vaccines/carteirinha/${filterPet || petList[0]?.id}`}
              className="flex items-center gap-2 border border-primary-300 text-primary-700 px-4 py-2.5 rounded-xl font-medium hover:bg-primary-50 transition text-sm"
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('h.vaccines.digitalCard')}</span>
            </Link>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary-600 transition"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">{t('dash.newVaccine')}</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: t('h.vaccines.statTotal'), value: stats.total, color: 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200' },
          { label: t('h.vaccines.statUpToDate'), value: stats.upToDate, color: 'bg-green-50 text-green-700' },
          { label: t('h.vaccines.statUpcoming'), value: stats.upcoming, color: 'bg-yellow-50 text-yellow-700' },
          { label: t('h.vaccines.statOverdue'), value: stats.overdue, color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 border border-surface-100 dark:border-surface-700 ${s.color.split(' ')[0]}`}>
            <div className={`text-2xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</div>
            <div className="text-sm mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      {petList.length > 1 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Filter className="w-4 h-4 text-surface-500 dark:text-surface-400" />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterPet('')}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${filterPet === '' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:border-primary-300'}`}
            >
              {t('h.vaccines.allPets')}
            </button>
            {petList.map(p => (
              <button
                key={p.id}
                onClick={() => setFilterPet(p.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${filterPet === p.id ? 'bg-primary-500 text-white' : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:border-primary-300'}`}
              >
                {p.species === 'dog' ? '🐕' : '🐈'} {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? <PageLoader /> : <VaccineTimeline vaccines={filtered} onDelete={handleDelete} />}

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={t('dash.newVaccine')} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.form.pet')}</label>
            <select required value={form.pet_id} onChange={set('pet_id')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800">
              <option value="">{t('h.form.selectPet')}</option>
              {petList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {/* Atalhos: um toque preenche nome e já sugere a próxima dose */}
          {selectedSpecies && (
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-2">{t('h.vaccines.quickPick')}</label>
              <div className="flex flex-wrap gap-2">
                {(COMMON_VACCINES[selectedSpecies] ?? []).map(v => {
                  const active = form.name === v.name
                  return (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        name: v.name,
                        next_due_date: v.annual ? plusOneYear(f.date_applied) : f.next_due_date,
                      }))}
                      className={`pressable text-sm font-medium px-3.5 py-2 rounded-xl border transition ${
                        active
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-200 hover:border-primary-300'
                      }`}
                    >
                      {v.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.vaccines.fName')}</label>
            <input required type="text" value={form.name} onChange={set('name')} placeholder={t('h.vaccines.fNamePh')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.vaccines.fApplied')}</label>
              <input required type="date" value={form.date_applied} onChange={set('date_applied')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.vaccines.fNextDose')}</label>
              <input type="date" value={form.next_due_date} onChange={set('next_due_date')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800" />
            </div>
          </div>

          {/* O resto é opcional e fica escondido: era o que fazia a maioria
              desistir no meio do cadastro. */}
          <button
            type="button"
            onClick={() => setShowDetails(v => !v)}
            className="w-full flex items-center justify-center gap-1 text-xs font-medium text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 py-1 transition"
          >
            {showDetails ? t('h.vaccines.hideDetails') : t('h.vaccines.moreDetails')}
            <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
          </button>

          {showDetails && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.form.vet')}</label>
                  <input type="text" value={form.vet_name} onChange={set('vet_name')} placeholder={t('h.form.vetPh')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.vaccines.fLot')}</label>
                  <input type="text" value={form.lot_number} onChange={set('lot_number')} placeholder={t('h.vaccines.fLotPh')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.form.notes')}</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.vaccines.fDoc')}</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setDocFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-surface-600 dark:text-surface-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium hover:file:bg-primary-100" />
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700/40 transition">{t('common.cancel')}</button>
            <button type="submit" disabled={submitting} className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-60 transition flex items-center justify-center gap-2">
              {submitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {submitting ? t('h.form.saving') : t('h.vaccines.submit')}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}

/** useSearchParams exige Suspense no App Router (prerender bailout). */
export default function VaccinesPage() {
  return (
    <Suspense fallback={<DashboardLayout><PageLoader /></DashboardLayout>}>
      <VaccinesPageInner />
    </Suspense>
  )
}
