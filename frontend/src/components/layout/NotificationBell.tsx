'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Heart, Activity, Footprints, Image as ImageIcon, UserCheck, X, MailCheck } from 'lucide-react'
import { notifications as notificationsApi, type NotificationItem } from '@/lib/api'

function iconFor(type: string) {
  switch (type) {
    case 'kudos_received': return <Heart className="w-4 h-4 text-pink-500" />
    case 'walk_finished': return <Footprints className="w-4 h-4 text-emerald-500" />
    case 'weight_added': return <Activity className="w-4 h-4 text-blue-500" />
    case 'behavior_logged': return <Activity className="w-4 h-4 text-amber-500" />
    case 'story_created': return <ImageIcon className="w-4 h-4 text-fuchsia-500" />
    case 'invite_accepted': return <UserCheck className="w-4 h-4 text-cyan-500" />
    default: return <Bell className="w-4 h-4 text-surface-500" />
  }
}

function relativeTime(iso: string): string {
  const diffSec = (Date.now() - new Date(iso).getTime()) / 1000
  if (diffSec < 60) return 'agora'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}

export function NotificationBell() {
  const router = useRouter()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCount = useCallback(async () => {
    try {
      const { count } = await notificationsApi.unreadCount()
      setUnread(count)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    fetchCount()
    pollRef.current = setInterval(fetchCount, 45000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchCount])

  async function openSheet() {
    setOpen(true)
    setLoading(true)
    try {
      const list = await notificationsApi.list({ limit: 30 })
      setItems(list)
    } finally {
      setLoading(false)
    }
  }

  async function handleClick(n: NotificationItem) {
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
    try {
      await notificationsApi.markAllRead()
      setUnread(0)
      setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch { /* ignore */ }
  }

  return (
    <>
      <button
        onClick={openSheet}
        aria-label={unread > 0 ? `Notificações (${unread} novas)` : 'Notificações'}
        style={{
          top: 'max(0.75rem, calc(env(safe-area-inset-top) + 0.25rem))',
          right: 'max(0.75rem, env(safe-area-inset-right))',
        }}
        className="fixed z-40 md:top-4 md:right-5 tap-target bg-white/95 dark:bg-surface-800/95 backdrop-blur shadow-md rounded-xl border border-surface-200 dark:border-surface-700 flex items-center justify-center"
      >
        <Bell className="w-5 h-5 text-surface-700 dark:text-surface-200" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-start justify-center sm:justify-end p-0 sm:p-4 sm:pt-[max(4rem,env(safe-area-inset-top))]"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up flex flex-col max-h-[85dvh] pb-[env(safe-area-inset-bottom)] sm:pb-0"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-700 shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-surface-700 dark:text-surface-200" />
                <h2 className="text-sm font-semibold text-surface-900 dark:text-white">Notificações</h2>
                {unread > 0 && <span className="text-xs text-surface-500">({unread} novas)</span>}
              </div>
              <div className="flex items-center gap-1">
                {items.some(n => !n.is_read) && (
                  <button
                    onClick={markAllRead}
                    title="Marcar todas como lidas"
                    className="tap-target rounded-lg text-surface-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 flex items-center justify-center"
                  >
                    <MailCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fechar"
                  className="tap-target rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center text-sm text-surface-500">Carregando…</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-sm text-surface-500">
                  Tudo em dia 🎉<br />
                  <span className="text-xs">Quando alguém da família mexer no perfil do pet, aparece aqui.</span>
                </div>
              ) : (
                <ul className="divide-y divide-surface-100 dark:divide-surface-700">
                  {items.map(n => (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className={`w-full flex gap-3 p-3 text-left transition hover:bg-surface-50 dark:hover:bg-surface-700/40 ${
                          !n.is_read ? 'bg-primary-50/40 dark:bg-primary-900/10' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center shrink-0">
                          {iconFor(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p className="text-sm font-medium text-surface-900 dark:text-white flex-1 leading-snug">
                              {n.title}
                            </p>
                            {!n.is_read && <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0 mt-1.5" />}
                          </div>
                          {n.body && (
                            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <p className="text-[10px] text-surface-400 mt-1">{relativeTime(n.created_at)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
