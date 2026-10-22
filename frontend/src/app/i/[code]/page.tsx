'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PawPrint, Gift, Copy, Check } from 'lucide-react'
import { appStoreUrl } from '@/components/public/DownloadCta'
import { track } from '@/lib/track'

/**
 * Link de indicação (/i/PET-XXXXXX).
 *
 * No iPhone, quem recebe vai para a App Store, e a App Store não leva o código
 * junto. Por isso a página mostra o código em destaque para copiar e digitar
 * no cadastro ("Tenho um código de convite"). Fora do iPhone, segue direto
 * para o cadastro web com o código preenchido.
 */
export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const code = String(params.code || '').toUpperCase()
  const [ios, setIos] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIos(isIos)
    track('public_view', { meta: 'indicacao' })
    if (!isIos) router.replace(`/auth/register?ref=${encodeURIComponent(code)}`)
  }, [code, router])

  async function copyAndGo() {
    try { await navigator.clipboard.writeText(code); setCopied(true) } catch {}
    track('public_cta_click', { meta: 'indicacao:app_store' })
    window.location.href = appStoreUrl('indicacao')
  }

  if (!ios) return <div className="min-h-screen flex items-center justify-center text-surface-500">Abrindo o PetLife…</div>

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white dark:from-surface-900 dark:to-surface-900 flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white dark:bg-surface-800 rounded-3xl shadow-lg p-6 text-center">
        <div className="w-14 h-14 mx-auto bg-primary-500 rounded-2xl flex items-center justify-center mb-3">
          <PawPrint className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-surface-900 dark:text-white">Você foi convidado para o PetLife</h1>
        <p className="text-sm text-surface-600 dark:text-surface-300 mt-2">
          Carteirinha de vacinas no celular e lembrete antes de cada dose. Grátis.
        </p>
        <div className="mt-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
          <p className="text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-center gap-1"><Gift className="w-4 h-4" /> Seu código de convite</p>
          <p className="text-2xl font-bold tracking-widest text-emerald-700 dark:text-emerald-300 mt-1">{code}</p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
            No cadastro, toque em &quot;Tenho um código de convite&quot;. Quando você cadastrar a primeira vacina, vocês dois ganham 30 dias de PetLife+.
          </p>
        </div>
        <button onClick={copyAndGo} className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-surface-900 dark:bg-white text-white dark:text-surface-900 px-5 py-3 rounded-2xl text-sm font-semibold">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copiar código e baixar na App Store
        </button>
        <a href={`/auth/register?ref=${encodeURIComponent(code)}`} className="block mt-3 text-sm text-primary-600 dark:text-primary-400 underline">
          Usar no navegador
        </a>
      </div>
    </div>
  )
}
