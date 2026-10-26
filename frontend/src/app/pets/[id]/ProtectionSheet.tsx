'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { protections as protectionsApi } from '@/lib/api'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { useT } from '@/contexts/LocaleContext'
import { hapticError, hapticSelect } from '@/lib/feedback'
import { cn } from '@/lib/utils'

const INTERVALS: Record<'vermifugo' | 'antipulgas', number[]> = {
  vermifugo: [30, 60, 90, 180],
  antipulgas: [30, 60, 90],
}

/** Registro rápido de vermífugo/antipulgas direto da ficha (usa a mesma API do card de proteção). */
export function ProtectionSheet({
  open,
  onClose,
  petId,
  kind,
  defaultInterval,
  defaultProduct,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  petId: number
  kind: 'vermifugo' | 'antipulgas'
  defaultInterval?: number
  defaultProduct?: string | null
  onSaved: () => void
}) {
  const t = useT()
  const today = new Date().toISOString().slice(0, 10)
  const [product, setProduct] = useState('')
  const [appliedOn, setAppliedOn] = useState(today)
  const [interval, setIntervalDays] = useState(30)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setProduct(defaultProduct ?? '')
    setAppliedOn(new Date().toISOString().slice(0, 10))
    const opts = INTERVALS[kind]
    setIntervalDays(defaultInterval && defaultInterval > 0 ? defaultInterval : opts[0])
    setErr(null)
  }, [open, kind, defaultInterval, defaultProduct])

  const kindLabel = t(kind === 'vermifugo' ? 'ui.care.vermifugo' : 'ui.care.antipulgas')
  const options = Array.from(new Set([...INTERVALS[kind], interval])).sort((a, b) => a - b)

  async function save() {
    if (saving) return
    setSaving(true)
    setErr(null)
    try {
      await protectionsApi.register(petId, {
        kind,
        product: product.trim() || undefined,
        interval_days: interval,
        // meio-dia evita o fuso jogar a data para o dia anterior
        applied_at: `${appliedOn}T12:00:00`,
      })
      onSaved()
      onClose()
    } catch {
      void hapticError()
      setErr(t('petx.prot.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('petx.prot.title', { kind: kindLabel.toLowerCase() })}
      footer={
        <Button fullWidth size="lg" loading={saving} leftIcon={Check} onClick={save}>
          {t('petx.prot.save')}
        </Button>
      }
    >
      <div className="space-y-4 pb-1">
        <div>
          <label htmlFor="prot-product" className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
            {t('petx.prot.product')}
          </label>
          <input
            id="prot-product"
            value={product}
            onChange={e => setProduct(e.target.value)}
            maxLength={80}
            placeholder={t('h.prot.productPh')}
            className="w-full px-4 min-h-[44px] rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label htmlFor="prot-date" className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
            {t('petx.prot.date')}
          </label>
          <input
            id="prot-date"
            type="date"
            value={appliedOn}
            max={today}
            onChange={e => setAppliedOn(e.target.value || today)}
            className="w-full px-4 min-h-[44px] rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <fieldset>
          <legend className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('petx.prot.interval')}</legend>
          <div className="flex flex-wrap gap-2">
            {options.map(d => (
              <button
                key={d}
                type="button"
                aria-pressed={interval === d}
                onClick={() => {
                  void hapticSelect()
                  setIntervalDays(d)
                }}
                className={cn(
                  'pressable min-h-[44px] px-4 rounded-xl text-sm font-semibold border transition-colors',
                  interval === d
                    ? 'bg-primary-700 text-white border-primary-700 dark:bg-primary-500 dark:text-surface-950 dark:border-primary-500'
                    : 'bg-white text-surface-700 border-surface-200 dark:bg-surface-900 dark:text-surface-200 dark:border-surface-700',
                )}
              >
                {t('petx.prot.days', { n: d })}
              </button>
            ))}
          </div>
        </fieldset>
        {err && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {err}
          </p>
        )}
      </div>
    </Sheet>
  )
}
