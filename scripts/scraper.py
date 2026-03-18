"""
Scraper de recettes 750g.com
Catégories : marocaine, indienne, afghane, italienne, française
Filtre automatique : recettes contenant du porc et dérivés
Sortie : scripts/recettes.json
"""

import json
import os
import re
import sys
import time
from pathlib import Path

# Forcer UTF-8 sur les terminaux Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CATEGORIES = {
    "marocaine":  "https://www.750g.com/recettes_cuisine_marocaine.htm",
    "indienne":   "https://www.750g.com/recettes_cuisine_indienne.htm",
    "afghane":    "https://www.750g.com/recettes_cuisine_afghane.htm",
    "italienne":  "https://www.750g.com/recettes_cuisine_italienne.htm",
    "française":  "https://www.750g.com/recettes_cuisine_francaise.htm",
}

MAX_PAGES_PAR_CATEGORIE = 5   # Augmenter pour scraper plus de recettes
DELAI_ENTRE_REQUETES    = 1.5  # secondes — respecter le serveur
OUTPUT_FILE = Path(__file__).parent / "recettes.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Mots-clés de filtrage (porc et dérivés) — comparaison insensible à la casse
MOTS_CLES_EXCLUSION = {
    "porc", "jambon", "lardons", "lardon", "pancetta", "chorizo",
    "bacon", "saucisson", "andouille", "boudin", "cochon",
    "charcuterie", "lard", "rillettes", "coppa", "mortadelle",
    "prosciutto", "salami", "pepperoni", "guanciale",
}

# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------

def get(url: str, retries: int = 3) -> BeautifulSoup | None:
    """GET avec retry et délai."""
    for tentative in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
            r.encoding = r.apparent_encoding
            return BeautifulSoup(r.text, "html.parser")
        except requests.RequestException as e:
            print(f"  [!] Erreur ({tentative+1}/{retries}) {url} → {e}")
            time.sleep(2 * (tentative + 1))
    return None


def parse_iso_duration(duration: str) -> str:
    """Convertit PT25M, PT1H30M → '25 min', '1h30'."""
    if not duration:
        return ""
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", duration)
    if not match:
        return duration
    heures   = int(match.group(1) or 0)
    minutes  = int(match.group(2) or 0)
    if heures and minutes:
        return f"{heures}h{minutes:02d}"
    if heures:
        return f"{heures}h"
    return f"{minutes} min"


def contient_porc(texte: str) -> bool:
    """Retourne True si le texte contient un mot-clé exclu."""
    texte_lower = texte.lower()
    # Découper en mots pour éviter les faux positifs (ex: "accords")
    mots = re.findall(r"[a-zàâäéèêëîïôùûüç]+", texte_lower)
    return bool(MOTS_CLES_EXCLUSION.intersection(mots))


# ---------------------------------------------------------------------------
# Extraction depuis JSON-LD
# ---------------------------------------------------------------------------

def extraire_json_ld(soup: BeautifulSoup) -> dict:
    """Extrait le premier bloc JSON-LD de type Recipe."""
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
            # Peut être un objet ou une liste
            if isinstance(data, list):
                for item in data:
                    if item.get("@type") == "Recipe":
                        return item
            elif data.get("@type") == "Recipe":
                return data
        except (json.JSONDecodeError, AttributeError):
            continue
    return {}


def extraire_calories(json_ld: dict) -> str:
    """Extrait les calories depuis le JSON-LD nutrition."""
    nutrition = json_ld.get("nutrition", {})
    if isinstance(nutrition, dict):
        calories = nutrition.get("calories", "")
        if calories:
            # Nettoyer : "350 calories" → "350"
            return re.sub(r"[^\d]", "", str(calories))
    return ""


def extraire_ingredients(json_ld: dict, soup: BeautifulSoup) -> list[str]:
    """
    Tente d'abord le JSON-LD (recipeIngredient),
    puis cherche dans les data JS embarquées (recipeRawgredients).
    """
    # 1. JSON-LD standard
    ingredients_ld = json_ld.get("recipeIngredient", [])
    if ingredients_ld:
        return [str(i).strip() for i in ingredients_ld if str(i).strip()]

    # 2. Données JS embarquées (recipeRawgredients)
    pattern = re.compile(r"recipeRawgredients\s*[=:]\s*(\[.*?\])", re.DOTALL)
    for script in soup.find_all("script"):
        text = script.string or ""
        match = pattern.search(text)
        if match:
            try:
                raw = json.loads(match.group(1))
                resultats = []
                for bloc in raw:
                    for ing in bloc.get("ingredients", []):
                        ligne = ing.get("raw", "").strip()
                        if ligne:
                            resultats.append(ligne)
                if resultats:
                    return resultats
            except (json.JSONDecodeError, KeyError):
                continue

    # 3. Fallback HTML : chercher des listes d'ingrédients
    for selector in [
        "[class*='ingredient']",
        "[class*='Ingredient']",
        "ul.recipe-ingredients li",
        ".recipeIngredient",
    ]:
        items = soup.select(selector)
        if items:
            return [i.get_text(strip=True) for i in items if i.get_text(strip=True)]

    return []


def extraire_personnes(json_ld: dict, soup: BeautifulSoup) -> str:
    """Extrait le nombre de personnes / portions."""
    # JSON-LD
    yield_ld = json_ld.get("recipeYield", "")
    if yield_ld:
        if isinstance(yield_ld, list):
            yield_ld = yield_ld[0]
        return str(yield_ld).strip()

    # HTML : chercher un pattern "X personnes" ou "X parts"
    texte = soup.get_text(" ")
    match = re.search(r"(\d+)\s*(personnes?|parts?|portions?)", texte, re.IGNORECASE)
    if match:
        return f"{match.group(1)} {match.group(2)}"

    return ""


# ---------------------------------------------------------------------------
# Scraping d'une recette individuelle
# ---------------------------------------------------------------------------

def scraper_recette(url: str, categorie: str) -> dict | None:
    """
    Scrape une page de recette et retourne un dict structuré,
    ou None si la recette doit être filtrée.
    """
    soup = get(url)
    if not soup:
        return None

    json_ld = extraire_json_ld(soup)

    # --- Nom ---
    nom = json_ld.get("name", "")
    if not nom:
        h1 = soup.find("h1")
        nom = h1.get_text(strip=True) if h1 else ""

    # --- Ingrédients ---
    ingredients = extraire_ingredients(json_ld, soup)

    # --- Filtrage porc ---
    texte_complet = nom + " " + " ".join(ingredients)
    if contient_porc(texte_complet):
        print(f"    [FILTRÉ - porc] {nom}")
        return None

    # --- Temps ---
    prep_time  = parse_iso_duration(json_ld.get("prepTime", ""))
    cook_time  = parse_iso_duration(json_ld.get("cookTime", ""))
    total_time = parse_iso_duration(json_ld.get("totalTime", ""))

    # Fallback HTML pour les temps
    if not prep_time or not cook_time:
        for div in soup.find_all(["div", "span", "li"]):
            texte = div.get_text(strip=True)
            if not prep_time:
                m = re.search(r"[Pp]r[ée]paration\s*[:\-]?\s*(\d+)\s*min", texte)
                if m:
                    prep_time = f"{m.group(1)} min"
            if not cook_time:
                m = re.search(r"[Cc]uisson\s*[:\-]?\s*(\d+)\s*min", texte)
                if m:
                    cook_time = f"{m.group(1)} min"

    # --- Personnes ---
    personnes = extraire_personnes(json_ld, soup)

    # --- Calories ---
    calories = extraire_calories(json_ld)

    return {
        "nom":           nom,
        "categorie":     categorie,
        "url":           url,
        "ingredients":   ingredients,
        "nb_ingredients": len(ingredients),
        "temps_preparation": prep_time,
        "temps_cuisson":     cook_time,
        "temps_total":       total_time,
        "nb_personnes":  personnes,
        "calories":      calories,
    }


# ---------------------------------------------------------------------------
# Scraping d'une page de listing (catégorie)
# ---------------------------------------------------------------------------

def extraire_liens_recettes(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Extrait tous les liens de recettes d'une page de listing."""
    # Pattern recette : se termine par -rNNNNN.htm
    pattern_relatif = re.compile(r"^/[^/]+-r\d+\.htm$")
    pattern_absolu  = re.compile(r"^https://www\.750g\.com/[^/]+-r\d+\.htm$")

    vus = set()
    liens = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if pattern_relatif.match(href):
            url_complete = "https://www.750g.com" + href
        elif pattern_absolu.match(href):
            url_complete = href
        else:
            continue
        if url_complete not in vus:
            vus.add(url_complete)
            liens.append(url_complete)
    return liens


def scraper_categorie(nom_categorie: str, url_base: str) -> list[dict]:
    """Scrape toutes les pages d'une catégorie."""
    recettes = []
    print(f"\n{'='*60}")
    print(f"  Catégorie : {nom_categorie.upper()}")
    print(f"{'='*60}")

    for num_page in range(1, MAX_PAGES_PAR_CATEGORIE + 1):
        url_page = url_base if num_page == 1 else f"{url_base}?page={num_page}"
        print(f"\n  Page {num_page}/{MAX_PAGES_PAR_CATEGORIE} → {url_page}")

        soup = get(url_page)
        if not soup:
            print("  [!] Page inaccessible, arrêt de cette catégorie.")
            break

        liens = extraire_liens_recettes(soup, url_base)
        if not liens:
            print("  [!] Aucune recette trouvée sur cette page, fin de catégorie.")
            break

        print(f"  → {len(liens)} recettes trouvées")

        for i, url_recette in enumerate(liens, 1):
            print(f"    [{i}/{len(liens)}] {url_recette.split('/')[-1]}", end=" ")
            time.sleep(DELAI_ENTRE_REQUETES)

            recette = scraper_recette(url_recette, nom_categorie)
            if recette:
                recettes.append(recette)
                print(f"✓ ({recette['nb_ingredients']} ingr.)")
            else:
                if recette is None:
                    # Message déjà affiché dans scraper_recette si filtré,
                    # sinon c'est une erreur réseau
                    pass

        # Pause entre les pages
        time.sleep(DELAI_ENTRE_REQUETES * 2)

    return recettes


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def main():
    print("🍽️  Scraper 750g.com — Démarrage")
    print(f"   Catégories : {', '.join(CATEGORIES.keys())}")
    print(f"   Pages max/catégorie : {MAX_PAGES_PAR_CATEGORIE}")
    print(f"   Sortie : {OUTPUT_FILE}\n")

    toutes_recettes = []

    for nom_cat, url_cat in CATEGORIES.items():
        try:
            recettes_cat = scraper_categorie(nom_cat, url_cat)
            toutes_recettes.extend(recettes_cat)
            print(f"\n  ✅ {nom_cat} : {len(recettes_cat)} recettes retenues")
        except KeyboardInterrupt:
            print("\n\n[!] Interruption — sauvegarde des recettes collectées...")
            break
        except Exception as e:
            print(f"\n  [!] Erreur inattendue pour '{nom_cat}' : {e}")
            continue

    # Déduplication par URL
    vues = set()
    recettes_uniques = []
    for r in toutes_recettes:
        if r["url"] not in vues:
            vues.add(r["url"])
            recettes_uniques.append(r)

    # Sauvegarde
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {
                    "total":      len(recettes_uniques),
                    "categories": {
                        cat: sum(1 for r in recettes_uniques if r["categorie"] == cat)
                        for cat in CATEGORIES
                    },
                    "filtres_appliques": sorted(MOTS_CLES_EXCLUSION),
                },
                "recettes": recettes_uniques,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    print(f"\n{'='*60}")
    print(f"✅ TERMINÉ — {len(recettes_uniques)} recettes sauvegardées")
    print(f"   Fichier : {OUTPUT_FILE}")
    print(f"{'='*60}")

    # Résumé par catégorie
    print("\nRésumé par catégorie :")
    for cat in CATEGORIES:
        n = sum(1 for r in recettes_uniques if r["categorie"] == cat)
        print(f"  {cat:15s} → {n} recettes")


if __name__ == "__main__":
    main()
