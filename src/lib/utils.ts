import type { Recette } from './types'

// ─── Constantes ────────────────────────────────────────────────────────────

export const FAMILLE_ID = 'e857128f-7da2-4e00-832e-58169161be40'

export const CUISINE_CONFIG: Record<string, { emoji: string; colorClass: string; bgClass: string; ph: string }> = {
  marocaine: { emoji: '🇲🇦', colorClass: 'text-orange-700', bgClass: 'bg-orange-50 border-orange-200', ph: 'ph-marocaine' },
  française: { emoji: '🇫🇷', colorClass: 'text-blue-700',   bgClass: 'bg-blue-50 border-blue-200',     ph: 'ph-française' },
  italienne: { emoji: '🇮🇹', colorClass: 'text-red-700',    bgClass: 'bg-red-50 border-red-200',       ph: 'ph-italienne' },
  végé:      { emoji: '🥗',   colorClass: 'text-green-700',  bgClass: 'bg-green-50 border-green-200',   ph: 'ph-végé'      },
  rapide:    { emoji: '⚡',   colorClass: 'text-amber-700',  bgClass: 'bg-amber-50 border-amber-200',   ph: 'ph-rapide'    },
}

export const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'] as const
export const JOURS_LABELS: Record<string, string> = {
  lundi:'Lundi', mardi:'Mardi', mercredi:'Mercredi',
  jeudi:'Jeudi', vendredi:'Vendredi', samedi:'Samedi', dimanche:'Dimanche',
}
export const REPAS  = ['dejeuner','diner'] as const
export const REPAS_LABELS: Record<string, string> = { dejeuner: '🌞 Déjeuner', diner: '🌙 Dîner' }

export type Jour  = typeof JOURS[number]
export type Repas = typeof REPAS[number]

export const JOURS_WEEKEND = new Set<string>(['samedi', 'dimanche'])

// Cuisines marocaine et végé : soir + week-end uniquement pour la génération
export const CUISINES_SOIR_ONLY = new Set<string>(['marocaine'])
// Cuisines autorisées au déjeuner semaine
export const CUISINES_MIDI_SEMAINE = ['française', 'italienne', 'rapide', 'végé']

// ─── Saisonnalité ───────────────────────────────────────────────────────────

export const MOIS_ACTUEL = new Date().getMonth() + 1 // 1-12
export const SAISON_ACTUELLE =
  MOIS_ACTUEL >= 3 && MOIS_ACTUEL <= 5  ? 'printemps' :
  MOIS_ACTUEL >= 6 && MOIS_ACTUEL <= 8  ? 'été' :
  MOIS_ACTUEL >= 9 && MOIS_ACTUEL <= 11 ? 'automne' : 'hiver'

export const SAISON_INGREDIENTS: Record<string, string[]> = {
  printemps: ['petit pois', 'épinard', 'courgette', 'fraise', 'asperge', 'fève'],
  été:       ['tomate', 'courgette', 'aubergine', 'poivron', 'concombre', 'melon', 'haricot vert'],
  automne:   ['potiron', 'courge', 'champignon', 'pomme', 'poire', 'poireau'],
  hiver:     ['carotte', 'orange', 'clémentine', 'céleri', 'chou', 'endive'],
}

// ─── Unsplash photos ─────────────────────────────────────────────────────────

const _unsplashCache = new Map<string, string>()

export async function getUnsplashPhoto(query: string): Promise<string> {
  const key = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY ?? ''
  if (!key || key === 'YOUR_UNSPLASH_KEY') return ''
  const cacheKey = query.toLowerCase().slice(0, 60)
  if (_unsplashCache.has(cacheKey)) return _unsplashCache.get(cacheKey)!
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${key}`,
      { next: { revalidate: 86400 } }   // cache CDN 24h
    )
    if (!res.ok) return ''
    const data = await res.json()
    const url: string = data.results?.[0]?.urls?.small ?? ''
    _unsplashCache.set(cacheKey, url)
    return url
  } catch {
    return ''
  }
}

export function estSaisonnier(r: Recette): boolean {
  const ings = SAISON_INGREDIENTS[SAISON_ACTUELLE] ?? []
  const ingStr = r.ingredients.map(i => i.nom).join(' ').toLowerCase()
  return ings.some(s => ingStr.includes(s) || r.nom.toLowerCase().includes(s))
    || (r.saison.length > 0 && (r.saison.includes(SAISON_ACTUELLE) || r.saison.includes('toutes')))
}

// ─── Configuration par slot ─────────────────────────────────────────────────

export type SlotConfig = { maxMin: number; nbPersonnes: number; cuisinesOnly?: string[] }

export function getSlotConfig(jour: string, repas: string): SlotConfig {
  const isWeekend = JOURS_WEEKEND.has(jour)
  if (isWeekend)           return { maxMin: 90, nbPersonnes: 6 }
  if (repas === 'diner')   return { maxMin: 45, nbPersonnes: 6 }
  if (jour === 'mercredi') return { maxMin: 15, nbPersonnes: 6, cuisinesOnly: CUISINES_MIDI_SEMAINE }
  return { maxMin: 15, nbPersonnes: 2, cuisinesOnly: CUISINES_MIDI_SEMAINE }
}

// ─── Dates ─────────────────────────────────────────────────────────────────

export function getMondayOfWeek(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
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

// ─── Astuces & variantes ───────────────────────────────────────────────────

export const ASTUCES: Record<string, string[]> = {
  marocaine: ['Dorer les épices à sec 1 min avant d\'ajouter les liquides', 'Une pincée de safran dans l\'eau tiède décuple les arômes'],
  française: ['Déglacer avec un fond de bouillon pour récupérer les sucs', 'Un filet de citron en fin de cuisson rehausse toutes les saveurs'],
  italienne: ['Saler l\'eau des pâtes généreusement — goût de la mer', 'Garder une louche d\'eau de cuisson pour lier la sauce'],
  végé:      ['Ajouter les légumes les plus durs en premier', 'Un filet de citron juste avant service préserve la couleur verte'],
  rapide:    ['Préparer les ingrédients à l\'avance pour gagner du temps', 'Utiliser des restes de la veille pour accélérer'],
  poulet:    ['Sortir le poulet 20 min avant cuisson pour une chaleur uniforme', 'Piquer la viande avant marinade pour plus de profondeur'],
  boeuf:     ['Saisir à feu très vif pour une belle croûte', 'Laisser reposer 3 min après cuisson avant de couper'],
  poisson:   ['Cuire côté peau en premier pour plus de croustillant', 'Ne pas retourner le poisson trop tôt'],
  vegetarien: ['Les légumineuses doublent les protéines', 'Associer épinards + citron pour une meilleure absorption du fer'],
}

export const VARIANTES: Record<string, string> = {
  marocaine: 'Version végé : remplacer la viande par des pois chiches + merguez de volaille',
  française: 'Adapter avec les légumes de saison disponibles',
  italienne: 'Remplacer les pâtes par des courgettes spiralisées pour une version légère',
  végé:      'Ajouter du halloumi grillé pour les amateurs de fromage chaud',
  rapide:    'En version grande famille : doubler les doses et ajouter du riz',
  poulet:    'Remplacer par de la dinde pour une version encore plus légère',
  poisson:   'Utiliser du saumon à la place pour plus de moelleux',
}

export function getAstuces(r: Recette): { astuces: string[]; variante: string | null } {
  const cuisine = r.cuisine
  const astuces = (ASTUCES[cuisine] ?? []).slice(0, 2)
  const variante = VARIANTES[cuisine] ?? null
  return { astuces, variante }
}

// ─── Protéines ─────────────────────────────────────────────────────────────

const PROTEINES_MAP = [
  { mots: ['poulet', 'dinde', 'blanc de poulet'], label: 'poulet' },
  { mots: ['bœuf', 'boeuf', 'steak', 'viande hachée bœuf'], label: 'boeuf' },
  { mots: ['haché', 'kefta', 'viande hachée'], label: 'hache' },
  { mots: ['saumon', 'thon', 'poisson', 'dorade'], label: 'poisson' },
  { mots: ['pois chiche', 'lentille', 'végé', 'falafel'], label: 'vegetal' },
  { mots: ['veau'], label: 'veau' },
]

export function detecterProteine(nom: string): string {
  const n = nom.toLowerCase()
  for (const p of PROTEINES_MAP) {
    if (p.mots.some(m => n.includes(m))) return p.label
  }
  return 'autre'
}

// ─── Étoiles ───────────────────────────────────────────────────────────────

export function etoiles(note: number | null): string {
  const n = Math.round(note ?? 0)
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}
