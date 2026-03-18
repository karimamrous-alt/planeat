'use client'

export const runtime = 'edge'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, getMondayOfWeek, formatSemaine, ALL_SLOTS, consolidateIngredients } from '@/lib/utils'
import type { ArticleCourses } from '@/lib/types'

interface ListeCourses {
  id: string
  ingredients_consolides: ArticleCourses[]
  articles_manuels: ArticleCourses[]
  menu_id: string | null
}

const CATEGORIES_ORDER = [
  'Légumes', 'Viandes & Volailles', 'Poissons', 'Féculents & Céréales',
  'Produits laitiers', 'Œufs', 'Fruits & Noix', 'Épices & Aromates',
  'Épicerie & Condiments', 'Divers',
]

export default function ListeDeCourses() {
  const semaine = getMondayOfWeek()
  const [liste, setListe]           = useState<ListeCourses | null>(null)
  const [loading, setLoading]       = useState(true)
  const [hasMenu, setHasMenu]       = useState(false)
  const [filtreCategorie, setFiltreCategorie] = useState('Tous')
  const [nouvelArticle, setNouvelArticle]     = useState('')
  const [categorieManuelle, setCategorieManuelle] = useState('Divers')
  const [saving, setSaving]         = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Charger ou créer la liste ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // 1. Menu de la semaine
      const { data: menu } = await supabase
        .from('menus').select('*')
        .eq('famille_id', FAMILLE_ID).eq('semaine', semaine).maybeSingle()

      if (!menu) { setHasMenu(false); setLoading(false); return }
      setHasMenu(true)

      // 2. Liste existante ?
      const { data: existante } = await supabase
        .from('liste_courses').select('*').eq('menu_id', menu.id).maybeSingle()

      if (existante) { setListe(existante); setLoading(false); return }

      // 3. Créer la liste depuis les recettes du menu
      const ids = ALL_SLOTS.map(s => (menu as Record<string,unknown>)[s]).filter((id): id is string => typeof id === 'string')
      const { data: recs } = ids.length
        ? await supabase.from('recettes').select('*').in('id', ids)
        : { data: [] }

      const consolidated = consolidateIngredients(recs ?? [])
      const { data: nouvelle } = await supabase.from('liste_courses')
        .insert({ menu_id: menu.id, famille_id: FAMILLE_ID, semaine, ingredients_consolides: consolidated, articles_manuels: [] })
        .select('*').single()

      setListe(nouvelle)
      setLoading(false)
    }
    load()
  }, [semaine])

  // ── Sauvegarder (debounced) ────────────────────────────────────────────
  const sauvegarder = useCallback((updated: ListeCourses) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await supabase.from('liste_courses').update({
        ingredients_consolides: updated.ingredients_consolides,
        articles_manuels:       updated.articles_manuels,
      }).eq('id', updated.id)
      setSaving(false)
    }, 400)
  }, [])

  const toggleCoche = (nom: string, source: 'ingredients' | 'manuels') => {
    if (!liste) return
    const field = source === 'ingredients' ? 'ingredients_consolides' : 'articles_manuels'
    const updated: ListeCourses = {
      ...liste,
      [field]: liste[field].map(a => a.nom === nom ? { ...a, coche: !a.coche } : a),
    }
    setListe(updated)
    sauvegarder(updated)
  }

  const ajouterArticle = async () => {
    if (!liste || !nouvelArticle.trim()) return
    const nouv: ArticleCourses = { nom: nouvelArticle.trim(), quantite: '', unite: '', categorie: categorieManuelle, coche: false }
    const updated: ListeCourses = { ...liste, articles_manuels: [...liste.articles_manuels, nouv] }
    setListe(updated)
    sauvegarder(updated)
    setNouvelArticle('')
  }

  const supprimerCoches = () => {
    if (!liste) return
    const updated: ListeCourses = {
      ...liste,
      ingredients_consolides: liste.ingredients_consolides.filter(a => !a.coche),
      articles_manuels:       liste.articles_manuels.filter(a => !a.coche),
    }
    setListe(updated)
    sauvegarder(updated)
  }

  // ── Calculs ────────────────────────────────────────────────────────────
  const tousArticles = liste ? [...liste.ingredients_consolides, ...liste.articles_manuels] : []
  const nbCoches  = tousArticles.filter(a => a.coche).length
  const nbTotal   = tousArticles.length
  const pct       = nbTotal > 0 ? Math.round((nbCoches / nbTotal) * 100) : 0

  const articlesFiltres = filtreCategorie === 'Tous' ? tousArticles : tousArticles.filter(a => a.categorie === filtreCategorie)

  const categories = ['Tous', ...CATEGORIES_ORDER.filter(c => tousArticles.some(a => a.categorie === c))]

  const parCategorie = articlesFiltres.reduce<Record<string, ArticleCourses[]>>((acc, a) => {
    if (!acc[a.categorie]) acc[a.categorie] = []
    acc[a.categorie].push(a)
    return acc
  }, {})

  // ── Rendu ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-48"><div className="spinner text-green-700" /></div>
  )

  if (!hasMenu) return (
    <div className="text-center py-16 fade-in">
      <p className="text-5xl mb-4">🛒</p>
      <h2 className="text-xl font-bold text-gray-700 mb-2">Aucun menu pour cette semaine</h2>
      <p className="text-gray-400 mb-6">Générez et validez d&apos;abord votre menu de la semaine.</p>
      <Link href="/menus" className="inline-flex items-center gap-2 bg-green-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-green-800 transition-colors">
        📅 Aller aux menus
      </Link>
    </div>
  )

  return (
    <div className="fade-in space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🛒 Liste de courses</h1>
          <p className="text-gray-500 text-sm">Semaine du {formatSemaine(semaine)}</p>
        </div>
        {saving && <span className="text-xs text-gray-400 flex items-center gap-1"><span className="spinner text-gray-400" style={{width:'0.9rem',height:'0.9rem'}} /> Sauvegarde...</span>}
      </div>

      {/* Progression */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">{nbCoches} / {nbTotal} articles cochés</span>
          <span className="text-sm font-bold text-green-700">{pct} %</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {pct === 100 && nbTotal > 0 && (
          <p className="text-green-600 text-sm font-medium mt-2 text-center">🎉 Tous les articles cochés !</p>
        )}
      </div>

      {/* Ajouter un article */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-3">Ajouter un article</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={nouvelArticle}
            onChange={e => setNouvelArticle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ajouterArticle()}
            placeholder="Nom de l&apos;article..."
            className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <select
            value={categorieManuelle}
            onChange={e => setCategorieManuelle(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {CATEGORIES_ORDER.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={ajouterArticle} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors">
            + Ajouter
          </button>
        </div>
      </div>

      {/* Filtres catégories */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFiltreCategorie(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtreCategorie === cat
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Listes par catégorie */}
      <div className="space-y-4">
        {Object.entries(parCategorie).sort(([a], [b]) => CATEGORIES_ORDER.indexOf(a) - CATEGORIES_ORDER.indexOf(b)).map(([cat, items]) => (
          <div key={cat} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-700 text-sm">{cat}</h3>
              <span className="text-xs text-gray-400">{items.filter(a => a.coche).length}/{items.length}</span>
            </div>
            <ul className="divide-y divide-gray-50">
              {items.map(article => (
                <li key={article.nom} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={article.coche}
                    onChange={() => toggleCoche(article.nom, liste?.ingredients_consolides.some(a => a.nom === article.nom) ? 'ingredients' : 'manuels')}
                    className="w-4 h-4 accent-green-600 cursor-pointer flex-shrink-0 rounded"
                  />
                  <span className={`flex-1 text-sm ${article.coche ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {article.nom}
                  </span>
                  {article.quantite && (
                    <span className="text-xs text-gray-400">{article.quantite}{article.unite ? ` ${article.unite}` : ''}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {nbCoches > 0 && (
        <button onClick={supprimerCoches} className="text-sm text-red-400 hover:text-red-600 transition-colors">
          Supprimer les articles cochés ({nbCoches})
        </button>
      )}
    </div>
  )
}
