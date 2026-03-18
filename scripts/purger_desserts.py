"""
Supprime de Supabase toutes les recettes dont le NOM contient un des mots-clés
de pâtisserie / dessert / non-plat. Affiche la liste avant suppression.
"""
import os, sys, json, time
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://zbbachjfmcmzunbsovps.supabase.co")
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

# Mots-clés → suppression si le NOM de la recette les contient
MOTS_CLES = [
    "brioche", "cake", "muffin", "cookie", "brownie",
    "tarte", "clafoutis", "flan", "crème brûlée", "creme brulee",
    "tiramisu", "cheesecake", "verrine", "socca", "boule de coco",
    "makroud", "makrout", "chebakia", "ghriba", "baghrir",
    "msemen", "sablé", "biscuit", "financier", "madeleine",
    "galette sucrée", "far breton", "kouign",
]

def get_all_recettes():
    url = f"{SUPABASE_URL}/rest/v1/recettes?select=id,nom,type&limit=1000"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def supprimer_recette(recette_id):
    url = f"{SUPABASE_URL}/rest/v1/recettes?id=eq.{recette_id}"
    req = urllib.request.Request(url, headers=HEADERS, method="DELETE")
    with urllib.request.urlopen(req) as r:
        return r.status

def correspond(nom):
    n = nom.lower()
    for kw in MOTS_CLES:
        if kw in n:
            return kw
    return None

def main():
    print("Chargement des recettes...")
    recettes = get_all_recettes()
    print(f"{len(recettes)} recettes trouvées.\n")

    a_supprimer = []
    for r in recettes:
        kw = correspond(r["nom"])
        if kw:
            a_supprimer.append((r["id"], r["nom"], r["type"], kw))

    print(f"{len(a_supprimer)} recettes à supprimer :\n")
    for _, nom, typ, kw in a_supprimer:
        print(f"  [{typ:8s}] ({kw}) {nom}")

    if not a_supprimer:
        print("Rien à supprimer.")
        return

    print(f"\nSuppression en cours...")
    ok = erreurs = 0
    for rid, nom, typ, kw in a_supprimer:
        status = supprimer_recette(rid)
        if status in (200, 204):
            ok += 1
        else:
            erreurs += 1
            print(f"  [ERR {status}] {nom}")
        time.sleep(0.05)

    print(f"\n{'='*55}")
    print(f"Terminé : {ok} recettes supprimées, {erreurs} erreurs")
    print(f"{'='*55}")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
