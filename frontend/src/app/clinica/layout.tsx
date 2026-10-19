import type { Metadata } from 'next'
import { CrmShell } from '@/components/crm/CrmShell'

export const metadata: Metadata = { title: 'PetLife Clínica', description: 'Gestão para clínicas veterinárias e pet shops' }

export default function ClinicaLayout({ children }: { children: React.ReactNode }) {
  return <CrmShell>{children}</CrmShell>
}
