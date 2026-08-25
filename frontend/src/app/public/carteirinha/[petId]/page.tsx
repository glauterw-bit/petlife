'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Printer, CheckCircle, AlertCircle, Clock, ShieldCheck } from 'lucide-react'
import { formatDate, formatAge, getSpeciesLabel, getSpeciesEmoji } from '@/lib/utils'
import { DownloadCta } from '@/components/public/DownloadCta'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

interface CardData {
  pet: {
    id: number
    name: string
    species: string
    breed: string | null
    birth_date: string | null
    weight: number | null
    color: string | null
    gender: string | null
    neutered: boolean
    microchip: string | null
    photo: string | null
  }
  owner: { name: string }
  vaccines: {
    id: number
    name: string
    date_given: string
    next_due: string | null
    lot_number: string | null
    veterinarian: string | null
    notes: string | null
  }[]
  generated_at: string
}

function vaccineStatus(next_due: string | null): 'up_to_date' | 'upcoming' | 'overdue' {
  if (!next_due) return 'up_to_date'
  const diff = (new Date(next_due).getTime() - Date.now()) / 86400000
  if (diff < 0) return 'overdue'
  if (diff <= 30) return 'upcoming'
  return 'up_to_date'
}

const statusConfig = {
  up_to_date: { label: 'Em dia', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: CheckCircle, iconColor: 'text-emerald-500' },
  upcoming: { label: 'Próxima', color: 'bg-amber-100 text-amber-700 border-amber-200', Icon: Clock, iconColor: 'text-amber-500' },
  overdue: { label: 'Atrasada', color: 'bg-red-100 text-red-700 border-red-200', Icon: AlertCircle, iconColor: 'text-red-500' },
}

export default function PublicCarteirinhaPage() {
  const params = useParams()
  const petId = Number(params.petId)
  const [data, setData] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/public/carteirinha/${petId}`)
        if (res.status === 404) { setErrorMsg('Carteirinha não encontrada.'); return }
        if (!res.ok) { setErrorMsg('Erro ao verificar carteirinha.'); return }
        setData(await res.json())
      } catch {
        setErrorMsg('Erro de conexão. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [petId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-surface-500 dark:text-surface-400 text-sm">Verificando carteirinha…</div>
      </div>
    )
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-surface-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white dark:bg-surface-800 rounded-3xl shadow-lg border border-red-100 p-10">
          <div className="w-16 h-16 mx-auto bg-red-50 rounded-2xl flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-white mb-2">Verificação falhou</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">{errorMsg ?? 'Não foi possível carregar a carteirinha.'}</p>
        </div>
      </div>
    )
  }

  const pet = data.pet
  const totalVaccines = data.vaccines.length
  const upToDate = data.vaccines.filter(v => vaccineStatus(v.next_due) === 'up_to_date').length
  const overdue = data.vaccines.filter(v => vaccineStatus(v.next_due) === 'overdue').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 py-8 px-4 print:bg-white print:py-0">
      {/* Verification banner */}
      <div className="max-w-2xl mx-auto mb-4 print:hidden">
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">Carteirinha verificada</p>
            <p className="text-xs text-emerald-700">Documento digital autêntico emitido pelo PetLife.</p>
          </div>
          <button
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-white dark:bg-surface-800 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-50 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>

      {/* CARD */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 overflow-hidden print:shadow-none print:border-0">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-emerald-500 px-8 py-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 right-8 text-[120px] leading-none select-none">
                {getSpeciesEmoji(pet.species)}
              </div>
            </div>
            <div className="relative flex items-start gap-5">
              <div className="shrink-0">
                {pet.photo ? (
                  <img
                    src={`${API_URL}${pet.photo}`}
                    alt={pet.name}
                    className="w-20 h-20 rounded-2xl object-cover border-4 border-white/30 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-5xl border-4 border-white/30">
                    {getSpeciesEmoji(pet.species)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/80">Carteirinha de Vacinação</span>
                </div>
                <h1 className="text-3xl font-bold text-white truncate">{pet.name}</h1>
                <p className="text-white/80 text-sm mt-0.5">
                  {getSpeciesLabel(pet.species)} • {pet.breed ?? 'SRD'}
                </p>
                <p className="text-white/70 text-xs mt-1">Tutor: {data.owner.name}</p>
              </div>
            </div>

            <div className="relative flex gap-3 mt-5 flex-wrap">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs font-semibold text-white">
                {totalVaccines} vacinas registradas
              </div>
              <div className="bg-emerald-400/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs font-semibold text-white">
                {upToDate} em dia
              </div>
              {overdue > 0 && (
                <div className="bg-red-400/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs font-semibold text-white">
                  {overdue} atrasada{overdue > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Pet details */}
          <div className="px-8 py-5 border-b border-surface-100 dark:border-surface-700 bg-surface-50/50">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              {[
                { label: 'Espécie', value: getSpeciesLabel(pet.species) },
                { label: 'Idade', value: formatAge(pet.birth_date) },
                { label: 'Nascimento', value: formatDate(pet.birth_date) },
                { label: 'Peso', value: pet.weight ? `${pet.weight} kg` : '—' },
                { label: 'Sexo', value: pet.gender === 'male' ? 'Macho' : pet.gender === 'female' ? 'Fêmea' : '—' },
                { label: 'Castrado', value: pet.neutered ? 'Sim' : 'Não' },
                { label: 'Cor / Pelagem', value: pet.color ?? '—' },
                { label: 'Microchip', value: pet.microchip ?? '—' },
                { label: 'Tutor', value: data.owner.name },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-surface-400 font-medium uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-surface-800 dark:text-surface-100 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Vaccines */}
          <div className="px-8 py-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-4">Histórico de Vacinação</h2>

            {data.vaccines.length === 0 ? (
              <div className="text-center py-8 text-surface-400 text-sm">Nenhuma vacina registrada.</div>
            ) : (
              <div className="space-y-3">
                {data.vaccines.map((v, i) => {
                  const st = vaccineStatus(v.next_due)
                  const cfg = statusConfig[st]
                  const { Icon } = cfg
                  return (
                    <div key={v.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-surface-100 dark:border-surface-700 bg-white dark:bg-surface-800">
                      <div className="mt-0.5"><Icon className={`w-4 h-4 ${cfg.iconColor}`} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-surface-900 dark:text-white">{v.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-0.5 mt-1.5">
                          <span className="text-xs text-surface-500 dark:text-surface-400">
                            <span className="font-medium text-surface-700 dark:text-surface-200">Aplicada:</span> {formatDate(v.date_given)}
                          </span>
                          {v.next_due && (
                            <span className="text-xs text-surface-500 dark:text-surface-400">
                              <span className="font-medium text-surface-700 dark:text-surface-200">Próxima:</span> {formatDate(v.next_due)}
                            </span>
                          )}
                          {v.veterinarian && (
                            <span className="text-xs text-surface-500 dark:text-surface-400">
                              <span className="font-medium text-surface-700 dark:text-surface-200">Vet:</span> {v.veterinarian}
                            </span>
                          )}
                          {v.lot_number && (
                            <span className="text-xs text-surface-500 dark:text-surface-400">
                              <span className="font-medium text-surface-700 dark:text-surface-200">Lote:</span> {v.lot_number}
                            </span>
                          )}
                        </div>
                        {v.notes && <p className="text-xs text-surface-400 italic mt-1">{v.notes}</p>}
                      </div>
                      <span className="text-xs text-surface-400 font-medium shrink-0">#{String(i + 1).padStart(2, '0')}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t border-surface-100 dark:border-surface-700 bg-surface-50/50 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Documento verificado</span>
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 max-w-[260px]">
                Esta carteirinha foi gerada pelo sistema PetLife e é validada digitalmente.
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-surface-400 mb-1">Emitida em</div>
              <div className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                {formatDate(data.generated_at.split('T')[0])}
              </div>
              <div className="mt-4 flex items-center gap-1.5 justify-end">
                <div className="w-6 h-6 bg-primary-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">P</span>
                </div>
                <span className="text-sm font-bold text-surface-700 dark:text-surface-200">PetLife</span>
              </div>
              <p className="text-xs text-surface-400 mt-0.5">Gestão de saúde pet com IA</p>
            </div>
          </div>
        </div>

        <DownloadCta
          className="mt-6"
          headline={`Recebeu a carteirinha do ${pet.name}? Faça a do seu pet.`}
          sub="Carteira de vacinação digital, lembretes de reforço e envio em PDF pro hotel, creche ou veterinário."
        />

        <p className="text-center text-xs text-surface-400 mt-6 print:hidden">
          ID: {pet.id} • Verificado via QR code
        </p>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
    </div>
  )
}
