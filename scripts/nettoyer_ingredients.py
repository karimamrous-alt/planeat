"""
Nettoie TOUTES les recettes en base : parse le champ ingredients quel que soit
son format (objet 750g avec raw/singular/quantity/unit, objet simple nom/quantite/unite,
string brute, JSON stringifié dans le champ nom…) et reconstruit un tableau propre
[{"nom": "...", "quantite": "...", "unite": "..."}].
"""
import os, sys, json, re, time
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://zbbachjfmcmzunbsovps.supabase.co")
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

# ── Extraction d'un ingrédient ────────────────────────────────────────────────

def extraire_ingredient(ing):
    """
    Retourne {nom, quantite, unite} ou None.
    Priorité : raw > singular+quantity+unit > nom > texte brut.
    """
    # String brute → tenter de parser en JSON d'abord
    if isinstance(ing, str):
        t = ing.strip()
        if t.startswith('{'):
            try:
                ing = json.loads(t)
                # continue vers le traitement dict
            except json.JSONDecodeError:
                nom = t
                if not nom or len(nom) < 2 or len(nom) > 200: return None
                return {"nom": nom, "quantite": "", "unite": ""}
        else:
            nom = t
            if not nom or len(nom) < 2 or len(nom) > 200: return None
            return {"nom": nom, "quantite": "", "unite": ""}

    if not isinstance(ing, dict): return None

    # ── Extraction depuis un dict ──────────────────────────────────────────

    raw      = str(ing.get("raw")      or "").strip()
    singular = str(ing.get("singular") or "").strip()

    # quantity peut être int, float ou string
    qty_val  = ing.get("quantity")
    quantite = ""
    if qty_val is not None and str(qty_val) not in ("None", "0", ""):
        quantite = str(qty_val).rstrip("0").rstrip(".")  # "1.0" → "1"
        try:
            f = float(quantite.replace(",", "."))
            quantite = str(int(f)) if f == int(f) else str(round(f, 2))
        except ValueError:
            pass

    unit_obj = ing.get("unit")
    unite    = ""
    if isinstance(unit_obj, dict):
        unite = str(unit_obj.get("abbr") or unit_obj.get("singular") or "").strip()
    elif isinstance(unit_obj, str):
        unite = unit_obj.strip()
    if unite in ("None", "null"): unite = ""

    # ── Choix du nom ──────────────────────────────────────────────────────

    nom = ""
    quantite_out = quantite
    unite_out    = unite

    if singular and (quantite or unite):
        # Format 750g structuré complet : nom propre + quantité + unité
        nom = singular[0].upper() + singular[1:] if singular else ""
    elif singular:
        nom = singular[0].upper() + singular[1:] if singular else ""
        quantite_out = unite_out = ""
    elif raw:
        nom = raw
        quantite_out = unite_out = ""
    else:
        # Fallback : champ nom (peut être un JSON stringifié)
        nom_field = str(ing.get("nom") or ing.get("name") or "").strip()
        if nom_field.startswith('{'):
            try:
                inner     = json.loads(nom_field)
                nom_inner = str(inner.get("raw") or inner.get("singular") or inner.get("nom") or "").strip()
                if nom_inner:
                    nom = nom_inner
            except Exception:
                pass
        elif nom_field:
            nom          = nom_field
            quantite_out = str(ing.get("quantite") or "").strip()
            unite_out    = str(ing.get("unite")    or "").strip()

    # ── Sanity checks ─────────────────────────────────────────────────────

    if not nom or len(nom) < 2 or len(nom) > 200: return None
    if nom.startswith('{') or nom.startswith('['): return None
    if re.search(r'\bicon\b', nom, re.IGNORECASE): return None
    if re.match(r'^[\d\s.,/]+$', nom): return None

    return {
        "nom":      nom,
        "quantite": quantite_out if quantite_out not in ("None", "null") else "",
        "unite":    unite_out    if unite_out    not in ("None", "null") else "",
    }

# ── Nettoyage d'une recette ───────────────────────────────────────────────────

def nettoyer_recette(rec):
    raw_field = rec.get("ingredients")
    if not raw_field: return None

    # raw_field est déjà une liste Python (Supabase renvoie du JSON parsé)
    if isinstance(raw_field, list):
        items = raw_field
    elif isinstance(raw_field, str):
        try:
            parsed = json.loads(raw_field)
            items  = parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            return None
    else:
        return None

    seen    = set()
    propres = []
    for item in items:
        ing = extraire_ingredient(item)
        if not ing: continue
        key = ing["nom"].lower().strip()
        if key in seen: continue
        seen.add(key)
        propres.append(ing)

    return propres if propres else None

# ── Supabase ──────────────────────────────────────────────────────────────────

def get_all_recettes():
    url = f"{SUPABASE_URL}/rest/v1/recettes?select=id,nom,ingredients&limit=1000"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def update_ingredients(recette_id, ingredients):
    url  = f"{SUPABASE_URL}/rest/v1/recettes?id=eq.{recette_id}"
    data = json.dumps({"ingredients": ingredients}).encode()
    req  = urllib.request.Request(url, data=data, headers=HEADERS, method="PATCH")
    with urllib.request.urlopen(req) as r:
        return r.status

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Chargement des recettes...")
    recettes = get_all_recettes()
    print(f"{len(recettes)} recettes trouvées.\n")

    ok = erreurs = ignores = 0

    for i, rec in enumerate(recettes, 1):
        propres = nettoyer_recette(rec)

        if propres is None:
            ignores += 1
            continue

        status = update_ingredients(rec["id"], propres)
        if status in (200, 204):
            ok += 1
        else:
            erreurs += 1
            print(f"  [ERR {status}] {rec['nom']}")

        if i % 50 == 0:
            print(f"  {i}/{len(recettes)} traités…")
        time.sleep(0.04)

    print(f"\n{'='*55}")
    print(f"Terminé : {ok} recettes nettoyées, {ignores} ignorées (vides), {erreurs} erreurs")
    print(f"{'='*55}")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
