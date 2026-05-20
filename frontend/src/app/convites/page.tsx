'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Check, X, Loader2, PawPrint, MailOpen } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { innovations, type InviteEntry } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

const ROLE_LABEL: Record<string, string> = {
  co_tutor: 'Co-tutor (acesso completo)',
  sitter: 'Pet sitter (acesso limitado)',
  familia: 'Família (visualização)',
}

function InvitesContent() {
  const router = useRouter()
  const search = useSearchParams()
  const { success, error } = useToast()
  const [invites, setInvites] = useState<InviteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  async function load() {
    try { setInvites(await innovations.myInvites()) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Aceitar automaticamente se URL tem ?token=
  useEffect(() => {
    const token = search.get('token')
    if (token) {
      innovations.acceptInvite(token)
        .then(r => {
          success(`Você aceitou cuidar de ${r.pet_name}!`)
          load()
          router.replace('/convites')
        })
        .catch((e: unknown) => error(e instanceof Error ? e.message : 'Não foi possível aceitar (já processado ou expirado).'))
    }
  }, [search])

  async function accept(token: string) {
    setProcessing(token)
    try {
      const r = await innovations.acceptInvite(token)
      success(`Você aceitou cuidar de ${r.pet_name}!`)
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setProcessing(null)
    }
  }

  async function decline(token: string) {
    setProcessing(token)
    try {
      await innovations.declineInvite(token)
      success('Convite recusado')
      await load()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setProcessing(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
          <MailOpen className="w-6 h-6 text-cyan-600" />
          Convites
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Convites pra cuidar de pets de outras pessoas.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
      ) : invites.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
          <Users className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <h3 className="font-bold text-surface-900 dark:text-white mb-1">Nenhum convite pendente</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400">Quando alguém te convidar pra cuidar de um pet, aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map(inv => (
            <div key={inv.id} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-50 to-cyan-50 dark:from-primary-900/30 dark:to-cyan-900/30 flex items-center justify-center shrink-0">
                  {inv.pet_photo ? (
                    <img src={`${API_URL}${inv.pet_photo}`} alt={inv.pet_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">{inv.pet_species === 'dog' ? '🐕' : '🐈'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-surface-900 dark:text-white">{inv.pet_name}</h3>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    Convite de <strong>{inv.inviter_name}</strong>
                  </p>
                  <p className="text-xs text-cyan-700 dark:text-cyan-300 mt-1">{ROLE_LABEL[inv.role]}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => decline(inv.invite_token)}
                  disabled={processing === inv.invite_token}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-60"
                >
                  <X className="w-4 h-4" />
                  Recusar
                </button>
                <button
                  onClick={() => accept(inv.invite_token)}
                  disabled={processing === inv.invite_token}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-60 transition shadow-md shadow-cyan-500/30"
                >
                  {processing === inv.invite_token ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Aceitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}

export default function InvitesPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div></DashboardLayout>}>
      <InvitesContent />
    </Suspense>
  )
}
