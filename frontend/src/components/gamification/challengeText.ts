'use client'

import { useCallback } from 'react'
import { useT } from '@/contexts/LocaleContext'
import type { Challenge } from '@/lib/api'

/**
 * Desafios vêm do banco só em português (backend/seed.py). O título exato do
 * seed vira um slug, e o texto exibido sai das chaves chx.<slug>.title/.desc
 * no idioma do aparelho. Desafio que não estiver aqui (criado depois no banco)
 * cai no texto original.
 */
export const CHALLENGE_SLUGS: Record<string, string> = {
  'Primeiro Passeio': 'firstWalk',
  '7 Dias de Caminhada': 'walk7',
  '30 Dias de Caminhada': 'walk30',
  'Vacinas em Dia': 'vaccinesUpToDate',
  'Primeira Vacina Registrada': 'firstVaccine',
  'Exame Anual Realizado': 'annualExam',
  'Histórico Completo': 'fullHistory',
  'Boas-vindas ao PetLife': 'welcome',
  'Foto Perfeita': 'perfectPhoto',
  'Anamnese Completa': 'fullAnamnesis',
  'Tutor Dedicado': 'dedicatedTutor',
  'Super Tutor': 'superTutor',
  'Rotina de Caminhada Criada': 'walkRoutine',
  'Pet Saudável': 'healthyPet',
  'Multiespécie': 'multiSpecies',
  'Raça Conhecida': 'knownBreed',
  'Lembrete Configurado': 'reminderSet',
  'Organizador Master': 'masterOrganizer',
  'Consultor IA': 'aiConsultant',
  'Pet Microchipado': 'microchipped',
  'Passeador Iniciante': 'beginnerWalker',
  'Passeador Experiente': 'expertWalker',
  'Amigo dos Pets': 'petFriend',
}

export function challengeSlug(title?: string | null): string | null {
  if (!title) return null
  return CHALLENGE_SLUGS[title.trim()] ?? null
}

/** Título e descrição traduzidos, com o texto do banco como reserva. */
export function useChallengeText() {
  const t = useT()
  const pick = useCallback((key: string, fallback: string) => {
    const v = t(key)
    return v === key ? fallback : v
  }, [t])

  const title = useCallback((c: Pick<Challenge, 'title'> | { title?: string | null }) => {
    const slug = challengeSlug(c.title)
    return slug ? pick(`chx.${slug}.title`, c.title ?? '') : (c.title ?? '')
  }, [pick])

  const titleOf = useCallback((raw?: string | null) => {
    const slug = challengeSlug(raw)
    return slug ? pick(`chx.${slug}.title`, raw ?? '') : (raw ?? '')
  }, [pick])

  const desc = useCallback((c: Pick<Challenge, 'title' | 'description'>) => {
    const slug = challengeSlug(c.title)
    return slug ? pick(`chx.${slug}.desc`, c.description ?? '') : (c.description ?? '')
  }, [pick])

  return { title, titleOf, desc }
}
