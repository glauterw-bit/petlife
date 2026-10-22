'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Sale } from '@/lib/crmApi'
import { PageHead } from '@/components/crm/ui'
import { SkeletonCard } from '@/components/crm/kit'
import { CashBar, useCashCurrent } from '@/components/crm/caixa/CashBar'
import { Pos } from '@/components/crm/caixa/Pos'
import { SalesPanel } from '@/components/crm/caixa/SalesPanel'
import { ReceiptDoc } from '@/components/crm/caixa/ReceiptDoc'

function Caixa() {
  const params = useSearchParams()
  const cash = useCashCurrent()
  const appointmentId = Number(params.get('appointment') || 0) || null
  const clientId = Number(params.get('client') || 0) || null
  const saleParam = Number(params.get('sale') || 0) || null
  const [receipt, setReceipt] = useState<{ id: number; sale?: Sale } | null>(null)

  useEffect(() => { if (saleParam) setReceipt({ id: saleParam }) }, [saleParam])

  return (
    <div>
      <PageHead title="Caixa" sub="Vendas, recebimentos e o caixa do dia" />
      <CashBar cash={cash} />
      <Pos cash={cash} appointmentId={appointmentId} clientId={clientId} onReceipt={(id, sale) => setReceipt({ id, sale })} />
      <SalesPanel hasCash={!!cash.session} onReceipt={id => setReceipt({ id })} />
      <ReceiptDoc saleId={receipt?.id ?? null} initial={receipt?.sale ?? null} onClose={() => setReceipt(null)} />
    </div>
  )
}

export default function CaixaPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><SkeletonCard lines={2} /><SkeletonCard lines={6} /></div>}>
      <Caixa />
    </Suspense>
  )
}
