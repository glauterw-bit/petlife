'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { crm, type Client } from '@/lib/crmApi'
import { Card, PageHead, Btn, Input, Empty, Badge, waLink, SPECIES } from '@/components/crm/ui'
import { ClientModal } from '@/components/crm/forms'

export default function Clientes() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [list, setList] = useState<Client[] | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => { crm.clients(q).then(setList).catch(() => setList([])) }, 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div>
      <PageHead title="Clientes e pets" sub={list ? `${list.length} cliente${list.length === 1 ? '' : 's'}` : ''} actions={<Btn onClick={() => setOpen(true)}>+ Novo cliente</Btn>} />
      <Input placeholder="Buscar por tutor, pet, telefone ou e-mail…" value={q} onChange={e => setQ(e.target.value)} className="mb-4" />
      <Card className="!p-0 overflow-x-auto">
        {list && list.length === 0 ? <Empty>Nenhum cliente encontrado.</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-500 dark:text-surface-400 border-b border-surface-100 dark:border-surface-700">
              <th className="p-3 font-medium">Tutor</th><th className="p-3 font-medium">Pets</th><th className="p-3 font-medium">Contato</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {(list ?? []).map(c => {
                const wa = waLink(c.phone, `Olá, ${c.name.split(' ')[0]}! 🐾`)
                return (
                  <tr key={c.id} className="border-b border-surface-50 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/30 cursor-pointer" onClick={() => router.push(`/clinica/clientes/${c.id}`)}>
                    <td className="p-3 font-semibold text-surface-900 dark:text-white">{c.name} {c.petlife_linked && <Badge cls="bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 ml-1">app</Badge>}</td>
                    <td className="p-3 text-surface-700 dark:text-surface-200">
                      {(c.patients ?? []).map(p => (
                        <Link key={p.id} href={`/clinica/pacientes/${p.id}`} onClick={e => e.stopPropagation()} className="mr-2 hover:underline whitespace-nowrap">{SPECIES[p.species]?.split(' ')[0]} {p.name}</Link>
                      ))}
                    </td>
                    <td className="p-3 text-surface-500 dark:text-surface-400 whitespace-nowrap">{c.phone || c.email || '—'}</td>
                    <td className="p-3 text-right">{wa && <a href={wa} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs font-semibold text-emerald-700">WhatsApp</a>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
      <ClientModal open={open} onClose={() => setOpen(false)} onSaved={c => router.push(`/clinica/clientes/${c.id}`)} />
    </div>
  )
}
