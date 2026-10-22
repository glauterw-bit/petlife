'use client'

import { Clock } from 'lucide-react'
import type { Appt } from '@/lib/crmApi'
import { APPT_TYPE, minutesBetween } from '@/components/crm/ui'

/** Mensagem legível de um erro qualquer. */
export function errMsg(e: unknown, fallback = 'Não foi possível concluir. Tente de novo.'): string {
  return e instanceof Error && e.message ? e.message : fallback
}

export const firstName = (s?: string | null) => (s || '').trim().split(/\s+/)[0] || ''

/** O que é o atendimento: serviço do catálogo ou tipo. */
export const serviceOf = (a: Pick<Appt, 'item_name' | 'type'>) => a.item_name || APPT_TYPE[a.type] || a.type

export const IN_CLINIC = ['chegou', 'em_atendimento', 'pronto']

/** 'há 12 min', 'há 1 h 05' a partir de um horário do servidor. */
export function elapsedLabel(iso: string, now: Date): { label: string; minutes: number } {
  const m = Math.max(0, minutesBetween(iso, now.toISOString()))
  if (m < 1) return { label: 'agora', minutes: 0 }
  if (m < 60) return { label: `há ${m} min`, minutes: m }
  const h = Math.floor(m / 60)
  const r = m % 60
  return { label: `há ${h} h${r ? ` ${String(r).padStart(2, '0')}` : ''}`, minutes: m }
}

/** Tempo de espera desde a chegada (ou o início do atendimento). Âmbar acima do limite. */
export function WaitTime({ since, now, warnAfter = 20, prefix }: { since: string | null; now: Date; warnAfter?: number; prefix?: string }) {
  if (!since) return null
  const { label, minutes } = elapsedLabel(since, now)
  const warn = minutes > warnAfter
  return (
    <span className={`inline-flex items-center gap-1 text-xs tabular-nums ${warn ? 'text-amber-700 dark:text-amber-300 font-semibold' : 'text-muted'}`}>
      <Clock className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />
      {prefix ? `${prefix} ${label}` : label}
    </span>
  )
}

/** Data local 'dd/mm'. */
export const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

/** Abre um link do WhatsApp em nova aba. */
export function openWa(url: string) {
  if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
}
