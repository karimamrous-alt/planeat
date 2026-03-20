'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, CUISINE_CONFIG, etoiles } from '@/lib/utils'
import type { Recette, Favori } from '@/lib/types'

type FavoriAvecRecette = Favori & { recette: Recette }

// ── Modal détail ──────────────────────────────────────────────────────────────

function ModalFavori({ fav, onClose, onDelete, onNoteChange }: {
  fav: FavoriAvecRecette
  onClose: () => void
  onDelete: () => void
  onNoteChange: (note: number) => void
}) {
  const rec = fav.recette
  const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji: '🍴', colorClass: 'text-gray-600', bgClass: 'bg-gray-50 border-gray-200' }
  const total = rec.temps_prep + rec.temps_cuisson
  const lignes = rec.ingredients.map(i => [i.quantite, i.unite, i.nom].filter(Boolean).join('\u00a0'))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
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
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          {/* Note */}
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Ma note</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => onNoteChange(n)}
                  className={`text-xl transition-transform hover:scale-110 ${n <= (fav.note ?? 0) ? 'text-yellow-400' : 'text-gray-200'}`}>★</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {lignes.length > 0 && (
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">Ingrédients</h3>
              <ul className="space-y-1.5">
                {lignes.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">•</span><span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          {fav.variantes && (
            <div className="p-5">
              <h3 className="font-semibold text-gray-700 mb-1 text-sm">🔄 Mes variantes</h3>
              <p className="text-xs text-gray-600 italic">{fav.variantes}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button onClick={onDelete}
            className="w-full bg-red-50 text-red-600 font-semibold py-3 rounded-xl hover:bg-red-100 border border-red-200 transition-colors">
            🗑 Retirer des favoris
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Favoris() {
  const [favoris, setFavoris]             = useState<FavoriAvecRecette[]>([])
  const [loading, setLoading]             = useState(true)
  const [filtreCuisine, setFiltreCuisine] = useState('Tous')
  const [recherche, setRecherche]         = useState('')
  const [selected, setSelected]           = useState<FavoriAvecRecette | null>(null)

  // Ajout via recherche
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<Recette[]>([])
  const [searching, setSearching]         = useState(false)
  const [addingId, setAddingId]           = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('favoris')
      .select('*, recette:recettes(*)')
      .eq('famille_id', FAMILLE_ID)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setFavoris((data ?? []).filter(f => f.recette) as FavoriAvecRecette[])
        setLoading(false)
      })
  }, [])

  const supprimerFavori = async (fav: FavoriAvecRecette) => {
    await supabase.from('favoris').delete().eq('id', fav.id)
    setSelected(null)
    setFavoris(prev => prev.filter(f => f.id !== fav.id))
  }

  const handleNote = async (fav: FavoriAvecRecette, note: number) => {
    await supabase.from('favoris').update({ note }).eq('id', fav.id)
    const updated = { ...fav, note }
    setFavoris(prev => prev.map(f => f.id === fav.id ? updated : f))
    setSelected(updated)
  }

  const rechercherRecettes = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('recettes').select('*').ilike('nom', `%${q}%`).limit(8)
    const favRecetteIds = new Set(favoris.map(f => f.recette_id))
    setSearchResults((data ?? []).filter((r: Recette) => !favRecetteIds.has(r.id)))
    setSearching(false)
  }

  const ajouterFavori = async (recette: Recette) => {
    setAddingId(recette.id)
    const { data } = await supabase
      .from('favoris')
      .insert({ famille_id: FAMILLE_ID, recette_id: recette.id })
      .select('*, recette:recettes(*)').single()
    if (data) {
      setFavoris(prev => [data as FavoriAvecRecette, ...prev])
      setSearchQuery('')
      setSearchResults([])
    }
    setAddingId(null)
  }

  const filtres = ['Tous', ...Object.keys(CUISINE_CONFIG)]
  const favorisFiltres = favoris.filter(f => {
    const matchC = filtreCuisine === 'Tous' || f.recette?.cuisine === filtreCuisine
    const matchR = !recherche || f.recette?.nom?.toLowerCase().includes(recherche.toLowerCase())
    return matchC && matchR
  })

  if (loading) return (
    <div className="flex items-center justify-center h-48"><div className="spinner text-green-700" /></div>
  )

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">❤️ Plats favoris</h1>
        <p className="text-gray-500 text-sm mt-0.5">{favoris.length} recette{favoris.length !== 1 ? 's' : ''} sauvegardée{favoris.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Ajouter un favori */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-3">Ajouter un plat favori</p>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); rechercherRecettes(e.target.value) }}
            placeholder="Rechercher une recette par nom..."
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {searching && <span className="absolute right-3 top-3 spinner text-gray-400" style={{ width: '1rem', height: '1rem' }} />}
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {searchResults.map(r => {
              const cfg = CUISINE_CONFIG[r.cuisine]
              const total = r.temps_prep + r.temps_cuisson
              return (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.nom}</p>
                    <p className="text-xs text-gray-400">{cfg?.emoji} {r.cuisine}{total > 0 ? ` · ${total} min` : ''}</p>
                  </div>
                  <button
                    onClick={() => ajouterFavori(r)}
                    disabled={addingId === r.id}
                    className="text-green-700 hover:text-green-900 font-bold text-lg transition-colors disabled:opacity-50"
                  >
                    {addingId === r.id ? <span className="spinner text-green-700" style={{ width: '1rem', height: '1rem' }} /> : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recherche & Filtres */}
      <input
        type="text"
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        placeholder="🔍 Filtrer mes favoris..."
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
      />
      <div className="flex gap-2 flex-wrap">
        {filtres.map(f => (
          <button key={f} onClick={() => setFiltreCuisine(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtreCuisine === f ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f === 'Tous' ? 'Tous' : `${CUISINE_CONFIG[f]?.emoji} ${f}`}
          </button>
        ))}
      </div>

      {/* Grille */}
      {favorisFiltres.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">{favoris.length === 0 ? '❤️' : '🔍'}</p>
          <p className="text-gray-400">
            {favoris.length === 0 ? 'Aucun favori pour l\'instant. Cherchez une recette ci-dessus !' : 'Aucun résultat pour ces filtres.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorisFiltres.map(f => {
            const r = f.recette
            if (!r) return null
            const cfg = CUISINE_CONFIG[r.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-600' }
            const total = r.temps_prep + r.temps_cuisson
            return (
              <button key={f.id} onClick={() => setSelected(f)}
                className="text-left bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] w-full">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-800 leading-tight flex-1 pr-2 text-sm">{r.nom}</h3>
                  <span className="text-pink-400 text-lg flex-shrink-0">❤️</span>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${cfg.bgClass} ${cfg.colorClass} mb-3`}>
                  {cfg.emoji} {r.cuisine}
                </span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {total > 0 && <span>⏱ {total} min</span>}
                  {r.personnes > 0 && <span>👤 {r.personnes} pers.</span>}
                </div>
                {f.note != null && f.note > 0 && (
                  <p className="text-yellow-400 text-sm mt-2">{etoiles(f.note)}</p>
                )}
                {r.tags && r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <ModalFavori
          fav={selected}
          onClose={() => setSelected(null)}
          onDelete={() => supprimerFavori(selected)}
          onNoteChange={note => handleNote(selected, note)}
        />
      )}
    </div>
  )
}
