'use client'

/**
 * Link público da carteirinha com rastreio — e a marca de "já enviou".
 *
 * O link que o tutor manda leva `?d=<destino>` (hotel, tosa, vet, outro, qr)
 * e, quando existe, `ref=<código de indicação>`. Nada de dado pessoal: o
 * destino é uma das opções fixas do "Enviar para…" e o código de indicação já
 * é público por natureza (o tutor o compartilha para ganhar dias). A página
 * pública repassa os dois à campanha da App Store e ao cadastro, e assim dá
 * para saber de qual envio veio cada instalação.
 */

/** Destinos aceitos no `?d=` (o que o "Enviar para…" pergunta, mais o QR do passe). */
export const CARD_DESTS = ['hotel', 'groomer', 'vet', 'other', 'qr'] as const
export type CardDest = (typeof CARD_DESTS)[number]

/** Código de indicação no formato do servidor (ex.: PET-AB12CD). */
const REF_RE = /^[A-Z0-9-]{4,24}$/i

export function withCardTracking(url: string, opts: { d?: CardDest; ref?: string | null }): string {
  const q = new URLSearchParams()
  if (opts.d) q.set('d', opts.d)
  if (opts.ref && REF_RE.test(opts.ref)) q.set('ref', opts.ref)
  const qs = q.toString()
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url
}

/** Lê `d` e `ref` da página pública, aceitando só valores conhecidos. */
export function readCardTracking(search: string): { d: CardDest | null; ref: string | null } {
  try {
    const q = new URLSearchParams(search)
    const d = q.get('d')
    const ref = q.get('ref')
    return {
      d: d && (CARD_DESTS as readonly string[]).includes(d) ? (d as CardDest) : null,
      ref: ref && REF_RE.test(ref) ? ref.toUpperCase() : null,
    }
  } catch {
    return { d: null, ref: null }
  }
}

/**
 * Marca local de que a carteirinha já foi enviada (WhatsApp, compartilhar ou
 * PDF pelo "Enviar para…"). Usada pelo guia de primeiros passos. Fica no
 * aparelho: o servidor só recebe o evento anônimo de envio, sem consulta.
 */
const SENT_KEY = 'petlife_card_sent_v1'

export function markCardSent(): void {
  try { localStorage.setItem(SENT_KEY, '1') } catch {}
}

export function cardSentBefore(): boolean {
  try { return localStorage.getItem(SENT_KEY) === '1' } catch { return false }
}
