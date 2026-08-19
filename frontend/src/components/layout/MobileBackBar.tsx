'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { hapticLight } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'

// Páginas abertas pelo menu "Mais" (e sub-rotas) que não são abas da barra
// inferior — precisam de um "voltar" explícito no mobile (o app nativo/PWA
// não tem gesto de voltar do navegador).
const BACK_PREFIXES = [
  '/challenges', '/routines', '/nearby', '/behavior', '/convites',
  '/plans', '/settings', '/admin', '/health/exams', '/wrapped', '/memorial',
]

/**
 * Barra de voltar — só no mobile, só nas telas que precisam.
 * Volta no histórico; se não houver (deep-link), vai pro início.
 */
export function MobileBackBar() {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const t = useT()

  const show = BACK_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!show) return null

  function back() {
    void hapticLight()
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="md:hidden mb-3">
      <button
        onClick={back}
        aria-label={t('nav.back')}
        className="pressable inline-flex items-center gap-1.5 text-sm font-medium text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white -ml-1 pr-3 py-1.5 rounded-lg tap-target"
      >
        <ArrowLeft className="w-5 h-5" />
        {t('nav.back')}
      </button>
    </div>
  )
}
