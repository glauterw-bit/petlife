'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { APPT_STATUS, StatusBadge, type ApptStatus } from '../ui'
import { DropdownMenu } from './DropdownMenu'

/** Troca de situação com atualização otimista: volta à anterior se der erro. */
export function StatusMenu({ status, onChange, options, disabled }: {
  status: string; onChange: (s: ApptStatus) => void | Promise<void>; options?: ApptStatus[]; disabled?: boolean
}) {
  const [shown, setShown] = useState(status)
  const busy = useRef(false)
  useEffect(() => { if (!busy.current) setShown(status) }, [status])

  const pick = async (s: ApptStatus) => {
    const prev = shown
    setShown(s)
    busy.current = true
    try {
      await onChange(s)
    } catch {
      setShown(prev)
    } finally {
      busy.current = false
    }
  }

  if (disabled) return <StatusBadge status={shown} />
  const list = (options ?? (Object.keys(APPT_STATUS) as ApptStatus[])).filter(s => s !== shown)
  return (
    <DropdownMenu
      ariaLabel={`Situação: ${APPT_STATUS[shown]?.label ?? shown}. Trocar`}
      triggerClassName="inline-flex items-center gap-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-500 hover:opacity-90"
      trigger={<><StatusBadge status={shown} /><ChevronDown className="w-3.5 h-3.5 text-muted" strokeWidth={1.75} aria-hidden /></>}
      items={list.map(s => ({
        label: APPT_STATUS[s]?.label ?? s,
        onSelect: () => { void pick(s) },
      }))}
    />
  )
}
