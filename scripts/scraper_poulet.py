"""
Scraper ptitchef.com — recettes de poulet
Fusion dans recettes.json (dédupliqué par URL et par nom normalisé)
"""

import json, os, re, sys, time
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────

OUTPUT_FILE = Path(__file__).parent / "recettes.json"
DELAI       = 2.5
MAX_PAGES   = 30
BASE        = "https://www.ptitchef.com"

HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# URL de base pour la catégorie poulet sur ptitchef.com
POULET_BASE_URL = "https://www.ptitchef.com/recettes/recettes-de-poulet"
POULET_PAGE_URL = "https://www.ptitchef.com/recettes/recettes-de-poulet-page-{page}"

# ── Catégorisation automatique ────────────────────────────────────────────────

CATEGORISATION = [
    ("marocaine", [
        "marocai", "tajine", "tagine", "couscous", "harira", "chermoula",
        "bastilla", "pastilla", "briouats", "kefta", "merguez", "ras el hanout",
        "rfissa", "msemen", "meloui", "chebakia", "makrout", "sellou",
        "m'hancha", "cornes de gazelle", "halwa", "zaalook", "zaalouk",
        "taktouka", "bissara", "loubia", "maakouda",
    ]),
    ("indienne", [
        "indien", "indienne", "curry", "tikka", "masala", "dal", "dahl",
        "biryani", "naan", "paneer", "samosa", "chutney", "korma",
        "vindaloo", "tandoori", "raita", "butter chicken", "palak",
        "aloo", "saag", "dosa", "idli", "chapati",
    ]),
    ("italienne", [
        "italie", "italian", "pasta", "pâtes", "pizza", "risotto", "gnocchi",
        "carbonara", "bolognaise", "pesto", "lasagne", "tiramisu", "bruschetta",
        "osso buco", "parmigiana", "cannelloni", "ravioli", "fettuccine",
        "tagliatelle", "linguine", "focaccia", "calzone", "polenta",
    ]),
    ("française", [
        "français", "france", "gratin", "quiche", "ratatouille",
        "pot-au-feu", "blanquette", "boeuf bourguignon", "tarte tatin",
        "crêpe", "crepe", "soufflé", "flamiche", "provençal", "lyonnais",
        "normand", "alsacien", "béchamel", "bechamel", "dauphinois",
    ]),
    ("asiatique", [
        "asiat", "chinois", "japonais", "thaï", "thai", "vietnamien",
        "wok", "soja", "gingembre", "citronnelle", "sauce hoisin",
        "sauce soja", "teriyaki", "yakitori", "pad thaï", "pho",
        "nem", "spring roll", "dim sum", "ramen", "udon", "miso",
    ]),
]

def detecter_cuisine(nom: str, ingredients: list) -> str:
    texte = (nom + " " + " ".join(
        i if isinstance(i, str) else (i.get("nom") or "")
        for i in ingredients
    )).lower()
    for cuisine, mots in CATEGORISATION:
        if any(m in texte for m in mots):
            return cuisine
    return "française"

# ── HTTP ──────────────────────────────────────────────────────────────────────

def get(url: str, retries: int = 3) -> BeautifulSoup | None:
    for tentative in range(retries):
        try:
            r = requests.get(url, headers=HTTP_HEADERS, timeout=15)
            if r.status_code == 429:
                attente = 30 * (tentative + 1)
                print(f"  [429] Pause {attente}s...")
                time.sleep(attente)
                continue
            if r.status_code in (404, 410):
                return None
            r.raise_for_status()
            r.encoding = r.apparent_encoding
            return BeautifulSoup(r.text, "html.parser")
        except requests.RequestException as e:
            print(f"  [!] Erreur ({tentative+1}/{retries}) → {e}")
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

def extraire_ingredients(ld: dict, soup: BeautifulSoup) -> list[str]:
    ings = ld.get("recipeIngredient", [])
    if ings:
        return [str(i).strip() for i in ings if str(i).strip()]
    for sel in ["[class*='ingredient' i] li", "[class*='ingredient' i]", ".ingredient li"]:
        items = soup.select(sel)
        if items:
            return [i.get_text(strip=True) for i in items if i.get_text(strip=True)]
    return []

def scraper_recette(url: str) -> dict | None:
    soup = get(url)
    if not soup:
        return None
    ld = extraire_json_ld(soup)
    h1 = soup.find("h1")
    nom = (ld.get("name") or (h1.get_text(strip=True) if h1 else "")).strip()[:100]
    if not nom:
        return None
    ingredients = extraire_ingredients(ld, soup)
    cuisine = detecter_cuisine(nom, ingredients)
    return {
        "nom":               nom,
        "categorie":         cuisine,
        "url":               url,
        "ingredients":       ingredients,
        "nb_ingredients":    len(ingredients),
        "temps_preparation": parse_duration(ld.get("prepTime", "")),
        "temps_cuisson":     parse_duration(ld.get("cookTime", "")),
        "temps_total":       parse_duration(ld.get("totalTime", "")),
        "nb_personnes":      str(ld.get("recipeYield", "") or ""),
        "calories":          re.sub(r"[^\d]", "", str(
            (ld.get("nutrition") or {}).get("calories", "") or ""
        )),
        "source":            "ptitchef_poulet",
    }

# ── Extraction des liens de recettes ─────────────────────────────────────────

RE_RECETTE_PTITCHEF = re.compile(r"^https://www\.ptitchef\.com/recettes/[a-z]+/[a-z0-9][a-z0-9\-]+-fid-\d+$")

def extraire_liens(soup: BeautifulSoup, urls_vues: set) -> list[str]:
    liens = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("http"):
            href = BASE + href
        if RE_RECETTE_PTITCHEF.match(href) and href not in urls_vues:
            urls_vues.add(href)
            liens.append(href)
    return liens

# ── Scraping des pages poulet ─────────────────────────────────────────────────

def scraper_poulet() -> list[dict]:
    print(f"\n{'='*55}")
    print(f"  ptitchef.com — recettes de poulet")
    print(f"{'='*55}")
    resultats = []
    urls_vues: set[str] = set()

    for n in range(1, MAX_PAGES + 1):
        url_page = POULET_BASE_URL if n == 1 else POULET_PAGE_URL.format(page=n)
        print(f"\n  Page {n} : {url_page}")
        soup = get(url_page)
        if not soup:
            print(f"  Page {n} inaccessible — fin.")
            break
        nouveaux = extraire_liens(soup, urls_vues)
        if not nouveaux:
            print(f"  Page {n} : aucun lien de recette trouvé — fin.")
            break
        print(f"  Page {n} → {len(nouveaux)} recettes trouvées")
        for i, url in enumerate(nouveaux, 1):
            print(f"    [{i}/{len(nouveaux)}] ", end="")
            sys.stdout.flush()
            time.sleep(DELAI)
            r = scraper_recette(url)
            if r:
                resultats.append(r)
                print(f"✓ [{r['categorie']}] {r['nom'][:50]}")
            else:
                print(f"— ignorée")
        time.sleep(DELAI * 2)

    print(f"\n  → {len(resultats)} recettes retenues")
    return resultats

# ── Fusion avec recettes.json ─────────────────────────────────────────────────

def normaliser(nom: str) -> str:
    return re.sub(r"\s+", " ", nom.lower().strip())

def fusionner(nouvelles: list[dict]) -> tuple[int, int]:
    existantes: list[dict] = []
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            data = json.load(f)
            existantes = data if isinstance(data, list) else data.get("recettes", [])

    urls_ex  = {r.get("url", "") for r in existantes}
    noms_ex  = {normaliser(r.get("nom", "")) for r in existantes}
    ajoutees = doublons = 0

    for r in nouvelles:
        url_r = r.get("url", "")
        nom_r = normaliser(r.get("nom", ""))
        if url_r in urls_ex or nom_r in noms_ex:
            doublons += 1
            continue
        existantes.append(r)
        urls_ex.add(url_r)
        noms_ex.add(nom_r)
        ajoutees += 1

    cats = {}
    for r in existantes:
        c = r.get("categorie", "?")
        cats[c] = cats.get(c, 0) + 1

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(
            {"meta": {"total": len(existantes), "categories": cats}, "recettes": existantes},
            f, ensure_ascii=False, indent=2,
        )
    print(f"\n  [fusion] {len(existantes)} recettes totales "
          f"({ajoutees} ajoutées, {doublons} doublons ignorés)")
    return ajoutees, doublons

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 55)
    print("Scraper poulet — ptitchef.com")
    print("=" * 55)

    try:
        nouvelles = scraper_poulet()
    except KeyboardInterrupt:
        print("\n[!] Interruption clavier — arrêt.")
        return

    if not nouvelles:
        print("\nAucune recette collectée.")
        return

    ajoutees, doublons = fusionner(nouvelles)

    print(f"\n{'='*55}")
    print(f"TERMINÉ — {ajoutees} ajoutées, {doublons} doublons ignorés")
    print(f"{'='*55}")

if __name__ == "__main__":
    main()
