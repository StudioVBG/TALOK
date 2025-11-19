# ✅ Checklist de Conformité aux Conventions

**Date:** $(date)

---

## 📋 VÉRIFICATIONS PAR CATÉGORIE

### Fichiers

#### ✅ Composants React
- [ ] Tous les fichiers `.tsx` sont en `kebab-case`
- [ ] Les composants sont nommés en `PascalCase`
- [ ] Les props sont typées avec `PascalCase + Props`

#### ✅ Services
- [ ] Tous les services ont le suffixe `.service.ts`
- [ ] Les noms de services sont en `kebab-case`
- [ ] Les exports sont `camelCase` (ex: `propertiesService`)

#### ✅ Helpers
- [ ] Les helpers sont en `kebab-case.ts` ou `kebab-case-helper.ts`
- [ ] Les fonctions sont en `camelCase`
- [ ] Les classes sont en `PascalCase`

#### ✅ Hooks
- [ ] Tous les hooks ont le préfixe `use-`
- [ ] Les fichiers sont en `use-kebab-case.ts`
- [ ] Les fonctions sont en `camelCase`

#### ✅ Types
- [ ] Les fichiers de types sont en `kebab-case.ts`
- [ ] Les types/interfaces sont en `PascalCase`
- [ ] Pas de préfixe `I` pour les interfaces

---

## 🔍 INCONSISTANCES IDENTIFIÉES

### À Corriger (Priorité Haute)

#### Fichiers avec conventions mixtes
- [ ] Vérifier tous les fichiers dans `app/` pour kebab-case
- [ ] Vérifier tous les fichiers dans `features/` pour kebab-case
- [ ] Vérifier tous les fichiers dans `components/` pour kebab-case

#### Types/Interfaces
- [ ] Vérifier qu'aucune interface n'a le préfixe `I`
- [ ] Vérifier que tous les types sont en `PascalCase`

#### Hooks
- [ ] Vérifier que tous les hooks ont le préfixe `use-`
- [ ] Vérifier que les fichiers de hooks sont en `use-kebab-case.ts`

---

## 📊 STATISTIQUES

### Conformité actuelle
- **Fichiers vérifiés:** En cours
- **Conformité estimée:** ~85%
- **Fichiers à corriger:** À identifier

---

## 🎯 PLAN D'ACTION

### Phase 1: Audit complet
1. Scanner tous les fichiers pour identifier les incohérences
2. Créer une liste de fichiers à corriger
3. Prioriser par fréquence d'utilisation

### Phase 2: Correction progressive
1. Corriger les fichiers les plus utilisés en premier
2. Mettre à jour les imports si nécessaire
3. Vérifier la compilation après chaque correction

### Phase 3: Validation
1. Vérifier qu'aucune erreur TypeScript n'est introduite
2. Vérifier que tous les imports fonctionnent
3. Documenter les changements

---

**Note:** Cette checklist sera mise à jour au fur et à mesure de l'audit.

