'use client'

/**
 * Convite de plano nos momentos de valor (carteirinha exportada, retrospectiva
 * aberta, terceiro pet). Nunca bloqueia nada — só pede para o SoftUpsell
 * aparecer. O pedido fica guardado na sessão porque quase sempre a tela troca
 * logo depois da ação (o share sheet fecha, o cadastro navega).
 */
export type SoftUpsellReason = 'pdf' | 'recap' | 'pet3'

export const SOFT_UPSELL_EVENT = 'petlife:soft-upsell'
const PENDING_KEY = 'petlife_soft_upsell_pending'

export function requestSoftUpsell(reason: SoftUpsellReason): void {
  try {
    sessionStorage.setItem(PENDING_KEY, reason)
    window.dispatchEvent(new CustomEvent(SOFT_UPSELL_EVENT, { detail: { reason } }))
  } catch {}
}

export function peekSoftUpsell(): SoftUpsellReason | null {
  try {
    return sessionStorage.getItem(PENDING_KEY) as SoftUpsellReason | null
  } catch {
    return null
  }
}

export function clearSoftUpsell(): void {
  try { sessionStorage.removeItem(PENDING_KEY) } catch {}
}
