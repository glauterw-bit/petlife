'use client'

import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCrm } from '@/components/crm/CrmShell'
import { Card, PageHead } from '@/components/crm/ui'
import { SkeletonRows, Tabs } from '@/components/crm/kit'
import { RemindersTab } from '@/components/crm/painel/RemindersTab'
import { ConfirmTab } from '@/components/crm/painel/ConfirmTab'

type Aba = 'vacinas' | 'confirmar'

export default function LembretesPage() {
  return (
    <Suspense fallback={<div><PageHead title="Lembretes" /><Card><SkeletonRows /></Card></div>}>
      <Lembretes />
    </Suspense>
  )
}

function Lembretes() {
  const { me } = useCrm()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const aba: Aba = params.get('aba') === 'confirmar' ? 'confirmar' : 'vacinas'
  const setAba = (v: Aba) => router.replace(v === 'confirmar' ? `${pathname}?aba=confirmar` : pathname, { scroll: false })

  return (
    <div>
      <PageHead
        title="Lembretes"
        sub={aba === 'vacinas' ? 'Vacinas e retornos para avisar pelo WhatsApp' : 'Confirme os agendamentos do dia seguinte em poucos toques'}
      />
      <Tabs id="lembretes" value={aba} onChange={setAba} className="mb-4"
        tabs={[{ value: 'vacinas', label: 'Vacinas e retornos' }, { value: 'confirmar', label: 'Confirmar agendamentos' }]} />
      {aba === 'vacinas' ? <RemindersTab clinicName={me.clinic.name} /> : <ConfirmTab clinicName={me.clinic.name} />}
    </div>
  )
}
