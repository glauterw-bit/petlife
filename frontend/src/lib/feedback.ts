/**
 * Feedback module — haptics + confetti.
 * Gracefully degrades on web (no haptics if not Capacitor, no vibrate).
 * Respects prefers-reduced-motion for confetti.
 */
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import confetti from 'canvas-confetti'

function isNative() {
  return Capacitor.isNativePlatform()
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ── Haptics ───────────────────────────────────────────

export async function hapticLight() {
  if (isNative()) {
    try { await Haptics.impact({ style: ImpactStyle.Light }) } catch {}
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.(10)
  }
}

export async function hapticMedium() {
  if (isNative()) {
    try { await Haptics.impact({ style: ImpactStyle.Medium }) } catch {}
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.(20)
  }
}

export async function hapticHeavy() {
  if (isNative()) {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }) } catch {}
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.([30, 10, 30])
  }
}

export async function hapticSuccess() {
  if (isNative()) {
    try { await Haptics.notification({ type: NotificationType.Success }) } catch {}
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.([15, 30, 15])
  }
}

export async function hapticWarning() {
  if (isNative()) {
    try { await Haptics.notification({ type: NotificationType.Warning }) } catch {}
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.([25, 50, 25])
  }
}

export async function hapticError() {
  if (isNative()) {
    try { await Haptics.notification({ type: NotificationType.Error }) } catch {}
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.([50, 30, 50, 30, 50])
  }
}

export async function hapticSelect() {
  if (isNative()) {
    try { await Haptics.selectionChanged() } catch {}
  }
}

// ── Confetti ──────────────────────────────────────────

const PETLIFE_COLORS = ['#10b981', '#34d399', '#f59e0b', '#fbbf24', '#a7f3d0']

/** Burst from center — generic celebration */
export function celebrate(intensity: 'small' | 'medium' | 'large' = 'medium') {
  if (prefersReducedMotion()) return
  void hapticSuccess()
  const count = intensity === 'large' ? 200 : intensity === 'medium' ? 100 : 50
  confetti({
    particleCount: count,
    spread: 90,
    origin: { y: 0.6 },
    colors: PETLIFE_COLORS,
  })
}

/** Side-cannon style — for screen-edge celebrations */
export function celebrateFromSides() {
  if (prefersReducedMotion()) return
  void hapticSuccess()
  const end = Date.now() + 800
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: PETLIFE_COLORS })
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: PETLIFE_COLORS })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

/** Paw-print emoji confetti for pet-related moments */
export function celebratePets() {
  if (prefersReducedMotion()) return
  void hapticSuccess()
  const scalar = 2.5
  const paw = confetti.shapeFromText({ text: '🐾', scalar })
  confetti({
    particleCount: 30,
    spread: 80,
    origin: { y: 0.6 },
    shapes: [paw],
    scalar,
  })
}

/** Trophy + stars — gamification badge unlock */
export function celebrateBadge() {
  if (prefersReducedMotion()) return
  void hapticSuccess()
  const trophy = confetti.shapeFromText({ text: '🏆', scalar: 2.2 })
  const star = confetti.shapeFromText({ text: '⭐', scalar: 1.8 })
  confetti({
    particleCount: 25,
    spread: 100,
    origin: { y: 0.55 },
    shapes: [trophy, star],
    scalar: 2,
  })
}
