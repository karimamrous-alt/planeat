"""
Scraper extra — CuisineAZ + recettedelicuisine.com
Catégories : marocaine, indienne, italienne, française, poulet, végétarien
Filtres stricts : sans porc, sans alcool, sans abats, sans fruits de mer, sans agneau
Fusion dans recettes.json (dédupliqué par URL et par nom normalisé)
"""

import json
import os
import re
import sys
import time
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────

OUTPUT_FILE = Path(__file__).parent / "recettes.json"
DELAI       = 2.5
MAX_PAGES   = 10

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Mots interdits (insensible à la casse, comparaison sur mots entiers)
MOTS_INTERDITS = {
    # Porc et dérivés
    "porc", "cochon", "jambon", "lardons", "lardon", "lard", "bacon",
    "pancetta", "chorizo", "saucisson", "andouille", "boudin", "rillettes",
    "coppa", "prosciutto", "salami", "pepperoni", "guanciale", "mortadelle",
    "sanglier", "charcuterie",
    # Alcool
    "alcool", "vin", "bière", "biere", "champagne", "cidre", "cognac",
    "rhum", "whisky", "vodka", "porto", "sake", "liqueur", "calvados",
    # Abats
    "abats", "foie", "rognons", "tripes", "cervelle", "langue", "gésier",
    "gesier", "coeur",
    # Fruits de mer
    "crevettes", "crevette", "homard", "langoustine", "moule", "palourde",
    "huître", "huitre", "calmar", "poulpe", "pieuvre", "seiche",
    "crabe", "langouste", "oursin", "bulot",
    # Agneau
    "agneau", "gigot", "méchoui", "mechoui",
}

# ── Catégorisation par mots-clés (pour recettedelicuisine.com) ───────────────

CATEGORISATION = [
    ("marocaine", [
        "marocai", "tajine", "tagine", "couscous", "harira", "chermoula",
        "bastilla", "pastilla", "briouats", "kefta", "merguez", "ras el hanout",
        "argan", "rfissa", "trid", "pastilla", "m'hancha", "chebakia",
    ]),
    ("indienne", [
        "indien", "indienne", "curry", "tikka", "masala", "dal", "dahl",
        "biryani", "naan", "paneer", "samosa", "chutney", "korma",
        "vindaloo", "tandoori", "raita", "lassi",
    ]),
    ("italienne", [
        "italie", "italian", "pasta", "pâtes", "pizza", "risotto", "gnocchi",
        "carbonara", "bolognaise", "pesto", "lasagne", "tiramisu", "bruschetta",
        "osso buco", "saltimbocca", "parmigiana", "cannelloni", "ravioli",
    ]),
    ("française", [
        "français", "france", "gratin", "quiche", "ratatouille", "bouillabaisse",
        "pot-au-feu", "blanquette", "boeuf bourguignon", "tarte tatin",
        "crêpe", "crepe", "soufflé", "flamiche", "provençal",
    ]),
    ("poulet", [
        "poulet", "dinde", "volaille", "blanc de poulet", "cuisse de poulet",
        "aile de poulet", "chicken",
    ]),
]

def detecter_categorie(nom: str, ingredients: list) -> str | None:
    """Retourne la première catégorie correspondante ou None."""
    texte = (nom + " " + " ".join(
        i if isinstance(i, str) else (i.get("nom") or "") for i in ingredients
    )).lower()
    for categorie, mots in CATEGORISATION:
        if any(m in texte for m in mots):
            return categorie
    return None

# ── Filtrage ──────────────────────────────────────────────────────────────────

def est_valide(nom: str, ingredients: list) -> bool:
    texte = (nom + " " + " ".join(
        i if isinstance(i, str) else (i.get("nom") or "") for i in ingredients
    )).lower()
    mots = set(re.findall(r"[a-zàâäéèêëîïôùûüç]+", texte))
    return not MOTS_INTERDITS.intersection(mots)

# ── HTTP ──────────────────────────────────────────────────────────────────────

def get(url: str, retries: int = 3) -> BeautifulSoup | None:
    for tentative in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 429:
                attente = 30 * (tentative + 1)
                print(f"  [429] Pause {attente}s...")
                time.sleep(attente)
                continue
            if r.status_code == 404:
                return None
            r.raise_for_status()
            r.encoding = r.apparent_encoding
            return BeautifulSoup(r.text, "html.parser")
        except requests.RequestException as e:
            print(f"  [!] Erreur ({tentative+1}/{retries}) {url} → {e}")
            time.sleep(5 * (tentative + 1))
    return None

# ── JSON-LD ───────────────────────────────────────────────────────────────────

def extraire_json_ld(soup: BeautifulSoup) -> dict:
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") == "Recipe":
                        return item
            elif isinstance(data, dict):
                if data.get("@type") == "Recipe":
                    return data
                # @graph
                for item in data.get("@graph", []):
                    if isinstance(item, dict) and item.get("@type") == "Recipe":
                        return item
        except (json.JSONDecodeError, AttributeError):
            continue
    return {}

def parse_duration(d: str) -> str:
    if not d:
        return ""
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", str(d))
    if not m:
        return ""
    h, mn = int(m.group(1) or 0), int(m.group(2) or 0)
    if h and mn:
        return f"{h}h{mn:02d}"
    if h:
        return f"{h}h"
    return f"{mn} min" if mn else ""

def extraire_ingredients(json_ld: dict, soup: BeautifulSoup) -> list[str]:
    ings = json_ld.get("recipeIngredient", [])
    if ings:
        return [str(i).strip() for i in ings if str(i).strip()]
    for sel in ["[class*='ingredient' i] li", "[class*='ingredient' i]", ".ingredient"]:
        items = soup.select(sel)
        if items:
            return [i.get_text(strip=True) for i in items if i.get_text(strip=True)]
    return []

def extraire_recette(soup: BeautifulSoup, url: str, categorie: str) -> dict | None:
    ld = extraire_json_ld(soup)
    nom = ld.get("name", "") or (soup.find("h1") or soup).get_text(strip=True)[:80]
    if not nom:
        return None
    ingredients = extraire_ingredients(ld, soup)
    if not est_valide(nom, ingredients):
        print(f"    [FILTRÉ] {nom}")
        return None
    return {
        "nom":              nom,
        "cuisine":          categorie,
        "url":              url,
        "ingredients":      ingredients,
        "nb_ingredients":   len(ingredients),
        "temps_preparation": parse_duration(ld.get("prepTime", "")),
        "temps_cuisson":    parse_duration(ld.get("cookTime", "")),
        "temps_total":      parse_duration(ld.get("totalTime", "")),
        "nb_personnes":     str(ld.get("recipeYield", "")),
        "calories":         re.sub(r"[^\d]", "", str(
            (ld.get("nutrition") or {}).get("calories", "") or ""
        )),
        "source":           "extra",
    }

# ── CuisineAZ ─────────────────────────────────────────────────────────────────

CAZ_CATEGORIES = {
    "marocaine":   "https://www.cuisineaz.com/recettes/cuisine-marocaine-{n}.aspx",
    "indienne":    "https://www.cuisineaz.com/recettes/cuisine-indienne-{n}.aspx",
    "italienne":   "https://www.cuisineaz.com/recettes/cuisine-italienne-{n}.aspx",
    "française":   "https://www.cuisineaz.com/recettes/cuisine-francaise-{n}.aspx",
    "poulet":      "https://www.cuisineaz.com/recettes/poulet-{n}.aspx",
    "végétarien":  "https://www.cuisineaz.com/recettes/vegetarien-{n}.aspx",
}

RE_CAZ_RECETTE = re.compile(r"https://www\.cuisineaz\.com/recettes/[^/]+-\d+\.aspx")

def extraire_liens_caz(soup: BeautifulSoup) -> list[str]:
    vus, liens = set(), []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("http"):
            href = "https://www.cuisineaz.com" + href
        if RE_CAZ_RECETTE.match(href) and href not in vus:
            vus.add(href)
            liens.append(href)
    return liens

def scraper_cuisineaz() -> list[dict]:
    resultats = []
    for cat, url_tpl in CAZ_CATEGORIES.items():
        print(f"\n[CuisineAZ] {cat.upper()}")
        urls_vues: set[str] = set()
        for n in range(1, MAX_PAGES + 1):
            url_page = url_tpl.format(n=n)
            soup = get(url_page)
            if not soup:
                print(f"  Page {n} inaccessible, fin.")
                break
            liens = extraire_liens_recettes_caz(soup)
            nouveaux = [l for l in liens if l not in urls_vues]
            if not nouveaux and n > 1:
                print(f"  Page {n} identique — fin.")
                break
            urls_vues.update(liens)
            print(f"  Page {n} → {len(nouveaux)} nouvelles recettes")
            for url in nouveaux:
                time.sleep(DELAI)
                s = get(url)
                if not s:
                    continue
                r = extraire_recette(s, url, cat)
                if r:
                    resultats.append(r)
                    print(f"    ✓ {r['nom'][:60]}")
            time.sleep(DELAI * 2)
    return resultats

def extraire_liens_recettes_caz(soup: BeautifulSoup) -> list[str]:
    vus, liens = set(), []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("http"):
            href = "https://www.cuisineaz.com" + href
        if RE_CAZ_RECETTE.match(href) and href not in vus:
            vus.add(href)
            liens.append(href)
    return liens

# ── recettedelicuisine.com ────────────────────────────────────────────────────

RDC_CATEGORIES_PAGES = [
    "https://recettedelicuisine.com/les-sales/",
    "https://recettedelicuisine.com/les-sucres/",
]

RE_RDC_RECETTE = re.compile(r"^https://recettedelicuisine\.com/[a-z0-9][a-z0-9\-]+/$")

def extraire_liens_rdc(soup: BeautifulSoup) -> list[str]:
    vus, liens = set(), []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if RE_RDC_RECETTE.match(href) and href not in vus:
            # Exclure les pages de catégorie connues
            if not any(href.endswith(c) for c in [
                "/les-sales/", "/les-sucres/", "/comme-au-supermarche/",
                "/idees-repas/", "/pains-et-brioches/",
            ]):
                vus.add(href)
                liens.append(href)
    return liens

def scraper_rdc() -> list[dict]:
    resultats = []
    for base_url in RDC_CATEGORIES_PAGES:
        print(f"\n[recettedelicuisine.com] {base_url}")
        urls_vues: set[str] = set()
        for n in range(1, MAX_PAGES + 1):
            url_page = base_url if n == 1 else f"{base_url}page/{n}/"
            soup = get(url_page)
            if not soup:
                print(f"  Page {n} inaccessible, fin.")
                break
            liens = extraire_liens_rdc(soup)
            nouveaux = [l for l in liens if l not in urls_vues]
            if not nouveaux and n > 1:
                print(f"  Page {n} vide — fin.")
                break
            urls_vues.update(liens)
            print(f"  Page {n} → {len(nouveaux)} nouvelles recettes")
            for url in nouveaux:
                time.sleep(DELAI)
                s = get(url)
                if not s:
                    continue
                ld = extraire_json_ld(s)
                nom = ld.get("name", "") or (s.find("h1") or s).get_text(strip=True)[:80]
                ingredients = extraire_ingredients(ld, s)
                # Catégoriser par mots-clés
                cat = detecter_categorie(nom, ingredients)
                if not cat:
                    continue   # Pas dans nos catégories cibles
                r = extraire_recette(s, url, cat)
                if r:
                    resultats.append(r)
                    print(f"    ✓ [{cat}] {r['nom'][:55]}")
            time.sleep(DELAI * 2)
    return resultats

# ── Fusion avec recettes.json ─────────────────────────────────────────────────

def normaliser_nom(nom: str) -> str:
    return re.sub(r"\s+", " ", nom.lower().strip())

def fusionner(nouvelles: list[dict]) -> tuple[int, int]:
    """Charge recettes.json, fusionne, sauvegarde. Retourne (ajoutées, doublons)."""
    existantes: list[dict] = []
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            data = json.load(f)
            existantes = data.get("recettes", [])

    urls_existantes  = {r.get("url", "") for r in existantes}
    noms_existants   = {normaliser_nom(r.get("nom", "")) for r in existantes}

    ajoutees, doublons = 0, 0
    for r in nouvelles:
        url_r = r.get("url", "")
        nom_r = normaliser_nom(r.get("nom", ""))
        if url_r in urls_existantes or nom_r in noms_existants:
            doublons += 1
            continue
        # Mapper vers le format attendu par import_recettes.py
        existantes.append({
            "nom":             r["nom"],
            "categorie":       r["cuisine"],
            "url":             url_r,
            "ingredients":     r["ingredients"],
            "nb_ingredients":  r["nb_ingredients"],
            "temps_preparation": r["temps_preparation"],
            "temps_cuisson":   r["temps_cuisson"],
            "temps_total":     r["temps_total"],
            "nb_personnes":    r["nb_personnes"],
            "calories":        r["calories"],
            "source":          r.get("source", "extra"),
        })
        urls_existantes.add(url_r)
        noms_existants.add(nom_r)
        ajoutees += 1

    # Compter par catégorie
    cats = {}
    for r in existantes:
        cat = r.get("categorie", "?")
        cats[cat] = cats.get(cat, 0) + 1

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"meta": {"total": len(existantes), "categories": cats}, "recettes": existantes},
                  f, ensure_ascii=False, indent=2)
    print(f"\n  [fusion] {OUTPUT_FILE}: {len(existantes)} recettes totales ({ajoutees} ajoutées, {doublons} doublons ignorés)")
    return ajoutees, doublons

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Scraper Extra — CuisineAZ + recettedelicuisine.com")
    print("=" * 60)

    nouvelles: list[dict] = []

    print("\n[1/2] Scraping CuisineAZ...")
    try:
        r_caz = scraper_cuisineaz()
        print(f"\n  → CuisineAZ : {len(r_caz)} recettes collectées")
        nouvelles.extend(r_caz)
    except KeyboardInterrupt:
        print("\n[!] Interruption CuisineAZ")
    except Exception as e:
        print(f"  [!] Erreur CuisineAZ : {e}")

    print("\n[2/2] Scraping recettedelicuisine.com...")
    try:
        r_rdc = scraper_rdc()
        print(f"\n  → recettedelicuisine.com : {len(r_rdc)} recettes collectées")
        nouvelles.extend(r_rdc)
    except KeyboardInterrupt:
        print("\n[!] Interruption recettedelicuisine")
    except Exception as e:
        print(f"  [!] Erreur recettedelicuisine : {e}")

    print(f"\nTotal collecté : {len(nouvelles)} recettes")
    print("\nFusion avec recettes.json...")
    ajoutees, doublons = fusionner(nouvelles)

    print(f"\n{'='*60}")
    print(f"TERMINÉ — {ajoutees} recettes ajoutées, {doublons} doublons ignorés")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
