'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, getMondayOfWeek, formatDateFr, CUISINE_CONFIG, REPAS_LABELS, JOURS } from '@/lib/utils'
import type { Famille, Menu, Recette } from '@/lib/types'

export default function Accueil() {
  const [famille, setFamille]       = useState<Famille | null>(null)
  const [menu, setMenu]             = useState<Menu | null>(null)
  const [nbRecettes, setNbRecettes] = useState(0)
  const [nbFavoris, setNbFavoris]   = useState(0)
  const [repasAujourdhui, setRepasAujourdhui] = useState<{ dejeuner?: Recette; diner?: Recette }>({})
  const [loading, setLoading]       = useState(true)
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
      <div className="spinner" style={{ color: '#E8622A' }} />
    </div>
  )

  return (
    <div className="fade-in space-y-6">

      {/* ── Hero ── */}
      <section
        className="rounded-4xl p-7 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #E8622A 0%, #F5A623 100%)' }}
      >
        {/* Decorative circle */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20" style={{ background: '#fff' }} />
        <div className="absolute -bottom-10 -left-4 w-28 h-28 rounded-full opacity-10" style={{ background: '#fff' }} />

        <div className="relative">
          <p className="text-orange-100 text-sm font-semibold mb-1 capitalize">{formatDateFr()}</p>
          <h1 className="font-display text-3xl font-bold mb-1">
            Bonjour {famille?.nom ?? 'Lucie'} ! 👋
          </h1>
          <p className="text-orange-100 text-sm">
            {nbRepas > 0 ? `${nbRepas} repas planifiés cette semaine` : 'Aucun menu planifié cette semaine'}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/menus"
              className="bg-white font-bold px-5 py-2.5 rounded-full text-sm transition-opacity hover:opacity-90"
              style={{ color: '#E8622A' }}
            >
              {nbRepas > 0 ? '📅 Voir mon menu' : '✨ Générer ma semaine'}
            </Link>
            <Link href="/courses"
              className="bg-white/20 text-white font-semibold px-5 py-2.5 rounded-full text-sm hover:bg-white/30 transition-colors border border-white/30"
            >
              🛒 Courses
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats 2×2 ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Recettes',        value: nbRecettes,                emoji: '📖', color: '#E8622A' },
          { label: 'Favoris',         value: nbFavoris,                 emoji: '❤️', color: '#EF4444' },
          { label: 'Repas planifiés', value: nbRepas,                   emoji: '📅', color: '#3B82F6' },
          { label: 'Membres',         value: famille?.nb_personnes ?? 6, emoji: '👨‍👩‍👧‍👦', color: '#F5A623' },
        ].map(s => (
          <div key={s.label}
            className="bg-white rounded-3xl p-4 text-center"
            style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}
          >
            <div className="text-3xl mb-2">{s.emoji}</div>
            <div className="text-2xl font-bold font-display" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: '#8B5E3C' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Menu du jour ── */}
      <section className="bg-white rounded-4xl p-5" style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}>
        <h2 className="font-display text-lg font-bold mb-4" style={{ color: '#2C1810' }}>
          Menu du jour
        </h2>

        {Object.keys(repasAujourdhui).length > 0 ? (
          <div className="space-y-3">
            {(['dejeuner', 'diner'] as const).map(repas => {
              const rec = repasAujourdhui[repas]
              if (!rec) return null
              const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-600', ph: 'ph-default' }
              return (
                <Link key={repas} href="/menus" className={`rounded-2xl border p-4 flex gap-3 items-center transition-opacity hover:opacity-80 active:opacity-60 ${cfg.bgClass}`}>
                  {/* Photo placeholder */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${cfg.ph}`}>
                    {cfg.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold mb-0.5" style={{ color: '#8B5E3C' }}>{REPAS_LABELS[repas]}</p>
                    <p className="font-bold text-sm leading-tight truncate" style={{ color: '#2C1810' }}>{rec.nom}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs font-medium ${cfg.colorClass}`}>{cfg.emoji} {rec.cuisine}</span>
                      {rec.calories > 0 && <span className="text-xs" style={{ color: '#8B5E3C' }}>· {rec.calories} kcal</span>}
                    </div>
                  </div>
                  <span className="text-lg flex-shrink-0" style={{ color: '#C4956A' }}>›</span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm mb-4" style={{ color: '#8B5E3C' }}>
              {menu ? "Aucun repas prévu aujourd'hui." : 'Aucun menu cette semaine.'}
            </p>
            <Link href="/menus"
              className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-full text-sm"
              style={{ background: '#E8622A' }}
            >
              ✨ Générer ma semaine
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
