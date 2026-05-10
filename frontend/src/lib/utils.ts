import { format, differenceInYears, differenceInMonths, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(dateStr?: string | null, fmt = 'dd/MM/yyyy'): string {
  if (!dateStr) return '—'
  try {
    const d = parseISO(dateStr)
    if (!isValid(d)) return '—'
    return format(d, fmt, { locale: ptBR })
  } catch {
    return '—'
  }
}

export function formatAge(birthDate?: string | null): string {
  if (!birthDate) return '—'
  try {
    const d = parseISO(birthDate)
    if (!isValid(d)) return '—'
    const now = new Date()
    const years = differenceInYears(now, d)
    if (years > 0) return `${years} ano${years > 1 ? 's' : ''}`
    const months = differenceInMonths(now, d)
    if (months > 0) return `${months} mês${months > 1 ? 'es' : ''}`
    return 'Filhote'
  } catch {
    return '—'
  }
}

export function calculatePetAge(birthDate?: string | null): { years: number; months: number } {
  if (!birthDate) return { years: 0, months: 0 }
  try {
    const d = parseISO(birthDate)
    const now = new Date()
    const years = differenceInYears(now, d)
    const months = differenceInMonths(now, d) % 12
    return { years, months }
  } catch {
    return { years: 0, months: 0 }
  }
}

export function getBadgeColor(level: number): string {
  if (level >= 10) return 'bg-purple-100 text-purple-700 border-purple-300'
  if (level >= 7) return 'bg-yellow-100 text-yellow-700 border-yellow-300'
  if (level >= 4) return 'bg-blue-100 text-blue-700 border-blue-300'
  return 'bg-green-100 text-green-700 border-green-300'
}

export function getEnergyLabel(level?: number): string {
  if (!level) return '—'
  if (level <= 2) return 'Baixa energia'
  if (level <= 3) return 'Energia moderada'
  if (level <= 4) return 'Alta energia'
  return 'Energia muito alta'
}

export function getSizeLabel(size?: string): string {
  const map: Record<string, string> = {
    small: 'Pequeno',
    medium: 'Médio',
    large: 'Grande',
    giant: 'Gigante',
  }
  return size ? (map[size] ?? size) : '—'
}

export function getSpeciesEmoji(species?: string): string {
  if (species === 'dog') return '🐕'
  if (species === 'cat') return '🐈'
  return '🐾'
}

export function getSpeciesLabel(species?: string): string {
  if (species === 'dog') return 'Cachorro'
  if (species === 'cat') return 'Gato'
  return 'Outro'
}

export function getVaccineStatus(nextDueDate?: string | null): 'up_to_date' | 'upcoming' | 'overdue' {
  if (!nextDueDate) return 'up_to_date'
  try {
    const d = parseISO(nextDueDate)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    const days = diff / (1000 * 60 * 60 * 24)
    if (days < 0) return 'overdue'
    if (days <= 30) return 'upcoming'
    return 'up_to_date'
  } catch {
    return 'up_to_date'
  }
}

export function getLevelName(level: number): string {
  const names = [
    'Iniciante',
    'Cuidador',
    'Amigo dos Pets',
    'Protetor',
    'Guardião',
    'Mestre',
    'Expert',
    'Veterinário Honorário',
    'Lenda',
    'Mito',
  ]
  return names[Math.min(level - 1, names.length - 1)] ?? 'Iniciante'
}

export function getDifficultyLabel(difficulty: string): string {
  const map: Record<string, string> = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' }
  return map[difficulty] ?? difficulty
}

export function getDifficultyColor(difficulty: string): string {
  if (difficulty === 'easy') return 'text-green-600 bg-green-50 border-green-200'
  if (difficulty === 'medium') return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  return 'text-red-600 bg-red-50 border-red-200'
}
