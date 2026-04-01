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
      className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md border-t"
      style={{ background: 'rgba(28,28,28,0.97)', borderColor: '#333333', boxShadow: '0 -4px 24px rgba(0,0,0,0.5)' }}
    >
      <div className="max-w-2xl mx-auto flex justify-around items-center h-16 px-2">
        {liens.map(l => {
          const active = pathname === l.href
          return (
            <Link key={l.href} href={l.href}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-2xl transition-all min-w-[44px]"
              style={active ? { color: '#C8440A' } : { color: '#9A9A9A' }}
            >
              <span
                className="text-xl leading-none transition-transform"
                style={active ? { transform: 'scale(1.2)' } : {}}
              >
                {l.icone}
              </span>
              <span
                className="text-[10px] font-semibold leading-none"
                style={active ? { color: '#C8440A' } : { color: '#9A9A9A' }}
              >
                {l.label}
              </span>
              {active && (
                <span
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ background: '#C8440A' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
