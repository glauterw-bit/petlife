'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, MessageCircle, ShieldCheck } from 'lucide-react'
import { useToast } from '@/components/ui/ToastContext'
import { crm, isCrmError, type Client, type Patient } from '@/lib/crmApi'
import { Btn, toDate, waLink } from '@/components/crm/ui'
import { Sheet, Skeleton, ErrorState } from '@/components/crm/kit'
import { useCrm, emitCrmChange } from '@/components/crm/CrmShell'

/** Convite para o tutor ligar o pet ao app PetLife (com consentimento dele). */
export function InviteSheet({ open, onClose, patient, client }: { open: boolean; onClose: () => void; patient: Patient; client: Client }) {
  const { me } = useCrm()
  const { success, info } = useToast()
  const [inv, setInv] = useState<{ url: string; expires_at: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!open) return
    let alive = true
    setInv(null); setErr(null); setCopied(false)
    crm.invitePatient(patient.id)
      .then(r => {
        if (!alive) return
        setInv({ url: `${window.location.origin}${r.path}`, expires_at: r.expires_at })
        emitCrmChange('patient')
      })
      .catch(e => {
        if (!alive) return
        if (isCrmError(e) && e.status === 409) {
          info(e.message || 'Este pet já está ligado ao app do tutor.')
          emitCrmChange('patient')
          onClose()
          return
        }
        setErr(e instanceof Error ? e.message : 'Não foi possível criar o convite.')
      })
    return () => { alive = false }
  }, [open, patient.id, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  async function copy() {
    if (!inv) return
    try {
      await navigator.clipboard.writeText(inv.url)
      setCopied(true)
      success('Link copiado.')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      inputRef.current?.focus()
      inputRef.current?.select()
      info('Selecionamos o link. Use Ctrl+C ou Copiar do celular.')
    }
  }

  const msg = inv ? `Olá, ${client.name.split(' ')[0]}! A ${me.clinic.name} quer registrar as vacinas de ${patient.name} na carteirinha do app PetLife (grátis para iPhone e Android). Toque para autorizar: ${inv.url}` : ''
  const wa = inv ? waLink(client.phone, msg) : null
  const until = inv ? toDate(inv.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''

  return (
    <Sheet open={open} onClose={onClose} size="md" title="Convidar para o app" description={`${patient.name} · ${client.name}`} initialFocus={false}
      footer={<Btn variant="ghost" onClick={onClose}>Fechar</Btn>}>
      {err ? (
        <ErrorState message={err} onRetry={() => setTick(t => t + 1)} compact />
      ) : !inv ? (
        <div className="space-y-3" role="status" aria-label="Criando convite">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-9 w-full" />
          <div className="flex gap-2"><Skeleton className="h-9 w-28" /><Skeleton className="h-9 w-44" /></div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink">
            Envie este link ao tutor. Ao abrir, ele vê o que a clínica vai compartilhar e decide se autoriza.
          </p>
          <div>
            <label htmlFor="invite-url" className="block text-xs font-semibold text-ink/80 mb-1">Link do convite</label>
            <input id="invite-url" ref={inputRef} readOnly value={inv.url} onFocus={e => e.currentTarget.select()}
              className="w-full h-9 px-3 rounded-lg border border-line bg-panel-2/60 text-sm text-ink font-mono truncate focus:outline-none focus:border-primary-500 focus:shadow-crm-glow" />
            <p className="text-xs text-muted mt-1 tabular-nums">Vale até {until}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copiado' : 'Copiar'}</Btn>
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-surface-950 dark:hover:bg-primary-400 transition-colors">
                <MessageCircle className="w-4 h-4" strokeWidth={1.75} aria-hidden /> Enviar no WhatsApp
              </a>
            ) : (
              <p className="text-xs text-muted self-center">Cadastre o celular do tutor para enviar pelo WhatsApp.</p>
            )}
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-panel-2 px-3 py-2.5 text-xs text-muted">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-px text-primary-600 dark:text-primary-400" strokeWidth={1.75} aria-hidden />
            O tutor escolhe se autoriza e pode retirar quando quiser.
          </p>
        </div>
      )}
    </Sheet>
  )
}
