'use client'

import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes, KeyboardEvent } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, Cat, ChevronLeft, Dog, FlaskConical, Loader2, PawPrint, Pill, Scissors, Stethoscope, StickyNote, Syringe,
  type LucideIcon,
} from 'lucide-react'
import { AnimatedNumber, dur } from './motion'
import { Sparkline } from './kit/Charts'

/** Peças visuais do PetLife Clínica: desktop primeiro, funcionam no celular. */

export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const asDate = (iso: string) => new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z')
/** Data e hora do servidor (UTC sem fuso) como Date local. */
export const toDate = (iso: string) => asDate(iso)
export const fmtDate = (iso?: string | null) => (iso ? asDate(iso).toLocaleDateString('pt-BR') : '—')
export const fmtTime = (iso?: string | null) => (iso ? asDate(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')
export const fmtDateTime = (iso?: string | null) => (iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : '—')
export const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

export const SPECIES: Record<string, string> = { dog: 'Cão', cat: 'Gato', other: 'Outro' }
export const APPT_TYPE: Record<string, string> = {
  consulta: 'Consulta', vacina: 'Vacina', retorno: 'Retorno', banho: 'Banho', tosa: 'Tosa', banho_tosa: 'Banho e tosa',
  cirurgia: 'Cirurgia', exame: 'Exame', outro: 'Outro',
}

export type ApptStatus = 'agendado' | 'confirmado' | 'chegou' | 'em_atendimento' | 'pronto' | 'concluido' | 'faltou' | 'cancelado'

export const APPT_STATUS: Record<string, { label: string; cls: string; dot: string; block: string }> = {
  agendado: {
    label: 'Agendado',
    cls: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-200',
    dot: 'bg-surface-400',
    block: 'border-l-[3px] border-surface-400 bg-surface-400/10 dark:border-surface-500 dark:bg-surface-500/15',
  },
  confirmado: {
    label: 'Confirmado',
    cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    dot: 'bg-blue-500',
    block: 'border-l-[3px] border-blue-500 bg-blue-500/10 dark:border-blue-400 dark:bg-blue-400/15',
  },
  chegou: {
    label: 'Chegou',
    cls: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
    dot: 'bg-amber-500',
    block: 'border-l-[3px] border-amber-500 bg-amber-500/10 dark:border-amber-400 dark:bg-amber-400/15',
  },
  em_atendimento: {
    label: 'Em atendimento',
    cls: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
    dot: 'bg-purple-500',
    block: 'border-l-[3px] border-purple-500 bg-purple-500/10 dark:border-purple-400 dark:bg-purple-400/15',
  },
  pronto: {
    label: 'Pronto para retirar',
    cls: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
    dot: 'bg-teal-500',
    block: 'border-l-[3px] border-teal-500 bg-teal-500/10 dark:border-teal-400 dark:bg-teal-400/15',
  },
  concluido: {
    label: 'Concluído',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    block: 'border-l-[3px] border-emerald-500 bg-emerald-500/10 dark:border-emerald-400 dark:bg-emerald-400/15',
  },
  faltou: {
    label: 'Faltou',
    cls: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    dot: 'bg-red-500',
    block: 'border-l-[3px] border-red-500 bg-red-500/10 dark:border-red-400 dark:bg-red-400/15',
  },
  cancelado: {
    label: 'Cancelado',
    cls: 'bg-surface-100 text-surface-400 line-through dark:bg-surface-800 dark:text-surface-500',
    dot: 'bg-surface-300',
    block: 'border-l-[3px] border-surface-300 bg-surface-300/10 opacity-70 dark:border-surface-600 dark:bg-surface-600/15',
  },
}
export const APPT_FLOW: ApptStatus[] = ['agendado', 'confirmado', 'chegou', 'em_atendimento', 'pronto', 'concluido']
export const GROOMING_TYPES = ['banho', 'tosa', 'banho_tosa']

/** Próximo passo do atendimento. Finalizar é sempre pelo caixa. */
export function nextStep(a: { status: string; type: string }): { to: ApptStatus; label: string } | null {
  switch (a.status) {
    case 'agendado': return { to: 'confirmado', label: 'Confirmar' }
    case 'confirmado': return { to: 'chegou', label: 'Chegou' }
    case 'chegou': return { to: 'em_atendimento', label: 'Atender' }
    case 'em_atendimento': return GROOMING_TYPES.indexOf(a.type) >= 0 ? { to: 'pronto', label: 'Pronto' } : null
    default: return null
  }
}

export const RECORD_KIND: Record<string, string> = {
  consulta: 'Consulta', vacina: 'Vacina', exame: 'Exame', prescricao: 'Prescrição',
  banho_tosa: 'Banho e tosa', observacao: 'Observação', cirurgia: 'Cirurgia',
}
export const RECORD_META: Record<string, { label: string; Icon: LucideIcon; cls: string }> = {
  consulta: { label: 'Consulta', Icon: Stethoscope, cls: 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300' },
  vacina: { label: 'Vacina', Icon: Syringe, cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  exame: { label: 'Exame', Icon: FlaskConical, cls: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300' },
  prescricao: { label: 'Prescrição', Icon: Pill, cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  banho_tosa: { label: 'Banho e tosa', Icon: Scissors, cls: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  observacao: { label: 'Observação', Icon: StickyNote, cls: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300' },
  cirurgia: { label: 'Cirurgia', Icon: Activity, cls: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
}

export const PAY: Record<string, string> = {
  pix: 'Pix', dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito', boleto: 'Boleto', fiado: 'Fiado / a receber',
}
export const PAY_METHODS = ['pix', 'dinheiro', 'debito', 'credito', 'boleto', 'fiado'] as const
export const ROLE: Record<string, string> = { admin: 'Administrador', vet: 'Veterinário(a)', recepcao: 'Recepção', banho_tosa: 'Banho e tosa' }
export const PET_SIZE: Record<string, string> = { mini: 'Mini', pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande', gigante: 'Gigante' }
export const TEMPERAMENT: Record<string, string> = { docil: 'Dócil', agitado: 'Agitado', medroso: 'Medroso', agressivo: 'Agressivo' }

/** Link de WhatsApp com mensagem pronta (número brasileiro). */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length < 10) return null
  const n = d.length <= 11 ? `55${d}` : d
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

/* ───────── números, datas e textos ───────── */

function normalizeNumber(raw: string, money: boolean): number | null {
  let s = (raw ?? '').toString().trim().replace(/R\$\s?/i, '').replace(/\s/g, '')
  if (!s) return null
  let neg = false
  if (s[0] === '-') { neg = true; s = s.slice(1) }
  if (!/^[\d.,]+$/.test(s)) return null
  if (s.indexOf(',') >= 0) {
    // padrão brasileiro: ponto de milhar, vírgula decimal
    if (s.split(',').length > 2) return null
    const [int, dec] = s.split(',')
    if (int.indexOf('.') >= 0 && !/^\d{1,3}(\.\d{3})+$/.test(int)) return null
    s = `${int.replace(/\./g, '') || '0'}.${dec}`
  } else if (s.split('.').length > 2) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null
    s = s.replace(/\./g, '')
  } else if (money && /^[1-9]\d{0,2}\.\d{3}$/.test(s)) {
    s = s.replace('.', '')
  }
  if (!/^\d*\.?\d*$/.test(s) || s === '.' ) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return neg ? -n : n
}
/** '12,50'→12.5; '1.234,56'→1234.56; '12.5'→12.5; vazio ou inválido→null. */
export function parseMoney(s: string): number | null {
  const n = normalizeNumber(s, true)
  return n == null ? null : Math.round(n * 100) / 100
}
/** Igual ao parseMoney, para quantidade e peso ('0,5'→0.5). */
export function parseDecimal(s: string): number | null {
  return normalizeNumber(s, false)
}
/** 12.5→'12,50'; null→''. */
export function moneyInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toFixed(2).replace('.', ',')
}

/** Data sem fuso (AAAA-MM-DD…) → 'DD/MM/AAAA'. */
export function fmtDay(iso?: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'
}
const pad = (n: number) => String(n).padStart(2, '0')
/** Data local 'AAAA-MM-DD'. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function dayRange(d: Date): [Date, Date] {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  return [a, b]
}
/** Segunda 00:00 até a segunda seguinte. */
export function weekRange(d: Date): [Date, Date] {
  const off = (d.getDay() + 6) % 7
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate() - off)
  const b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7)
  return [a, b]
}
/** 'AAAA-MM' local. */
export function monthRange(ym: string): [Date, Date] {
  const [y, m] = ym.split('-').map(Number)
  return [new Date(y, m - 1, 1), new Date(y, m, 1)]
}
function localDayOf(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = asDate(iso)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
/** '3 anos', '7 meses', '' se vazio. */
export function ageFrom(birthIso?: string | null): string {
  if (!birthIso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthIso)
  if (!m) return ''
  const b = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const now = new Date()
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth())
  if (now.getDate() < b.getDate()) months--
  if (months < 0) return ''
  if (months < 1) return 'menos de 1 mês'
  if (months < 12) return months === 1 ? '1 mês' : `${months} meses`
  const y = Math.floor(months / 12)
  return y === 1 ? '1 ano' : `${y} anos`
}
/** 'hoje', 'amanhã', 'em 5 dias', 'ontem', 'há 3 dias' (pela data local). */
export function relDays(iso: string): string {
  if (!iso) return ''
  const t = new Date()
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  const diff = Math.round((localDayOf(iso).getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  if (diff === -1) return 'ontem'
  return diff > 0 ? `em ${diff} dias` : `há ${-diff} dias`
}
/** (11) 99999-9999 */
export function fmtPhone(p?: string | null): string {
  if (!p) return ''
  let d = p.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p
}
export function minutesBetween(aIso: string, bIso: string): number {
  return Math.round((asDate(bIso).getTime() - asDate(aIso).getTime()) / 60000)
}

/* ───────── componentes ───────── */

export function Card({ children, className = '', interactive, onClick }: { children: ReactNode; className?: string; interactive?: boolean; onClick?: () => void }) {
  const inter = interactive || !!onClick
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
  }
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? onKey : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`bg-panel rounded-2xl shadow-crm-card p-4 lg:p-5 ${inter ? 'cursor-pointer transition-shadow duration-200 hover:shadow-crm-pop focus-visible:shadow-crm-glow' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function PageHead({ title, sub, actions, back }: { title: string; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 lg:mb-6">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-0.5 text-sm font-medium text-muted hover:text-ink mb-1.5 -ml-1 rounded-md px-1">
          <ChevronLeft className="w-4 h-4" strokeWidth={1.75} /> {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-2xl lg:text-[28px] font-extrabold tracking-tight text-ink leading-tight">{title}</h1>
          {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
        </div>
        {actions && <div className="flex gap-2 flex-wrap items-center">{actions}</div>}
      </div>
    </div>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'soft' | 'outline'
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: LucideIcon
}
const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm dark:bg-primary-500 dark:hover:bg-primary-400 dark:text-surface-950',
  ghost: 'text-ink hover:bg-panel-2 dark:hover:bg-panel-2',
  outline: 'bg-panel text-ink shadow-crm-card hover:bg-panel-2',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25',
  soft: 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-300 dark:hover:bg-primary-500/25',
}
const BTN_SIZE = { sm: 'h-8 px-2.5 text-xs gap-1.5', md: 'h-9 px-3.5 text-sm gap-2', lg: 'h-11 px-5 text-[15px] gap-2' }

export function Btn({ variant = 'primary', size = 'md', loading, icon: Icon, className = '', children, disabled, type, ...p }: BtnProps) {
  // props que o motion.button tipa de outro jeito
  const { onDrag, onDragStart, onDragEnd, onAnimationStart, ...rest } = p
  void onDrag; void onDragStart; void onDragEnd; void onAnimationStart
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <motion.button
      {...rest}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ duration: dur.fast }}
      className={`inline-flex items-center justify-center shrink-0 whitespace-nowrap rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BTN_SIZE[size]} ${BTN_VARIANT[variant]} ${className}`}
    >
      {loading ? <Loader2 className={`${iconSize} animate-spin`} strokeWidth={2} aria-hidden /> : Icon ? <Icon className={iconSize} strokeWidth={1.75} aria-hidden /> : null}
      {children}
    </motion.button>
  )
}

const fieldCls = 'w-full h-9 px-3 rounded-lg border border-line bg-panel text-sm text-ink placeholder:text-muted/70 transition-shadow focus:outline-none focus:border-primary-500 focus:shadow-crm-glow disabled:opacity-60 dark:bg-panel-2/40'

export function Field({ label, children, className = '', hint, error }: { label: string; children: ReactNode; className?: string; hint?: string; error?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-xs font-semibold text-ink/80 mb-1">{label}</span>
      {children}
      {error ? <span role="alert" className="block text-xs text-red-600 dark:text-red-400 mt-1">{error}</span>
        : hint ? <span className="block text-xs text-muted mt-1">{hint}</span> : null}
    </label>
  )
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${fieldCls} ${p.className ?? ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${fieldCls} pr-8 ${p.className ?? ''}`} />
export const TextArea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${fieldCls} h-auto py-2 leading-relaxed ${p.className ?? ''}`} />

export type Tone = 'default' | 'good' | 'bad' | 'warn' | 'info' | 'brand'
const TONE_TEXT: Record<Tone, string> = {
  default: 'text-ink', good: 'text-emerald-600 dark:text-emerald-400', bad: 'text-red-600 dark:text-red-400',
  warn: 'text-amber-600 dark:text-amber-400', info: 'text-blue-600 dark:text-blue-400', brand: 'text-primary-600 dark:text-primary-400',
}
const TONE_BADGE: Record<Tone, string> = {
  default: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-200',
  good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  bad: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  warn: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  brand: 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
}

export function Kpi({ label, value, format, sub, tone = 'default', series, icon: Icon, href }: {
  label: string; value: ReactNode | number; format?: (n: number) => string; sub?: ReactNode; tone?: Tone
  series?: number[]; icon?: LucideIcon; href?: string
}) {
  const body = (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden />}{label}
      </p>
      {/* Valor quebra linha em vez de cortar: 'R$ 12.345,67' não pode virar 'R$ 12...' no celular. */}
      <p className={`text-[22px] leading-7 sm:text-kpi font-bold tabular-nums mt-1.5 break-words ${TONE_TEXT[tone]}`}>
        {typeof value === 'number' ? <AnimatedNumber value={value} format={format} /> : value}
      </p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      {series && series.length >= 2 && <Sparkline data={series} className={`mt-2 ${tone === 'default' ? 'text-primary-500' : TONE_TEXT[tone]}`} />}
    </div>
  )
  if (href) {
    return (
      <Link href={href} className="block rounded-2xl focus-visible:outline-none">
        <Card interactive className="h-full">{body}</Card>
      </Link>
    )
  }
  return <Card className="h-full">{body}</Card>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted py-6 text-center">{children}</p>
}

export function Badge({ children, cls, tone, dot, pulse }: { children: ReactNode; cls?: string; tone?: Tone; dot?: string; pulse?: boolean }) {
  const base = cls ?? TONE_BADGE[tone ?? 'default']
  return (
    <span className={`inline-flex items-center gap-1.5 text-2xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${base}`}>
      {dot && <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot} ${pulse ? 'animate-pulse-soft' : ''}`} />}
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const s = APPT_STATUS[status] ?? { label: status, cls: TONE_BADGE.default, dot: 'bg-surface-400', block: '' }
  return (
    <Badge cls={s.cls} dot={s.dot} pulse={status === 'em_atendimento'}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: dur.fast }}
        >
          {s.label}
        </motion.span>
      </AnimatePresence>
    </Badge>
  )
}

export function SpeciesIcon({ species, className = 'w-4 h-4' }: { species: string; className?: string }) {
  const I = species === 'dog' ? Dog : species === 'cat' ? Cat : PawPrint
  return <I className={className} strokeWidth={1.75} aria-label={SPECIES[species] ?? 'Pet'} />
}

export const CATEGORY: Record<string, string> = {
  consulta: 'Consultas', vacina: 'Vacinas', banho_tosa: 'Banho e tosa', exame: 'Exames', cirurgia: 'Cirurgias',
  medicamento: 'Medicamentos', racao: 'Ração', acessorio: 'Acessórios', higiene: 'Higiene', outros: 'Outros',
  service: 'Serviços', product: 'Produtos', aluguel: 'Aluguel', salarios: 'Salários', fornecedores: 'Fornecedores',
  impostos: 'Impostos', energia_agua: 'Energia e água', marketing: 'Marketing', manutencao: 'Manutenção',
}
export const catLabel = (c?: string | null) => (c ? CATEGORY[c] ?? c : '—')
