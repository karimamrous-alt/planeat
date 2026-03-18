'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, CUISINE_CONFIG, etoiles } from '@/lib/utils'
import type { Recette } from '@/lib/types'

interface FavoriAvecRecette {
  id: string
  recette_id: string
  note: number | null
  commentaire: string | null
  created_at: string
  recette: Recette
}

export default function Favoris() {
  const [favoris, setFavoris]             = useState<FavoriAvecRecette[]>([])
  const [loading, setLoading]             = useState(true)
  const [filtreCuisine, setFiltreCuisine] = useState('Tous')
  const [recherche, setRecherche]         = useState('')
  const [removing, setRemoving]           = useState<string | null>(null)

  // Ajout via recherche
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<Recette[]>([])
  const [searching, setSearching]        = useState(false)
  const [addingId, setAddingId]          = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('favoris')
      .select('*, recette:recettes(*)')
      .eq('famille_id', FAMILLE_ID)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setFavoris((data ?? []) as unknown as FavoriAvecRecette[])
        setLoading(false)
      })
  }, [])

  const supprimerFavori = async (favoriId: string) => {
    setRemoving(favoriId)
    await supabase.from('favoris').delete().eq('id', favoriId)
    setFavoris(prev => prev.filter(f => f.id !== favoriId))
    setRemoving(null)
  }

  const rechercherRecettes = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('recettes').select('*')
      .ilike('nom', `%${q}%`).limit(8)
    const favRecetteIds = new Set(favoris.map(f => f.recette_id))
    setSearchResults((data ?? []).filter(r => !favRecetteIds.has(r.id)))
    setSearching(false)
  }

  const ajouterFavori = async (recette: Recette) => {
    setAddingId(recette.id)
    const { data } = await supabase
      .from('favoris')
      .insert({ famille_id: FAMILLE_ID, recette_id: recette.id, note: 5 })
      .select('*, recette:recettes(*)').single()
    if (data) {
      setFavoris(prev => [data as unknown as FavoriAvecRecette, ...prev])
      setSearchResults(prev => prev.filter(r => r.id !== recette.id))
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
      {/* En-tête */}
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
          {searching && <span className="absolute right-3 top-3 spinner text-gray-400" style={{width:'1rem',height:'1rem'}} />}
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {searchResults.map(r => {
              const cfg = CUISINE_CONFIG[r.cuisine]
              return (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.nom}</p>
                    <p className="text-xs text-gray-400">{cfg?.emoji} {r.cuisine} · {r.temps_prep || '?'}</p>
                  </div>
                  <button
                    onClick={() => ajouterFavori(r)}
                    disabled={addingId === r.id}
                    className="text-green-700 hover:text-green-900 font-bold text-lg transition-colors disabled:opacity-50"
                  >
                    {addingId === r.id ? <span className="spinner text-green-700" style={{width:'1rem',height:'1rem'}} /> : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recherche & Filtres */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Filtrer mes favoris..."
          className="flex-1 min-w-48 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {filtres.map(f => (
          <button
            key={f}
            onClick={() => setFiltreCuisine(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtreCuisine === f
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
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
            {favoris.length === 0
              ? 'Aucun favori pour l\'instant. Cherchez une recette ci-dessus !'
              : 'Aucun résultat pour ces filtres.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorisFiltres.map(f => {
            const r = f.recette
            if (!r) return null
            const cfg = CUISINE_CONFIG[r.cuisine] ?? { emoji: '🍴', bgClass: 'bg-gray-50 border-gray-200', colorClass: 'text-gray-600' }
            return (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 pr-2">
                    <h3 className="font-bold text-gray-800 leading-tight">{r.nom}</h3>
                  </div>
                  <button
                    onClick={() => supprimerFavori(f.id)}
                    disabled={removing === f.id}
                    className="text-gray-300 hover:text-red-500 transition-colors text-xl leading-none flex-shrink-0"
                    title="Retirer des favoris"
                  >
                    {removing === f.id ? <span className="spinner text-red-400" style={{width:'1rem',height:'1rem'}} /> : '❤️'}
                  </button>
                </div>

                {/* Badge cuisine */}
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${cfg.bgClass} ${cfg.colorClass} mb-3`}>
                  {cfg.emoji} {r.cuisine}
                </span>

                {/* Infos */}
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  {r.temps_prep && <span>⏱ {r.temps_prep}</span>}
                  {r.difficulte && (
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      r.difficulte === 'facile' ? 'bg-green-100 text-green-700' :
                      r.difficulte === 'difficile' ? 'bg-red-100 text-red-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>{r.difficulte}</span>
                  )}
                </div>

                {/* Note */}
                {f.note && (
                  <p className="text-yellow-500 text-sm">{etoiles(f.note)}</p>
                )}

                {/* Tags */}
                {r.tags && r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}

                {/* Commentaire */}
                {f.commentaire && (
                  <p className="text-xs text-gray-400 italic mt-2">&ldquo;{f.commentaire}&rdquo;</p>
                )}

                {/* Lien source */}
                {r.source_url && (
                  <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline mt-2 block">
                    Voir la recette →
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
