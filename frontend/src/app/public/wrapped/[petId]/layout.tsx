import type { Metadata } from 'next'
import { buildMeta, fetchPublic } from '@/lib/publicMeta'

type Wrapped = { pet_name: string; year: number; highlights: Array<{ stat: number; label: string }> }

export async function generateMetadata({ params }: { params: { petId: string } }): Promise<Metadata> {
  const d = await fetchPublic<Wrapped>(`/public/wrapped/${encodeURIComponent(params.petId)}`)
  const path = `/public/wrapped/${params.petId}`
  if (!d) return buildMeta({ title: 'Retrospectiva — PetLife', description: 'O ano do pet em números.', path })
  const nums = d.highlights.filter(h => h.stat).slice(0, 3).map(h => `${h.stat} ${h.label}`).join(' · ')
  return buildMeta({ title: `O ano de ${d.pet_name} em ${d.year}`, description: nums || 'O ano do pet em números.', path })
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
