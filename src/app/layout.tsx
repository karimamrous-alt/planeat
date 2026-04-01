export const runtime = 'edge'

import type { Metadata } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import { VERSION } from '@/lib/version'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PlanEat — Repas en famille',
  description: 'Planifiez vos repas, générez vos listes de courses et gérez vos plats favoris en famille.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-sans min-h-screen" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
        {/* Header */}
        <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ background: 'rgba(13,13,13,0.92)', borderColor: '#333333' }}>
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold" style={{ color: '#C8440A' }}>PlanEat</span>
              <span className="text-xs font-semibold" style={{ color: '#9A9A9A' }}>{VERSION}</span>
            </div>
            <span className="text-xl">🍽️</span>
          </div>
        </header>

        {/* Content with bottom padding for nav */}
        <main className="max-w-2xl mx-auto px-4 py-6 pb-28">
          {children}
        </main>

        {/* Footer */}
        <footer className="max-w-2xl mx-auto px-4 pb-32 text-center">
          <p className="text-xs" style={{ color: '#9A9A9A' }}>PlanEat {VERSION}</p>
        </footer>

        {/* Bottom navigation */}
        <Navigation />
      </body>
    </html>
  )
}
