'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { auth, User } from '@/lib/api'
import { getToken, setToken, removeToken, getUser, setUser, isVet, setIsVet } from '@/lib/auth'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  isVetUser: boolean
  login: (email: string, password: string, remember?: boolean) => Promise<void>
  loginWithSession: (token: string, user: User) => void
  vetLogin: (email: string, password: string) => Promise<void>
  /** Recebe o retorno de vet.registerClinic e já deixa a sessão ativa. */
  adoptVetSession: (accessToken: string, clinic: { id?: number; clinic_name?: string; email?: string }, fallbackEmail: string) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVetUser, setIsVetUser] = useState(false)

  useEffect(() => {
    const t = getToken()
    const u = getUser()
    const v = isVet()
    if (t && u) {
      setTokenState(t)
      setUserState(u)
      setIsVetUser(v)
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string, remember = true) => {
    const res = await auth.login(email, password, remember)
    setToken(res.access_token)
    setUser(res.user)
    setIsVet(false)
    setTokenState(res.access_token)
    setUserState(res.user)
    setIsVetUser(false)
  }, [])

  const loginWithSession = useCallback((tokenStr: string, u: User) => {
    setToken(tokenStr)
    setUser(u)
    setIsVet(false)
    setTokenState(tokenStr)
    setUserState(u)
    setIsVetUser(false)
  }, [])

  const vetLogin = useCallback(async (email: string, password: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'
    const r = await fetch(`${API_URL}/vet/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!r.ok) {
      const data = await r.json().catch(() => ({}))
      throw new Error(data.detail || 'Erro ao entrar')
    }
    const res = await r.json()
    setToken(res.access_token)
    setIsVet(true)
    const vetUser: User = {
      id: res.clinic?.id ?? 0,
      name: res.clinic?.clinic_name ?? 'Clínica',
      email: res.clinic?.email ?? email,
      is_vet: true,
    }
    setUser(vetUser)
    setTokenState(res.access_token)
    setUserState(vetUser)
    setIsVetUser(true)
  }, [])

  /**
   * Ativa a sessão de clínica depois do cadastro.
   *
   * A tela /vet/register escrevia só no localStorage e navegava — o estado do
   * React continuava "deslogado", então o guard do /vet/dashboard mandava a
   * clínica recém-criada pra /auth/login. Aqui gravamos nos dois lugares,
   * igual ao vetLogin.
   */
  const adoptVetSession = useCallback((
    accessToken: string,
    clinic: { id?: number; clinic_name?: string; email?: string },
    fallbackEmail: string,
  ) => {
    setToken(accessToken)
    setIsVet(true)
    const vetUser: User = {
      id: clinic?.id ?? 0,
      name: clinic?.clinic_name ?? 'Clínica',
      email: clinic?.email ?? fallbackEmail,
      is_vet: true,
    }
    setUser(vetUser)
    setTokenState(accessToken)
    setUserState(vetUser)
    setIsVetUser(true)
  }, [])

  const logout = useCallback(() => {
    removeToken()
    setTokenState(null)
    setUserState(null)
    setIsVetUser(false)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const u = await auth.getMe()
      setUser(u)
      setUserState(u)
    } catch {}
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isVetUser, login, loginWithSession, vetLogin, adoptVetSession, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
