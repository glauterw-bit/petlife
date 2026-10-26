'use client'

/**
 * QR code gerado NO APARELHO (qrcode-generator, carregado sob demanda só
 * aqui). Antes a URL da carteirinha — que leva um token — ia para um serviço
 * externo de imagem: ruim para a privacidade e quebrava sem internet.
 *
 * SVG preto sobre branco nos dois temas (leitores de QR esperam contraste
 * escuro-sobre-claro), com a zona de silêncio de 4 módulos da norma
 * ISO/IEC 18004. Correção de erro 'M' (~15%): aguenta brilho de tela e um
 * pouco de sujeira sem deixar o código denso demais.
 */
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from './Skeleton'

type QrFactory = typeof import('qrcode-generator')

let _lib: Promise<QrFactory> | null = null
function loadLib(): Promise<QrFactory> {
  if (!_lib) {
    _lib = import('qrcode-generator').then(m => ((m as unknown as { default?: QrFactory }).default ?? m) as QrFactory)
    _lib.catch(() => {
      _lib = null
    })
  }
  return _lib
}

const QUIET = 4

function buildPath(qr: { getModuleCount(): number; isDark(r: number, c: number): boolean }): { d: string; size: number } {
  const n = qr.getModuleCount()
  let d = ''
  for (let r = 0; r < n; r++) {
    let c = 0
    while (c < n) {
      if (!qr.isDark(r, c)) {
        c++
        continue
      }
      // junta módulos escuros vizinhos da linha num retângulo só (SVG menor)
      const start = c
      while (c < n && qr.isDark(r, c)) c++
      d += `M${start + QUIET} ${r + QUIET}h${c - start}v1h-${c - start}z`
    }
  }
  return { d, size: n + QUIET * 2 }
}

export function QrCode({
  value,
  size = 168,
  label,
  className,
}: {
  value: string
  /** Lado em px (o desenho escala sem perder nitidez). */
  size?: number
  /** Texto lido pelo VoiceOver (ex.: "QR code da carteirinha do Thor"). */
  label: string
  className?: string
}) {
  const [svg, setSvg] = useState<{ d: string; size: number; value: string } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setFailed(false)
    loadLib()
      .then(qrcode => {
        const qr = qrcode(0, 'M')
        qr.addData(value)
        qr.make()
        const out = buildPath(qr)
        if (alive) setSvg({ ...out, value })
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [value])

  if (!svg || svg.value !== value) {
    if (failed) {
      return (
        <div
          role="img"
          aria-label={label}
          className={cn('rounded-xl bg-white', className)}
          style={{ width: size, height: size }}
        />
      )
    }
    return (
      <div role="img" aria-label={label} aria-busy="true" style={{ width: size, height: size }} className={className}>
        <Skeleton className="w-full h-full rounded-xl" />
      </div>
    )
  }

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${svg.size} ${svg.size}`}
      shapeRendering="crispEdges"
      className={cn('rounded-xl', className)}
    >
      <rect width={svg.size} height={svg.size} fill="#ffffff" />
      <path d={svg.d} fill="#000000" />
    </svg>
  )
}
