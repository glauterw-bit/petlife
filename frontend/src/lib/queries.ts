'use client'

/**
 * Consultas compartilhadas sobre o cache (lib/cache.ts).
 *
 * Uma chave = um formato. Quem grava a mesma chave em formatos diferentes
 * quebra a tela seguinte (ex.: Início → Pets). Por isso as chaves usadas por
 * mais de uma tela passam a ser lidas só por estes hooks.
 */
import { useCached } from './cache'
import { protections as protectionsApi } from './api'

export type ProtectionSummaryResponse = Awaited<ReturnType<typeof protectionsApi.summary>>

/** 'protections' guarda SEMPRE a resposta inteira ({ pets: [...] }). Leia `.data?.pets`. */
export function useProtectionsQuery() {
  return useCached<ProtectionSummaryResponse>('protections', () => protectionsApi.summary())
}
