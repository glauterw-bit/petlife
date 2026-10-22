/**
 * Protocolos de vacinação usados só como SUGESTÃO da próxima dose.
 * O profissional sempre confere e pode mudar a data.
 */
export interface Protocol {
  id: string
  name: string
  species: 'dog' | 'cat' | 'any'
  rule: string
  /** dias até a próxima dose, a partir da dose aplicada agora (1 = primeira da série) */
  next: (dose: number) => number
}

const YEAR = 365

export const PROTOCOLS: Protocol[] = [
  { id: 'v10', name: 'V8/V10', species: 'dog', rule: '3 doses a cada 21 dias no filhote, depois reforço anual', next: d => (d < 3 ? 21 : YEAR) },
  { id: 'raiva', name: 'Antirrábica', species: 'any', rule: 'reforço anual', next: () => YEAR },
  { id: 'gripe', name: 'Gripe canina', species: 'dog', rule: '2 doses com 21 dias, depois reforço anual', next: d => (d < 2 ? 21 : YEAR) },
  { id: 'giardia', name: 'Giárdia', species: 'dog', rule: '2 doses com 21 dias, depois reforço anual', next: d => (d < 2 ? 21 : YEAR) },
  { id: 'v4v5', name: 'V4/V5 felina', species: 'cat', rule: '3 doses a cada 21 dias no filhote, depois reforço anual', next: d => (d < 3 ? 21 : YEAR) },
  { id: 'felv', name: 'FeLV', species: 'cat', rule: '2 doses com 21 dias, depois reforço anual', next: d => (d < 2 ? 21 : YEAR) },
]

const MATCH: Record<string, RegExp> = {
  v10: /\bv\s*-?\s*(8|10|11)\b|polivalente|m[uú]ltipla|v8\/v10/i,
  raiva: /r[aá]bica|raiva/i,
  gripe: /gripe|tosse dos canis|bordetel|kc\b/i,
  giardia: /gi[aá]rdia/i,
  v4v5: /\bv\s*-?\s*(3|4|5)\b|felina|v4\/v5/i,
  felv: /felv|leucemia/i,
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Protocolo que corresponde ao nome digitado (considerando a espécie), ou null. */
export function findProtocol(name: string, species?: string | null): Protocol | null {
  const n = (name || '').trim()
  if (!n) return null
  const exact = PROTOCOLS.find(p => norm(p.name) === norm(n))
  if (exact) return exact
  const fits = PROTOCOLS.filter(p => p.species === 'any' || !species || species === 'other' || p.species === species)
  // FeLV antes de V4/V5 e Antirrábica antes das polivalentes
  const order = ['felv', 'raiva', 'gripe', 'giardia', 'v4v5', 'v10']
  for (const id of order) {
    const p = fits.find(x => x.id === id)
    if (p && MATCH[id].test(n)) return p
  }
  return null
}

/** Protocolos sugeridos para a espécie do pet. */
export function protocolsFor(species?: string | null): Protocol[] {
  return PROTOCOLS.filter(p => p.species === 'any' || !species || species === 'other' || p.species === species)
}

/**
 * Número da dose aplicada agora: 1 + doses anteriores da mesma vacina que
 * formam uma série (intervalos de até 60 dias). Reforços anuais reiniciam
 * a série no último passo, então contam como "série completa".
 */
export function doseNumber(protocol: Protocol, appliedOn: string, previous: Array<{ name: string; date: string }>, species?: string | null): number {
  const target = new Date(`${appliedOn}T12:00:00`).getTime()
  const dates = previous
    .filter(p => findProtocol(p.name, species)?.id === protocol.id)
    .map(p => new Date(`${p.date.slice(0, 10)}T12:00:00`).getTime())
    .filter(t => Number.isFinite(t) && t < target)
    .sort((a, b) => b - a)
  if (!dates.length) return 1
  let dose = 1
  let cursor = target
  for (const t of dates) {
    const gap = (cursor - t) / 86400000
    if (gap > 60) {
      // dose anterior bem antes: é reforço de quem já completou a série
      return dose === 1 ? 99 : dose
    }
    dose++
    cursor = t
  }
  return dose
}

/** Data AAAA-MM-DD somando dias a outra data AAAA-MM-DD. */
export function addDays(ymdStr: string, days: number): string {
  const [y, m, d] = ymdStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
