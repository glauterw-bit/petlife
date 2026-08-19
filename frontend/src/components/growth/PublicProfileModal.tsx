'use client'

import { useState } from 'react'
import { Globe, Copy, Check, Share2, ExternalLink } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { growth, type Pet } from '@/lib/api'
import { hapticLight, hapticSuccess, celebrate } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'

const APP_URL = 'https://petlife-frontend-production.up.railway.app'

/**
 * Perfil público do pet: link lindo pra bio do Instagram / WhatsApp.
 * Opt-in explícito do tutor; só expõe nome, foto, raça, idade e stats.
 */
export function PublicProfileModal({
  pet, open, onClose, onChanged,
}: {
  pet: Pet
  open: boolean
  onClose: () => void
  onChanged?: (isPublic: boolean, slug: string | null) => void
}) {
  const t = useT()
  const [isPublic, setIsPublic] = useState(!!pet.is_public)
  const [slug, setSlug] = useState<string | null>(pet.public_slug ?? null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const link = slug ? `${APP_URL}/p/${slug}` : null

  async function toggle() {
    if (busy) return
    setBusy(true)
    void hapticLight()
    try {
      const r = await growth.togglePublicProfile(pet.id, !isPublic)
      setIsPublic(r.is_public)
      setSlug(r.public_slug)
      onChanged?.(r.is_public, r.public_slug)
      if (r.is_public) { void hapticSuccess(); celebrate('small') }
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      void hapticSuccess()
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  async function share() {
    if (!link) return
    void hapticLight()
    const text = t('g.pp.shareText', { name: pet.name, link })
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
    if (nav.share) {
      try { await nav.share({ text }); return } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <Modal open={open} onClose={onClose} title={t('g.pp.title', { name: pet.name })}>
      <div className="space-y-4">
        <p className="text-sm text-surface-600 dark:text-surface-300 leading-snug">
          {t('g.pp.descA', { name: pet.name })} <strong>{t('g.pp.descBold')}</strong>.
        </p>

        <button
          onClick={toggle}
          disabled={busy}
          className={`pressable w-full flex items-center justify-between rounded-2xl border p-4 transition ${
            isPublic
              ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900'
              : 'border-surface-200 bg-surface-50 dark:bg-surface-700/40 dark:border-surface-600'
          }`}
        >
          <span className="flex items-center gap-3">
            <Globe className={`w-5 h-5 ${isPublic ? 'text-emerald-600' : 'text-surface-400'}`} />
            <span className="text-sm font-semibold text-surface-900 dark:text-white">
              {isPublic ? t('g.pp.on') : t('g.pp.off')}
            </span>
          </span>
          <span
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
              isPublic ? 'bg-emerald-500' : 'bg-surface-300 dark:bg-surface-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                isPublic ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
              }`}
            />
          </span>
        </button>

        {isPublic && link && (
          <div className="space-y-2 animate-slide-up">
            <div className="flex items-center gap-2 min-w-0">
              <code className="flex-1 min-w-0 truncate bg-surface-100 dark:bg-surface-700 rounded-xl px-3 py-2.5 text-xs text-surface-700 dark:text-surface-200">
                {link.replace('https://', '')}
              </code>
              <button
                onClick={copy}
                aria-label={t('g.pp.copyAria')}
                className="pressable shrink-0 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 rounded-xl p-2.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-surface-600 dark:text-surface-300" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={share}
                className="pressable flex items-center justify-center gap-2 bg-primary-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary-600 transition"
              >
                <Share2 className="w-4 h-4" /> {t('g.misc.share')}
              </button>
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="pressable flex items-center justify-center gap-2 bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-xl py-2.5 text-sm font-semibold hover:bg-surface-200 transition"
              >
                <ExternalLink className="w-4 h-4" /> {t('g.pp.viewPage')}
              </a>
            </div>
            <p className="text-[11px] text-surface-400 text-center">
              {t('g.pp.tip', { name: pet.name })}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
