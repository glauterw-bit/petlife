'use client'

/**
 * Rascunho do pet da primeira abertura (/start): o tutor conta o nome e a
 * espécie ANTES de criar a conta; logo depois do cadastro/login o pet é
 * criado automaticamente e o app segue pro quick-start de vacinas.
 */
import { pets as petsApi } from '@/lib/api'

const KEY = 'petlife_pet_draft_v1'
const INVITE_KEY = 'petlife_pending_invite'

/** Convite de co-tutor aberto sem login: guarda até a pessoa entrar. */
export function savePendingInvite(token: string) {
  try { localStorage.setItem(INVITE_KEY, token) } catch {}
}

/** Rota do convite pendente (e limpa), ou null. */
export function takePendingInviteRoute(): string | null {
  try {
    const tk = localStorage.getItem(INVITE_KEY)
    if (!tk) return null
    localStorage.removeItem(INVITE_KEY)
    return `/convites?token=${encodeURIComponent(tk)}`
  } catch {
    return null
  }
}

export interface PetDraft {
  name: string
  species: 'dog' | 'cat'
}

export function savePetDraft(d: PetDraft) {
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {}
}

export function loadPetDraft(): PetDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PetDraft) : null
  } catch {
    return null
  }
}

/**
 * Depois de entrar: cria o pet do rascunho (se houver) e devolve a próxima rota.
 * Quem já tinha pets (login de conta antiga) não ganha duplicata.
 */
export async function consumePetDraft(): Promise<string> {
  // Veio por convite de co-tutor: o pet já existe, é só aceitar
  const invite = takePendingInviteRoute()
  if (invite) return invite
  const d = loadPetDraft()
  try {
    const existing = await petsApi.list()
    if (existing.length > 0) {
      try { localStorage.removeItem(KEY) } catch {}
      return '/dashboard'
    }
  } catch {}
  if (!d?.name) return '/pets/new'
  try {
    const pet = await petsApi.create({ name: d.name.trim(), species: d.species })
    try { localStorage.removeItem(KEY) } catch {}
    return `/health/vaccines?novo=1&pet=${pet.id}`
  } catch {
    return '/pets/new'
  }
}
