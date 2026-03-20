'use client'

export const runtime = 'edge'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, CUISINE_CONFIG, getAstuces, etoiles } from '@/lib/utils'
import type { Recette, Cuisine, TypeRecette, Ingredient } from '@/lib/types'

// ── Carte recette ─────────────────────────────────────────────────────────────

function CarteRecette({ rec, onClick }: { rec: Recette; onClick: () => void }) {
  const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji: '🍴', colorClass: 'text-gray-600', bgClass: 'bg-gray-50 border-gray-200' }
  const total = rec.temps_prep + rec.temps_cuisson
  return (
    <button onClick={onClick}
      className={`text-left rounded-2xl border p-4 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] ${cfg.bgClass} w-full`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold mb-1 ${cfg.colorClass}`}>{cfg.emoji} {rec.cuisine}</p>
          <p className="font-bold text-gray-800 text-sm leading-snug line-clamp-2">{rec.nom}</p>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400">
            {total > 0 && <span>⏱ {total} min</span>}
            {rec.personnes > 0 && <span>👤 {rec.personnes} pers.</span>}
            {rec.calories > 0 && <span>🔥 {rec.calories} kcal</span>}
          </div>
        </div>
        <span className="text-gray-300 text-lg flex-shrink-0">›</span>
      </div>
      <p className="text-xs text-gray-400 mt-2">{rec.ingredients.length} ingrédient{rec.ingredients.length > 1 ? 's' : ''}</p>
    </button>
  )
}

// ── Modal détail ──────────────────────────────────────────────────────────────

function ModalDetail({ rec, onClose, onToggleFavori, isFavori }: {
  rec: Recette; onClose: () => void; onToggleFavori: () => void; isFavori: boolean
}) {
  const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji: '🍴', colorClass: 'text-gray-600', bgClass: 'bg-gray-50 border-gray-200' }
  const { astuces, variante } = getAstuces(rec)
  const total = rec.temps_prep + rec.temps_cuisson
  const lignes = rec.ingredients.map(i => [i.quantite, i.unite, i.nom].filter(Boolean).join('\u00a0'))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`p-5 rounded-t-3xl sm:rounded-t-2xl border-b ${cfg.bgClass}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-xs font-semibold mb-1 ${cfg.colorClass}`}>{cfg.emoji} {rec.cuisine}</p>
              <h2 className="font-bold text-gray-800 text-lg leading-tight">{rec.nom}</h2>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                {total > 0 && <span>⏱ {total} min</span>}
                {rec.personnes > 0 && <span>👤 {rec.personnes} pers.</span>}
                {rec.calories > 0 && <span>🔥 {rec.calories} kcal</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onToggleFavori} className="text-xl">{isFavori ? '❤️' : '🤍'}</button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Ingrédients */}
          {lignes.length > 0 && (
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">Ingrédients</h3>
              <ul className="space-y-1.5">
                {lignes.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructions */}
          {rec.instructions.length > 0 && (
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">Préparation</h3>
              <ol className="space-y-2">
                {rec.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700">
                    <span className="bg-green-100 text-green-700 font-bold rounded-full w-5 h-5 flex-shrink-0 flex items-center justify-center text-xs">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Astuces */}
          {(astuces.length > 0 || variante) && (
            <div className="p-5">
              {astuces.length > 0 && (
                <div className="mb-3">
                  <h3 className="font-semibold text-gray-700 mb-2 text-sm">💡 Astuces</h3>
                  <ul className="space-y-1">
                    {astuces.map((a, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="text-yellow-500 flex-shrink-0">→</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {variante && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1 text-sm">🔄 Variante</h3>
                  <p className="text-xs text-gray-600">{variante}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal ajout recette ───────────────────────────────────────────────────────

type IngrForm = { quantite: string; unite: string; nom: string }

const CUISINES: Cuisine[] = ['marocaine', 'française', 'italienne', 'végé', 'rapide']
const TYPES: TypeRecette[] = ['plat', 'soupe', 'salade']

function ModalAjout({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nom, setNom] = useState('')
  const [cuisine, setCuisine] = useState<Cuisine>('française')
  const [type, setType] = useState<TypeRecette>('plat')
  const [tempsPrep, setTempsPrep] = useState('')
  const [tempsCuisson, setTempsCuisson] = useState('')
  const [calories, setCalories] = useState('')
  const [personnes, setPersonnes] = useState('6')
  const [ingredients, setIngredients] = useState<IngrForm[]>([{ quantite: '', unite: '', nom: '' }])
  const [instructions, setInstructions] = useState([''])
  const [saving, setSaving] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrText, setOcrText] = useState('')
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
    setOcrLoading(true)
    try {
      // @ts-expect-error tesseract.js installed at runtime
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('fra')
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()
      setOcrText(text as string)
      // Parse simple: each line as ingredient
      const lines = (text as string).split('\n').map((l: string) => l.trim()).filter(Boolean)
      const parsed: IngrForm[] = lines.map((l: string) => ({ quantite: '', unite: '', nom: l }))
      if (parsed.length > 0) setIngredients(parsed)
    } catch {
      // tesseract not available or failed silently
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
    const { error } = await supabase.from('recettes').insert({
      nom: nom.trim(),
      cuisine,
      type,
      temps_prep: parseInt(tempsPrep) || 0,
      temps_cuisson: parseInt(tempsCuisson) || 0,
      calories: parseInt(calories) || 0,
      personnes: parseInt(personnes) || 6,
      ingredients: ingrs,
      instructions: steps,
      saison: [],
      tags: [],
      niveau_epices: 'doux',
    })
    setSaving(false)
    if (!error) { onSaved(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 text-lg">Nouvelle recette</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nom de la recette *</label>
            <input value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Ex : Tajine de poulet aux olives"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          {/* Cuisine + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Cuisine</label>
              <select value={cuisine} onChange={e => setCuisine(e.target.value as Cuisine)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value as TypeRecette)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Temps + Personnes + Calories */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Prép. (min)', val: tempsPrep, set: setTempsPrep },
              { label: 'Cuisson (min)', val: tempsCuisson, set: setTempsCuisson },
              { label: 'Personnes', val: personnes, set: setPersonnes },
              { label: 'Calories', val: calories, set: setCalories },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{f.label}</label>
                <input type="number" min="0" value={f.val} onChange={e => f.set(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            ))}
          </div>

          {/* OCR */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-700 mb-2">📷 Importer depuis une photo</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleOcr} />
            <button onClick={() => fileRef.current?.click()}
              disabled={ocrLoading}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {ocrLoading ? '⏳ Analyse en cours…' : '📷 Choisir une photo'}
            </button>
            {ocrText && <p className="text-xs text-blue-500 mt-2">✓ Texte détecté — ingrédients mis à jour</p>}
          </div>

          {/* Ingrédients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500">Ingrédients</label>
              <button onClick={addIngr} className="text-xs text-green-700 font-medium hover:text-green-800">+ Ajouter</button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-1.5">
                  <input value={ing.quantite} onChange={e => updIngr(i, 'quantite', e.target.value)}
                    placeholder="Qté" className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400" />
                  <input value={ing.unite} onChange={e => updIngr(i, 'unite', e.target.value)}
                    placeholder="Unité" className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400" />
                  <input value={ing.nom} onChange={e => updIngr(i, 'nom', e.target.value)}
                    placeholder="Ingrédient" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400" />
                  {ingredients.length > 1 && (
                    <button onClick={() => removeIngr(i)} className="text-gray-300 hover:text-red-400 text-sm px-1">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500">Étapes de préparation</label>
              <button onClick={addStep} className="text-xs text-green-700 font-medium hover:text-green-800">+ Étape</button>
            </div>
            <div className="space-y-2">
              {instructions.map((step, i) => (
                <div key={i} className="flex gap-1.5">
                  <span className="bg-green-100 text-green-700 font-bold rounded-full w-5 h-5 flex-shrink-0 flex items-center justify-center text-xs mt-1.5">{i + 1}</span>
                  <textarea value={step} onChange={e => updStep(i, e.target.value)}
                    rows={2} placeholder="Décrivez cette étape…"
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
                  {instructions.length > 1 && (
                    <button onClick={() => removeStep(i)} className="text-gray-300 hover:text-red-400 text-sm px-1">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button onClick={handleSave} disabled={saving || !nom.trim()}
            className="w-full bg-green-700 text-white font-bold py-3 rounded-xl hover:bg-green-800 disabled:opacity-50 transition-colors">
            {saving ? 'Enregistrement…' : '✓ Enregistrer la recette'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const CUISINE_FILTERS = ['toutes', ...Object.keys(CUISINE_CONFIG)] as const

export default function Recettes() {
  const [recettes, setRecettes] = useState<Recette[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtreCuisine, setFiltreCuisine] = useState('toutes')
  const [selected, setSelected] = useState<Recette | null>(null)
  const [favorisIds, setFavorisIds] = useState<Set<string>>(new Set())
  const [showAjout, setShowAjout] = useState(false)

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
    const matchSearch = !search || r.nom.toLowerCase().includes(search.toLowerCase())
    return matchCuisine && matchSearch
  })

  if (loading) return (
    <div className="flex justify-center h-48 items-center">
      <div className="spinner text-green-700" />
    </div>
  )

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📖 Recettes</h1>
          <p className="text-gray-500 text-sm">{recettes.length} recette{recettes.length > 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={() => setShowAjout(true)}
          className="bg-green-700 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-green-800 transition-colors text-sm">
          + Ajouter
        </button>
      </div>

      {/* Recherche */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher une recette…"
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />

      {/* Filtres cuisine */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CUISINE_FILTERS.map(c => {
          const cfg = CUISINE_CONFIG[c]
          const label = c === 'toutes' ? 'Toutes' : c
          const emoji = cfg?.emoji ?? ''
          return (
            <button key={c} onClick={() => setFiltreCuisine(c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                filtreCuisine === c
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {emoji} {label}
            </button>
          )
        })}
      </div>

      {/* Grille */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(rec => (
            <CarteRecette key={rec.id} rec={rec} onClick={() => setSelected(rec)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-400 text-sm">Aucune recette trouvée</p>
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
