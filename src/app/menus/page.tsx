'use client'

export const runtime = 'edge'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  FAMILLE_ID, getMondayOfWeek, addWeeks, formatSemaine,
  ALL_SLOTS, JOURS, JOURS_LABELS, REPAS, REPAS_LABELS,
  CUISINE_CONFIG, parseMinutes, parseCalories, parseIngredients, consolidateIngredients,
  type SlotKey,
} from '@/lib/utils'
import type { Recette } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type Structure = 'plat' | 'entree_plat' | 'plat_dessert' | 'entree_plat_dessert'

type CourseSlot = {
  plat?: Recette
  entree?: Recette
  dessert?: Recette
}

type MenuSlots = Partial<Record<SlotKey, CourseSlot>>

// ── Constantes ────────────────────────────────────────────────────────────────

const JOURS_WEEKEND = new Set(['samedi', 'dimanche'])

const STRUCTURES: { value: Structure; label: string }[] = [
  { value: 'plat',                label: 'Plat seul' },
  { value: 'entree_plat',         label: 'Entrée + Plat' },
  { value: 'plat_dessert',        label: 'Plat + Dessert' },
  { value: 'entree_plat_dessert', label: 'Entrée + Plat + Dessert' },
]

const MOTS_INTERDITS = [
  'porc', 'sanglier', 'jambon', 'lardons', 'lard ',
  'alcool', 'vin ', 'bière', 'biere', 'champagne', 'cidre',
  'abats', 'foie ', 'rognons', 'tripes',
  'fruits de mer', 'crevettes', 'homard', 'moule', 'calmar', 'poulpe',
  'agneau', 'gigot', "côtelette d'agneau", 'mouton',
  'chorizo', 'pancetta', 'prosciutto', 'saucisson', 'boudin', 'merguez',
  'cappuccino', 'chocolat chaud',
]

// Items qui ne sont pas des plats principaux
const MOTS_NON_PLAT = [
  'naan', 'naans', 'pain ', 'pita', 'chapati', 'focaccia', 'baguette',
  'sablé', 'biscuit', 'cookie', 'gâteau', 'brownie', 'muffin',
  'baklava', 'chebakia', 'ghriba', 'sellou', 'msemen', 'baghrir',
]

// Exclure les accompagnements du pool entrée aussi
const MOTS_ACCOMPAGNEMENT = [
  'naan', 'naans', 'pain ', 'pita', 'chapati', 'focaccia', 'baguette',
]

const PROTEINES = [
  { mots: ['poulet', 'dinde', 'blanc de poulet', 'cuisse de poulet'], label: 'poulet' },
  { mots: ['bœuf', 'boeuf', 'steak', 'filet de bœuf', 'côte de bœuf'], label: 'boeuf' },
  { mots: ['haché', 'kefta'], label: 'hache' },
  { mots: ['poisson', 'saumon', 'cabillaud', 'thon', 'dorade', 'sole'], label: 'poisson' },
  { mots: ['légumes', 'legumes', 'végétar', 'vegetar', 'pois chiche', 'lentille', 'falafel'], label: 'legumes' },
]

// Limites hebdomadaires
const MAX_PROT_WEEK: Record<string, number> = { poulet: 3, boeuf: 2 }
const MIN_VEG_WEEK = 2
// Cible calorique journalière pour 6 personnes
const KCAL_JOUR_CIBLE = 2000

// ── Helpers ───────────────────────────────────────────────────────────────────

function recetteEstValide(r: Recette): boolean {
  const ingStr = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .map(i => typeof i === 'string' ? i : (i as { nom?: string }).nom ?? '')
    .join(' ').toLowerCase()
  const n = r.nom.toLowerCase()
  return !MOTS_INTERDITS.some(kw => ingStr.includes(kw) || n.includes(kw))
}

function estNonPlat(r: Recette): boolean {
  const n = r.nom.toLowerCase()
  return MOTS_NON_PLAT.some(m => n.includes(m))
}

function estAccompagnement(r: Recette): boolean {
  const n = r.nom.toLowerCase()
  return MOTS_ACCOMPAGNEMENT.some(m => n.includes(m))
}

function detecterProteine(nom: string): string {
  const n = nom.toLowerCase()
  for (const p of PROTEINES) {
    if (p.mots.some(m => n.includes(m))) return p.label
  }
  return 'autre'
}

function pickWeighted(
  candidates: Recette[],
  protCountWeek: Record<string, number>,
  vegBoost = false,
  targetCal = 0,
): Recette {
  const scored = candidates.map(r => {
    const prot     = detecterProteine(r.nom)
    const protScore = 1 / (1 + (protCountWeek[prot] ?? 0))
    const vegScore  = vegBoost && prot === 'legumes' ? 0.25 : 0
    let calScore = 0
    if (targetCal > 0) {
      const cal = parseCalories(r.calories)
      if (cal > 0) calScore = Math.max(0, 0.15 - Math.abs(cal - targetCal) / 2000)
    }
    return { r, score: Math.random() * 0.5 + protScore * 0.3 + vegScore + calScore }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].r
}

// Encode un slot pour la DB (plain UUID si plat seul, JSON sinon)
function encodeSlot(cs: CourseSlot): string | null {
  if (!cs.plat && !cs.entree) return null
  if (!cs.entree && !cs.dessert) return cs.plat?.id ?? null
  const obj: Record<string, string> = {}
  if (cs.entree)  obj.entree  = cs.entree.id
  if (cs.plat)    obj.plat    = cs.plat.id
  if (cs.dessert) obj.dessert = cs.dessert.id
  return JSON.stringify(obj)
}

function decodeSlot(val: unknown, map: Record<string, Recette>): CourseSlot | null {
  if (typeof val !== 'string' || !val) return null
  if (val.startsWith('{')) {
    try {
      const obj = JSON.parse(val) as Record<string, string>
      const cs: CourseSlot = {}
      if (obj.entree  && map[obj.entree])  cs.entree  = map[obj.entree]
      if (obj.plat    && map[obj.plat])    cs.plat    = map[obj.plat]
      if (obj.dessert && map[obj.dessert]) cs.dessert = map[obj.dessert]
      return (cs.plat || cs.entree) ? cs : null
    } catch { return null }
  }
  return map[val] ? { plat: map[val] } : null
}

function slotIds(val: unknown): string[] {
  if (typeof val !== 'string' || !val) return []
  if (val.startsWith('{')) {
    try { return Object.values(JSON.parse(val) as Record<string, string>).filter(Boolean) }
    catch { return [] }
  }
  return [val]
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function Menus() {
  const [semaine, setSemaine]           = useState(getMondayOfWeek())
  const [structure, setStructure]       = useState<Structure>('plat')
  const [poolPlats, setPoolPlats]       = useState<Recette[]>([])
  const [poolEntrees, setPoolEntrees]   = useState<Recette[]>([])
  const [poolDesserts, setPoolDesserts] = useState<Recette[]>([])
  const [slots, setSlots]               = useState<MenuSlots>({})
  const [menuId, setMenuId]             = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)
  const [generating, setGenerating]     = useState(false)
  const [saving, setSaving]             = useState(false)
  const [savedOk, setSavedOk]           = useState(false)
  const [modalRecette, setModalRecette] = useState<Recette | null>(null)

  // ── Pools ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('recettes').select('*').eq('type', 'plat').then(({ data }) => {
      setPoolPlats((data ?? []).filter(recetteEstValide).filter(r => !estNonPlat(r)))
    })
    supabase.from('recettes').select('*').eq('type', 'entree').then(({ data }) => {
      setPoolEntrees((data ?? []).filter(r => !estAccompagnement(r)))
    })
    supabase.from('recettes').select('*').eq('type', 'dessert').then(({ data }) => {
      setPoolDesserts(data ?? [])
    })
  }, [])

  // ── Charger le menu ────────────────────────────────────────────────────────
  const chargerMenu = useCallback(async (sem: string) => {
    setLoading(true)
    const { data: menuRow } = await supabase
      .from('menus').select('*')
      .eq('famille_id', FAMILLE_ID).eq('semaine', sem)
      .maybeSingle()

    if (!menuRow) { setSlots({}); setMenuId(null); setLoading(false); return }
    setMenuId(menuRow.id)

    const allIds = [...new Set(ALL_SLOTS.flatMap(s => slotIds((menuRow as Record<string, unknown>)[s])))]
    if (!allIds.length) { setSlots({}); setLoading(false); return }

    const { data: recs } = await supabase.from('recettes').select('*').in('id', allIds)
    const map: Record<string, Recette> = Object.fromEntries((recs ?? []).map(r => [r.id, r]))
    const rebuilt: MenuSlots = {}
    for (const s of ALL_SLOTS) {
      const cs = decodeSlot((menuRow as Record<string, unknown>)[s], map)
      if (cs) rebuilt[s as SlotKey] = cs
    }
    setSlots(rebuilt)
    setLoading(false)
  }, [])

  useEffect(() => { chargerMenu(semaine) }, [semaine, chargerMenu])

  // ── Génération intelligente ────────────────────────────────────────────────
  const genererTout = () => {
    if (!poolPlats.length) return
    setGenerating(true)

    const needsEntree  = structure === 'entree_plat'  || structure === 'entree_plat_dessert'
    const needsDessert = structure === 'plat_dessert' || structure === 'entree_plat_dessert'

    const usedPlats    = new Set<string>()
    const usedEntrees  = new Set<string>()
    const usedDesserts = new Set<string>()

    // Suivi hebdomadaire
    const protCountWeek: Record<string, number> = {}
    let vegCount = 0

    const generated: MenuSlots = {}

    for (let jourIdx = 0; jourIdx < JOURS.length; jourIdx++) {
      const jour      = JOURS[jourIdx]
      const isWeekend = JOURS_WEEKEND.has(jour)
      const maxMin    = isWeekend ? 9999 : 45

      // Suivi journalier
      const proteinesDeJour = new Set<string>()
      const cuisinesDeJour  = new Set<string>()
      let calDeJour = 0

      for (let repasIdx = 0; repasIdx < REPAS.length; repasIdx++) {
        const repas = REPAS[repasIdx]
        const slot  = `${jour}_${repas}` as SlotKey

        // Slots restants dans la semaine (y compris celui-ci)
        const slotsLeft = (JOURS.length - jourIdx - 1) * REPAS.length + (REPAS.length - repasIdx)
        const vegNeeded = MIN_VEG_WEEK - vegCount
        const mustBeVeg = vegNeeded > 0 && vegNeeded >= slotsLeft

        // Cible calorique pour ce repas
        const calRestante = Math.max(300, KCAL_JOUR_CIBLE - calDeJour)

        // Filtre strict (respecte cuisine + protéine du jour + limites semaine)
        const filterStrict = (r: Recette) => {
          if (usedPlats.has(r.id)) return false
          if (parseMinutes(r.temps_prep) > maxMin) return false
          if (cuisinesDeJour.has(r.cuisine)) return false
          const p = detecterProteine(r.nom)
          if (proteinesDeJour.has(p) && p !== 'autre') return false
          if (MAX_PROT_WEEK[p] && (protCountWeek[p] ?? 0) >= MAX_PROT_WEEK[p]) return false
          if (mustBeVeg && p !== 'legumes') return false
          return true
        }

        // Filtre relaxé (sans contrainte cuisine)
        const filterRelaxed = (r: Recette) => {
          if (usedPlats.has(r.id)) return false
          if (parseMinutes(r.temps_prep) > maxMin) return false
          const p = detecterProteine(r.nom)
          if (proteinesDeJour.has(p) && p !== 'autre') return false
          if (MAX_PROT_WEEK[p] && (protCountWeek[p] ?? 0) >= MAX_PROT_WEEK[p]) return false
          if (mustBeVeg && p !== 'legumes') return false
          return true
        }

        // Filtre minimal (uniquement temps et utilisé)
        const filterMin = (r: Recette) =>
          !usedPlats.has(r.id) && parseMinutes(r.temps_prep) <= maxMin

        let candidates = poolPlats.filter(filterStrict)
        if (!candidates.length) candidates = poolPlats.filter(filterRelaxed)
        if (!candidates.length) candidates = poolPlats.filter(filterMin)
        if (!candidates.length) continue

        const vegBoost = vegNeeded > 0 && !mustBeVeg
        const plat = pickWeighted(candidates, protCountWeek, vegBoost, calRestante)

        const cs: CourseSlot = { plat }
        usedPlats.add(plat.id)
        cuisinesDeJour.add(plat.cuisine)
        const prot = detecterProteine(plat.nom)
        proteinesDeJour.add(prot)
        protCountWeek[prot] = (protCountWeek[prot] ?? 0) + 1
        if (prot === 'legumes') vegCount++
        calDeJour += parseCalories(plat.calories)

        // Entrée
        if (needsEntree && poolEntrees.length) {
          const c = poolEntrees.filter(r => !usedEntrees.has(r.id))
          const src = c.length ? c : poolEntrees
          const e = src[Math.floor(Math.random() * src.length)]
          cs.entree = e
          usedEntrees.add(e.id)
        }

        // Dessert
        if (needsDessert && poolDesserts.length) {
          const c = poolDesserts.filter(r => !usedDesserts.has(r.id))
          const src = c.length ? c : poolDesserts
          const d = src[Math.floor(Math.random() * src.length)]
          cs.dessert = d
          usedDesserts.add(d.id)
        }

        generated[slot] = cs
      }
    }

    setSlots(generated)
    setGenerating(false)
  }

  // ── Régénérer un slot ──────────────────────────────────────────────────────
  const regenererSlot = (slot: SlotKey) => {
    if (!poolPlats.length) return
    const [jour] = slot.split('_')
    const maxMin       = JOURS_WEEKEND.has(jour) ? 9999 : 45
    const needsEntree  = structure === 'entree_plat'  || structure === 'entree_plat_dessert'
    const needsDessert = structure === 'plat_dessert' || structure === 'entree_plat_dessert'

    // Protéines déjà dans ce jour (hors slot courant)
    const proteinesDeJour = new Set(
      REPAS.map(r => `${jour}_${r}` as SlotKey)
        .filter(s => s !== slot && slots[s]?.plat)
        .map(s => detecterProteine(slots[s]!.plat!.nom))
    )

    // Compteurs semaine (hors slot courant)
    const protCountWeek: Record<string, number> = {}
    Object.entries(slots).filter(([k]) => k !== slot).forEach(([, cs]) => {
      if (cs?.plat) {
        const p = detecterProteine(cs.plat.nom)
        protCountWeek[p] = (protCountWeek[p] ?? 0) + 1
      }
    })

    const usedPlatIds = new Set(
      Object.entries(slots).filter(([k]) => k !== slot).map(([, v]) => v?.plat?.id).filter(Boolean) as string[]
    )

    let candidates = poolPlats.filter(r => {
      if (usedPlatIds.has(r.id)) return false
      if (parseMinutes(r.temps_prep) > maxMin) return false
      const p = detecterProteine(r.nom)
      if (proteinesDeJour.has(p) && p !== 'autre') return false
      if (MAX_PROT_WEEK[p] && (protCountWeek[p] ?? 0) >= MAX_PROT_WEEK[p]) return false
      return true
    })
    if (!candidates.length)
      candidates = poolPlats.filter(r => !usedPlatIds.has(r.id) && parseMinutes(r.temps_prep) <= maxMin)
    if (!candidates.length) return

    const cs: CourseSlot = { plat: pickWeighted(candidates, protCountWeek) }
    if (needsEntree && poolEntrees.length)
      cs.entree = poolEntrees[Math.floor(Math.random() * poolEntrees.length)]
    if (needsDessert && poolDesserts.length)
      cs.dessert = poolDesserts[Math.floor(Math.random() * poolDesserts.length)]

    setSlots(prev => ({ ...prev, [slot]: cs }))
  }

  // ── Valider ────────────────────────────────────────────────────────────────
  const valider = async () => {
    if (Object.keys(slots).length === 0) return
    setSaving(true)

    const payload: Record<string, unknown> = { famille_id: FAMILLE_ID, semaine }
    for (const slot of ALL_SLOTS) {
      const cs = slots[slot as SlotKey]
      payload[slot] = cs ? encodeSlot(cs) : null
    }

    const { data: saved, error } = await supabase
      .from('menus')
      .upsert(payload, { onConflict: 'famille_id,semaine' })
      .select('id').single()

    if (!error && saved) {
      setMenuId(saved.id)
      const allRecettes = Object.values(slots)
        .flatMap(cs => [cs?.entree, cs?.plat, cs?.dessert])
        .filter((r): r is Recette => !!r)
      const consolidated = consolidateIngredients(allRecettes)
      await supabase.from('liste_courses').upsert(
        { menu_id: saved.id, famille_id: FAMILLE_ID, semaine, ingredients_consolides: consolidated, articles_manuels: [] },
        { onConflict: 'menu_id' }
      )
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    }
    setSaving(false)
  }

  const nbSlotsFilled = ALL_SLOTS.filter(s => slots[s as SlotKey]).length

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
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Semaine du {formatSemaine(semaine)}</span>
          <button onClick={() => setSemaine(s => addWeeks(s, 1))} className="text-gray-500 hover:text-green-700 font-bold text-lg px-1">›</button>
        </div>
      </div>

      {/* Structure */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Structure du repas</p>
        <div className="flex flex-wrap gap-2">
          {STRUCTURES.map(s => (
            <button
              key={s.value}
              onClick={() => setStructure(s.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                structure === s.value
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={genererTout}
          disabled={generating || !poolPlats.length}
          className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {generating ? <span className="spinner" /> : '✨'} Générer tout
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

      {/* Grille */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="spinner text-green-700" /></div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-8 gap-2 mb-2">
              <div className="col-span-1" />
              {JOURS.map(jour => (
                <div key={jour} className={`col-span-1 text-center text-xs font-bold uppercase tracking-wide py-2 ${JOURS_WEEKEND.has(jour) ? 'text-orange-500' : 'text-gray-600'}`}>
                  {JOURS_LABELS[jour].slice(0, 3)}
                  {JOURS_WEEKEND.has(jour) && <span className="block text-orange-300 text-[9px] normal-case tracking-normal">week-end</span>}
                </div>
              ))}
            </div>

            {REPAS.map(repas => (
              <div key={repas} className="grid grid-cols-8 gap-2 mb-2">
                <div className="col-span-1 flex items-center">
                  <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{REPAS_LABELS[repas]}</span>
                </div>
                {JOURS.map(jour => {
                  const slot = `${jour}_${repas}` as SlotKey
                  const cs   = slots[slot]
                  return (
                    <div key={slot} className="col-span-1">
                      {cs ? (
                        <div className="relative group space-y-1">
                          <button
                            onClick={e => { e.stopPropagation(); regenererSlot(slot) }}
                            title="Régénérer"
                            className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-green-700 hover:border-green-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs shadow"
                          >↻</button>

                          {cs.entree && (
                            <div className="rounded-lg border bg-blue-50 border-blue-200 p-1.5 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => setModalRecette(cs.entree!)}>
                              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wide mb-0.5">Entrée</p>
                              <p className="text-[11px] font-semibold text-gray-700 leading-tight line-clamp-2">{cs.entree.nom}</p>
                            </div>
                          )}

                          {cs.plat && (() => {
                            const cfg = CUISINE_CONFIG[cs.plat.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-500' }
                            return (
                              <div className={`rounded-lg border p-1.5 cursor-pointer hover:brightness-95 transition-all ${cfg.bgClass} ${!cs.entree && !cs.dessert ? 'min-h-[70px]' : ''}`} onClick={() => setModalRecette(cs.plat!)}>
                                <p className={`text-[9px] font-medium mb-0.5 ${cfg.colorClass}`}>{cfg.emoji}</p>
                                <p className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2">{cs.plat.nom}</p>
                                {!cs.entree && !cs.dessert && cs.plat.temps_prep && (
                                  <p className="text-[10px] text-gray-400 mt-1">⏱ {cs.plat.temps_prep}</p>
                                )}
                              </div>
                            )
                          })()}

                          {cs.dessert && (
                            <div className="rounded-lg border bg-pink-50 border-pink-200 p-1.5 cursor-pointer hover:bg-pink-100 transition-colors" onClick={() => setModalRecette(cs.dessert!)}>
                              <p className="text-[9px] font-bold text-pink-400 uppercase tracking-wide mb-0.5">Dessert</p>
                              <p className="text-[11px] font-semibold text-gray-700 leading-tight line-clamp-2">{cs.dessert.nom}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => regenererSlot(slot)}
                          className="w-full min-h-[70px] rounded-xl border-2 border-dashed border-gray-200 text-gray-300 hover:border-green-400 hover:text-green-500 transition-colors text-xs flex items-center justify-center"
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

      {!loading && nbSlotsFilled === 0 && poolPlats.length > 0 && (
        <div className="text-center py-8 bg-white rounded-2xl border border-gray-200">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-gray-500 mb-4">Aucun menu généré pour cette semaine.</p>
          <button onClick={genererTout} className="inline-flex items-center gap-2 bg-green-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-green-800 transition-colors">
            ✨ Générer le menu de la semaine
          </button>
        </div>
      )}

      {!loading && poolPlats.length === 0 && (
        <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-amber-700">Aucune recette halal disponible.</p>
        </div>
      )}

      {modalRecette && <RecetteModal recette={modalRecette} onClose={() => setModalRecette(null)} />}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────────

const NB_FAMILLE = 6

function RecetteModal({ recette, onClose }: { recette: Recette; onClose: () => void }) {
  const cfg = CUISINE_CONFIG[recette.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-600' }

  const nbRecette = (() => {
    const m = String(recette.nb_personnes ?? '').match(/\d+/)
    return m ? parseInt(m[0]) : 0
  })()
  const ratio = nbRecette > 1 ? NB_FAMILLE / nbRecette : 1

  const scaleQty = (q: string): string => {
    if (!q || ratio === 1) return q
    const m = q.match(/^(\d+(?:[.,]\d+)?)(.*)$/)
    if (!m) return q
    return `${Math.round(parseFloat(m[1].replace(',', '.')) * ratio * 10) / 10}${m[2]}`
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Utiliser parseIngredients pour un parsing robuste
  const parsed = parseIngredients(recette.ingredients)
  const ingredients = parsed.map(ing => {
    const q = [ing.quantite ? scaleQty(ing.quantite) : '', ing.unite].filter(Boolean).join('\u00a0')
    return q ? `${q} ${ing.nom}`.trim() : ing.nom
  })

  const instructions: string[] = Array.isArray(recette.instructions) ? recette.instructions : []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {recette.image_url && (
          <div className="w-full h-48 overflow-hidden rounded-t-2xl bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recette.image_url} alt={recette.nom} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-bold text-gray-800 leading-tight">{recette.nom}</h2>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border mt-2 ${cfg.bgClass} ${cfg.colorClass}`}>
                {cfg.emoji} {recette.cuisine}
              </span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none flex-shrink-0">×</button>
          </div>

          <div className="flex flex-wrap gap-3 mb-5 text-sm text-gray-600">
            {recette.temps_prep && (
              <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">⏱ Prép. {recette.temps_prep}</span>
            )}
            {recette.temps_cuisson && (
              <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">🔥 Cuisson {recette.temps_cuisson}</span>
            )}
            {recette.nb_personnes && (
              <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
                👤 {nbRecette > 0 && nbRecette !== NB_FAMILLE ? `Pour ${NB_FAMILLE} personnes` : recette.nb_personnes}
              </span>
            )}
            {recette.calories && (
              <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
                🔥 {recette.calories}
              </span>
            )}
            {recette.difficulte && (
              <span className={`px-3 py-1 rounded-full border font-medium text-xs ${
                recette.difficulte === 'facile'   ? 'bg-green-50  text-green-700  border-green-200'  :
                recette.difficulte === 'difficile'? 'bg-red-50    text-red-700    border-red-200'    :
                                                    'bg-orange-50 text-orange-700 border-orange-200'
              }`}>{recette.difficulte}</span>
            )}
          </div>

          {ingredients.length > 0 && (
            <div className="mb-5">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                Ingrédients
                {ratio !== 1 && (
                  <span className="text-xs font-normal text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    adapté pour {NB_FAMILLE} pers.
                  </span>
                )}
              </h3>
              <ul className="space-y-1.5">
                {ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                    <span>{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {instructions.length > 0 ? (
            <div>
              <h3 className="font-bold text-gray-700 mb-3">Préparation</h3>
              <ol className="space-y-3">
                {instructions.map((etape, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-700 text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="leading-relaxed pt-0.5">{etape}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Instructions non disponibles pour cette recette.</p>
          )}
        </div>
      </div>
    </div>
  )
}
