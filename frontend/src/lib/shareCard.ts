'use client'

/**
 * Cards de compartilhamento em IMAGEM (canvas 1080×1350, 4:5 — perfeito pra
 * WhatsApp/Instagram). Todo share vira um outdoor do PetLife: visual bonito,
 * foto do pet quando houver, marca discreta + link.
 */

export interface CardStat { label: string; value: string }
export interface CardSpec {
  title: string          // ex: "Agosto do Rex"
  subtitle?: string      // ex: "Recap do mês 🐾"
  emoji?: string         // fallback quando não há foto (🐶/🐱/🎂/🔥)
  petPhotoUrl?: string | null
  stats: CardStat[]      // até 4
  footer?: string        // default: marca + link
}

const W = 1080, H = 1350

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
    setTimeout(() => resolve(null), 4000)
  })
}

export async function generateShareCard(spec: CardSpec): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // fundo: gradiente emerald da marca
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#059669'); bg.addColorStop(0.55, '#10b981'); bg.addColorStop(1, '#065f46')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // bolhas decorativas
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  for (const [cx, cy, r] of [[950, 120, 180], [90, 1180, 140], [1010, 1240, 90], [140, 160, 70]] as const) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  }
  // patinhas sutis
  ctx.font = '44px serif'; ctx.fillStyle = 'rgba(255,255,255,0.10)'
  for (const [px, py, rot] of [[180, 420, -0.4], [880, 300, 0.3], [930, 980, -0.2], [120, 900, 0.5]] as const) {
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.fillText('🐾', 0, 0); ctx.restore()
  }

  // cartão branco central
  const cardX = 70, cardY = 300, cardW = W - 140, cardH = 820
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16
  roundRect(ctx, cardX, cardY, cardW, cardH, 48)
  ctx.fillStyle = '#ffffff'; ctx.fill()
  ctx.restore()

  // header da marca
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 64px Inter, system-ui, sans-serif'
  ctx.fillText('🐾 PetLife', W / 2, 150)
  if (spec.subtitle) {
    ctx.font = '600 40px Inter, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillText(spec.subtitle, W / 2, 220)
  }

  // foto do pet (círculo) ou emoji
  const avatarCY = cardY + 10
  const img = spec.petPhotoUrl ? await loadImage(spec.petPhotoUrl) : null
  ctx.save()
  ctx.beginPath(); ctx.arc(W / 2, avatarCY, 110, 0, Math.PI * 2)
  ctx.fillStyle = '#d1fae5'; ctx.fill()
  ctx.lineWidth = 12; ctx.strokeStyle = '#ffffff'; ctx.stroke()
  ctx.clip()
  if (img) {
    const s = Math.max(220 / img.width, 220 / img.height)
    ctx.drawImage(img, W / 2 - (img.width * s) / 2, avatarCY - (img.height * s) / 2, img.width * s, img.height * s)
  } else {
    ctx.font = '120px serif'; ctx.textAlign = 'center'
    ctx.fillText(spec.emoji || '🐶', W / 2, avatarCY + 45)
  }
  ctx.restore()

  // título
  ctx.textAlign = 'center'
  ctx.fillStyle = '#1c1917'
  ctx.font = '800 68px Inter, system-ui, sans-serif'
  ctx.fillText(spec.title, W / 2, cardY + 230, cardW - 120)

  // stats em grade 2×2
  const stats = spec.stats.slice(0, 4)
  const cols = stats.length === 1 ? 1 : 2
  const rows = Math.ceil(stats.length / cols)
  const gw = (cardW - 160) / cols, gh = 190
  const gx0 = cardX + 80, gy0 = cardY + 310
  stats.forEach((s0, i) => {
    const gx = gx0 + (i % cols) * gw
    const gy = gy0 + Math.floor(i / cols) * (gh + 28)
    roundRect(ctx, gx + 10, gy, gw - 20, gh, 28)
    ctx.fillStyle = '#ecfdf5'; ctx.fill()
    ctx.fillStyle = '#059669'
    ctx.font = '800 62px Inter, system-ui, sans-serif'
    ctx.fillText(s0.value, gx + gw / 2, gy + 92, gw - 60)
    ctx.fillStyle = '#57534e'
    ctx.font = '600 32px Inter, system-ui, sans-serif'
    ctx.fillText(s0.label, gx + gw / 2, gy + 150, gw - 60)
  })
  // centraliza última linha ímpar
  if (stats.length % 2 === 1 && stats.length > 1) {
    // (mantido simples — grade padrão)
  }
  void rows

  // rodapé no cartão
  ctx.fillStyle = '#a8a29e'
  ctx.font = '500 30px Inter, system-ui, sans-serif'
  ctx.fillText('feito com amor no PetLife', W / 2, cardY + cardH - 46)

  // CTA fora do cartão
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 40px Inter, system-ui, sans-serif'
  ctx.fillText(spec.footer || 'Cuide do seu pet com IA — PetLife na App Store', W / 2, H - 120)
  ctx.font = '600 34px Inter, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('apps.apple.com/br/app/id6768136468', W / 2, H - 62)

  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png', 0.95))
  return new File([blob], 'petlife-card.png', { type: 'image/png' })
}

/** Compartilha o card (Web Share c/ arquivo no iOS; download como fallback). */
export async function shareCardImage(spec: CardSpec, shareText?: string): Promise<boolean> {
  const file = await generateShareCard(spec)
  const nav = navigator as Navigator & { canShare?: (d?: { files?: File[] }) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: shareText })
      return true
    } catch { return false }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url; a.download = file.name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return true
}
