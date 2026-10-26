'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Syringe, Stethoscope, Footprints, MapPin, Sparkles, Dog, Cat, PawPrint, AlertCircle, type LucideIcon } from 'lucide-react'
import { DownloadCta } from '@/components/public/DownloadCta'
import { usePublicColorScheme } from '@/components/public/usePublicColorScheme'
import { Skeleton } from '@/components/ui/Skeleton'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import { useT } from '@/contexts/LocaleContext'
import { localeTag } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

interface Wrapped {
  pet_name: string
  species: string
  breed_name: string
  year: number
  title: string
  highlights: { emoji: string; stat: number; label: string }[]
}

/** A API manda os destaques sempre nesta ordem: vacinas, exames, passeios, km. */
const HIGHLIGHTS: { icon: LucideIcon; key: string }[] = [
  { icon: Syringe, key: 'pub.wr.vaccines' },
  { icon: Stethoscope, key: 'pub.wr.exams' },
  { icon: Footprints, key: 'pub.wr.walks' },
  { icon: MapPin, key: 'pub.wr.km' },
]

/**
 * Retrospectiva pública — o destino do link que o tutor compartilha.
 *
 * Antes o botão de compartilhar mandava para /wrapped/{id}, que exige login:
 * quem recebia batia num muro (HTTP 401). O conteúdo de maior carga emocional
 * do app tinha o loop cortado exatamente no destino.
 */
export default function PublicWrappedPage() {
  usePublicColorScheme()
  const t = useT()
  const params = useParams()
  const petId = String(params.petId)
  const [data, setData] = useState<Wrapped | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/public/wrapped/${encodeURIComponent(petId)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setErro(true))
  }, [petId])

  if (erro) {
    return (
      <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-4">
        <div className="max-w-sm text-center bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/70 dark:border-surface-800 p-8">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-amber-700 dark:text-amber-300" aria-hidden />
          <p className="text-surface-700 dark:text-surface-200">{t('pub.wr.notFound')}</p>
        </div>
      </main>
    )
  }
  if (!data) {
    return (
      <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 py-10 px-4" aria-busy="true">
        <span className="sr-only">{t('pub.loading')}</span>
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      </main>
    )
  }

  const SpeciesIcon = data.species === 'dog' ? Dog : data.species === 'cat' ? Cat : PawPrint

  return (
    <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 py-8 px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto flex flex-col gap-5">
        <section className="rounded-3xl overflow-hidden bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 shadow-card">
          <div className="relative px-6 py-8 text-center text-white bg-gradient-to-br from-primary-700 via-primary-700 to-emerald-800 overflow-hidden">
            <SpeciesIcon className="absolute -right-6 -bottom-8 w-36 h-36 text-white/10" aria-hidden strokeWidth={1.4} />
            <p className="relative inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-white/90">
              <Sparkles className="w-3.5 h-3.5" aria-hidden />
              {t('pub.wr.eyebrow', { year: data.year })}
            </p>
            <h1 className="relative font-display text-3xl font-extrabold mt-2 leading-tight">
              {t('pub.wr.title', { pet: data.pet_name, year: data.year })}
            </h1>
            <p className="relative text-sm text-white/90 mt-1 inline-flex items-center gap-1.5">
              <SpeciesIcon className="w-4 h-4" aria-hidden /> {data.breed_name}
            </p>
          </div>

          <Stagger as="ul" className="grid grid-cols-2 gap-px bg-surface-100 dark:bg-surface-800" gap={0.06}>
            {data.highlights.map((h, i) => {
              const meta = HIGHLIGHTS[i]
              const Icon = meta?.icon ?? Sparkles
              return (
                <StaggerItem as="li" key={i} className="bg-white dark:bg-surface-900 px-5 py-6 text-center">
                  <Icon className="w-6 h-6 mx-auto text-primary-700 dark:text-primary-300" aria-hidden />
                  <div className="text-3xl font-bold text-surface-900 dark:text-white mt-2 tabular-nums">
                    {h.stat.toLocaleString(localeTag())}
                  </div>
                  <div className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">{meta ? t(meta.key) : h.label}</div>
                </StaggerItem>
              )
            })}
          </Stagger>
        </section>

        <DownloadCta campanha="wrapped" headline={t('pub.wr.ctaHeadline')} sub={t('pub.wr.ctaSub')} />
      </div>
    </main>
  )
}
