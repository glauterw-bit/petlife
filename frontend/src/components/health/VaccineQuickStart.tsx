'use client'

import { useEffect, useState } from 'react'
import { Syringe, Check, Share2 } from 'lucide-react'
import { vaccines as vaccinesApi, reminders as remindersApi, petExport, type Vaccine } from '@/lib/api'
import { hapticSuccess, celebrate } from '@/lib/feedback'
import { trackHappyMoment } from '@/lib/review'
import { track } from '@/lib/track'
import { requestSoftUpsell } from '@/lib/softUpsell'
import { useT } from '@/contexts/LocaleContext'

/**
 * Quick-start pós-cadastro do pet: as 2 vacinas que importam, em 30 segundos.
 *
 * O degrau do funil era 75% cria pet → 12% registra vacina. O formulário
 * completo assusta; aqui são só duas datas — e "não sei" é resposta válida
 * (vira um lembrete de confirmar com o vet, não um beco sem saída).
 */

interface QuickPet { id: number; name: string; species: string }

interface RowState { date: string; unknown: boolean }

function polivalenteFor(species: string): string {
  return species === 'cat' ? 'V4 (Quádrupla felina)' : 'V10 (Polivalente)'
}

function plusDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function VaccineQuickStart({ pet, onCreated, onClose }: {
  pet: QuickPet
  onCreated: (v: Vaccine) => void
  onClose: () => void
}) {
  const t = useT()
  const today = new Date().toISOString().slice(0, 10)
  const names = [polivalenteFor(pet.species), 'Antirrábica']
  const [rows, setRows] = useState<RowState[]>([{ date: '', unknown: false }, { date: '', unknown: false }])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => { track('quickstart_shown') }, [])

  function setRow(i: number, patch: Partial<RowState>) {
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  const anyDate = rows.some(r => r.date && !r.unknown)
  const anyAnswered = rows.some(r => (r.date && !r.unknown) || r.unknown)

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      let created = 0
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        if (r.unknown || !r.date) continue
        const v = await vaccinesApi.create({
          pet_id: pet.id,
          name: names[i],
          date_given: r.date,
          next_due: plusDays(r.date, 365),
        })
        onCreated(v)
        created++
      }
      if (created === 0) {
        // "Não sei" nos dois: vira tarefa concreta em vez de beco sem saída.
        await remindersApi.create({
          pet_id: pet.id,
          title: t('h.qs.reminderTitle', { name: pet.name }),
          due_date: plusDays(today, 7),
          type: 'vacina',
        }).catch(() => {})
        onClose()
        return
      }
      void hapticSuccess()
      celebrate()
      trackHappyMoment('vacina_cadastrada')
      track('quickstart_saved')
      setSaved(true)
    } catch {
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function sharePdf() {
    if (sharing) return
    setSharing(true)
    try {
      await petExport.sharePdf(pet.id, pet.name)
      trackHappyMoment('pdf_export')
      requestSoftUpsell('pdf')
    } catch {} finally {
      setSharing(false)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slide-up shadow-2xl">
        {saved ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-emerald-50 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center mb-3">
              <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-display text-lg font-bold text-surface-900 dark:text-white mb-1">
              {t('h.qs.doneTitle', { name: pet.name })}
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">{t('h.qs.doneBody')}</p>
            <button
              onClick={sharePdf}
              disabled={sharing}
              className="w-full px-4 py-3.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition shadow-md shadow-primary-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sharing
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Share2 className="w-4 h-4" />}
              {t('h.qs.sharePdf')}
            </button>
            <button
              onClick={onClose}
              className="mt-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition"
            >
              {t('h.qs.finish')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                <Syringe className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="font-display text-lg font-bold text-surface-900 dark:text-white">
                {t('h.qs.title', { name: pet.name })}
              </h3>
            </div>
            <p className="text-xs text-surface-500 dark:text-surface-400 mb-5">{t('h.qs.subtitle')}</p>

            <div className="space-y-4 mb-5">
              {names.map((name, i) => (
                <div key={name}>
                  <div className="text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5">
                    💉 {name}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      max={today}
                      value={rows[i].date}
                      disabled={rows[i].unknown}
                      onChange={e => setRow(i, { date: e.target.value, unknown: false })}
                      aria-label={t('h.qs.lastDose', { vaccine: name })}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-40"
                    />
                    <button
                      onClick={() => setRow(i, { unknown: !rows[i].unknown })}
                      aria-pressed={rows[i].unknown}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium transition ${
                        rows[i].unknown
                          ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-surface-200 dark:border-surface-600 text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700/50'
                      }`}
                    >
                      {t('h.qs.dontKnow')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={save}
              disabled={saving || !anyAnswered}
              className="w-full px-4 py-3.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition shadow-md shadow-primary-500/30 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {anyDate ? t('h.qs.save') : t('h.qs.saveUnknown')}
            </button>
            <button
              onClick={() => { track('quickstart_skipped'); onClose() }}
              className="mt-2 w-full px-4 py-2 rounded-xl text-xs font-medium text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition"
            >
              {t('h.qs.skip')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
