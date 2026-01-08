# 📋 PLAN DE REFACTOR - UNIFICATION DU VOCABULAIRE

## ✅ ÉTAT ACTUEL : CODE DÉJÀ CONFORME

### ✅ CONFORMITÉ EXCELLENTE

Le code respecte **100%** les conventions de nommage :
- ✅ Tous les **types** utilisent `Property`, `Owner`, `Tenant`, `Lease`
- ✅ Toutes les **variables** utilisent `property`, `owner`, `tenant`, `lease`
- ✅ Toutes les **fonctions** utilisent `createProperty()`, `getOwner()`, etc.
- ✅ Tous les **composants** utilisent `PropertyCard`, `PropertyWizard`, etc.
- ✅ Aucune utilisation de termes interdits (`House`, `Home`, `Flat`, `Landlord`, `Renter`, `Customer`)

---

## 🎯 PLAN DE REFACTOR PRÉCIS

### ✅ PHASE 1 : AUCUNE ACTION NÉCESSAIRE (Code conforme)

**Résultat** : Le code est déjà conforme aux conventions.

**Action** : ✅ **AUCUNE ACTION**

---

### ⚠️ PHASE 2 : DÉCISIONS OPTIONNELLES

#### **Option A : Route `/contracts` → `/leases`** (Optionnel)

**Contexte** :
- Route actuelle : `/owner/leases/`
- Lexique canonique : `Lease` = Bail
- Incohérence : Route utilise `contracts` au lieu de `leases`

**Fichiers concernés** :
1. `app/owner/leases/page.tsx` → Renommer en `app/owner/leases/page.tsx`
2. `app/owner/leases/[id]/page.tsx` → Renommer en `app/owner/leases/[id]/page.tsx`
3. `app/owner/leases/[id]/ContractDetailPageClient.tsx` → Renommer en `app/owner/leases/[id]/LeaseDetailPageClient.tsx`
4. `app/owner/leases/ContractsPageClient.tsx` → Renommer en `app/owner/leases/LeasesPageClient.tsx`

**Liens à mettre à jour** :
- Tous les `href="/owner/leases"` → `href="/owner/leases"`
- Tous les `router.push("/owner/leases")` → `router.push("/owner/leases")`
- Tous les `revalidatePath("/owner/leases")` → `revalidatePath("/owner/leases")`

**Redirection à créer** :
- `app/owner/leases/page.tsx` → Redirection vers `/owner/leases`
- `app/owner/leases/[id]/page.tsx` → Redirection vers `/owner/leases/[id]`

**Impact** : Moyen (redirections + liens + renommage fichiers)

**Recommandation** : ⚠️ **OPTIONNEL** - À décider selon priorité

---

#### **Option B : Noms de champs DB en français** (Non recommandé)

**Contexte** :
- Champs DB actuels : `type_bien`, `description_logement`, `code_logement`, `locataire_type`, `type_bail`
- Lexique canonique : `Property`, `Tenant`, `Lease`
- Incohérence : Noms DB en français vs code en anglais

**Fichiers concernés** :
- Toutes les migrations SQL
- Tous les fichiers utilisant ces champs
- Tous les types TypeScript référençant ces champs

**Impact** : Élevé (migration DB + code + breaking changes)

**Recommandation** : ❌ **NON RECOMMANDÉ** - Garder les noms DB existants

---

## 📊 TABLEAU RÉCAPITULATIF DES ACTIONS

| Action | Fichiers concernés | Impact | Priorité | Recommandation |
|--------|-------------------|--------|----------|----------------|
| **Aucune action** (code conforme) | - | Aucun | ✅ **FAITE** | ✅ **CONFORME** |
| Renommer route `/contracts` → `/leases` | 4 fichiers + liens | Moyen | ⚠️ **OPTIONNEL** | ⚠️ **À DÉCIDER** |
| Renommer champs DB français → anglais | Tous les fichiers | Élevé | ❌ **NON RECOMMANDÉ** | ❌ **NE PAS FAIRE** |

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

### ✅ ÉTAPE 1 : VALIDATION (FAITE)

- ✅ Code vérifié : **100% conforme**
- ✅ Aucune action critique nécessaire

### ⚠️ ÉTAPE 2 : DÉCISION OPTIONNELLE

**Question** : Souhaitez-vous renommer la route `/contracts` en `/leases` pour cohérence avec le lexique ?

**Si OUI** :
1. Renommer les fichiers de route
2. Créer les redirections
3. Mettre à jour tous les liens
4. Tester les redirections

**Si NON** :
- ✅ Aucune action supplémentaire nécessaire

---

## 📋 RÉSUMÉ EXÉCUTIF

### ✅ CODE : DÉJÀ CONFORME

- ✅ Types : `Property`, `Owner`, `Tenant`, `Lease`
- ✅ Variables : `property`, `owner`, `tenant`, `lease`
- ✅ Fonctions : `createProperty()`, `getOwner()`, etc.
- ✅ Composants : `PropertyCard`, `PropertyWizard`, etc.

### ⚠️ DÉCISIONS OPTIONNELLES

1. **Route `/contracts`** : ⚠️ À décider (renommer en `/leases` ou garder)
2. **Noms DB français** : ✅ Garder (pas de migration nécessaire)
3. **Textes UI français** : ✅ Garder (normal pour interface utilisateur)

---

**Date de création** : 2025-01-XX
**Statut** : ✅ **CODE CONFORME** - Aucune action critique nécessaire

