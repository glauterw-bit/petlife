'use client'

import { Component, ReactNode } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Captura erros de render em qualquer tela e mostra um fallback amigável
 * em vez de tela branca. Crítico num app de campo (webview Capacitor).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    // Sentry captura automaticamente se configurado; loga no console também
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error)
    }
  }

  reset = () => {
    this.setState({ hasError: false })
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-1">
            Algo não carregou direito
          </h2>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-5 max-w-xs">
            Tivemos um problema ao mostrar essa tela. Tente recarregar — seus dados estão seguros.
          </p>
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium transition tap-target"
          >
            <RefreshCw className="w-4 h-4" />
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
