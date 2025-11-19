# Analyse des Conventions de Nommage - Gestion Locative

## 📋 Conventions Actuelles Identifiées

### ✅ Conventions Cohérentes

1. **Hooks React** (`lib/hooks/`)
   - Format : `useXxx` (camelCase)
   - Exemples : `useProperties`, `useProperty`, `useLeases`, `useInvoice`
   - ✅ Cohérent

2. **Services** (`features/*/services/`)
   - Classe : `XxxService` (PascalCase)
   - Instance : `xxxService` (camelCase)
   - Exemples : `LeasesService`, `leasesService`
   - ✅ Cohérent

3. **Types Supabase** (`lib/supabase/typed-client.ts`)
   - Format : `XxxRow`, `XxxInsert`, `XxxUpdate`
   - Exemples : `PropertyRow`, `LeaseInsert`, `InvoiceUpdate`
   - ✅ Cohérent

4. **Composants UI** (`components/ui/`)
   - Format : `Xxx` (PascalCase)
   - Exemples : `Button`, `Input`, `Card`
   - ✅ Cohérent

### ⚠️ Incohérences Identifiées

1. **Fichiers de validation** (`lib/validations/`)
   - ❌ `property-validation.ts` vs `property-validator.ts` - Doublons potentiels
   - ❌ `property-v3.ts` - Nommage avec version (à éviter)
   - 📝 **Recommandation**: Consolider ou renommer

2. **Composants métier** (`components/`)
   - ⚠️ Mélange de préfixes : `OwnerTodoSection` vs `PropertiesDebug`
   - ⚠️ Certains avec préfixe de rôle (`Owner`), d'autres sans
   - 📝 **Recommandation**: Standardiser les préfixes selon le contexte

3. **Types d'interface**
   - ⚠️ Mélange de suffixes : `CreateLeaseData` vs `LeaseSignerProps`
   - ⚠️ Certains avec `Data`, d'autres avec `Props`
   - 📝 **Recommandation**: Utiliser `Data` pour les données, `Props` pour les props React

4. **Schémas Zod**
   - ⚠️ Mélange de formats : `leaseSignerSchema` vs `addLeaseSignerSchema`
   - ⚠️ Certains avec verbe (`add`, `update`), d'autres sans
   - 📝 **Recommandation**: Standardiser avec préfixes d'action (`create`, `update`)

## 📊 Statistiques

- **Hooks** : 13 fichiers, tous suivent `useXxx` ✅
- **Services** : 5+ services, tous suivent `XxxService` ✅
- **Composants** : 39 fichiers, mélange de conventions ⚠️
- **Validations** : 6 fichiers, quelques incohérences ⚠️

## ✅ Recommandations de Standardisation

### 1. Fichiers de validation
- **Format recommandé** : `xxx.schema.ts` ou `xxx.validation.ts`
- **Exemples** : `lease.schema.ts`, `property.schema.ts`
- **Action**: Consolider `property-validation.ts` et `property-validator.ts`

### 2. Composants métier
- **Format recommandé** : `XxxYyy` (PascalCase, descriptif)
- **Préfixes** : Utiliser uniquement si nécessaire pour éviter les conflits
- **Exemples** : `TodoSection`, `FinanceSummary` (au lieu de `OwnerTodoSection`)

### 3. Types d'interface
- **Format recommandé** :
  - `CreateXxxData` pour les données de création
  - `UpdateXxxData` pour les données de mise à jour
  - `XxxProps` pour les props React
  - `XxxRow`, `XxxInsert`, `XxxUpdate` pour les types Supabase

### 4. Schémas Zod
- **Format recommandé** :
  - `xxxSchema` pour le schéma de base
  - `createXxxSchema` pour la création
  - `updateXxxSchema` pour la mise à jour
  - `xxxPartialSchema` pour les mises à jour partielles

## 🎯 Priorités

1. **Haute priorité** : Consolider les fichiers de validation dupliqués
2. **Moyenne priorité** : Standardiser les noms de schémas Zod
3. **Basse priorité** : Harmoniser les préfixes de composants (si nécessaire)

