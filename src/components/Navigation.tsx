'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const liens = [
  { href: '/',         label: 'Accueil',  icone: '🏠' },
  { href: '/menus',    label: 'Menus',    icone: '📅' },
  { href: '/recettes', label: 'Recettes', icone: '📖' },
  { href: '/courses',  label: 'Courses',  icone: '🛒' },
  { href: '/favoris',  label: 'Favoris',  icone: '❤️' },
  { href: '/profil',   label: 'Profil',   icone: '👤' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-orange-100"
      style={{ boxShadow: '0 -4px 24px rgba(44,24,16,0.10)' }}
    >
      <div className="max-w-2xl mx-auto flex justify-around items-center h-16 px-2">
        {liens.map(l => {
          const active = pathname === l.href
          return (
            <Link key={l.href} href={l.href}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-2xl transition-all min-w-[44px]"
              style={active ? { color: '#E8622A' } : { color: '#8B5E3C' }}
            >
              <span
                className="text-xl leading-none transition-transform"
                style={active ? { transform: 'scale(1.2)' } : {}}
              >
                {l.icone}
              </span>
              <span
                className="text-[10px] font-semibold leading-none"
                style={active ? { color: '#E8622A' } : { color: '#8B5E3C' }}
              >
                {l.label}
              </span>
              {active && (
                <span
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ background: '#E8622A' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
