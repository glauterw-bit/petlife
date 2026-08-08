'use client'

import { Download, FileText, Calendar, User, Trash2 } from 'lucide-react'
import { type Exam } from '@/lib/api'
import { formatDate } from '@/lib/utils'

interface ExamCardProps {
  exam: Exam
  onDelete?: (id: number) => void
}

const examTypeColors: Record<string, string> = {
  'hemograma': 'bg-red-50 text-red-700',
  'urina': 'bg-yellow-50 text-yellow-700',
  'raio-x': 'bg-blue-50 text-blue-700',
  'ultrassom': 'bg-purple-50 text-purple-700',
  'fezes': 'bg-amber-50 text-amber-700',
  'default': 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300',
}

export function ExamCard({ exam, onDelete }: ExamCardProps) {
  const colorKey = Object.keys(examTypeColors).find(k => exam.type?.toLowerCase().includes(k)) ?? 'default'
  const colorClass = examTypeColors[colorKey]

  return (
    <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-100 dark:border-surface-700 p-4 hover:border-primary-200 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h4 className="font-semibold text-surface-900 dark:text-white">{exam.name}</h4>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${colorClass}`}>
              {exam.type}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(exam.date)}
            </div>
            {exam.vet_name && (
              <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
                <User className="w-3.5 h-3.5" />
                Dr. {exam.vet_name}
              </div>
            )}
          </div>

          {exam.result && (
            <div className="mt-3 p-2.5 bg-surface-50 dark:bg-surface-900/60 rounded-lg">
              <p className="text-xs font-medium text-surface-700 dark:text-surface-200 mb-0.5">Resultado:</p>
              <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">{exam.result}</p>
            </div>
          )}

          {exam.notes && (
            <p className="mt-2 text-xs text-surface-500 dark:text-surface-400 italic">{exam.notes}</p>
          )}

          <div className="mt-3 flex items-center gap-3">
            {exam.file_url && (
              <a
                href={exam.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium transition"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar arquivo
              </a>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(exam.id)}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
