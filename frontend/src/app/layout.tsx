import type { Metadata } from 'next'
import { Inter, Nunito } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastProvider } from '@/components/ui/ToastContext'

const inter = Inter({ subsets: ['latin'] })
// Display arredondada só para títulos — o "fofo" que o nicho pet pede,
// mantendo Inter no corpo pra seriedade médica.
const nunito = Nunito({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'PetLife — O cuidado que seu pet merece',
  description:
    'Gerencie a saúde do seu pet com tecnologia e carinho. Vacinas, exames, rotinas e muito mais.',
  keywords: ['pet', 'saúde animal', 'vacinas', 'cachorro', 'gato', 'veterinário'],
  authors: [{ name: 'PetLife' }],
  manifest: '/manifest.json',
  applicationName: 'PetLife',
  appleWebApp: {
    capable: true,
    title: 'PetLife',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
  openGraph: {
    title: 'PetLife — O cuidado que seu pet merece',
    description: 'Plataforma completa para cuidar da saúde do seu pet.',
    type: 'website',
  },
}

export const viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className={`${inter.className} ${nunito.variable}`}>
        {/* Prevenir flash de tema errado: lê preferência antes do React hidratar */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('petlife_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
              // Trava definitiva do arrasto horizontal na WKWebView do iOS:
              // se a janela rolar de lado (por sub-pixel/rubber-band/webview),
              // volta pra 0. A rolagem vertical não é afetada; carrosséis rolam
              // internamente (não mexem no scrollX da janela).
              (function () {
                function noX() { if (window.scrollX !== 0) window.scrollTo(0, window.scrollY); }
                window.addEventListener('scroll', noX, { passive: true });
                window.addEventListener('touchmove', noX, { passive: true });
                window.addEventListener('orientationchange', noX);
                window.addEventListener('resize', noX);
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}
