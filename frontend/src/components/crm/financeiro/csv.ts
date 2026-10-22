/**
 * Exporta uma tabela em CSV que abre direto no Excel em português:
 * separador ';', BOM UTF-8 e vírgula decimal.
 */
function cell(v: string | number | null): string {
  if (v == null) return ''
  const s = typeof v === 'number'
    ? (Number.isFinite(v) ? v.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 4 }) : '')
    : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null>>): void {
  if (typeof window === 'undefined') return
  const lines = [header, ...rows].map(r => r.map(cell).join(';'))
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
