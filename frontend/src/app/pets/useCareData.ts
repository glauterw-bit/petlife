'use client'

import { useCallback, useMemo } from 'react'
import { pets as petsApi, vaccines as vaccinesApi, type Pet, type Vaccine, type ProtectionPetSummary } from '@/lib/api'
import { useCached } from '@/lib/cache'
import { useProtectionsQuery } from '@/lib/queries'
import { buildCareSummaries, type PetCareSummary } from '@/lib/care'

/**
 * Pets + situação de cuidados de cada um, a partir do cache compartilhado
 * ('pets', 'vaccines', 'protections'). Ao voltar para a tela, os dados
 * aparecem na hora e revalidam em segundo plano.
 *
 * 'protections' guarda a resposta inteira de protections.summary() ({ pets })
 * — o mesmo formato do Início. Aqui só lemos `.pets`; nunca gravamos a lista.
 */
export function useCareData() {
  const pets = useCached<Pet[]>('pets', () => petsApi.list())
  const vaccines = useCached<Vaccine[]>('vaccines', () => vaccinesApi.list())
  const protectionsQ = useProtectionsQuery()
  const protectionList = useMemo<ProtectionPetSummary[] | undefined>(
    () => (protectionsQ.data ? protectionsQ.data.pets ?? [] : undefined),
    [protectionsQ.data],
  )

  const summaries = useMemo<PetCareSummary[] | null>(() => {
    if (!pets.data) return null
    // vacinas/proteções ainda carregando: devolve null para não mostrar "sem registro" falso
    if (vaccines.data === undefined && !vaccines.error) return null
    if (protectionList === undefined && !protectionsQ.error) return null
    return buildCareSummaries(pets.data, vaccines.data ?? [], protectionList ?? [])
  }, [pets.data, vaccines.data, vaccines.error, protectionList, protectionsQ.error])

  const byPetId = useMemo(() => {
    const m = new Map<number, PetCareSummary>()
    summaries?.forEach(s => m.set(s.pet.id, s))
    return m
  }, [summaries])

  const { refresh: rp } = pets
  const { refresh: rv } = vaccines
  const { refresh: rpr } = protectionsQ
  const refreshAll = useCallback(async () => {
    await Promise.allSettled([rp(), rv(), rpr()])
  }, [rp, rv, rpr])

  return {
    pets: pets.data,
    protections: protectionList,
    petsLoading: pets.loading,
    petsError: pets.error,
    summaries,
    byPetId,
    refreshAll,
    refreshProtections: rpr,
    refreshVaccines: rv,
  }
}
