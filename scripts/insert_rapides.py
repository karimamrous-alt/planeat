"""Insert 10 recettes express (≤15 min) dans Supabase."""

import json
import os
import urllib.request

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://zbbachjfmcmzunbsovps.supabase.co")
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

RECETTES = [
    {
        "nom": "Wrap au poulet express",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "10 min",
        "temps_cuisson": "5 min",
        "nb_personnes": "2",
        "calories": "380 kcal",
        "difficulte": "facile",
        "ingredients": ["2 wraps", "200 g blanc de poulet", "1 tomate", "salade verte", "1 c.s. sauce yaourt", "sel", "poivre"],
        "instructions": ["Faire griller le poulet 5 min à la poêle", "Couper en lamelles", "Garnir les wraps et rouler"],
    },
    {
        "nom": "Pâtes tomate mozzarella",
        "cuisine": "italienne",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "10 min",
        "nb_personnes": "4",
        "calories": "450 kcal",
        "difficulte": "facile",
        "ingredients": ["400 g pâtes", "400 g tomates concassées", "200 g mozzarella", "basilic frais", "2 gousses d'ail", "huile d'olive", "sel", "poivre"],
        "instructions": ["Cuire les pâtes al dente", "Faire revenir l'ail dans l'huile, ajouter les tomates 5 min", "Mélanger pâtes + sauce + mozzarella"],
    },
    {
        "nom": "Salade César au poulet",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "10 min",
        "temps_cuisson": "5 min",
        "nb_personnes": "2",
        "calories": "320 kcal",
        "difficulte": "facile",
        "ingredients": ["2 blancs de poulet", "1 laitue romaine", "parmesan râpé", "croûtons", "sauce César", "citron"],
        "instructions": ["Griller le poulet 5 min et couper en lanières", "Mélanger la laitue, les croûtons et le parmesan", "Napper de sauce César et ajouter le poulet"],
    },
    {
        "nom": "Omelette provençale",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "8 min",
        "nb_personnes": "2",
        "calories": "280 kcal",
        "difficulte": "facile",
        "ingredients": ["4 œufs", "1 tomate", "1/2 poivron", "herbes de Provence", "huile d'olive", "sel", "poivre"],
        "instructions": ["Faire revenir poivron et tomate 3 min", "Battre les œufs avec les herbes, verser sur les légumes", "Cuire 4-5 min à feu moyen"],
    },
    {
        "nom": "Riz pilaf aux épices",
        "cuisine": "indienne",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "15 min",
        "nb_personnes": "4",
        "calories": "360 kcal",
        "difficulte": "facile",
        "ingredients": ["300 g riz basmati", "1 oignon", "1 c.c. curcuma", "1 c.c. cumin", "2 gousses d'ail", "bouillon de légumes", "huile", "coriandre"],
        "instructions": ["Faire revenir oignon et épices 2 min", "Ajouter le riz et nacrer 1 min", "Couvrir de bouillon 2x volume et cuire 12 min à couvert"],
    },
    {
        "nom": "Soupe de lentilles rapide",
        "cuisine": "marocaine",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "15 min",
        "nb_personnes": "6",
        "calories": "290 kcal",
        "difficulte": "facile",
        "ingredients": ["400 g lentilles corail", "2 tomates", "1 oignon", "1 c.c. cumin", "1 c.c. curcuma", "1 c.c. paprika", "ail", "citron", "huile d'olive"],
        "instructions": ["Faire revenir oignon et épices 2 min", "Ajouter lentilles, tomates et 1L d'eau", "Cuire 15 min, mixer partiellement, presser le citron"],
    },
    {
        "nom": "Poulet citron grillé",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "10 min",
        "nb_personnes": "4",
        "calories": "310 kcal",
        "difficulte": "facile",
        "ingredients": ["4 blancs de poulet", "2 citrons", "3 gousses d'ail", "thym", "huile d'olive", "sel", "poivre"],
        "instructions": ["Badigeonner le poulet d'huile, ail, thym et jus de citron", "Griller à feu vif 5 min de chaque côté", "Servir avec des quartiers de citron"],
    },
    {
        "nom": "Quinoa aux légumes rôtis",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "10 min",
        "temps_cuisson": "15 min",
        "nb_personnes": "4",
        "calories": "340 kcal",
        "difficulte": "facile",
        "ingredients": ["300 g quinoa", "1 courgette", "1 poivron rouge", "1 oignon rouge", "huile d'olive", "herbes de Provence", "sel", "poivre"],
        "instructions": ["Cuire le quinoa 12 min dans l'eau bouillante salée", "Rôtir les légumes 15 min au four à 200°C avec huile et herbes", "Mélanger et assaisonner"],
    },
    {
        "nom": "Taboulé au poulet",
        "cuisine": "marocaine",
        "type": "plat",
        "temps_prep": "15 min",
        "temps_cuisson": "0 min",
        "nb_personnes": "4",
        "calories": "350 kcal",
        "difficulte": "facile",
        "ingredients": ["200 g semoule fine", "200 g blanc de poulet cuit", "tomates", "concombre", "menthe fraîche", "persil", "citron", "huile d'olive", "sel"],
        "instructions": ["Réhydrater la semoule avec de l'eau bouillante salée, laisser gonfler 5 min", "Égrainer à la fourchette avec huile et citron", "Ajouter légumes, poulet et herbes fraîches"],
    },
    {
        "nom": "Dal de lentilles express",
        "cuisine": "indienne",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "15 min",
        "nb_personnes": "6",
        "calories": "310 kcal",
        "difficulte": "facile",
        "ingredients": ["400 g lentilles corail", "400 ml lait de coco", "1 oignon", "2 gousses d'ail", "1 c.c. curcuma", "1 c.c. garam masala", "1 c.c. gingembre", "huile", "coriandre fraîche"],
        "instructions": ["Faire revenir oignon, ail et épices 3 min", "Ajouter lentilles et lait de coco + 200 ml eau", "Cuire 12 min à feu moyen en remuant, garnir de coriandre"],
    },
]


def main():
    if not SERVICE_KEY:
        print("ERREUR : SUPABASE_SERVICE_ROLE_KEY non défini")
        return

    base_url = f"{SUPABASE_URL}/rest/v1/recettes"
    headers_get = {
        "apikey":        SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    }
    headers_post = {
        **headers_get,
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }

    # Récupérer les noms existants
    existing_names = set()
    noms_filter = ",".join(f'"{r["nom"]}"' for r in RECETTES)
    check_url = base_url + f"?select=nom&nom=in.({noms_filter})"
    req_check = urllib.request.Request(check_url, headers=headers_get)
    try:
        with urllib.request.urlopen(req_check) as resp:
            for row in json.loads(resp.read().decode()):
                existing_names.add(row["nom"])
    except Exception as e:
        print(f"  Avertissement vérification : {e}")

    to_insert = [r for r in RECETTES if r["nom"] not in existing_names]
    if not to_insert:
        print(f"  Toutes les recettes express existent déjà ({len(existing_names)} trouvées).")
        return

    payload = json.dumps(to_insert).encode()
    req = urllib.request.Request(base_url, data=payload, headers=headers_post, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            inserted = json.loads(resp.read().decode())
            print(f"  {len(inserted)} recettes express insérées ({len(existing_names)} déjà présentes)")
    except urllib.error.HTTPError as e:
        print(f"  Erreur HTTP {e.code}: {e.read().decode()}")


if __name__ == "__main__":
    main()
