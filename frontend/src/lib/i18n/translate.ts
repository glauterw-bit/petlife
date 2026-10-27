/**
 * Tradução fora do React (avisos locais, utilitários puros).
 *
 * Mesma regra do LocaleContext: idioma salvo em 'petlife_locale' (ou o do
 * aparelho), chave no idioma → senão pt-BR → senão a própria chave.
 * Interpolação {x}.
 *
 * en/es são carregados sob demanda (ver ./dict). Enquanto o dicionário do
 * idioma não chegou, a chave cai no pt-BR — mesma regra de chave faltando.
 */
import { FALLBACK_DICT, getDict, loadLocale } from './dict'
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

// No navegador, já começa a baixar o dicionário do idioma salvo/do aparelho
// assim que este módulo é avaliado — em paralelo com a hidratação.
if (typeof window !== 'undefined') {
  const initial = getLocale()
  if (initial !== DEFAULT_LOCALE) loadLocale(initial).catch(() => { /* LocaleProvider tenta de novo */ })
}

export function tr(key: string, vars?: Record<string, string | number>): string {
  const locale = getLocale()
  const raw = getDict(locale)?.[key] ?? FALLBACK_DICT[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}
