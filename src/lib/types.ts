// PlanEat v1.0.0 — Types alignés sur le nouveau schéma Supabase

export type Cuisine     = 'marocaine' | 'française' | 'italienne' | 'végé' | 'rapide' | 'indienne'
export type TypeRecette = 'plat' | 'soupe' | 'salade'
export type NiveauEpices = 'doux' | 'moyen' | 'fort'

export interface Ingredient {
  nom:      string
  quantite?: string
  unite?:   string
}

export interface Recette {
  id:           string
  nom:          string
  cuisine:      Cuisine
  type:         TypeRecette
  temps_prep:   number   // minutes
  temps_cuisson: number  // minutes
  ingredients:  Ingredient[]
  instructions: string[]
  calories:     number
  personnes:    number
  saison:       string[]
  tags:         string[]
  source:       string | null
  photo_url:    string | null
  niveau_epices: NiveauEpices
  cree_le:      string
}

export interface Famille {
  id:           string
  nom:          string
  nb_personnes: number
  preferences:  {
    regime?:             string
    restrictions?:       string[]
    cuisines_favorites?: string[]
  }
}

export interface Membre {
  id:          string
  famille_id:  string
  prenom:      string
  age:         number | null
  restrictions: string[]
}

// jours = { lundi: { dejeuner: "uuid", diner: "uuid" }, ... }
export type DayMenu = { dejeuner?: string; diner?: string }

export interface Menu {
  id:         string
  famille_id: string
  semaine:    string
  jours:      Record<string, DayMenu>
}

export interface Favori {
  id:         string
  famille_id: string
  recette_id: string
  note:       number | null
  variantes:  string | null
  recette?:   Recette
}
