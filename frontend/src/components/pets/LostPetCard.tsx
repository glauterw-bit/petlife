'use client'

import { useEffect, useRef, useState } from 'react'
import { QrCode as QrIcon, Siren, Printer, Image as ImageIcon, MessageCircle, Home } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { pets as petsApi } from '@/lib/api'
import { track } from '@/lib/track'
import { shareCardImage } from '@/lib/shareCard'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { QrCode } from '@/components/ui/QrCode'
import { hapticSuccess, hapticError, hapticWarning } from '@/lib/feedback'
import { variants, dur, easeOut } from '@/lib/motion'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

const INPUT =
  'w-full px-4 min-h-[44px] rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-[15px] text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500'

/**
 * QR da coleira + modo de emergência "pet perdido".
 *
 * O QR aponta para /public/lost/<chave>: com o pet em casa, quem escaneia pode
 * avisar o tutor sem ver o telefone; com o pet marcado como perdido, a página
 * vira alerta. Não usa localização: só o que o tutor digita.
 */
export function LostPetCard({ petId, petName, petPhoto }: { petId: number; petName: string; petPhoto?: string | null }) {
  const t = useT()
  const { success, error } = useToast()
  const [isLost, setIsLost] = useState<boolean | null>(null)
  const [editing, setEditing] = useState(false)
  const [lastSeen, setLastSeen] = useState('')
  const [reward, setReward] = useState('')
  const [saving, setSaving] = useState(false)
  const [posterBusy, setPosterBusy] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const [publicKey, setPublicKey] = useState<string>(String(petId))
  const lostUrl = `${origin}/public/lost/${publicKey}`
  // QR gerado no aparelho (components/ui/QrCode). A impressão reaproveita o
  // SVG já desenhado na tela — nada sai para serviço externo de imagem.
  const qrWrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch(`${API_URL}/public/lost/${petId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive) return
        if (!d) { setIsLost(false); return }
        if (d.pet?.public_token) setPublicKey(d.pet.public_token)
        setIsLost(!!d.is_lost)
        setLastSeen(d.last_seen || '')
        setReward(d.reward || '')
      })
      .catch(() => alive && setIsLost(false))
    return () => { alive = false }
  }, [petId])

  async function save(lost: boolean) {
    setSaving(true)
    try {
      await petsApi.toggleLost(petId, {
        is_lost: lost,
        last_seen: lost ? lastSeen.trim() || undefined : undefined,
        reward: lost ? reward.trim() || undefined : undefined,
      })
      setIsLost(lost)
      setEditing(false)
      track(lost ? 'lost_marked' : 'lost_found')
      if (lost) void hapticWarning()
      else void hapticSuccess()
      success(lost ? t('lost.markedToast') : t('lost.foundToast'))
    } catch {
      void hapticError()
      error(t('lost.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function sharePoster() {
    if (posterBusy) return
    setPosterBusy(true)
    track('lost_share')
    try {
      const stats = [{ label: t('petx.lost.posterContact'), value: t('petx.lost.posterViaLink') }]
      if (reward.trim()) stats.push({ label: t('petx.lost.posterReward'), value: reward.trim().slice(0, 24) })
      await shareCardImage(
        {
          title: t('petx.lost.posterTitle', { name: petName }),
          subtitle: lastSeen.trim()
            ? t('petx.lost.posterSeen', { place: lastSeen.trim().slice(0, 60) })
            : t('petx.lost.posterSub'),
          emoji: '🐾',
          petPhotoUrl: petPhoto ?? null,
          stats,
        },
        t('petx.lost.shareText', { name: petName, url: lostUrl }),
      )
    } catch {
      void hapticError()
      error(t('petx.lost.posterError'))
    } finally {
      setPosterBusy(false)
    }
  }

  function openWhatsApp() {
    track('lost_share')
    const seen = lastSeen.trim() ? t('petx.lost.waSeen', { place: lastSeen.trim() }) : ''
    const text = t('petx.lost.waText', { name: petName, seen, url: lostUrl })
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  function printTag() {
    const svg = qrWrap.current?.querySelector('svg')
    if (!svg) { error(t('pet3.lost.qrLoading')); return }
    track('lost_qr_print')
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width', '170')
    clone.setAttribute('height', '170')
    clone.removeAttribute('class')
    const svgMarkup = clone.outerHTML
    const w = window.open('', '_blank')
    if (!w) return // janela bloqueada: nada a imprimir
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR ${petName.replace(/[<>&"]/g, '')}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:24px;padding:24px;justify-content:center}
.tag{border:2px dashed #999;border-radius:16px;padding:14px;text-align:center;width:200px}
.tag svg{width:170px;height:170px;display:block;margin:0 auto}.n{font-weight:700;font-size:18px;margin:6px 0 2px}.s{font-size:11px;color:#555}</style></head>
<body>${Array.from({ length: 6 }).map(() => `<div class="tag"><div class="n">${petName.replace(/[<>&"]/g, '')}</div>${svgMarkup}<div class="s">${t('lost.tagHint')}</div></div>`).join('')}
<script>setTimeout(()=>print(),800)</script></body></html>`)
    w.document.close()
  }

  if (isLost === null) return null

  if (isLost) {
    const steps = [
      { title: t('petx.lost.step1'), hint: t('petx.lost.step1Hint'), action: (
        <Button size="sm" variant="secondary" leftIcon={ImageIcon} loading={posterBusy} onClick={sharePoster}>{t('petx.lost.step1Btn')}</Button>
      ) },
      { title: t('petx.lost.step2'), hint: t('petx.lost.step2Hint'), action: (
        <Button size="sm" variant="secondary" leftIcon={MessageCircle} onClick={openWhatsApp}>{t('petx.lost.step2Btn')}</Button>
      ) },
      { title: t('petx.lost.step3'), hint: t('petx.lost.step3Hint'), action: (
        <Button size="sm" variant="secondary" leftIcon={Printer} onClick={printTag}>{t('lost.printQr')}</Button>
      ) },
    ]
    return (
      <Card tone="danger" padding="lg" as="section" aria-labelledby="lost-title">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 flex items-center justify-center shrink-0">
            <Siren className="w-5 h-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 id="lost-title" className="font-display text-lg font-extrabold text-surface-900 dark:text-white leading-snug">
              {t('petx.lost.activeTitle', { name: petName })}
            </h3>
            <p className="text-sm text-surface-700 dark:text-surface-300 mt-0.5">{t('petx.lost.activeBody')}</p>
          </div>
        </div>

        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-white/80 dark:bg-surface-900/70 border border-red-100 dark:border-red-500/15 p-3">
              <span className="w-7 h-7 rounded-full bg-red-600 text-white text-sm font-bold flex items-center justify-center shrink-0" aria-hidden>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-surface-900 dark:text-white">{s.title}</p>
                <p className="text-[13px] text-surface-600 dark:text-surface-400 mb-2">{s.hint}</p>
                {s.action}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex items-center gap-3">
          <div ref={qrWrap} className="shrink-0 rounded-xl border border-surface-200 dark:border-surface-700 bg-white">
            <QrCode value={lostUrl} size={64} label={t('lost.qrAlt', { name: petName })} />
          </div>
          <Button fullWidth size="lg" variant="soft" leftIcon={Home} loading={saving} onClick={() => save(false)}>
            {t('petx.lost.found')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card as="section" aria-labelledby="qr-title">
      <div className="flex gap-4">
        <div ref={qrWrap} className="shrink-0 self-start rounded-xl border border-surface-200 dark:border-surface-700 bg-white">
          <QrCode value={lostUrl} size={96} label={t('lost.qrAlt', { name: petName })} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="qr-title" className="font-display font-bold text-surface-900 dark:text-white flex items-center gap-1.5">
            <QrIcon className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
            {t('lost.title')}
          </h3>
          <p className="text-[13px] text-surface-600 dark:text-surface-400 mt-1 leading-snug">{t('lost.body', { name: petName })}</p>
          <Button size="sm" variant="ghost" leftIcon={Printer} onClick={printTag} className="mt-1 -ml-3 text-primary-700 dark:text-primary-300">
            {t('lost.printQr')}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {editing ? (
          <motion.div
            key="form"
            variants={variants.fadeUp}
            initial="hidden"
            animate="show"
            exit="hidden"
            transition={{ duration: dur.fast, ease: easeOut }}
            className="mt-4 space-y-3"
          >
            <p className="text-sm font-semibold text-surface-900 dark:text-white">{t('petx.lost.formTitle')}</p>
            <div>
              <label htmlFor={`lost-seen-${petId}`} className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                {t('petx.lost.lastSeenLabel')}
              </label>
              <input id={`lost-seen-${petId}`} value={lastSeen} onChange={e => setLastSeen(e.target.value)} maxLength={200} placeholder={t('lost.lastSeenPh')} className={INPUT} />
            </div>
            <div>
              <label htmlFor={`lost-reward-${petId}`} className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                {t('petx.lost.rewardLabel')}
              </label>
              <input id={`lost-reward-${petId}`} value={reward} onChange={e => setReward(e.target.value)} maxLength={100} className={INPUT} />
            </div>
            <p className="text-[13px] text-surface-600 dark:text-surface-400">{t('lost.phoneNote')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
              <Button variant="danger" leftIcon={Siren} loading={saving} onClick={() => save(true)}>{t('petx.lost.activate')}</Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.micro }} className="mt-4">
            <Button fullWidth size="lg" variant="danger" leftIcon={Siren} onClick={() => setEditing(true)}>
              {t('petx.lost.cta')}
            </Button>
            <p className="mt-2 text-center text-[13px] text-surface-600 dark:text-surface-400">{t('petx.lost.ctaHint')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
