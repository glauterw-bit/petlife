/**
 * Tradução fora do React (avisos locais, utilitários puros).
 *
 * Mesma regra do LocaleContext: idioma salvo em 'petlife_locale' (ou o do
 * aparelho), chave no idioma → senão pt-BR → senão a própria chave.
 * Interpolação {x}.
 */
import { DICTS } from './dict'
import { coerceLocale, detectLocale, DEFAULT_LOCALE, type Locale } from './types'

const STORAGE_KEY = 'petlife_locale'

export function getLocale(): Locale {
  try {
    const saved = typeof localStorage !== 'undefined' ? coerceLocale(localStorage.getItem(STORAGE_KEY)) : null
    if (saved) return saved
  } catch { /* sem storage */ }
  try {
    return detectLocale()
  } catch {
    return DEFAULT_LOCALE
  }
}

export function tr(key: string, vars?: Record<string, string | number>): string {
  const locale = getLocale()
  const raw = DICTS[locale]?.[key] ?? DICTS['pt-BR'][key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}
