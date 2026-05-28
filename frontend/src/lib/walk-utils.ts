/**
 * Utilitários pra tracking de passeio: distância haversine, sampling,
 * pace formatting, geração de share-card via Canvas.
 */
import type { RoutePoint } from './api'

/** Distância em metros entre dois pontos lat/lng (Haversine). */
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000 // raio terra em m
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Formata duração em mm:ss ou h:mm:ss */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Formata distância em m ou km */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

/** Formata ritmo (segundos por km) em mm'ss" /km */
export function formatPace(secPerKm?: number | null): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.floor(secPerKm % 60)
  return `${m}'${String(s).padStart(2, '0')}"/km`
}

/** Filtra ponto com baixa precisão (acc > 30m) ou jump irrealista (>30m/s). */
export function shouldAcceptPoint(
  prev: RoutePoint | null,
  next: { lat: number; lng: number; ts: number; acc?: number },
): boolean {
  if (next.acc && next.acc > 30) return false  // GPS ruim
  if (!prev) return true
  const dt = (next.ts - prev.ts) / 1000  // segundos
  if (dt <= 0) return false
  const d = haversineMeters(prev, next)
  if (dt > 0 && d / dt > 30) return false  // > 108 km/h = teleporte/erro
  // Filtra pontos muito próximos (< 3m) pra economizar storage e suavizar
  if (d < 3 && dt < 8) return false
  return true
}

/** Calcula bounding box dum array de pontos. */
export function getBounds(points: RoutePoint[]): {
  minLat: number; maxLat: number; minLng: number; maxLng: number
} | null {
  if (points.length === 0) return null
  let minLat = points[0].lat, maxLat = points[0].lat
  let minLng = points[0].lng, maxLng = points[0].lng
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }
  return { minLat, maxLat, minLng, maxLng }
}

/**
 * Gera um card visual do passeio (1080x1920 — Instagram Story).
 * Inclui mapa do trajeto, stats, nome do pet, branding.
 * Retorna data URL pra share.
 */
export async function generateShareCard(opts: {
  petName: string
  petPhotoUrl?: string | null
  distanceMeters: number
  durationSeconds: number
  pace?: number | null
  caloriesEstimated?: number | null
  mood?: string | null
  routePoints: RoutePoint[]
  photos?: string[]
}): Promise<Blob> {
  const W = 1080
  const H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#059669')
  grad.addColorStop(0.5, '#10b981')
  grad.addColorStop(1, '#047857')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Header — Logo + branding
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 64px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('🐾 PetLife', W / 2, 140)

  ctx.font = '38px -apple-system, sans-serif'
  ctx.fillStyle = '#d1fae5'
  ctx.fillText('passeio com ' + opts.petName, W / 2, 200)

  // Map area — desenhar a rota
  const mapY = 280
  const mapH = 700
  const mapPad = 80
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  roundRect(ctx, mapPad, mapY, W - mapPad * 2, mapH, 32)
  ctx.fill()

  if (opts.routePoints.length >= 2) {
    drawRoute(ctx, opts.routePoints, mapPad + 40, mapY + 40, W - mapPad * 2 - 80, mapH - 80)
  } else {
    ctx.fillStyle = '#10b981'
    ctx.font = '32px -apple-system, sans-serif'
    ctx.fillText('🗺️', W / 2, mapY + mapH / 2 + 12)
  }

  // Stats section
  const statsY = 1080
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  roundRect(ctx, mapPad, statsY, W - mapPad * 2, 360, 32)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 96px -apple-system, sans-serif'
  ctx.textAlign = 'center'

  // 2x2 grid of stats
  const cellW = (W - mapPad * 2) / 2
  const stats = [
    { label: 'distância', value: formatDistance(opts.distanceMeters) },
    { label: 'duração', value: formatDuration(opts.durationSeconds) },
    { label: 'ritmo', value: formatPace(opts.pace) },
    { label: 'calorias', value: opts.caloriesEstimated ? `${Math.round(opts.caloriesEstimated)} kcal` : '—' },
  ]
  for (let i = 0; i < 4; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const cx = mapPad + col * cellW + cellW / 2
    const cy = statsY + 60 + row * 160

    ctx.font = 'bold 72px -apple-system, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(stats[i].value, cx, cy + 70)

    ctx.font = '28px -apple-system, sans-serif'
    ctx.fillStyle = '#d1fae5'
    ctx.fillText(stats[i].label, cx, cy + 110)
  }

  // Mood
  if (opts.mood) {
    const moodEmoji = opts.mood === 'happy' ? '😊' : opts.mood === 'tired' ? '😴' : '🙂'
    ctx.font = 'bold 80px -apple-system, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(moodEmoji, W / 2, 1560)
    ctx.font = '32px -apple-system, sans-serif'
    ctx.fillStyle = '#d1fae5'
    const moodText = opts.mood === 'happy' ? 'felicíssimo!' : opts.mood === 'tired' ? 'cansadinho' : 'no jeito'
    ctx.fillText(moodText, W / 2, 1610)
  }

  // Footer — date + branding
  ctx.font = '28px -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  const date = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.fillText(date, W / 2, 1780)
  ctx.fillText('petlife.app', W / 2, 1830)

  // To blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Falha ao gerar imagem'))
    }, 'image/png', 0.92)
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  points: RoutePoint[],
  x: number, y: number, w: number, h: number,
) {
  const bounds = getBounds(points)
  if (!bounds) return
  const { minLat, maxLat, minLng, maxLng } = bounds
  const latRange = Math.max(0.00001, maxLat - minLat)
  const lngRange = Math.max(0.00001, maxLng - minLng)
  // mantém aspect ratio
  const scale = Math.min(w / lngRange, h / latRange)
  const offsetX = x + (w - lngRange * scale) / 2
  const offsetY = y + (h - latRange * scale) / 2

  const toXY = (p: RoutePoint) => ({
    x: offsetX + (p.lng - minLng) * scale,
    y: offsetY + (maxLat - p.lat) * scale,  // invertido pq y cresce pra baixo
  })

  // Linha do trajeto
  ctx.strokeStyle = '#10b981'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  for (let i = 0; i < points.length; i++) {
    const p = toXY(points[i])
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  ctx.stroke()

  // Marcadores start/end
  const start = toXY(points[0])
  const end = toXY(points[points.length - 1])

  // start (verde)
  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  ctx.arc(start.x, start.y, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 4
  ctx.stroke()

  // end (laranja)
  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(end.x, end.y, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}
