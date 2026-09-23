'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PawPrint, Syringe, Bell, FileText, ArrowRight, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import { savePetDraft, loadPetDraft } from '@/lib/petDraft'
import { track } from '@/lib/track'
import { hapticLight } from '@/lib/feedback'

/**
 * Primeira abertura do app nativo: o pet vem antes da conta.
 *
 * Antes o app abria na página de apresentação do site (só em português) e
 * depois num formulário de 5 campos — 55% de quem baixava não chegava a criar
 * a conta. Aqui: boas-vindas → nome do pet → cão ou gato → conta (Apple em um
 * toque ou e-mail). O pet é criado sozinho logo depois do cadastro.
 */
export default function StartPage() {
  const t = useT()
  const router = useRouter()
  const { user, isLoading, isVetUser } = useAuth()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')

  useEffect(() => {
    if (!isLoading && user) router.replace(isVetUser ? '/vet/dashboard' : '/dashboard')
  }, [isLoading, user, isVetUser, router])

  useEffect(() => {
    setName(loadPetDraft()?.name ?? '')
    track('start_shown')
  }, [])

  function next() {
    void hapticLight()
    setStep(s => s + 1)
  }

  function choose(species: 'dog' | 'cat') {
    void hapticLight()
    savePetDraft({ name: name.trim(), species })
    track('start_pet_done')
    const ref = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null
    router.push(`/auth/register${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`)
  }

  const petName = name.trim()

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-surface-900 dark:via-surface-900 dark:to-surface-800 flex flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between h-10">
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)} aria-label={t('nav.back')} className="p-2 -ml-2 rounded-xl text-surface-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : <span />}
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary-500' : 'w-1.5 bg-surface-300 dark:bg-surface-600'}`} />
          ))}
        </div>
        <span className="w-9" />
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto animate-fade-in" key={step}>
        {step === 0 && (
          <>
            <div className="w-20 h-20 bg-primary-500 rounded-3xl flex items-center justify-center shadow-lg shadow-primary-500/30 mb-6">
              <PawPrint className="w-11 h-11 text-white" />
            </div>
            <h1 className="font-display text-3xl font-bold text-surface-900 dark:text-white leading-tight mb-3">
              {t('st.welcomeTitle')}
            </h1>
            <p className="text-surface-600 dark:text-surface-300 mb-7">{t('st.welcomeBody')}</p>
            <div className="space-y-3 mb-8">
              {([
                [Syringe, t('st.b1')],
                [Bell, t('st.b2')],
                [FileText, t('st.b3')],
              ] as const).map(([Icon, label]) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-800 shadow-sm flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className="text-sm font-medium text-surface-800 dark:text-surface-100">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-5xl mb-4">🐾</p>
            <h1 className="font-display text-2xl font-bold text-surface-900 dark:text-white mb-2">{t('st.nameTitle')}</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">{t('st.nameHint')}</p>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && petName) next() }}
              maxLength={60}
              placeholder={t('st.namePh')}
              className="w-full px-4 py-4 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-lg text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-2xl font-bold text-surface-900 dark:text-white mb-6">
              {t('st.speciesTitle', { name: petName })}
            </h1>
            <div className="grid grid-cols-2 gap-3">
              {([['dog', '🐶', t('pet.dog')], ['cat', '🐱', t('pet.cat')]] as const).map(([sp, emoji, label]) => (
                <button
                  key={sp}
                  onClick={() => choose(sp)}
                  className="pressable flex flex-col items-center gap-2 py-8 rounded-3xl bg-white dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 hover:border-primary-400 transition"
                >
                  <span className="text-6xl leading-none">{emoji}</span>
                  <span className="font-semibold text-surface-800 dark:text-surface-100">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="max-w-md w-full mx-auto space-y-3">
        {step === 0 && (
          <>
            <button onClick={next} className="pressable w-full flex items-center justify-center gap-2 bg-primary-500 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary-500/30">
              {t('st.cta')} <ArrowRight className="w-5 h-5" />
            </button>
            <Link href="/auth/login" className="block text-center text-sm font-medium text-surface-600 dark:text-surface-300 py-2">
              {t('st.hasAccount')}
            </Link>
          </>
        )}
        {step === 1 && (
          <button onClick={next} disabled={!petName} className="pressable w-full flex items-center justify-center gap-2 bg-primary-500 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-primary-500/30 disabled:opacity-40">
            {t('st.continue')} <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}
