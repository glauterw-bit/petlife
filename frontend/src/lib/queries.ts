'use client'

/**
 * Consultas compartilhadas sobre o cache (lib/cache.ts).
 *
 * Uma chave = um formato. Quem grava a mesma chave em formatos diferentes
 * quebra a tela seguinte (ex.: Início → Pets). Por isso as chaves usadas por
 * mais de uma tela passam a ser lidas só por estes hooks.
 */
import { useCached } from './cache'
import { protections as protectionsApi, growth } from './api'

export type ProtectionSummaryResponse = Awaited<ReturnType<typeof protectionsApi.summary>>

/** 'protections' guarda SEMPRE a resposta inteira ({ pets: [...] }). Leia `.data?.pets`. */
export function useProtectionsQuery() {
  return useCached<ProtectionSummaryResponse>('protections', () => protectionsApi.summary())
}

/**
 * Código de indicação do tutor ('referral'). Muda raramente: vale por 1 hora.
 * Vai no link público da carteirinha (`ref=`) para o cadastro de quem recebe
 * creditar quem enviou.
 */
export function useReferralCode(): string | null {
  const q = useCached('referral', () => growth.myReferral(), { ttlMs: 3_600_000 })
  return q.data?.code ?? null
}
