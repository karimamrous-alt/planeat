import type { Recette, ArticleCourses } from './types'

// ─── Constantes ────────────────────────────────────────────────────────────

export const FAMILLE_ID = 'e857128f-7da2-4e00-832e-58169161be40'

export const CUISINE_CONFIG: Record<string, { emoji: string; colorClass: string; bgClass: string }> = {
  marocaine: { emoji: '🇲🇦', colorClass: 'text-red-700',    bgClass: 'bg-red-50 border-red-200' },
  indienne:  { emoji: '🇮🇳', colorClass: 'text-orange-700', bgClass: 'bg-orange-50 border-orange-200' },
  afghane:   { emoji: '🇦🇫', colorClass: 'text-sky-700',    bgClass: 'bg-sky-50 border-sky-200' },
  italienne: { emoji: '🇮🇹', colorClass: 'text-green-700',  bgClass: 'bg-green-50 border-green-200' },
  française: { emoji: '🇫🇷', colorClass: 'text-blue-700',   bgClass: 'bg-blue-50 border-blue-200' },
}

export const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const
export const JOURS_LABELS: Record<string, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi',
  jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
}
export const REPAS = ['dejeuner', 'diner'] as const
export const REPAS_LABELS: Record<string, string> = { dejeuner: '🌞 Déjeuner', diner: '🌙 Dîner' }

export type Jour    = typeof JOURS[number]
export type Repas   = typeof REPAS[number]
export type SlotKey = `${Jour}_${Repas}`

export const ALL_SLOTS: SlotKey[] = JOURS.flatMap(j => REPAS.map(r => `${j}_${r}` as SlotKey))

// ─── Dates ─────────────────────────────────────────────────────────────────

export function getMondayOfWeek(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n * 7)
  return d.toISOString().split('T')[0]
}

export function formatSemaine(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateFr(date: Date = new Date()): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Temps de préparation ───────────────────────────────────────────────────

export function parseMinutes(temps: string | null | undefined): number {
  if (!temps) return 999
  const hMatch = temps.match(/(\d+)\s*h/i)
  const mMatch = temps.match(/(\d+)\s*min/i)
  const numOnly = temps.match(/^(\d+)$/)
  const h = hMatch ? parseInt(hMatch[1]) : 0
  const m = mMatch ? parseInt(mMatch[1]) : numOnly ? parseInt(numOnly[1]) : 0
  const total = h * 60 + m
  return total === 0 ? 999 : total
}

// ─── Calories ──────────────────────────────────────────────────────────────

export function parseCalories(cal: string | null | undefined): number {
  if (!cal) return 0
  const m = String(cal).match(/\d+/)
  return m ? parseInt(m[0]) : 0
}

// ─── Sélection aléatoire ───────────────────────────────────────────────────

export function pickRandom<T>(arr: T[], exclude: Set<string> = new Set(), getId: (t: T) => string = (t: unknown) => (t as { id: string }).id): T | null {
  const available = arr.filter(t => !exclude.has(getId(t)))
  if (!available.length) return arr[Math.floor(Math.random() * arr.length)] ?? null
  return available[Math.floor(Math.random() * available.length)]
}

// ─── Parsing d'ingrédients ─────────────────────────────────────────────────
// Accepte tout format (string, objet, JSON stringifié, tableau) et retourne
// toujours une liste propre de { nom, quantite, unite }.

export function parseIngredients(raw: unknown): Array<{ nom: string; quantite: string; unite: string }> {
  // Normaliser en tableau
  let items: unknown[]
  if (raw === null || raw === undefined) return []
  if (typeof raw === 'string') {
    const t = (raw as string).trim()
    if (!t) return []
    if (t.startsWith('[') || t.startsWith('{')) {
      try {
        const parsed = JSON.parse(t)
        items = Array.isArray(parsed) ? parsed : [parsed]
      } catch { items = [raw] }
    } else {
      items = [raw]
    }
  } else if (Array.isArray(raw)) {
    items = raw
  } else if (typeof raw === 'object') {
    items = [raw]
  } else {
    return []
  }

  const seen = new Set<string>()
  const result: Array<{ nom: string; quantite: string; unite: string }> = []

  for (const item of items) {
    // Dépaqueter les JSON stringifiés
    let obj: unknown = item
    if (typeof item === 'string') {
      const t = (item as string).trim()
      if (t.startsWith('{')) {
        try { obj = JSON.parse(t) } catch { obj = item }
      }
    }

    let nom = '', quantite = '', unite = ''

    if (typeof obj === 'string') {
      nom = (obj as string).trim()
    } else if (obj && typeof obj === 'object') {
      const o = obj as Record<string, unknown>
      nom      = String(o.nom      ?? o.name       ?? o.ingredient ?? '').trim()
      quantite = String(o.quantite ?? o.quantity    ?? o.qte        ?? o.amount ?? '').trim()
      unite    = String(o.unite    ?? o.unit        ?? o.mesure     ?? '').trim()
    }

    // Sanity checks
    if (!nom || nom.length < 2 || nom.length > 120) continue
    if (nom.startsWith('{') || nom.startsWith('[')) continue
    if (/\bicon\b/i.test(nom)) continue
    if (/^[\d\s.,/]+$/.test(nom)) continue  // chaîne purement numérique

    const key = nom.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) continue
    seen.add(key)

    result.push({ nom, quantite, unite })
  }

  return result
}

// ─── Catégorisation ingrédients ────────────────────────────────────────────

const CATEGORIES_KEYWORDS: [string, string[]][] = [
  ['Légumes', ['tomate', 'carotte', 'oignon', 'poivron', 'courgette', 'aubergine', 'poireau', 'épinard',
    'salade', 'concombre', 'ail', 'échalote', 'champignon', 'navet', 'haricot vert', 'brocoli', 'chou',
    'fenouil', 'céleri', 'artichaut', 'asperge', 'radis', 'betterave', 'maïs', 'petit pois', 'potiron',
    'courge', 'gombo', 'pak choi', 'fenugrec', 'menthe fraîche', 'coriandre fraîche']],
  ['Viandes & Volailles', ['poulet', 'bœuf', 'veau', 'dinde', 'canard', 'lapin',
    'kefta', 'steak', 'haché', 'escalope', 'blanc de poulet', 'cuisse', 'côte', 'rôti',
    'filet de bœuf', 'viande']],
  ['Poissons', ['saumon', 'thon', 'cabillaud', 'dorade', 'sole', 'merlan', 'truite', 'sardine',
    'maquereau', 'bar', 'crevette', 'moule', 'calmar', 'anchois']],
  ['Féculents & Céréales', ['pâtes', 'riz', 'semoule', 'boulgour', 'quinoa', 'lentille', 'pois chiche',
    'fève', 'haricot blanc', 'haricot rouge', 'farine', 'pain', 'couscous', 'pomme de terre',
    'patate douce', 'gnocchi', 'polenta', 'orge', 'épeautre']],
  ['Produits laitiers', ['lait', 'crème', 'beurre', 'fromage', 'yaourt', 'mozzarella', 'gruyère',
    'parmesan', 'ricotta', 'mascarpone', 'feta', 'emmental', 'cheddar', 'comté', 'labneh']],
  ['Œufs', ['œuf', 'oeuf']],
  ['Fruits & Noix', ['pomme', 'poire', 'banane', 'orange', 'citron', 'fraise', 'framboise', 'abricot',
    'pêche', 'raisin', 'ananas', 'mangue', 'avocat', 'olive', 'datte', 'figue', 'pruneaux',
    'noix', 'amande', 'noisette', 'pistache', 'cacahuète', 'raisin sec', 'abricots secs']],
  ['Épices & Aromates', ['sel', 'poivre', 'cumin', 'curcuma', 'gingembre', 'paprika', 'cannelle',
    'muscade', 'curry', 'ras el hanout', 'harissa', 'safran', 'anis', 'thym', 'romarin', 'basilic',
    'coriandre', 'persil', 'menthe', 'origan', 'laurier', 'cardamome', 'clou de girofle', 'badiane',
    'sumac', "za'atar", 'fenugrec']],
  ['Épicerie & Condiments', ['huile', 'vinaigre', 'moutarde', 'sauce soja', 'sucre', 'miel', 'fécule',
    'levure', 'bouillon', 'concentré de tomate', 'coulis', 'lait de coco', 'tahini', 'purée',
    'bicarbonate', 'extrait', 'vanille', 'chocolat', 'cacao', 'sirop']],
]

export function categoriserIngredient(nom: string): string {
  const lower = nom.toLowerCase()
  for (const [cat, keywords] of CATEGORIES_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cat
    }
  }
  return 'Divers'
}

// ─── Consolidation liste de courses ────────────────────────────────────────

export function consolidateIngredients(recettesList: Recette[]): ArticleCourses[] {
  const seen = new Map<string, ArticleCourses>()

  for (const recette of recettesList) {
    for (const ing of parseIngredients(recette.ingredients)) {
      const cle = ing.nom.toLowerCase().replace(/\s+/g, ' ')
      if (!seen.has(cle)) {
        seen.set(cle, {
          nom:       ing.nom,
          quantite:  ing.quantite,
          unite:     ing.unite,
          categorie: categoriserIngredient(ing.nom),
          coche:     false,
        })
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))
}

// ─── Affichage étoiles ─────────────────────────────────────────────────────

export function etoiles(score: number): string {
  const n = Math.round(score)
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}
