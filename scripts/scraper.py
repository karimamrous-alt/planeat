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

MAX_PAGES_PAR_CATEGORIE = {
    "marocaine": 15,
    "indienne":  10,
    "afghane":    5,
    "italienne": 15,
    "française": 10,
}
DELAI_ENTRE_REQUETES = 3.0  # secondes — respecter le serveur
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

def get(url: str, retries: int = 4) -> BeautifulSoup | None:
    """GET avec retry, backoff exponentiel et gestion du 429."""
    for tentative in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 429:
                attente = 30 * (tentative + 1)   # 30s, 60s, 90s, 120s
                print(f"  [429] Limite atteinte, pause {attente}s...")
                time.sleep(attente)
                continue
            r.raise_for_status()
            r.encoding = r.apparent_encoding
            return BeautifulSoup(r.text, "html.parser")
        except requests.RequestException as e:
            print(f"  [!] Erreur ({tentative+1}/{retries}) {url} -> {e}")
            time.sleep(5 * (tentative + 1))
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


def scraper_categorie(nom_categorie: str, url_base: str) -> tuple[list[dict], int]:
    """Scrape toutes les pages d'une catégorie. Retourne (recettes_retenues, nb_filtrées)."""
    recettes = []
    nb_filtrees = 0
    max_pages = MAX_PAGES_PAR_CATEGORIE[nom_categorie]
    urls_deja_vues_global: set[str] = set()   # pour détecter les pages qui se répètent
    print(f"\n{'='*60}")
    print(f"  Categorie : {nom_categorie.upper()} ({max_pages} pages max)")
    print(f"{'='*60}")

    for num_page in range(1, max_pages + 1):
        url_page = url_base if num_page == 1 else f"{url_base}?page={num_page}"
        print(f"\n  Page {num_page}/{max_pages} -> {url_page}")

        soup = get(url_page)
        if not soup:
            print("  [!] Page inaccessible, on passe a la suivante.")
            continue

        liens = extraire_liens_recettes(soup, url_base)
        if not liens:
            print("  [!] Aucune recette trouvee sur cette page, fin de categorie.")
            break

        # Détecter si la page renvoie les mêmes URLs que les pages précédentes
        # (pagination JS non supportée → toutes les pages identiques)
        nouveaux_liens = [l for l in liens if l not in urls_deja_vues_global]
        if not nouveaux_liens and num_page > 1:
            print(f"  [!] Page identique a la precedente (pagination JS) - fin de categorie.")
            break
        urls_deja_vues_global.update(liens)

        nouveaux = len(nouveaux_liens)
        print(f"  -> {len(liens)} recettes sur la page, {nouveaux} nouvelles")

        for i, url_recette in enumerate(nouveaux_liens, 1):
            print(f"    [{i}/{nouveaux}] {url_recette.split('/')[-1]}", end=" ")
            sys.stdout.flush()
            time.sleep(DELAI_ENTRE_REQUETES)

            recette = scraper_recette(url_recette, nom_categorie)
            if recette:
                recettes.append(recette)
                print(f"OK ({recette['nb_ingredients']} ingr.)")
            else:
                nb_filtrees += 1
                # Message de filtrage deja affiche dans scraper_recette

        # Pause entre les pages
        time.sleep(DELAI_ENTRE_REQUETES * 2)

    return recettes, nb_filtrees


# ---------------------------------------------------------------------------
# Sauvegarde
# ---------------------------------------------------------------------------

def _sauvegarder(recettes: list[dict], stats: dict) -> None:
    """Déduplique et sauvegarde les recettes dans recettes.json."""
    vues: set[str] = set()
    uniques = []
    for r in recettes:
        if r["url"] not in vues:
            vues.add(r["url"])
            uniques.append(r)
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {
                    "total": len(uniques),
                    "categories": {
                        cat: sum(1 for r in uniques if r["categorie"] == cat)
                        for cat in CATEGORIES
                    },
                    "filtres_appliques": sorted(MOTS_CLES_EXCLUSION),
                },
                "recettes": uniques,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"  [sauvegarde] {len(uniques)} recettes uniques -> {OUTPUT_FILE.name}")


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def main():
    print("Scraper 750g.com - Demarrage")
    print(f"   Categories : {', '.join(CATEGORIES.keys())}")
    for cat, n in MAX_PAGES_PAR_CATEGORIE.items():
        print(f"   {cat:15s} : {n} pages max")
    print(f"   Sortie : {OUTPUT_FILE}\n")

    toutes_recettes = []
    stats = {}  # {categorie: {"retenues": n, "filtrees": n}}

    for nom_cat, url_cat in CATEGORIES.items():
        try:
            recettes_cat, nb_filtrees = scraper_categorie(nom_cat, url_cat)
            toutes_recettes.extend(recettes_cat)
            stats[nom_cat] = {"retenues": len(recettes_cat), "filtrees": nb_filtrees}
            print(f"\n  >> {nom_cat} : {len(recettes_cat)} retenues, {nb_filtrees} filtrees (porc)")
        except KeyboardInterrupt:
            print("\n\n[!] Interruption - sauvegarde des recettes collectees...")
            break
        except Exception as e:
            print(f"\n  [!] Erreur inattendue pour '{nom_cat}' : {e}")
            stats[nom_cat] = {"retenues": 0, "filtrees": 0}
            continue
        finally:
            # Sauvegarde incrementale apres chaque categorie
            if toutes_recettes:
                _sauvegarder(toutes_recettes, stats)

    # Sauvegarde finale
    _sauvegarder(toutes_recettes, stats)

    # Résumé final
    recettes_uniques = list({r["url"]: r for r in toutes_recettes}.values())
    total_retenues = len(recettes_uniques)
    total_filtrees = sum(s["filtrees"] for s in stats.values())

    print(f"\n{'='*60}")
    print(f"TERMINE - {total_retenues} recettes sauvegardees dans {OUTPUT_FILE.name}")
    print(f"{'='*60}")
    print(f"\n{'CUISINE':<18} {'RETENUES':>10} {'FILTREES (porc)':>16} {'PAGES':>7}")
    print("-" * 55)
    for cat in CATEGORIES:
        s = stats.get(cat, {"retenues": 0, "filtrees": 0})
        pages = MAX_PAGES_PAR_CATEGORIE[cat]
        print(f"  {cat:<16} {s['retenues']:>10} {s['filtrees']:>16} {pages:>7}")
    print("-" * 55)
    print(f"  {'TOTAL':<16} {total_retenues:>10} {total_filtrees:>16}")
    print(f"\n  Fichier : {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
