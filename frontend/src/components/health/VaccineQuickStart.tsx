'use client'

import { useEffect, useId, useState } from 'react'
import { Camera, ChevronRight, Share2, Syringe, UserPlus } from 'lucide-react'
import { SharePetModal } from '@/components/innovations/SharePetModal'
import { vaccines as vaccinesApi, reminders as remindersApi, petExport, type Vaccine } from '@/lib/api'
import { hapticSuccess } from '@/lib/feedback'
import { trackHappyMoment } from '@/lib/review'
import { track } from '@/lib/track'
import { requestSoftUpsell } from '@/lib/softUpsell'
import { useT } from '@/contexts/LocaleContext'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { SuccessCheck } from '@/components/ui/SuccessCheck'
import { useHideAssistant } from '@/components/layout/shell'
import { cn } from '@/lib/utils'

/**
 * Quick-start pós-cadastro do pet: as 2 vacinas que importam, em 30 segundos.
 *
 * O degrau do funil era 75% cria pet → 12% registra vacina. O formulário
 * completo assusta; aqui são só duas datas — e "não sei" é resposta válida
 * (vira um lembrete de confirmar com o vet, não um beco sem saída).
 * Quem tem a carteirinha de papel vai direto para a leitura por foto.
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

export function VaccineQuickStart({ pet, onCreated, onClose, onPhoto, onDone }: {
  pet: QuickPet
  onCreated: (v: Vaccine) => void
  onClose: () => void
  /** Tem a carteirinha de papel? Abre a leitura por foto (a IA preenche tudo). */
  onPhoto?: () => void
  /** Chamado uma vez, com as vacinas criadas, quando o registro termina. */
  onDone?: (created: Vaccine[]) => void
}) {
  const t = useT()
  const uid = useId()
  const today = new Date().toISOString().slice(0, 10)
  const names = [polivalenteFor(pet.species), 'Antirrábica']
  const [rows, setRows] = useState<RowState[]>([{ date: '', unknown: false }, { date: '', unknown: false }])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sharing, setSharing] = useState(false)
  // convite contextual: quem cuida junto (parceiro, família) — antes ficava
  // escondido no perfil do pet e nunca foi usado
  const [inviteOpen, setInviteOpen] = useState(false)
  useHideAssistant(true)

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
      const created: Vaccine[] = []
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
        created.push(v)
      }
      if (created.length === 0) {
        // "Não sei" nos dois: vira tarefa concreta em vez de beco sem saída.
        await remindersApi.create({
          pet_id: pet.id,
          title: t('h.qs.reminderTitle', { name: pet.name }),
          due_date: plusDays(today, 7),
          type: 'vaccine',
        }).catch(() => {})
        onClose()
        return
      }
      void hapticSuccess()
      trackHappyMoment('vacina_cadastrada')
      track('quickstart_saved')
      setSaved(true)
      onDone?.(created)
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

  if (inviteOpen) {
    return <SharePetModal petId={pet.id} petName={pet.name} open onClose={() => { setInviteOpen(false); onClose() }} />
  }

  if (saved) {
    return (
      <Sheet
        open
        onClose={onClose}
        ariaLabel={t('h.qs.doneTitle', { name: pet.name })}
        footer={
          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth leftIcon={Share2} loading={sharing} onClick={sharePdf}>
              {t('h.qs.sharePdf')}
            </Button>
            <Button variant="soft" fullWidth leftIcon={UserPlus} onClick={() => { track('quickstart_invite'); setInviteOpen(true) }}>
              {t('h.qs.invite')}
            </Button>
            <Button variant="ghost" fullWidth onClick={onClose}>
              {t('h.qs.finish')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center text-center pt-3 pb-1">
          <SuccessCheck size={64} />
          <h2 className="mt-4 font-display text-xl font-extrabold text-surface-900 dark:text-white">
            {t('h.qs.doneTitle', { name: pet.name })}
          </h2>
          <p className="mt-1.5 text-[15px] text-surface-600 dark:text-surface-300 max-w-xs">{t('h.qs.doneBody')}</p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      onClose={() => { track('quickstart_skipped'); onClose() }}
      title={t('h.qs.title', { name: pet.name })}
      description={t('h.qs.subtitle')}
      footer={
        <div className="flex flex-col gap-2">
          <Button size="lg" fullWidth loading={saving} disabled={!anyAnswered} onClick={save}>
            {anyDate ? t('h.qs.save') : t('h.qs.saveUnknown')}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => { track('quickstart_skipped'); onClose() }}>
            {t('h.qs.skip')}
          </Button>
        </div>
      }
    >
      {onPhoto && (
        <button
          type="button"
          onClick={() => { track('quickstart_photo'); onPhoto() }}
          className="pressable w-full mb-5 flex items-center gap-3 p-3.5 rounded-2xl border border-primary-200 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10 text-left"
        >
          <span className="w-11 h-11 rounded-xl bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-surface-900 dark:text-white">{t('care.qsPhotoTitle')}</span>
            <span className="block text-[13px] text-surface-600 dark:text-surface-300">{t('care.qsPhotoDesc')}</span>
          </span>
          <ChevronRight className="w-5 h-5 text-primary-700 dark:text-primary-300 shrink-0" aria-hidden />
        </button>
      )}

      <div className="space-y-4 pb-1">
        {names.map((name, i) => (
          <div key={name}>
            <label htmlFor={`${uid}-${i}`} className="flex items-center gap-1.5 text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5">
              <Syringe className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
              {t('h.qs.lastDose', { vaccine: name })}
            </label>
            <div className="flex gap-2">
              <input
                id={`${uid}-${i}`}
                type="date"
                max={today}
                value={rows[i].date}
                disabled={rows[i].unknown}
                onChange={e => setRow(i, { date: e.target.value, unknown: false })}
                className="flex-1 min-h-[48px] px-3.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-[15px] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => setRow(i, { unknown: !rows[i].unknown })}
                aria-pressed={rows[i].unknown}
                className={cn(
                  'pressable min-h-[48px] px-4 rounded-xl border text-sm font-semibold transition-colors',
                  rows[i].unknown
                    ? 'border-primary-500 bg-primary-50 text-primary-800 dark:bg-primary-500/15 dark:text-primary-200'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800',
                )}
              >
                {t('h.qs.dontKnow')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
