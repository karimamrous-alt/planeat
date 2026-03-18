'use client'

export const runtime = 'edge'

import { useState } from 'react'

interface Article {
  id: number
  nom: string
  quantite: string
  categorie: string
  coche: boolean
}

const articlesInitiaux: Article[] = [
  { id: 1,  nom: 'Poulet (1 kg)',          quantite: '1',   categorie: 'Viandes & Poissons', coche: false },
  { id: 2,  nom: 'Saumon (4 pavés)',        quantite: '1',   categorie: 'Viandes & Poissons', coche: false },
  { id: 3,  nom: 'Carottes',               quantite: '500g',categorie: 'Légumes',             coche: false },
  { id: 4,  nom: 'Courgettes',             quantite: '3',   categorie: 'Légumes',             coche: false },
  { id: 5,  nom: 'Tomates',               quantite: '6',   categorie: 'Légumes',             coche: false },
  { id: 6,  nom: 'Pâtes',                 quantite: '500g',categorie: 'Féculents',           coche: false },
  { id: 7,  nom: 'Riz basmati',            quantite: '500g',categorie: 'Féculents',           coche: false },
  { id: 8,  nom: 'Lait (demi-écrémé)',     quantite: '2 L', categorie: 'Produits laitiers',  coche: false },
  { id: 9,  nom: 'Yaourts nature',         quantite: '8',   categorie: 'Produits laitiers',  coche: false },
  { id: 10, nom: 'Pain de campagne',       quantite: '1',   categorie: 'Boulangerie',         coche: false },
  { id: 11, nom: 'Huile d\'olive',         quantite: '1',   categorie: 'Épicerie',            coche: false },
  { id: 12, nom: 'Boîtes de tomates pelées', quantite: '3', categorie: 'Épicerie',           coche: false },
]

const categories = ['Tous', 'Légumes', 'Viandes & Poissons', 'Féculents', 'Produits laitiers', 'Boulangerie', 'Épicerie']

export default function ListeDeCourses() {
  const [articles, setArticles] = useState<Article[]>(articlesInitiaux)
  const [filtreCategorie, setFiltreCategorie] = useState('Tous')
  const [nouvelArticle, setNouvelArticle] = useState('')

  const toggleCoche = (id: number) => {
    setArticles(articles.map((a) => a.id === id ? { ...a, coche: !a.coche } : a))
  }

  const supprimerArticle = (id: number) => {
    setArticles(articles.filter((a) => a.id !== id))
  }

  const ajouterArticle = () => {
    if (!nouvelArticle.trim()) return
    setArticles([...articles, {
      id: Date.now(),
      nom: nouvelArticle,
      quantite: '1',
      categorie: 'Épicerie',
      coche: false,
    }])
    setNouvelArticle('')
  }

  const articlesFiltres = filtreCategorie === 'Tous'
    ? articles
    : articles.filter((a) => a.categorie === filtreCategorie)

  const articlesCoche = articles.filter((a) => a.coche).length
  const totalArticles = articles.length

  const groupesParCategorie = articlesFiltres.reduce((acc, article) => {
    if (!acc[article.categorie]) acc[article.categorie] = []
    acc[article.categorie].push(article)
    return acc
  }, {} as Record<string, Article[]>)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🛒 Liste de courses
        </h1>
        <p className="text-gray-500">
          Votre liste de courses générée à partir des menus planifiés.
        </p>
      </div>

      {/* Progression */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">
            {articlesCoche} / {totalArticles} articles cochés
          </span>
          <span className="text-sm font-bold text-green-700">
            {totalArticles > 0 ? Math.round((articlesCoche / totalArticles) * 100) : 0} %
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${totalArticles > 0 ? (articlesCoche / totalArticles) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Ajouter un article */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={nouvelArticle}
            onChange={(e) => setNouvelArticle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ajouterArticle()}
            placeholder="Ajouter un article..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={ajouterArticle}
            className="bg-green-700 text-white px-5 py-2 rounded-lg hover:bg-green-800 transition-colors font-medium"
          >
            + Ajouter
          </button>
        </div>
      </div>

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

      {/* Liste par catégorie */}
      <div className="space-y-4">
        {Object.entries(groupesParCategorie).map(([categorie, items]) => (
          <div key={categorie} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                {categorie} ({items.length})
              </h3>
            </div>
            <ul className="divide-y divide-gray-50">
              {items.map((article) => (
                <li
                  key={article.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={article.coche}
                    onChange={() => toggleCoche(article.id)}
                    className="w-5 h-5 accent-green-600 cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${article.coche ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {article.nom}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{article.quantite}</span>
                  <button
                    onClick={() => supprimerArticle(article.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {articlesCoche > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setArticles(articles.filter((a) => !a.coche))}
            className="text-sm text-red-400 hover:text-red-600 transition-colors"
          >
            Supprimer les articles cochés ({articlesCoche})
          </button>
        </div>
      )}
    </div>
  )
}
