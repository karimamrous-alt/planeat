'use client'

export const runtime = 'edge'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, CUISINE_CONFIG, getAstuces, estSaisonnier, getUnsplashPhoto } from '@/lib/utils'
import type { Recette, Cuisine, TypeRecette, Ingredient } from '@/lib/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

type IngrForm = { quantite: string; unite: string; nom: string }

const CUISINES: Cuisine[] = ['marocaine', 'française', 'italienne', 'végé', 'rapide', 'indienne']
const TYPES: TypeRecette[] = ['plat', 'soupe', 'salade']
const CUISINE_FILTERS = ['toutes', ...CUISINES] as const

/** Parse OCR text into structured recipe fields */
function parseOcrText(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1)
  let nom = ''
  const ingredients: IngrForm[] = []
  const instructions: string[] = []

  const UNITS = /(\d[\d,/.]*)\s*(g|kg|ml|cl|l|c\.s\.|c\.c\.|cs|cc|tasse|verre|pincée|sachet|boîte|tranche)/i
  const IS_STEP = /^(\d+[.)]\s*|[-•–]\s*)/

  let mode: 'header' | 'ingredients' | 'steps' = 'header'

  for (const line of lines) {
    if (!nom) { nom = line; continue }
    if (/ingr[ée]dients?/i.test(line)) { mode = 'ingredients'; continue }
    if (/pr[ée]paration|instructions?|[ée]tapes?|recette/i.test(line)) { mode = 'steps'; continue }

    if (mode === 'header') {
      if (UNITS.test(line)) { mode = 'ingredients' }
      else if (IS_STEP.test(line)) { mode = 'steps' }
    }

    if (mode === 'ingredients' || (mode === 'header' && UNITS.test(line))) {
      const m = line.match(/^([\d,/.]+)\s*([a-zA-Zéèê.]+)?\s+(.+)/)
      if (m) {
        ingredients.push({ quantite: m[1] || '', unite: m[2] || '', nom: m[3] || line })
      } else {
        ingredients.push({ quantite: '', unite: '', nom: line })
      }
    } else if (mode === 'steps' || IS_STEP.test(line)) {
      mode = 'steps'
      instructions.push(line.replace(/^(\d+[.)]\s*|[-•–]\s*)/, ''))
    }
  }

  return {
    nom,
    ingredients: ingredients.length > 0 ? ingredients : [{ quantite: '', unite: '', nom: '' }],
    instructions,
  }
}

// ── Parsing ingrédients (formats 750g scraper + manuel) ───────────────────────

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

// ── Carte recette ─────────────────────────────────────────────────────────────

function CarteRecette({ rec, onClick }: { rec: Recette; onClick: () => void }) {
  const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji: '🍴', colorClass: 'text-gray-600', bgClass: 'bg-gray-50 border-gray-200', ph: 'ph-default' }
  const total = rec.temps_prep + rec.temps_cuisson
  const [photoUrl, setPhotoUrl] = useState(rec.photo_url || '')
  useEffect(() => {
    if (!rec.photo_url) {
      getUnsplashPhoto(rec.nom).then(url => { if (url) setPhotoUrl(url) })
    }
  }, [rec.id, rec.nom, rec.photo_url])
  return (
    <button onClick={onClick}
      className="text-left rounded-3xl overflow-hidden transition-all hover:brightness-110 active:scale-[0.99] w-full"
      style={{ background: '#1C1C1C', boxShadow: '0 2px 20px rgba(0,0,0,0.4)' }}
    >
      {/* Photo */}
      <div className={`h-24 flex items-center justify-center text-4xl relative ${cfg.ph}`}>
        {photoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photoUrl} alt={rec.nom} className="w-full h-full object-cover" />
          : cfg.emoji
        }
        {estSaisonnier(rec) && (
          <span className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#15803D', color: '#fff' }}>🌱</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-bold mb-1" style={{ color: '#EF9F27' }}>{cfg.emoji} {rec.cuisine}</p>
        <p className="font-bold text-sm leading-snug line-clamp-2" style={{ color: '#FFFFFF' }}>{rec.nom}</p>
        <div className="flex flex-wrap gap-2 mt-1.5 text-xs" style={{ color: '#9A9A9A' }}>
          {total > 0 && <span>⏱ {total} min</span>}
          {rec.personnes > 0 && <span>👤 {rec.personnes}</span>}
          {rec.calories > 0 && <span>🔥 {rec.calories}</span>}
        </div>
        <p className="text-xs mt-1.5" style={{ color: '#9A9A9A' }}>
          {(() => { const n = parseIngredients(rec.ingredients).length; return `${n} ingrédient${n > 1 ? 's' : ''}` })()}
        </p>
      </div>
    </button>
  )
}

// ── Modal détail ──────────────────────────────────────────────────────────────

function ModalDetail({ rec, onClose, onToggleFavori, isFavori }: {
  rec: Recette; onClose: () => void; onToggleFavori: () => void; isFavori: boolean
}) {
  const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji: '🍴', colorClass: 'text-gray-600', bgClass: 'bg-gray-50 border-gray-200', ph: 'ph-default' }
  const { astuces, variante } = getAstuces(rec)
  const total = rec.temps_prep + rec.temps_cuisson
  const lignes = parseIngredients(rec.ingredients)
  const [photoUrl, setPhotoUrl] = useState(rec.photo_url || '')
  useEffect(() => {
    if (!rec.photo_url) {
      getUnsplashPhoto(rec.nom).then(url => { if (url) setPhotoUrl(url) })
    }
  }, [rec.id, rec.nom, rec.photo_url])

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ background:'#1C1C1C', borderRadius:'24px 24px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto', WebkitOverflowScrolling:'touch', overscrollBehavior:'contain', paddingBottom:'env(safe-area-inset-bottom)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
      >
        {/* Photo */}
        <div className={`h-40 rounded-t-4xl sm:rounded-t-3xl flex items-center justify-center text-5xl relative ${cfg.ph}`}>
          {photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photoUrl} alt={rec.nom} className="w-full h-full object-cover rounded-t-4xl sm:rounded-t-3xl" />
            : cfg.emoji
          }
          <button onClick={onToggleFavori}
            className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-xl shadow"
            style={{ background: 'rgba(28,28,28,0.85)' }}
          >
            {isFavori ? '❤️' : '🤍'}
          </button>
        </div>

        <div className="p-5 border-b" style={{ borderColor: '#333333' }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: '#EF9F27' }}>{cfg.emoji} {rec.cuisine}</p>
              <h2 className="font-display font-bold text-xl leading-tight" style={{ color: '#FFFFFF' }}>{rec.nom}</h2>
              <div className="flex flex-wrap gap-2 mt-2 text-xs" style={{ color: '#9A9A9A' }}>
                {total > 0 && <span>⏱ {total} min</span>}
                {rec.personnes > 0 && <span>👤 {rec.personnes} pers.</span>}
                {rec.calories > 0 && <span>🔥 {rec.calories} kcal</span>}
                {estSaisonnier(rec) && <span style={{ color: '#4ADE80' }}>🌱 De saison</span>}
              </div>
            </div>
            <button onClick={onClose} className="text-2xl flex-shrink-0 mt-1" style={{ color: '#9A9A9A' }}>×</button>
          </div>
        </div>

        <div>
          {lignes.length > 0 && (
            <div className="p-5 border-b" style={{ borderColor: '#333333' }}>
              <h3 className="font-bold text-sm mb-3" style={{ color: '#FFFFFF' }}>Ingrédients</h3>
              <ul className="space-y-1.5">
                {lignes.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#FFFFFF' }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#C8440A' }}>•</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rec.instructions.length > 0 && (
            <div className="p-5 border-b" style={{ borderColor: '#333333' }}>
              <h3 className="font-bold text-sm mb-3" style={{ color: '#FFFFFF' }}>Préparation</h3>
              <ol className="space-y-2">
                {rec.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm" style={{ color: '#FFFFFF' }}>
                    <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0" style={{ background: '#C8440A' }}>{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {(astuces.length > 0 || variante) && (
            <div className="p-5">
              {astuces.length > 0 && (
                <div className="mb-3">
                  <h3 className="font-bold text-sm mb-2" style={{ color: '#EF9F27' }}>💡 Astuces</h3>
                  {astuces.map((a, i) => (
                    <p key={i} className="text-xs mb-1" style={{ color: '#9A9A9A' }}>→ {a}</p>
                  ))}
                </div>
              )}
              {variante && (
                <div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: '#EF9F27' }}>🔄 Variante</h3>
                  <p className="text-xs" style={{ color: '#9A9A9A' }}>{variante}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal ajout recette (avec OCR) ────────────────────────────────────────────

function ModalAjout({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nom, setNom]               = useState('')
  const [cuisine, setCuisine]       = useState<Cuisine>('française')
  const [type, setType]             = useState<TypeRecette>('plat')
  const [tempsPrep, setTempsPrep]   = useState('')
  const [tempsCuisson, setTempsCuisson] = useState('')
  const [calories, setCalories]     = useState('')
  const [personnes, setPersonnes]   = useState('6')
  const [ingredients, setIngredients] = useState<IngrForm[]>([{ quantite: '', unite: '', nom: '' }])
  const [instructions, setInstructions] = useState([''])
  const [saving, setSaving]         = useState(false)

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrDone, setOcrDone]       = useState(false)
  const [preview, setPreview]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const addIngr = () => setIngredients(p => [...p, { quantite: '', unite: '', nom: '' }])
  const updIngr = (i: number, f: keyof IngrForm, v: string) =>
    setIngredients(p => p.map((x, j) => j === i ? { ...x, [f]: v } : x))
  const removeIngr = (i: number) => setIngredients(p => p.filter((_, j) => j !== i))

  const addStep = () => setInstructions(p => [...p, ''])
  const updStep = (i: number, v: string) => setInstructions(p => p.map((x, j) => j === i ? v : x))
  const removeStep = (i: number) => setInstructions(p => p.filter((_, j) => j !== i))

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setPreview(url)
    setOcrLoading(true)

    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('fra')
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()

      const parsed = parseOcrText(text as string)
      if (parsed.nom) setNom(parsed.nom)
      if (parsed.ingredients.length > 0) setIngredients(parsed.ingredients)
      if (parsed.instructions.length > 0) setInstructions(parsed.instructions)
      setOcrDone(true)
    } catch {
      // OCR failed silently — user can fill manually
    }
    setOcrLoading(false)
  }

  const handleSave = async () => {
    if (!nom.trim()) return
    setSaving(true)
    const ingrs: Ingredient[] = ingredients
      .filter(i => i.nom.trim())
      .map(i => ({ nom: i.nom.trim(), quantite: i.quantite || undefined, unite: i.unite || undefined }))
    const steps = instructions.filter(s => s.trim())
    await supabase.from('recettes').insert({
      nom: nom.trim(), cuisine, type,
      temps_prep: parseInt(tempsPrep) || 0,
      temps_cuisson: parseInt(tempsCuisson) || 0,
      calories: parseInt(calories) || 0,
      personnes: parseInt(personnes) || 6,
      ingredients: ingrs, instructions: steps,
      saison: [], tags: [], niveau_epices: 'doux',
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  const inputStyle = { borderColor: '#333333', background: '#2A2A2A', color: '#FFFFFF' }
  const labelStyle = { color: '#9A9A9A' }

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ background:'#1C1C1C', borderRadius:'24px 24px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto', WebkitOverflowScrolling:'touch', overscrollBehavior:'contain', paddingBottom:'env(safe-area-inset-bottom)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
      >
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: '#333333' }}>
          <h2 className="font-display font-bold text-xl" style={{ color: '#FFFFFF' }}>Nouvelle recette</h2>
          <button onClick={onClose} className="text-2xl" style={{ color: '#9A9A9A' }}>×</button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── OCR Section ── */}
          <div className="rounded-3xl overflow-hidden border-2 border-dashed" style={{ borderColor: '#C8440A' }}>
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Aperçu" className="w-full h-40 object-cover" />
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
                  {ocrLoading ? (
                    <div className="text-center text-white">
                      <div className="spinner mx-auto mb-2" />
                      <p className="text-xs font-bold">Analyse en cours…</p>
                    </div>
                  ) : ocrDone ? (
                    <div className="text-center text-white">
                      <p className="text-2xl mb-1">✅</p>
                      <p className="text-xs font-bold">Champs pré-remplis !</p>
                      <button onClick={() => { setPreview(null); setOcrDone(false) }}
                        className="mt-2 text-xs underline opacity-80">Changer de photo</button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full p-5 flex flex-col items-center gap-2"
              >
                <span className="text-4xl">📸</span>
                <p className="font-bold text-sm" style={{ color: '#C8440A' }}>Prendre une photo ou importer</p>
                <p className="text-xs" style={{ color: '#9A9A9A' }}>Le texte sera extrait automatiquement</p>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleOcr}
            />
          </div>

          {/* Nom */}
          <div>
            <label className="block text-xs font-bold mb-1" style={labelStyle}>Nom de la recette *</label>
            <input value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Ex : Tajine de poulet aux olives"
              className="w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none border"
              style={inputStyle}
            />
          </div>

          {/* Cuisine + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1" style={labelStyle}>Cuisine</label>
              <select value={cuisine} onChange={e => setCuisine(e.target.value as Cuisine)}
                className="w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none border"
                style={inputStyle}
              >
                {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={labelStyle}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as TypeRecette)}
                className="w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none border"
                style={inputStyle}
              >
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Temps + Personnes + Calories */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Prép. (min)',  val: tempsPrep,    set: setTempsPrep },
              { label: 'Cuisson (min)',val: tempsCuisson, set: setTempsCuisson },
              { label: 'Personnes',   val: personnes,    set: setPersonnes },
              { label: 'Calories',    val: calories,     set: setCalories },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-bold mb-1" style={labelStyle}>{f.label}</label>
                <input type="number" min="0" value={f.val} onChange={e => f.set(e.target.value)}
                  className="w-full rounded-2xl px-3 py-2 text-sm focus:outline-none border"
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          {/* Ingrédients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold" style={labelStyle}>Ingrédients</label>
              <button onClick={addIngr} className="text-xs font-bold" style={{ color: '#C8440A' }}>+ Ajouter</button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-1.5">
                  <input value={ing.quantite} onChange={e => updIngr(i, 'quantite', e.target.value)}
                    placeholder="Qté" className="w-14 rounded-xl px-2 py-1.5 text-xs border focus:outline-none"
                    style={inputStyle} />
                  <input value={ing.unite} onChange={e => updIngr(i, 'unite', e.target.value)}
                    placeholder="Unité" className="w-16 rounded-xl px-2 py-1.5 text-xs border focus:outline-none"
                    style={inputStyle} />
                  <input value={ing.nom} onChange={e => updIngr(i, 'nom', e.target.value)}
                    placeholder="Ingrédient" className="flex-1 rounded-xl px-2 py-1.5 text-xs border focus:outline-none"
                    style={inputStyle} />
                  {ingredients.length > 1 && (
                    <button onClick={() => removeIngr(i)} className="px-1" style={{ color: '#9A9A9A' }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold" style={labelStyle}>Étapes</label>
              <button onClick={addStep} className="text-xs font-bold" style={{ color: '#C8440A' }}>+ Étape</button>
            </div>
            <div className="space-y-2">
              {instructions.map((step, i) => (
                <div key={i} className="flex gap-1.5">
                  <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0 mt-1.5"
                    style={{ background: '#C8440A' }}>{i + 1}</span>
                  <textarea value={step} onChange={e => updStep(i, e.target.value)}
                    rows={2} placeholder="Décrivez cette étape…"
                    className="flex-1 rounded-xl px-2 py-1.5 text-xs border focus:outline-none resize-none"
                    style={inputStyle} />
                  {instructions.length > 1 && (
                    <button onClick={() => removeStep(i)} className="px-1" style={{ color: '#9A9A9A' }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: '#333333' }}>
          <button onClick={handleSave} disabled={saving || !nom.trim()}
            className="w-full text-white font-bold py-3.5 rounded-full transition-colors disabled:opacity-50"
            style={{ background: '#C8440A' }}
          >
            {saving ? '⏳ Enregistrement…' : '✓ Enregistrer la recette'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Recettes() {
  const [recettes, setRecettes]       = useState<Recette[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filtreCuisine, setFiltreCuisine] = useState('toutes')
  const [selected, setSelected]       = useState<Recette | null>(null)
  const [favorisIds, setFavorisIds]   = useState<Set<string>>(new Set())
  const [showAjout, setShowAjout]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: recs }, { data: favs }] = await Promise.all([
      supabase.from('recettes').select('*').order('nom'),
      supabase.from('favoris').select('recette_id').eq('famille_id', FAMILLE_ID),
    ])
    setRecettes(recs ?? [])
    setFavorisIds(new Set((favs ?? []).map((f: { recette_id: string }) => f.recette_id)))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggleFavori = async (rec: Recette) => {
    if (favorisIds.has(rec.id)) {
      await supabase.from('favoris').delete().eq('famille_id', FAMILLE_ID).eq('recette_id', rec.id)
      setFavorisIds(p => { const n = new Set(p); n.delete(rec.id); return n })
    } else {
      await supabase.from('favoris').insert({ famille_id: FAMILLE_ID, recette_id: rec.id })
      setFavorisIds(p => new Set([...p, rec.id]))
    }
  }

  const filtered = recettes.filter(r => {
    const matchCuisine = filtreCuisine === 'toutes' || r.cuisine === filtreCuisine
    const matchSearch  = !search || r.nom.toLowerCase().includes(search.toLowerCase())
    return matchCuisine && matchSearch
  })

  if (loading) return (
    <div className="flex justify-center h-48 items-center">
      <div className="spinner" style={{ color: '#C8440A' }} />
    </div>
  )

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: '#FFFFFF' }}>📖 Recettes</h1>
          <p className="text-sm mt-0.5" style={{ color: '#9A9A9A' }}>{recettes.length} recettes disponibles</p>
        </div>
        <button onClick={() => setShowAjout(true)}
          className="text-white font-bold px-4 py-2.5 rounded-full text-sm shadow"
          style={{ background: '#C8440A' }}
        >
          + Ajouter
        </button>
      </div>

      {/* OCR highlight button */}
      <button onClick={() => setShowAjout(true)}
        className="w-full flex items-center gap-3 p-4 rounded-3xl border-2 border-dashed transition-colors"
        style={{ borderColor: '#C8440A', background: 'rgba(200,68,10,0.06)' }}
      >
        <span className="text-3xl">📸</span>
        <div className="text-left">
          <p className="font-bold text-sm" style={{ color: '#C8440A' }}>Ajouter une recette par photo</p>
          <p className="text-xs" style={{ color: '#9A9A9A' }}>Prenez une photo, le texte est extrait automatiquement</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: '#C8440A' }}>›</span>
      </button>

      {/* Recherche */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une recette…"
          className="w-full rounded-full pl-11 pr-4 py-3 text-sm border focus:outline-none"
          style={{ borderColor: '#333333', background: '#1C1C1C', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        />
      </div>

      {/* Filtres cuisine */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CUISINE_FILTERS.map(c => {
          const cfg = CUISINE_CONFIG[c]
          const active = filtreCuisine === c
          return (
            <button key={c} onClick={() => setFiltreCuisine(c)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border"
              style={active
                ? { background: '#C8440A', color: '#fff', borderColor: '#C8440A' }
                : { background: '#1C1C1C', color: '#9A9A9A', borderColor: '#333333' }
              }
            >
              {cfg?.emoji} {c === 'toutes' ? 'Toutes' : c}
            </button>
          )
        })}
      </div>

      {/* Grille */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(rec => (
            <CarteRecette key={rec.id} rec={rec} onClick={() => setSelected(rec)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 rounded-3xl" style={{ background: '#1C1C1C', boxShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm" style={{ color: '#9A9A9A' }}>Aucune recette trouvée</p>
        </div>
      )}

      {selected && (
        <ModalDetail
          rec={selected}
          isFavori={favorisIds.has(selected.id)}
          onToggleFavori={() => toggleFavori(selected)}
          onClose={() => setSelected(null)}
        />
      )}

      {showAjout && (
        <ModalAjout onClose={() => setShowAjout(false)} onSaved={load} />
      )}
    </div>
  )
}
