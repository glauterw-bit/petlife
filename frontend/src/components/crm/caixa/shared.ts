'use client'

import { Banknote, Clock, CreditCard, FileText, QrCode, type LucideIcon } from 'lucide-react'
import { isCrmError, type PayMethod } from '@/lib/crmApi'

/** Formas que entram no caixa (fiado fica de fora). */
export const CASH_METHODS: Array<Exclude<PayMethod, 'fiado'>> = ['dinheiro', 'pix', 'debito', 'credito', 'boleto']

export const PAY_SHORT: Record<string, string> = {
  pix: 'Pix', dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito', boleto: 'Boleto', fiado: 'Fiado',
}
export const PAY_ICON: Record<string, LucideIcon> = {
  pix: QrCode, dinheiro: Banknote, debito: CreditCard, credito: CreditCard, boleto: FileText, fiado: Clock,
}

export const errMsg = (e: unknown, fallback = 'Não foi possível concluir. Tente de novo.') =>
  e instanceof Error && e.message ? e.message : fallback

export const isCashClosed = (e: unknown) => isCrmError(e) && e.status === 409 && e.data?.code === 'cash_closed'

/** Leva a tela até a barra do caixa e foca o valor inicial. */
export function scrollToCashBar() {
  if (typeof document === 'undefined') return
  const el = document.getElementById('crm-cashbar')
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  setTimeout(() => (document.getElementById('crm-cash-open-amount') as HTMLInputElement | null)?.focus({ preventScroll: true }), 350)
}

/** Quantidade sem separador de milhar, com vírgula decimal ('0,5'). */
export const qtyText = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3, useGrouping: false })

/** Diferença do caixa: verde se zero, vermelha se faltar, âmbar se sobrar. */
export function diffTone(d: number | null | undefined) {
  if (d == null || Math.abs(d) < 0.005) return 'text-emerald-600 dark:text-emerald-400'
  return d < 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
}
export function diffLabel(d: number | null | undefined) {
  if (d == null || Math.abs(d) < 0.005) return 'Confere'
  return d < 0 ? 'Falta' : 'Sobra'
}
