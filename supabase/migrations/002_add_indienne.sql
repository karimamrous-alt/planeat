-- Migration 002 : ajouter la cuisine 'indienne' à la contrainte recettes_cuisine_check

ALTER TABLE recettes DROP CONSTRAINT recettes_cuisine_check;
ALTER TABLE recettes ADD CONSTRAINT recettes_cuisine_check
  CHECK (cuisine IN ('marocaine', 'française', 'italienne', 'végé', 'rapide', 'indienne'));
