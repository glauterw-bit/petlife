'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DownloadCta } from '@/components/public/DownloadCta'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

interface Wrapped {
  pet_name: string
  species: string
  breed_name: string
  year: number
  title: string
  highlights: { emoji: string; stat: number; label: string }[]
}

/**
 * Retrospectiva pública — o destino do link que o tutor compartilha.
 *
 * Antes o botão de compartilhar mandava para /wrapped/{id}, que exige login:
 * quem recebia batia num muro (HTTP 401). O conteúdo de maior carga emocional
 * do app tinha o loop cortado exatamente no destino.
 */
export default function PublicWrappedPage() {
  const params = useParams()
  const petId = Number(params.petId)
  const [data, setData] = useState<Wrapped | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/public/wrapped/${petId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setErro('Retrospectiva não encontrada.'))
  }, [petId])

  if (erro) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4">
        <p className="text-surface-500 dark:text-surface-400">{erro}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center">
        <p className="text-surface-500 dark:text-surface-400 text-sm">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-500 to-emerald-500 py-10 px-4">
      <div className="max-w-md mx-auto flex flex-col gap-5">
        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-7 py-8 text-center border-b border-surface-100 dark:border-surface-700">
            <p className="text-xs font-bold uppercase tracking-widest text-primary-600">
              PetLife Wrapped {data.year}
            </p>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white mt-2">{data.title}</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              {data.species === 'dog' ? '🐶' : '🐱'} {data.breed_name}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px bg-surface-100 dark:bg-surface-700">
            {data.highlights.map((h, i) => (
              <div key={i} className="bg-white dark:bg-surface-800 px-5 py-6 text-center">
                <div className="text-3xl">{h.emoji}</div>
                <div className="text-3xl font-bold text-surface-900 dark:text-white mt-1 tabular-nums">
                  {h.stat}
                </div>
                <div className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{h.label}</div>
              </div>
            ))}
          </div>
        </div>

        <DownloadCta
          campanha="wrapped"
          headline={`Faça a retrospectiva do seu pet também.`}
          sub="Carteira de vacinação digital, lembretes de reforço e o resumo do ano do seu bicho."
        />
      </div>
    </div>
  )
}
