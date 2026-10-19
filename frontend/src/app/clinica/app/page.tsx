'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { crm, type AppPet } from '@/lib/crmApi'
import { useCrm } from '@/components/crm/CrmShell'
import { Card, PageHead, Btn, Empty, Badge, fmtDate, SPECIES } from '@/components/crm/ui'
import { useToast } from '@/components/ui/ToastContext'

export default function ClientesDoApp() {
  const { me } = useCrm()
  const router = useRouter()
  const { error, success } = useToast()
  const [list, setList] = useState<AppPet[]>([])
  const load = () => crm.appPatients().then(setList).catch(() => {})
  useEffect(() => { load() }, [])
  async function imp(p: AppPet) {
    try { const r = await crm.importAppPatient(p.pet_id); success(r.already ? 'Já estava importado.' : `${p.pet_name} agora é paciente da clínica.`); router.push(`/clinica/pacientes/${r.patient_id}`) }
    catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }
  return (
    <div>
      <PageHead title="Clientes do app PetLife" sub="Tutores que liberaram o pet para a sua clínica no app" />
      <Card className="mb-4">
        <p className="text-sm text-surface-700 dark:text-surface-200"><b>Como funciona:</b> o tutor abre o pet no app PetLife e libera o acesso para a <b>{me.clinic.name}</b>. O pet aparece aqui; ao importar, ele vira paciente com o histórico do app, e <b>toda vacina que você registrar vai direto para a carteirinha do tutor</b>, com aviso no celular dele.</p>
        <p className="text-xs text-surface-500 mt-2">Peça aos seus clientes para baixar o PetLife (grátis na App Store) e liberar o acesso à clínica — eles recebem os lembretes de vacina e você recebe o cliente de volta.</p>
      </Card>
      <Card className="!p-0">
        {list.length === 0 ? <Empty>Nenhum tutor liberou um pet para a clínica ainda.</Empty> : list.map(p => (
          <div key={p.pet_id} className="flex items-center gap-3 flex-wrap px-4 py-3 border-b border-surface-50 dark:border-surface-700/50 last:border-0">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold text-surface-900 dark:text-white">{SPECIES[p.species]?.split(' ')[0]} {p.pet_name}</p>
              <p className="text-xs text-surface-500">{p.owner_name} · {p.owner_phone || p.owner_email} · liberado em {fmtDate(p.granted_at)}</p>
            </div>
            {p.imported ? <Badge cls="bg-emerald-100 text-emerald-700">já é paciente</Badge> : <Btn onClick={() => imp(p)}>Importar como paciente</Btn>}
          </div>
        ))}
      </Card>
    </div>
  )
}
