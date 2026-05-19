'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Heart, Share2, PawPrint } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

interface MemorialData {
  pet: {
    name: string
    species: string
    breed: string | null
    photo: string | null
    birth_date: string | null
    deceased_at: string | null
    age_years: number | null
  }
  memorial_text: string
  owner_name: string | null
}

export default function MemorialPage() {
  const params = useParams()
  const petId = Number(params.petId)
  const [data, setData] = useState<MemorialData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/innovations/public/memorial/${petId}`)
      .then(r => {
        if (!r.ok) { setError(true); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .catch(() => setError(true))
  }, [petId])

  function share() {
    if (!data) return
    const text = encodeURIComponent(`Em memória de ${data.pet.name} 🕊️\n${typeof window !== 'undefined' ? window.location.href : ''}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
        <div className="bg-stone-800 rounded-2xl p-8 text-center max-w-md text-stone-300">
          <p>Memorial não encontrado.</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-950 flex items-center justify-center text-stone-400">
        Carregando…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-stone-100 py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Heart className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <p className="text-xs uppercase tracking-widest text-stone-400 font-semibold">Em memória</p>
        </div>

        {/* Photo */}
        {data.pet.photo && (
          <div className="mb-8">
            <img
              src={`${API_URL}${data.pet.photo}`}
              alt={data.pet.name}
              className="w-full rounded-3xl object-cover aspect-square shadow-2xl"
            />
          </div>
        )}

        {/* Name + dates */}
        <h1 className="text-4xl font-bold text-center mb-2">{data.pet.name}</h1>
        <p className="text-center text-stone-400 text-sm mb-2">
          {data.pet.species === 'dog' ? 'Cão' : 'Gato'}
          {data.pet.breed && <> · {data.pet.breed}</>}
        </p>
        {(data.pet.birth_date || data.pet.deceased_at) && (
          <p className="text-center text-stone-400 text-sm mb-8">
            {data.pet.birth_date && new Date(data.pet.birth_date).toLocaleDateString('pt-BR')}
            {data.pet.birth_date && data.pet.deceased_at && ' — '}
            {data.pet.deceased_at && new Date(data.pet.deceased_at).toLocaleDateString('pt-BR')}
            {data.pet.age_years && <> · {data.pet.age_years} anos</>}
          </p>
        )}

        {/* Memorial text */}
        <div className="bg-stone-800/50 backdrop-blur rounded-2xl p-6 mb-6 border border-stone-700/50">
          <p className="text-stone-200 leading-relaxed whitespace-pre-wrap text-center italic">
            {data.memorial_text}
          </p>
        </div>

        {data.owner_name && (
          <p className="text-center text-stone-400 text-sm mb-8">
            Tutor(a): {data.owner_name}
          </p>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={share}
            className="flex items-center gap-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-5 py-2.5 rounded-xl font-semibold transition border border-rose-500/30"
          >
            <Share2 className="w-4 h-4" />
            Compartilhar
          </button>
        </div>

        <div className="text-center mt-12 text-stone-500 text-xs">
          <PawPrint className="w-4 h-4 inline mr-1" />
          PetLife — em memória eterna
        </div>
      </div>
    </div>
  )
}
