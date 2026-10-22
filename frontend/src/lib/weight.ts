/**
 * Lê o peso digitado pelo tutor, em kg. Aceita "4,5", "4.5 kg", "800g", "800 g"
 * (filhotes costumam ser pesados em gramas). Devolve null se não der para ler.
 */
export function parseWeightKg(raw: string): number | null {
  const s = raw.trim().toLowerCase()
  const m = s.match(/\d+(?:[.,]\d+)?/)
  if (!m) return null
  let w = parseFloat(m[0].replace(',', '.'))
  const grams = /\d\s*g\b|gramas?/.test(s) && !/kg|quilo/.test(s)
  if (grams) w = w / 1000
  if (!isFinite(w) || w <= 0 || w > 200) return null
  return Math.round(w * 1000) / 1000
}
