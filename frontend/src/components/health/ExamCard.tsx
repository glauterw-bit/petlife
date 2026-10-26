'use client'

import { Download, FileText, Calendar, User, Trash2 } from 'lucide-react'
import { type Exam } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

interface ExamCardProps {
  exam: Exam
  onDelete?: (id: number) => void
}

/**
 * Rótulo traduzido dos tipos padrão de exame. O valor gravado no backend
 * continua em português — só a exibição muda de idioma.
 */
const EXAM_TYPE_KEYS: Record<string, string> = {
  'Hemograma': 'h.examType.hemograma',
  'Bioquímica': 'h.examType.bioquimica',
  'Urina (EAS)': 'h.examType.urina',
  'Fezes': 'h.examType.fezes',
  'Raio-X': 'h.examType.raiox',
  'Ultrassom': 'h.examType.ultrassom',
  'Eletrocardiograma': 'h.examType.ecg',
  'Oftalmológico': 'h.examType.oftalmologico',
  'Dermatológico': 'h.examType.dermatologico',
  'Outros': 'h.examType.outros',
}

export function examTypeLabel(type: string, t: (key: string) => string): string {
  const key = EXAM_TYPE_KEYS[type]
  return key ? t(key) : type
}

const examTypeColors: Record<string, string> = {
  'hemograma': 'chip-neutral',
  'urina': 'chip-neutral',
  'raio-x': 'chip-info',
  'ultrassom': 'chip-info',
  'fezes': 'chip-neutral',
  'default': 'chip-neutral',
}

export function ExamCard({ exam, onDelete }: ExamCardProps) {
  const t = useT()
  const colorKey = Object.keys(examTypeColors).find(k => exam.type?.toLowerCase().includes(k)) ?? 'default'
  const colorClass = examTypeColors[colorKey]

  return (
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/70 dark:border-surface-800 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary-50 dark:bg-primary-500/15 rounded-xl flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-primary-700 dark:text-primary-300" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h4 className="font-semibold text-surface-900 dark:text-white">{exam.name}</h4>
            <span className={`chip ${colorClass}`}>
              {examTypeLabel(exam.type, t)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
              <Calendar className="w-3.5 h-3.5" aria-hidden />
              {formatDate(exam.date)}
            </div>
            {exam.veterinarian && (
              <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
                <User className="w-3.5 h-3.5" aria-hidden />
                {t('h.vac.doctor', { name: exam.veterinarian })}
              </div>
            )}
          </div>

          {exam.result && (
            <div className="mt-3 p-2.5 bg-surface-50 dark:bg-surface-900/60 rounded-lg">
              <p className="text-xs font-medium text-surface-700 dark:text-surface-200 mb-0.5">{t('h.exams.resultLabel')}</p>
              <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">{exam.result}</p>
            </div>
          )}

          {exam.notes && (
            <p className="mt-2 text-xs text-surface-500 dark:text-surface-400 italic">{exam.notes}</p>
          )}

          <div className="mt-1 flex items-center gap-3">
            {exam.file_path && (
              <a
                href={exam.file_path}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 min-h-[44px] text-[13px] text-primary-700 dark:text-primary-300 hover:underline font-semibold"
              >
                <Download className="w-4 h-4" aria-hidden />
                {t('h.exams.download')}
              </a>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(exam.id)}
                className="pressable inline-flex items-center gap-1.5 min-h-[44px] px-2 -mr-2 rounded-xl text-[13px] font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10 ml-auto"
              >
                <Trash2 className="w-4 h-4" aria-hidden />
                {t('common.delete')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
