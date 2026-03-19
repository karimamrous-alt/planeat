"""
v0.5.0 — Nettoyage Supabase
1. Supprimer recettes dont le nom contient des mots indésirables
2. Purger ingrédients parasites (personne/portion/serving)
3. Mettre type='accompagnement' pour pains/wraps
"""

import sys, re, json, time, os
import requests

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://zbbachjfmcmzunbsovps.supabase.co")
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}

# ── 1. Mots déclenchant une suppression (dans le nom) ────────────────────────

MOTS_SUPPRESSION = [
    "agneau", "merguez", "mouton", "gigot",
    "pista burfi", "pruneaux fourrés",
    "brioche", "sablé", "biscuit", "cookie", "cake", "muffin",
    "brownie", "tiramisu", "panna cotta", "crème brûlée", "creme brulee",
    "cheesecake", "flan", "boule de coco", "noisettes sucrées",
]

def doit_supprimer(nom: str) -> str | None:
    nom_l = nom.lower()
    for mot in MOTS_SUPPRESSION:
        if mot in nom_l:
            return mot
    return None

# ── 2. Ingrédients parasites ──────────────────────────────────────────────────

RE_PARASITE = re.compile(
    r"^\d*\s*(personne|personnes|portion|portions|serving|servings|"
    r"parts?|pax|convives?|less icon|plus icon|icon)\b",
    re.IGNORECASE,
)
RE_PARASITE_JSON = re.compile(r'^\s*\{.*"@type".*\}', re.DOTALL)

def est_parasite(nom_ing: str) -> bool:
    n = nom_ing.strip()
    if RE_PARASITE.search(n):
        return True
    if RE_PARASITE_JSON.match(n):
        return True
    # Blob JSON embarqué (cas 750g)
    if n.startswith('{"') or n.startswith('[{'):
        return True
    # Ligne "less icon / plus icon"
    if "icon" in n.lower():
        return True
    return False

# ── 3. Mots déclenchant type='accompagnement' ─────────────────────────────────

MOTS_ACCOMPAGNEMENT = [
    "naan", "pain ", "pain,", "pain de", "pita", "tortilla",
    "focaccia", "pains ", "chapati", "chapatis",
    "pão", "flatbread",
]

# Exceptions : ces recettes contiennent "pain" mais ne sont pas des pains
EXCLUSIONS_ACCOMPAGNEMENT = [
    "pain perdu", "pain aux raisins", "pains aux raisins",
    "pain d'épice", "pain de gênes", "pain chocolat",
    "pain sucré",
]

def doit_accompagnement(nom: str) -> bool:
    nom_l = nom.lower()
    if any(excl in nom_l for excl in EXCLUSIONS_ACCOMPAGNEMENT):
        return False
    return any(m in nom_l for m in MOTS_ACCOMPAGNEMENT)

# ── Fetch toutes les recettes ─────────────────────────────────────────────────

def fetch_all() -> list[dict]:
    recettes = []
    offset = 0
    batch = 500
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/recettes"
            f"?select=id,nom,type,ingredients"
            f"&offset={offset}&limit={batch}",
            headers=HEADERS,
        )
        r.raise_for_status()
        page = r.json()
        recettes.extend(page)
        if len(page) < batch:
            break
        offset += batch
    return recettes

# ── DELETE ────────────────────────────────────────────────────────────────────

def supprimer(ids: list[str]) -> int:
    ok = 0
    for i in range(0, len(ids), 50):
        batch = ids[i:i+50]
        ids_str = ",".join(f'"{x}"' for x in batch)
        r = requests.delete(
            f"{SUPABASE_URL}/rest/v1/recettes?id=in.({ids_str})",
            headers=HEADERS,
        )
        if r.status_code in (200, 204):
            ok += len(batch)
            print(f"  DELETE batch {i+1}-{i+len(batch)} → OK")
        else:
            print(f"  DELETE batch {i+1}-{i+len(batch)} → ERREUR {r.status_code}: {r.text[:120]}")
        time.sleep(0.2)
    return ok

# ── PATCH (ingredients ou type) ───────────────────────────────────────────────

def patcher(rec_id: str, payload: dict):
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/recettes?id=eq.{rec_id}",
        headers=HEADERS,
        json=payload,
    )
    return r.status_code in (200, 204)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("v0.5.0 — Nettoyage Supabase")
    print("=" * 60)

    print("\nFetch toutes les recettes…")
    recettes = fetch_all()
    print(f"  {len(recettes)} recettes chargées.")

    a_supprimer   = []   # [(id, nom, raison)]
    a_nettoyer    = []   # [(id, nom, new_ingredients)]
    a_accomp      = []   # [(id, nom)]

    for rec in recettes:
        rid  = rec["id"]
        nom  = rec.get("nom", "")
        typ  = rec.get("type", "")
        ings = rec.get("ingredients") or []

        # 1. Suppression ?
        raison = doit_supprimer(nom)
        if raison:
            a_supprimer.append((rid, nom, raison))
            continue  # pas besoin d'analyser davantage

        # 2. Ingrédients parasites ?
        ings_propres = [
            ing for ing in ings
            if not est_parasite(ing.get("nom", "") if isinstance(ing, dict) else str(ing))
        ]
        if len(ings_propres) != len(ings):
            a_nettoyer.append((rid, nom, ings_propres))

        # 3. Type accompagnement ?
        if typ != "accompagnement" and doit_accompagnement(nom):
            a_accomp.append((rid, nom))

    # ── Rapport avant action ──────────────────────────────────────────────────

    print(f"\n{'─'*60}")
    print(f"À SUPPRIMER  : {len(a_supprimer)} recettes")
    for rid, nom, raison in a_supprimer[:30]:
        print(f"  [{raison:20s}] {nom[:55]}")
    if len(a_supprimer) > 30:
        print(f"  … et {len(a_supprimer)-30} autres")

    print(f"\nÀ NETTOYER   : {len(a_nettoyer)} recettes (ingrédients parasites)")
    for rid, nom, ings in a_nettoyer[:10]:
        print(f"  {nom[:55]}")
    if len(a_nettoyer) > 10:
        print(f"  … et {len(a_nettoyer)-10} autres")

    print(f"\nACCOMPAGNEMENT : {len(a_accomp)} recettes à reclasser")
    for rid, nom in a_accomp:
        print(f"  {nom[:55]}")

    print(f"\n{'─'*60}")
    confirm = input("Appliquer ces modifications ? [oui/non] : ").strip().lower()
    if confirm not in ("oui", "o", "yes", "y"):
        print("Annulé.")
        return

    # ── Suppressions ─────────────────────────────────────────────────────────

    print(f"\n[1/3] Suppression de {len(a_supprimer)} recettes…")
    ids_del = [rid for rid, _, _ in a_supprimer]
    n_del = supprimer(ids_del) if ids_del else 0
    print(f"  → {n_del} supprimées")

    # ── Nettoyage ingrédients ─────────────────────────────────────────────────

    print(f"\n[2/3] Nettoyage ingrédients ({len(a_nettoyer)} recettes)…")
    n_net = 0
    for rid, nom, ings_propres in a_nettoyer:
        if patcher(rid, {"ingredients": ings_propres}):
            n_net += 1
            print(f"  ✓ {nom[:55]}")
        else:
            print(f"  ✗ ERREUR — {nom[:55]}")
        time.sleep(0.15)
    print(f"  → {n_net} recettes nettoyées")

    # ── Reclassement accompagnements ──────────────────────────────────────────

    print(f"\n[3/3] Reclassement accompagnements ({len(a_accomp)} recettes)…")
    n_acc = 0
    for rid, nom in a_accomp:
        if patcher(rid, {"type": "accompagnement"}):
            n_acc += 1
            print(f"  ✓ {nom[:55]}")
        else:
            print(f"  ✗ ERREUR — {nom[:55]}")
        time.sleep(0.15)
    print(f"  → {n_acc} reclassées")

    # ── Résumé final ──────────────────────────────────────────────────────────

    print(f"\n{'='*60}")
    print(f"TERMINÉ v0.5.0")
    print(f"  Supprimées   : {n_del}")
    print(f"  Nettoyées    : {n_net}")
    print(f"  Accomp.      : {n_acc}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
