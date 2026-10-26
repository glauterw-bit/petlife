'use client'

import { useEffect, useId, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { vaccines as vaccinesApi, type Vaccine } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { hapticSuccess, hapticError } from '@/lib/feedback'
import { useHideAssistant } from '@/components/layout/shell'

/**
 * Corrigir uma vacina já registrada (nome, datas, veterinário, lote, observação).
 * Antes só dava pra excluir e cadastrar de novo — tutores reclamavam que
 * "corrigir dados é ruim" e acabavam criando registros duplicados.
 */
export const vaccineInputCls =
  'w-full min-h-[48px] px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-900 text-surface-900 dark:text-white'
export const vaccineLabelCls = 'block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5'
const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '')

export function EditVaccineModal({ vaccine, onClose, onSaved }: {
  vaccine: Vaccine | null
  onClose: () => void
  onSaved: (v: Vaccine) => void
}) {
  const t = useT()
  const id = useId()
  const { success, error } = useToast()
  const [form, setForm] = useState({ name: '', date_given: '', next_due: '', veterinarian: '', lot_number: '', notes: '' })
  const [saving, setSaving] = useState(false)
  useHideAssistant(!!vaccine)

  useEffect(() => {
    if (!vaccine) return
    setForm({
      name: vaccine.name ?? '', date_given: day(vaccine.date_given), next_due: day(vaccine.next_due),
      veterinarian: vaccine.veterinarian ?? '', lot_number: vaccine.lot_number ?? '', notes: vaccine.notes ?? '',
    })
  }, [vaccine])

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
      void hapticSuccess()
      success(t('h.vac.editSaved'))
      onSaved(updated)
      onClose()
    } catch (e: unknown) {
      void hapticError()
      error(e instanceof Error ? e.message : t('h.vac.editError'))
    } finally {
      setSaving(false)
    }
  }

  const f = (k: string) => `${id}-${k}`

  return (
    <Modal open={!!vaccine} onClose={onClose} title={t('h.vac.editTitle')} size="lg">
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault()
          void save()
        }}
      >
        <div>
          <label htmlFor={f('name')} className={vaccineLabelCls}>{t('h.vac.fName')} *</label>
          <input id={f('name')} value={form.name} onChange={set('name')} maxLength={120} required className={vaccineInputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={f('given')} className={vaccineLabelCls}>{t('h.vac.fGiven')} *</label>
            <input id={f('given')} type="date" value={form.date_given} onChange={set('date_given')} required className={vaccineInputCls} />
          </div>
          <div>
            <label htmlFor={f('next')} className={vaccineLabelCls}>{t('h.vac.fNext')}</label>
            <input id={f('next')} type="date" value={form.next_due} onChange={set('next_due')} className={vaccineInputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={f('vet')} className={vaccineLabelCls}>{t('h.vac.fVet')}</label>
            <input id={f('vet')} value={form.veterinarian} onChange={set('veterinarian')} maxLength={120} className={vaccineInputCls} />
          </div>
          <div>
            <label htmlFor={f('lot')} className={vaccineLabelCls}>{t('h.vac.fLot')}</label>
            <input id={f('lot')} value={form.lot_number} onChange={set('lot_number')} maxLength={60} className={vaccineInputCls} />
          </div>
        </div>
        <div>
          <label htmlFor={f('notes')} className={vaccineLabelCls}>{t('h.vac.fNotes')}</label>
          <textarea id={f('notes')} rows={2} value={form.notes} onChange={set('notes')} maxLength={500} className={vaccineInputCls} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" fullWidth loading={saving}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
