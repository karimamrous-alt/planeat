# -*- coding: utf-8 -*-
"""
Deduplique les ingredients identiques dans chaque recette de Supabase.
Meme logique de parsing que parseIngredients() cote frontend.
"""
import sys, requests, json, unicodedata, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import os
from pathlib import Path

def _load_env():
    env_file = Path(__file__).parent.parent / ".env.local"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

_load_env()
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

FILTER = re.compile(r"(personne|portion|icon|serving|weight)", re.I)


def normaliser(texte: str) -> str:
    """Lowercase + strip + normalise accents pour comparer."""
    t = texte.strip().lower()
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"\s+", " ", t)
    return t


def extraire_depuis_groupe(groupe: dict) -> list[str]:
    ings = groupe.get("ingredients", [])
    if not isinstance(ings, list):
        return []
    result = []
    for ing in ings:
        if not isinstance(ing, dict):
            continue
        raw = str(ing.get("raw") or ing.get("singular") or ing.get("nom") or ing.get("name") or "").strip()
        if len(raw) > 1 and not FILTER.search(raw):
            result.append(raw)
    return result


def parse_ingredients(raw) -> list[str]:
    """Même logique que parseIngredients() TypeScript."""
    if raw is None:
        return []

    if isinstance(raw, dict):
        if isinstance(raw.get("recipeRawgredients"), list):
            result = []
            for groupe in raw["recipeRawgredients"]:
                if isinstance(groupe, dict):
                    result.extend(extraire_depuis_groupe(groupe))
            return result
        if isinstance(raw.get("ingredients"), list):
            return extraire_depuis_groupe(raw)
        return []

    if isinstance(raw, list):
        result = []
        for item in raw:
            if isinstance(item, str):
                if not FILTER.search(item):
                    result.append(item.strip())
            elif isinstance(item, dict):
                if isinstance(item.get("ingredients"), list):
                    result.extend(extraire_depuis_groupe(item))
                else:
                    text = str(item.get("raw") or item.get("singular") or item.get("nom") or item.get("name") or "").strip()
                    if text and not FILTER.search(text):
                        result.append(text)
        return result

    return []


def dedup(lignes: list[str]) -> tuple[list[str], int]:
    """Retire les doublons en conservant l'ordre. Retourne (déduplicatés, nb doublons)."""
    seen = set()
    result = []
    doublons = 0
    for ligne in lignes:
        cle = normaliser(ligne)
        if not cle:
            continue
        if cle in seen:
            doublons += 1
        else:
            seen.add(cle)
            result.append(ligne)
    return result, doublons


def fetch_all() -> list[dict]:
    """Récupère toutes les recettes par pages de 1000."""
    all_recs = []
    offset = 0
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/recettes",
            headers={**HEADERS, "Range": f"{offset}-{offset+999}"},
            params={"select": "id,nom,ingredients"},
        )
        batch = r.json()
        if not batch:
            break
        all_recs.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return all_recs


def main():
    print("Chargement des recettes…")
    recettes = fetch_all()
    print(f"  {len(recettes)} recettes chargées\n")

    recettes_corrigees = 0
    total_doublons = 0

    for rec in recettes:
        raw = rec.get("ingredients")
        lignes = parse_ingredients(raw)

        if not lignes:
            continue

        dedup_lignes, nb_doublons = dedup(lignes)

        if nb_doublons == 0:
            continue

        # Reconstruire le payload selon le format d'origine
        # On stocke sous forme de liste de strings simple (format normalisé)
        nouveau_payload = [{"nom": l} for l in dedup_lignes]

        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/recettes",
            headers={**HEADERS, "Prefer": "return=minimal"},
            params={"id": f"eq.{rec['id']}"},
            json={"ingredients": nouveau_payload},
        )

        if resp.status_code in (200, 204):
            recettes_corrigees += 1
            total_doublons += nb_doublons
            print(f"  ✔ {rec['nom'][:60]} — {nb_doublons} doublon(s) supprimé(s)")
        else:
            print(f"  ✘ Erreur {resp.status_code} pour {rec['nom'][:40]}: {resp.text[:80]}")

    print(f"\n{'='*50}")
    print(f"Résultat : {recettes_corrigees} recettes corrigées, {total_doublons} doublons supprimés au total.")


if __name__ == "__main__":
    main()
