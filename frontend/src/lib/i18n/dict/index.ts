import type { Dict, Locale } from '../types'
import { dict as ptBR } from './pt-BR'

// ── Registro de dicionários ───────────────────────────────────────────
// Cada frente de tradução tem sua pasta em ./modules/<modulo>/ com um arquivo
// por idioma (pt-BR.ts, en.ts, es.ts). ./pt-BR.ts, ./en.ts e ./es.ts juntam os
// módulos de cada idioma. Para adicionar um módulo: crie a pasta com os 3
// arquivos e importe-a nos 3 agregadores.
// `scripts/check-i18n.mjs` valida a paridade de chaves entre os 3 idiomas.
//
// Só o pt-BR (padrão e fallback) entra no bundle inicial, de forma síncrona:
// o HTML do servidor e o primeiro quadro nunca mostram chave crua. en/es são
// chunks separados, baixados sob demanda quando o idioma é ativado.

/** Dicionário pt-BR, sempre disponível (fallback de qualquer chave). */
export const FALLBACK_DICT: Dict = ptBR

const loaded: Partial<Record<Locale, Dict>> = { 'pt-BR': ptBR }
const pending: Partial<Record<Locale, Promise<Dict>>> = {}

const LOADERS: Record<Exclude<Locale, 'pt-BR'>, () => Promise<Dict>> = {
  en: () => import(/* webpackChunkName: "i18n-en" */ './en').then(m => m.dict),
  es: () => import(/* webpackChunkName: "i18n-es" */ './es').then(m => m.dict),
}

/** Dicionário do idioma se já estiver carregado (pt-BR sempre está). */
export function getDict(locale: Locale): Dict | undefined {
  return loaded[locale]
}

/** Baixa (uma vez) o dicionário do idioma. Falha de rede permite nova tentativa. */
export function loadLocale(locale: Locale): Promise<Dict> {
  const ready = loaded[locale]
  if (ready) return Promise.resolve(ready)
  const inflight = pending[locale]
  if (inflight) return inflight
  const p = LOADERS[locale as Exclude<Locale, 'pt-BR'>]()
    .then(d => {
      loaded[locale] = d
      return d
    })
    .finally(() => {
      delete pending[locale]
    })
  pending[locale] = p
  return p
}
