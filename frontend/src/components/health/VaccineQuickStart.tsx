'use client'

import { useEffect, useId, useState } from 'react'
import { Camera, ChevronRight, Info, Share2, Syringe, UserPlus } from 'lucide-react'
import { SharePetModal } from '@/components/innovations/SharePetModal'
import { vaccines as vaccinesApi, reminders as remindersApi, petExport, type Vaccine } from '@/lib/api'
import { haptic } from '@/lib/feedback'
import { trackHappyMoment } from '@/lib/review'
import { track } from '@/lib/track'
import { requestSoftUpsell } from '@/lib/softUpsell'
import { useT } from '@/contexts/LocaleContext'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { SuccessCheck } from '@/components/ui/SuccessCheck'
import { useHideAssistant } from '@/components/layout/shell'
import { cn, plusDaysISO, todayLocalISO } from '@/lib/utils'
import { ageInWeeks, vaccineNextDueDays } from '@/lib/care'

/**
 * Quick-start pós-cadastro do pet: as 2 vacinas que importam, em 30 segundos.
 *
 * O degrau do funil era 75% cria pet → 12% registra vacina. O formulário
 * completo assusta; aqui são só duas datas — e "não sei" é resposta válida
 * (vira um lembrete de confirmar com o vet, não um beco sem saída).
 * Quem tem a carteirinha de papel vai direto para a leitura por foto.
 *
 * "Não sei" se desdobra em duas saídas, nenhuma grava data estimada:
 *  - "Vou ver na carteirinha" → lembrete de confirmar em 7 dias;
 *  - "Nunca tomou"            → lembrete de agendar a 1ª dose em 7 dias.
 *
 * Filhote (< 16 semanas): a polivalente é dada em série, a cada 2–4 semanas
 * até 16 semanas ou mais (WSAVA 2024) — a próxima dose sugerida é em 3
 * semanas, sempre com o aviso de ajustar ao que o veterinário indicar.
 */

interface QuickPet { id: number; name: string; species: string; birth_date?: string | null }

type UnknownReason = 'check' | 'never'
interface RowState { date: string; unknown: boolean; reason: UnknownReason }

const EMPTY_ROW: RowState = { date: '', unknown: false, reason: 'check' }

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
  const today = todayLocalISO()
  // Nome gravado na vacina no idioma do aparelho; normalizeVaccineName + RABIES
  // (lib/care) reconhecem a antirrábica em pt/en/es.
  const names = [t(pet.species === 'cat' ? 'h2.qs.poli.cat' : 'h2.qs.poli.dog'), t('h2.qs.rabies')]
  const series = vaccineNextDueDays(pet.birth_date)
  const weeks = ageInWeeks(pet.birth_date)
  const [rows, setRows] = useState<RowState[]>([{ ...EMPTY_ROW }, { ...EMPTY_ROW }])
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
  const allUnknown = rows.every(r => r.unknown)
  /** Intervalo da próxima dose por linha: série de filhote só na polivalente. */
  const nextDays = (i: number) => (i === 0 ? series.days : 365)

  /** Lembretes das linhas "Não sei" — tarefa concreta em vez de beco sem saída. */
  async function createUnknownReminders() {
    const due = plusDaysISO(today, 7)
    const jobs: Promise<unknown>[] = []
    if (rows.some(r => r.unknown && r.reason === 'check')) {
      jobs.push(remindersApi.create({
        pet_id: pet.id,
        title: t('h.qs.reminderTitle', { name: pet.name }),
        due_date: due,
        type: 'vaccine',
      }))
    }
    rows.forEach((r, i) => {
      if (!r.unknown || r.reason !== 'never') return
      jobs.push(remindersApi.create({
        pet_id: pet.id,
        title: t('h2.qs.firstDoseTitle', { vaccine: names[i], name: pet.name }),
        due_date: due,
        type: 'vaccine',
      }))
    })
    await Promise.all(jobs.map(j => j.catch(() => {})))
  }

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
          next_due: plusDaysISO(r.date, nextDays(i)),
        })
        onCreated(v)
        created.push(v)
      }
      await createUnknownReminders()
      if (created.length === 0) {
        haptic('saved')
        onClose()
        return
      }
      haptic('saved')
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
          className={cn(
            'pressable-card w-full mb-5 flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-[box-shadow,background-color,border-color] duration-200',
            allUnknown
              ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-500/40 shadow-card dark:border-primary-400 dark:bg-primary-500/15'
              : 'border-primary-200 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10',
          )}
        >
          <span className="w-11 h-11 rounded-xl bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-surface-900 dark:text-white">{t('care.qsPhotoTitle')}</span>
            <span className="block text-[13px] text-surface-600 dark:text-surface-300">
              {allUnknown ? t('h2.qs.photoBoth') : t('care.qsPhotoDesc')}
            </span>
          </span>
          <ChevronRight className="w-5 h-5 text-primary-700 dark:text-primary-300 shrink-0" aria-hidden />
        </button>
      )}

      <div className="space-y-4 pb-1">
        {names.map((name, i) => (
          <div key={i}>
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

            {rows[i].unknown && (
              <div role="radiogroup" aria-label={t('h2.qs.unknownAria', { vaccine: name })} className="mt-2 grid grid-cols-2 gap-2 animate-fade-in">
                {(['check', 'never'] as const).map(reason => {
                  const active = rows[i].reason === reason
                  return (
                    <button
                      key={reason}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => { setRow(i, { reason }); haptic('toggle') }}
                      className={cn(
                        'pressable min-h-[44px] px-3 py-2 rounded-xl border text-[13px] font-semibold leading-tight text-center transition-colors',
                        active
                          ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-500/15 dark:text-primary-200'
                          : 'border-surface-200 text-surface-700 dark:border-surface-700 dark:text-surface-200',
                      )}
                    >
                      {reason === 'check' ? t('h2.qs.unknownCheck') : t('h2.qs.unknownNever')}
                    </button>
                  )
                })}
              </div>
            )}

            {series.puppy && rows[i].date && !rows[i].unknown && (
              <p className="mt-2 flex gap-2 text-[13px] leading-snug text-surface-700 dark:text-surface-200 bg-surface-50 dark:bg-surface-800/70 rounded-xl p-3 animate-fade-in">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary-700 dark:text-primary-300" aria-hidden />
                <span>
                  {i === 0
                    ? t('h2.qs.puppy', { name: pet.name, n: weeks ?? 0 })
                    : t('h2.qs.puppyRabies', { name: pet.name })}
                </span>
              </p>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  )
}
