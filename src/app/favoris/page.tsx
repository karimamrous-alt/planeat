'use client'

import { useState } from 'react'

interface Plat {
  id: number
  nom: string
  categorie: string
  temps: string
  note: number
  tags: string[]
  favori: boolean
}

const platsInitiaux: Plat[] = [
  { id: 1,  nom: 'Bœuf bourguignon',      categorie: 'Plat principal', temps: '3h',    note: 5, tags: ['Mijote', 'Hiver'],       favori: true },
  { id: 2,  nom: 'Tarte aux pommes',       categorie: 'Dessert',        temps: '1h',    note: 5, tags: ['Sucré', 'Classique'],    favori: true },
  { id: 3,  nom: 'Pasta carbonara',        categorie: 'Plat principal', temps: '20 min',note: 4, tags: ['Rapide', 'Pâtes'],       favori: true },
  { id: 4,  nom: 'Soupe à l\'oignon',      categorie: 'Entrée',         temps: '45 min',note: 4, tags: ['Hiver', 'Réconfort'],    favori: true },
  { id: 5,  nom: 'Poulet basquaise',       categorie: 'Plat principal', temps: '1h',    note: 4, tags: ['Mijote', 'Légumes'],     favori: true },
  { id: 6,  nom: 'Mousse au chocolat',     categorie: 'Dessert',        temps: '20 min',note: 5, tags: ['Chocolat', 'Rapide'],    favori: true },
]

const categories = ['Tous', 'Entrée', 'Plat principal', 'Dessert']

export default function PlatisFavoris() {
  const [plats, setPlats] = useState<Plat[]>(platsInitiaux)
  const [filtreCategorie, setFiltreCategorie] = useState('Tous')
  const [recherche, setRecherche] = useState('')
  const [nouveauPlat, setNouveauPlat] = useState({ nom: '', categorie: 'Plat principal', temps: '' })
  const [afficherFormulaire, setAfficherFormulaire] = useState(false)

  const toggleFavori = (id: number) => {
    setPlats(plats.map((p) => p.id === id ? { ...p, favori: !p.favori } : p))
  }

  const supprimerPlat = (id: number) => {
    setPlats(plats.filter((p) => p.id !== id))
  }

  const ajouterPlat = () => {
    if (!nouveauPlat.nom.trim()) return
    setPlats([...plats, {
      id: Date.now(),
      nom: nouveauPlat.nom,
      categorie: nouveauPlat.categorie,
      temps: nouveauPlat.temps || '?',
      note: 5,
      tags: [],
      favori: true,
    }])
    setNouveauPlat({ nom: '', categorie: 'Plat principal', temps: '' })
    setAfficherFormulaire(false)
  }

  const platsFiltres = plats.filter((p) => {
    const matchCategorie = filtreCategorie === 'Tous' || p.categorie === filtreCategorie
    const matchRecherche = p.nom.toLowerCase().includes(recherche.toLowerCase())
    return matchCategorie && matchRecherche
  })

  const etoiles = (note: number) => '⭐'.repeat(note)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          ❤️ Plats favoris
        </h1>
        <p className="text-gray-500">
          Tous les plats que votre famille adore, au même endroit.
        </p>
      </div>

      {/* Barre de recherche + bouton ajouter */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un plat..."
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={() => setAfficherFormulaire(!afficherFormulaire)}
          className="bg-green-700 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-green-800 transition-colors"
        >
          + Ajouter
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {afficherFormulaire && (
        <div className="bg-white rounded-2xl border border-green-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-700 mb-4">Nouveau plat favori</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              value={nouveauPlat.nom}
              onChange={(e) => setNouveauPlat({ ...nouveauPlat, nom: e.target.value })}
              placeholder="Nom du plat"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <select
              value={nouveauPlat.categorie}
              onChange={(e) => setNouveauPlat({ ...nouveauPlat, categorie: e.target.value })}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option>Entrée</option>
              <option>Plat principal</option>
              <option>Dessert</option>
            </select>
            <input
              type="text"
              value={nouveauPlat.temps}
              onChange={(e) => setNouveauPlat({ ...nouveauPlat, temps: e.target.value })}
              placeholder="Temps de préparation"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={ajouterPlat}
              className="bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 transition-colors font-medium"
            >
              Ajouter aux favoris
            </button>
            <button
              onClick={() => setAfficherFormulaire(false)}
              className="border border-gray-300 text-gray-600 px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap mb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFiltreCategorie(cat)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              filtreCategorie === cat
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grille de plats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platsFiltres.map((plat) => (
          <div key={plat.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-800 mb-1">{plat.nom}</h3>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {plat.categorie}
                </span>
              </div>
              <button
                onClick={() => toggleFavori(plat.id)}
                className="text-2xl hover:scale-110 transition-transform"
              >
                {plat.favori ? '❤️' : '🤍'}
              </button>
            </div>

            <div className="flex items-center gap-3 mb-3 text-sm text-gray-500">
              <span>⏱️ {plat.temps}</span>
              <span>{etoiles(plat.note)}</span>
            </div>

            {plat.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {plat.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-gray-50">
              <button className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
                Ajouter au menu
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => supprimerPlat(plat.id)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {platsFiltres.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🍽️</p>
          <p>Aucun plat trouvé. Ajoutez vos premiers favoris !</p>
        </div>
      )}
    </div>
  )
}
