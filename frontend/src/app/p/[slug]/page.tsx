import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { misc } from '@/lib/i18n/dict/modules/misc'
import { coerceLocale, type Locale } from '@/lib/i18n/types'
import { PawPrint, Syringe, Footprints, Heart, Download, CheckCircle2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'
// Sem país no caminho: a Apple abre a loja do país de quem toca.
const APP_STORE_URL = 'https://apps.apple.com/app/id6768136468'

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

type TFn = (key: string, vars?: Record<string, string | number>) => string

/** Página de servidor: o idioma vem do Accept-Language de quem abriu o link. */
function serverT(): TFn {
  let locale: Locale = 'pt-BR'
  try {
    const first = (headers().get('accept-language') || '').split(',')[0]
    locale = coerceLocale(first) ?? 'pt-BR'
  } catch { /* fora de requisição: fica pt-BR */ }
  return (key, vars) => {
    let v = misc[locale]?.[key] ?? misc['pt-BR'][key] ?? key
    if (vars) for (const [k, val] of Object.entries(vars)) v = v.split(`{${k}}`).join(String(val))
    return v
  }
}

function petAge(t: TFn, birth?: string | null): string | null {
  if (!birth) return null
  const b = new Date(birth)
  const months = Math.max(0, (Date.now() - b.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 12) {
    const n = Math.max(1, Math.round(months))
    return n === 1 ? t('wk2.pub.ageMonth') : t('wk2.pub.ageMonths', { n })
  }
  const anos = Math.floor(months / 12)
  return anos === 1 ? t('wk2.pub.ageYear') : t('wk2.pub.ageYears', { n: anos })
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const pet = await getPet(params.slug)
  // Mesmo idioma da página (Accept-Language): a prévia do link não sai em português para quem fala en/es.
  const t = serverT()
  if (!pet) return { title: t('wk2.pub.metaNotFound') }
  const emoji = pet.species === 'cat' ? '🐱' : '🐶'
  const km = pet.stats.walks_km
  return {
    title: `${pet.name} ${emoji} — PetLife`,
    description: t('wk2.pub.metaDesc', { name: pet.name, breed: pet.breed ? `, ${pet.breed}` : '' }),
    openGraph: {
      title: t('wk2.pub.ogTitle', { name: pet.name, emoji }),
      description: t(pet.stats.vaccines_ok ? 'wk2.pub.ogDescOk' : 'wk2.pub.ogDescReg', { km }),
      ...(pet.photo ? { images: [pet.photo] } : {}),
    },
  }
}

export default async function PublicPetPage({ params }: { params: { slug: string } }) {
  const pet = await getPet(params.slug)
  const t = serverT()

  if (!pet) {
    return (
      <div className="min-h-screen [color-scheme:light] bg-gradient-to-br from-primary-50 via-white to-emerald-50 text-surface-900 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center"><PawPrint className="w-8 h-8" aria-hidden /></div>
          <h1 className="text-xl font-bold text-surface-900 mb-2">{t('wk2.pub.notFoundTitle')}</h1>
          <p className="text-sm text-surface-600 mb-6">{t('wk2.pub.notFoundText')}</p>
          <Link href="/" className="inline-flex items-center gap-2 min-h-[44px] bg-primary-700 text-white px-5 rounded-xl text-sm font-semibold">
            <PawPrint className="w-4 h-4" aria-hidden /> {t('wk2.pub.discover')}
          </Link>
        </div>
      </div>
    )
  }

  const emoji = pet.species === 'cat' ? '🐱' : '🐶'
  const idade = petAge(t, pet.birth_date)

  return (
    <div className="min-h-screen [color-scheme:light] bg-gradient-to-br from-primary-50 via-white to-emerald-50 text-surface-900 py-8 px-4 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="max-w-md mx-auto">
        {/* Cabeçalho PetLife */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 bg-primary-700 rounded-lg flex items-center justify-center">
            <PawPrint className="w-5 h-5 text-white" aria-hidden />
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
                <span className="text-6xl" aria-hidden>{emoji}</span>
              )}
            </div>
            <div className="text-center mt-3">
              <h1 className="text-2xl font-bold text-surface-900">
                {pet.name} {pet.is_deceased ? '🌈' : emoji}
              </h1>
              <p className="text-sm text-surface-600">
                {[pet.breed, idade].filter(Boolean).join(' · ') || (pet.species === 'cat' ? t('wk2.pub.cat') : t('wk2.pub.dog'))}
              </p>
              {pet.bio && <p className="text-sm text-surface-600 mt-2 leading-snug">{pet.bio}</p>}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-5">
              <div className="bg-primary-50 rounded-2xl p-3 text-center">
                <Footprints className="w-4 h-4 text-primary-700 mx-auto mb-1" aria-hidden />
                <div className="text-lg font-bold text-surface-900 leading-tight">{pet.stats.walks_km}</div>
                <div className="text-xs text-surface-600 leading-tight">{t('wk2.pub.kmWalked')}</div>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                <Syringe className="w-4 h-4 text-emerald-700 mx-auto mb-1" aria-hidden />
                <div className="text-lg font-bold text-surface-900 leading-tight">
                  {pet.stats.vaccines_ok ? <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-700" aria-label={t('wk2.pub.vaccinesOk')} /> : pet.stats.vaccines_total}
                </div>
                <div className="text-xs text-surface-600 leading-tight">
                  {pet.stats.vaccines_ok ? t('wk2.pub.vaccinesOk') : t('wk2.pub.vaccines')}
                </div>
              </div>
              <div className="bg-rose-50 rounded-2xl p-3 text-center">
                <Heart className="w-4 h-4 text-rose-600 mx-auto mb-1" aria-hidden />
                <div className="text-lg font-bold text-surface-900 leading-tight">{pet.stats.walks_count}</div>
                <div className="text-xs text-surface-600 leading-tight">{t('wk2.pub.walks')}</div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-surface-600">{t('wk2.pub.vaccinesNote')}</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 bg-white rounded-3xl shadow-lg border border-surface-100 p-5 text-center">
          <p className="text-sm text-surface-700 font-medium mb-3">
            {t('wk2.pub.cta')}
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={APP_STORE_URL}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] bg-surface-900 text-white px-5 rounded-xl text-sm font-semibold"
            >
              <Download className="w-4 h-4" aria-hidden /> {t('pub.cta.appStore')}
            </a>
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 min-h-[48px] bg-primary-700 text-white px-5 rounded-xl text-sm font-semibold"
            >
              <PawPrint className="w-4 h-4" aria-hidden /> {t('pub.cta.browser')}
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-surface-600 mt-4 pb-[env(safe-area-inset-bottom)]">
          {t('wk2.pub.footer')}
        </p>
      </div>
    </div>
  )
}
