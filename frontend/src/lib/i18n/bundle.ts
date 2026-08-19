import type { Dict, Locale } from './types'

/** Um módulo de tradução carrega os 3 idiomas juntos. */
export type LocaleBundle = Record<Locale, Dict>

/**
 * Junta vários módulos num dicionário por idioma.
 * Módulos separados existem para que várias frentes de tradução possam
 * trabalhar em paralelo sem colidir no mesmo arquivo.
 */
export function mergeBundles(bundles: LocaleBundle[]): Record<Locale, Dict> {
  const out: Record<Locale, Dict> = { 'pt-BR': {}, en: {}, es: {} }
  for (const b of bundles) {
    for (const loc of Object.keys(out) as Locale[]) {
      Object.assign(out[loc], b[loc] ?? {})
    }
  }
  return out
}
