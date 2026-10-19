'use client'

import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes } from 'react'

/** Peças visuais do PetLife Clínica — desktop primeiro, funcionam no celular. */

export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const asDate = (iso: string) => new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z')
export const fmtDate = (iso?: string | null) => (iso ? asDate(iso).toLocaleDateString('pt-BR') : '—')
export const fmtTime = (iso?: string | null) => (iso ? asDate(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')
export const fmtDateTime = (iso?: string | null) => (iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : '—')
export const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

export const SPECIES: Record<string, string> = { dog: '🐶 Cão', cat: '🐱 Gato', other: '🐾 Outro' }
export const APPT_TYPE: Record<string, string> = {
  consulta: 'Consulta', vacina: 'Vacina', retorno: 'Retorno', banho: 'Banho', tosa: 'Tosa', banho_tosa: 'Banho e tosa',
  cirurgia: 'Cirurgia', exame: 'Exame', outro: 'Outro',
}
export const APPT_STATUS: Record<string, { label: string; cls: string }> = {
  agendado: { label: 'Agendado', cls: 'bg-surface-100 text-surface-700 dark:bg-surface-700 dark:text-surface-200' },
  confirmado: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  chegou: { label: 'Chegou', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  em_atendimento: { label: 'Em atendimento', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  concluido: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  faltou: { label: 'Faltou', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  cancelado: { label: 'Cancelado', cls: 'bg-surface-100 text-surface-400 line-through dark:bg-surface-800' },
}
export const RECORD_KIND: Record<string, string> = {
  consulta: '🩺 Consulta', vacina: '💉 Vacina', exame: '🧪 Exame', prescricao: '💊 Prescrição',
  banho_tosa: '✂️ Banho e tosa', observacao: '📝 Observação', cirurgia: '🏥 Cirurgia',
}
export const PAY: Record<string, string> = {
  pix: 'Pix', dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito', boleto: 'Boleto', fiado: 'Fiado / a receber',
}
export const ROLE: Record<string, string> = { admin: 'Administrador', vet: 'Veterinário(a)', recepcao: 'Recepção', banho_tosa: 'Banho e tosa' }

/** Link de WhatsApp com mensagem pronta (número brasileiro). */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length < 10) return null
  const n = d.length <= 11 ? `55${d}` : d
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 rounded-2xl p-4 md:p-5 ${className}`}>{children}</div>
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{title}</h1>
        {sub && <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function Btn({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft' }) {
  const v = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm',
    ghost: 'border border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300',
    soft: 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300',
  }[variant]
  return <button {...p} className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${v} ${className}`} />
}

const fieldCls = 'w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400'

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-semibold text-surface-600 dark:text-surface-300 mb-1">{label}</span>
      {children}
    </label>
  )
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${fieldCls} ${p.className ?? ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${fieldCls} ${p.className ?? ''}`} />
export const TextArea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${fieldCls} ${p.className ?? ''}`} />

export function Kpi({ label, value, sub, tone = 'default' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn' }) {
  const c = { default: 'text-surface-900 dark:text-white', good: 'text-emerald-600 dark:text-emerald-400', bad: 'text-red-600 dark:text-red-400', warn: 'text-amber-600 dark:text-amber-400' }[tone]
  return (
    <Card>
      <p className="text-xs font-medium text-surface-500 dark:text-surface-400">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${c}`}>{value}</p>
      {sub && <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">{sub}</p>}
    </Card>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-surface-500 dark:text-surface-400 py-6 text-center">{children}</p>
}

export function Badge({ children, cls = '' }: { children: ReactNode; cls?: string }) {
  return <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>
}
