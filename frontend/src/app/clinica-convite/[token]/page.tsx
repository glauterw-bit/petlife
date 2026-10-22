'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { Building2, Check, Syringe, Bell, PawPrint, Plus, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/ToastContext'
import { tutorClinic, isCrmError, type ClinicInviteInfo } from '@/lib/crmApi'
import { savePendingClinicInvite } from '@/lib/petDraft'

const SPECIES: Record<string, string> = { dog: 'Cão', cat: 'Gato', other: 'Outro' }
const NEW_PET = -1

function hasToken(): boolean {
  try { return !!localStorage.getItem('petlife_token') } catch { return false }
}

export default function ClinicInvitePage() {
  const params = useParams<{ token: string }>()
  const token = decodeURIComponent(String(params?.token || ''))
  const [logged, setLogged] = useState<boolean | null>(null)

  useEffect(() => {
    const ok = hasToken()
    setLogged(ok)
    if (!ok && token) savePendingClinicInvite(token)
  }, [token])

  if (logged === null) return <div className="min-h-screen bg-surface-50 dark:bg-surface-900" />
  if (!logged) return <LoginFirst />
  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto">
        <InviteFlow token={token} />
      </div>
    </DashboardLayout>
  )
}

function LoginFirst() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-4">
          <Building2 className="w-6 h-6 text-primary-600 dark:text-primary-300" />
        </div>
        <h1 className="text-lg font-bold text-surface-900 dark:text-white">Uma clínica quer registrar as vacinas do seu pet no app</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">Entre ou crie sua conta grátis para continuar.</p>
        <div className="mt-6 grid gap-2">
          <Link href="/auth/login" className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition">
            Entrar
          </Link>
          <Link href="/auth/register" className="w-full py-2.5 rounded-xl text-sm font-semibold border border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition">
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  )
}

type Phase = 'loading' | 'ready' | 'gone' | 'error' | 'done'

function InviteFlow({ token }: { token: string }) {
  const router = useRouter()
  const { error: toastError } = useToast()
  const [phase, setPhase] = useState<Phase>('loading')
  const [info, setInfo] = useState<ClinicInviteInfo | null>(null)
  const [errMsg, setErrMsg] = useState('')
  const [choice, setChoice] = useState<number | null>(null)
  const [importPast, setImportPast] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ pet_id: number; clinic_name: string; imported_vaccines: number } | null>(null)

  const load = useCallback(async () => {
    setPhase('loading')
    try {
      const d = await tutorClinic.invite(token)
      setInfo(d)
      setChoice(d.suggested_pet_id ?? (d.pets.length === 0 ? NEW_PET : null))
      setPhase('ready')
    } catch (e) {
      if (isCrmError(e) && (e.status === 410 || e.status === 404)) { setPhase('gone'); return }
      setErrMsg(e instanceof Error ? e.message : 'Tente de novo em instantes.')
      setPhase('error')
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  async function accept() {
    if (!info || choice === null) return
    setSaving(true)
    try {
      const r = await tutorClinic.accept(token, {
        pet_id: choice === NEW_PET ? null : choice,
        create_pet: choice === NEW_PET,
        import_past_vaccines: info.past_vaccines_count > 0 && importPast,
      })
      setResult(r)
      setPhase('done')
    } catch (e) {
      if (isCrmError(e) && e.status === 410) { setPhase('gone'); return }
      toastError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6 space-y-4" aria-busy="true" aria-label="Carregando convite">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

  if (phase === 'gone') {
    return (
      <Notice
        icon={<AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-300" />}
        title="Convite indisponível"
        text="Este convite expirou ou já foi usado. Peça um novo à clínica."
        action={<Link href="/dashboard" className="inline-flex px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white">Ir para o início</Link>}
      />
    )
  }

  if (phase === 'error') {
    return (
      <Notice
        icon={<AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-300" />}
        title="Não foi possível carregar o convite."
        text={errMsg}
        action={<button onClick={() => void load()} className="inline-flex px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white">Tentar de novo</button>}
      />
    )
  }

  if (phase === 'done' && result && info) {
    const petName = choice === NEW_PET ? info.patient.name : (info.pets.find(p => p.id === result.pet_id)?.name ?? info.patient.name)
    return (
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6 text-center">
        <SuccessCheck />
        <h1 className="text-lg font-bold text-surface-900 dark:text-white mt-4">Pronto! {petName} está ligado à {result.clinic_name}.</h1>
        {result.imported_vaccines > 0 && (
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">
            {result.imported_vaccines === 1 ? '1 vacina foi para a carteirinha.' : `${result.imported_vaccines} vacinas foram para a carteirinha.`}
          </p>
        )}
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link href={result.pet_id ? `/pets/${result.pet_id}` : '/dashboard'} className="py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition">
            Ver carteirinha
          </Link>
          <Link href="/clinicas-com-acesso" className="py-2.5 rounded-xl text-sm font-semibold border border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition">
            Clínicas com acesso
          </Link>
        </div>
      </div>
    )
  }

  if (!info) return null
  const shareIcons = [Syringe, Bell]
  const n = info.past_vaccines_count

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5 sm:p-6">
      <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-4">
        <Building2 className="w-6 h-6 text-primary-600 dark:text-primary-300" />
      </div>
      <h1 className="text-xl font-bold text-surface-900 dark:text-white leading-tight">
        {info.clinic.name} quer registrar as vacinas de {info.patient.name} na sua carteirinha
      </h1>
      {(info.clinic.city || info.clinic.state) && (
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{[info.clinic.city, info.clinic.state].filter(Boolean).join(' · ')}</p>
      )}

      <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400 mt-6 mb-2">A clínica vai poder</h2>
      <ul className="space-y-2">
        {info.shares.map((s, i) => {
          const Icon = shareIcons[i] ?? ShieldCheck
          return (
            <li key={s} className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-200">
              <span className="w-8 h-8 rounded-xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary-600 dark:text-primary-300" />
              </span>
              {s}
            </li>
          )
        })}
      </ul>

      <fieldset className="mt-6">
        <legend className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-2">Qual é o pet?</legend>
        <div className="space-y-2">
          {info.pets.map(p => (
            <PetOption key={p.id} checked={choice === p.id} onSelect={() => setChoice(p.id)}
              title={p.name} sub={[SPECIES[p.species] ?? p.species, p.already_shared ? 'Já compartilhado com esta clínica' : null].filter(Boolean).join(' · ')}
              icon={<PawPrint className="w-4 h-4" />} />
          ))}
          <PetOption checked={choice === NEW_PET} onSelect={() => setChoice(NEW_PET)}
            title={`Criar ${info.patient.name} no meu app`} sub={SPECIES[info.patient.species] ?? ''}
            icon={<Plus className="w-4 h-4" />} />
        </div>
      </fieldset>

      {n > 0 && (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-surface-50 dark:bg-surface-900/50 px-4 py-3">
          <span id="import-past" className="text-sm text-surface-700 dark:text-surface-200">
            {n === 1 ? 'Trazer a 1 vacina já aplicada na clínica' : `Trazer as ${n} vacinas já aplicadas na clínica`}
          </span>
          <button type="button" role="switch" aria-checked={importPast} aria-labelledby="import-past" onClick={() => setImportPast(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${importPast ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'}`}>
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${importPast ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button onClick={() => router.push('/dashboard')} disabled={saving}
          className="py-2.5 rounded-xl text-sm font-semibold border border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-60 sm:order-1">
          Agora não
        </button>
        <button onClick={() => void accept()} disabled={saving || choice === null}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-60 transition sm:order-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Permitir
        </button>
      </div>
      <p className="text-xs text-surface-500 dark:text-surface-400 mt-4 text-center">
        Você pode retirar o acesso quando quiser em Configurações › Clínicas com acesso.
      </p>
    </div>
  )
}

function PetOption({ checked, onSelect, title, sub, icon }: { checked: boolean; onSelect: () => void; title: string; sub: string; icon: ReactNode }) {
  return (
    <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${checked
      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
      : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'}`}>
      <input type="radio" name="pet" checked={checked} onChange={onSelect} className="sr-only" />
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${checked ? 'bg-primary-500 text-white' : 'bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-300'}`}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-surface-900 dark:text-white truncate">{title}</span>
        {sub && <span className="block text-xs text-surface-500 dark:text-surface-400">{sub}</span>}
      </span>
      <span aria-hidden className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${checked ? 'border-primary-500' : 'border-surface-300 dark:border-surface-600'}`}>
        {checked && <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
      </span>
    </label>
  )
}

function Notice({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action: ReactNode }) {
  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6 text-center" role="alert">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center mb-4">{icon}</div>
      <h1 className="text-lg font-bold text-surface-900 dark:text-white">{title}</h1>
      {text && <p className="text-sm text-surface-500 dark:text-surface-400 mt-2">{text}</p>}
      <div className="mt-5">{action}</div>
    </div>
  )
}

function SuccessCheck() {
  const reduce = useReducedMotion()
  return (
    <svg viewBox="0 0 56 56" className="w-14 h-14 mx-auto text-primary-500" aria-hidden>
      <motion.circle cx="28" cy="28" r="25" fill="none" stroke="currentColor" strokeWidth="3"
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} />
      <motion.path d="M17 29l7 7 15-16" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.24, delay: reduce ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }} />
    </svg>
  )
}
