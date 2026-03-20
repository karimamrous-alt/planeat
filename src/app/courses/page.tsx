'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, getMondayOfWeek, formatSemaine, JOURS, JOURS_LABELS, CUISINE_CONFIG } from '@/lib/utils'
import type { Recette, DayMenu } from '@/lib/types'

// ── Modal ingrédients ─────────────────────────────────────────────────────────

function Modal({ recette: r, onClose }: { recette: Recette; onClose: () => void }) {
  const cfg = CUISINE_CONFIG[r.cuisine] ?? { emoji:'🍴', colorClass:'text-gray-600', bgClass:'bg-gray-50 border-gray-200' }
  const lignes = r.ingredients.map(i => [i.quantite, i.unite, i.nom].filter(Boolean).join('\u00a0'))

  const texte  = `🛒 ${r.nom}\n\nIngrédients :\n${lignes.map(l => `• ${l}`).join('\n')}`
  const encoded = encodeURIComponent(texte)

  const imprimer = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${r.nom}</title>
      <style>body{font-family:sans-serif;padding:2rem;max-width:500px}h2{margin-bottom:.5rem}ul{padding-left:1.2rem}li{margin:.25rem 0}</style>
      </head><body><h2>🛒 ${r.nom}</h2><p>${cfg.emoji} ${r.cuisine} · ${r.personnes} pers. · ${r.calories} kcal</p>
      <ul>${lignes.map(l => `<li>${l}</li>`).join('')}</ul></body></html>`)
    w.document.close(); w.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className={`p-5 rounded-t-3xl sm:rounded-t-2xl border-b ${cfg.bgClass}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-xs font-semibold mb-1 ${cfg.colorClass}`}>{cfg.emoji} {r.cuisine}</p>
              <h2 className="font-bold text-gray-800 text-lg leading-tight">{r.nom}</h2>
              <p className="text-xs text-gray-500 mt-1">{r.personnes} pers. · {r.calories > 0 ? `${r.calories} kcal` : ''}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {lignes.length > 0 ? (
            <ul className="space-y-2">
              {lignes.map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Aucun ingrédient disponible.</p>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 grid grid-cols-3 gap-2">
          <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl py-3 px-2 transition-colors">
            <span className="text-xl">📱</span>
            <span className="text-xs font-medium text-green-700">WhatsApp</span>
          </a>
          <a href={`sms:?body=${encoded}`}
            className="flex flex-col items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl py-3 px-2 transition-colors">
            <span className="text-xl">💬</span>
            <span className="text-xs font-medium text-blue-700">SMS</span>
          </a>
          <button onClick={imprimer}
            className="flex flex-col items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl py-3 px-2 transition-colors">
            <span className="text-xl">🖨️</span>
            <span className="text-xs font-medium text-gray-600">Imprimer</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Courses() {
  const semaine = getMondayOfWeek()
  const [recettes, setRecettes] = useState<Recette[]>([])
  const [loading,  setLoading]  = useState(true)
  const [hasMenu,  setHasMenu]  = useState(false)
  const [selected, setSelected] = useState<Recette | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: menu } = await supabase
        .from('menus').select('*')
        .eq('famille_id', FAMILLE_ID).eq('semaine', semaine)
        .maybeSingle()

      if (!menu) { setHasMenu(false); setLoading(false); return }
      setHasMenu(true)

      const ids = new Set<string>()
      for (const jour of JOURS) {
        const day = (menu.jours as Record<string, DayMenu>)[jour]
        if (day?.dejeuner) ids.add(day.dejeuner)
        if (day?.diner)    ids.add(day.diner)
      }

      if (!ids.size) { setLoading(false); return }

      const { data: recs } = await supabase.from('recettes').select('*').in('id', [...ids])
      setRecettes(recs ?? [])
      setLoading(false)
    }
    load()
  }, [semaine])

  if (loading) return <div className="flex justify-center h-48 items-center"><div className="spinner text-green-700" /></div>

  if (!hasMenu) return (
    <div className="text-center py-16 fade-in">
      <p className="text-5xl mb-4">🛒</p>
      <h2 className="text-xl font-bold text-gray-700 mb-2">Aucun menu pour cette semaine</h2>
      <p className="text-gray-400 mb-6">Générez et validez d&apos;abord votre menu.</p>
      <Link href="/menus" className="inline-flex items-center gap-2 bg-green-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-green-800 transition-colors">
        📅 Aller aux menus
      </Link>
    </div>
  )

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🛒 Liste de courses</h1>
        <p className="text-gray-500 text-sm">Semaine du {formatSemaine(semaine)} · {recettes.length} recette{recettes.length > 1 ? 's' : ''}</p>
      </div>

      <p className="text-sm text-gray-400">Appuyez sur une recette pour voir ses ingrédients et les partager.</p>

      {recettes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recettes.map(rec => {
            const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji:'🍴', colorClass:'text-gray-600', bgClass:'bg-gray-50 border-gray-200' }
            return (
              <button key={rec.id} onClick={() => setSelected(rec)}
                className={`text-left rounded-2xl border p-4 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] ${cfg.bgClass}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold mb-1 ${cfg.colorClass}`}>{cfg.emoji} {rec.cuisine}</p>
                    <p className="font-bold text-gray-800 text-sm leading-snug truncate">{rec.nom}</p>
                    <div className="flex gap-2 mt-1 text-xs text-gray-400">
                      {rec.personnes > 0 && <span>👤 {rec.personnes} pers.</span>}
                      {rec.calories > 0  && <span>🔥 {rec.calories} kcal</span>}
                    </div>
                  </div>
                  <span className="text-gray-300 text-lg flex-shrink-0">›</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">{rec.ingredients.length} ingrédient{rec.ingredients.length > 1 ? 's' : ''}</p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400 text-sm">Aucune recette dans le menu.</p>
        </div>
      )}

      {selected && <Modal recette={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
