import type { Metadata } from 'next'
import { buildMeta, fetchPublic, absPhoto } from '@/lib/publicMeta'

type Lost = { pet: { name: string; breed: string | null; photo: string | null }; is_lost: boolean; last_seen: string | null }

export async function generateMetadata({ params }: { params: { petId: string } }): Promise<Metadata> {
  const d = await fetchPublic<Lost>(`/public/lost/${encodeURIComponent(params.petId)}`)
  if (!d) return buildMeta({ title: 'PetLife', description: 'Leia o QR da coleira para avisar o tutor.', path: `/public/lost/${params.petId}` })
  const raca = d.pet.breed ? ` (${d.pet.breed})` : ''
  return d.is_lost
    ? buildMeta({
        title: `PROCURA-SE: ${d.pet.name}${raca}`,
        description: `${d.last_seen ? `Visto por último: ${d.last_seen}. ` : ''}Toque para avisar o tutor sem precisar do telefone.`,
        path: `/public/lost/${params.petId}`,
        image: absPhoto(d.pet.photo),
        index: true,
      })
    : buildMeta({
        title: `${d.pet.name}${raca} — QR da coleira`,
        description: `Encontrou o ${d.pet.name}? Toque para avisar o tutor pelo PetLife.`,
        path: `/public/lost/${params.petId}`,
        image: absPhoto(d.pet.photo),
      })
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
