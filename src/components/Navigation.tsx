'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const liens = [
  { href: '/', label: 'Accueil', icone: '🏠' },
  { href: '/profil', label: 'Profil famille', icone: '👨‍👩‍👧‍👦' },
  { href: '/menus', label: 'Menus', icone: '📅' },
  { href: '/courses', label: 'Liste de courses', icone: '🛒' },
  { href: '/favoris', label: 'Plats favoris', icone: '❤️' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <span className="text-xl font-bold text-green-700">PlanEat</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {liens.map((lien) => (
              <Link
                key={lien.href}
                href={lien.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === lien.href
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{lien.icone}</span>
                <span>{lien.label}</span>
              </Link>
            ))}
          </div>
        </div>
        {/* Navigation mobile */}
        <div className="md:hidden flex justify-around pb-2">
          {liens.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                pathname === lien.href
                  ? 'text-green-700'
                  : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{lien.icone}</span>
              <span>{lien.label.split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
