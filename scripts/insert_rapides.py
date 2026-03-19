"""Insert 10 recettes express midi semaine (≤15 min total) dans Supabase.
Cuisines : française ou italienne uniquement (contrainte slot déjeuner semaine).
"""

import json
import os
import urllib.request
import urllib.error
import urllib.parse

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://zbbachjfmcmzunbsovps.supabase.co")
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

RECETTES = [
    {
        "nom": "Wraps poulet maison au durum",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "10 min",
        "temps_cuisson": "5 min",
        "temps_total": "15 min",
        "nb_personnes": "2",
        "calories": "370 kcal",
        "difficulte": "facile",
        "ingredients": ["2 wraps durum", "150 g blanc de poulet émincé", "1 tomate", "salade verte",
                        "1 c.s. sauce yaourt à l'ail", "paprika", "sel", "poivre"],
        "instructions": [
            "Faire dorer le poulet émincé 5 min avec paprika, sel et poivre.",
            "Étaler la sauce yaourt sur les wraps.",
            "Garnir de poulet, tomate et salade. Rouler et couper en deux.",
        ],
    },
    {
        "nom": "Pâtes pesto basilic express",
        "cuisine": "italienne",
        "type": "plat",
        "temps_prep": "2 min",
        "temps_cuisson": "10 min",
        "temps_total": "12 min",
        "nb_personnes": "2",
        "calories": "430 kcal",
        "difficulte": "facile",
        "ingredients": ["200 g pâtes", "4 c.s. pesto basilic", "parmesan râpé", "sel"],
        "instructions": [
            "Cuire les pâtes al dente dans l'eau bouillante salée.",
            "Égoutter en gardant 2 c.s. d'eau de cuisson.",
            "Mélanger avec le pesto et l'eau de cuisson. Parsemer de parmesan.",
        ],
    },
    {
        "nom": "Pâtes thon tomate express",
        "cuisine": "italienne",
        "type": "plat",
        "temps_prep": "3 min",
        "temps_cuisson": "10 min",
        "temps_total": "13 min",
        "nb_personnes": "2",
        "calories": "410 kcal",
        "difficulte": "facile",
        "ingredients": ["200 g pâtes", "1 boîte thon à l'huile", "200 g tomates pelées",
                        "1 gousse d'ail", "persil", "huile d'olive", "sel", "poivre"],
        "instructions": [
            "Cuire les pâtes al dente. Faire revenir l'ail 1 min dans l'huile.",
            "Ajouter tomates et thon, cuire 3 min.",
            "Mélanger avec les pâtes, parsemer de persil.",
        ],
    },
    {
        "nom": "Riz sauté légumes œuf",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "10 min",
        "temps_total": "15 min",
        "nb_personnes": "2",
        "calories": "380 kcal",
        "difficulte": "facile",
        "ingredients": ["250 g riz cuit (veille)", "2 œufs", "1 carotte râpée", "1 oignon",
                        "sauce soja halal", "huile", "sel", "poivre"],
        "instructions": [
            "Faire revenir l'oignon 2 min dans l'huile, ajouter la carotte.",
            "Ajouter le riz froid, mélanger 3 min à feu vif.",
            "Pousser sur le côté, brouiller les œufs, mélanger. Assaisonner à la sauce soja.",
        ],
    },
    {
        "nom": "Quesadillas poulet fromage",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "6 min",
        "temps_total": "11 min",
        "nb_personnes": "2",
        "calories": "390 kcal",
        "difficulte": "facile",
        "ingredients": ["4 tortillas", "150 g blanc de poulet cuit émincé",
                        "80 g fromage râpé", "1/2 oignon", "cumin", "sel"],
        "instructions": [
            "Répartir poulet, fromage et oignon sur 2 tortillas. Couvrir avec les 2 autres.",
            "Cuire 3 min de chaque côté dans une poêle chaude sans matière grasse.",
            "Couper en triangles et servir aussitôt.",
        ],
    },
    {
        "nom": "Salade de pâtes thon maïs",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "10 min",
        "temps_total": "15 min",
        "nb_personnes": "2",
        "calories": "350 kcal",
        "difficulte": "facile",
        "ingredients": ["200 g pâtes courtes", "1 boîte thon", "1 boîte maïs",
                        "2 c.s. mayonnaise légère", "cornichons", "sel", "poivre"],
        "instructions": [
            "Cuire les pâtes, rincer à l'eau froide.",
            "Mélanger avec thon, maïs, cornichons et mayonnaise.",
            "Assaisonner et réfrigérer si possible 10 min avant service.",
        ],
    },
    {
        "nom": "Nouilles sautées légumes",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "8 min",
        "temps_total": "13 min",
        "nb_personnes": "2",
        "calories": "360 kcal",
        "difficulte": "facile",
        "ingredients": ["200 g nouilles de riz", "1 courgette", "1 carotte", "1 oignon",
                        "2 c.s. sauce soja halal", "1 c.c. huile de sésame", "huile", "sel"],
        "instructions": [
            "Réhydrater les nouilles 5 min dans l'eau bouillante, égoutter.",
            "Faire sauter les légumes émincés 5 min à feu vif.",
            "Ajouter les nouilles, sauce soja et huile de sésame. Mélanger 2 min.",
        ],
    },
    {
        "nom": "Riz basmati poulet curry express",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "10 min",
        "temps_total": "15 min",
        "nb_personnes": "2",
        "calories": "420 kcal",
        "difficulte": "facile",
        "ingredients": ["250 g riz basmati cuit", "150 g blanc de poulet cuit",
                        "100 ml crème de coco", "1 c.c. curry doux", "1 oignon", "sel"],
        "instructions": [
            "Faire revenir l'oignon 2 min, ajouter le poulet en dés et le curry.",
            "Verser la crème de coco, cuire 5 min à feu moyen.",
            "Servir sur le riz basmati chaud.",
        ],
    },
    {
        "nom": "Pâtes beurre parmesan express",
        "cuisine": "italienne",
        "type": "plat",
        "temps_prep": "1 min",
        "temps_cuisson": "10 min",
        "temps_total": "11 min",
        "nb_personnes": "2",
        "calories": "400 kcal",
        "difficulte": "facile",
        "ingredients": ["200 g pâtes", "30 g beurre", "50 g parmesan râpé",
                        "poivre noir", "sel"],
        "instructions": [
            "Cuire les pâtes al dente, réserver 3 c.s. d'eau de cuisson.",
            "Hors du feu, mélanger avec le beurre, l'eau de cuisson et le parmesan.",
            "Poivrer généreusement et servir aussitôt.",
        ],
    },
    {
        "nom": "Wrap falafel salade",
        "cuisine": "française",
        "type": "plat",
        "temps_prep": "5 min",
        "temps_cuisson": "8 min",
        "temps_total": "13 min",
        "nb_personnes": "2",
        "calories": "340 kcal",
        "difficulte": "facile",
        "ingredients": ["2 wraps", "8 falafels (surgelés)", "salade verte", "tomate",
                        "sauce tahini", "citron", "sel"],
        "instructions": [
            "Cuire les falafels au four 8 min selon indication.",
            "Préparer la sauce : tahini + jus de citron + sel + un peu d'eau.",
            "Garnir les wraps de salade, tomate, falafels et sauce tahini.",
        ],
    },
]


def main():
    if not SERVICE_KEY:
        print("ERREUR : SUPABASE_SERVICE_ROLE_KEY non défini")
        return

    base_url = f"{SUPABASE_URL}/rest/v1/recettes"
    headers = {
        "apikey":        SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    }

    # Vérifier lesquels existent déjà via filtre IN sur les noms encodés
    noms_encoded = urllib.parse.quote(",".join(f'"{r["nom"]}"' for r in RECETTES))
    check_url = f"{base_url}?select=nom&nom=in.({noms_encoded})"
    existing_names: set[str] = set()
    req_check = urllib.request.Request(check_url, headers=headers)
    try:
        with urllib.request.urlopen(req_check) as resp:
            for row in json.loads(resp.read().decode()):
                existing_names.add(row["nom"])
    except Exception as e:
        print(f"  Avertissement vérification : {e}")

    to_insert = [r for r in RECETTES if r["nom"] not in existing_names]
    if not to_insert:
        print(f"  Toutes les recettes express existent déjà ({len(existing_names)}/10).")
        return

    headers_post = {**headers, "Content-Type": "application/json", "Prefer": "return=representation"}
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
