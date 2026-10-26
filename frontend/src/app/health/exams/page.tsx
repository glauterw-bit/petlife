'use client'

import { useEffect, useId, useState, FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FlaskConical, Plus, Search } from 'lucide-react'
import { ExamCard, examTypeLabel } from '@/components/health/ExamCard'
import { vaccineInputCls as inputCls, vaccineLabelCls as labelCls } from '@/components/health/EditVaccineModal'
import { PetFilter } from '../_components/PetFilter'
import { exams as examsApi, pets as petsApi, type Exam, type Pet } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { useCached } from '@/lib/cache'
import { hapticError, hapticSuccess } from '@/lib/feedback'
import { dur, easeOut } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useHideAssistant } from '@/components/layout/shell'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { useConfirm } from '@/components/ui/Confirm'

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

function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function ExamsPage() {
  const t = useT()
  const uid = useId()
  const confirm = useConfirm()
  const { success, error } = useToast()
  const [examList, setExamList] = useState<Exam[]>([])
  const petsQ = useCached<Pet[]>('pets', () => petsApi.list())
  const petList = petsQ.data ?? []
  const [loading, setLoading] = useState(true)
  const [filterPet, setFilterPet] = useState<number | 'all'>('all')
  const [searchQ, setSearchQ] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    pet_id: '',
    name: '',
    type: 'Hemograma',
    date: localDay(),
    result: '',
    veterinarian: '',
    notes: '',
  })
  const [examFile, setExamFile] = useState<File | null>(null)
  useHideAssistant(showModal)

  useEffect(() => {
    examsApi.list()
      .then(setExamList)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!form.pet_id && petList.length > 0) setForm(f => ({ ...f, pet_id: String(petList[0].id) }))
  }, [petList, form.pet_id])

  const filtered = examList.filter(e => {
    if (filterPet !== 'all' && e.pet_id !== filterPet) return false
    const q = searchQ.trim().toLowerCase()
    if (q && !e.name.toLowerCase().includes(q) && !e.type.toLowerCase().includes(q)) return false
    return true
  })

  function openNew() {
    setForm(f => ({
      ...f,
      pet_id: filterPet !== 'all' ? String(filterPet) : f.pet_id || (petList[0] ? String(petList[0].id) : ''),
      date: localDay(),
    }))
    setShowModal(true)
  }

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
        veterinarian: form.veterinarian || undefined,
        notes: form.notes || undefined,
      })
      if (examFile) await examsApi.uploadFile(exam.id, examFile).catch(() => {})
      setExamList(prev => [exam, ...prev])
      void hapticSuccess()
      success(t('h.exams.created'))
      setShowModal(false)
      setForm(f => ({ ...f, name: '', type: 'Hemograma', result: '', veterinarian: '', notes: '' }))
      setExamFile(null)
    } catch (err: unknown) {
      void hapticError()
      error(err instanceof Error ? err.message : t('h.exams.createError'))
    } finally { setSubmitting(false) }
  }

  async function handleDelete(id: number) {
    const exam = examList.find(e => e.id === id)
    const ok = await confirm({
      title: t('h.exams.confirmDelete'),
      message: exam?.name,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await examsApi.delete(id)
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : t('g.misc.error'))
      return
    }
    setExamList(prev => prev.filter(e => e.id !== id))
    success(t('h.exams.deleted'))
  }

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))
  const id = (k: string) => `${uid}-${k}`

  return (
    <>
      <PageHeader
        title={t('h.exams.title')}
        subtitle={loading || examList.length === 0 ? undefined : examList.length === 1 ? t('h.exams.countOne', { count: 1 }) : t('h.exams.countMany', { count: examList.length })}
        actions={<IconButton icon={Plus} label={t('dash.newExam')} variant="solid" onClick={openNew} disabled={!petList.length} />}
      />

      {examList.length > 0 && (
        <div className="space-y-3 mb-5">
          {(
            <div className="relative">
              <label htmlFor={id('search')} className="sr-only">{t('h.exams.searchPh')}</label>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 dark:text-surface-400 pointer-events-none" aria-hidden />
              <input
                id={id('search')}
                type="search"
                placeholder={t('h.exams.searchPh')}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                className={cn(inputCls, 'pl-10')}
              />
            </div>
          )}
          {petList.length > 1 && <PetFilter pets={petList} value={filterPet} onChange={setFilterPet} layoutId="exam-filter-pill" />}
        </div>
      )}

      {loading ? (
        <SkeletonList count={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title={examList.length === 0 ? t('h.exams.emptyTitle') : t('h.exams.noResultsTitle')}
          text={examList.length === 0 ? t('h.exams.emptyText') : t('h.exams.noResultsText')}
          ctaLabel={examList.length === 0 && petList.length ? t('h.exams.addCta') : undefined}
          onCta={openNew}
        />
      ) : (
        <ul className="space-y-3 pb-6">
          <AnimatePresence initial={false}>
            {filtered.map(e => (
              <motion.li
                key={e.id}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: dur.base, ease: easeOut }}
                className="list-none"
              >
                <ExamCard exam={e} onDelete={handleDelete} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Sheet
        open={showModal}
        onClose={() => setShowModal(false)}
        title={t('dash.newExam')}
        size="tall"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
            <Button type="submit" form="exam-form" fullWidth loading={submitting}>
              {submitting ? t('h.form.saving') : t('h.exams.submit')}
            </Button>
          </div>
        }
      >
        <form id="exam-form" onSubmit={handleSubmit} className="space-y-4 pb-1">
          <div>
            <label htmlFor={id('pet')} className={labelCls}>{t('h.form.pet')}</label>
            <select id={id('pet')} required value={form.pet_id} onChange={set('pet_id')} className={inputCls}>
              <option value="">{t('h.form.selectPet')}</option>
              {petList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={id('name')} className={labelCls}>{t('h.exams.fName')}</label>
            <input id={id('name')} required type="text" value={form.name} onChange={set('name')} placeholder={t('h.exams.fNamePh')} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={id('type')} className={labelCls}>{t('h.exams.fType')}</label>
              <select id={id('type')} required value={form.type} onChange={set('type')} className={inputCls}>
                {EXAM_TYPES.map(type => <option key={type} value={type}>{examTypeLabel(type, t)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={id('date')} className={labelCls}>{t('h.exams.fDate')}</label>
              <input id={id('date')} required type="date" max={localDay()} value={form.date} onChange={set('date')} className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor={id('vet')} className={labelCls}>{t('h.form.vet')}</label>
            <input id={id('vet')} type="text" value={form.veterinarian} onChange={set('veterinarian')} placeholder={t('h.form.vetPh')} className={inputCls} />
          </div>
          <div>
            <label htmlFor={id('result')} className={labelCls}>{t('h.exams.fResult')}</label>
            <textarea id={id('result')} value={form.result} onChange={set('result')} rows={3} placeholder={t('h.exams.fResultPh')} className={cn(inputCls, 'resize-none')} />
          </div>
          <div>
            <label htmlFor={id('notes')} className={labelCls}>{t('h.form.notes')}</label>
            <textarea id={id('notes')} value={form.notes} onChange={set('notes')} rows={2} className={cn(inputCls, 'resize-none')} />
          </div>
          <div>
            <label htmlFor={id('file')} className={labelCls}>{t('h.exams.fFile')}</label>
            <input
              id={id('file')}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setExamFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-surface-600 dark:text-surface-300 file:mr-3 file:min-h-[44px] file:px-4 file:rounded-xl file:border-0 file:bg-primary-50 file:text-primary-800 dark:file:bg-primary-500/15 dark:file:text-primary-200 file:font-semibold"
            />
          </div>
        </form>
      </Sheet>
    </>
  )
}
