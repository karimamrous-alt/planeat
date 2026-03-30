'use client'

export const runtime = 'edge'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import {
  FAMILLE_ID, getMondayOfWeek, addWeeks, formatSemaine,
  JOURS, JOURS_LABELS, REPAS, JOURS_WEEKEND,
  CUISINE_CONFIG, CUISINES_SOIR_ONLY, getSlotConfig,
  detecterProteine, estSaisonnier, getAstuces, SAISON_ACTUELLE,
} from '@/lib/utils'
import type { Recette, DayMenu } from '@/lib/types'

function parseIngredients(raw: unknown): string[] {
  if (!raw) return []
  const FILTER = /(personne|portion|icon|serving|weight)/i

  function extraireDepuisGroupe(groupe: Record<string, unknown>): string[] {
    if (!Array.isArray(groupe.ingredients)) return []
    return (groupe.ingredients as Record<string, unknown>[])
      .map(ing => String(ing.raw ?? ing.singular ?? ing.nom ?? ing.name ?? '').trim())
      .filter(t => t.length > 1 && !FILTER.test(t))
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.recipeRawgredients)) {
      return (obj.recipeRawgredients as Record<string, unknown>[]).flatMap(extraireDepuisGroupe)
    }
    if (Array.isArray(obj.ingredients)) {
      return extraireDepuisGroupe(obj)
    }
  }

  if (Array.isArray(raw)) {
    return (raw as unknown[]).flatMap(item => {
      if (typeof item === 'string') return FILTER.test(item) ? [] : [item.trim()]
      if (item && typeof item === 'object') {
        const i = item as Record<string, unknown>
        if (Array.isArray(i.ingredients)) return extraireDepuisGroupe(i)
        const text = String(i.raw ?? i.singular ?? i.nom ?? i.name ?? '').trim()
        return text && !FILTER.test(text) ? [text] : []
      }
      return []
    })
  }
  return []
}

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
  const ing = parseIngredients(r.ingredients).join(' ').toLowerCase()
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
    const protS   = 1 / (1 + (protWeek[prot] ?? 0))
    const vegS    = vegBoost && prot === 'vegetal' ? 0.3 : 0
    const calS    = r.calories > 0 ? Math.max(0, 0.1 - Math.abs(r.calories - targetCal) / 2000) : 0
    const saisonS = estSaisonnier(r) ? 0.2 : 0
    return { r, s: Math.random() * 0.5 + protS * 0.3 + vegS + calS + saisonS }
  })
  scored.sort((a, b) => b.s - a.s)
  return scored[0].r
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Menus() {
  const [semaine,    setSemaine]    = useState(getMondayOfWeek())
  const [structure,  setStructure]  = useState<Structure>('plat')
  const [pool,       setPool]       = useState<Recette[]>([])
  const [slots,      setSlots]      = useState<WeekSlots>({})
  const [menuId,     setMenuId]     = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [savedOk,    setSavedOk]    = useState(false)
  const [modal,      setModal]      = useState<Recette | null>(null)

  useEffect(() => {
    supabase.from('recettes').select('*').in('type', ['plat','soupe']).then(({ data }) => {
      setPool((data ?? []).filter(recetteValide))
    })
  }, [])

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

  // ── Génération ─────────────────────────────────────────────────────────────
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

        const passesTime    = (r: Recette) => { const t = totalMin(r); return t === 0 ? !JOURS_WEEKEND.has(jour) || repas === 'diner' : t <= maxMin }
        const passesCuisine = (r: Recette) => !cuisinesOnly || cuisinesOnly.includes(r.cuisine)
        const passesSoir    = (r: Recette) => !CUISINES_SOIR_ONLY.has(r.cuisine) || repas === 'diner' || JOURS_WEEKEND.has(jour)

        const filterFull = (r: Recette) => {
          if (usedIds.has(r.id)) return false
          if (!passesTime(r) || !passesCuisine(r) || !passesSoir(r)) return false
          const p = detecterProteine(r.nom)
          if (proteinesJour.has(p) && p !== 'autre') return false
          if (MAX_PROT_WEEK[p] && (protWeek[p] ?? 0) >= MAX_PROT_WEEK[p]) return false
          if (mustVeg && p !== 'vegetal') return false
          if (lourdsJour >= 1 && estLourd(r)) return false
          if (tajineCount >= MAX_TAJINES_WEEK && MOTS_LOURD.slice(0, 2).some(m => r.nom.toLowerCase().includes(m))) return false
          return true
        }
        const filterRelaxed = (r: Recette) => {
          if (usedIds.has(r.id)) return false
          if (!passesTime(r) || !passesCuisine(r) || !passesSoir(r)) return false
          const p = detecterProteine(r.nom)
          if (proteinesJour.has(p) && p !== 'autre') return false
          return true
        }
        const filterMin = (r: Recette) => !usedIds.has(r.id) && passesCuisine(r) && passesSoir(r)

        let candidates = pool.filter(filterFull)
        if (!candidates.length) candidates = pool.filter(filterRelaxed)
        if (!candidates.length) candidates = pool.filter(filterMin)
        if (!candidates.length) continue

        const rec  = pickWeighted(candidates, protWeek, vegNeeded > 0 && !mustVeg, repas === 'dejeuner' ? 400 : 600)
        const prot = detecterProteine(rec.nom)

        usedIds.add(rec.id)
        proteinesJour.add(prot)
        protWeek[prot] = (protWeek[prot] ?? 0) + 1
        if (prot === 'vegetal') vegCount++
        if (estLourd(rec)) lourdsJour++
        if (MOTS_LOURD.slice(0, 2).some(m => rec.nom.toLowerCase().includes(m))) tajineCount++

        if (!generated[jour]) generated[jour] = {}
        generated[jour]![repas] = rec
      }
    }

    setSlots(generated)
    setGenerating(false)
  }

  // ── Régénérer slot ─────────────────────────────────────────────────────────
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

  // ── Valider ────────────────────────────────────────────────────────────────
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
    <div className="fade-in space-y-5">

      {/* En-tête */}
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: '#2C1810' }}>
          📅 Menus de la semaine
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#8B5E3C' }}>
          {SAISON_ACTUELLE === 'printemps' ? '🌸' : SAISON_ACTUELLE === 'été' ? '☀️' : SAISON_ACTUELLE === 'automne' ? '🍂' : '❄️'} {SAISON_ACTUELLE.charAt(0).toUpperCase() + SAISON_ACTUELLE.slice(1)} · {nbFilled}/14 repas
        </p>
      </div>

      {/* Navigation semaine */}
      <div className="bg-white rounded-3xl px-4 py-3 flex items-center justify-between" style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}>
        <button
          onClick={() => setSemaine(s => addWeeks(s, -1))}
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-colors"
          style={{ background: '#FDF6F0', color: '#E8622A' }}
        >‹</button>
        <span className="text-sm font-bold" style={{ color: '#2C1810' }}>
          Semaine du {formatSemaine(semaine)}
        </span>
        <button
          onClick={() => setSemaine(s => addWeeks(s, 1))}
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-colors"
          style={{ background: '#FDF6F0', color: '#E8622A' }}
        >›</button>
      </div>

      {/* Structure repas */}
      <div className="bg-white rounded-3xl p-4" style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}>
        <p className="text-sm font-bold mb-3" style={{ color: '#2C1810' }}>Structure du repas</p>
        <div className="flex flex-wrap gap-2">
          {[
            { v: 'plat',                l: 'Plat seul' },
            { v: 'entree_plat',         l: 'Entrée + Plat' },
            { v: 'plat_dessert',        l: 'Plat + Dessert' },
            { v: 'entree_plat_dessert', l: 'Menu complet' },
          ].map(s => (
            <button key={s.v} onClick={() => setStructure(s.v as Structure)}
              className="px-4 py-2 rounded-full text-xs font-bold border transition-all"
              style={structure === s.v
                ? { background: '#E8622A', color: '#fff', borderColor: '#E8622A' }
                : { background: '#FDF6F0', color: '#8B5E3C', borderColor: '#F0E6DC' }
              }
            >{s.l}</button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <button onClick={genererTout} disabled={generating || !pool.length}
          className="inline-flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-full transition-colors disabled:opacity-50"
          style={{ background: '#E8622A' }}
        >
          {generating ? <span className="spinner" /> : '✨'} Générer tout
        </button>
        <button onClick={valider} disabled={saving || nbFilled === 0}
          className="inline-flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-full transition-colors disabled:opacity-50"
          style={{ background: '#F5A623' }}
        >
          {saving ? <span className="spinner" /> : savedOk ? '✅' : '💾'}
          {savedOk ? 'Sauvegardé !' : 'Valider'}
        </button>
        {menuId && (
          <Link href="/courses"
            className="inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-full border transition-colors"
            style={{ color: '#E8622A', borderColor: '#E8622A', background: 'rgba(232,98,42,0.06)' }}
          >
            🛒 Courses
          </Link>
        )}
      </div>

      {/* Grille planning */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="spinner" style={{ color: '#E8622A' }} />
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="min-w-[680px]">
            {/* En-têtes jours */}
            <div className="grid grid-cols-8 gap-1.5 mb-2">
              <div />
              {JOURS.map(jour => {
                const calJour = REPAS.reduce((sum, r) => sum + ((slots[jour]?.[r as Repas])?.calories ?? 0), 0)
                const dot = calJour === 0 ? null : calJour < 900 ? '🟢' : calJour < 1600 ? '🟠' : '🔴'
                const isWE = JOURS_WEEKEND.has(jour)
                return (
                  <div key={jour} className="text-center">
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${isWE ? '' : ''}`}
                      style={{ color: isWE ? '#E8622A' : '#8B5E3C' }}>
                      {JOURS_LABELS[jour].slice(0, 3)}
                    </p>
                    {dot
                      ? <p className="text-[9px]">{dot} {calJour}</p>
                      : isWE && <p className="text-[9px]" style={{ color: '#F5A623' }}>W-E</p>
                    }
                  </div>
                )
              })}
            </div>

            {/* Lignes repas */}
            {(['dejeuner', 'diner'] as const).map(repas => (
              <div key={repas} className="grid grid-cols-8 gap-1.5 mb-2">
                <div className="flex items-center">
                  <span className="text-[10px] font-bold" style={{ color: '#8B5E3C' }}>
                    {repas === 'dejeuner' ? '🌞' : '🌙'}
                  </span>
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
                            className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all"
                            style={{ border: '1.5px solid #E8622A', color: '#E8622A' }}
                          >↻</button>
                          {(() => {
                            const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-500', ph: 'ph-default' }
                            return (
                              <div
                                className="rounded-xl border cursor-pointer hover:brightness-95 transition-all overflow-hidden"
                                style={{ borderColor: 'transparent', boxShadow: '0 1px 6px rgba(44,24,16,0.10)' }}
                                onClick={() => setModal(rec)}
                              >
                                {/* Mini photo placeholder */}
                                <div className={`h-8 flex items-center justify-center text-base ${cfg.ph}`}>
                                  {cfg.emoji}{estSaisonnier(rec) ? '🌱' : ''}
                                </div>
                                <div className="p-1.5 bg-white">
                                  <p className="text-[10px] font-bold leading-tight line-clamp-2" style={{ color: '#2C1810' }}>{rec.nom}</p>
                                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                    {totalMin(rec) > 0 && <span className="text-[9px]" style={{ color: '#8B5E3C' }}>⏱{totalMin(rec)}&apos;</span>}
                                    <span className="text-[9px]" style={{ color: '#8B5E3C' }}>👤{nbPersonnes}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      ) : (
                        <button
                          onClick={() => regenererSlot(jour, repas)}
                          className="w-full min-h-[72px] rounded-xl border-2 border-dashed text-xs flex items-center justify-center transition-colors"
                          style={{ borderColor: '#F0E6DC', color: '#C4956A' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8622A'; (e.currentTarget as HTMLElement).style.color = '#E8622A' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#F0E6DC'; (e.currentTarget as HTMLElement).style.color = '#C4956A' }}
                        >+</button>
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
        <div className="text-center py-10 bg-white rounded-4xl" style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}>
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-sm mb-5" style={{ color: '#8B5E3C' }}>Aucun menu généré pour cette semaine.</p>
          <button onClick={genererTout}
            className="inline-flex items-center gap-2 text-white font-bold px-6 py-3 rounded-full"
            style={{ background: '#E8622A' }}
          >
            ✨ Générer le menu
          </button>
        </div>
      )}

      {modal && <RecetteModal recette={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

// ── Modal recette ─────────────────────────────────────────────────────────────

function RecetteModal({ recette: r, onClose }: { recette: Recette; onClose: () => void }) {
  const cfg = CUISINE_CONFIG[r.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-600', ph: 'ph-default' }
  const { astuces, variante } = getAstuces(r)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ background:'#fff', borderRadius:'24px 24px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto', WebkitOverflowScrolling:'touch', paddingBottom:'env(safe-area-inset-bottom)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        {/* Photo placeholder */}
        <div className={`h-44 rounded-t-4xl sm:rounded-t-3xl flex items-center justify-center text-6xl ${cfg.ph}`}>
          {r.photo_url
            ? <Image src={r.photo_url} alt={r.nom} fill className="object-cover rounded-t-4xl sm:rounded-t-3xl" />
            : cfg.emoji
          }
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 pr-3">
              <h2 className="font-display text-xl font-bold leading-tight" style={{ color: '#2C1810' }}>{r.nom}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${cfg.bgClass} ${cfg.colorClass}`}>
                  {cfg.emoji} {r.cuisine}
                </span>
                {estSaisonnier(r) && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full border" style={{ background: '#F0FDF4', color: '#4CAF50', borderColor: '#BBF7D0' }}>
                    🌱 De saison
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-2xl leading-none flex-shrink-0">×</button>
          </div>

          {/* Méta */}
          <div className="flex flex-wrap gap-2 mb-5">
            {totalMin(r) > 0 && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#FDF6F0', color: '#8B5E3C' }}>⏱ {totalMin(r)} min</span>
            )}
            {r.personnes > 0 && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#FDF6F0', color: '#8B5E3C' }}>👤 {r.personnes} pers.</span>
            )}
            {r.calories > 0 && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#FDF6F0', color: '#8B5E3C' }}>🔥 {r.calories} kcal</span>
            )}
            {r.niveau_epices && r.niveau_epices !== 'doux' && (
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${r.niveau_epices === 'fort' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                🌶 {r.niveau_epices}
              </span>
            )}
          </div>

          {/* Ingrédients */}
          {(() => { const lignes = parseIngredients(r.ingredients); return lignes.length > 0 && (
            <div className="mb-5">
              <h3 className="font-bold mb-3 text-sm" style={{ color: '#2C1810' }}>Ingrédients</h3>
              <ul className="space-y-1.5">
                {lignes.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#2C1810' }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#E8622A' }}>•</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )})()}

          {/* Instructions */}
          {r.instructions.length > 0 ? (
            <div className="mb-5">
              <h3 className="font-bold mb-3 text-sm" style={{ color: '#2C1810' }}>Préparation</h3>
              <ol className="space-y-3">
                {r.instructions.map((etape, i) => (
                  <li key={i} className="flex gap-3 text-sm" style={{ color: '#2C1810' }}>
                    <span className="flex-shrink-0 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold" style={{ background: '#E8622A' }}>{i + 1}</span>
                    <span className="leading-relaxed pt-0.5">{etape}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-sm italic mb-5" style={{ color: '#8B5E3C' }}>Instructions non disponibles.</p>
          )}

          {/* Astuces */}
          {(astuces.length > 0 || variante) && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              {astuces.length > 0 && (
                <div>
                  <h3 className="font-bold mb-2 text-sm" style={{ color: '#92400E' }}>💡 Astuces</h3>
                  <ul className="space-y-1">
                    {astuces.map((tip, i) => (
                      <li key={i} className="text-xs flex gap-2" style={{ color: '#B45309' }}>
                        <span className="flex-shrink-0">•</span><span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {variante && (
                <div>
                  <h3 className="font-bold mb-1 text-sm" style={{ color: '#92400E' }}>🔄 Variante</h3>
                  <p className="text-xs" style={{ color: '#B45309' }}>{variante}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
