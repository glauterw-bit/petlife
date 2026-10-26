import type { Metadata } from 'next'
import { Inter, Nunito } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { LocaleProvider } from '@/contexts/LocaleContext'
import { ToastProvider } from '@/components/ui/ToastContext'
import { DeepLinks } from '@/components/native/DeepLinks'
import { InstallPing } from '@/components/native/InstallPing'
import { Telemetry } from '@/components/native/Telemetry'
import { TutorShell } from '@/components/layout/TutorShell'
import { ConfirmProvider } from '@/components/ui/Confirm'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
// Display arredondada só para títulos — o "fofo" que o nicho pet pede,
// mantendo Inter no corpo pra seriedade médica.
// Sem `weight`: carrega a fonte VARIÁVEL (um arquivo só cobre 200–1000), o que
// libera o 900 dos números em destaque (.num-hero) sem baixar outro peso.
const nunito = Nunito({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  metadataBase: new URL('https://petlife-frontend-production.up.railway.app'),
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
    title: 'PetLife — Carteirinha de vacinação do pet no celular',
    description: 'Vacinas, lembretes antes de cada dose e carteirinha para mandar ao hotel, creche ou veterinário. Grátis.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 514 }],
  },
  // Banner "Abrir na App Store" do Safari no iPhone (não aparece dentro do app)
  other: { 'apple-itunes-app': 'app-id=6768136468' },
}

export const viewport = {
  // Cor da barra do navegador acompanhando o fundo do app (claro/escuro)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0a09' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Trava a escala em 1:1 — impede a WKWebView do iOS de renderizar o app
  // "maior que a tela" (exigindo arrasto lateral). Sem isso, o webview podia
  // escalar/assumir uma largura maior que a do aparelho.
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="scroll-smooth" suppressHydrationWarning>
      <body className={`${inter.className} ${inter.variable} ${nunito.variable}`}>
        {/* Prevenir flash de tema errado: lê preferência antes do React hidratar */}
        <script
          dangerouslySetInnerHTML={{
            // Igual ao ThemeContext: claro é o padrão; 'dark' explícito vira escuro e
            // 'auto' (Automático, escolha do usuário) segue o aparelho.
            __html: `(function(){try{var t=localStorage.getItem('petlife_theme');if(t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <ToastProvider>
                <DeepLinks />
                <InstallPing />
                <Telemetry />
                <ConfirmProvider>
                  <TutorShell>{children}</TutorShell>
                </ConfirmProvider>
              </ToastProvider>
            </AuthProvider>
          </LocaleProvider>
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
