'use client'

import { useEffect, useState, FormEvent } from 'react'
import { Plus, Filter, Search } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ExamCard, examTypeLabel } from '@/components/health/ExamCard'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { exams as examsApi, pets as petsApi, type Exam, type Pet } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'

const EXAM_TYPES = [
  'Hemograma',
  'Bioquímica',
  'Urina (EAS)',
  'Fezes',
  'Raio-X',
  'Ultrassom',
  'Eletrocardiograma',
  'Oftalmológico',
  'Dermatológico',
  'Outros',
]

export default function ExamsPage() {
  const t = useT()
  const { success, error } = useToast()
  const [examList, setExamList] = useState<Exam[]>([])
  const [petList, setPetList] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPet, setFilterPet] = useState<number | ''>('')
  const [searchQ, setSearchQ] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    pet_id: '',
    name: '',
    type: 'Hemograma',
    date: new Date().toISOString().split('T')[0],
    result: '',
    vet_name: '',
    notes: '',
  })
  const [examFile, setExamFile] = useState<File | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [e, p] = await Promise.all([examsApi.list(), petsApi.list()])
        setExamList(e)
        setPetList(p)
        if (p.length > 0) setForm(f => ({ ...f, pet_id: String(p[0].id) }))
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = examList.filter(e => {
    if (filterPet && e.pet_id !== Number(filterPet)) return false
    if (searchQ && !e.name.toLowerCase().includes(searchQ.toLowerCase()) && !e.type.toLowerCase().includes(searchQ.toLowerCase())) return false
    return true
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.pet_id) { error(t('h.form.selectPetError')); return }
    setSubmitting(true)
    try {
      const exam = await examsApi.create({
        pet_id: Number(form.pet_id),
        name: form.name,
        type: form.type,
        date: form.date,
        result: form.result || undefined,
        vet_name: form.vet_name || undefined,
        notes: form.notes || undefined,
      })
      if (examFile) await examsApi.uploadFile(exam.id, examFile).catch(() => {})
      setExamList(prev => [exam, ...prev])
      success(t('h.exams.created'))
      setShowModal(false)
      setForm(f => ({ ...f, name: '', type: 'Hemograma', result: '', vet_name: '', notes: '' }))
      setExamFile(null)
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : t('h.exams.createError'))
    } finally { setSubmitting(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('h.exams.confirmDelete'))) return
    await examsApi.delete(id).catch(() => {})
    setExamList(prev => prev.filter(e => e.id !== id))
    success(t('h.exams.deleted'))
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-3 mb-5 md:mb-6 ">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight">{t('h.exams.title')}</h1>
          <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">{examList.length === 1 ? t('h.exams.countOne', { count: examList.length }) : t('h.exams.countMany', { count: examList.length })}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary-600 transition"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">{t('dash.newExam')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder={t('h.exams.searchPh')}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        {petList.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-surface-500 dark:text-surface-400" />
            <button onClick={() => setFilterPet('')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${filterPet === '' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200'}`}>{t('h.form.all')}</button>
            {petList.map(p => (
              <button key={p.id} onClick={() => setFilterPet(p.id)} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${filterPet === p.id ? 'bg-primary-500 text-white' : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200'}`}>
                {p.species === 'dog' ? '🐕' : '🐈'} {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? <PageLoader /> : (
        filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-3">🔬</div>
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-2">
              {examList.length === 0 ? t('h.exams.emptyTitle') : t('h.exams.noResultsTitle')}
            </h2>
            <p className="text-surface-500 dark:text-surface-400 mb-6">
              {examList.length === 0 ? t('h.exams.emptyText') : t('h.exams.noResultsText')}
            </p>
            {examList.length === 0 && (
              <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-600 transition">
                <Plus className="w-5 h-5" />
                {t('h.exams.addCta')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(e => <ExamCard key={e.id} exam={e} onDelete={handleDelete} />)}
          </div>
        )
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={t('dash.newExam')} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.form.pet')}</label>
            <select required value={form.pet_id} onChange={set('pet_id')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800">
              <option value="">{t('h.form.selectPet')}</option>
              {petList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.exams.fName')}</label>
              <input required type="text" value={form.name} onChange={set('name')} placeholder={t('h.exams.fNamePh')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.exams.fType')}</label>
              <select required value={form.type} onChange={set('type')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800">
                {EXAM_TYPES.map(type => <option key={type} value={type}>{examTypeLabel(type, t)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.exams.fDate')}</label>
              <input required type="date" value={form.date} onChange={set('date')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.form.vet')}</label>
              <input type="text" value={form.vet_name} onChange={set('vet_name')} placeholder={t('h.form.vetPh')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.exams.fResult')}</label>
            <textarea value={form.result} onChange={set('result')} rows={3} placeholder={t('h.exams.fResultPh')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.form.notes')}</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('h.exams.fFile')}</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setExamFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-surface-600 dark:text-surface-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium hover:file:bg-primary-100" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700/40 transition">{t('common.cancel')}</button>
            <button type="submit" disabled={submitting} className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-60 transition flex items-center justify-center gap-2">
              {submitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {submitting ? t('h.form.saving') : t('h.exams.submit')}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
