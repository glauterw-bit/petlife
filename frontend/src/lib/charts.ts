'use client'

/**
 * Primitivos de gráfico do PetLife (SVG puro, sem dependência externa).
 * Paletas categóricas VALIDADAS (lightness band + chroma + separação CVD ≥ metodologia
 * dataviz + contraste ≥ 3:1) para as superfícies clara (#fff) e escura (surface-800 #292524).
 * Rodar o validador do skill dataviz se alterar qualquer cor.
 */
import { useEffect, useState } from 'react'

// Paleta categórica — ordem FIXA (identidade segue a entidade, nunca é ciclada além de 5).
export const CHART_LIGHT = ['#059669', '#2563EB', '#D97706', '#7C3AED', '#DB2777'] as const
export const CHART_DARK = ['#0EA372', '#3B82F6', '#EA580C', '#8B5CF6', '#EC4899'] as const

// Tinta de texto/eixo (recessiva) e grade por tema.
export const CHART_INK = {
  light: { axis: '#78716c', grid: 'rgba(0,0,0,.06)', label: '#57534e' },
  dark: { axis: '#a8a29e', grid: 'rgba(255,255,255,.07)', label: '#d6d3d1' },
} as const

/** True quando o tema escuro está ativo (classe `dark` no html). Reage a mudanças. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const el = document.documentElement
    const read = () => setDark(el.classList.contains('dark'))
    read()
    const obs = new MutationObserver(read)
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

/** Paleta + tinta do tema atual, num hook só. */
export function useChartTheme() {
  const dark = useIsDark()
  return {
    dark,
    palette: dark ? CHART_DARK : CHART_LIGHT,
    ink: dark ? CHART_INK.dark : CHART_INK.light,
  }
}

/** Caminho suavizado (Catmull-Rom → curvas), evita bicos sem distorcer os dados. */
export function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  if (pts.length < 3) return 'M' + pts.map(p => `${p[0]},${p[1]}`).join(' L')
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

/** Parseia "10 - 15 kg" / "10–15" numa faixa [min,max] ou null. */
export function parseRange(s?: string | null): [number, number] | null {
  if (!s) return null
  const nums = (s.match(/[\d.,]+/g) || []).map(n => parseFloat(n.replace(',', '.'))).filter(n => !isNaN(n))
  if (nums.length >= 2) return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])]
  return null
}
