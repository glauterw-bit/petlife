'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { auth, User } from '@/lib/api'
import { getToken, setToken, removeToken, getUser, setUser, isVet, setIsVet } from '@/lib/auth'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  isVetUser: boolean
  login: (email: string, password: string) => Promise<void>
  vetLogin: (email: string, password: string) => Promise<void>
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

  const login = useCallback(async (email: string, password: string) => {
    const res = await auth.login(email, password)
    setToken(res.access_token)
    setUser(res.user)
    setIsVet(false)
    setTokenState(res.access_token)
    setUserState(res.user)
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
    <AuthContext.Provider value={{ user, token, isLoading, isVetUser, login, vetLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
