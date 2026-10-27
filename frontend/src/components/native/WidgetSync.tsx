'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useCareData } from '@/app/pets/useCareData'
import { useLocale } from '@/contexts/LocaleContext'
import { clearWidget, syncWidget } from '@/lib/nativeBridge'

/**
 * Mantém o widget de proteção do iOS igual ao Início: a cada mudança nos
 * dados (vacina registrada, antipulgas, troca de idioma) manda o resumo para
 * o nativo. Sem sessão, limpa o widget (sair da conta não deixa dados lá).
 */
export function WidgetSync() {
  const pathname = usePathname()
  const [native, setNative] = useState(false)
  const [logged, setLogged] = useState(false)

  useEffect(() => {
    const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }
    setNative(!!w.Capacitor?.isNativePlatform?.() && w.Capacitor.getPlatform?.() === 'ios')
  }, [])

  useEffect(() => {
    if (!native) return
    let has = false
    try { has = !!localStorage.getItem('petlife_token') } catch {}
    setLogged(has)
    if (!has) clearWidget()
  }, [native, pathname])

  return native && logged ? <Sync /> : null
}

function Sync() {
  const { summaries } = useCareData()
  const { locale } = useLocale()
  useEffect(() => {
    if (summaries) syncWidget(summaries, locale)
  }, [summaries, locale])
  return null
}
