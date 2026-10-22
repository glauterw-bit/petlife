'use client'

import { PageTransition } from '@/components/crm/motion'

export default function ClinicaTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
