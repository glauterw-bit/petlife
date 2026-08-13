import type { Metadata } from 'next'
import Link from 'next/link'
import { PawPrint, Syringe, Footprints, Heart, Download } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'
const APP_STORE_URL = 'https://apps.apple.com/br/app/petlife-sa%C3%BAde-do-pet/id6768136468'

interface PublicPet {
  name: string
  species: 'dog' | 'cat'
  breed?: string | null
  birth_date?: string | null
  photo?: string | null
  bio?: string | null
  is_deceased: boolean
  stats: {
    walks_count: number
    walks_km: number
    vaccines_total: number
    vaccines_ok: boolean
    member_since?: string | null
  }
}

async function getPet(slug: string): Promise<PublicPet | null> {
  try {
    const res = await fetch(`${API_URL}/public/pet-profile/${slug}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function petAge(birth?: string | null): string | null {
  if (!birth) return null
  const b = new Date(birth)
  const months = Math.max(0, (Date.now() - b.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 12) return `${Math.max(1, Math.round(months))} meses`
  const anos = Math.floor(months / 12)
  return `${anos} ano${anos > 1 ? 's' : ''}`
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const pet = await getPet(params.slug)
  if (!pet) return { title: 'Pet não encontrado — PetLife' }
  const emoji = pet.species === 'cat' ? '🐱' : '🐶'
  return {
    title: `${pet.name} ${emoji} — PetLife`,
    description: `Conheça ${pet.name}${pet.breed ? `, ${pet.breed}` : ''}! Carteirinha de saúde digital no PetLife.`,
    openGraph: {
      title: `${pet.name} ${emoji} está no PetLife`,
      description: `${pet.stats.walks_km} km passeados · vacinas ${pet.stats.vaccines_ok ? 'em dia ✅' : 'registradas'} · Crie a carteirinha do seu pet também!`,
      ...(pet.photo ? { images: [pet.photo] } : {}),
    },
  }
}

export default async function PublicPetPage({ params }: { params: { slug: string } }) {
  const pet = await getPet(params.slug)

  if (!pet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🐾</div>
          <h1 className="text-xl font-bold text-surface-900 mb-2">Perfil não encontrado</h1>
          <p className="text-sm text-surface-500 mb-6">Este perfil não existe ou o tutor o tornou privado.</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
            <PawPrint className="w-4 h-4" /> Conhecer o PetLife
          </Link>
        </div>
      </div>
    )
  }

  const emoji = pet.species === 'cat' ? '🐱' : '🐶'
  const idade = petAge(pet.birth_date)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Cabeçalho PetLife */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <PawPrint className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-surface-900">PetLife</span>
        </div>

        {/* Card do pet */}
        <div className="bg-white rounded-3xl shadow-xl border border-surface-100 overflow-hidden">
          <div className="bg-gradient-to-br from-primary-500 to-emerald-600 h-24" />
          <div className="px-6 pb-6 -mt-14">
            <div className="w-28 h-28 mx-auto rounded-full ring-4 ring-white shadow-lg overflow-hidden bg-gradient-to-br from-primary-100 to-accent-100 flex items-center justify-center">
              {pet.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-6xl">{emoji}</span>
              )}
            </div>
            <div className="text-center mt-3">
              <h1 className="text-2xl font-bold text-surface-900">
                {pet.name} {pet.is_deceased ? '🌈' : emoji}
              </h1>
              <p className="text-sm text-surface-500">
                {[pet.breed, idade].filter(Boolean).join(' · ') || (pet.species === 'cat' ? 'Gato' : 'Cachorro')}
              </p>
              {pet.bio && <p className="text-sm text-surface-600 mt-2 leading-snug">{pet.bio}</p>}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-5">
              <div className="bg-primary-50 rounded-2xl p-3 text-center">
                <Footprints className="w-4 h-4 text-primary-600 mx-auto mb-1" />
                <div className="text-lg font-bold text-surface-900 leading-tight">{pet.stats.walks_km}</div>
                <div className="text-[11px] text-surface-500 leading-tight">km passeados</div>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                <Syringe className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <div className="text-lg font-bold text-surface-900 leading-tight">
                  {pet.stats.vaccines_ok ? '✓' : pet.stats.vaccines_total}
                </div>
                <div className="text-[11px] text-surface-500 leading-tight">
                  {pet.stats.vaccines_ok ? 'vacinas em dia' : 'vacinas'}
                </div>
              </div>
              <div className="bg-rose-50 rounded-2xl p-3 text-center">
                <Heart className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                <div className="text-lg font-bold text-surface-900 leading-tight">{pet.stats.walks_count}</div>
                <div className="text-[11px] text-surface-500 leading-tight">passeios</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 bg-white rounded-3xl shadow-lg border border-surface-100 p-5 text-center">
          <p className="text-sm text-surface-700 font-medium mb-3">
            Crie a carteirinha digital do seu pet — vacinas, IA veterinária e passeios num só app 🐾
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={APP_STORE_URL}
              className="inline-flex items-center justify-center gap-2 bg-surface-900 text-white px-5 py-3 rounded-2xl text-sm font-semibold"
            >
              <Download className="w-4 h-4" /> Baixar na App Store
            </a>
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 bg-primary-500 text-white px-5 py-3 rounded-2xl text-sm font-semibold"
            >
              <PawPrint className="w-4 h-4" /> Usar no navegador (grátis)
            </Link>
          </div>
        </div>

        <p className="text-center text-[11px] text-surface-400 mt-4">
          PetLife — o cuidado que seu pet merece · Sem anúncios · LGPD
        </p>
      </div>
    </div>
  )
}
