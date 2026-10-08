'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { vaccines as vaccinesApi, type Vaccine } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'

/**
 * Corrigir uma vacina já registrada (nome, datas, veterinário, lote, observação).
 * Antes só dava pra excluir e cadastrar de novo — tutores reclamavam que
 * "corrigir dados é ruim" e acabavam criando registros duplicados.
 */
const inputCls = 'w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800 text-surface-900 dark:text-white'
const labelCls = 'block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5'
const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '')

export function EditVaccineModal({ vaccine, onClose, onSaved }: {
  vaccine: Vaccine | null
  onClose: () => void
  onSaved: (v: Vaccine) => void
}) {
  const t = useT()
  const { success, error } = useToast()
  const [form, setForm] = useState({ name: '', date_given: '', next_due: '', veterinarian: '', lot_number: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!vaccine) return
    setForm({
      name: vaccine.name ?? '', date_given: day(vaccine.date_given), next_due: day(vaccine.next_due),
      veterinarian: vaccine.veterinarian ?? '', lot_number: vaccine.lot_number ?? '', notes: vaccine.notes ?? '',
    })
  }, [vaccine])

  if (!vaccine) return null
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!vaccine || saving) return
    if (!form.name.trim() || !form.date_given) { error(t('h.vac.editRequired')); return }
    setSaving(true)
    try {
      const updated = await vaccinesApi.update(vaccine.id, {
        name: form.name.trim(),
        date_given: `${form.date_given}T12:00:00`,
        next_due: form.next_due ? `${form.next_due}T12:00:00` : undefined,
        veterinarian: form.veterinarian.trim() || undefined,
        lot_number: form.lot_number.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      success(t('h.vac.editSaved'))
      onSaved(updated)
      onClose()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('h.vac.editError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('h.vac.editTitle')} size="lg">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>{t('h.vac.fName')} *</label>
          <input value={form.name} onChange={set('name')} maxLength={120} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('h.vac.fGiven')} *</label>
            <input type="date" value={form.date_given} onChange={set('date_given')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('h.vac.fNext')}</label>
            <input type="date" value={form.next_due} onChange={set('next_due')} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('h.vac.fVet')}</label>
            <input value={form.veterinarian} onChange={set('veterinarian')} maxLength={120} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('h.vac.fLot')}</label>
            <input value={form.lot_number} onChange={set('lot_number')} maxLength={60} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('h.vac.fNotes')}</label>
          <textarea rows={2} value={form.notes} onChange={set('notes')} maxLength={500} className={inputCls} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-semibold text-surface-700 dark:text-surface-200">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
