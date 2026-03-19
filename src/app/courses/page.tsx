'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, getMondayOfWeek, formatSemaine, JOURS, JOURS_LABELS, REPAS_LABELS, CUISINE_CONFIG, ALL_SLOTS } from '@/lib/utils'
import type { Recette } from '@/lib/types'

// ── Parsing ingrédients ───────────────────────────────────────────────────────

type IngredientRaw    = { raw?: string; nom?: string; singular?: string }
type RawgredientGroup = { ingredients?: IngredientRaw[] }
type RecipeData       = { recipeRawgredients?: RawgredientGroup[] }

function extraireDepuisRawgredients(parsed: RecipeData): string[] {
  return (parsed.recipeRawgredients ?? [])
    .flatMap((g) => g?.ingredients ?? [])
    .map((i) => i?.raw || i?.singular || '')
    .filter((s) => s.length > 2 && !s.includes('personne') && !s.includes('portion'))
}

function propre(s: string): boolean {
  return s.length > 2 && !s.includes('personne') && !s.includes('portion') && !s.toLowerCase().includes('icon')
}

function extraireIngredients(raw: unknown): string[] {
  if (!raw) return []
  const data: unknown = typeof raw === 'string'
    ? (() => { try { return JSON.parse(raw) } catch { return raw } })()
    : raw
  const results: string[] = []
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'string') {
        const t = item.trim()
        if (t.startsWith('{')) {
          try {
            const parsed = JSON.parse(t) as RecipeData
            if (parsed.recipeRawgredients) results.push(...extraireDepuisRawgredients(parsed))
          } catch { /* blob malformé */ }
        } else if (propre(t)) {
          results.push(t)
        }
      } else if (item && typeof item === 'object') {
        const o = item as IngredientRaw
        const val = o.raw || o.nom || o.singular || ''
        if (propre(val)) results.push(val)
      }
    }
  } else if (data && typeof data === 'object' && (data as RecipeData).recipeRawgredients) {
    results.push(...extraireDepuisRawgredients(data as RecipeData))
  }
  return [...new Set(results)]
}

// ── Helpers slots ─────────────────────────────────────────────────────────────

function slotIds(val: unknown): string[] {
  if (typeof val !== 'string' || !val) return []
  if (val.startsWith('{')) {
    try { return Object.values(JSON.parse(val) as Record<string, string>).filter(Boolean) }
    catch { return [] }
  }
  return [val]
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SlotInfo { jour: string; repas: string }
interface RecetteCard { recette: Recette; slots: SlotInfo[]; ingredients: string[] }

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ card, onClose }: { card: RecetteCard; onClose: () => void }) {
  const { recette, slots, ingredients } = card
  const cfg = CUISINE_CONFIG[recette.cuisine] ?? { emoji: '🍴', colorClass: 'text-gray-600', bgClass: 'bg-gray-50 border-gray-200' }

  const texte = `🛒 ${recette.nom}\n\nIngrédients :\n${ingredients.map(i => `• ${i}`).join('\n')}`
  const encoded = encodeURIComponent(texte)

  const imprimer = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${recette.nom}</title>
      <style>body{font-family:sans-serif;padding:2rem;max-width:500px}h2{margin-bottom:.5rem}
      ul{padding-left:1.2rem}li{margin:.25rem 0}p{color:#666;font-size:.9rem;margin-bottom:1rem}</style>
      </head><body>
      <h2>🛒 ${recette.nom}</h2>
      <p>${cfg.emoji} ${recette.cuisine}${slots.map(s => ` · ${JOURS_LABELS[s.jour]} ${s.repas === 'dejeuner' ? 'Déjeuner' : 'Dîner'}`).join('')}</p>
      <ul>${ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
      </body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 rounded-t-3xl sm:rounded-t-2xl border-b ${cfg.bgClass}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-xs font-semibold mb-1 ${cfg.colorClass}`}>{cfg.emoji} {recette.cuisine}</p>
              <h2 className="font-bold text-gray-800 text-lg leading-tight">{recette.nom}</h2>
              <div className="flex flex-wrap gap-1 mt-2">
                {slots.map((s, i) => (
                  <span key={i} className="text-xs bg-white/70 border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
                    {JOURS_LABELS[s.jour]} · {s.repas === 'dejeuner' ? '🌞 Déj.' : '🌙 Dîner'}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0">✕</button>
          </div>
        </div>

        {/* Ingrédients */}
        <div className="flex-1 overflow-y-auto p-5">
          {ingredients.length > 0 ? (
            <ul className="space-y-2">
              {ingredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Aucun ingrédient disponible.</p>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 grid grid-cols-3 gap-2">
          <a
            href={`https://wa.me/?text=${encoded}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl py-3 px-2 transition-colors"
          >
            <span className="text-xl">📱</span>
            <span className="text-xs font-medium text-green-700 text-center leading-tight">WhatsApp</span>
          </a>
          <a
            href={`sms:?body=${encoded}`}
            className="flex flex-col items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl py-3 px-2 transition-colors"
          >
            <span className="text-xl">💬</span>
            <span className="text-xs font-medium text-blue-700 text-center leading-tight">SMS</span>
          </a>
          <button
            onClick={imprimer}
            className="flex flex-col items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl py-3 px-2 transition-colors"
          >
            <span className="text-xl">🖨️</span>
            <span className="text-xs font-medium text-gray-600 text-center leading-tight">Imprimer</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ListeDeCourses() {
  const semaine = getMondayOfWeek()
  const [cards, setCards]       = useState<RecetteCard[]>([])
  const [loading, setLoading]   = useState(true)
  const [hasMenu, setHasMenu]   = useState(false)
  const [selected, setSelected] = useState<RecetteCard | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const { data: menu } = await supabase
        .from('menus').select('*')
        .eq('famille_id', FAMILLE_ID).eq('semaine', semaine).maybeSingle()

      if (!menu) { setHasMenu(false); setLoading(false); return }
      setHasMenu(true)

      // Collecter les IDs par slot avec info jour/repas
      const slotMap = new Map<string, SlotInfo[]>()
      for (const slot of ALL_SLOTS) {
        const [jour, repas] = slot.split('_')
        for (const id of slotIds((menu as Record<string, unknown>)[slot])) {
          if (!slotMap.has(id)) slotMap.set(id, [])
          slotMap.get(id)!.push({ jour, repas })
        }
      }

      const ids = [...slotMap.keys()]
      if (!ids.length) { setCards([]); setLoading(false); return }

      const { data: recs } = await supabase.from('recettes').select('*').in('id', ids)

      const result: RecetteCard[] = (recs ?? []).map((rec: Recette) => ({
        recette: rec,
        slots: slotMap.get(rec.id) ?? [],
        ingredients: extraireIngredients(rec.ingredients),
      }))

      // Trier par jour/repas du premier slot
      const jourIdx = Object.fromEntries(JOURS.map((j, i) => [j, i]))
      result.sort((a, b) => {
        const sa = a.slots[0] ?? { jour: 'lundi', repas: 'dejeuner' }
        const sb = b.slots[0] ?? { jour: 'lundi', repas: 'dejeuner' }
        const diff = (jourIdx[sa.jour] ?? 0) - (jourIdx[sb.jour] ?? 0)
        if (diff !== 0) return diff
        return sa.repas === 'dejeuner' ? -1 : 1
      })

      setCards(result)
      setLoading(false)
    }
    load()
  }, [semaine])

  if (loading) return (
    <div className="flex items-center justify-center h-48"><div className="spinner text-green-700" /></div>
  )

  if (!hasMenu) return (
    <div className="text-center py-16 fade-in">
      <p className="text-5xl mb-4">🛒</p>
      <h2 className="text-xl font-bold text-gray-700 mb-2">Aucun menu pour cette semaine</h2>
      <p className="text-gray-400 mb-6">Générez et validez d&apos;abord votre menu de la semaine.</p>
      <Link href="/menus" className="inline-flex items-center gap-2 bg-green-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-green-800 transition-colors">
        📅 Aller aux menus
      </Link>
    </div>
  )

  return (
    <div className="fade-in space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🛒 Liste de courses</h1>
        <p className="text-gray-500 text-sm">Semaine du {formatSemaine(semaine)} · {cards.length} recette{cards.length > 1 ? 's' : ''}</p>
      </div>

      <p className="text-sm text-gray-400">Appuyez sur une recette pour voir ses ingrédients et les partager.</p>

      {/* Grille de cartes */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((card) => {
            const cfg = CUISINE_CONFIG[card.recette.cuisine] ?? { emoji: '🍴', colorClass: 'text-gray-600', bgClass: 'bg-gray-50 border-gray-200' }
            return (
              <button
                key={card.recette.id}
                onClick={() => setSelected(card)}
                className={`text-left rounded-2xl border p-4 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] ${cfg.bgClass}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold mb-1 ${cfg.colorClass}`}>{cfg.emoji} {card.recette.cuisine}</p>
                    <p className="font-bold text-gray-800 text-sm leading-snug truncate">{card.recette.nom}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {card.slots.map((s, i) => (
                        <span key={i} className="text-xs bg-white/60 border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
                          {JOURS_LABELS[s.jour]} · {s.repas === 'dejeuner' ? '🌞' : '🌙'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-gray-300 text-lg flex-shrink-0">›</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">{card.ingredients.length} ingrédient{card.ingredients.length > 1 ? 's' : ''}</p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400 text-sm">Aucune recette dans le menu.</p>
        </div>
      )}

      {/* Modal */}
      {selected && <Modal card={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
