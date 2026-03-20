"""
PlanEat v1.0.0 — Setup complet
- Vide les tables existantes (DELETE)
- Insère 42 recettes propres + famille + membres

Prérequis : exécuter d'abord scripts/schema.sql dans le dashboard Supabase.
"""

import json, os, urllib.request, urllib.error, urllib.parse

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://zbbachjfmcmzunbsovps.supabase.co")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

FAMILLE_ID = "e857128f-7da2-4e00-832e-58169161be40"

# ── Helpers ────────────────────────────────────────────────────────────────────

def req(method, table, data=None, params=""):
    url = f"{URL}/rest/v1/{table}{params}"
    headers = {
        "apikey": KEY, "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json", "Prefer": "return=minimal",
    }
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        print(f"  ERR {method} {table}: {e.code} {e.read().decode()[:200]}")
        return None

def delete_all(table):
    req("DELETE", table, params="?id=not.is.null")
    print(f"  ✓ {table} vidée")

def insert(table, rows):
    if not rows: return
    headers = {
        "apikey": KEY, "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    }
    url = f"{URL}/rest/v1/{table}"
    body = json.dumps(rows if isinstance(rows, list) else [rows]).encode()
    r = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(r) as resp:
            result = json.loads(resp.read())
            print(f"  ✓ {len(result)} lignes insérées dans {table}")
            return result
    except urllib.error.HTTPError as e:
        print(f"  ERR INSERT {table}: {e.code} {e.read().decode()[:300]}")
        return None

# ── Recettes ───────────────────────────────────────────────────────────────────

def ing(nom, quantite="", unite=""):
    d = {"nom": nom}
    if quantite: d["quantite"] = quantite
    if unite:    d["unite"]    = unite
    return d

RECETTES = [

  # ── RAPIDES midi semaine (max 15 min total) ─────────────────────────────────

  {
    "nom": "Wrap poulet grillé durum",
    "cuisine": "rapide", "type": "plat",
    "temps_prep": 5, "temps_cuisson": 5, "calories": 400, "personnes": 2,
    "niveau_epices": "doux", "saison": [],
    "tags": ["poulet", "rapide", "midi"],
    "ingredients": [
      ing("blanc de poulet", "150", "g"),
      ing("wraps durum", "2"),
      ing("salade verte", "2", "feuilles"),
      ing("tomate", "1"),
      ing("sauce yaourt citron", "2", "c.s."),
      ing("cumin", "1", "c.c."),
    ],
    "instructions": [
      "Émincer le poulet, faire dorer 5 min avec cumin, sel, poivre.",
      "Étaler la sauce yaourt sur les wraps.",
      "Garnir de salade, tomate, poulet. Rouler et servir.",
    ],
  },
  {
    "nom": "Pâtes thon tomate express",
    "cuisine": "rapide", "type": "plat",
    "temps_prep": 2, "temps_cuisson": 10, "calories": 450, "personnes": 2,
    "niveau_epices": "doux", "saison": ["été"],
    "tags": ["pâtes", "thon", "rapide"],
    "ingredients": [
      ing("pâtes", "200", "g"),
      ing("thon en boîte", "1", "boîte"),
      ing("tomates cerises", "200", "g"),
      ing("ail", "2", "gousses"),
      ing("huile d'olive", "2", "c.s."),
      ing("basilic frais"),
    ],
    "instructions": [
      "Cuire les pâtes al dente.",
      "Faire revenir l'ail 1 min dans l'huile, ajouter tomates cerises et thon, cuire 3 min.",
      "Mélanger avec les pâtes et garnir de basilic.",
    ],
  },
  {
    "nom": "Pâtes pesto poulet",
    "cuisine": "rapide", "type": "plat",
    "temps_prep": 2, "temps_cuisson": 10, "calories": 480, "personnes": 2,
    "niveau_epices": "doux", "saison": [],
    "tags": ["pâtes", "poulet", "rapide"],
    "ingredients": [
      ing("pâtes", "200", "g"),
      ing("blanc de poulet cuit", "150", "g"),
      ing("pesto basilic", "4", "c.s."),
      ing("parmesan râpé", "30", "g"),
    ],
    "instructions": [
      "Cuire les pâtes al dente, garder 2 c.s. d'eau de cuisson.",
      "Mélanger pâtes, pesto, eau de cuisson et poulet émincé.",
      "Parsemer de parmesan et servir aussitôt.",
    ],
  },
  {
    "nom": "Salade niçoise express",
    "cuisine": "rapide", "type": "salade",
    "temps_prep": 5, "temps_cuisson": 6, "calories": 380, "personnes": 2,
    "niveau_epices": "doux", "saison": ["été"],
    "tags": ["salade", "thon", "rapide"],
    "ingredients": [
      ing("thon en boîte", "1", "boîte"),
      ing("œufs", "2"),
      ing("tomates", "2"),
      ing("haricots verts", "150", "g"),
      ing("olives noires", "50", "g"),
      ing("huile d'olive", "2", "c.s."),
      ing("citron", "1/2"),
    ],
    "instructions": [
      "Cuire les œufs 6 min, haricots verts 5 min.",
      "Dresser la salade avec tous les ingrédients.",
      "Assaisonner d'huile d'olive et jus de citron.",
    ],
  },
  {
    "nom": "Riz sauté légumes œuf",
    "cuisine": "rapide", "type": "plat",
    "temps_prep": 3, "temps_cuisson": 8, "calories": 420, "personnes": 2,
    "niveau_epices": "doux", "saison": [],
    "tags": ["riz", "œuf", "rapide"],
    "ingredients": [
      ing("riz cuit (de la veille)", "250", "g"),
      ing("œufs", "2"),
      ing("carotte", "1"),
      ing("poivron", "1/2"),
      ing("petits pois", "100", "g"),
      ing("sauce soja halal", "2", "c.s."),
    ],
    "instructions": [
      "Faire sauter les légumes émincés 3 min à feu vif.",
      "Ajouter le riz froid, mélanger 3 min.",
      "Pousser sur le côté, brouiller les œufs, mélanger. Ajouter sauce soja.",
    ],
  },
  {
    "nom": "Quesadillas poulet fromage",
    "cuisine": "rapide", "type": "plat",
    "temps_prep": 4, "temps_cuisson": 6, "calories": 460, "personnes": 2,
    "niveau_epices": "doux", "saison": [],
    "tags": ["poulet", "rapide"],
    "ingredients": [
      ing("tortillas", "4"),
      ing("poulet cuit émincé", "150", "g"),
      ing("fromage râpé", "80", "g"),
      ing("poivron", "1/2"),
      ing("oignon", "1/2"),
    ],
    "instructions": [
      "Répartir poulet, fromage, poivron et oignon sur 2 tortillas, couvrir avec les 2 autres.",
      "Cuire 3 min de chaque côté dans une poêle chaude sans matière grasse.",
      "Couper en triangles et servir aussitôt.",
    ],
  },
  {
    "nom": "Salade de pâtes thon maïs",
    "cuisine": "rapide", "type": "salade",
    "temps_prep": 3, "temps_cuisson": 10, "calories": 430, "personnes": 2,
    "niveau_epices": "doux", "saison": [],
    "tags": ["pâtes", "salade", "thon", "rapide"],
    "ingredients": [
      ing("pâtes courtes", "200", "g"),
      ing("thon en boîte", "1", "boîte"),
      ing("maïs", "100", "g"),
      ing("tomate", "1"),
      ing("mayo légère", "2", "c.s."),
      ing("cornichons", "3"),
    ],
    "instructions": [
      "Cuire les pâtes, rincer à l'eau froide.",
      "Mélanger pâtes, thon, maïs, tomate, cornichons et mayo.",
      "Assaisonner et servir frais.",
    ],
  },
  {
    "nom": "Soupe tomate express",
    "cuisine": "rapide", "type": "soupe",
    "temps_prep": 3, "temps_cuisson": 10, "calories": 220, "personnes": 2,
    "niveau_epices": "doux", "saison": ["été"],
    "tags": ["soupe", "tomate", "rapide"],
    "ingredients": [
      ing("tomates", "400", "g"),
      ing("oignon", "1"),
      ing("ail", "2", "gousses"),
      ing("crème légère", "3", "c.s."),
      ing("basilic"),
      ing("huile d'olive", "1", "c.s."),
    ],
    "instructions": [
      "Faire revenir l'oignon et l'ail 2 min, ajouter les tomates coupées.",
      "Cuire 8 min, mixer finement.",
      "Ajouter la crème, assaisonner et garnir de basilic.",
    ],
  },
  {
    "nom": "Omelette poivrons oignons",
    "cuisine": "rapide", "type": "plat",
    "temps_prep": 2, "temps_cuisson": 8, "calories": 320, "personnes": 2,
    "niveau_epices": "doux", "saison": [],
    "tags": ["œuf", "rapide"],
    "ingredients": [
      ing("œufs", "4"),
      ing("poivron", "1"),
      ing("oignon", "1"),
      ing("coriandre fraîche"),
      ing("huile d'olive", "1", "c.s."),
    ],
    "instructions": [
      "Faire revenir poivron et oignon émincés 4 min.",
      "Battre les œufs avec sel, poivre et coriandre. Verser sur les légumes.",
      "Cuire 4-5 min à feu doux jusqu'à prise.",
    ],
  },
  {
    "nom": "Salade poulet avocat tomate",
    "cuisine": "rapide", "type": "salade",
    "temps_prep": 8, "temps_cuisson": 0, "calories": 410, "personnes": 2,
    "niveau_epices": "doux", "saison": [],
    "tags": ["salade", "poulet", "rapide"],
    "ingredients": [
      ing("poulet cuit", "200", "g"),
      ing("avocat", "1"),
      ing("tomate", "2"),
      ing("citron", "1"),
      ing("huile d'olive", "2", "c.s."),
      ing("persil frais"),
    ],
    "instructions": [
      "Couper poulet, avocat et tomate en dés.",
      "Arroser de jus de citron et huile d'olive.",
      "Mélanger, assaisonner et garnir de persil.",
    ],
  },

  # ── SOIR SEMAINE (française, max 45 min) ────────────────────────────────────

  {
    "nom": "Filet de poulet curry courgettes",
    "cuisine": "française", "type": "plat",
    "temps_prep": 10, "temps_cuisson": 25, "calories": 520, "personnes": 6,
    "niveau_epices": "moyen", "saison": ["été", "printemps"],
    "tags": ["poulet", "curry", "courgettes"],
    "ingredients": [
      ing("filets de poulet", "700", "g"),
      ing("courgettes", "3"),
      ing("crème de coco", "200", "ml"),
      ing("curry en poudre", "2", "c.c."),
      ing("oignon", "1"),
      ing("ail", "3", "gousses"),
      ing("riz basmati", "400", "g"),
    ],
    "instructions": [
      "Faire revenir l'oignon et l'ail, ajouter le poulet en dés, dorer 5 min.",
      "Ajouter courgettes en rondelles et curry, cuire 5 min.",
      "Verser la crème de coco, mijoter 15 min. Servir avec riz.",
    ],
  },
  {
    "nom": "Saumon four légumes",
    "cuisine": "française", "type": "plat",
    "temps_prep": 10, "temps_cuisson": 20, "calories": 480, "personnes": 6,
    "niveau_epices": "doux", "saison": ["été"],
    "tags": ["saumon", "four"],
    "ingredients": [
      ing("pavés de saumon", "6"),
      ing("courgettes", "2"),
      ing("tomates cerises", "300", "g"),
      ing("citron", "1"),
      ing("herbes de Provence", "2", "c.c."),
      ing("huile d'olive", "3", "c.s."),
    ],
    "instructions": [
      "Préchauffer le four à 200°C.",
      "Disposer saumon et légumes sur une plaque. Arroser d'huile, citron et herbes.",
      "Enfourner 20 min jusqu'à dorure.",
    ],
  },
  {
    "nom": "Pâtes bolognaise bœuf",
    "cuisine": "française", "type": "plat",
    "temps_prep": 10, "temps_cuisson": 25, "calories": 560, "personnes": 6,
    "niveau_epices": "doux", "saison": [],
    "tags": ["pâtes", "bœuf"],
    "ingredients": [
      ing("viande hachée de bœuf", "600", "g"),
      ing("pâtes", "500", "g"),
      ing("tomates concassées", "800", "g"),
      ing("oignons", "2"),
      ing("ail", "3", "gousses"),
      ing("herbes de Provence"),
    ],
    "instructions": [
      "Faire revenir oignons et ail, ajouter la viande hachée, dorer 5 min.",
      "Ajouter tomates, herbes, sel. Mijoter 20 min.",
      "Cuire les pâtes al dente. Mélanger et servir.",
    ],
  },
  {
    "nom": "Poulet rôti pommes de terre",
    "cuisine": "française", "type": "plat",
    "temps_prep": 15, "temps_cuisson": 30, "calories": 580, "personnes": 6,
    "niveau_epices": "doux", "saison": [],
    "tags": ["poulet", "four"],
    "ingredients": [
      ing("cuisses de poulet", "6"),
      ing("pommes de terre", "1", "kg"),
      ing("ail", "4", "gousses"),
      ing("romarin"),
      ing("huile d'olive", "3", "c.s."),
    ],
    "instructions": [
      "Préchauffer le four à 200°C.",
      "Disposer poulet et pommes de terre dans un plat, arroser d'huile, ail et romarin.",
      "Enfourner 30 min en retournant à mi-cuisson.",
    ],
  },
  {
    "nom": "Lentilles corail carottes",
    "cuisine": "végé", "type": "plat",
    "temps_prep": 5, "temps_cuisson": 25, "calories": 380, "personnes": 6,
    "niveau_epices": "doux", "saison": ["automne", "hiver"],
    "tags": ["lentilles", "végé"],
    "ingredients": [
      ing("lentilles corail", "400", "g"),
      ing("carottes", "4"),
      ing("oignon", "1"),
      ing("cumin", "2", "c.c."),
      ing("coriandre"),
      ing("huile d'olive", "2", "c.s."),
    ],
    "instructions": [
      "Faire revenir oignon et cumin 2 min.",
      "Ajouter lentilles, carottes en rondelles et 1L d'eau.",
      "Cuire 25 min. Garnir de coriandre fraîche.",
    ],
  },
  {
    "nom": "Gratin courgettes veau",
    "cuisine": "française", "type": "plat",
    "temps_prep": 15, "temps_cuisson": 25, "calories": 490, "personnes": 6,
    "niveau_epices": "doux", "saison": ["été", "printemps"],
    "tags": ["veau", "gratin", "courgettes"],
    "ingredients": [
      ing("veau haché", "600", "g"),
      ing("courgettes", "4"),
      ing("tomates", "2"),
      ing("fromage râpé", "150", "g"),
      ing("oignon", "1"),
      ing("herbes de Provence"),
    ],
    "instructions": [
      "Faire revenir l'oignon et le veau haché, assaisonner.",
      "Disposer en alternance viande, courgettes en rondelles et tomates dans un plat.",
      "Couvrir de fromage, enfourner 25 min à 180°C.",
    ],
  },
  {
    "nom": "Poulet sauté poivrons",
    "cuisine": "française", "type": "plat",
    "temps_prep": 10, "temps_cuisson": 15, "calories": 440, "personnes": 6,
    "niveau_epices": "doux", "saison": ["été"],
    "tags": ["poulet", "poivrons"],
    "ingredients": [
      ing("blancs de poulet", "700", "g"),
      ing("poivrons variés", "4"),
      ing("oignons", "2"),
      ing("tomates", "3"),
      ing("piment doux", "1", "c.c."),
      ing("huile d'olive", "3", "c.s."),
    ],
    "instructions": [
      "Faire sauter le poulet en lanières 5 min, réserver.",
      "Faire revenir oignons et poivrons 5 min, ajouter tomates.",
      "Remettre le poulet, assaisonner et cuire 5 min.",
    ],
  },
  {
    "nom": "Thon poêlé ratatouille",
    "cuisine": "française", "type": "plat",
    "temps_prep": 10, "temps_cuisson": 25, "calories": 420, "personnes": 6,
    "niveau_epices": "doux", "saison": ["été"],
    "tags": ["thon", "légumes"],
    "ingredients": [
      ing("steaks de thon", "6"),
      ing("aubergine", "1"),
      ing("courgettes", "2"),
      ing("tomates", "3"),
      ing("poivron", "1"),
      ing("ail", "3", "gousses"),
      ing("herbes de Provence"),
    ],
    "instructions": [
      "Cuire la ratatouille (tous légumes en dés + ail + herbes) 20 min à couvert.",
      "Saisir les steaks de thon 2 min de chaque côté.",
      "Servir le thon sur la ratatouille.",
    ],
  },
  {
    "nom": "Burger bœuf maison",
    "cuisine": "française", "type": "plat",
    "temps_prep": 10, "temps_cuisson": 10, "calories": 620, "personnes": 6,
    "niveau_epices": "doux", "saison": [],
    "tags": ["bœuf", "burger"],
    "ingredients": [
      ing("viande hachée bœuf", "700", "g"),
      ing("pains halal à burger", "6"),
      ing("salade", "6", "feuilles"),
      ing("tomates", "2"),
      ing("oignons", "2"),
      ing("fromage fondu", "6", "tranches"),
    ],
    "instructions": [
      "Former 6 steaks hachés, assaisonner. Cuire 4-5 min de chaque côté.",
      "Griller les pains. Poêler les oignons 5 min.",
      "Assembler burgers avec salade, tomate, oignons et fromage.",
    ],
  },
  {
    "nom": "Frites four poulet épicé",
    "cuisine": "française", "type": "plat",
    "temps_prep": 10, "temps_cuisson": 30, "calories": 550, "personnes": 6,
    "niveau_epices": "moyen", "saison": [],
    "tags": ["poulet", "frites", "four"],
    "ingredients": [
      ing("cuisses de poulet", "6"),
      ing("pommes de terre", "1", "kg"),
      ing("paprika", "2", "c.c."),
      ing("cumin", "1", "c.c."),
      ing("ail en poudre", "1", "c.c."),
      ing("huile", "3", "c.s."),
    ],
    "instructions": [
      "Couper les pommes de terre en frites, mélanger avec huile et sel.",
      "Badigeonner le poulet d'épices et d'huile.",
      "Enfourner à 200°C pendant 30 min. Les frites à mi-cuisson.",
    ],
  },
  {
    "nom": "Soupe harira légère",
    "cuisine": "végé", "type": "soupe",
    "temps_prep": 10, "temps_cuisson": 30, "calories": 280, "personnes": 6,
    "niveau_epices": "doux", "saison": ["hiver"],
    "tags": ["soupe", "légumineuses"],
    "ingredients": [
      ing("tomates", "400", "g"),
      ing("pois chiches", "200", "g"),
      ing("lentilles corail", "150", "g"),
      ing("céleri", "2", "branches"),
      ing("coriandre fraîche"),
      ing("cumin", "1", "c.c."),
      ing("citron", "1"),
    ],
    "instructions": [
      "Faire revenir oignons et épices, ajouter tomates, pois chiches, lentilles.",
      "Couvrir d'eau, cuire 30 min.",
      "Presser le citron, garnir de coriandre.",
    ],
  },
  {
    "nom": "Veau sauté champignons",
    "cuisine": "française", "type": "plat",
    "temps_prep": 5, "temps_cuisson": 25, "calories": 460, "personnes": 6,
    "niveau_epices": "doux", "saison": ["automne"],
    "tags": ["veau", "champignons"],
    "ingredients": [
      ing("veau en morceaux", "700", "g"),
      ing("champignons de Paris", "400", "g"),
      ing("crème fraîche", "200", "ml"),
      ing("oignon", "1"),
      ing("persil"),
    ],
    "instructions": [
      "Faire dorer le veau, réserver. Faire revenir oignons et champignons.",
      "Remettre le veau, ajouter la crème et cuire 15 min à feu doux.",
      "Garnir de persil frais.",
    ],
  },
  {
    "nom": "Saumon curry épinards",
    "cuisine": "française", "type": "plat",
    "temps_prep": 5, "temps_cuisson": 20, "calories": 490, "personnes": 6,
    "niveau_epices": "moyen", "saison": ["printemps"],
    "tags": ["saumon", "curry", "épinards"],
    "ingredients": [
      ing("filets de saumon", "6"),
      ing("épinards frais", "300", "g"),
      ing("crème de coco", "200", "ml"),
      ing("curry", "2", "c.c."),
      ing("ail", "2", "gousses"),
    ],
    "instructions": [
      "Faire revenir l'ail, ajouter les épinards 2 min.",
      "Ajouter crème de coco et curry, mijoter 5 min.",
      "Poser le saumon dans la sauce, cuire 12 min à couvert.",
    ],
  },
  {
    "nom": "Poulet frit croustillant",
    "cuisine": "française", "type": "plat",
    "temps_prep": 10, "temps_cuisson": 15, "calories": 520, "personnes": 6,
    "niveau_epices": "doux", "saison": [],
    "tags": ["poulet", "croustillant"],
    "ingredients": [
      ing("filets de poulet", "700", "g"),
      ing("chapelure", "150", "g"),
      ing("œufs", "2"),
      ing("paprika doux", "1", "c.c."),
      ing("ail en poudre", "1", "c.c."),
    ],
    "instructions": [
      "Tremper le poulet dans les œufs battus puis dans la chapelure épicée.",
      "Faire dorer à la poêle avec huile 5-6 min de chaque côté.",
      "Égoutter sur du papier absorbant.",
    ],
  },
  {
    "nom": "Pâtes saumon crème aneth",
    "cuisine": "française", "type": "plat",
    "temps_prep": 5, "temps_cuisson": 15, "calories": 540, "personnes": 6,
    "niveau_epices": "doux", "saison": [],
    "tags": ["pâtes", "saumon"],
    "ingredients": [
      ing("pâtes", "500", "g"),
      ing("saumon fumé", "300", "g"),
      ing("crème fraîche", "200", "ml"),
      ing("aneth"),
      ing("citron", "1"),
    ],
    "instructions": [
      "Cuire les pâtes al dente.",
      "Faire chauffer la crème 3 min, ajouter saumon en morceaux et jus de citron.",
      "Mélanger pâtes et sauce. Garnir d'aneth.",
    ],
  },

  # ── MAROCAINES (soir + week-end) ─────────────────────────────────────────────

  {
    "nom": "Tajine poulet citron confit olives",
    "cuisine": "marocaine", "type": "plat",
    "temps_prep": 15, "temps_cuisson": 45, "calories": 480, "personnes": 6,
    "niveau_epices": "moyen", "saison": [],
    "tags": ["tajine", "poulet"],
    "ingredients": [
      ing("poulet découpé", "1.5", "kg"),
      ing("citron confit", "1"),
      ing("olives vertes", "100", "g"),
      ing("oignons", "2"),
      ing("ras el hanout", "2", "c.c."),
      ing("gingembre", "1", "c.c."),
      ing("coriandre fraîche"),
    ],
    "instructions": [
      "Faire dorer le poulet avec oignons et épices 10 min.",
      "Ajouter citron confit en lanières, olives et un verre d'eau.",
      "Cuire à couvert 45 min à feu doux. Garnir de coriandre.",
    ],
  },
  {
    "nom": "Tajine bœuf petits pois",
    "cuisine": "marocaine", "type": "plat",
    "temps_prep": 15, "temps_cuisson": 60, "calories": 520, "personnes": 6,
    "niveau_epices": "moyen", "saison": ["printemps"],
    "tags": ["tajine", "bœuf"],
    "ingredients": [
      ing("bœuf en morceaux", "800", "g"),
      ing("petits pois", "400", "g"),
      ing("tomates", "3"),
      ing("oignons", "2"),
      ing("gingembre en poudre", "1", "c.c."),
      ing("curcuma", "1", "c.c."),
    ],
    "instructions": [
      "Faire dorer le bœuf avec oignons et épices.",
      "Ajouter les tomates pelées et un verre d'eau. Mijoter 45 min.",
      "Ajouter les petits pois, cuire encore 15 min.",
    ],
  },
  {
    "nom": "Couscous poulet légumes",
    "cuisine": "marocaine", "type": "plat",
    "temps_prep": 20, "temps_cuisson": 40, "calories": 580, "personnes": 6,
    "niveau_epices": "doux", "saison": [],
    "tags": ["couscous", "poulet"],
    "ingredients": [
      ing("poulet découpé", "1.5", "kg"),
      ing("semoule", "500", "g"),
      ing("courgettes", "3"),
      ing("carottes", "4"),
      ing("pois chiches", "200", "g"),
      ing("ras el hanout", "2", "c.c."),
    ],
    "instructions": [
      "Cuire le poulet avec légumes et épices dans le bouillon 40 min.",
      "Réhydrater la semoule dans de l'eau chaude salée 5 min, égrainer.",
      "Dresser la semoule, disposer poulet et légumes dessus. Servir avec harissa.",
    ],
  },
  {
    "nom": "Kefta tomates sauce",
    "cuisine": "marocaine", "type": "plat",
    "temps_prep": 10, "temps_cuisson": 25, "calories": 490, "personnes": 6,
    "niveau_epices": "moyen", "saison": ["été"],
    "tags": ["kefta", "viande hachée"],
    "ingredients": [
      ing("viande hachée (bœuf ou veau)", "700", "g"),
      ing("tomates", "5"),
      ing("oignons", "2"),
      ing("œufs", "6"),
      ing("cumin", "2", "c.c."),
      ing("coriandre"),
      ing("piment doux", "1", "c.c."),
    ],
    "instructions": [
      "Mélanger la viande avec oignon râpé, cumin et coriandre. Former des boulettes.",
      "Préparer une sauce tomate avec oignons et tomates concassées 10 min.",
      "Ajouter les boulettes dans la sauce, cuire 15 min. Casser les œufs dessus.",
    ],
  },
  {
    "nom": "Harira complète",
    "cuisine": "marocaine", "type": "soupe",
    "temps_prep": 10, "temps_cuisson": 40, "calories": 380, "personnes": 6,
    "niveau_epices": "doux", "saison": ["hiver"],
    "tags": ["soupe", "harira"],
    "ingredients": [
      ing("viande hachée", "300", "g"),
      ing("tomates", "500", "g"),
      ing("pois chiches", "200", "g"),
      ing("lentilles vertes", "150", "g"),
      ing("céleri", "2", "branches"),
      ing("coriandre fraîche"),
      ing("ras el hanout", "1", "c.c."),
    ],
    "instructions": [
      "Faire revenir viande et épices 5 min.",
      "Ajouter tomates, légumineuses, céleri et 1.5L d'eau.",
      "Cuire 40 min, garnir de coriandre et servir avec des dattes.",
    ],
  },
  {
    "nom": "Poulet chermoula",
    "cuisine": "marocaine", "type": "plat",
    "temps_prep": 15, "temps_cuisson": 30, "calories": 440, "personnes": 6,
    "niveau_epices": "moyen", "saison": [],
    "tags": ["poulet", "chermoula"],
    "ingredients": [
      ing("poulet découpé", "1.5", "kg"),
      ing("coriandre fraîche", "1", "botte"),
      ing("cumin", "2", "c.c."),
      ing("paprika", "1", "c.c."),
      ing("citron", "2"),
      ing("ail", "4", "gousses"),
    ],
    "instructions": [
      "Mixer coriandre, cumin, paprika, ail et jus de citron pour la chermoula.",
      "Mariner le poulet 15 min dans la chermoula.",
      "Cuire à la poêle ou au four 30 min.",
    ],
  },
  {
    "nom": "Briouates viande hachée épicées",
    "cuisine": "marocaine", "type": "plat",
    "temps_prep": 20, "temps_cuisson": 20, "calories": 380, "personnes": 6,
    "niveau_epices": "moyen", "saison": [],
    "tags": ["briouates", "viande hachée"],
    "ingredients": [
      ing("viande hachée", "500", "g"),
      ing("oignons", "2"),
      ing("persil"),
      ing("œuf", "1"),
      ing("feuilles de brick", "12"),
      ing("cumin", "1", "c.c."),
      ing("coriandre en poudre", "1", "c.c."),
    ],
    "instructions": [
      "Cuire la viande avec oignons et épices, laisser refroidir. Ajouter œuf et persil.",
      "Façonner les briouates en triangle avec les feuilles de brick.",
      "Faire dorer à la poêle avec un peu d'huile 3-4 min de chaque côté.",
    ],
  },
  {
    "nom": "Zaalouk aubergines",
    "cuisine": "marocaine", "type": "plat",
    "temps_prep": 10, "temps_cuisson": 20, "calories": 220, "personnes": 6,
    "niveau_epices": "doux", "saison": ["été"],
    "tags": ["aubergines", "végé", "zaalouk"],
    "ingredients": [
      ing("aubergines", "4"),
      ing("tomates", "4"),
      ing("ail", "4", "gousses"),
      ing("cumin", "1", "c.c."),
      ing("paprika", "1", "c.c."),
      ing("huile d'olive", "3", "c.s."),
      ing("coriandre fraîche"),
    ],
    "instructions": [
      "Faire griller les aubergines puis les écraser.",
      "Cuire avec tomates, ail et épices 15 min.",
      "Écraser grossièrement, garnir de coriandre et huile d'olive.",
    ],
  },

  # ── ITALIENNES ────────────────────────────────────────────────────────────────

  {
    "nom": "Risotto poulet champignons",
    "cuisine": "italienne", "type": "plat",
    "temps_prep": 5, "temps_cuisson": 30, "calories": 520, "personnes": 6,
    "niveau_epices": "doux", "saison": ["automne"],
    "tags": ["risotto", "poulet", "champignons"],
    "ingredients": [
      ing("riz arborio", "500", "g"),
      ing("poulet cuit", "400", "g"),
      ing("champignons de Paris", "300", "g"),
      ing("parmesan râpé", "80", "g"),
      ing("oignon", "1"),
      ing("bouillon de volaille", "1.5", "L"),
    ],
    "instructions": [
      "Faire revenir l'oignon, ajouter le riz et nacrer 2 min.",
      "Ajouter le bouillon louche par louche en remuant constamment pendant 20 min.",
      "Hors du feu, incorporer poulet, champignons et parmesan.",
    ],
  },
  {
    "nom": "Pizza maison poulet poivrons",
    "cuisine": "italienne", "type": "plat",
    "temps_prep": 20, "temps_cuisson": 25, "calories": 580, "personnes": 6,
    "niveau_epices": "doux", "saison": ["été"],
    "tags": ["pizza", "poulet"],
    "ingredients": [
      ing("pâte à pizza", "2", "boules"),
      ing("poulet grillé", "400", "g"),
      ing("poivrons", "2"),
      ing("mozzarella", "300", "g"),
      ing("sauce tomate", "300", "g"),
      ing("origan"),
    ],
    "instructions": [
      "Étaler la pâte. Napper de sauce tomate.",
      "Disposer poulet en lanières, poivrons et mozzarella.",
      "Enfourner à 220°C pendant 25 min.",
    ],
  },
  {
    "nom": "Lasagnes bœuf",
    "cuisine": "italienne", "type": "plat",
    "temps_prep": 20, "temps_cuisson": 40, "calories": 620, "personnes": 6,
    "niveau_epices": "doux", "saison": [],
    "tags": ["lasagnes", "bœuf"],
    "ingredients": [
      ing("viande hachée bœuf", "600", "g"),
      ing("lasagnes sèches", "300", "g"),
      ing("sauce béchamel", "600", "ml"),
      ing("tomates concassées", "400", "g"),
      ing("fromage râpé", "150", "g"),
    ],
    "instructions": [
      "Préparer la bolognaise : viande + tomates, cuire 20 min.",
      "Alterner couches de pâtes, bolognaise et béchamel.",
      "Terminer par béchamel + fromage. Enfourner 40 min à 180°C.",
    ],
  },
  {
    "nom": "Penne arrabbiata thon",
    "cuisine": "italienne", "type": "plat",
    "temps_prep": 3, "temps_cuisson": 15, "calories": 460, "personnes": 6,
    "niveau_epices": "moyen", "saison": [],
    "tags": ["pâtes", "thon"],
    "ingredients": [
      ing("penne", "500", "g"),
      ing("thon en boîte", "2", "boîtes"),
      ing("tomates concassées", "800", "g"),
      ing("piment", "1"),
      ing("ail", "3", "gousses"),
      ing("olives noires", "80", "g"),
    ],
    "instructions": [
      "Faire revenir ail et piment, ajouter tomates et olives, cuire 10 min.",
      "Ajouter le thon, mélanger.",
      "Cuire les penne al dente, mélanger avec la sauce.",
    ],
  },

  # ── VÉGÉTARIENNES ─────────────────────────────────────────────────────────────

  {
    "nom": "Curry pois chiches épinards",
    "cuisine": "végé", "type": "plat",
    "temps_prep": 5, "temps_cuisson": 20, "calories": 380, "personnes": 6,
    "niveau_epices": "moyen", "saison": ["printemps"],
    "tags": ["végé", "pois chiches", "curry"],
    "ingredients": [
      ing("pois chiches", "800", "g"),
      ing("épinards frais", "300", "g"),
      ing("tomates concassées", "400", "g"),
      ing("crème de coco", "200", "ml"),
      ing("curry", "2", "c.c."),
      ing("ail", "3", "gousses"),
    ],
    "instructions": [
      "Faire revenir ail et curry, ajouter tomates et pois chiches.",
      "Verser la crème de coco, cuire 15 min.",
      "Ajouter les épinards en fin de cuisson 2 min.",
    ],
  },
  {
    "nom": "Courgettes farcies végé",
    "cuisine": "végé", "type": "plat",
    "temps_prep": 15, "temps_cuisson": 25, "calories": 320, "personnes": 6,
    "niveau_epices": "doux", "saison": ["été", "printemps"],
    "tags": ["végé", "courgettes"],
    "ingredients": [
      ing("courgettes rondes", "6"),
      ing("riz cuit", "300", "g"),
      ing("tomates", "3"),
      ing("oignon", "1"),
      ing("herbes de Provence"),
      ing("fromage râpé", "100", "g"),
    ],
    "instructions": [
      "Vider les courgettes, hacher la chair.",
      "Mélanger riz, chair de courgette, tomate, oignon et herbes.",
      "Farcir les courgettes, couvrir de fromage, enfourner 25 min à 180°C.",
    ],
  },
  {
    "nom": "Ratatouille provençale",
    "cuisine": "végé", "type": "plat",
    "temps_prep": 15, "temps_cuisson": 20, "calories": 280, "personnes": 6,
    "niveau_epices": "doux", "saison": ["été"],
    "tags": ["végé", "légumes", "ratatouille"],
    "ingredients": [
      ing("aubergines", "2"),
      ing("courgettes", "3"),
      ing("poivrons", "2"),
      ing("tomates", "4"),
      ing("oignon", "1"),
      ing("ail", "3", "gousses"),
      ing("herbes de Provence", "2", "c.c."),
    ],
    "instructions": [
      "Couper tous les légumes en dés.",
      "Faire revenir oignon et ail, ajouter les légumes et herbes.",
      "Cuire à couvert 20 min en remuant régulièrement.",
    ],
  },
  {
    "nom": "Soupe lentilles carottes",
    "cuisine": "végé", "type": "soupe",
    "temps_prep": 5, "temps_cuisson": 25, "calories": 300, "personnes": 6,
    "niveau_epices": "doux", "saison": ["automne", "hiver"],
    "tags": ["soupe", "végé", "lentilles"],
    "ingredients": [
      ing("lentilles corail", "400", "g"),
      ing("carottes", "4"),
      ing("oignons", "2"),
      ing("cumin", "2", "c.c."),
      ing("huile d'olive", "2", "c.s."),
    ],
    "instructions": [
      "Faire revenir oignons et cumin 2 min.",
      "Ajouter carottes en rondelles, lentilles et 1.2L d'eau.",
      "Cuire 25 min puis mixer.",
    ],
  },
  {
    "nom": "Tarte aux courgettes",
    "cuisine": "végé", "type": "plat",
    "temps_prep": 15, "temps_cuisson": 25, "calories": 420, "personnes": 6,
    "niveau_epices": "doux", "saison": ["été", "printemps"],
    "tags": ["végé", "tarte", "courgettes"],
    "ingredients": [
      ing("pâte brisée", "1"),
      ing("courgettes", "3"),
      ing("œufs", "3"),
      ing("crème fraîche", "200", "ml"),
      ing("fromage râpé", "100", "g"),
    ],
    "instructions": [
      "Foncer la pâte dans un moule. Faire revenir les courgettes 5 min.",
      "Battre œufs + crème + fromage, ajouter les courgettes.",
      "Verser sur la pâte, enfourner 25 min à 180°C.",
    ],
  },
]


# ── Famille et membres ─────────────────────────────────────────────────────────

FAMILLE = {
    "id": FAMILLE_ID,
    "nom": "Lucie",
    "nb_personnes": 6,
    "preferences": {
        "regime": "halal",
        "restrictions": ["sans_porc", "sans_alcool", "sans_abats", "sans_fruits_de_mer", "sans_agneau"],
        "cuisines_favorites": ["marocaine", "française", "italienne", "végé"],
    },
}

MEMBRES = [
    {"famille_id": FAMILLE_ID, "prenom": "Lucie",     "age": None, "restrictions": ["halal"]},
    {"famille_id": FAMILLE_ID, "prenom": "Karim",     "age": None, "restrictions": ["halal"]},
    {"famille_id": FAMILLE_ID, "prenom": "Enfant 1",  "age": 15,   "restrictions": []},
    {"famille_id": FAMILLE_ID, "prenom": "Enfant 2",  "age": 13,   "restrictions": []},
    {"famille_id": FAMILLE_ID, "prenom": "Enfant 3",  "age": 10,   "restrictions": []},
    {"famille_id": FAMILLE_ID, "prenom": "Enfant 4",  "age": 3,    "restrictions": []},
]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not KEY:
        print("ERREUR : SUPABASE_SERVICE_ROLE_KEY non défini")
        return

    print("\nPlanEat v1.0.0 — Setup base de données")
    print("=" * 50)

    # 1. Vider les tables (ordre respectant les FK)
    print("\n1. Nettoyage des tables...")
    for table in ["favoris", "menus", "membres", "familles", "recettes"]:
        delete_all(table)

    # 2. Insérer les recettes
    print(f"\n2. Insertion des {len(RECETTES)} recettes...")
    result = insert("recettes", RECETTES)
    if result:
        print(f"   → {len(result)} recettes insérées")

    # 3. Famille
    print("\n3. Création de la famille...")
    insert("familles", [FAMILLE])

    # 4. Membres
    print(f"\n4. Insertion des {len(MEMBRES)} membres...")
    insert("membres", MEMBRES)

    print("\n" + "=" * 50)
    print("✅ Setup terminé !")
    print(f"   Recettes : {len(RECETTES)}")
    print(f"   Famille  : {FAMILLE['nom']} ({FAMILLE['nb_personnes']} personnes)")
    print(f"   Membres  : {len(MEMBRES)}")


if __name__ == "__main__":
    main()
