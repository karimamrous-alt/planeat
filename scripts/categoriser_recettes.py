"""
Catégorise les recettes existantes en base Supabase avec un champ `type`.
Types : entree | plat | dessert | boisson
"""
import os, sys, json, time
import urllib.request, urllib.error

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://zbbachjfmcmzunbsovps.supabase.co")
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

# ── Mots-clés par type ──────────────────────────────────────────────────────

BOISSON_KW = [
    "thé ", "café", "jus ", "smoothie", "limonade", "cocktail", "infusion",
    "boisson", "milkshake", "lassi", "ayran", "lait chaud", "citronnade",
    "sirop", "tisane", "cappuccino", "chocolat chaud",
]

DESSERT_KW = [
    "gâteau", "gateau", "cake", "tarte ", "tartelette", "mousse au chocolat",
    "mousse ", "flan", "tiramisu", "brownie", "cookie", "biscuit", "fondant",
    "au chocolat", "chocolat noir", "chocolat blanc", "tablette de chocolat",
    "clafoutis", "crumble", "charlotte ", "madeleine", "macaron", "éclair",
    "profiterole", "baklava", "chebakia", "makrout", "sellou", "halwa",
    "m'hancha", "briouats au miel", "bastilla sucrée", "cornes de gazelle",
    "crème brûlée", "panna cotta", "île flottante", "riz au lait",
    "moelleux", "financier", "quatre-quarts", "muffin", "cupcake",
    "cheesecake", "entremets", "vacherin", "millefeuille", "Paris-Brest",
    "tarte tatin", "frangipane", "pudding", "kompot", "halwa",
    "gulab jamun", "ladoo", "kheer", "rasmalai", "jalebi", "barfi",
    "firni", "sheer khurma", "zerde", "borek sucré",
    "dessert", "sorbet", "glace ", "parfait glacé",
]

ENTREE_KW = [
    "soupe", "velouté", "potage", "chorba", "harira", "hrira",
    "salade ", "salade de ", "fattoush", "taboulé", "tabbouleh",
    "entrée", "bruschetta", "carpaccio", "ceviche", "tartare",
    "blinis", "caviar", "rillettes", "terrine", "pâté ",
    "börek ", "samoussa", "brick ", "briouat salé",
    "chips ", "dip ", "houmous", "guacamole",
]

BOISSON_MOTS_EXCLUS_PLAT = ["jus de citron", "jus de tomate", "jus de cuisson"]

def detecter_type(nom: str, ingredients: list) -> str:
    nom_lower = nom.lower()
    ing_str   = " ".join(
        (i if isinstance(i, str) else i.get("nom", "")).lower()
        for i in ingredients
    )

    # Boisson en premier (priorité absolue)
    for kw in BOISSON_KW:
        if kw in nom_lower:
            # Éviter les faux positifs "jus de citron dans une recette"
            if kw.strip() in ["jus ", "sirop"] and any(e in nom_lower for e in BOISSON_MOTS_EXCLUS_PLAT):
                continue
            return "boisson"

    # Dessert
    for kw in DESSERT_KW:
        if kw in nom_lower:
            return "dessert"

    # Entrée
    for kw in ENTREE_KW:
        if kw in nom_lower:
            return "entree"

    return "plat"

# ── Récupérer toutes les recettes ───────────────────────────────────────────

def get_all_recettes():
    url = f"{SUPABASE_URL}/rest/v1/recettes?select=id,nom,ingredients&limit=1000"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# ── Mettre à jour par batch ──────────────────────────────────────────────────

def update_type(recette_id: str, type_val: str):
    url  = f"{SUPABASE_URL}/rest/v1/recettes?id=eq.{recette_id}"
    data = json.dumps({"type": type_val}).encode()
    req  = urllib.request.Request(url, data=data, headers=HEADERS, method="PATCH")
    with urllib.request.urlopen(req) as r:
        return r.status

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("Chargement des recettes...")
    recettes = get_all_recettes()
    print(f"{len(recettes)} recettes trouvées.\n")

    compteurs = {"entree": 0, "plat": 0, "dessert": 0, "boisson": 0}

    for i, r in enumerate(recettes):
        ingredients = r.get("ingredients") or []
        t = detecter_type(r["nom"], ingredients)
        compteurs[t] += 1

        update_type(r["id"], t)

        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(recettes)} traités...")
        time.sleep(0.05)

    print("\nTerminé !")
    for k, v in compteurs.items():
        print(f"  {k:10s} : {v}")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
