'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const liens = [
  { href: '/',         label: 'Accueil',   icone: '🏠' },
  { href: '/menus',    label: 'Menus',     icone: '📅' },
  { href: '/recettes', label: 'Recettes',  icone: '📖' },
  { href: '/courses',  label: 'Courses',   icone: '🛒' },
  { href: '/favoris',  label: 'Favoris',   icone: '❤️' },
  { href: '/profil',   label: 'Profil',    icone: '👨‍👩‍👧‍👦' },
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
            {liens.map(l => (
              <Link key={l.href} href={l.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === l.href ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{l.icone}</span>
                <span>{l.label}</span>
              </Link>
            ))}
          </div>
        </div>
        {/* Mobile */}
        <div className="md:hidden flex justify-around pb-2">
          {liens.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium ${
                pathname === l.href ? 'text-green-700' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">{l.icone}</span>
              <span>{l.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
