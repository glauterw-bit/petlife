'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Heart, Activity, Footprints, Image as ImageIcon, UserCheck, MailCheck, BellOff } from 'lucide-react'
import { notifications as notificationsApi, type NotificationItem } from '@/lib/api'
import { useT } from '@/contexts/LocaleContext'
import { getDateLocale, cn } from '@/lib/utils'
import { Sheet } from '@/components/ui/Sheet'
import { IconButton } from '@/components/ui/IconButton'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { hapticLight } from '@/lib/feedback'

const INTL_LOCALE = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es' } as const

function iconFor(type: string) {
  switch (type) {
    case 'kudos_received': return <Heart className="w-4 h-4 text-pink-600 dark:text-pink-400" />
    case 'walk_finished': return <Footprints className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
    case 'weight_added': return <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    case 'behavior_logged': return <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
    case 'story_created': return <ImageIcon className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400" />
    case 'invite_accepted': return <UserCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
    default: return <Bell className="w-4 h-4 text-surface-500 dark:text-surface-400" />
  }
}

function relativeTime(iso: string, nowLabel: string): string {
  const diffSec = (Date.now() - new Date(iso).getTime()) / 1000
  if (diffSec < 60) return nowLabel
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`
  return new Date(iso).toLocaleDateString(INTL_LOCALE[getDateLocale()], { day: 'numeric', month: 'short' })
}

/**
 * Contagem compartilhada entre as instâncias (sino fixo do shell e sino
 * inline do PageHeader) — uma única consulta periódica, não duas.
 */
let sharedCount = 0
const countListeners = new Set<(n: number) => void>()
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollUsers = 0

async function fetchSharedCount() {
  try {
    const { count } = await notificationsApi.unreadCount()
    setSharedCount(count)
  } catch { /* silencioso */ }
}

function setSharedCount(n: number) {
  sharedCount = n
  countListeners.forEach(fn => fn(n))
}

function useUnreadCount(): [number, (fn: (c: number) => number) => void] {
  const [count, setCount] = useState(sharedCount)
  useEffect(() => {
    countListeners.add(setCount)
    if (pollUsers++ === 0) {
      void fetchSharedCount()
      pollTimer = setInterval(fetchSharedCount, 45000)
    }
    return () => {
      countListeners.delete(setCount)
      if (--pollUsers === 0 && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }
  }, [])
  const update = useCallback((fn: (c: number) => number) => setSharedCount(fn(sharedCount)), [])
  return [count, update]
}

export function NotificationBell({ variant = 'fixed' }: { variant?: 'fixed' | 'inline' } = {}) {
  const router = useRouter()
  const t = useT()
  const [unread, setUnread] = useUnreadCount()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const loadedOnce = useRef(false)

  async function openSheet() {
    setOpen(true)
    if (!loadedOnce.current) setLoading(true)
    try {
      const list = await notificationsApi.list({ limit: 30 })
      setItems(list)
      loadedOnce.current = true
    } catch { /* mantém a lista anterior */ } finally {
      setLoading(false)
    }
  }

  async function handleClick(n: NotificationItem) {
    void hapticLight()
    if (!n.is_read) {
      try {
        await notificationsApi.markRead(n.id)
        setUnread(c => Math.max(0, c - 1))
        setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      } catch { /* ignore */ }
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  async function markAllRead() {
    void hapticLight()
    try {
      await notificationsApi.markAllRead()
      setUnread(() => 0)
      setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch { /* ignore */ }
  }

  const label = unread > 0 ? t('v.notif.ariaNew', { count: unread }) : t('v.notif.title')

  return (
    <>
      {variant === 'inline' ? (
        <IconButton icon={Bell} label={label} variant="header" badge={unread} onClick={openSheet} />
      ) : (
        <div
          className="fixed z-40 md:top-4 md:right-5"
          style={{
            top: 'max(0.75rem, calc(env(safe-area-inset-top) + 0.25rem))',
            right: 'max(0.75rem, env(safe-area-inset-right))',
          }}
        >
          <IconButton icon={Bell} label={label} variant="glass" badge={unread} onClick={openSheet} className="rounded-full" />
        </div>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('v.notif.title')}
        description={unread > 0 ? t('v.notif.new', { count: unread }) : undefined}
        size="tall"
      >
        {items.some(n => !n.is_read) && (
          <div className="flex justify-end -mt-1 mb-1">
            <button
              type="button"
              onClick={markAllRead}
              className="pressable inline-flex items-center gap-1.5 min-h-[44px] px-2 -mr-2 rounded-lg text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/10"
            >
              <MailCheck className="w-4 h-4" aria-hidden />
              {t('v.notif.markAll')}
            </button>
          </div>
        )}
        {loading ? (
          <div className="space-y-2 py-2" aria-busy="true">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto mb-3 w-14 h-14 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-500 dark:text-surface-400">
              <BellOff className="w-6 h-6" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">{t('v.notif.empty')}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{t('v.notif.emptyHint')}</p>
          </div>
        ) : (
          <ul className="-mx-2 divide-y divide-surface-100 dark:divide-surface-800">
            {items.map(n => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full flex gap-3 px-2 py-3 text-left rounded-xl transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/60',
                    !n.is_read && 'bg-primary-50/50 dark:bg-primary-500/10',
                  )}
                >
                  <span className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center shrink-0">
                    {iconFor(n.type)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-start gap-2">
                      <span className="text-sm font-semibold text-surface-900 dark:text-white flex-1 leading-snug">
                        {n.title}
                      </span>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400 shrink-0 mt-1.5" aria-hidden />}
                    </span>
                    {n.body && (
                      <span className="block text-xs text-surface-600 dark:text-surface-400 mt-0.5 line-clamp-2">
                        {n.body}
                      </span>
                    )}
                    <span className="block text-[11px] text-surface-500 dark:text-surface-400 mt-1">{relativeTime(n.created_at, t('v.notif.now'))}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  )
}
