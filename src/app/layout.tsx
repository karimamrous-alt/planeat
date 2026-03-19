export const runtime = 'edge'

import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import Navigation from '@/components/Navigation'
import { VERSION, VERSION_DATE } from '@/lib/version'

const inter = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist',
})

export const metadata: Metadata = {
  title: 'PlanEat - Planification des repas en famille',
  description: 'Planifiez vos repas, générez vos listes de courses et gérez vos plats favoris en famille.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <Navigation />
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="text-center py-4 text-xs text-gray-300">
          {VERSION} · {VERSION_DATE}
        </footer>
      </body>
    </html>
  )
}
