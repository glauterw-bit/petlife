'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, ShieldOff, Loader2, AlertTriangle } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/ToastContext'
import { tutorClinic, type ClinicAccess } from '@/lib/crmApi'

function fmtDay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
}

export default function ClinicAccessPage() {
  const { success, error } = useToast()
  const [rows, setRows] = useState<ClinicAccess[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [target, setTarget] = useState<ClinicAccess | null>(null)
  const [revoking, setRevoking] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try { setRows(await tutorClinic.access()) }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Tente de novo em instantes.') }
  }, [])

  useEffect(() => {
    let logged = false
    try { logged = !!localStorage.getItem('petlife_token') } catch {}
    if (logged) void load()
  }, [load])

  async function revoke() {
    if (!target) return
    setRevoking(true)
    try {
      await tutorClinic.revoke(target.pet_id, target.clinic_id)
      setRows(r => (r ?? []).filter(x => !(x.pet_id === target.pet_id && x.clinic_id === target.clinic_id)))
      success(`${target.clinic_name} não tem mais acesso a ${target.pet_name}.`)
      setTarget(null)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Não foi possível retirar o acesso.')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-5 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight">Clínicas com acesso</h1>
          <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">
            Clínicas que podem registrar vacinas na carteirinha dos seus pets. Você pode retirar o acesso quando quiser.
          </p>
        </div>

        {loadError && !rows ? (
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6 text-center" role="alert">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="font-semibold text-surface-900 dark:text-white">Não foi possível carregar.</p>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{loadError}</p>
            <button onClick={() => void load()} className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white">Tentar de novo</button>
          </div>
        ) : rows === null ? (
          <div className="space-y-3" aria-busy="true" aria-label="Carregando">
            {[0, 1].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-14 px-6 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3">
              <Building2 className="w-6 h-6 text-primary-600 dark:text-primary-300" />
            </div>
            <h2 className="font-bold text-surface-900 dark:text-white">Nenhuma clínica tem acesso</h2>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Quando você aceitar o convite de uma clínica, ela aparece aqui.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map(r => (
              <li key={`${r.pet_id}-${r.clinic_id}`} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-surface-900 dark:text-white truncate">{r.clinic_name}</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400 truncate">
                    {[r.pet_name, r.clinic_city, r.granted_at ? `desde ${fmtDay(r.granted_at)}` : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button onClick={() => setTarget(r)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition">
                  <ShieldOff className="w-4 h-4" />
                  <span className="hidden sm:inline">Retirar acesso</span>
                  <span className="sm:hidden">Retirar</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!target} onClose={() => !revoking && setTarget(null)} title="Retirar acesso?" size="sm">
        {target && (
          <div>
            <p className="text-sm text-surface-600 dark:text-surface-300">
              {target.clinic_name} deixa de registrar vacinas de {target.pet_name} no seu app. O que já está na carteirinha continua lá.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setTarget(null)} disabled={revoking}
                className="py-2.5 rounded-xl text-sm font-semibold border border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-60">
                Cancelar
              </button>
              <button onClick={() => void revoke()} disabled={revoking}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white disabled:opacity-60">
                {revoking && <Loader2 className="w-4 h-4 animate-spin" />}
                Retirar acesso
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
