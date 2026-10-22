import type { Metadata } from 'next'
import { buildMeta, fetchPublic, absPhoto } from '@/lib/publicMeta'

type Card = { pet: { name: string; photo: string | null }; vaccines: Array<{ next_due: string | null }> }

export async function generateMetadata({ params }: { params: { petId: string } }): Promise<Metadata> {
  const d = await fetchPublic<Card>(`/public/carteirinha/${encodeURIComponent(params.petId)}`)
  const path = `/public/carteirinha/${params.petId}`
  if (!d) return buildMeta({ title: 'Carteirinha de vacinação — PetLife', description: 'Carteirinha de vacinação digital do pet.', path })
  const hoje = new Date().toISOString().slice(0, 10)
  const emDia = d.vaccines.filter(v => !v.next_due || v.next_due.slice(0, 10) >= hoje).length
  // Sem nome do tutor na prévia: o WhatsApp guarda a imagem e o texto em cache.
  return buildMeta({
    title: `Carteirinha de vacinação de ${d.pet.name}`,
    description: `${d.vaccines.length} ${d.vaccines.length === 1 ? 'vacina registrada' : 'vacinas registradas'}, ${emDia} em dia. Toque para ver as datas.`,
    path,
    image: absPhoto(d.pet.photo),
  })
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
