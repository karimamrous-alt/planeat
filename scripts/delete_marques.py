"""
Supprime de Supabase toutes les recettes dont le nom contient une marque commerciale.
"""
import requests

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
    "Prefer": "return=minimal",
}

MARQUES = [
    "barilla", "panzani", "lustucru", "uncle ben", "kiri",
    "vache qui rit", "président", "fleury michon", "herta",
    "marie", "findus", "bonduelle", "william saurin", "la laitière",
    "nestle", "maggi", "knorr", "liebig", "campbell", "heinz",
    "weightwatchers", "weight watchers",
]

def fetch_all():
    """Récupère toutes les recettes (id + nom) par pages de 1000."""
    all_recs = []
    offset = 0
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/recettes",
            headers={**HEADERS, "Range": f"{offset}-{offset+999}"},
            params={"select": "id,nom"},
        )
        batch = r.json()
        if not batch:
            break
        all_recs.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return all_recs

def nom_contient_marque(nom: str) -> str | None:
    n = nom.lower()
    for m in MARQUES:
        if m in n:
            return m
    return None

def main():
    print("Chargement des recettes…")
    recettes = fetch_all()
    print(f"  {len(recettes)} recettes en base")

    to_delete = [(r["id"], r["nom"], nom_contient_marque(r["nom"]))
                 for r in recettes if nom_contient_marque(r["nom"])]

    if not to_delete:
        print("Aucune recette de marque trouvée.")
        return

    print(f"\n{len(to_delete)} recettes à supprimer :")
    for rid, nom, marque in to_delete:
        print(f"  [{marque}] {nom}")

    # Suppression par batch d'IDs
    ids = [r[0] for r in to_delete]
    # Supabase REST: DELETE avec filtre in
    ids_str = "(" + ",".join(ids) + ")"
    resp = requests.delete(
        f"{SUPABASE_URL}/rest/v1/recettes",
        headers=HEADERS,
        params={"id": f"in.{ids_str}"},
    )
    if resp.status_code in (200, 204):
        print(f"\n✅ {len(ids)} recettes supprimées.")
    else:
        print(f"\n❌ Erreur {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    main()
