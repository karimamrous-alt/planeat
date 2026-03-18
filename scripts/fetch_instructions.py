"""
Récupère les instructions et images manquantes pour toutes les recettes en base.
Lit source_url, extrait recipeInstructions + image depuis JSON-LD, met à jour Supabase.
"""
import json, os, re, sys, time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import requests
from bs4 import BeautifulSoup

SUPABASE_URL = "https://zbbachjfmcmzunbsovps.supabase.co"
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DELAI        = 2.0

HEADERS_HTTP = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
}
HEADERS_SB = lambda: {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

# ── Fetch page ────────────────────────────────────────────────────────────────

def get(url: str) -> BeautifulSoup | None:
    for tentative in range(3):
        try:
            r = requests.get(url, headers=HEADERS_HTTP, timeout=15)
            if r.status_code == 429:
                time.sleep(30 * (tentative + 1)); continue
            if r.status_code in (404, 410, 403): return None
            r.raise_for_status()
            r.encoding = r.apparent_encoding
            return BeautifulSoup(r.text, "html.parser")
        except Exception as e:
            time.sleep(5 * (tentative + 1))
    return None

# ── JSON-LD extraction ────────────────────────────────────────────────────────

def extraire_json_ld(soup: BeautifulSoup) -> dict:
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") == "Recipe":
                        return item
            elif isinstance(data, dict):
                if data.get("@type") == "Recipe": return data
                for item in data.get("@graph", []):
                    if isinstance(item, dict) and item.get("@type") == "Recipe":
                        return item
        except: continue
    return {}

def extraire_instructions(ld: dict, soup: BeautifulSoup) -> list[str]:
    raw = ld.get("recipeInstructions", [])
    etapes = []

    if isinstance(raw, str):
        etapes = [raw.strip()] if raw.strip() else []
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, str):
                t = item.strip()
                if t: etapes.append(t)
            elif isinstance(item, dict):
                t = (item.get("text") or item.get("name") or "").strip()
                if t: etapes.append(t)
                # HowToSection contient des steps
                for step in item.get("itemListElement", []):
                    if isinstance(step, dict):
                        s = (step.get("text") or step.get("name") or "").strip()
                        if s: etapes.append(s)

    if etapes:
        return etapes

    # Fallback HTML : chercher des listes d'étapes
    for sel in [
        "[class*='instruction' i] li",
        "[class*='step' i] li",
        "[class*='preparation' i] li",
        "[class*='etape' i]",
        ".recipe-instructions li",
        ".wprm-recipe-instruction-text",
        ".tasty-recipes-instructions li",
    ]:
        items = soup.select(sel)
        if items:
            return [i.get_text(separator=" ", strip=True) for i in items if i.get_text(strip=True)]

    return []

def extraire_image(ld: dict) -> str:
    img = ld.get("image", "")
    if isinstance(img, str): return img
    if isinstance(img, list) and img:
        first = img[0]
        if isinstance(first, str): return first
        if isinstance(first, dict): return first.get("url", "")
    if isinstance(img, dict): return img.get("url", "")
    return ""

# ── Supabase ──────────────────────────────────────────────────────────────────

def get_recettes_sans_instructions(limit=1000) -> list[dict]:
    url = (f"{SUPABASE_URL}/rest/v1/recettes"
           f"?select=id,nom,source_url"
           f"&instructions=eq.[]"
           f"&source_url=not.is.null"
           f"&limit={limit}")
    r = requests.get(url, headers=HEADERS_SB(), timeout=30)
    return r.json() if r.status_code == 200 else []

def update_recette(rec_id: str, instructions: list[str], image_url: str):
    url = f"{SUPABASE_URL}/rest/v1/recettes?id=eq.{rec_id}"
    payload = {"instructions": instructions}
    if image_url:
        payload["image_url"] = image_url
    r = requests.patch(url, headers=HEADERS_SB(), json=payload, timeout=15)
    return r.status_code in (200, 204)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not SERVICE_KEY:
        print("[!] SUPABASE_SERVICE_ROLE_KEY manquant"); return

    print("Chargement des recettes sans instructions...")
    recettes = get_recettes_sans_instructions()
    print(f"{len(recettes)} recettes à traiter.\n")

    ok = erreur = sans_instr = 0

    for i, rec in enumerate(recettes, 1):
        url = rec.get("source_url", "")
        nom = rec.get("nom", "")[:50]
        print(f"[{i}/{len(recettes)}] {nom[:45]}", end=" ... ")
        sys.stdout.flush()

        if not url:
            print("(pas d'URL)")
            sans_instr += 1
            continue

        time.sleep(DELAI)
        soup = get(url)
        if not soup:
            print("inaccessible")
            sans_instr += 1
            continue

        ld = extraire_json_ld(soup)
        instructions = extraire_instructions(ld, soup)
        image_url    = extraire_image(ld)

        if not instructions:
            print("(aucune instruction trouvée)")
            sans_instr += 1
            # On met quand même l'image si disponible
            if image_url:
                update_recette(rec["id"], [], image_url)
            continue

        success = update_recette(rec["id"], instructions, image_url)
        if success:
            ok += 1
            print(f"✓ {len(instructions)} étapes{' + image' if image_url else ''}")
        else:
            erreur += 1
            print("erreur update")

        if i % 50 == 0:
            print(f"\n--- {i}/{len(recettes)} — {ok} OK, {sans_instr} sans instr, {erreur} erreurs ---\n")

    print(f"\n{'='*55}")
    print(f"Terminé : {ok} mises à jour, {sans_instr} sans instructions, {erreur} erreurs")
    print(f"{'='*55}")

if __name__ == "__main__":
    main()
