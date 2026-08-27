'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Phone, User, Calendar, Printer, PlusCircle, Stethoscope } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { VaccineTimeline } from '@/components/health/VaccineTimeline'
import { ExamCard } from '@/components/health/ExamCard'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { Modal } from '@/components/ui/Modal'
import { vet, type PatientHistory, type Consultation } from '@/lib/api'
import { formatDate, formatAge, getSpeciesEmoji } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'vaccines' | 'exams' | 'anamnesis' | 'consultations'

export default function VetPatientPage() {
  const { petId } = useParams()
  const router = useRouter()
  const t = useT()
  const { success, error: showError } = useToast()

  const [history, setHistory] = useState<PatientHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [showConsultModal, setShowConsultModal] = useState(false)
  const [consultForm, setConsultForm] = useState({
    date: new Date().toISOString().split('T')[0],
    diagnosis: '',
    treatment: '',
    notes: '',
    follow_up_date: '',
  })
  const [submittingConsult, setSubmittingConsult] = useState(false)

  const id = Number(petId)

  useEffect(() => {
    vet.getPatientHistory(id).then(setHistory).catch(() => router.push('/vet/dashboard')).finally(() => setLoading(false))
  }, [id, router])

  async function handleAddConsultation(e: FormEvent) {
    e.preventDefault()
    setSubmittingConsult(true)
    try {
      const c = await vet.addConsultation(id, {
        date: consultForm.date,
        diagnosis: consultForm.diagnosis || undefined,
        treatment: consultForm.treatment || undefined,
        notes: consultForm.notes || undefined,
        follow_up_date: consultForm.follow_up_date || undefined,
      })
      setHistory(prev => prev ? { ...prev, consultations: [c, ...prev.consultations] } : prev)
      success(t('v.vetpat.saved'))
      setShowConsultModal(false)
      setConsultForm({ date: new Date().toISOString().split('T')[0], diagnosis: '', treatment: '', notes: '', follow_up_date: '' })
    } catch { showError(t('v.vetpat.saveError')) }
    finally { setSubmittingConsult(false) }
  }

  function handlePrint() {
    window.print()
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setConsultForm(f => ({ ...f, [field]: e.target.value }))

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>
  if (!history) return null

  const { pet, owner, vaccines, exams, anamnesis, consultations } = history

  const urgencyColors = {
    low: 'bg-blue-50 text-blue-700 border-blue-200',
    medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    emergency: 'bg-red-50 text-red-700 border-red-200',
  }
  const urgencyLabels = {
    low: t('v.vetpat.urgLow'),
    medium: t('v.vetpat.urgMedium'),
    high: t('v.vetpat.urgHigh'),
    emergency: t('v.vetpat.urgEmergency'),
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t('v.vetpat.tabOverview') },
    { id: 'vaccines', label: t('v.vetpat.tabVaccines', { count: vaccines.length }) },
    { id: 'exams', label: t('v.vetpat.tabExams', { count: exams.length }) },
    { id: 'anamnesis', label: t('v.vetpat.tabAnamnesis', { count: anamnesis.length }) },
    { id: 'consultations', label: t('v.vetpat.tabConsults', { count: consultations.length }) },
  ]

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-surface-100 transition">
            <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{pet.name}</h1>
            <p className="text-surface-500 dark:text-surface-400 text-sm">{pet.breed?.name ?? ''} • {formatAge(pet.birth_date)}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700/40 transition">
            <Printer className="w-4 h-4" />
            {t('v.vetpat.print')}
          </button>
          <button
            onClick={() => setShowConsultModal(true)}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition"
          >
            <PlusCircle className="w-4 h-4" />
            {t('v.vetpat.addConsult')}
          </button>
        </div>
      </div>

      {/* Pet + owner summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Pet card */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5 flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center shrink-0">
            {pet.photo_url ? (
              <Image src={pet.photo_url} alt={pet.name} width={80} height={80} className="object-cover w-full h-full" />
            ) : (
              <span className="text-4xl">{getSpeciesEmoji(pet.species)}</span>
            )}
          </div>
          <div>
            <h2 className="font-bold text-surface-900 dark:text-white text-lg">{pet.name}</h2>
            <div className="space-y-1 mt-1">
              <div className="text-sm text-surface-600 dark:text-surface-300"><span className="font-medium">{t('v.vetpat.breed')}</span> {pet.breed?.name ?? '—'}</div>
              <div className="text-sm text-surface-600 dark:text-surface-300"><span className="font-medium">{t('v.vetpat.age')}</span> {formatAge(pet.birth_date)}</div>
              <div className="text-sm text-surface-600 dark:text-surface-300"><span className="font-medium">{t('v.vetpat.weight')}</span> {pet.weight ? `${pet.weight} kg` : '—'}</div>
              {pet.microchip && <div className="text-sm text-surface-600 dark:text-surface-300"><span className="font-medium">{t('v.vetpat.microchip')}</span> <span className="font-mono">{pet.microchip}</span></div>}
              {pet.neutered !== undefined && (
                <div className="text-sm text-surface-600 dark:text-surface-300"><span className="font-medium">{t('v.vetpat.neutered')}</span> {pet.neutered ? t('common.yes') : t('common.no')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Owner card */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-5 h-5 text-primary-500" />
            <h3 className="font-bold text-surface-900 dark:text-white">{t('v.vetpat.ownerTitle')}</h3>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-surface-600 dark:text-surface-300"><span className="font-medium">{t('v.vetpat.ownerName')}</span> {owner.name}</div>
            <div className="text-sm text-surface-600 dark:text-surface-300"><span className="font-medium">{t('v.vetpat.ownerEmail')}</span> {owner.email}</div>
            {owner.phone && (
              <a href={`tel:${owner.phone}`} className="flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
                <Phone className="w-4 h-4" />
                {owner.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-1.5 mb-6 overflow-x-auto print:hidden">
        {tabs.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap',
              tab === item.id ? 'bg-primary-500 text-white' : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/40'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {tab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { labelKey: 'v.vetpat.statVaccines', value: vaccines.length, icon: '💉', color: 'bg-green-50 text-green-700' },
              { labelKey: 'v.vetpat.statExams', value: exams.length, icon: '🔬', color: 'bg-blue-50 text-blue-700' },
              { labelKey: 'v.vetpat.statAnamnesis', value: anamnesis.length, icon: '📋', color: 'bg-purple-50 text-purple-700' },
              { labelKey: 'v.vetpat.statConsults', value: consultations.length, icon: '🏥', color: 'bg-accent-50 text-accent-700' },
            ].map(s => (
              <div key={s.labelKey} className={`rounded-2xl p-5 border border-surface-100 dark:border-surface-700 ${s.color.split(' ')[0]}`}>
                <div className="text-3xl mb-2">{s.icon}</div>
                <div className={`text-3xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</div>
                <div className="text-sm mt-0.5">{t(s.labelKey)}</div>
              </div>
            ))}
            {pet.bio && (
              <div className="col-span-2 md:col-span-4 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
                <h3 className="font-semibold text-surface-900 dark:text-white mb-2">{t('v.vetpat.ownerNotes')}</h3>
                <p className="text-sm text-surface-600 dark:text-surface-300 italic">{pet.bio}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'vaccines' && (
          vaccines.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
              <div className="text-5xl mb-3">💉</div>
              <p className="text-surface-500 dark:text-surface-400">{t('v.vetpat.noVaccines')}</p>
            </div>
          ) : (
            <VaccineTimeline vaccines={vaccines} />
          )
        )}

        {tab === 'exams' && (
          exams.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
              <div className="text-5xl mb-3">🔬</div>
              <p className="text-surface-500 dark:text-surface-400">{t('v.vetpat.noExams')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map(e => <ExamCard key={e.id} exam={e} />)}
            </div>
          )
        )}

        {tab === 'anamnesis' && (
          anamnesis.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
              <div className="text-5xl mb-3">📋</div>
              <p className="text-surface-500 dark:text-surface-400">{t('v.vetpat.noAnamnesis')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {anamnesis.map(a => {
                const urgLevel = a.ai_analysis?.urgency_level
                const colorClass = urgLevel ? urgencyColors[urgLevel] : 'bg-surface-50 dark:bg-surface-900/60 text-surface-700 dark:text-surface-200 border-surface-200 dark:border-surface-700'
                return (
                  <div key={a.id} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-surface-500 dark:text-surface-400">{formatDate(a.created_at, 'dd/MM/yyyy HH:mm')}</span>
                      {urgLevel && (
                        <span className={cn('text-xs font-semibold px-3 py-1 rounded-full border', colorClass)}>
                          {t('v.vetpat.urgency', { level: urgencyLabels[urgLevel] })}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-surface-700 dark:text-surface-200 mb-1">{t('v.vetpat.symptoms')}</div>
                    <p className="text-sm text-surface-600 dark:text-surface-300 mb-3">{a.symptoms}</p>
                    {a.ai_analysis && (
                      <div className={cn('rounded-xl p-3 border text-sm', colorClass)}>
                        <p className="font-semibold mb-1">{t('v.vetpat.aiAnalysis')}</p>
                        <p>{a.ai_analysis.analysis}</p>
                        {a.ai_analysis.seek_vet_immediately && (
                          <p className="mt-2 font-bold text-red-700">{t('v.vetpat.urgentWarning')}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {tab === 'consultations' && (
          <div>
            <div className="flex justify-end mb-4 print:hidden">
              <button
                onClick={() => setShowConsultModal(true)}
                className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition"
              >
                <PlusCircle className="w-4 h-4" />
                {t('v.vetpat.newConsult')}
              </button>
            </div>
            {consultations.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
                <div className="text-5xl mb-3">🏥</div>
                <p className="text-surface-500 dark:text-surface-400">{t('v.vetpat.noConsults')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {consultations.map((c: Consultation) => (
                  <div key={c.id} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Stethoscope className="w-5 h-5 text-primary-500" />
                      <span className="font-semibold text-surface-900 dark:text-white">{t('v.vetpat.consultOn', { date: formatDate(c.date) })}</span>
                      {c.follow_up_date && (
                        <span className="ml-auto flex items-center gap-1 text-xs text-accent-700 bg-accent-50 px-2.5 py-0.5 rounded-full font-medium">
                          <Calendar className="w-3 h-3" />
                          {t('v.vetpat.followUp', { date: formatDate(c.follow_up_date) })}
                        </span>
                      )}
                    </div>
                    {c.diagnosis && (
                      <div className="mb-2 text-sm">
                        <span className="font-medium text-surface-700 dark:text-surface-200">{t('v.vetpat.diagnosis')} </span>
                        <span className="text-surface-600 dark:text-surface-300">{c.diagnosis}</span>
                      </div>
                    )}
                    {c.treatment && (
                      <div className="mb-2 text-sm">
                        <span className="font-medium text-surface-700 dark:text-surface-200">{t('v.vetpat.treatment')} </span>
                        <span className="text-surface-600 dark:text-surface-300">{c.treatment}</span>
                      </div>
                    )}
                    {c.notes && (
                      <div className="mt-2 p-3 bg-surface-50 dark:bg-surface-900/60 rounded-xl text-sm text-surface-600 dark:text-surface-300 italic">
                        {c.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Consultation modal */}
      <Modal open={showConsultModal} onClose={() => setShowConsultModal(false)} title={t('v.vetpat.addConsult')} size="lg">
        <form onSubmit={handleAddConsultation} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetpat.formDate')}</label>
              <input required type="date" value={consultForm.date} onChange={set('date')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetpat.formFollowUp')}</label>
              <input type="date" value={consultForm.follow_up_date} onChange={set('follow_up_date')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetpat.formDiagnosis')}</label>
            <textarea value={consultForm.diagnosis} onChange={set('diagnosis')} rows={3} placeholder={t('v.vetpat.formDiagnosisPh')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetpat.formTreatment')}</label>
            <textarea value={consultForm.treatment} onChange={set('treatment')} rows={3} placeholder={t('v.vetpat.formTreatmentPh')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetpat.formNotes')}</label>
            <textarea value={consultForm.notes} onChange={set('notes')} rows={2} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowConsultModal(false)} className="flex-1 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700/40 transition">{t('common.cancel')}</button>
            <button type="submit" disabled={submittingConsult} className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-60 transition flex items-center justify-center gap-2">
              {submittingConsult && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {submittingConsult ? t('v.vetpat.saving') : t('v.vetpat.addConsult')}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
