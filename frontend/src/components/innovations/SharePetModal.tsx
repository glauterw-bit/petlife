'use client'

import { useEffect, useState } from 'react'
import { localeTag } from '@/lib/utils'
import { X, UserPlus, Mail, Trash2, Loader2, Users, Copy, Check } from 'lucide-react'
import { innovations, type PetShareEntry } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'

const ROLE_LABEL_KEY: Record<string, string> = {
  co_tutor: 'g.inv.role.coTutor',
  sitter: 'g.inv.role.sitter',
  familia: 'g.inv.role.family',
}

export function SharePetModal({ petId, petName, open, onClose }: { petId: number; petName: string; open: boolean; onClose: () => void }) {
  const t = useT()
  const { success, error } = useToast()
  const [shares, setShares] = useState<PetShareEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [conviteUrl, setConviteUrl] = useState<string | null>(null)
  const [role, setRole] = useState<'co_tutor' | 'sitter' | 'familia'>('co_tutor')

  async function load() {
    try { setShares(await innovations.listPetShares(petId)) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { if (open) load() }, [open, petId])

  async function invite() {
    if (!email.trim() || !email.includes('@')) { error(t('g.sh.errEmail')); return }
    setInviting(true)
    try {
      const res = await innovations.invitePetShare(petId, email.trim().toLowerCase(), role)
      success(res.user_exists ? t('g.sh.inviteSent') : t('g.sh.inviteCreated'))
      const fullUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/convites?token=${res.invite_token}`
        : `/convites?token=${res.invite_token}`
      navigator.clipboard.writeText(fullUrl).catch(() => {})
      // WhatsApp e SMS são mais de 90% do compartilhamento direto no Brasil.
      // Guardamos o link para oferecer o envio pelo canal que a pessoa usa —
      // só o e-mail deixava o convite parado na caixa de entrada.
      setConviteUrl(fullUrl)
      setEmail('')
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.misc.errorShort'))
    } finally {
      setInviting(false)
    }
  }

  async function revoke(shareId: number) {
    if (!confirm(t('g.sh.confirmRevoke'))) return
    try {
      await innovations.revokeShare(shareId)
      success(t('g.sh.revoked'))
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.misc.errorShort'))
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/convites?token=${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    })
  }

  if (!open) return null

  const activeShares = shares.filter(s => !s.is_owner)

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 dark:border-surface-700 sticky top-0 bg-white/95 dark:bg-surface-800/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-500" />
            <h2 className="font-bold text-surface-900 dark:text-white">{t('g.sh.title', { name: petName })}</h2>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Invite form */}
          <div>
            <p className="text-sm text-surface-600 dark:text-surface-300 mb-3">
              {t('g.sh.desc', { name: petName })}
            </p>
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('g.sh.emailPh')}
                  className="w-full pl-9 pr-3 py-2.5 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'co_tutor' | 'sitter' | 'familia')}
                className="w-full px-3 py-2.5 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="co_tutor">{t('g.inv.role.coTutor')}</option>
                <option value="sitter">{t('g.inv.role.sitter')}</option>
                <option value="familia">{t('g.inv.role.family')}</option>
              </select>
              <button
                onClick={invite}
                disabled={inviting || !email}
                className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2.5 rounded-xl disabled:opacity-60 transition shadow-md shadow-cyan-500/30"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {inviting ? t('g.sh.sending') : t('g.sh.invite')}
              </button>

              {conviteUrl && (
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    t('g.sh.whatsAppText', { name: petName, url: conviteUrl })
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl transition shadow-md shadow-green-500/30"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  {t('g.sh.sendWhatsApp')}
                </a>
              )}
            </div>
          </div>

          {/* Lista atual */}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-surface-400" /></div>
          ) : activeShares.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-6">{t('g.sh.empty', { name: petName })}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 font-semibold">{t('g.sh.peopleWithAccess')}</p>
              {activeShares.map(s => (
                <div key={s.id} className="flex items-start gap-3 p-3 bg-surface-50 dark:bg-surface-700/40 rounded-xl">
                  <div className="w-9 h-9 bg-cyan-100 dark:bg-cyan-900/40 rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-cyan-700 dark:text-cyan-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                      {s.user_name ?? s.invite_email}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{ROLE_LABEL_KEY[s.role] ? t(ROLE_LABEL_KEY[s.role]) : s.role}</p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {s.status === 'accepted'
                        ? t('g.sh.acceptedOn', { date: new Date(s.accepted_at!).toLocaleDateString(localeTag()) })
                        : s.status === 'pending'
                        ? t('g.sh.pending')
                        : s.status}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {s.status === 'pending' && s.invite_token && (
                      <button
                        onClick={() => copyLink(s.invite_token!)}
                        aria-label={t('g.sh.copyLinkAria')}
                        title={t('g.sh.copyLink')}
                        className="tap-target p-1.5 rounded-lg text-surface-500 dark:text-surface-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition"
                      >
                        {copiedToken === s.invite_token
                          ? <Check className="w-3.5 h-3.5 text-green-600" />
                          : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => revoke(s.id)}
                      aria-label={t('g.sh.revokeAria')}
                      title={t('g.sh.revoke')}
                      className="tap-target p-1.5 rounded-lg text-surface-500 dark:text-surface-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
