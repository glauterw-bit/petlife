/**
 * Ritmo de passeio no formato de relógio ("12:45"), para ser exibido com a
 * unidade por extenso (t('wk2.pace') → "12:45 min/km"). As aspas de corrida
 * (12'45") não são lidas por quem não corre e quebram em leitores de tela.
 */
export function paceClock(secPerKm?: number | null): string | null {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return null
  const total = Math.round(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
