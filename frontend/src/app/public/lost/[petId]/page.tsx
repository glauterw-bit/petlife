'use client'

import { useEffect, useState } from 'react'
import { localeTag } from '@/lib/utils'
import { useParams } from 'next/navigation'
import { AlertCircle, MapPin, Phone, PawPrint, ShieldCheck, Heart } from 'lucide-react'
import { DownloadCta } from '@/components/public/DownloadCta'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

interface LostData {
  pet: {
    id: number
    name: string
    species: string
    breed: string | null
    color: string | null
    photo: string | null
    microchip: string | null
  }
  is_lost: boolean
  lost_at: string | null
  last_seen: string | null
  reward: string | null
  owner_contact: { name: string; phone: string | null } | null
}

export default function LostPetPage() {
  const params = useParams()
  const petId = Number(params.petId)
  const [data, setData] = useState<LostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/public/lost/${petId}`)
      .then(r => {
        if (r.status === 404) { setErrorMsg('Pet não cadastrado.'); return null }
        if (!r.ok) { setErrorMsg('Erro ao carregar.'); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .catch(() => setErrorMsg('Erro de conexão.'))
      .finally(() => setLoading(false))
  }, [petId])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center">
        <span className="text-surface-500 dark:text-surface-400">Carregando…</span>
      </div>
    )
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-white dark:bg-surface-800 rounded-3xl shadow-lg p-10">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-surface-900 dark:text-white mb-1">Pet não encontrado</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">{errorMsg}</p>
        </div>
      </div>
    )
  }

  // Pet está em casa (não foi marcado como perdido)
  if (!data.is_lost) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-primary-50 dark:from-emerald-950/20 dark:via-surface-900 dark:to-primary-950/20 flex flex-col items-center justify-center gap-4 p-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-surface-800 rounded-3xl shadow-xl p-10 animate-slide-up">
          <div className="w-20 h-20 mx-auto bg-emerald-100 dark:bg-emerald-900/40 rounded-3xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
            {data.pet.name} está em casa
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-6">
            Este pet não está marcado como perdido no PetLife.
          </p>
          <div className="bg-surface-50 dark:bg-surface-700/50 rounded-2xl p-4 text-left">
            <p className="text-xs uppercase text-surface-400 mb-2 font-semibold tracking-wide">Identificação verificada</p>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">{data.pet.name}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              {data.pet.species === 'dog' ? 'Cão' : 'Gato'} · {data.pet.breed ?? 'SRD'}
            </p>
          </div>
        </div>

        <div className="max-w-md w-full">
          <DownloadCta
          campanha="pet_perdido"
            headline="Seu pet também pode ter uma identidade dessas."
            sub="QR na coleira, carteira de vacinação digital e página de busca instantânea se ele sumir."
          />
        </div>
      </div>
    )
  }

  // Pet ESTÁ perdido — tela urgente
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/30 dark:via-orange-950/20 dark:to-yellow-950/10 py-6 px-4">
      <div className="max-w-md mx-auto">
        {/* Banner urgência */}
        <div className="bg-red-600 text-white rounded-3xl p-5 mb-5 shadow-xl shadow-red-500/30 animate-pulse-soft">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Heart className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-90">Pet desaparecido</p>
              <h1 className="text-xl font-bold">Ajude {data.pet.name} a voltar pra casa</h1>
            </div>
          </div>
        </div>

        {/* Card com foto e info */}
        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl overflow-hidden">
          {data.pet.photo && (
            <img
              src={`${API_URL}${data.pet.photo}`}
              alt={data.pet.name}
              className="w-full aspect-square object-cover"
            />
          )}
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-surface-900 dark:text-white">{data.pet.name}</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                {data.pet.species === 'dog' ? 'Cão' : 'Gato'} · {data.pet.breed ?? 'SRD'}
                {data.pet.color && ` · ${data.pet.color}`}
              </p>
            </div>

            {data.lost_at && (
              <div className="text-sm text-surface-700 dark:text-surface-300">
                <strong>Desaparecido desde:</strong>{' '}
                {new Date(data.lost_at).toLocaleString(localeTag())}
              </div>
            )}

            {data.last_seen && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-1">Visto pela última vez</p>
                    <p className="text-sm text-amber-900 dark:text-amber-100">{data.last_seen}</p>
                  </div>
                </div>
              </div>
            )}

            {data.reward && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 rounded-2xl p-3 text-center">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide mb-1">Recompensa</p>
                <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{data.reward}</p>
              </div>
            )}

            {data.pet.microchip && (
              <div className="text-xs text-surface-500 dark:text-surface-400">
                <strong>Microchip:</strong> <span className="font-mono">{data.pet.microchip}</span>
              </div>
            )}

            {data.owner_contact && (
              <div className="border-t border-surface-100 dark:border-surface-700 pt-4">
                <p className="text-xs uppercase tracking-wide text-surface-400 font-semibold mb-2">Encontrei o pet — quem contato?</p>
                <p className="text-sm font-semibold text-surface-900 dark:text-white mb-2">
                  {data.owner_contact.name}
                </p>
                {data.owner_contact.phone && (
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={`tel:${data.owner_contact.phone.replace(/\D/g, '')}`}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-emerald-500/30"
                    >
                      <Phone className="w-4 h-4" />
                      Ligar
                    </a>
                    <a
                      href={`https://wa.me/${data.owner_contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Encontrei seu pet ${data.pet.name} pelo PetLife. Como posso te ajudar?`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-green-500/30"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-surface-400">
          <div className="flex items-center justify-center gap-2 mb-2">
            <PawPrint className="w-4 h-4 text-primary-500" />
            <span className="font-bold text-surface-700 dark:text-surface-300">PetLife</span>
          </div>
          <p>Identificação verificada · Compartilhe esta página pra ajudar a achar {data.pet.name}</p>
        </div>

        {/* Abaixo do contato de propósito: achar o pet vem primeiro. */}
        <DownloadCta
          campanha="pet_perdido"
          className="mt-5"
          headline="Se o seu sumir, essa página existe em segundos."
          sub="Cadastre seu pet e tenha QR na coleira, carteira de vacinação e alerta de desaparecimento prontos."
        />
      </div>
    </div>
  )
}
