import type { Metadata } from 'next'
import { buildMeta, fetchPublic, absPhoto } from '@/lib/publicMeta'

type Card = { pet: { name: string; photo: string | null }; vaccines: Array<{ name: string; date_given: string; next_due: string | null }> }

/** Só a dose mais recente de cada vacina: doses antigas não são "vacinas" a mais nem "atrasadas". */
function latestDoses(vs: Card['vaccines']): Card['vaccines'] {
  const key = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  const m = new Map<string, Card['vaccines'][number]>()
  for (const v of vs) {
    const k = key(v.name || '')
    const cur = m.get(k)
    if (!cur || (v.date_given || '') > (cur.date_given || '')) m.set(k, v)
  }
  return Array.from(m.values())
}

export async function generateMetadata({ params }: { params: { petId: string } }): Promise<Metadata> {
  const d = await fetchPublic<Card>(`/public/carteirinha/${encodeURIComponent(params.petId)}`)
  const path = `/public/carteirinha/${params.petId}`
  if (!d) return buildMeta({ title: 'Carteirinha de vacinação — PetLife', description: 'Carteirinha de vacinação digital do pet.', path })
  const hoje = new Date().toISOString().slice(0, 10)
  const atuais = latestDoses(d.vaccines)
  const emDia = atuais.filter(v => !v.next_due || v.next_due.slice(0, 10) >= hoje).length
  // Sem nome do tutor na prévia: o WhatsApp guarda a imagem e o texto em cache.
  return buildMeta({
    title: `Carteirinha de vacinação de ${d.pet.name}`,
    description: `${atuais.length} ${atuais.length === 1 ? 'vacina registrada' : 'vacinas registradas'} pelo tutor, ${emDia} em dia. Toque para ver as datas.`,
    path,
    image: absPhoto(d.pet.photo),
  })
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
