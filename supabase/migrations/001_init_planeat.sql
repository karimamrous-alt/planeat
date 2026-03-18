-- ============================================================
-- PlanEat — Migration initiale
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- Table : familles
-- ------------------------------------------------------------
create table if not exists familles (
  id            uuid primary key default uuid_generate_v4(),
  nom           text not null,
  nb_personnes  int  not null default 1,
  membres       jsonb,                        -- snapshot léger des membres
  regime        text default 'standard',      -- 'halal', 'vegetarien', etc.
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

comment on table familles is 'Profils familiaux pour la planification des repas';

-- ------------------------------------------------------------
-- Table : membres
-- ------------------------------------------------------------
create table if not exists membres (
  id            uuid primary key default uuid_generate_v4(),
  famille_id    uuid references familles(id) on delete cascade,
  prenom        text not null,
  age           int,
  restrictions  text[] default '{}',         -- 'sans_porc', 'sans_alcool', etc.
  preferences   text[] default '{}',         -- cuisines ou ingrédients favoris
  niveau_epices text default 'moyen',        -- 'doux', 'moyen', 'fort'
  portions      numeric(4,2) default 1.0,    -- multiplicateur de portion (0.5 pour petit enfant)
  created_at    timestamptz default now()
);

comment on table membres is 'Membres d une famille avec leurs restrictions et préférences';

-- ------------------------------------------------------------
-- Table : recettes
-- ------------------------------------------------------------
create table if not exists recettes (
  id              uuid primary key default uuid_generate_v4(),
  nom             text not null,
  cuisine         text not null,             -- 'marocaine', 'indienne', etc.
  ingredients     jsonb not null default '[]',
  temps_prep      text,                      -- '25 min', '1h30'
  temps_cuisson   text,
  temps_total     text,
  calories        text,
  difficulte      text default 'moyen',      -- 'facile', 'moyen', 'difficile'
  nb_personnes    text,
  score           numeric(3,2) default 0,    -- note moyenne (0–5)
  nb_votes        int default 0,
  niveau_epices   text default 'moyen',
  source_url      text unique,
  tags            text[] default '{}',
  created_at      timestamptz default now()
);

comment on table recettes is 'Catalogue de recettes scrapées et/ou ajoutées manuellement';

create index if not exists idx_recettes_cuisine   on recettes(cuisine);
create index if not exists idx_recettes_score     on recettes(score desc);
create index if not exists idx_recettes_temps     on recettes(temps_prep);

-- ------------------------------------------------------------
-- Table : menus
-- ------------------------------------------------------------
create table if not exists menus (
  id              uuid primary key default uuid_generate_v4(),
  famille_id      uuid references familles(id) on delete cascade,
  semaine         date not null,             -- lundi de la semaine (ISO)
  lundi_dejeuner  uuid references recettes(id),
  lundi_diner     uuid references recettes(id),
  mardi_dejeuner  uuid references recettes(id),
  mardi_diner     uuid references recettes(id),
  mercredi_dejeuner uuid references recettes(id),
  mercredi_diner  uuid references recettes(id),
  jeudi_dejeuner  uuid references recettes(id),
  jeudi_diner     uuid references recettes(id),
  vendredi_dejeuner uuid references recettes(id),
  vendredi_diner  uuid references recettes(id),
  samedi_dejeuner uuid references recettes(id),
  samedi_diner    uuid references recettes(id),
  dimanche_dejeuner uuid references recettes(id),
  dimanche_diner  uuid references recettes(id),
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(famille_id, semaine)
);

comment on table menus is 'Planning hebdomadaire des repas (déjeuner + dîner, lundi→dimanche)';

create index if not exists idx_menus_famille_semaine on menus(famille_id, semaine desc);

-- ------------------------------------------------------------
-- Table : favoris
-- ------------------------------------------------------------
create table if not exists favoris (
  id          uuid primary key default uuid_generate_v4(),
  famille_id  uuid references familles(id) on delete cascade,
  recette_id  uuid references recettes(id) on delete cascade,
  note        int check (note between 1 and 5),
  commentaire text,
  created_at  timestamptz default now(),
  unique(famille_id, recette_id)
);

comment on table favoris is 'Recettes favorites par famille avec note personnelle';

create index if not exists idx_favoris_famille on favoris(famille_id);

-- ------------------------------------------------------------
-- Table : liste_courses
-- ------------------------------------------------------------
create table if not exists liste_courses (
  id                      uuid primary key default uuid_generate_v4(),
  menu_id                 uuid references menus(id) on delete cascade,
  famille_id              uuid references familles(id) on delete cascade,
  ingredients_consolides  jsonb not null default '[]',  -- [{nom, quantite, unite, categorie, coche}]
  articles_manuels        jsonb default '[]',           -- articles ajoutés à la main
  semaine                 date,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

comment on table liste_courses is 'Liste de courses consolidée à partir d un menu hebdomadaire';

-- ------------------------------------------------------------
-- Données initiales — Profil famille par défaut
-- ------------------------------------------------------------
with famille_insert as (
  insert into familles (nom, nb_personnes, regime, membres)
  values (
    'Notre famille',
    6,
    'halal',
    '[
      {"prenom":"Parent 1","age":null,"role":"adulte"},
      {"prenom":"Parent 2","age":null,"role":"adulte"},
      {"prenom":"Enfant 1","age":15,"role":"enfant"},
      {"prenom":"Enfant 2","age":13,"role":"enfant"},
      {"prenom":"Enfant 3","age":10,"role":"enfant"},
      {"prenom":"Enfant 4","age":3,"role":"enfant"}
    ]'::jsonb
  )
  returning id
),
m1 as (
  insert into membres (famille_id, prenom, age, restrictions, preferences, niveau_epices, portions)
  select id, 'Parent 1', null,
    array['sans_porc','sans_alcool','sans_abats','sans_fruits_de_mer'],
    array['marocaine','indienne','afghane','italienne','française'],
    'fort', 1.0
  from famille_insert
),
m2 as (
  insert into membres (famille_id, prenom, age, restrictions, preferences, niveau_epices, portions)
  select id, 'Parent 2', null,
    array['sans_porc','sans_alcool','sans_abats','sans_fruits_de_mer'],
    array['marocaine','indienne','afghane','italienne','française'],
    'fort', 1.0
  from famille_insert
),
m3 as (
  insert into membres (famille_id, prenom, age, restrictions, preferences, niveau_epices, portions)
  select id, 'Enfant 1', 15,
    array['sans_porc','sans_alcool','sans_abats','sans_fruits_de_mer'],
    array['marocaine','italienne'],
    'moyen', 1.0
  from famille_insert
),
m4 as (
  insert into membres (famille_id, prenom, age, restrictions, preferences, niveau_epices, portions)
  select id, 'Enfant 2', 13,
    array['sans_porc','sans_alcool','sans_abats','sans_fruits_de_mer'],
    array['italienne','française'],
    'moyen', 1.0
  from famille_insert
),
m5 as (
  insert into membres (famille_id, prenom, age, restrictions, preferences, niveau_epices, portions)
  select id, 'Enfant 3', 10,
    array['sans_porc','sans_alcool','sans_abats','sans_fruits_de_mer'],
    array['marocaine','française'],
    'moyen', 0.8
  from famille_insert
)
insert into membres (famille_id, prenom, age, restrictions, preferences, niveau_epices, portions)
select id, 'Enfant 4', 3,
  array['sans_porc','sans_alcool','sans_abats','sans_fruits_de_mer','sans_epices'],
  array['française'],
  'doux', 0.5
from famille_insert;

-- ------------------------------------------------------------
-- Trigger updated_at automatique
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger familles_updated_at
  before update on familles
  for each row execute function set_updated_at();

create trigger menus_updated_at
  before update on menus
  for each row execute function set_updated_at();

create trigger liste_courses_updated_at
  before update on liste_courses
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security (à activer après auth Supabase)
-- ------------------------------------------------------------
-- alter table familles enable row level security;
-- alter table membres enable row level security;
-- alter table recettes enable row level security;
-- alter table menus enable row level security;
-- alter table favoris enable row level security;
-- alter table liste_courses enable row level security;
