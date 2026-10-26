'use client'

import { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { Shield, Pill, Bug, Check, ChevronRight, type LucideIcon } from 'lucide-react'
import { protections, type ProtectionPetSummary, type ProtectionKindStatus, type Pet } from '@/lib/api'
import { hapticLight, hapticSuccess, hapticError } from '@/lib/feedback'
import { trackHappyMoment } from '@/lib/review'
import { useT } from '@/contexts/LocaleContext'
import { useCached, invalidate } from '@/lib/cache'
import { daysUntil, type CareState } from '@/lib/care'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { careStateLabel } from '@/components/ui/StatusBadge'

/**
 * Proteção em dia — vermífugo e antipulgas por pet.
 *
 * Vacina é evento anual; antiparasitário vence a cada 30–90 dias. Este card
 * é o motor de retorno legítimo do app: cada registro arma o próximo aviso.
 * Usa o mesmo cache 'protections' do Início (lib/cache), então registrar aqui
 * atualiza o Anel de proteção na hora.
 */

export type ProtectionKind = 'vermifugo' | 'antipulgas'

export interface ProtectionCardHandle {
  /** Abre a folha de registro para um pet e um tipo (usado pela próxima ação do herói). */
  openRegister(petId: number, kind: ProtectionKind): void
}

const KIND_META: Record<ProtectionKind, { Icon: LucideIcon; labelKey: string; intervals: number[]; fallbackInterval: number }> = {
  vermifugo: { Icon: Pill, labelKey: 'h.prot.vermifugo', intervals: [30, 60, 90, 180], fallbackInterval: 90 },
  antipulgas: { Icon: Bug, labelKey: 'h.prot.antipulgas', intervals: [30, 60, 90], fallbackInterval: 30 },
}

const KINDS: ProtectionKind[] = ['vermifugo', 'antipulgas']

const CHIP: Record<CareState, string> = {
  ok: 'chip-success',
  soon: 'chip-warning',
  overdue: 'chip-danger',
  never: 'chip-neutral',
}

function toState(k: ProtectionKindStatus | undefined): CareState {
  if (!k || k.status === 'never') return 'never'
  return k.status === 'due_soon' ? 'soon' : k.status
}

function kindDays(k: ProtectionKindStatus | undefined): number | null {
  if (!k) return null
  if (k.next_due) return daysUntil(k.next_due)
  return k.days_left
}

interface SheetState {
  petId: number
  kind: ProtectionKind
  /** Aberto pelo cartão "nenhum registro": mostra o seletor de pet. */
  pickPet: boolean
}

function localToday(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const ProtectionCard = forwardRef<
  ProtectionCardHandle,
  {
    pets: Pet[]
    /** Chamado depois que o registro foi salvo e o cache recarregado. */
    onSaved?: (petId: number, kind: ProtectionKind) => void
    /** false = só a folha de registro (sem o cartão). */
    showCard?: boolean
  }
>(function ProtectionCard({ pets, onSaved, showCard = true }, ref) {
  const t = useT()
  const { data, refresh } = useCached('protections', () => protections.summary())
  const summary: ProtectionPetSummary[] = data?.pets ?? []

  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [product, setProduct] = useState('')
  const [interval, setIntervalDays] = useState(30)
  const today = localToday()
  const [appliedOn, setAppliedOn] = useState(today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  const statusOf = useCallback(
    (petId: number, kind: ProtectionKind) => summary.find(p => p.pet_id === petId)?.kinds.find(k => k.kind === kind),
    [summary],
  )

  const open = useCallback(
    (petId: number, kind: ProtectionKind, pickPet = false) => {
      void hapticLight()
      const k = statusOf(petId, kind)
      setProduct(k?.product ?? '')
      setIntervalDays(k?.interval_days ?? KIND_META[kind].fallbackInterval)
      setAppliedOn(localToday())
      setError(false)
      setSheet({ petId, kind, pickPet })
    },
    [statusOf],
  )

  useImperativeHandle(ref, () => ({ openRegister: (petId, kind) => open(petId, kind) }), [open])

  function switchPet(petId: number) {
    if (!sheet) return
    const k = statusOf(petId, sheet.kind)
    setProduct(k?.product ?? '')
    setIntervalDays(k?.interval_days ?? KIND_META[sheet.kind].fallbackInterval)
    setSheet({ ...sheet, petId })
  }

  async function save() {
    if (!sheet || saving) return
    setSaving(true)
    setError(false)
    try {
      await protections.register(sheet.petId, {
        kind: sheet.kind,
        product: product.trim() || undefined,
        interval_days: interval,
        // meio-dia evita o fuso jogar a data pro dia anterior
        applied_at: `${appliedOn}T12:00:00`,
      })
      void hapticSuccess()
      trackHappyMoment('protection')
      const saved = sheet
      setSheet(null)
      invalidate('protections')
      await refresh()
      onSaved?.(saved.petId, saved.kind)
    } catch {
      void hapticError()
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const sheetPet = sheet ? pets.find(p => p.id === sheet.petId) : undefined
  const meta = sheet ? KIND_META[sheet.kind] : null
  const nextDate = (() => {
    const d = new Date(`${appliedOn}T12:00:00`)
    d.setDate(d.getDate() + interval)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  })()

  const known = summary.filter(s => pets.some(p => p.id === s.pet_id))
  const allNever = known.length > 0 && known.every(s => KINDS.every(k => toState(s.kinds.find(x => x.kind === k)) === 'never'))

  const fieldCls =
    'w-full px-3.5 min-h-[44px] rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-[15px] text-surface-900 dark:text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <>
      {showCard && pets.length > 0 && known.length > 0 && (
        allNever ? (
          <Card padding="md" className="mb-6">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" aria-hidden />
              </span>
              <p className="text-sm text-surface-700 dark:text-surface-200 leading-snug pt-0.5">{t('home.prot.allNever')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {KINDS.map(k => (
                <Button key={k} variant="soft" leftIcon={KIND_META[k].Icon} onClick={() => open(known[0].pet_id, k, pets.length > 1)}>
                  {t(KIND_META[k].labelKey)}
                </Button>
              ))}
            </div>
          </Card>
        ) : (
          <Card padding="none" className="mb-6">
            <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1">
              <Shield className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
              <h2 className="text-sm font-bold text-surface-900 dark:text-white">{t('home.prot.title')}</h2>
            </div>
            <ul className="divide-y divide-surface-100 dark:divide-surface-800">
              {known.map(p => {
                const pet = pets.find(x => x.id === p.pet_id)
                return (
                  <li key={p.pet_id} className="px-4 py-2.5">
                    {known.length > 1 && (
                      <div className="flex items-center gap-2 mb-1.5">
                        {pet && <PetAvatar pet={pet} size={22} />}
                        <span className="text-xs font-semibold text-surface-600 dark:text-surface-300 truncate">{p.pet_name}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {KINDS.map(kind => {
                        const k = p.kinds.find(x => x.kind === kind)
                        const state = toState(k)
                        const { Icon } = KIND_META[kind]
                        return (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => open(p.pet_id, kind)}
                            aria-label={`${t(KIND_META[kind].labelKey)} — ${p.pet_name}: ${careStateLabel(t, state, kindDays(k))}`}
                            className="pressable min-h-[48px] flex items-center gap-2 rounded-xl px-2.5 py-2 text-left bg-surface-50 hover:bg-surface-100 dark:bg-surface-800/60 dark:hover:bg-surface-800 transition-colors"
                          >
                            <span className={cn('chip !p-0 w-8 h-8 justify-center shrink-0 !rounded-lg', CHIP[state])}>
                              <Icon className="w-4 h-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-surface-900 dark:text-white truncate">{t(KIND_META[kind].labelKey)}</span>
                              <span className="block text-[11px] text-surface-600 dark:text-surface-400 truncate">{careStateLabel(t, state, kindDays(k))}</span>
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-surface-400 shrink-0" aria-hidden />
                          </button>
                        )
                      })}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      )}

      <Sheet
        open={!!sheet && !!meta}
        onClose={() => setSheet(null)}
        title={sheet && meta ? `${t(meta.labelKey)}${sheetPet ? ` — ${sheetPet.name}` : ''}` : undefined}
        description={t('h.prot.modalHint')}
        footer={
          <div>
            <Button fullWidth size="lg" leftIcon={Check} loading={saving} onClick={save}>
              {appliedOn === today ? t('h.prot.save') : t('h.prot.savePast')}
            </Button>
            <p className="text-xs text-center text-surface-600 dark:text-surface-400 mt-2.5">
              {t('h.prot.nextDateHint', { date: nextDate })}
            </p>
          </div>
        }
      >
        {sheet && meta && (
          <div className="space-y-4">
            {sheet.pickPet && pets.length > 1 && (
              <div>
                <span className="block text-xs font-semibold text-surface-700 dark:text-surface-200 mb-1.5">{t('home.prot.pickPet')}</span>
                <SegmentedControl
                  ariaLabel={t('home.prot.pickPet')}
                  options={pets.map(p => ({ value: String(p.id), label: p.name }))}
                  value={String(sheet.petId)}
                  onChange={v => switchPet(Number(v))}
                />
              </div>
            )}

            <div>
              <label htmlFor="prot-product" className="block text-xs font-semibold text-surface-700 dark:text-surface-200 mb-1">
                {t('h.prot.product')} <span className="font-normal text-surface-500 dark:text-surface-400">({t('common.optional')})</span>
              </label>
              <input
                id="prot-product"
                value={product}
                onChange={e => setProduct(e.target.value)}
                maxLength={120}
                placeholder={t('h.prot.productPh')}
                className={fieldCls}
              />
            </div>

            <div>
              <label htmlFor="prot-when" className="block text-xs font-semibold text-surface-700 dark:text-surface-200 mb-1">
                {t('h.prot.when')}
              </label>
              <input
                id="prot-when"
                type="date"
                value={appliedOn}
                max={today}
                onChange={e => setAppliedOn(e.target.value || today)}
                className={fieldCls}
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-surface-700 dark:text-surface-200 mb-1.5">{t('h.prot.interval')}</span>
              <div className="flex gap-2" role="group" aria-label={t('h.prot.interval')}>
                {meta.intervals.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setIntervalDays(d); void hapticLight() }}
                    aria-pressed={interval === d}
                    className={cn(
                      'pressable flex-1 min-h-[44px] rounded-xl border text-sm font-medium transition-colors',
                      interval === d
                        ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-500/15 dark:text-primary-200'
                        : 'border-surface-200 text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800',
                    )}
                  >
                    {t('h.prot.days', { d })}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p role="alert" className="chip chip-danger w-full justify-center py-2">{t('ui.retry')}</p>
            )}
          </div>
        )}
      </Sheet>
    </>
  )
})
