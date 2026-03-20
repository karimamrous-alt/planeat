export const runtime = 'edge'

import type { Metadata } from 'next'
import { Playfair_Display, Nunito } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PlanEat — Repas en famille',
  description: 'Planifiez vos repas, générez vos listes de courses et gérez vos plats favoris en famille.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${playfair.variable} ${nunito.variable}`}>
      <body className="font-sans min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-orange-100 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <span className="font-display text-2xl font-bold" style={{ color: '#E8622A' }}>
              PlanEat
            </span>
            <span className="text-xl">🍽️</span>
          </div>
        </header>

        {/* Content with bottom padding for nav */}
        <main className="max-w-2xl mx-auto px-4 py-6 pb-28">
          {children}
        </main>

        {/* Bottom navigation */}
        <Navigation />
      </body>
    </html>
  )
}
