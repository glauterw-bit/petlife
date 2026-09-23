'use client'

import { useEffect, useState } from 'react'
import { QrCode, Siren, Share2, Printer } from 'lucide-react'
import { pets as petsApi } from '@/lib/api'
import { track } from '@/lib/track'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

/**
 * QR da coleira + modo "pet perdido".
 *
 * O QR aponta pra /public/lost/<id>: com o pet em casa, quem escaneia pode
 * avisar o tutor ("Encontrei este pet") sem ver o telefone; com o pet marcado
 * como perdido, a página vira alerta com contato e recompensa.
 */
export function LostPetCard({ petId, petName }: { petId: number; petName: string }) {
  const t = useT()
  const { success, error } = useToast()
  const [isLost, setIsLost] = useState<boolean | null>(null)
  const [editing, setEditing] = useState(false)
  const [lastSeen, setLastSeen] = useState('')
  const [reward, setReward] = useState('')
  const [saving, setSaving] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const lostUrl = `${origin}/public/lost/${petId}`
  const qr = (size: number) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(lostUrl)}&bgcolor=ffffff&color=1a1a2e&margin=12`

  useEffect(() => {
    fetch(`${API_URL}/public/lost/${petId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        setIsLost(!!d.is_lost)
        setLastSeen(d.last_seen || '')
        setReward(d.reward || '')
      })
      .catch(() => setIsLost(false))
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
      success(lost ? t('lost.markedToast') : t('lost.foundToast'))
    } catch {
      error(t('lost.saveError'))
    } finally {
      setSaving(false)
    }
  }

  function shareAlert() {
    const text = t('lost.shareText', { name: petName, url: lostUrl })
    track('lost_share')
    if (navigator.share) {
      navigator.share({ title: t('lost.shareTitle', { name: petName }), text, url: lostUrl }).catch(() => {})
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  function printTag() {
    track('lost_qr_print')
    const w = window.open('', '_blank')
    if (!w) { window.open(qr(600), '_blank'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR ${petName}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:24px;padding:24px;justify-content:center}
.tag{border:2px dashed #999;border-radius:16px;padding:14px;text-align:center;width:200px}
.tag img{width:170px;height:170px}.n{font-weight:700;font-size:18px;margin:6px 0 2px}.s{font-size:11px;color:#555}</style></head>
<body>${Array.from({ length: 6 }).map(() => `<div class="tag"><div class="n">${petName.replace(/[<>&"]/g, '')}</div><img src="${qr(400)}"/><div class="s">${t('lost.tagHint')}</div></div>`).join('')}
<script>setTimeout(()=>print(),800)</script></body></html>`)
    w.document.close()
  }

  if (isLost === null) return null

  return (
    <div className={`rounded-2xl border p-4 ${isLost
      ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
      : 'border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800'}`}>
      <div className="flex gap-4">
        <img src={qr(220)} alt={t('lost.qrAlt', { name: petName })} className="w-24 h-24 rounded-xl border border-surface-200 dark:border-surface-600 bg-white shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-surface-900 dark:text-white flex items-center gap-1.5">
            {isLost ? <Siren className="w-4 h-4 text-red-500" /> : <QrCode className="w-4 h-4 text-primary-500" />}
            {isLost ? t('lost.titleLost', { name: petName }) : t('lost.title')}
          </p>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 leading-snug">
            {isLost ? t('lost.bodyLost') : t('lost.body', { name: petName })}
          </p>
        </div>
      </div>

      {editing && !isLost && (
        <div className="mt-3 space-y-2">
          <input value={lastSeen} onChange={e => setLastSeen(e.target.value)} maxLength={200}
            placeholder={t('lost.lastSeenPh')}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-white" />
          <input value={reward} onChange={e => setReward(e.target.value)} maxLength={100}
            placeholder={t('lost.rewardPh')}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-white" />
          <p className="text-[11px] text-surface-500 dark:text-surface-400">{t('lost.phoneNote')}</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {isLost ? (
          <>
            <button onClick={shareAlert} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition">
              <Share2 className="w-4 h-4" />{t('lost.shareAlert')}
            </button>
            <button onClick={() => save(false)} disabled={saving} className="px-3 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 transition disabled:opacity-50">
              🏠 {t('lost.foundBtn')}
            </button>
          </>
        ) : editing ? (
          <>
            <button onClick={() => setEditing(false)} className="px-3 py-2.5 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-300 bg-surface-100 dark:bg-surface-700 transition">
              {t('common.cancel')}
            </button>
            <button onClick={() => save(true)} disabled={saving} className="px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50">
              {t('lost.confirmLost')}
            </button>
          </>
        ) : (
          <>
            <button onClick={printTag} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition">
              <Printer className="w-4 h-4" />{t('lost.printQr')}
            </button>
            <button onClick={() => setEditing(true)} className="px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 transition">
              {t('lost.markBtn')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
