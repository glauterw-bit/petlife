/**
 * Cor de cada pet: a que a pessoa escolheu (`theme_color`) ou, para pets que
 * ainda não escolheram, uma da paleta fixa, sempre a mesma para o mesmo id.
 * Todas têm contraste AA (≥ 4,5:1) com texto branco.
 */
export const PET_COLORS = [
  '#0f766e', // verde-água
  '#2563eb', // azul
  '#7c3aed', // roxo
  '#be185d', // rosa
  '#c2410c', // laranja
  '#b45309', // âmbar
  '#4d7c0f', // oliva
  '#475569', // grafite
] as const

const HEX = /^#[0-9a-f]{6}$/i

export function isPetColor(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v)
}

export function petColor(pet: { id?: number; theme_color?: string | null }): string {
  if (isPetColor(pet.theme_color)) return pet.theme_color
  const id = Math.abs(Math.trunc(Number(pet.id) || 0))
  return PET_COLORS[id % PET_COLORS.length]
}
