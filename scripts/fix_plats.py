"""
Recatégorise définitivement en type='dessert' les recettes qui ne sont pas
des plats principaux nourrissants (pâtisseries, entremets, entrées froides…).
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

# Mots-clés → forcer type='dessert'
FORCER_DESSERT = [
    "socca", "brioche", "boule de coco", "verrine",
    "financier", "madeleine", "muffin", "cookie", "brownie",
    "flan", "crème brûlée", "creme brulee", "panna cotta", "tiramisu",
    "cheesecake", "tarte sucrée", "clafoutis", "far breton",
    "kouign", "galette sucrée",
    # cake déjà dans categoriser mais on force ici aussi
    " cake", "cake ",
]

def get_all_recettes():
    url = f"{SUPABASE_URL}/rest/v1/recettes?select=id,nom,type&limit=1000"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def update_type(recette_id, type_val):
    url  = f"{SUPABASE_URL}/rest/v1/recettes?id=eq.{recette_id}"
    data = json.dumps({"type": type_val}).encode()
    req  = urllib.request.Request(url, data=data, headers=HEADERS, method="PATCH")
    with urllib.request.urlopen(req) as r:
        return r.status

def main():
    print("Chargement des recettes...")
    recettes = get_all_recettes()
    print(f"{len(recettes)} recettes trouvées.\n")

    mis_a_jour = []

    for r in recettes:
        nom_lower = r["nom"].lower()
        for kw in FORCER_DESSERT:
            if kw in nom_lower:
                if r["type"] != "dessert":
                    status = update_type(r["id"], "dessert")
                    mis_a_jour.append(r["nom"])
                    print(f"  [{status}] → dessert : {r['nom']}")
                    time.sleep(0.05)
                break

    print(f"\nTerminé : {len(mis_a_jour)} recettes recatégorisées en dessert.")
    if mis_a_jour:
        for n in mis_a_jour:
            print(f"  - {n}")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
