'use client'

import { useCallback, useMemo } from 'react'
import { pets as petsApi, vaccines as vaccinesApi, protections as protectionsApi, type Pet, type Vaccine, type ProtectionPetSummary } from '@/lib/api'
import { useCached } from '@/lib/cache'
import { buildCareSummaries, type PetCareSummary } from '@/lib/care'

/**
 * Pets + situação de cuidados de cada um, a partir do cache compartilhado
 * ('pets', 'vaccines', 'protections'). Ao voltar para a tela, os dados
 * aparecem na hora e revalidam em segundo plano.
 */
export function useCareData() {
  const pets = useCached<Pet[]>('pets', () => petsApi.list())
  const vaccines = useCached<Vaccine[]>('vaccines', () => vaccinesApi.list())
  const protections = useCached<ProtectionPetSummary[]>('protections', () => protectionsApi.summary().then(r => r.pets))

  const summaries = useMemo<PetCareSummary[] | null>(() => {
    if (!pets.data) return null
    // vacinas/proteções ainda carregando: devolve null para não mostrar "sem registro" falso
    if (vaccines.data === undefined && !vaccines.error) return null
    if (protections.data === undefined && !protections.error) return null
    return buildCareSummaries(pets.data, vaccines.data ?? [], protections.data ?? [])
  }, [pets.data, vaccines.data, vaccines.error, protections.data, protections.error])

  const byPetId = useMemo(() => {
    const m = new Map<number, PetCareSummary>()
    summaries?.forEach(s => m.set(s.pet.id, s))
    return m
  }, [summaries])

  const { refresh: rp } = pets
  const { refresh: rv } = vaccines
  const { refresh: rpr } = protections
  const refreshAll = useCallback(async () => {
    await Promise.allSettled([rp(), rv(), rpr()])
  }, [rp, rv, rpr])

  return {
    pets: pets.data,
    protections: protections.data,
    petsLoading: pets.loading,
    petsError: pets.error,
    summaries,
    byPetId,
    refreshAll,
    refreshProtections: rpr,
    refreshVaccines: rv,
  }
}
