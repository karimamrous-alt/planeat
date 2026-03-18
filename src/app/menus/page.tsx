'use client'

export const runtime = 'edge'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  FAMILLE_ID, getMondayOfWeek, addWeeks, formatSemaine,
  ALL_SLOTS, JOURS, JOURS_LABELS, REPAS, REPAS_LABELS,
  CUISINE_CONFIG, parseMinutes, pickRandom, consolidateIngredients,
  type SlotKey,
} from '@/lib/utils'
import type { Recette } from '@/lib/types'

type MenuSlots = Partial<Record<SlotKey, Recette>>

export default function Menus() {
  const [semaine, setSemaine]       = useState(getMondayOfWeek())
  const [pool, setPool]             = useState<Recette[]>([])
  const [slots, setSlots]           = useState<MenuSlots>({})
  const [menuId, setMenuId]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [savedOk, setSavedOk]       = useState(false)

  // ── Charger le pool de recettes ────────────────────────────────────────
  useEffect(() => {
    supabase.from('recettes').select('*').then(({ data }) => {
      const filtered = (data ?? []).filter(r => parseMinutes(r.temps_prep) <= 45)
      setPool(filtered)
    })
  }, [])

  // ── Charger le menu de la semaine ──────────────────────────────────────
  const chargerMenu = useCallback(async (sem: string) => {
    setLoading(true)
    const { data: menuRow } = await supabase
      .from('menus').select('*')
      .eq('famille_id', FAMILLE_ID).eq('semaine', sem)
      .maybeSingle()

    if (!menuRow) { setSlots({}); setMenuId(null); setLoading(false); return }

    setMenuId(menuRow.id)
    const ids = ALL_SLOTS.map(s => (menuRow as Record<string,unknown>)[s]).filter((id): id is string => typeof id === 'string')
    if (!ids.length) { setSlots({}); setLoading(false); return }

    const { data: recs } = await supabase.from('recettes').select('*').in('id', ids)
    const map = Object.fromEntries((recs ?? []).map(r => [r.id, r]))
    const rebuilt: MenuSlots = {}
    for (const slot of ALL_SLOTS) {
      const id = (menuRow as Record<string,unknown>)[slot]
      if (typeof id === 'string' && map[id]) rebuilt[slot] = map[id]
    }
    setSlots(rebuilt)
    setLoading(false)
  }, [])

  useEffect(() => { chargerMenu(semaine) }, [semaine, chargerMenu])

  // ── Générer tout ───────────────────────────────────────────────────────
  const genererTout = () => {
    if (!pool.length) return
    setGenerating(true)
    const used = new Set<string>()
    const generated: MenuSlots = {}
    for (const slot of ALL_SLOTS) {
      const r = pickRandom(pool, used)
      if (r) { generated[slot] = r; used.add(r.id) }
    }
    setSlots(generated)
    setGenerating(false)
  }

  // ── Régénérer un seul slot ────────────────────────────────────────────
  const regenererSlot = (slot: SlotKey) => {
    if (!pool.length) return
    const used = new Set(Object.entries(slots).filter(([k]) => k !== slot).map(([, v]) => v!.id))
    const r = pickRandom(pool, used)
    if (r) setSlots(prev => ({ ...prev, [slot]: r }))
  }

  // ── Valider & sauvegarder ──────────────────────────────────────────────
  const valider = async () => {
    if (Object.keys(slots).length === 0) return
    setSaving(true)

    const payload: Record<string, unknown> = { famille_id: FAMILLE_ID, semaine }
    for (const slot of ALL_SLOTS) payload[slot] = slots[slot]?.id ?? null

    const { data: saved, error } = await supabase
      .from('menus')
      .upsert(payload, { onConflict: 'famille_id,semaine' })
      .select('id').single()

    if (!error && saved) {
      setMenuId(saved.id)

      // Générer la liste de courses
      const recettesMenu = ALL_SLOTS.map(s => slots[s]).filter((r): r is Recette => !!r)
      const consolidated = consolidateIngredients(recettesMenu)
      await supabase.from('liste_courses').upsert(
        { menu_id: saved.id, famille_id: FAMILLE_ID, semaine, ingredients_consolides: consolidated, articles_manuels: [] },
        { onConflict: 'menu_id' }
      )

      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    }
    setSaving(false)
  }

  const nbSlotsFilled = ALL_SLOTS.filter(s => slots[s]).length

  return (
    <div className="fade-in space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📅 Génération de menus</h1>
          <p className="text-gray-500 text-sm mt-0.5">Planifiez vos repas de la semaine</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-2">
          <button onClick={() => setSemaine(s => addWeeks(s, -1))} className="text-gray-500 hover:text-green-700 font-bold text-lg px-1">‹</button>
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Semaine du {formatSemaine(semaine)}
          </span>
          <button onClick={() => setSemaine(s => addWeeks(s, 1))} className="text-gray-500 hover:text-green-700 font-bold text-lg px-1">›</button>
        </div>
      </div>

      {/* Barre d'actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={genererTout}
          disabled={generating || !pool.length}
          className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {generating ? <span className="spinner" /> : '✨'}
          Générer tout
        </button>
        <button
          onClick={valider}
          disabled={saving || nbSlotsFilled === 0}
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? <span className="spinner" /> : savedOk ? '✅' : '💾'}
          {savedOk ? 'Sauvegardé !' : 'Valider la semaine'}
        </button>
        {menuId && (
          <Link href="/courses" className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium px-5 py-2.5 rounded-xl transition-colors">
            🛒 Voir les courses
          </Link>
        )}
        <span className="text-sm text-gray-400 ml-auto">{nbSlotsFilled}/14 repas</span>
      </div>

      {/* Info pool */}
      {!loading && pool.length > 0 && (
        <p className="text-xs text-gray-400">{pool.length} recettes disponibles (≤ 45 min)</p>
      )}

      {/* Grille */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="spinner text-green-700" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* En-tête jours */}
            <div className="grid grid-cols-8 gap-2 mb-2">
              <div className="col-span-1" />
              {JOURS.map(jour => (
                <div key={jour} className="col-span-1 text-center text-xs font-bold text-gray-600 uppercase tracking-wide py-2">
                  {JOURS_LABELS[jour].slice(0, 3)}
                </div>
              ))}
            </div>

            {/* Lignes repas */}
            {REPAS.map(repas => (
              <div key={repas} className="grid grid-cols-8 gap-2 mb-2">
                <div className="col-span-1 flex items-center">
                  <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                    {REPAS_LABELS[repas]}
                  </span>
                </div>
                {JOURS.map(jour => {
                  const slot = `${jour}_${repas}` as SlotKey
                  const recette = slots[slot]
                  const cfg = recette ? (CUISINE_CONFIG[recette.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-500' }) : null

                  return (
                    <div key={slot} className="col-span-1">
                      {recette && cfg ? (
                        <div className={`relative rounded-xl border p-2 min-h-[80px] ${cfg.bgClass} group`}>
                          <button
                            onClick={() => regenererSlot(slot)}
                            title="Régénérer"
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-green-700 hover:border-green-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs"
                          >
                            ↻
                          </button>
                          <p className={`text-xs font-medium mb-1 ${cfg.colorClass}`}>{cfg.emoji}</p>
                          <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">
                            {recette.nom}
                          </p>
                          {recette.temps_prep && (
                            <p className="text-xs text-gray-400 mt-1">⏱ {recette.temps_prep}</p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => regenererSlot(slot)}
                          className="w-full min-h-[80px] rounded-xl border-2 border-dashed border-gray-200 text-gray-300 hover:border-green-400 hover:text-green-500 transition-colors text-xs flex items-center justify-center"
                        >
                          + Ajouter
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && nbSlotsFilled === 0 && pool.length > 0 && (
        <div className="text-center py-8 bg-white rounded-2xl border border-gray-200">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-gray-500 mb-4">Aucun menu généré pour cette semaine.</p>
          <button onClick={genererTout} className="inline-flex items-center gap-2 bg-green-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-green-800 transition-colors">
            ✨ Générer le menu de la semaine
          </button>
        </div>
      )}

      {!loading && pool.length === 0 && (
        <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-amber-700">Aucune recette disponible avec ces filtres (≤ 45 min).</p>
        </div>
      )}
    </div>
  )
}
