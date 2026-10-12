'use client'

/**
 * Prompt de avaliação na App Store — pedido no MOMENTO FELIZ, nunca no primeiro uso.
 * Regras: só após 3+ momentos felizes, no máx. 1 pedido a cada 90 dias
 * (a Apple já limita a 3 exibições/ano por conta própria).
 *
 * Nativo: in-app review (SKStoreReviewController via @capacitor-community/in-app-review).
 * Fallback (plugin ausente no build): deep link pra página de avaliação.
 * Web: no-op.
 */

const KEY = 'petlife_review_v1'
const MIN_HAPPY_EVENTS = 3
// A própria Apple recomenda "at least a week or two between requests". Com 90
// dias, quem dispensava o primeiro prompt sumia por um trimestre inteiro — e o
// limite real (3 por ano) é da Apple, não nosso.
const COOLDOWN_DAYS = 21
const APP_ID = '6768136468'
// Momentos de valor entregue — o pedido de nota vem mais cedo depois deles
const STRONG_MOMENTS = new Set([
  'vacina_cadastrada', 'vacina_scan', 'pdf_export', 'carteirinha_whatsapp',
  'carteirinha_share', 'carteirinha_print', 'protection',
])

interface ReviewState {
  happy: number
  lastAskedAt: number | null
}

function isNative(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }
  return !!w.Capacitor?.isNativePlatform?.()
}

function load(): ReviewState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as ReviewState
  } catch {}
  return { happy: 0, lastAskedAt: null }
}

function save(s: ReviewState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {}
}

function isAndroid(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as typeof window & { Capacitor?: { getPlatform?: () => string } }
  return w.Capacitor?.getPlatform?.() === 'android'
}

/** Página de avaliação da loja certa para a plataforma. */
export function reviewUrl(): string {
  return isAndroid()
    ? `https://play.google.com/store/apps/details?id=app.petlife&showAllReviews=true`
    : `https://apps.apple.com/br/app/id${APP_ID}?action=write-review`
}

async function ask(): Promise<void> {
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review')
    await InAppReview.requestReview()
  } catch {
    // Build sem o plugin — abre a página de avaliação da loja correta.
    // Antes isto mandava usuário de Android para a App Store da Apple.
    try { window.open(reviewUrl(), '_blank') } catch {}
  }
}

/**
 * Janela nativa de estrelas (SKStoreReviewController), sem sair do app.
 * Para depois de um sinal claro de satisfação (nota 4-5 na pesquisa) — nunca
 * como resposta direta a um botão (pra botão, a Apple indica o deep link).
 * Devolve true se a chamada nativa foi feita (a Apple pode não exibir se o
 * limite de 3 por ano já foi atingido — não há como saber).
 */
export async function requestNativeReview(): Promise<boolean> {
  if (!isNative() || isAndroid()) return false
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review')
    await InAppReview.requestReview()
    const s = load()
    s.lastAskedAt = Date.now()
    save(s)
    return true
  } catch {
    return false
  }
}

/**
 * Pedido MANUAL de avaliação (botão nas configurações).
 *
 * Usa o deep link `action=write-review`, que a Apple documenta para botão
 * iniciado pelo usuário: NÃO consome os 3 prompts anuais, e é a única fonte
 * prática de review escrita — o prompt nativo converte 13,5% em nota, mas só
 * 0,07% em texto.
 */
export function openReviewPage(): void {
  try { window.open(reviewUrl(), '_blank') } catch {}
}

/**
 * Registra um momento feliz (check-in feito, passeio concluído, lembrete cumprido…).
 * Quando as condições de throttle são atendidas, dispara o pedido de avaliação.
 */
export function trackHappyMoment(source: string): void {
  if (!isNative()) return
  const s = load()
  s.happy += 1

  const cooldownOk =
    !s.lastAskedAt || Date.now() - s.lastAskedAt > COOLDOWN_DAYS * 24 * 60 * 60 * 1000

  // Momentos em que o app acabou de entregar o que promete (vacina salva,
  // carteirinha enviada) pedem a nota mais cedo: no 2º momento feliz.
  // A pesquisa própria era dispensada por 90% das pessoas e quase ninguém
  // chegava às estrelas; a janela nativa da Apple pede direto, sem sair do app.
  const needed = STRONG_MOMENTS.has(source) ? 2 : MIN_HAPPY_EVENTS

  if (s.happy >= needed && cooldownOk) {
    s.happy = 0
    s.lastAskedAt = Date.now()
    save(s)
    // pequeno delay pra não atropelar a animação de sucesso da tela
    setTimeout(() => {
      void ask()
      void import('@/lib/track').then(m => m.track('rate_prompt_native', { meta: source })).catch(() => {})
    }, 1200)
    return
  }
  save(s)
}

/** Quando foi o último pedido de nota neste aparelho (0 = nunca). */
export function lastReviewAskAt(): number {
  return load().lastAskedAt ?? 0
}
