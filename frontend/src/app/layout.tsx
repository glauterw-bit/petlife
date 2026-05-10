import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/ToastContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PetLife — O cuidado que seu pet merece',
  description:
    'Gerencie a saúde do seu pet com tecnologia e carinho. Vacinas, exames, rotinas e muito mais.',
  keywords: ['pet', 'saúde animal', 'vacinas', 'cachorro', 'gato', 'veterinário'],
  authors: [{ name: 'PetLife' }],
  openGraph: {
    title: 'PetLife — O cuidado que seu pet merece',
    description: 'Plataforma completa para cuidar da saúde do seu pet.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
