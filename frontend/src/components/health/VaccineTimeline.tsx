'use client'

/**
 * Lista de vacinas com situação calculada no cliente (lib/care): só a dose
 * mais recente de cada vacina conta; as anteriores aparecem como
 * "Substituída" e nunca ficam "atrasadas" para sempre.
 *
 * Usada em /health/vaccines (agrupada por urgência), na ficha do pet e no
 * painel do vet (lista simples). Os props antigos continuam iguais.
 */
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ChevronDown, FileText, MoreHorizontal, Pencil, Plus, Syringe, Trash2 } from 'lucide-react'
import { type Pet, type Vaccine } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { EditVaccineModal } from '@/components/health/EditVaccineModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { useConfirm } from '@/components/ui/Confirm'
import { cn } from '@/lib/utils'
import { hapticWarning } from '@/lib/feedback'
import { invalidate } from '@/lib/cache'
import { daysUntil, isSuperseded, sortByUrgency, vaccineState } from '@/lib/care'
import { dur, easeOut } from '@/lib/motion'

type TFn = (key: string, vars?: Record<string, string | number>) => string
type RowState = 'ok' | 'soon' | 'overdue' | 'superseded'

export type UrgencyGroup = 'overdue' | 'soon' | 'ok' | 'previous'

interface VaccineTimelineProps {
  vaccines: Vaccine[]
  onDelete?: (id: number) => void | Promise<void>
  /** Quando presente, cada vacina ganha "Editar" (corrigir sem excluir). */
  onUpdated?: (v: Vaccine) => void
  /** Mostra foto e nome do pet em cada cartão (lista com vários pets). */
  showPet?: boolean
  pets?: Pet[]
  /** Seções Atrasadas → Vencem em breve → Em dia → Doses anteriores. */
  groupByUrgency?: boolean
  /** Pergunta antes de excluir (folha de confirmação). Desligado por padrão
   *  porque telas antigas já perguntam por conta própria. */
  confirmDelete?: boolean
  /** Botão "Registrar dose" nas vacinas atrasadas ou vencendo. */
  onRegisterDose?: (v: Vaccine) => void
  /** Mudar este número abre "Doses anteriores" (ex.: logo após um reforço). */
  revealPreviousKey?: number
  /** Ação do estado vazio. */
  emptyCta?: { label: string; onClick: () => void }
}

/** "Venceu há 3 dias" · "Vence em 12 dias" · "Vence hoje" — neutro em gênero. */
export function vaccineDueLabel(t: TFn, v: Vaccine): string | null {
  if (!v.next_due) return null
  const d = daysUntil(v.next_due)
  if (d < 0) return d === -1 ? t('care.overdueOne') : t('care.overdueBy', { n: Math.abs(d) })
  if (d === 0) return t('care.dueToday')
  if (d === 1) return t('care.dueOne')
  return t('care.dueIn', { n: d })
}

const LEAD_TONE: Record<RowState, string> = {
  overdue: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  soon: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  superseded: 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400',
}

function VaccineCard({
  v,
  state,
  pet,
  showPet,
  canEdit,
  canDelete,
  onMore,
  onRegisterDose,
}: {
  v: Vaccine
  state: RowState
  pet?: Pet
  showPet: boolean
  canEdit: boolean
  canDelete: boolean
  onMore: (v: Vaccine) => void
  onRegisterDose?: (v: Vaccine) => void
}) {
  const t = useT()
  const due = vaccineDueLabel(t, v)
  const superseded = state === 'superseded'
  const badge =
    state === 'superseded' ? (
      <StatusBadge state="superseded" />
    ) : state === 'ok' ? (
      <StatusBadge state="ok" />
    ) : (
      <StatusBadge state={state}>{due ?? undefined}</StatusBadge>
    )
  const vet = v.veterinarian
    ? /^\s*dr[a]?\.?\s/i.test(v.veterinarian)
      ? v.veterinarian
      : t('h.vac.doctor', { name: v.veterinarian })
    : null

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 bg-white dark:bg-surface-900 border-surface-200/70 dark:border-surface-800',
        superseded && 'bg-surface-50 dark:bg-surface-900/50',
      )}
    >
      <div className="flex items-start gap-3">
        {showPet && pet ? (
          <PetAvatar pet={pet} size={40} className={superseded ? 'opacity-70' : undefined} />
        ) : (
          <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', LEAD_TONE[state])}>
            <Syringe className="w-5 h-5" aria-hidden />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <h4
            className={cn(
              'font-semibold text-[15px] leading-snug',
              superseded ? 'text-surface-600 dark:text-surface-400' : 'text-surface-900 dark:text-white',
            )}
          >
            {v.name}
          </h4>
          {showPet && pet && <p className="text-xs font-medium text-surface-500 dark:text-surface-400">{pet.name}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">{badge}</div>
        </div>
        {(canEdit || canDelete) && (
          <IconButton
            icon={MoreHorizontal}
            label={t('care.actions', { name: v.name })}
            className="-mr-2 -mt-1.5"
            onClick={() => onMore(v)}
          />
        )}
      </div>

      <div className={'mt-3 pl-[52px] flex flex-wrap gap-x-3 gap-y-1 text-xs'}>
        <span className="text-surface-600 dark:text-surface-400">{t('care.applied', { date: formatDate(v.date_given) })}</span>
        <span className="text-surface-600 dark:text-surface-400">
          {v.next_due ? t('care.next', { date: formatDate(v.next_due) }) : t('care.noNext')}
        </span>
        {v.lot_number && <span className="text-surface-500 dark:text-surface-500">{t('care.lot', { lot: v.lot_number })}</span>}
        {vet && <span className="text-surface-500 dark:text-surface-500">{vet}</span>}
      </div>
      {v.notes && <p className="mt-1.5 pl-[52px] text-xs text-surface-500 dark:text-surface-400 italic">{v.notes}</p>}

      {(v.document_path || (onRegisterDose && (state === 'overdue' || state === 'soon'))) && (
        <div className="mt-3 pl-[52px] flex flex-wrap items-center gap-2">
          {onRegisterDose && (state === 'overdue' || state === 'soon') && (
            <Button
              size="sm"
              variant={state === 'overdue' ? 'primary' : 'soft'}
              leftIcon={Plus}
              onClick={() => onRegisterDose(v)}
            >
              {t('care.registerDose')}
            </Button>
          )}
          {v.document_path && (
            <a
              href={v.document_path}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline"
            >
              <FileText className="w-4 h-4" aria-hidden />
              {t('h.vac.viewDoc')}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export function VaccineTimeline({
  vaccines,
  onDelete,
  onUpdated,
  showPet = false,
  pets,
  groupByUrgency = false,
  confirmDelete = false,
  onRegisterDose,
  revealPreviousKey,
  emptyCta,
}: VaccineTimelineProps) {
  const t = useT()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Vaccine | null>(null)
  const [menuFor, setMenuFor] = useState<Vaccine | null>(null)
  const [showPrevious, setShowPrevious] = useState(false)

  useEffect(() => {
    if (revealPreviousKey) setShowPrevious(true)
  }, [revealPreviousKey])

  const petById = useMemo(() => new Map((pets ?? []).map(p => [p.id, p])), [pets])

  const groups = useMemo(() => {
    const latest: Vaccine[] = []
    const previous: Vaccine[] = []
    for (const v of vaccines) (isSuperseded(v, vaccines) ? previous : latest).push(v)
    const sorted = sortByUrgency(latest)
    previous.sort((a, b) => new Date(b.date_given).getTime() - new Date(a.date_given).getTime())
    return {
      overdue: sorted.filter(v => vaccineState(v) === 'overdue'),
      soon: sorted.filter(v => vaccineState(v) === 'soon'),
      ok: sorted.filter(v => vaccineState(v) === 'ok'),
      previous,
      flat: [...sorted, ...previous],
    }
  }, [vaccines])

  if (vaccines.length === 0) {
    return (
      <EmptyState
        icon={Syringe}
        title={t('h.timeline.empty')}
        text={t('h.timeline.emptyHint')}
        ctaLabel={emptyCta?.label}
        onCta={emptyCta?.onClick}
      />
    )
  }

  const canEdit = !!onUpdated
  const canDelete = !!onDelete

  async function askDelete(v: Vaccine) {
    setMenuFor(null)
    if (!onDelete) return
    if (confirmDelete) {
      const ok = await confirm({
        title: t('care.deleteTitle', { name: v.name }),
        message: t('care.deleteMsg'),
        confirmLabel: t('care.delete'),
        tone: 'danger',
      })
      if (!ok) return
    } else {
      void hapticWarning()
    }
    await Promise.resolve(onDelete(v.id))
    invalidate('vaccines')
  }

  const stateOf = (v: Vaccine, superseded: boolean): RowState => (superseded ? 'superseded' : vaccineState(v))

  const DOT: Record<RowState, string> = {
    overdue: 'bg-red-500',
    soon: 'bg-amber-500',
    ok: 'bg-emerald-500',
    superseded: 'bg-surface-300 dark:bg-surface-600',
  }

  const renderCard = (v: Vaccine, superseded: boolean, flat = false) => (
    <motion.li
      key={v.id}
      layout="position"
      layoutId={`vac-${v.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: dur.fast, ease: easeOut } }}
      transition={{ duration: dur.base, ease: easeOut }}
      className={cn('list-none', flat && 'relative pl-12')}
    >
      {flat && (
        <span
          aria-hidden
          className={cn(
            'absolute left-3.5 top-5 w-3 h-3 rounded-full ring-2 ring-surface-50 dark:ring-surface-950',
            DOT[stateOf(v, superseded)],
          )}
        />
      )}
      <VaccineCard
        v={v}
        state={stateOf(v, superseded)}
        pet={petById.get(v.pet_id) ?? v.pet}
        showPet={showPet}
        canEdit={canEdit}
        canDelete={canDelete}
        onMore={setMenuFor}
        onRegisterDose={superseded ? undefined : onRegisterDose}
      />
    </motion.li>
  )

  const section = (id: UrgencyGroup, title: string, list: Vaccine[]) =>
    list.length === 0 ? null : (
      <section key={id} id={`sec-${id}`} className="scroll-mt-24" aria-labelledby={`sec-${id}-title`}>
        <h3
          id={`sec-${id}-title`}
          className="mb-2.5 text-[13px] font-bold uppercase tracking-wide text-surface-600 dark:text-surface-300"
        >
          {title} <span className="text-surface-400 dark:text-surface-500 font-semibold">· {list.length}</span>
        </h3>
        <ul className="space-y-3">
          <AnimatePresence initial={false}>{list.map(v => renderCard(v, false))}</AnimatePresence>
        </ul>
      </section>
    )

  return (
    <>
      <LayoutGroup id="vaccine-timeline">
        {groupByUrgency ? (
          <div className="space-y-6">
            {section('overdue', t('care.secOverdue'), groups.overdue)}
            {section('soon', t('care.secSoon'), groups.soon)}
            {section('ok', t('care.secOk'), groups.ok)}
            {groups.previous.length > 0 && (
              <section id="sec-previous" className="scroll-mt-24">
                <button
                  type="button"
                  onClick={() => setShowPrevious(s => !s)}
                  aria-expanded={showPrevious}
                  aria-controls="sec-previous-list"
                  className="pressable w-full min-h-[44px] flex items-center justify-between gap-2 rounded-xl px-1 text-left text-[13px] font-bold uppercase tracking-wide text-surface-600 dark:text-surface-300"
                >
                  {t('care.secPrevious', { n: groups.previous.length })}
                  <ChevronDown
                    className={cn('w-5 h-5 transition-transform duration-200', showPrevious && 'rotate-180')}
                    aria-hidden
                  />
                </button>
                <AnimatePresence initial={false}>
                  {showPrevious && (
                    <motion.div
                      id="sec-previous-list"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: dur.base, ease: easeOut }}
                      className="overflow-hidden"
                    >
                      <p className="mt-1 mb-3 px-1 text-xs text-surface-500 dark:text-surface-400">{t('care.previousHint')}</p>
                      <ul className="space-y-3 pb-1">
                        <AnimatePresence initial={false}>{groups.previous.map(v => renderCard(v, true))}</AnimatePresence>
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}
          </div>
        ) : (
          <div className="relative">
            <div aria-hidden className="absolute left-5 top-2 bottom-2 w-0.5 bg-surface-200 dark:bg-surface-700" />
            <ul className="relative space-y-3">
              <AnimatePresence initial={false}>
                {groups.flat.map(v => renderCard(v, isSuperseded(v, vaccines), true))}
              </AnimatePresence>
            </ul>
          </div>
        )}
      </LayoutGroup>

      <Sheet
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        description={
          menuFor
            ? [petById.get(menuFor.pet_id)?.name, t('care.applied', { date: formatDate(menuFor.date_given) })]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      >
        <div className="flex flex-col gap-2 pb-1">
          {canEdit && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={Pencil}
              className="justify-start"
              onClick={() => {
                const v = menuFor
                setMenuFor(null)
                setEditing(v)
              }}
            >
              {t('care.edit')}
            </Button>
          )}
          {canDelete && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={Trash2}
              className="justify-start !text-red-700 dark:!text-red-300"
              onClick={() => menuFor && void askDelete(menuFor)}
            >
              {t('care.delete')}
            </Button>
          )}
        </div>
      </Sheet>

      <EditVaccineModal
        vaccine={editing}
        onClose={() => setEditing(null)}
        onSaved={v => {
          onUpdated?.(v)
          invalidate('vaccines')
        }}
      />
    </>
  )
}
