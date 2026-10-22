'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import { crm, type Appt, type ApptPatch, type ApptStatus } from '@/lib/crmApi'
import { useCrm, useCrmChange, emitCrmChange } from '@/components/crm/CrmShell'
import { Btn, Card, PageHead, dayRange, waLink, ymd } from '@/components/crm/ui'
import { DateNav, EmptyState, ErrorState, Skeleton, useAsync, useMediaQuery, useNow } from '@/components/crm/kit'
import { ApptModal } from '@/components/crm/forms'
import { useToast } from '@/components/ui/ToastContext'
import { ReceptionBoard } from '@/components/crm/painel/ReceptionBoard'
import { errMsg, firstName, openWa } from '@/components/crm/painel/shared'

const STAMP: Partial<Record<ApptStatus, keyof Appt>> = {
  confirmado: 'confirmed_at', chegou: 'checked_in_at', em_atendimento: 'started_at', pronto: 'ready_at', concluido: 'finished_at',
}

export default function Recepcao() {
  const { me } = useCrm()
  const toast = useToast()
  const now = useNow(30_000)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [day, setDay] = useState(() => new Date())
  const [apptOpen, setApptOpen] = useState(false)
  const key = ymd(day)

  const q = useAsync(() => { const [a, b] = dayRange(day); return crm.appointments(a, b) }, [key])
  useEffect(() => {
    const t = setInterval(q.reload, 30_000)
    return () => clearInterval(t)
  }, [q.reload])
  useCrmChange(['appointment', 'sale'], q.reload)
  const dataRef = useRef(q.data)
  dataRef.current = q.data

  /** Atualiza na hora e volta ao anterior se o servidor recusar. */
  async function patch(a: Appt, d: ApptPatch, optimistic: Partial<Appt>, failMsg: string) {
    const prev = q.data
    if (prev) q.setData(prev.map(x => (x.id === a.id ? { ...x, ...optimistic } : x)))
    try {
      const saved = await crm.patchAppt(a.id, d)
      q.setData((dataRef.current ?? prev ?? []).map(x => (x.id === a.id ? saved : x)))
      emitCrmChange('appointment')
    } catch (e) {
      if (prev) q.setData(prev)
      toast.error(errMsg(e, failMsg))
      throw e
    }
  }

  const onStatus = (a: Appt, s: ApptStatus) => {
    const nowIso = new Date().toISOString()
    const stamp = STAMP[s]
    const opt: Partial<Appt> = { status: s }
    if (stamp && !a[stamp]) (opt as Record<string, unknown>)[stamp] = nowIso
    return patch(a, { status: s }, opt, 'Não foi possível mudar a situação.')
  }

  const onNotifyReady = (a: Appt) => {
    const pet = a.patient_name || 'Seu pet'
    const url = waLink(a.client_phone, `Olá, ${firstName(a.client_name)}! ${pet} já está pronto(a) para buscar na ${me.clinic.name}.`)
    if (!url) { toast.error('Este cliente não tem celular cadastrado.'); return }
    openWa(url)
    patch(a, { mark_ready_notified: true }, { ready_notified_at: new Date().toISOString() }, 'Não foi possível marcar o aviso.')
      .catch(() => undefined)
  }

  const list = q.data
  const isToday = ymd(now) === key
  const active = (list ?? []).filter(a => a.status !== 'cancelado' && a.status !== 'faltou')
  const apptStart = useMemo(
    () => (isToday ? new Date() : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9)),
    [apptOpen, key], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const inside = active.filter(a => a.status === 'chegou' || a.status === 'em_atendimento' || a.status === 'pronto').length

  return (
    <div>
      <PageHead
        title="Recepção"
        sub={list ? `${active.length} ${active.length === 1 ? 'atendimento' : 'atendimentos'}${isToday ? ` · ${inside} na clínica agora` : ''}` : 'Fila do dia, da chegada à retirada'}
        actions={<Btn icon={Plus} onClick={() => setApptOpen(true)}>Encaixar</Btn>}
      />
      <div className="mb-4">
        <DateNav mode="day" value={day} onChange={d => setDay(d)} />
      </div>

      {!list && q.error ? (
        <Card><ErrorState message={q.error} onRetry={q.reload} /></Card>
      ) : !list ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3" role="status" aria-label="Carregando">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`rounded-2xl bg-panel-2/60 p-2.5 space-y-2 ${i > 0 ? 'hidden md:block' : ''}`}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="Ninguém na fila agora"
            hint={isToday ? 'Quando um cliente chegar, marque aqui e acompanhe até a retirada.' : 'Nenhum atendimento marcado neste dia.'}
            action={<Btn icon={Plus} onClick={() => setApptOpen(true)}>Agendar</Btn>} />
        </Card>
      ) : (
        <ReceptionBoard appts={list} now={now} isDesktop={isDesktop} onStatus={onStatus} onNotifyReady={onNotifyReady} />
      )}

      <ApptModal open={apptOpen} onClose={() => setApptOpen(false)}
        initialStart={apptStart} onSaved={() => q.reload()} />
    </div>
  )
}
