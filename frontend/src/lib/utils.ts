import { format, differenceInYears, differenceInMonths, parseISO, isValid } from 'date-fns'
import { ptBR, enUS, es as esLocale } from 'date-fns/locale'

/**
 * Locale de datas. Fica num módulo simples (e não num React context) porque
 * formatDate/formatAge são funções puras chamadas de dezenas de lugares,
 * inclusive fora de componentes. O LocaleProvider chama setDateLocale() na
 * troca de idioma.
 */
type DateLocaleKey = 'pt-BR' | 'en' | 'es'
let _dateLocale: DateLocaleKey = 'pt-BR'
const DF = { 'pt-BR': ptBR, en: enUS, es: esLocale }
const DATE_FMT: Record<DateLocaleKey, string> = {
  'pt-BR': 'dd/MM/yyyy',
  en: 'MM/dd/yyyy',
  es: 'dd/MM/yyyy',
}

export function setDateLocale(l: DateLocaleKey) { _dateLocale = l }
export function getDateLocale(): DateLocaleKey { return _dateLocale }

/**
 * Tag de locale para `toLocaleDateString`/`toLocaleTimeString`.
 * Use no lugar de 'pt-BR' fixo, senão datas saem em português para
 * usuários de en/es.
 */
export function localeTag(): string {
  return _dateLocale === 'pt-BR' ? 'pt-BR' : _dateLocale === 'es' ? 'es-ES' : 'en-US'
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(dateStr?: string | null, fmt?: string): string {
  if (!dateStr) return '—'
  try {
    const d = parseISO(dateStr)
    if (!isValid(d)) return '—'
    return format(d, fmt ?? DATE_FMT[_dateLocale], { locale: DF[_dateLocale] })
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
    const months = differenceInMonths(now, d)
    const L = {
      'pt-BR': {
        y: (n: number) => `${n} ano${n > 1 ? 's' : ''}`,
        m: (n: number) => `${n} mês${n > 1 ? 'es' : ''}`,
        baby: 'Filhote',
      },
      en: {
        y: (n: number) => `${n} year${n > 1 ? 's' : ''}`,
        m: (n: number) => `${n} month${n > 1 ? 's' : ''}`,
        baby: 'Baby',
      },
      es: {
        y: (n: number) => `${n} año${n > 1 ? 's' : ''}`,
        m: (n: number) => `${n} mes${n > 1 ? 'es' : ''}`,
        baby: 'Cachorro',
      },
    }[_dateLocale]
    if (years > 0) return L.y(years)
    if (months > 0) return L.m(months)
    return L.baby
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

/** Nome do nível de gamificação, no idioma ativo. */
export function getLevelName(level: number): string {
  const NAMES: Record<DateLocaleKey, string[]> = {
    'pt-BR': [
      'Iniciante', 'Cuidador', 'Amigo dos Pets', 'Protetor', 'Guardião',
      'Mestre', 'Expert', 'Veterinário Honorário', 'Lenda', 'Mito',
    ],
    en: [
      'Beginner', 'Caregiver', 'Pet Friend', 'Protector', 'Guardian',
      'Master', 'Expert', 'Honorary Vet', 'Legend', 'Myth',
    ],
    es: [
      'Principiante', 'Cuidador', 'Amigo de las Mascotas', 'Protector', 'Guardián',
      'Maestro', 'Experto', 'Veterinario Honorario', 'Leyenda', 'Mito',
    ],
  }
  const names = NAMES[_dateLocale] ?? NAMES['pt-BR']
  return names[Math.min(level - 1, names.length - 1)] ?? names[0]
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
