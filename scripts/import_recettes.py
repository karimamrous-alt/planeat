"""
Import des recettes scrapées vers Supabase.

Prérequis : avoir exécuté supabase/migrations/001_init_planeat.sql
            dans le SQL Editor de Supabase.

Usage :
    python scripts/import_recettes.py
    python scripts/import_recettes.py --dry-run   # aperçu sans insérer
    python scripts/import_recettes.py --reset      # vide la table avant import
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SUPABASE_URL     = os.getenv("NEXT_PUBLIC_SUPABASE_URL",     "https://zbbachjfmcmzunbsovps.supabase.co")
SUPABASE_KEY     = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY","sb_publishable_ZIzbTj2_ublphkaFYnV8Fg_I9XVwD-t")
# Pour l'import on a besoin de la service_role key si RLS est activé.
# Sinon la clé anon suffit (RLS désactivé par défaut dans notre migration).
SUPABASE_SERVICE = os.getenv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY)

INPUT_FILE  = Path(__file__).parent / "recettes.json"
BATCH_SIZE  = 50   # lignes par requête POST
DELAI_BATCH = 0.5  # secondes entre les batchs

# ---------------------------------------------------------------------------
# Helpers HTTP
# ---------------------------------------------------------------------------

def headers(use_service: bool = True) -> dict:
    key = SUPABASE_SERVICE if use_service else SUPABASE_KEY
    return {
        "apikey":        key,
        "Authorization": f"Bearer {key}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }


def api_get(path: str) -> requests.Response:
    return requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=headers(), timeout=15)


def api_post(path: str, data: list) -> requests.Response:
    return requests.post(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={**headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
        json=data,
        timeout=30,
    )


def api_delete(path: str) -> requests.Response:
    return requests.delete(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers=headers(),
        timeout=30,
    )


# ---------------------------------------------------------------------------
# Vérifications préliminaires
# ---------------------------------------------------------------------------

def verifier_connexion() -> bool:
    """Vérifie que Supabase est joignable et que la table recettes existe."""
    try:
        r = api_get("recettes?limit=0")
        if r.status_code == 200:
            print("  Connexion Supabase OK — table recettes accessible")
            return True
        elif r.status_code == 404 or "PGRST205" in r.text:
            print("  ERREUR : la table recettes n'existe pas.")
            print("  -> Executez d'abord supabase/migrations/001_init_planeat.sql")
            print("     dans le SQL Editor de votre projet Supabase.")
            return False
        else:
            print(f"  ERREUR inattendue ({r.status_code}) : {r.text[:200]}")
            return False
    except requests.RequestException as e:
        print(f"  Impossible de joindre Supabase : {e}")
        return False


def compter_existantes() -> int:
    r = api_get("recettes?select=id")
    if r.status_code == 200:
        return len(r.json())
    return 0


# ---------------------------------------------------------------------------
# Transformation des données
# ---------------------------------------------------------------------------

def transformer_recette(r: dict) -> dict:
    """
    Adapte un enregistrement de recettes.json au schéma de la table Supabase.
    Les champs inconnus sont ignorés. Les ingrédients sont normalisés en JSONB.
    """
    # Normaliser la liste d'ingrédients
    ingredients_bruts = r.get("ingredients", [])
    ingredients = []
    for ing in ingredients_bruts:
        if isinstance(ing, str):
            ingredients.append({"nom": ing.strip(), "quantite": "", "unite": ""})
        elif isinstance(ing, dict):
            ingredients.append({
                "nom":      ing.get("nom", ing.get("name", "")).strip(),
                "quantite": str(ing.get("quantite", ing.get("quantity", ""))),
                "unite":    ing.get("unite", ing.get("unit", "")),
            })

    # Déduire le niveau d'épices à partir de la catégorie
    niveau_epices = "moyen"
    cuisine = r.get("categorie", r.get("cuisine", "")).lower()
    if cuisine in ("indienne", "afghane", "marocaine"):
        niveau_epices = "moyen"
    elif cuisine in ("française", "italienne"):
        niveau_epices = "doux"

    def to_int(val, default=0):
        try:
            return int(val) if val else default
        except (ValueError, TypeError):
            return default

    return {
        "nom":           r.get("nom", "").strip(),
        "cuisine":       cuisine,
        "type":          "plat",
        "ingredients":   ingredients,
        "instructions":  r.get("instructions", []) or [],
        "temps_prep":    to_int(r.get("temps_preparation", r.get("temps_prep"))),
        "temps_cuisson": to_int(r.get("temps_cuisson")),
        "calories":      to_int(r.get("calories")),
        "personnes":     to_int(r.get("nb_personnes", r.get("personnes")), 4),
        "niveau_epices": niveau_epices,
        "source":        r.get("url", r.get("source_url", r.get("source"))) or None,
        "tags":          r.get("tags", []) or [],
        "saison":        r.get("saison", []) or [],
    }


# ---------------------------------------------------------------------------
# Import en batchs
# ---------------------------------------------------------------------------

def importer(recettes: list[dict], dry_run: bool = False) -> tuple[int, int]:
    """Insère les recettes par batchs. Retourne (ok, erreurs)."""
    total  = len(recettes)
    ok     = 0
    errors = 0

    for debut in range(0, total, BATCH_SIZE):
        batch_brut = recettes[debut:debut + BATCH_SIZE]
        batch      = [transformer_recette(r) for r in batch_brut]
        fin        = min(debut + BATCH_SIZE, total)

        print(f"  Batch {debut+1}-{fin}/{total}", end=" ... ")
        sys.stdout.flush()

        if dry_run:
            print(f"[dry-run] {len(batch)} recettes (ex: {batch[0]['nom'][:40]})")
            ok += len(batch)
            continue

        r = api_post("recettes", batch)

        if r.status_code in (200, 201):
            ok += len(batch)
            print(f"OK ({len(batch)} inserees)")
        elif r.status_code == 409:
            # Conflict sur source_url — l'upsert (merge-duplicates) devrait gérer ça
            ok += len(batch)
            print(f"OK (mise a jour via upsert)")
        else:
            errors += len(batch)
            print(f"ERREUR {r.status_code}: {r.text[:150]}")

        time.sleep(DELAI_BATCH)

    return ok, errors


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Import recettes.json -> Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Simuler sans insérer")
    parser.add_argument("--reset",   action="store_true", help="Vider la table avant import")
    args = parser.parse_args()

    print("Import PlanEat -> Supabase")
    print(f"  Source  : {INPUT_FILE}")
    print(f"  Cible   : {SUPABASE_URL}/rest/v1/recettes")
    print(f"  Mode    : {'DRY-RUN (simulation)' if args.dry_run else 'INSERTION REELLE'}\n")

    # Charger le JSON
    if not INPUT_FILE.exists():
        print(f"ERREUR : fichier introuvable : {INPUT_FILE}")
        sys.exit(1)

    with open(INPUT_FILE, encoding="utf-8") as f:
        data = json.load(f)

    recettes = data.get("recettes", data) if isinstance(data, dict) else data
    meta     = data.get("meta", {}) if isinstance(data, dict) else {}

    print(f"  {len(recettes)} recettes chargees depuis le JSON")
    if meta:
        print(f"  Categories : {meta.get('categories', {})}")
    print()

    # Vérifier la connexion
    print("Verification de la connexion...")
    if not verifier_connexion():
        sys.exit(1)

    # Compter les recettes existantes
    nb_existantes = compter_existantes()
    print(f"  Recettes actuellement en base : {nb_existantes}\n")

    # Reset si demandé
    if args.reset and not args.dry_run:
        print("  Reset : suppression de toutes les recettes existantes...")
        r = api_delete("recettes?id=neq.00000000-0000-0000-0000-000000000000")
        if r.status_code in (200, 204):
            print("  Table videe.")
        else:
            print(f"  ERREUR lors du reset : {r.status_code} {r.text[:100]}")
            sys.exit(1)

    # Filtrer les recettes valides (nom + url non vides)
    valides = [r for r in recettes if r.get("nom") and r.get("url")]
    ignores = len(recettes) - len(valides)
    if ignores:
        print(f"  {ignores} recettes ignorees (nom ou url manquant)")

    print(f"Import de {len(valides)} recettes en batchs de {BATCH_SIZE}...\n")

    ok, errors = importer(valides, dry_run=args.dry_run)

    # Résumé
    print(f"\n{'='*55}")
    if args.dry_run:
        print(f"DRY-RUN termine : {ok} recettes auraient ete inserees")
    else:
        nb_finale = compter_existantes()
        print(f"Import termine !")
        print(f"  Inserees/mises a jour : {ok}")
        print(f"  Erreurs              : {errors}")
        print(f"  Total en base        : {nb_finale}")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
