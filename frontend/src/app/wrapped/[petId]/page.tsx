'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Share2, Sparkles, Download } from 'lucide-react'
import { innovations, type PetLifeWrapped } from '@/lib/api'

export default function WrappedPage() {
  const params = useParams()
  const router = useRouter()
  const petId = Number(params.petId)
  const [data, setData] = useState<PetLifeWrapped | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const year = new Date().getFullYear()

  useEffect(() => {
    innovations.petlifeWrapped(petId, year)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao gerar Wrapped.'))
  }, [petId, year])

  function shareWhatsApp() {
    if (!data) return
    const text = encodeURIComponent(`${data.share_text}\n\n${window.location.origin}/wrapped/${petId}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-amber-400 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md text-center">
          <p className="text-surface-700">{error}</p>
          <button onClick={() => router.back()} className="mt-4 text-primary-600 font-semibold">Voltar</button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-amber-400 flex items-center justify-center">
        <div className="text-white text-center">
          <Sparkles className="w-12 h-12 mx-auto animate-pulse mb-4" />
          <p className="text-lg">Preparando o Wrapped de {petId}…</p>
        </div>
      </div>
    )
  }

  const slides = [
    {
      bg: 'from-purple-600 via-pink-500 to-amber-400',
      content: (
        <>
          <p className="text-sm uppercase tracking-widest opacity-80 font-bold mb-2">PetLife Wrapped {data.year}</p>
          <h1 className="text-5xl sm:text-6xl font-black mb-4">{data.title}</h1>
          <p className="text-xl opacity-95">{data.subtitle}</p>
        </>
      ),
    },
    ...data.highlights.map(h => ({
      bg: 'from-indigo-600 via-purple-600 to-pink-500',
      content: (
        <>
          <div className="text-8xl mb-4">{h.emoji}</div>
          <div className="text-7xl font-black mb-2">{h.stat}</div>
          <p className="text-xl font-semibold opacity-95 mb-2">{h.label}</p>
          <p className="text-sm opacity-80 max-w-xs">{h.narrative}</p>
        </>
      ),
    })),
    ...(data.personality_tag ? [{
      bg: 'from-rose-500 via-orange-400 to-amber-300',
      content: (
        <>
          <p className="text-sm uppercase tracking-widest opacity-80 font-bold mb-2">A personalidade de {data.pet_name}</p>
          <h2 className="text-5xl font-black mb-4">{data.personality_tag}</h2>
        </>
      ),
    }] : []),
    {
      bg: 'from-emerald-500 via-teal-500 to-cyan-500',
      content: (
        <>
          <p className="text-sm uppercase tracking-widest opacity-80 font-bold mb-2">{data.pet_name}, esse ano foi seu</p>
          <p className="text-xl leading-relaxed mb-6 max-w-md">{data.narrative}</p>
          {data.next_year_wish && <p className="text-base italic opacity-90">{data.next_year_wish}</p>}
        </>
      ),
    },
  ]

  const slide = slides[step]
  const isLast = step === slides.length - 1

  return (
    <div className={`min-h-screen bg-gradient-to-br ${slide.bg} text-white relative overflow-hidden flex flex-col`}>
      {/* Progress bars */}
      <div className="flex gap-1 p-3 z-10">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div className={`h-full bg-white transition-all duration-500 ${i < step ? 'w-full' : i === step ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>

      {/* Close */}
      <button
        onClick={() => router.back()}
        className="absolute top-3 right-4 z-20 text-white/80 hover:text-white"
        aria-label="Fechar"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 cursor-pointer" onClick={() => !isLast && setStep(s => s + 1)}>
        <div className="animate-slide-up">
          {slide.content}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-6 space-y-3 z-10">
        {isLast ? (
          <>
            <button
              onClick={shareWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-white text-purple-700 font-bold py-4 rounded-2xl shadow-xl"
            >
              <Share2 className="w-5 h-5" />
              Compartilhar com amigos
            </button>
            <button
              onClick={() => setStep(0)}
              className="w-full text-white/80 hover:text-white text-sm"
            >
              Ver de novo
            </button>
          </>
        ) : (
          <button
            onClick={() => setStep(s => s + 1)}
            className="w-full bg-white/20 hover:bg-white/30 backdrop-blur text-white font-semibold py-3 rounded-2xl border border-white/40"
          >
            Próximo →
          </button>
        )}
      </div>
    </div>
  )
}
