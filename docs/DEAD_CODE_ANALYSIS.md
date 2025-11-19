# 🔍 Analyse du Code Mort - Phase 2.2

**Date:** $(date)  
**Status:** En cours d'analyse

---

## 📋 FICHIERS IDENTIFIÉS COMME CODE MORT POTENTIEL

### 1. Composants Debug

#### `components/debug/properties-debug.tsx`
- **Type:** Composant debug
- **Utilisé dans:** `app/admin/integrations/page.tsx`
- **Usage:** Debug de connexion frontend/backend
- **Recommandation:** ⚠️ **ARCHIVER** - Composant de debug, non nécessaire en production
- **Action:** Déplacer vers `components/debug/` (garder pour référence) ou supprimer

### 2. Pages de Tests Admin

#### `app/admin/tests/page.tsx`
- **Type:** Page de tests admin (587 lignes)
- **Usage:** Tests de connexion, base de données, API
- **Recommandation:** ⚠️ **ARCHIVER** - Page de tests, utile pour développement mais pas production
- **Action:** Déplacer vers `app/admin/tests/` (garder pour référence) ou supprimer

#### `app/admin/process-tests/page.tsx`
- **Type:** Page de tests de processus
- **Usage:** Tests de processus métier
- **Recommandation:** ⚠️ **ARCHIVER** - Page de tests
- **Action:** Déplacer vers `app/admin/tests/` ou supprimer

### 3. Routes API de Tests

#### `app/api/admin/tests/table-exists/route.ts`
- **Type:** Route API de test
- **Usage:** Vérifier l'existence d'une table (utilisée par `app/admin/tests/page.tsx`)
- **Recommandation:** ⚠️ **ARCHIVER** - Route de test, non nécessaire en production
- **Action:** Supprimer si `app/admin/tests/page.tsx` est supprimé

### 4. Scripts de Test

#### Scripts dans `scripts/` à archiver :
- `test-add-property-flow.sh` - Test de flux de création de propriété
- `test-admin-auth.ts` - Test d'authentification admin
- `test-connection.sh` - Test de connexion
- `test-properties-connection.ts` - Test de connexion propriétés
- `test-property-api-flow.ts` - Test de flux API propriétés
- `test-property-creation-flow.ts` - Test de création de propriété

**Recommandation:** ⚠️ **ARCHIVER** - Scripts de test, utiles pour développement mais pas production
**Action:** Déplacer vers `scripts/tests/` ou `docs/archive/scripts/`

---

## ✅ FICHIERS À CONSERVER

### Pages Admin Utiles
- `app/admin/integrations/page.tsx` - Page d'intégrations (fonctionnelle)
- `app/admin/people/vendors/[id]/page.tsx` - Détail prestataire (fonctionnelle)
- `app/admin/people/page.tsx` - Liste des personnes (fonctionnelle)

### Routes API Utiles
- `app/api/admin/people/vendors/route.ts` - Liste prestataires (fonctionnelle)
- `app/api/admin/people/vendors/[id]/route.ts` - Détail prestataire (fonctionnelle)

---

## 📊 STATISTIQUES

### Fichiers à archiver/supprimer
- **Composants debug:** 1 fichier
- **Pages de tests:** 2 fichiers (~600+ lignes)
- **Routes API de tests:** 1 fichier
- **Scripts de test:** 6+ fichiers

### Impact estimé
- **Réduction de code:** ~800+ lignes
- **Réduction de complexité:** Pages de tests non nécessaires en production
- **Amélioration sécurité:** Suppression de routes de test exposées

---

## 🎯 PLAN D'ACTION

### Étape 1: Archiver composants debug
1. Créer `components/debug/` si n'existe pas
2. Déplacer `components/debug/properties-debug.tsx` (ou supprimer)
3. Retirer l'import dans `app/admin/integrations/page.tsx` si présent

### Étape 2: Archiver pages de tests
1. Créer `app/admin/tests/` si n'existe pas
2. Déplacer `app/admin/tests/page.tsx` et `app/admin/process-tests/page.tsx`
3. OU supprimer complètement si non utilisées

### Étape 3: Supprimer routes API de tests
1. Supprimer `app/api/admin/tests/table-exists/route.ts`
2. Vérifier qu'aucune autre route ne l'utilise

### Étape 4: Archiver scripts de test
1. Créer `scripts/tests/` ou `docs/archive/scripts/`
2. Déplacer les scripts de test identifiés

---

## ⚠️ PRÉCAUTIONS

- Vérifier que les fichiers ne sont pas référencés ailleurs avant suppression
- Conserver les fichiers dans `docs/archive/` pour référence historique
- Tester l'application après suppression pour s'assurer qu'aucune fonctionnalité n'est cassée

---

## 📝 NOTES

- Les fichiers de test peuvent être utiles pour le développement mais ne devraient pas être en production
- Les composants debug peuvent être conservés dans un dossier séparé pour référence
- Les scripts de test peuvent être archivés mais conservés pour référence

