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
export function trackHappyMoment(_source: string): void {
  if (!isNative()) return
  const s = load()
  s.happy += 1

  const cooldownOk =
    !s.lastAskedAt || Date.now() - s.lastAskedAt > COOLDOWN_DAYS * 24 * 60 * 60 * 1000

  if (s.happy >= MIN_HAPPY_EVENTS && cooldownOk) {
    s.happy = 0
    s.lastAskedAt = Date.now()
    save(s)
    // pequeno delay pra não atropelar a animação de sucesso da tela
    setTimeout(() => { void ask() }, 1200)
    return
  }
  save(s)
}
