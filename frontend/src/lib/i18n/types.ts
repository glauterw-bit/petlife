/**
 * Base do i18n do PetLife.
 *
 * Optamos por um dicionário próprio em vez de next-intl/react-i18next porque
 * o app roda dentro do Capacitor apontando para uma URL fixa (server.url) —
 * qualquer solução baseada em rotas /pt/, /en/ quebraria o shell nativo.
 * Aqui o idioma é estado do cliente: detectado do aparelho e persistido.
 */

export const LOCALES = ['pt-BR', 'en', 'es'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'pt-BR'

export const LOCALE_LABEL: Record<Locale, string> = {
  'pt-BR': 'Português',
  en: 'English',
  es: 'Español',
}

export const LOCALE_FLAG: Record<Locale, string> = {
  'pt-BR': '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸',
}

/** Dicionário plano: 'secao.chave' -> texto. */
export type Dict = Record<string, string>

/** Descobre o idioma a partir do aparelho (navigator.language). */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  const langs = [navigator.language, ...(navigator.languages ?? [])]
  for (const raw of langs) {
    const l = (raw || '').toLowerCase()
    if (l.startsWith('pt')) return 'pt-BR'
    if (l.startsWith('es')) return 'es'
    if (l.startsWith('en')) return 'en'
  }
  return DEFAULT_LOCALE
}

/** Normaliza qualquer string para um Locale suportado. */
export function coerceLocale(v: string | null | undefined): Locale | null {
  if (!v) return null
  const l = v.toLowerCase()
  if (l.startsWith('pt')) return 'pt-BR'
  if (l.startsWith('es')) return 'es'
  if (l.startsWith('en')) return 'en'
  return null
}
