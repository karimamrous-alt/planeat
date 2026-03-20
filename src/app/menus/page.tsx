'use client'

export const runtime = 'edge'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  FAMILLE_ID, getMondayOfWeek, addWeeks, formatSemaine,
  JOURS, JOURS_LABELS, REPAS, REPAS_LABELS, JOURS_WEEKEND,
  CUISINE_CONFIG, CUISINES_SOIR_ONLY, getSlotConfig,
  detecterProteine, estSaisonnier, getAstuces, SAISON_ACTUELLE,
} from '@/lib/utils'
import type { Recette, DayMenu } from '@/lib/types'

// ── Types locaux ──────────────────────────────────────────────────────────────

type Repas = 'dejeuner' | 'diner'
type DaySlots  = Partial<Record<Repas, Recette>>
type WeekSlots = Partial<Record<string, DaySlots>>

type Structure = 'plat' | 'entree_plat' | 'plat_dessert' | 'entree_plat_dessert'

// ── Constantes génération ─────────────────────────────────────────────────────

const MOTS_INTERDITS = [
  'porc','sanglier','jambon','lardons','lard ','alcool','vin ','bière','champagne',
  'abats','foie ','rognons','tripes','agneau','gigot','mouton',
  'chorizo','pancetta','prosciutto','boudin',
]

const MOTS_LOURD = ['tajine','couscous','gratin','lasagne','cassoulet']

const MAX_PROT_WEEK: Record<string, number> = { poulet: 3, boeuf: 2, poisson: 2 }
const MAX_TAJINES_WEEK = 1
const MIN_VEG_WEEK = 2

function recetteValide(r: Recette): boolean {
  const n   = r.nom.toLowerCase()
  const ing = r.ingredients.map(i => i.nom).join(' ').toLowerCase()
  return !MOTS_INTERDITS.some(kw => n.includes(kw) || ing.includes(kw))
}

function totalMin(r: Recette) { return r.temps_prep + r.temps_cuisson }
function estLourd(r: Recette) {
  const n = r.nom.toLowerCase()
  return MOTS_LOURD.some(m => n.includes(m)) || r.calories > 750
}

function pickWeighted(
  pool: Recette[],
  protWeek: Record<string, number>,
  vegBoost = false,
  targetCal = 600,
): Recette {
  const scored = pool.map(r => {
    const prot = detecterProteine(r.nom)
    const protS  = 1 / (1 + (protWeek[prot] ?? 0))
    const vegS   = vegBoost && prot === 'vegetal' ? 0.3 : 0
    const calS   = r.calories > 0 ? Math.max(0, 0.1 - Math.abs(r.calories - targetCal) / 2000) : 0
    const saisonS = estSaisonnier(r) ? 0.2 : 0
    return { r, s: Math.random() * 0.5 + protS * 0.3 + vegS + calS + saisonS }
  })
  scored.sort((a, b) => b.s - a.s)
  return scored[0].r
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function Menus() {
  const [semaine,   setSemaine]   = useState(getMondayOfWeek())
  const [structure, setStructure] = useState<Structure>('plat')
  const [pool,      setPool]      = useState<Recette[]>([])
  const [slots,     setSlots]     = useState<WeekSlots>({})
  const [menuId,    setMenuId]    = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [savedOk,   setSavedOk]   = useState(false)
  const [modal,     setModal]     = useState<Recette | null>(null)

  // Charger le pool de recettes valides
  useEffect(() => {
    supabase.from('recettes').select('*').in('type', ['plat','soupe']).then(({ data }) => {
      setPool((data ?? []).filter(recetteValide))
    })
  }, [])

  // Charger le menu existant
  const chargerMenu = useCallback(async (sem: string) => {
    setLoading(true)
    const { data: menuRow } = await supabase
      .from('menus').select('*')
      .eq('famille_id', FAMILLE_ID).eq('semaine', sem)
      .maybeSingle()

    if (!menuRow) { setSlots({}); setMenuId(null); setLoading(false); return }
    setMenuId(menuRow.id)

    const allIds = new Set<string>()
    for (const day of Object.values(menuRow.jours as Record<string, DayMenu>)) {
      if (day.dejeuner) allIds.add(day.dejeuner)
      if (day.diner)    allIds.add(day.diner)
    }

    if (!allIds.size) { setSlots({}); setLoading(false); return }

    const { data: recs } = await supabase.from('recettes').select('*').in('id', [...allIds])
    const map = Object.fromEntries((recs ?? []).map((r: Recette) => [r.id, r]))

    const rebuilt: WeekSlots = {}
    for (const [jour, day] of Object.entries(menuRow.jours as Record<string, DayMenu>)) {
      const ds: DaySlots = {}
      if (day.dejeuner && map[day.dejeuner]) ds.dejeuner = map[day.dejeuner]
      if (day.diner    && map[day.diner])    ds.diner    = map[day.diner]
      if (ds.dejeuner || ds.diner) rebuilt[jour] = ds
    }
    setSlots(rebuilt)
    setLoading(false)
  }, [])

  useEffect(() => { chargerMenu(semaine) }, [semaine, chargerMenu])

  // ── Génération complète ────────────────────────────────────────────────────
  const genererTout = () => {
    if (!pool.length) return
    setGenerating(true)

    const usedIds   = new Set<string>()
    const protWeek: Record<string, number> = {}
    let vegCount   = 0
    let tajineCount = 0

    const generated: WeekSlots = {}

    for (let ji = 0; ji < JOURS.length; ji++) {
      const jour = JOURS[ji]
      const proteinesJour = new Set<string>()
      let lourdsJour = 0

      for (let ri = 0; ri < REPAS.length; ri++) {
        const repas = REPAS[ri]
        const { maxMin, cuisinesOnly } = getSlotConfig(jour, repas)

        const slotsLeft = (JOURS.length - ji - 1) * 2 + (2 - ri)
        const vegNeeded = MIN_VEG_WEEK - vegCount
        const mustVeg   = vegNeeded > 0 && vegNeeded >= slotsLeft

        const passesTime = (r: Recette) => {
          const t = totalMin(r); return t === 0 ? !JOURS_WEEKEND.has(jour) || repas === 'diner' : t <= maxMin
        }
        const passesCuisine = (r: Recette) =>
          !cuisinesOnly || cuisinesOnly.includes(r.cuisine)
        const passesSoir = (r: Recette) =>
          !CUISINES_SOIR_ONLY.has(r.cuisine) || repas === 'diner' || JOURS_WEEKEND.has(jour)

        const filterFull = (r: Recette) => {
          if (usedIds.has(r.id)) return false
          if (!passesTime(r) || !passesCuisine(r) || !passesSoir(r)) return false
          const p = detecterProteine(r.nom)
          if (proteinesJour.has(p) && p !== 'autre') return false
          if (MAX_PROT_WEEK[p] && (protWeek[p] ?? 0) >= MAX_PROT_WEEK[p]) return false
          if (mustVeg && p !== 'vegetal') return false
          if (lourdsJour >= 1 && estLourd(r)) return false
          if (tajineCount >= MAX_TAJINES_WEEK && MOTS_LOURD.slice(0,2).some(m => r.nom.toLowerCase().includes(m))) return false
          return true
        }

        const filterRelaxed = (r: Recette) => {
          if (usedIds.has(r.id)) return false
          if (!passesTime(r) || !passesCuisine(r) || !passesSoir(r)) return false
          const p = detecterProteine(r.nom)
          if (proteinesJour.has(p) && p !== 'autre') return false
          return true
        }

        const filterMin = (r: Recette) =>
          !usedIds.has(r.id) && passesCuisine(r) && passesSoir(r)

        let candidates = pool.filter(filterFull)
        if (!candidates.length) candidates = pool.filter(filterRelaxed)
        if (!candidates.length) candidates = pool.filter(filterMin)
        if (!candidates.length) continue

        const rec = pickWeighted(candidates, protWeek, vegNeeded > 0 && !mustVeg, repas === 'dejeuner' ? 400 : 600)
        const prot = detecterProteine(rec.nom)

        usedIds.add(rec.id)
        proteinesJour.add(prot)
        protWeek[prot] = (protWeek[prot] ?? 0) + 1
        if (prot === 'vegetal') vegCount++
        if (estLourd(rec)) lourdsJour++
        if (MOTS_LOURD.slice(0,2).some(m => rec.nom.toLowerCase().includes(m))) tajineCount++

        if (!generated[jour]) generated[jour] = {}
        generated[jour]![repas] = rec
      }
    }

    setSlots(generated)
    setGenerating(false)
  }

  // ── Régénérer un slot ──────────────────────────────────────────────────────
  const regenererSlot = (jour: string, repas: Repas) => {
    const { maxMin, cuisinesOnly } = getSlotConfig(jour, repas)
    const proteinesJour = new Set(
      REPAS.filter(r => r !== repas && slots[jour]?.[r])
           .map(r => detecterProteine(slots[jour]![r]!.nom))
    )
    const usedIds = new Set(
      Object.entries(slots).flatMap(([, d]) => d ? Object.values(d).map(r => r?.id ?? '') : []).filter(Boolean)
    )
    const passesCuisine = (r: Recette) => !cuisinesOnly || cuisinesOnly.includes(r.cuisine)
    const passesSoir    = (r: Recette) => !CUISINES_SOIR_ONLY.has(r.cuisine) || repas === 'diner' || JOURS_WEEKEND.has(jour)

    let candidates = pool.filter(r => {
      if (usedIds.has(r.id)) return false
      const t = totalMin(r); if (t > 0 && t > maxMin) return false
      if (!passesCuisine(r) || !passesSoir(r)) return false
      const p = detecterProteine(r.nom)
      if (proteinesJour.has(p) && p !== 'autre') return false
      return true
    })
    if (!candidates.length) candidates = pool.filter(r => !usedIds.has(r.id) && passesCuisine(r) && passesSoir(r))
    if (!candidates.length) return

    const rec = pickWeighted(candidates, {})
    setSlots(prev => ({ ...prev, [jour]: { ...(prev[jour] ?? {}), [repas]: rec } }))
  }

  // ── Valider / Sauvegarder ──────────────────────────────────────────────────
  const valider = async () => {
    if (!Object.keys(slots).length) return
    setSaving(true)

    const jours: Record<string, DayMenu> = {}
    for (const jour of JOURS) {
      jours[jour] = {
        dejeuner: slots[jour]?.dejeuner?.id ?? undefined,
        diner:    slots[jour]?.diner?.id    ?? undefined,
      }
    }

    const { data: saved, error } = await supabase
      .from('menus')
      .upsert({ famille_id: FAMILLE_ID, semaine, jours }, { onConflict: 'famille_id,semaine' })
      .select('id').single()

    if (!error && saved) {
      setMenuId(saved.id)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    }
    setSaving(false)
  }

  const nbFilled = Object.values(slots).reduce((s, d) => s + (d?.dejeuner ? 1 : 0) + (d?.diner ? 1 : 0), 0)

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📅 Menus de la semaine</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Planifiez vos repas · Printemps 🌱
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-2">
          <button onClick={() => setSemaine(s => addWeeks(s, -1))} className="text-gray-500 hover:text-green-700 font-bold text-lg px-1">‹</button>
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Sem. du {formatSemaine(semaine)}</span>
          <button onClick={() => setSemaine(s => addWeeks(s, 1))} className="text-gray-500 hover:text-green-700 font-bold text-lg px-1">›</button>
        </div>
      </div>

      {/* Structure */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Structure du repas</p>
        <div className="flex flex-wrap gap-2">
          {[
            { v: 'plat',                 l: 'Plat seul' },
            { v: 'entree_plat',          l: 'Entrée + Plat' },
            { v: 'plat_dessert',         l: 'Plat + Dessert' },
            { v: 'entree_plat_dessert',  l: 'Entrée + Plat + Dessert' },
          ].map(s => (
            <button key={s.v} onClick={() => setStructure(s.v as Structure)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                structure === s.v ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >{s.l}</button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <button onClick={genererTout} disabled={generating || !pool.length}
          className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {generating ? <span className="spinner" /> : '✨'} Générer tout
        </button>
        <button onClick={valider} disabled={saving || nbFilled === 0}
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
        <span className="text-sm text-gray-400 ml-auto">{nbFilled}/14 repas</span>
      </div>

      {/* Grille */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="spinner text-green-700" /></div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* En-têtes jours */}
            <div className="grid grid-cols-8 gap-2 mb-2">
              <div />
              {JOURS.map(jour => {
                const calJour = REPAS.reduce((sum, r) => {
                  const rec = slots[jour]?.[r as Repas]
                  return sum + (rec?.calories ?? 0)
                }, 0)
                const dot = calJour === 0 ? null : calJour < 900 ? '🟢' : calJour < 1600 ? '🟠' : '🔴'
                return (
                  <div key={jour} className={`col-span-1 text-center text-xs font-bold uppercase tracking-wide py-2 ${JOURS_WEEKEND.has(jour) ? 'text-orange-500' : 'text-gray-600'}`}>
                    {JOURS_LABELS[jour].slice(0, 3)}
                    {dot
                      ? <span className="block text-[9px] normal-case font-normal">{dot} {calJour} kcal</span>
                      : JOURS_WEEKEND.has(jour) && <span className="block text-orange-300 text-[9px] normal-case font-normal">W-E</span>
                    }
                  </div>
                )
              })}
            </div>

            {/* Lignes repas */}
            {(['dejeuner','diner'] as const).map(repas => (
              <div key={repas} className="grid grid-cols-8 gap-2 mb-2">
                <div className="flex items-center">
                  <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{REPAS_LABELS[repas]}</span>
                </div>
                {JOURS.map(jour => {
                  const rec = slots[jour]?.[repas]
                  const { nbPersonnes } = getSlotConfig(jour, repas)
                  return (
                    <div key={jour} className="col-span-1">
                      {rec ? (
                        <div className="relative group">
                          <button
                            onClick={() => regenererSlot(jour, repas)}
                            title="Régénérer"
                            className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-green-700 hover:border-green-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs shadow"
                          >↻</button>
                          {(() => {
                            const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji:'🍴', bgClass:'bg-gray-50 border-gray-200', colorClass:'text-gray-500' }
                            return (
                              <div
                                className={`rounded-lg border p-1.5 min-h-[72px] cursor-pointer hover:brightness-95 transition-all ${cfg.bgClass}`}
                                onClick={() => setModal(rec)}
                              >
                                <p className={`text-[9px] font-medium mb-0.5 ${cfg.colorClass}`}>
                                  {cfg.emoji} {estSaisonnier(rec) && '🌱'}
                                </p>
                                <p className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2">{rec.nom}</p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  {totalMin(rec) > 0 && <span className="text-[9px] text-gray-400">⏱{totalMin(rec)}'</span>}
                                  {rec.calories > 0  && <span className="text-[9px] text-gray-400">{rec.calories}kcal</span>}
                                  <span className="text-[9px] text-gray-400">👤{nbPersonnes}</span>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      ) : (
                        <button
                          onClick={() => regenererSlot(jour, repas)}
                          className="w-full min-h-[72px] rounded-xl border-2 border-dashed border-gray-200 text-gray-300 hover:border-green-400 hover:text-green-500 transition-colors text-xs flex items-center justify-center"
                        >
                          +
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

      {!loading && nbFilled === 0 && pool.length > 0 && (
        <div className="text-center py-8 bg-white rounded-2xl border border-gray-200">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-gray-500 mb-4">Aucun menu généré pour cette semaine.</p>
          <button onClick={genererTout} className="inline-flex items-center gap-2 bg-green-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-green-800 transition-colors">
            ✨ Générer le menu de la semaine
          </button>
        </div>
      )}

      {modal && <RecetteModal recette={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

// ── Modal recette ─────────────────────────────────────────────────────────────

function RecetteModal({ recette: r, onClose }: { recette: Recette; onClose: () => void }) {
  const cfg = CUISINE_CONFIG[r.cuisine] ?? { emoji:'🍴', bgClass:'bg-gray-50 border-gray-200', colorClass:'text-gray-600' }
  const { astuces, variante } = getAstuces(r)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {r.photo_url && (
          <div className="w-full h-48 overflow-hidden rounded-t-3xl sm:rounded-t-2xl bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.photo_url} alt={r.nom} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-bold text-gray-800 leading-tight">{r.nom}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${cfg.bgClass} ${cfg.colorClass}`}>
                  {cfg.emoji} {r.cuisine}
                </span>
                {estSaisonnier(r) && (
                  <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full">🌱 De saison ({SAISON_ACTUELLE})</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none flex-shrink-0">×</button>
          </div>

          {/* Méta */}
          <div className="flex flex-wrap gap-2 mb-5 text-sm">
            {totalMin(r) > 0    && <span className="bg-gray-50 border border-gray-200 px-3 py-1 rounded-full text-gray-600">⏱ {totalMin(r)} min</span>}
            {r.personnes > 0    && <span className="bg-gray-50 border border-gray-200 px-3 py-1 rounded-full text-gray-600">👤 {r.personnes} pers.</span>}
            {r.calories > 0     && <span className="bg-gray-50 border border-gray-200 px-3 py-1 rounded-full text-gray-600">🔥 {r.calories} kcal</span>}
            {r.niveau_epices    && (
              <span className={`px-3 py-1 rounded-full border text-xs font-medium ${
                r.niveau_epices === 'doux'   ? 'bg-green-50 text-green-700 border-green-200' :
                r.niveau_epices === 'fort'   ? 'bg-red-50 text-red-700 border-red-200' :
                                               'bg-orange-50 text-orange-700 border-orange-200'
              }`}>{r.niveau_epices}</span>
            )}
          </div>

          {/* Ingrédients */}
          {r.ingredients.length > 0 && (
            <div className="mb-5">
              <h3 className="font-bold text-gray-700 mb-3">Ingrédients</h3>
              <ul className="space-y-1.5">
                {r.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                    <span>
                      {[ing.quantite, ing.unite, ing.nom].filter(Boolean).join('\u00a0')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructions */}
          {r.instructions.length > 0 ? (
            <div className="mb-5">
              <h3 className="font-bold text-gray-700 mb-3">Préparation</h3>
              <ol className="space-y-3">
                {r.instructions.map((etape, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-700 text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="leading-relaxed pt-0.5">{etape}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic mb-5">Instructions non disponibles.</p>
          )}

          {/* Astuces & Variante */}
          {(astuces.length > 0 || variante) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              {astuces.length > 0 && (
                <div>
                  <h3 className="font-bold text-amber-800 mb-2 text-sm">💡 Astuces</h3>
                  <ul className="space-y-1">
                    {astuces.map((tip, i) => (
                      <li key={i} className="text-xs text-amber-700 flex gap-2">
                        <span className="flex-shrink-0">•</span><span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {variante && (
                <div>
                  <h3 className="font-bold text-amber-800 mb-1 text-sm">🔄 Variante</h3>
                  <p className="text-xs text-amber-700">{variante}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
