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
  const cfg = CUISINE_CONFIG[rec.cuisine] ?? { emoji: '🍴', colorClass: 'text-gray-600', bgClass: 'bg-gray-50 border-gray-200', ph: 'ph-default' }
  const total = rec.temps_prep + rec.temps_cuisson
  const lignes = rec.ingredients.map(i => [i.quantite, i.unite, i.nom].filter(Boolean).join('\u00a0'))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-4xl sm:rounded-3xl shadow-card-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Photo placeholder */}
        <div className={`h-28 rounded-t-4xl sm:rounded-t-3xl flex items-center justify-center text-5xl ${cfg.ph}`}>
          {cfg.emoji}
        </div>

        <div className="p-5 border-b" style={{ borderColor: '#F0E6DC' }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-xs font-bold mb-1 ${cfg.colorClass}`}>{cfg.emoji} {rec.cuisine}</p>
              <h2 className="font-display font-bold text-lg leading-tight" style={{ color: '#2C1810' }}>{rec.nom}</h2>
              <div className="flex flex-wrap gap-3 text-xs mt-1" style={{ color: '#8B5E3C' }}>
                {total > 0 && <span>⏱ {total} min</span>}
                {rec.personnes > 0 && <span>👤 {rec.personnes} pers.</span>}
                {rec.calories > 0 && <span>🔥 {rec.calories} kcal</span>}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl mt-1">✕</button>
          </div>
          {/* Note */}
          <div className="mt-3">
            <p className="text-xs mb-1" style={{ color: '#8B5E3C' }}>Ma note</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => onNoteChange(n)}
                  className={`text-2xl transition-transform hover:scale-110 ${n <= (fav.note ?? 0) ? 'text-yellow-400' : 'text-gray-200'}`}>★</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {lignes.length > 0 && (
            <div className="p-5 border-b" style={{ borderColor: '#F0E6DC' }}>
              <h3 className="font-display font-bold mb-3 text-sm" style={{ color: '#2C1810' }}>Ingrédients</h3>
              <ul className="space-y-2">
                {lignes.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#2C1810' }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#E8622A' }}>•</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rec.instructions.length > 0 && (
            <div className="p-5 border-b" style={{ borderColor: '#F0E6DC' }}>
              <h3 className="font-display font-bold mb-3 text-sm" style={{ color: '#2C1810' }}>Préparation</h3>
              <ol className="space-y-3">
                {rec.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm" style={{ color: '#2C1810' }}>
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#E8622A' }}>{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {fav.variantes && (
            <div className="p-5">
              <h3 className="font-display font-bold mb-1 text-sm" style={{ color: '#2C1810' }}>🔄 Mes variantes</h3>
              <p className="text-xs italic" style={{ color: '#8B5E3C' }}>{fav.variantes}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t" style={{ borderColor: '#F0E6DC' }}>
          <button onClick={onDelete}
            className="w-full bg-red-50 text-red-600 font-semibold py-3 rounded-2xl hover:bg-red-100 border border-red-200 transition-colors">
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
    <div className="flex justify-center h-48 items-center">
      <div className="spinner" style={{ color: '#E8622A' }} />
    </div>
  )

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: '#2C1810' }}>❤️ Plats favoris</h1>
        <p className="text-sm mt-0.5" style={{ color: '#8B5E3C' }}>
          {favoris.length} recette{favoris.length !== 1 ? 's' : ''} sauvegardée{favoris.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Ajouter un favori */}
      <div className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}>
        <p className="font-bold text-sm mb-3" style={{ color: '#2C1810' }}>Ajouter un plat favori</p>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); rechercherRecettes(e.target.value) }}
            placeholder="Rechercher une recette par nom..."
            className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none border"
            style={{ borderColor: '#F0E6DC', color: '#2C1810', background: '#FDF6F0' }}
          />
          {searching && <span className="absolute right-3 top-3.5 spinner" style={{ width: '1rem', height: '1rem', color: '#8B5E3C' }} />}
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 rounded-2xl overflow-hidden border" style={{ borderColor: '#F0E6DC' }}>
            {searchResults.map(r => {
              const cfg = CUISINE_CONFIG[r.cuisine]
              const total = r.temps_prep + r.temps_cuisson
              return (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-orange-50 transition-colors" style={{ borderColor: '#F0E6DC' }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#2C1810' }}>{r.nom}</p>
                    <p className="text-xs" style={{ color: '#8B5E3C' }}>{cfg?.emoji} {r.cuisine}{total > 0 ? ` · ${total} min` : ''}</p>
                  </div>
                  <button
                    onClick={() => ajouterFavori(r)}
                    disabled={addingId === r.id}
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: '#E8622A' }}
                  >
                    {addingId === r.id ? <span className="spinner" style={{ width: '0.9rem', height: '0.9rem' }} /> : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recherche */}
      <input
        type="text"
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        placeholder="🔍 Filtrer mes favoris..."
        className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none border bg-white"
        style={{ borderColor: '#F0E6DC', color: '#2C1810' }}
      />

      {/* Filtres cuisine */}
      <div className="flex gap-2 flex-wrap">
        {filtres.map(f => (
          <button key={f} onClick={() => setFiltreCuisine(f)}
            className="px-3 py-1.5 rounded-full text-xs font-bold border transition-colors"
            style={filtreCuisine === f
              ? { background: '#E8622A', color: '#fff', borderColor: '#E8622A' }
              : { background: '#fff', color: '#8B5E3C', borderColor: '#F0E6DC' }
            }
          >
            {f === 'Tous' ? 'Tous' : `${CUISINE_CONFIG[f]?.emoji} ${f}`}
          </button>
        ))}
      </div>

      {/* Grille */}
      {favorisFiltres.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">{favoris.length === 0 ? '❤️' : '🔍'}</p>
          <p className="text-sm" style={{ color: '#8B5E3C' }}>
            {favoris.length === 0 ? 'Aucun favori pour l\'instant. Cherchez une recette ci-dessus !' : 'Aucun résultat pour ces filtres.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {favorisFiltres.map(f => {
            const r = f.recette
            if (!r) return null
            const cfg = CUISINE_CONFIG[r.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-600', ph: 'ph-default' }
            const total = r.temps_prep + r.temps_cuisson
            return (
              <button key={f.id} onClick={() => setSelected(f)}
                className="text-left bg-white rounded-3xl overflow-hidden transition-all hover:shadow-card-lg hover:scale-[1.01] active:scale-[0.99]"
                style={{ boxShadow: '0 2px 16px rgba(44,24,16,0.08)' }}
              >
                {/* Photo placeholder */}
                <div className={`h-20 flex items-center justify-center text-3xl relative ${cfg.ph}`}>
                  {cfg.emoji}
                  <span className="absolute top-2 right-3 text-lg">❤️</span>
                </div>
                <div className="p-4">
                  <p className={`text-xs font-bold mb-1 ${cfg.colorClass}`}>{cfg.emoji} {r.cuisine}</p>
                  <p className="font-bold text-sm leading-snug" style={{ color: '#2C1810' }}>{r.nom}</p>
                  <div className="flex gap-3 mt-1 text-xs" style={{ color: '#8B5E3C' }}>
                    {total > 0 && <span>⏱ {total} min</span>}
                    {r.personnes > 0 && <span>👤 {r.personnes} pers.</span>}
                  </div>
                  {f.note != null && f.note > 0 && (
                    <p className="text-yellow-400 text-sm mt-2">{etoiles(f.note)}</p>
                  )}
                  {r.tags && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#FDF6F0', color: '#8B5E3C' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
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
