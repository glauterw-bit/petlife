import type { User } from './api'

const TOKEN_KEY = 'petlife_token'
const USER_KEY = 'petlife_user'
const VET_KEY = 'petlife_is_vet'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(VET_KEY)
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function setUser(user: User): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function isVet(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(VET_KEY) === 'true'
}

export function setIsVet(val: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(VET_KEY, val ? 'true' : 'false')
}
