'use client'

export const runtime = 'edge'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FAMILLE_ID, getMondayOfWeek, formatSemaine, ALL_SLOTS, consolidateIngredients } from '@/lib/utils'
import type { ArticleCourses } from '@/lib/types'

// Extrait les IDs recette d'une valeur de slot (UUID simple ou JSON multi-cours)
function slotIds(val: unknown): string[] {
  if (typeof val !== 'string' || !val) return []
  if (val.startsWith('{')) {
    try { return Object.values(JSON.parse(val) as Record<string, string>).filter(Boolean) }
    catch { return [] }
  }
  return [val]
}

interface ListeCourses {
  id: string
  ingredients_consolides: ArticleCourses[]
  articles_manuels: ArticleCourses[]
  menu_id: string | null
}

export default function ListeDeCourses() {
  const semaine = getMondayOfWeek()
  const [liste, setListe]     = useState<ListeCourses | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasMenu, setHasMenu] = useState(false)
  const [saving, setSaving]   = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const { data: menu } = await supabase
        .from('menus').select('*')
        .eq('famille_id', FAMILLE_ID).eq('semaine', semaine).maybeSingle()

      if (!menu) { setHasMenu(false); setLoading(false); return }
      setHasMenu(true)

      const { data: existante } = await supabase
        .from('liste_courses').select('*').eq('menu_id', menu.id).maybeSingle()

      if (existante) { setListe(existante); setLoading(false); return }

      // Créer depuis les recettes du menu (gère les slots multi-cours)
      const ids = [...new Set(ALL_SLOTS.flatMap(s => slotIds((menu as Record<string, unknown>)[s])))]
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

  const sauvegarder = useCallback((updated: ListeCourses) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await supabase.from('liste_courses').update({
        ingredients_consolides: updated.ingredients_consolides,
        articles_manuels: updated.articles_manuels,
      }).eq('id', updated.id)
      setSaving(false)
    }, 400)
  }, [])

  const toggleCoche = (nom: string) => {
    if (!liste) return
    // Chercher dans consolidated d'abord, sinon manuels
    const inConsolidated = liste.ingredients_consolides.some(a => a.nom === nom)
    const field = inConsolidated ? 'ingredients_consolides' : 'articles_manuels'
    const updated: ListeCourses = {
      ...liste,
      [field]: liste[field].map(a => a.nom === nom ? { ...a, coche: !a.coche } : a),
    }
    setListe(updated)
    sauvegarder(updated)
  }

  const supprimerCoches = () => {
    if (!liste) return
    const updated: ListeCourses = {
      ...liste,
      ingredients_consolides: liste.ingredients_consolides.filter(a => !a.coche),
      articles_manuels: liste.articles_manuels.filter(a => !a.coche),
    }
    setListe(updated)
    sauvegarder(updated)
  }

  // Fusionner et trier alphabétiquement
  const articles = liste
    ? [...liste.ingredients_consolides, ...liste.articles_manuels]
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))
    : []

  const nbCoches = articles.filter(a => a.coche).length
  const pct = articles.length > 0 ? Math.round((nbCoches / articles.length) * 100) : 0

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
        {saving && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <span className="spinner text-gray-400" style={{ width: '0.9rem', height: '0.9rem' }} />
            Sauvegarde...
          </span>
        )}
      </div>

      {/* Progression */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">{nbCoches} / {articles.length} articles cochés</span>
          <span className="text-sm font-bold text-green-700">{pct} %</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {pct === 100 && articles.length > 0 && (
          <p className="text-green-600 text-sm font-medium mt-2 text-center">🎉 Tous les articles cochés !</p>
        )}
      </div>

      {/* Liste alphabétique */}
      {articles.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {articles.map(article => (
              <li
                key={article.nom}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => toggleCoche(article.nom)}
              >
                <input
                  type="checkbox"
                  checked={article.coche}
                  onChange={() => toggleCoche(article.nom)}
                  onClick={e => e.stopPropagation()}
                  className="w-4 h-4 accent-green-600 cursor-pointer flex-shrink-0 rounded"
                />
                <span className={`flex-1 text-sm ${article.coche ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {[article.quantite, article.unite, article.nom].filter(Boolean).join(' ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400 text-sm">Aucun ingrédient dans la liste.</p>
        </div>
      )}

      {nbCoches > 0 && (
        <button onClick={supprimerCoches} className="text-sm text-red-400 hover:text-red-600 transition-colors">
          Supprimer les articles cochés ({nbCoches})
        </button>
      )}
    </div>
  )
}
