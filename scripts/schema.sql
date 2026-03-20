-- PlanEat v1.0.0 — Nouveau schéma
-- Coller dans l'éditeur SQL Supabase (https://supabase.com/dashboard → SQL Editor)

-- ── Nettoyage ─────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS favoris       CASCADE;
DROP TABLE IF EXISTS liste_courses CASCADE;
DROP TABLE IF EXISTS menus         CASCADE;
DROP TABLE IF EXISTS membres       CASCADE;
DROP TABLE IF EXISTS familles      CASCADE;
DROP TABLE IF EXISTS recettes      CASCADE;

-- ── Recettes ──────────────────────────────────────────────────────────────────
CREATE TABLE recettes (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         text    NOT NULL,
  cuisine     text    NOT NULL CHECK (cuisine IN ('marocaine','française','italienne','végé','rapide')),
  type        text    NOT NULL DEFAULT 'plat' CHECK (type IN ('plat','soupe','salade')),
  temps_prep  integer NOT NULL DEFAULT 0,
  temps_cuisson integer NOT NULL DEFAULT 0,
  ingredients jsonb   NOT NULL DEFAULT '[]',
  instructions text[] DEFAULT '{}',
  calories    integer DEFAULT 0,
  personnes   integer NOT NULL DEFAULT 4,
  saison      text[]  DEFAULT '{}',
  tags        text[]  DEFAULT '{}',
  source      text,
  photo_url   text,
  niveau_epices text  DEFAULT 'doux' CHECK (niveau_epices IN ('doux','moyen','fort')),
  cree_le     timestamptz DEFAULT now()
);

-- ── Familles ──────────────────────────────────────────────────────────────────
CREATE TABLE familles (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         text    NOT NULL,
  nb_personnes integer NOT NULL DEFAULT 6,
  preferences jsonb   DEFAULT '{}',
  cree_le     timestamptz DEFAULT now()
);

-- ── Membres ───────────────────────────────────────────────────────────────────
CREATE TABLE membres (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  famille_id   uuid REFERENCES familles(id) ON DELETE CASCADE,
  prenom       text NOT NULL,
  age          integer,
  restrictions text[] DEFAULT '{}'
);

-- ── Menus ─────────────────────────────────────────────────────────────────────
-- jours = {"lundi":{"dejeuner":"uuid","diner":"uuid"},"mardi":...}
CREATE TABLE menus (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  famille_id uuid REFERENCES familles(id) ON DELETE CASCADE,
  semaine    date NOT NULL,
  jours      jsonb NOT NULL DEFAULT '{}',
  cree_le    timestamptz DEFAULT now(),
  UNIQUE(famille_id, semaine)
);

-- ── Favoris ───────────────────────────────────────────────────────────────────
CREATE TABLE favoris (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  famille_id uuid REFERENCES familles(id) ON DELETE CASCADE,
  recette_id uuid REFERENCES recettes(id) ON DELETE CASCADE,
  note       integer CHECK (note BETWEEN 1 AND 5),
  variantes  text,
  UNIQUE(famille_id, recette_id)
);

-- ── Index ─────────────────────────────────────────────────────────────────────
CREATE INDEX idx_recettes_cuisine  ON recettes(cuisine);
CREATE INDEX idx_recettes_type     ON recettes(type);
CREATE INDEX idx_menus_fam_semaine ON menus(famille_id, semaine);
