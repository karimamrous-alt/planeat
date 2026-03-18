'use client'

import { useState } from 'react'

const regimesDisponibles = [
  'Végétarien', 'Végétalien', 'Sans gluten', 'Sans lactose',
  'Halal', 'Casher', 'Sans porc', 'Faible en sel',
]

interface MembreFamille {
  id: number
  prenom: string
  age: string
  regimes: string[]
  allergies: string
}

export default function ProfilFamille() {
  const [membres, setMembres] = useState<MembreFamille[]>([
    { id: 1, prenom: 'Parent 1', age: '', regimes: [], allergies: '' },
  ])
  const [nomFamille, setNomFamille] = useState('')
  const [sauvegarde, setSauvegarde] = useState(false)

  const ajouterMembre = () => {
    setMembres([...membres, {
      id: Date.now(),
      prenom: '',
      age: '',
      regimes: [],
      allergies: '',
    }])
  }

  const supprimerMembre = (id: number) => {
    setMembres(membres.filter((m) => m.id !== id))
  }

  const mettreAJourMembre = (id: number, champ: keyof MembreFamille, valeur: string | string[]) => {
    setMembres(membres.map((m) => m.id === id ? { ...m, [champ]: valeur } : m))
  }

  const toggleRegime = (membreId: number, regime: string) => {
    const membre = membres.find((m) => m.id === membreId)
    if (!membre) return
    const nouveauxRegimes = membre.regimes.includes(regime)
      ? membre.regimes.filter((r) => r !== regime)
      : [...membre.regimes, regime]
    mettreAJourMembre(membreId, 'regimes', nouveauxRegimes)
  }

  const sauvegarder = () => {
    setSauvegarde(true)
    setTimeout(() => setSauvegarde(false), 3000)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          👨‍👩‍👧‍👦 Profil famille
        </h1>
        <p className="text-gray-500">
          Configurez les membres de votre famille et leurs préférences alimentaires.
        </p>
      </div>

      {/* Nom de famille */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-700 mb-4">Votre famille</h2>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Nom de la famille
        </label>
        <input
          type="text"
          value={nomFamille}
          onChange={(e) => setNomFamille(e.target.value)}
          placeholder="Ex : Famille Dupont"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Membres */}
      <div className="space-y-4 mb-6">
        {membres.map((membre, index) => (
          <div key={membre.id} className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-700">
                Membre {index + 1}
              </h2>
              {membres.length > 1 && (
                <button
                  onClick={() => supprimerMembre(membre.id)}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  Supprimer
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Prénom</label>
                <input
                  type="text"
                  value={membre.prenom}
                  onChange={(e) => mettreAJourMembre(membre.id, 'prenom', e.target.value)}
                  placeholder="Prénom"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Âge</label>
                <input
                  type="number"
                  value={membre.age}
                  onChange={(e) => mettreAJourMembre(membre.id, 'age', e.target.value)}
                  placeholder="Âge"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Régimes alimentaires
              </label>
              <div className="flex flex-wrap gap-2">
                {regimesDisponibles.map((regime) => (
                  <button
                    key={regime}
                    onClick={() => toggleRegime(membre.id, regime)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      membre.regimes.includes(regime)
                        ? 'bg-green-100 border-green-400 text-green-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {regime}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Allergies ou intolérances
              </label>
              <input
                type="text"
                value={membre.allergies}
                onChange={(e) => mettreAJourMembre(membre.id, 'allergies', e.target.value)}
                placeholder="Ex : arachides, fruits de mer..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={ajouterMembre}
          className="flex items-center gap-2 border-2 border-dashed border-gray-300 text-gray-500 px-6 py-3 rounded-xl hover:border-green-400 hover:text-green-600 transition-colors"
        >
          <span>+</span> Ajouter un membre
        </button>
        <button
          onClick={sauvegarder}
          className="flex items-center gap-2 bg-green-700 text-white px-8 py-3 rounded-xl font-semibold hover:bg-green-800 transition-colors"
        >
          {sauvegarde ? '✅ Sauvegardé !' : '💾 Sauvegarder'}
        </button>
      </div>
    </div>
  )
}
