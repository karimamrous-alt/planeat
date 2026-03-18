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

export type Jour   = typeof JOURS[number]
export type Repas  = typeof REPAS[number]
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

// ─── Sélection aléatoire ───────────────────────────────────────────────────

export function pickRandom<T>(arr: T[], exclude: Set<string> = new Set(), getId: (t: T) => string = (t: unknown) => (t as { id: string }).id): T | null {
  const available = arr.filter(t => !exclude.has(getId(t)))
  if (!available.length) return arr[Math.floor(Math.random() * arr.length)] ?? null
  return available[Math.floor(Math.random() * available.length)]
}

// ─── Catégorisation ingrédients ────────────────────────────────────────────

const CATEGORIES_KEYWORDS: [string, string[]][] = [
  ['Légumes', ['tomate', 'carotte', 'oignon', 'poivron', 'courgette', 'aubergine', 'poireau', 'épinard',
    'salade', 'concombre', 'ail', 'échalote', 'champignon', 'navet', 'haricot vert', 'brocoli', 'chou',
    'fenouil', 'céleri', 'artichaut', 'asperge', 'radis', 'betterave', 'maïs', 'petit pois', 'potiron',
    'courge', 'gombo', 'pak choi', 'fenugrec', 'menthe fraîche', 'coriandre fraîche']],
  ['Viandes & Volailles', ['poulet', 'bœuf', 'veau', 'agneau', 'dinde', 'canard', 'lapin', 'merguez',
    'kefta', 'steak', 'haché', 'escalope', 'blanc de poulet', 'cuisse', 'gigot', 'côte', 'rôti',
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
    'sumac', 'za\'atar', 'fenugrec']],
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
    const ingredients = Array.isArray(recette.ingredients) ? recette.ingredients : []
    for (const ing of ingredients) {
      const nom = (typeof ing === 'string' ? ing : (ing as { nom?: string }).nom ?? '').trim()
      if (!nom || nom.length < 2) continue

      // Clé de déduplication : nom normalisé
      const cle = nom.toLowerCase().replace(/\s+/g, ' ')

      if (!seen.has(cle)) {
        seen.set(cle, {
          nom,
          quantite: typeof ing === 'object' ? String((ing as { quantite?: unknown }).quantite ?? '') : '',
          unite:    typeof ing === 'object' ? String((ing as { unite?: unknown }).unite ?? '') : '',
          categorie: categoriserIngredient(nom),
          coche: false,
        })
      }
    }
  }

  // Trier par catégorie puis par nom
  return [...seen.values()].sort((a, b) => {
    if (a.categorie !== b.categorie) return a.categorie.localeCompare(b.categorie)
    return a.nom.localeCompare(b.nom)
  })
}

// ─── Affichage étoiles ─────────────────────────────────────────────────────

export function etoiles(score: number): string {
  const n = Math.round(score)
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}
