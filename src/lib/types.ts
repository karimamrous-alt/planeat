// Types TypeScript alignés sur le schéma Supabase PlanEat

export type Regime = 'halal' | 'vegetarien' | 'vegan' | 'standard'
export type NiveauEpices = 'doux' | 'moyen' | 'fort'
export type Difficulte = 'facile' | 'moyen' | 'difficile'

export interface Famille {
  id: string
  nom: string
  nb_personnes: number
  membres: MembreSnapshot[]
  regime: Regime
  created_at: string
  updated_at: string
}

export interface MembreSnapshot {
  prenom: string
  age: number | null
  role: 'adulte' | 'enfant'
}

export interface Membre {
  id: string
  famille_id: string
  prenom: string
  age: number | null
  restrictions: string[]
  preferences: string[]
  niveau_epices: NiveauEpices
  portions: number
  created_at: string
}

export interface Recette {
  id: string
  nom: string
  cuisine: string
  ingredients: Ingredient[]
  temps_prep: string
  temps_cuisson: string
  temps_total: string
  calories: string
  difficulte: Difficulte
  nb_personnes: string
  score: number
  nb_votes: number
  niveau_epices: NiveauEpices
  source_url: string
  tags: string[]
  created_at: string
}

export interface Ingredient {
  nom: string
  quantite?: string
  unite?: string
}

export interface Menu {
  id: string
  famille_id: string
  semaine: string  // date ISO — lundi de la semaine
  lundi_dejeuner: string | null
  lundi_diner: string | null
  mardi_dejeuner: string | null
  mardi_diner: string | null
  mercredi_dejeuner: string | null
  mercredi_diner: string | null
  jeudi_dejeuner: string | null
  jeudi_diner: string | null
  vendredi_dejeuner: string | null
  vendredi_diner: string | null
  samedi_dejeuner: string | null
  samedi_diner: string | null
  dimanche_dejeuner: string | null
  dimanche_diner: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Favori {
  id: string
  famille_id: string
  recette_id: string
  note: 1 | 2 | 3 | 4 | 5
  commentaire: string | null
  created_at: string
  // Relations
  recette?: Recette
}

export interface ArticleCourses {
  nom: string
  quantite: string
  unite: string
  categorie: string
  coche: boolean
}

export interface ListeCourses {
  id: string
  menu_id: string | null
  famille_id: string
  ingredients_consolides: ArticleCourses[]
  articles_manuels: ArticleCourses[]
  semaine: string | null
  created_at: string
  updated_at: string
}

// Config profil famille (utilisée côté UI)
export const PROFIL_DEFAUT = {
  regime: 'halal' as Regime,
  restrictions: [
    'sans_porc',
    'sans_alcool',
    'sans_abats',
    'sans_fruits_de_mer',
    'sans_agneau',
    'sans_lassi',
    'sans_feuilles_de_vigne',
  ],
  proteines_prioritaires: ['poulet', 'légumes', 'viande hachée', 'bœuf'],
  cuisines_favorites: ['marocaine', 'indienne', 'afghane', 'italienne', 'française'],
  repas: ['dejeuner', 'diner'] as const,
  jours: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const,
  temps_prep_max_semaine: 45,  // minutes
  membres: [
    { prenom: 'Parent 1',  age: null, role: 'adulte' as const, niveau_epices: 'fort'  as NiveauEpices, portions: 1.0 },
    { prenom: 'Parent 2',  age: null, role: 'adulte' as const, niveau_epices: 'fort'  as NiveauEpices, portions: 1.0 },
    { prenom: 'Enfant 1',  age: 15,  role: 'enfant' as const, niveau_epices: 'moyen' as NiveauEpices, portions: 1.0 },
    { prenom: 'Enfant 2',  age: 13,  role: 'enfant' as const, niveau_epices: 'moyen' as NiveauEpices, portions: 1.0 },
    { prenom: 'Enfant 3',  age: 10,  role: 'enfant' as const, niveau_epices: 'moyen' as NiveauEpices, portions: 0.8 },
    { prenom: 'Enfant 4',  age: 3,   role: 'enfant' as const, niveau_epices: 'doux'  as NiveauEpices, portions: 0.5 },
  ],
} as const
