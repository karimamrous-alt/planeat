'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, getMondayOfWeek, formatDateFr, CUISINE_CONFIG, REPAS_LABELS, JOURS } from '@/lib/utils'
import type { Famille, Menu, Recette } from '@/lib/types'

export default function Accueil() {
  const [famille, setFamille]         = useState<Famille | null>(null)
  const [menu, setMenu]               = useState<Menu | null>(null)
  const [nbRecettes, setNbRecettes]   = useState(0)
  const [nbFavoris, setNbFavoris]     = useState(0)
  const [repasAujourdhui, setRepasAujourdhui] = useState<{ dejeuner?: Recette; diner?: Recette }>({})
  const [loading, setLoading]         = useState(true)
  const semaine = getMondayOfWeek()

  useEffect(() => {
    const load = async () => {
      const jourFr = new Date().toLocaleDateString('fr-FR', { weekday: 'long' }).toLowerCase()
      const jourKey = JOURS.find(j => jourFr.startsWith(j)) ?? 'lundi'

      const [
        { data: fam },
        { data: menuRow },
        { count: totalRec },
        { count: totalFav },
      ] = await Promise.all([
        supabase.from('familles').select('*').eq('id', FAMILLE_ID).single(),
        supabase.from('menus').select('*').eq('famille_id', FAMILLE_ID).eq('semaine', semaine).maybeSingle(),
        supabase.from('recettes').select('id', { count: 'exact', head: true }),
        supabase.from('favoris').select('id', { count: 'exact', head: true }).eq('famille_id', FAMILLE_ID),
      ])

      setFamille(fam)
      setMenu(menuRow)
      setNbRecettes(totalRec ?? 0)
      setNbFavoris(totalFav ?? 0)

      if (menuRow) {
        const today = menuRow.jours?.[jourKey] ?? {}
        const ids = [today.dejeuner, today.diner].filter((id): id is string => !!id)
        if (ids.length) {
          const { data: recs } = await supabase.from('recettes').select('*').in('id', ids)
          const map = Object.fromEntries((recs ?? []).map(r => [r.id, r]))
          setRepasAujourdhui({
            dejeuner: today.dejeuner ? map[today.dejeuner] : undefined,
            diner:    today.diner    ? map[today.diner]    : undefined,
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [semaine])

  const nbRepas = menu
    ? Object.values(menu.jours ?? {}).reduce((s, d) => s + (d.dejeuner ? 1 : 0) + (d.diner ? 1 : 0), 0)
    : 0

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="spinner text-green-700 mx-auto" />
    </div>
  )

  return (
    <div className="fade-in space-y-8">
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-700 to-green-600 rounded-3xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-green-200 text-sm font-medium mb-1 capitalize">{formatDateFr()}</p>
            <h1 className="text-3xl font-bold mb-2">
              Bonjour {famille?.nom ?? 'Lucie'} ! 👋
            </h1>
            <p className="text-green-100">
              {nbRepas > 0 ? `${nbRepas} repas planifiés cette semaine` : 'Aucun menu planifié cette semaine'}
            </p>
          </div>
          <div className="text-5xl hidden sm:block">🍽️</div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/menus" className="bg-white text-green-700 font-bold px-5 py-2.5 rounded-xl hover:bg-green-50 transition-colors text-sm">
            {nbRepas > 0 ? '📅 Voir mon menu' : '✨ Générer ma semaine'}
          </Link>
          <Link href="/courses" className="bg-green-800 text-white font-medium px-5 py-2.5 rounded-xl hover:bg-green-900 transition-colors text-sm">
            🛒 Liste de courses
          </Link>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Recettes',        value: nbRecettes,             emoji: '📖', color: 'text-green-700' },
          { label: 'Favoris',         value: nbFavoris,              emoji: '❤️', color: 'text-red-500'  },
          { label: 'Repas planifiés', value: nbRepas,                emoji: '📅', color: 'text-blue-600' },
          { label: 'Membres',         value: famille?.nb_personnes ?? 6, emoji: '👨‍👩‍👧‍👦', color: 'text-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">{s.emoji}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Menu du jour */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-bold text-gray-800 text-lg mb-4">Menu du jour</h2>
        {Object.keys(repasAujourdhui).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['dejeuner', 'diner'] as const).map(repas => {
              const rec = repasAujourdhui[repas]
              if (!rec) return null
              const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-600' }
              return (
                <div key={repas} className={`rounded-xl border p-4 ${cfg.bgClass}`}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{REPAS_LABELS[repas]}</p>
                  <p className="font-semibold text-gray-800">{rec.nom}</p>
                  <span className={`text-xs font-medium ${cfg.colorClass}`}>{cfg.emoji} {rec.cuisine}</span>
                  {rec.calories > 0 && <span className="text-xs text-gray-400 ml-2">· {rec.calories} kcal</span>}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-400 mb-3">{menu ? 'Aucun repas prévu aujourd\'hui.' : 'Aucun menu cette semaine.'}</p>
            <Link href="/menus" className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-green-800 transition-colors text-sm">
              ✨ Générer ma semaine
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
