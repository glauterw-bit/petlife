'use client'

import { useEffect, useState } from 'react'
import { X, UserPlus, Mail, Trash2, Loader2, Users, Copy, Check } from 'lucide-react'
import { innovations, type PetShareEntry } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'

const ROLE_LABEL: Record<string, string> = {
  co_tutor: 'Co-tutor (acesso completo)',
  sitter: 'Pet sitter (acesso limitado)',
  familia: 'Família (visualização)',
}

export function SharePetModal({ petId, petName, open, onClose }: { petId: number; petName: string; open: boolean; onClose: () => void }) {
  const { success, error } = useToast()
  const [shares, setShares] = useState<PetShareEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'co_tutor' | 'sitter' | 'familia'>('co_tutor')

  async function load() {
    try { setShares(await innovations.listPetShares(petId)) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { if (open) load() }, [open, petId])

  async function invite() {
    if (!email.trim() || !email.includes('@')) { error('E-mail inválido'); return }
    setInviting(true)
    try {
      const res = await innovations.invitePetShare(petId, email.trim().toLowerCase(), role)
      success(res.user_exists ? 'Convite enviado — outro usuário verá em /convites' : 'Convite criado — compartilhe o link com o e-mail')
      const fullUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/convites?token=${res.invite_token}`
        : `/convites?token=${res.invite_token}`
      navigator.clipboard.writeText(fullUrl).catch(() => {})
      setEmail('')
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setInviting(false)
    }
  }

  async function revoke(shareId: number) {
    if (!confirm('Revogar acesso?')) return
    try {
      await innovations.revokeShare(shareId)
      success('Acesso revogado')
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro')
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 dark:border-surface-700 sticky top-0 bg-white/95 dark:bg-surface-800/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-500" />
            <h2 className="font-bold text-surface-900 dark:text-white">Compartilhar {petName}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Invite form */}
          <div>
            <p className="text-sm text-surface-600 dark:text-surface-300 mb-3">
              Convide co-tutor, pet sitter ou família para acompanhar {petName}.
            </p>
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'co_tutor' | 'sitter' | 'familia')}
                className="w-full px-3 py-2.5 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="co_tutor">Co-tutor (acesso completo)</option>
                <option value="sitter">Pet sitter (acesso limitado)</option>
                <option value="familia">Família (visualização)</option>
              </select>
              <button
                onClick={invite}
                disabled={inviting || !email}
                className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2.5 rounded-xl disabled:opacity-60 transition shadow-md shadow-cyan-500/30"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {inviting ? 'Enviando…' : 'Convidar'}
              </button>
            </div>
          </div>

          {/* Lista atual */}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-surface-400" /></div>
          ) : activeShares.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-6">Você ainda não compartilhou {petName} com ninguém.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 font-semibold">Pessoas com acesso</p>
              {activeShares.map(s => (
                <div key={s.id} className="flex items-start gap-3 p-3 bg-surface-50 dark:bg-surface-700/40 rounded-xl">
                  <div className="w-9 h-9 bg-cyan-100 dark:bg-cyan-900/40 rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-cyan-700 dark:text-cyan-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                      {s.user_name ?? s.invite_email}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{ROLE_LABEL[s.role]}</p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {s.status === 'accepted'
                        ? `Aceito em ${new Date(s.accepted_at!).toLocaleDateString('pt-BR')}`
                        : s.status === 'pending'
                        ? 'Aguardando aceitar'
                        : s.status}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {s.status === 'pending' && s.invite_token && (
                      <button
                        onClick={() => copyLink(s.invite_token!)}
                        aria-label="Copiar link do convite"
                        title="Copiar link"
                        className="tap-target p-1.5 rounded-lg text-surface-500 dark:text-surface-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition"
                      >
                        {copiedToken === s.invite_token
                          ? <Check className="w-3.5 h-3.5 text-green-600" />
                          : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => revoke(s.id)}
                      aria-label="Revogar acesso"
                      title="Revogar"
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
