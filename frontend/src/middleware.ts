import { NextResponse } from 'next/server'

/**
 * Força o HTML a ser sempre revalidado (nunca servir versão velha em cache).
 * O Next define s-maxage=1 ano em páginas estáticas, o que fazia CDN/WebView
 * servirem HTML antigo apontando pra CSS/JS antigos (o app "não atualizava" em
 * alguns aparelhos). Assets com hash (/_next/static) continuam imutáveis.
 */
export function middleware() {
  const res = NextResponse.next()
  res.headers.set('Cache-Control', 'no-cache, must-revalidate, max-age=0')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icons|manifest.json|favicon.ico|sw.js).*)'],
}
