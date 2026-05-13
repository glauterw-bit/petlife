import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastProvider } from '@/components/ui/ToastContext'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>
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
            `,
          }}
        />
      </body>
    </html>
  )
}
