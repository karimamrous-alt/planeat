'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, getMondayOfWeek, formatDateFr, CUISINE_CONFIG, REPAS_LABELS, ALL_SLOTS } from '@/lib/utils'
import type { Famille, Menu } from '@/lib/types'

interface RecetteSlot { id: string; nom: string; cuisine: string }

export default function Accueil() {
  const [famille, setFamille] = useState<Famille | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [slotsRecettes, setSlotsRecettes] = useState<Record<string, RecetteSlot>>({})
  const [nbRecettes, setNbRecettes] = useState(0)
  const [nbFavoris, setNbFavoris] = useState(0)
  const [loading, setLoading] = useState(true)
  const semaine = getMondayOfWeek()

  useEffect(() => {
    const load = async () => {
      const [
        { data: fam },
        { data: menuRow },
        { count: totalRecettes },
        { count: totalFavoris },
      ] = await Promise.all([
        supabase.from('familles').select('*').eq('id', FAMILLE_ID).single(),
        supabase.from('menus').select('*').eq('famille_id', FAMILLE_ID).eq('semaine', semaine).maybeSingle(),
        supabase.from('recettes').select('id', { count: 'exact', head: true }),
        supabase.from('favoris').select('id', { count: 'exact', head: true }).eq('famille_id', FAMILLE_ID),
      ])

      setFamille(fam)
      setMenu(menuRow)
      setNbRecettes(totalRecettes ?? 0)
      setNbFavoris(totalFavoris ?? 0)

      // Charger les recettes du menu pour aujourd'hui
      if (menuRow) {
        const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long' }).toLowerCase()
        const joursMap: Record<string, string> = { lundi:'lundi', mardi:'mardi', mercredi:'mercredi', jeudi:'jeudi', vendredi:'vendredi', samedi:'samedi', dimanche:'dimanche' }
        const jourKey = joursMap[today] ?? 'lundi'
        const ids = [
          (menuRow as Record<string, unknown>)[`${jourKey}_dejeuner`],
          (menuRow as Record<string, unknown>)[`${jourKey}_diner`],
        ].filter((id): id is string => typeof id === 'string')

        if (ids.length) {
          const { data: recs } = await supabase.from('recettes').select('id, nom, cuisine').in('id', ids)
          const map: Record<string, RecetteSlot> = {}
          ;(recs ?? []).forEach(r => { map[r.id] = r })
          const slots: Record<string, RecetteSlot> = {}
          if (map[(menuRow as Record<string, unknown>)[`${jourKey}_dejeuner`] as string])
            slots['dejeuner'] = map[(menuRow as Record<string, unknown>)[`${jourKey}_dejeuner`] as string]
          if (map[(menuRow as Record<string, unknown>)[`${jourKey}_diner`] as string])
            slots['diner'] = map[(menuRow as Record<string, unknown>)[`${jourKey}_diner`] as string]
          setSlotsRecettes(slots)
        }
      }

      setLoading(false)
    }
    load()
  }, [semaine])

  const nbRepasPlannifies = menu
    ? ALL_SLOTS.filter(s => (menu as unknown as Record<string, unknown>)[s]).length
    : 0

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-center">
        <div className="spinner text-green-700 mx-auto mb-3" />
        <p className="text-gray-500">Chargement...</p>
      </div>
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
              Bonjour, {famille?.nom ?? 'Lucie'} ! 👋
            </h1>
            <p className="text-green-100">
              {nbRepasPlannifies > 0
                ? `${nbRepasPlannifies} repas planifiés cette semaine`
                : 'Aucun menu planifié cette semaine'}
            </p>
          </div>
          <div className="text-5xl hidden sm:block">🍽️</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/menus" className="bg-white text-green-700 font-bold px-5 py-2.5 rounded-xl hover:bg-green-50 transition-colors text-sm">
            {nbRepasPlannifies > 0 ? '📅 Voir mon menu' : '✨ Générer mon menu'}
          </Link>
          <Link href="/courses" className="bg-green-800 text-white font-medium px-5 py-2.5 rounded-xl hover:bg-green-900 transition-colors text-sm">
            🛒 Liste de courses
          </Link>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Recettes', value: nbRecettes, emoji: '📖', color: 'text-green-700' },
          { label: 'Favoris', value: nbFavoris, emoji: '❤️', color: 'text-red-500' },
          { label: 'Repas planifiés', value: nbRepasPlannifies, emoji: '📅', color: 'text-blue-600' },
          { label: 'Membres', value: famille?.nb_personnes ?? 6, emoji: '👨‍👩‍👧‍👦', color: 'text-orange-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <div className="text-2xl mb-1">{stat.emoji}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Menu du jour */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-bold text-gray-800 text-lg mb-4">Menu du jour</h2>
        {Object.keys(slotsRecettes).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['dejeuner', 'diner'] as const).map(repas => {
              const rec = slotsRecettes[repas]
              if (!rec) return null
              const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-600' }
              return (
                <div key={repas} className={`rounded-xl border p-4 ${cfg.bgClass}`}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{REPAS_LABELS[repas]}</p>
                  <p className="font-semibold text-gray-800">{rec.nom}</p>
                  <span className={`text-xs font-medium ${cfg.colorClass}`}>{cfg.emoji} {rec.cuisine}</span>
                </div>
              )
            })}
          </div>
        ) : menu ? (
          <p className="text-gray-400 text-sm">Aucun repas prévu aujourd&apos;hui.</p>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-400 mb-3">Aucun menu pour cette semaine.</p>
            <Link href="/menus" className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-green-800 transition-colors text-sm">
              ✨ Générer mon menu
            </Link>
          </div>
        )}
      </section>

      {/* Accès rapide */}
      <section>
        <h2 className="font-bold text-gray-700 mb-4">Accès rapide</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { href: '/menus',   emoji: '📅', title: 'Génération de menus',  desc: `Planifiez vos ${nbRepasPlannifies > 0 ? nbRepasPlannifies + ' repas déjà planifiés' : 'repas de la semaine'}`, color: 'border-green-200 hover:bg-green-50' },
            { href: '/courses', emoji: '🛒', title: 'Liste de courses',     desc: 'Votre liste générée automatiquement', color: 'border-orange-200 hover:bg-orange-50' },
            { href: '/favoris', emoji: '❤️', title: 'Plats favoris',        desc: `${nbFavoris} recette${nbFavoris > 1 ? 's' : ''} sauvegardée${nbFavoris > 1 ? 's' : ''}`, color: 'border-red-200 hover:bg-red-50' },
            { href: '/profil',  emoji: '👨‍👩‍👧‍👦', title: 'Profil famille',     desc: `${famille?.nb_personnes ?? 6} membres · Régime ${famille?.regime ?? 'halal'}`, color: 'border-blue-200 hover:bg-blue-50' },
          ].map(c => (
            <Link key={c.href} href={c.href} className={`flex items-start gap-4 bg-white rounded-2xl border p-5 transition-colors ${c.color}`}>
              <span className="text-3xl">{c.emoji}</span>
              <div>
                <p className="font-bold text-gray-800">{c.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Cuisines disponibles */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-bold text-gray-800 mb-4">Cuisines disponibles</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(CUISINE_CONFIG).map(([cuisine, cfg]) => (
            <Link key={cuisine} href={`/favoris?cuisine=${cuisine}`}
              className={`flex items-center gap-2 border rounded-xl px-4 py-2 text-sm font-medium transition-colors ${cfg.bgClass} ${cfg.colorClass} hover:opacity-80`}>
              <span className="text-lg">{cfg.emoji}</span>
              <span className="capitalize">{cuisine}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
