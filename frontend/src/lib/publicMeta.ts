import type { Metadata } from 'next'

/**
 * Metadados das páginas públicas (prévia no WhatsApp e banner da App Store).
 * Roda no servidor do Next: busca no backend só o que a página já mostra.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'
const SITE = 'https://petlife-frontend-production.up.railway.app'
export const APP_BANNER = { 'apple-itunes-app': 'app-id=6768136468' }

export async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, { next: { revalidate: 300 } })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

export function absPhoto(photo?: string | null): string | undefined {
  if (!photo) return undefined
  return photo.startsWith('http') ? photo : `${API_URL}${photo}`
}

export function buildMeta(opts: { title: string; description: string; path: string; image?: string; index?: boolean; appArgument?: boolean }): Metadata {
  const url = `${SITE}${opts.path}`
  const images = opts.image ? [{ url: opts.image }] : [{ url: `${SITE}/og.png` }]
  return {
    title: opts.title,
    description: opts.description,
    robots: opts.index ? undefined : { index: false, follow: false },
    openGraph: { title: opts.title, description: opts.description, url, siteName: 'PetLife', images, type: 'website', locale: 'pt_BR' },
    twitter: { card: opts.image ? 'summary_large_image' : 'summary', title: opts.title, description: opts.description, images: images.map(i => i.url) },
    other: { 'apple-itunes-app': `app-id=6768136468${opts.appArgument ? `, app-argument=${url}` : ''}` },
  }
}
