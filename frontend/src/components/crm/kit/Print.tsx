'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import type { CrmMe } from '@/lib/crmApi'
import { Btn, fmtPhone } from '../ui'
import { Sheet } from './Sheet'

/**
 * Prévia e impressão de documentos (receita, atestado, termo). A prévia é
 * sempre papel branco; ao imprimir, só o documento vai para a impressora.
 */
export function PrintDoc({ open, onClose, title, children, actions }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; actions?: ReactNode
}) {
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!printing) return
    const done = () => {
      document.body.classList.remove('crm-printing')
      setPrinting(false)
    }
    window.addEventListener('afterprint', done)
    document.body.classList.add('crm-printing')
    const t = window.setTimeout(() => {
      window.print()
      // navegador sem afterprint: window.print() já bloqueou até fechar
      if (!('onafterprint' in window)) setTimeout(done, 500)
    }, 60)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('afterprint', done)
      document.body.classList.remove('crm-printing')
    }
  }, [printing])

  return (
    <>
      <Sheet open={open} onClose={onClose} title={title} size="xl" initialFocus={false}
        footer={<>
          {actions}
          <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
          <Btn icon={Printer} onClick={() => setPrinting(true)} loading={printing}>Imprimir</Btn>
        </>}>
        <div className="rounded-xl bg-surface-200/60 dark:bg-surface-950 p-2 sm:p-4">
          <div className="mx-auto w-full max-w-[794px] bg-white text-black shadow-crm-card rounded-md p-6 sm:p-10 [color-scheme:light]">
            {children}
          </div>
        </div>
      </Sheet>
      {printing && typeof document !== 'undefined' && createPortal(
        <div className="crm-print-portal bg-white text-black">{children}</div>,
        document.body,
      )}
    </>
  )
}

export function Letterhead({ clinic, professional }: { clinic: CrmMe['clinic']; professional?: { name: string; crmv?: string | null } | null }) {
  const place = [clinic.address, [clinic.city, clinic.state].filter(Boolean).join('/')].filter(Boolean).join(' · ')
  const contact = [clinic.phone ? fmtPhone(clinic.phone) : null, clinic.email].filter(Boolean).join(' · ')
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-black/80 pb-3 mb-6 text-black">
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{clinic.name}</p>
        {clinic.cnpj && <p className="text-xs mt-0.5">CNPJ {clinic.cnpj}</p>}
        {place && <p className="text-xs mt-0.5">{place}</p>}
        {contact && <p className="text-xs mt-0.5">{contact}</p>}
      </div>
      {professional && (
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{professional.name}</p>
          {professional.crmv && <p className="text-xs">CRMV {professional.crmv}</p>}
        </div>
      )}
    </header>
  )
}

export function SignatureLine({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mt-16 mx-auto w-full max-w-[320px] text-center text-black">
      <div className="border-t border-black pt-1.5">
        <p className="text-sm font-semibold">{label}</p>
        {sub && <p className="text-xs">{sub}</p>}
      </div>
    </div>
  )
}
