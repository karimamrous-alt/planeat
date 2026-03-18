'use client'

export const runtime = 'edge'

import { useState } from 'react'

const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const platExemples: Record<string, { dejeuner: string; diner: string }> = {
  Lundi:    { dejeuner: 'Poulet rôti aux légumes', diner: 'Soupe de légumes et pain' },
  Mardi:    { dejeuner: 'Pasta bolognaise',        diner: 'Omelette aux fines herbes' },
  Mercredi: { dejeuner: 'Quiche lorraine',          diner: 'Salade composée' },
  Jeudi:    { dejeuner: 'Saumon grillé et riz',    diner: 'Velouté de potiron' },
  Vendredi: { dejeuner: 'Steak frites',             diner: 'Pizza maison' },
  Samedi:   { dejeuner: 'Couscous maison',          diner: 'Plateau de fromages' },
  Dimanche: { dejeuner: 'Rôti de bœuf dominical',  diner: 'Restes du déjeuner' },
}

export default function Menus() {
  const [menuSemaine, setMenuSemaine] = useState<Record<string, { dejeuner: string; diner: string }>>({})
  const [genere, setGenere] = useState(false)

  const genererMenu = () => {
    setMenuSemaine(platExemples)
    setGenere(true)
  }

  const reinitialiser = () => {
    setMenuSemaine({})
    setGenere(false)
  }

  const modifierRepas = (jour: string, repas: 'dejeuner' | 'diner', valeur: string) => {
    setMenuSemaine((prev) => ({
      ...prev,
      [jour]: { ...prev[jour], [repas]: valeur },
    }))
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📅 Génération de menus
        </h1>
        <p className="text-gray-500">
          Générez un menu équilibré pour la semaine adapté aux préférences de votre famille.
        </p>
      </div>

      {/* Options */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-700 mb-4">Options du menu</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre de personnes</label>
            <select className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500">
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} personnes</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Budget hebdomadaire</label>
            <select className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500">
              <option>Économique (&lt; 80 €)</option>
              <option>Moyen (80–150 €)</option>
              <option>Confortable (&gt; 150 €)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Type de cuisine</label>
            <select className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500">
              <option>Cuisine française</option>
              <option>Cuisine du monde</option>
              <option>Végétarienne</option>
              <option>Rapide et facile</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={genererMenu}
            className="flex items-center gap-2 bg-green-700 text-white px-8 py-3 rounded-xl font-semibold hover:bg-green-800 transition-colors"
          >
            ✨ Générer le menu
          </button>
          {genere && (
            <button
              onClick={reinitialiser}
              className="px-6 py-3 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Grille du menu */}
      {genere && (
        <div>
          <h2 className="text-lg font-bold text-gray-700 mb-4">Menu de la semaine</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {jours.map((jour) => (
              <div key={jour} className="bg-white rounded-2xl border border-gray-200 p-4">
                <h3 className="font-bold text-green-700 mb-3 text-center border-b border-gray-100 pb-2">
                  {jour}
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase mb-1">🌞 Déjeuner</p>
                    <input
                      type="text"
                      value={menuSemaine[jour]?.dejeuner || ''}
                      onChange={(e) => modifierRepas(jour, 'dejeuner', e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase mb-1">🌙 Dîner</p>
                    <input
                      type="text"
                      value={menuSemaine[jour]?.diner || ''}
                      onChange={(e) => modifierRepas(jour, 'diner', e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors">
              🛒 Générer la liste de courses
            </button>
            <button className="flex items-center gap-2 border border-gray-300 text-gray-600 px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors">
              💾 Sauvegarder ce menu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
