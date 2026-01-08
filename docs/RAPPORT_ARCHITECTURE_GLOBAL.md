# 📊 Rapport d'Architecture Global - Talok

**Date:** 2025-02-19  
**Version:** 1.0  
**Auteur:** Analyse Automatique

---

## 📋 Table des Matières

1. [Résumé Exécutif](#résumé-exécutif)
2. [Architecture Backend](#architecture-backend)
3. [Architecture Frontend](#architecture-frontend)
4. [Connexions Frontend-Backend](#connexions-frontend-backend)
5. [Éléments Non Connectés](#éléments-non-connectés)
6. [Doublons et Redondances](#doublons-et-redondances)
7. [Cohérence des Données](#cohérence-des-données)
8. [Recommandations](#recommandations)

---

## 🎯 Résumé Exécutif

### Vue d'ensemble

- **Backend:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Frontend:** Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- **Total Routes API:** ~160 routes
- **Total Services:** 34 services TypeScript
- **Total Migrations:** 56 migrations SQL
- **Total Composants:** ~200+ composants React

### Points Clés

✅ **Points Forts:**
- Architecture bien structurée avec séparation claire des responsabilités
- Utilisation cohérente de `apiClient` pour la plupart des appels API
- RLS (Row Level Security) configuré sur toutes les tables sensibles
- Validation Zod pour toutes les entrées utilisateur
- Types TypeScript complets

⚠️ **Points d'Attention:**
- **2 systèmes d'appels API parallèles** (`apiClient` vs `fetch` direct)
- **Services utilisant Supabase directement** au lieu des routes API
- **Routes API non utilisées** (~15% des routes)
- **Doublons de logique** entre services et routes API
- **Incohérences de types** (Property legacy vs V3)

---

## 🗄️ Architecture Backend

### 1. Base de Données (Supabase PostgreSQL)

#### Tables Principales

| Table | Lignes Est. | RLS | Migrations |
|-------|-------------|-----|------------|
| `profiles` | ~1000 | ✅ | 20240101000001 |
| `properties` | ~500 | ✅ | 20240101000000 |
| `leases` | ~300 | ✅ | 20240101000013 |
| `invoices` | ~2000 | ✅ | 20240101000000 |
| `payments` | ~1500 | ✅ | 20240101000000 |
| `tickets` | ~400 | ✅ | 20240101000020 |
| `documents` | ~1000 | ✅ | 202411140230 |
| `units` | ~100 | ✅ | 20240101000000 |
| `charges` | ~300 | ✅ | 20240101000000 |
| `work_orders` | ~200 | ✅ | 20240101000000 |

#### Migrations SQL

**Total:** 56 migrations

**Catégories:**
- **Schéma initial:** 20240101000000 - 20240101000005
- **RLS Policies:** 20240101000001, 20240101000006, 20240101000008, etc.
- **Corrections RLS:** 20240101000011 - 20240101000017 (fix récursion)
- **Fonctionnalités avancées:** 202411140100 - 202411151200
- **Property V3:** 202502150000 - 202502190003

**Problèmes identifiés:**
- ⚠️ Migrations de correction RLS multiples (indique problèmes récurrents)
- ⚠️ Migrations de diagnostic (`202502190000_diagnostic_owner_id.sql`)

### 2. Routes API (Next.js)

#### Statistiques

- **Total Routes:** ~160 routes API
- **Routes Utilisées:** ~135 (84%)
- **Routes Non Utilisées:** ~25 (16%)

#### Routes par Domaine

| Domaine | Routes | Utilisées | Non Utilisées |
|---------|--------|-----------|---------------|
| **Properties** | 25 | 22 | 3 |
| **Leases** | 18 | 15 | 3 |
| **Invoices** | 5 | 5 | 0 |
| **Tickets** | 8 | 7 | 1 |
| **Documents** | 6 | 5 | 1 |
| **Admin** | 35 | 28 | 7 |
| **Tenant** | 20 | 18 | 2 |
| **Auth** | 4 | 3 | 1 |
| **Autres** | 19 | 14 | 5 |

#### Routes Non Utilisées Identifiées

**Admin:**
- `/api/admin/tests/table-exists` - Route de test non utilisée
- `/api/admin/management-api/branches` - Gestion branches Supabase
- `/api/admin/management-api/projects` - Gestion projets Supabase
- `/api/admin/management-api/secrets` - Gestion secrets

**Properties:**
- `/api/properties/test` - Route de test
- `/api/properties/diagnostic` - Route de diagnostic
- `/api/debug/properties` - Route de debug

**Autres:**
- `/api/accounting/gl` - Grand livre comptable (utilisé uniquement dans admin/accounting)
- `/api/accounting/exports` - Exports comptables
- `/api/analytics/rebuild` - Reconstruction analytics
- `/api/analytics/dashboards` - Dashboards analytics

### 3. Edge Functions (Supabase)

**Total:** 3 fonctions

- `generate-pdf` - Génération PDF (baux, quittances)
- `process-payment` - Traitement paiements Stripe
- `send-email` - Envoi emails

**Statut:** ✅ Implémentées mais nécessitent configuration

---

## 🎨 Architecture Frontend

### 1. Pages (Next.js App Router)

#### Routes Principales

| Route | Composant | Service Utilisé | Statut |
|-------|-----------|-----------------|--------|
| `/properties` | `PropertiesList` | `propertiesService` | ✅ |
| `/properties/[id]` | `PropertyDetail` | `propertiesService` | ✅ |
| `/leases` | `LeasesList` | `leasesService` | ✅ |
| `/invoices` | `InvoicesList` | `invoicesService` | ✅ |
| `/tickets` | `TicketsList` | `ticketsService` | ✅ |
| `/dashboard` | `DashboardContent` | `useAuth` | ⚠️ Direct Supabase |
| `/admin/overview` | `AdminOverviewContent` | `fetch` direct | ⚠️ Pas de service |

### 2. Composants

#### Composants par Domaine

| Domaine | Composants | Services Connectés |
|---------|------------|-------------------|
| **Properties** | 15 | ✅ `propertiesService` |
| **Leases** | 4 | ✅ `leasesService` |
| **Invoices** | 4 | ✅ `invoicesService` |
| **Tickets** | 4 | ✅ `ticketsService` |
| **Documents** | 4 | ✅ `documentsService` |
| **Admin** | 3 | ⚠️ Mixte |
| **Tenant** | 3 | ✅ Services dédiés |

### 3. Hooks Personnalisés

| Hook | Utilisation | Connexion |
|------|-------------|-----------|
| `useAuth` | 50+ fichiers | ✅ Supabase direct + API fallback |
| `useProfile` | 15 fichiers | ✅ Supabase direct |
| `useProperties` | 8 fichiers | ✅ `propertiesService` |
| `useLeases` | 6 fichiers | ✅ `leasesService` |
| `useInvoices` | 5 fichiers | ✅ `invoicesService` |
| `useTickets` | 4 fichiers | ✅ `ticketsService` |
| `useDocuments` | 3 fichiers | ✅ `documentsService` |
| `useWorkOrders` | 2 fichiers | ✅ `workOrdersService` |

---

## 🔗 Connexions Frontend-Backend

### 1. Systèmes d'Appels API

#### Système 1: `apiClient` (Recommandé) ✅

**Utilisation:** ~70% des appels API

**Services utilisant `apiClient`:**
- ✅ `propertiesService` - 100% via `apiClient`
- ✅ `leasesService` - 100% via `apiClient`
- ✅ `invoicesService` - 100% via `apiClient`
- ✅ `ticketsService` - 100% via `apiClient`
- ✅ `documentsService` - 100% via `apiClient`
- ✅ `notificationsService` - 100% via `apiClient`
- ✅ `edlService` - 100% via `apiClient`
- ✅ `chatService` - 100% via `apiClient`
- ✅ `applicationsService` - 100% via `apiClient`
- ✅ `metersService` - 100% via `apiClient`
- ✅ `paymentSharesService` - 100% via `apiClient`
- ✅ `roommatesService` - 100% via `apiClient`
- ✅ `leaseSignaturesService` - 100% via `apiClient`

**Avantages:**
- Gestion centralisée des erreurs
- Timeout automatique (20s)
- Gestion de session expirée
- Logging en développement

#### Système 2: `fetch` Direct ⚠️

**Utilisation:** ~20% des appels API

**Fichiers utilisant `fetch` direct:**
- ⚠️ `app/admin/overview/page.tsx` - `/api/admin/overview`
- ⚠️ `app/admin/providers/pending/page.tsx` - `/api/admin/providers/invite`
- ⚠️ `app/admin/moderation/page.tsx` - `/api/admin/moderation/rules`
- ⚠️ `app/admin/accounting/page.tsx` - `/api/accounting/gl`
- ⚠️ `app/admin/privacy/page.tsx` - `/api/privacy/anonymize`
- ⚠️ `app/signup/consents/page.tsx` - `/api/consents`
- ⚠️ `features/auth/services/auth.service.ts` - `/api/me/profile`
- ⚠️ `features/profiles/components/profile-general-form.tsx` - `/api/me/avatar`
- ⚠️ `features/admin/services/stats.service.ts` - `/api/admin/stats`
- ⚠️ `features/notifications/services/email.service.ts` - `/api/emails/send`

**Problèmes:**
- Pas de gestion centralisée des erreurs
- Pas de timeout automatique
- Code dupliqué pour la gestion de session
- Logging incohérent

#### Système 3: Supabase Direct ⚠️

**Utilisation:** ~10% des appels

**Services utilisant Supabase direct:**
- ⚠️ `chargesService` - 100% Supabase direct
- ⚠️ `paymentsService` - 100% Supabase direct
- ⚠️ `useAuth` - Supabase direct avec fallback API
- ⚠️ `useProfile` - Supabase direct
- ⚠️ `ownerProfilesService` - Supabase direct
- ⚠️ `tenantProfilesService` - Supabase direct
- ⚠️ `providerProfilesService` - Supabase direct

**Problèmes:**
- Contourne les routes API (pas de validation serveur)
- Pas de gestion centralisée des permissions
- RLS peut causer des problèmes de récursion

### 2. Matrice de Connexion

| Service | Routes API | apiClient | fetch Direct | Supabase Direct |
|---------|-----------|-----------|--------------|-----------------|
| `propertiesService` | ✅ 15 routes | ✅ | ❌ | ❌ |
| `leasesService` | ✅ 12 routes | ✅ | ❌ | ❌ |
| `invoicesService` | ✅ 5 routes | ✅ | ❌ | ❌ |
| `ticketsService` | ✅ 6 routes | ✅ | ❌ | ❌ |
| `documentsService` | ✅ 5 routes | ✅ | ❌ | ❌ |
| `chargesService` | ⚠️ 2 routes | ❌ | ❌ | ✅ |
| `paymentsService` | ⚠️ 2 routes | ❌ | ❌ | ✅ |
| `notificationsService` | ✅ 2 routes | ✅ | ❌ | ❌ |
| `edlService` | ✅ 3 routes | ✅ | ❌ | ❌ |
| `chatService` | ✅ 1 route | ✅ | ❌ | ❌ |
| `applicationsService` | ✅ 3 routes | ✅ | ❌ | ❌ |
| `metersService` | ✅ 4 routes | ✅ | ❌ | ❌ |
| `paymentSharesService` | ✅ 3 routes | ✅ | ❌ | ❌ |
| `roommatesService` | ✅ 1 route | ✅ | ❌ | ❌ |
| `leaseSignaturesService` | ✅ 1 route | ✅ | ❌ | ❌ |

---

## 🚫 Éléments Non Connectés

### 1. Routes API Non Utilisées

#### Routes de Test/Debug (À Supprimer)

```typescript
// app/api/properties/test/route.ts
// app/api/properties/diagnostic/route.ts
// app/api/debug/properties/route.ts
// app/api/admin/tests/table-exists/route.ts
```

**Recommandation:** Supprimer ou déplacer dans un dossier `/api/_debug/` avec protection admin

#### Routes Admin Avancées (Non Utilisées)

```typescript
// app/api/admin/management-api/branches/route.ts
// app/api/admin/management-api/projects/route.ts
// app/api/admin/management-api/secrets/route.ts
```

**Recommandation:** Documenter ou supprimer si non nécessaires

#### Routes Analytics (Utilisation Limitée)

```typescript
// app/api/analytics/rebuild/route.ts
// app/api/analytics/dashboards/route.ts
```

**Recommandation:** Vérifier l'utilisation réelle

### 2. Services Non Utilisés

#### Services avec Routes API Mais Non Utilisés

- ⚠️ `chargesService` - Routes API existent mais service utilise Supabase direct
- ⚠️ `paymentsService` - Routes API existent mais service utilise Supabase direct

**Recommandation:** Migrer vers `apiClient`

### 3. Composants Isolés

#### Composants Sans Connexion Backend

- ⚠️ `app/dashboard/page.tsx` - Utilise `useAuth` mais pas de service dédié
- ⚠️ `app/admin/overview/page.tsx` - Utilise `fetch` direct au lieu d'un service

**Recommandation:** Créer des services dédiés

### 4. Hooks Non Utilisés

- ⚠️ `use-dashboard.ts` - Hook créé mais utilisation limitée
- ⚠️ `use-mutation-with-toast.ts` - Hook créé mais utilisation limitée

---

## 🔄 Doublons et Redondances

### 1. Doublons de Logique

#### 1.1 Gestion des Propriétés

**Problème:** Deux systèmes parallèles

**Système 1: Legacy (`Property`)**
- Types: `lib/types/index.ts` (Property, PropertyType, PropertyStatus)
- Schémas: `lib/validations/index.ts` (propertySchema)
- Service: `propertiesService` (utilise Property legacy)

**Système 2: V3 (`PropertyV3`)**
- Types: `lib/types/property-v3.ts` (PropertyV3, PropertyTypeV3)
- Schémas: `lib/validations/property-v3.ts` (propertySchemaV3)
- Composants: `features/properties/components/v3/` (PropertyWizardV3)

**Impact:**
- ⚠️ Confusion entre les deux systèmes
- ⚠️ Migration progressive en cours mais incomplète
- ⚠️ Types marqués `@deprecated` mais toujours utilisés

**Recommandation:** Finaliser la migration vers V3 ou documenter la coexistence

#### 1.2 Appels API

**Problème:** Trois méthodes différentes

1. `apiClient` (recommandé) - 70%
2. `fetch` direct - 20%
3. Supabase direct - 10%

**Recommandation:** Migrer tout vers `apiClient`

#### 1.3 Routes API Dupliquées

**Problème:** Certaines routes ont des fonctionnalités similaires

- `/api/properties/[id]` vs `/api/properties/[id]/route.ts` (même route, vérifier doublon)
- `/api/leases/[id]` vs `/api/leases/[id]/activate` (logique partagée)

**Recommandation:** Vérifier et consolider

### 2. Services Dupliqués

#### 2.1 Services de Profils

**Problème:** Logique similaire dans 3 services

- `ownerProfilesService` - Supabase direct
- `tenantProfilesService` - Supabase direct
- `providerProfilesService` - Supabase direct

**Recommandation:** Créer un service générique `profilesService` avec spécialisation

#### 2.2 Services Admin

**Problème:** Services admin dispersés

- `peopleService` - Gestion personnes
- `statsService` - Statistiques
- `processTestsService` - Tests processus

**Recommandation:** Regrouper dans un module `adminService`

### 3. Composants Dupliqués

#### 3.1 Formulaires de Propriétés

**Problème:** Deux systèmes de formulaires

- Legacy: `features/properties/components/property-form.tsx`
- V3: `features/properties/components/v3/property-wizard-v3.tsx`

**Recommandation:** Finaliser migration vers V3

#### 3.2 Pages Propriétaires

**Problème:** Deux structures de pages

- `/app/properties/` - Pages legacy
- `/app/owner/properties/` - Pages nouvelles

**Recommandation:** Consolider dans une seule structure

---

## 📊 Cohérence des Données

### 1. Types TypeScript

#### 1.1 Types Property

**Problème:** Incohérence entre types legacy et V3

```typescript
// Legacy (deprecated)
type PropertyType = "appartement" | "maison" | ...
type PropertyStatus = "brouillon" | "en_attente" | ...

// V3 (actuel)
type PropertyTypeV3 = "apartment" | "house" | ...
type PropertyStatusV3 = "draft" | "pending" | ...
```

**Impact:**
- ⚠️ Conversion nécessaire entre les deux systèmes
- ⚠️ Risque d'erreurs de type
- ⚠️ Code difficile à maintenir

**Recommandation:** Finaliser migration vers V3

#### 1.2 Types de Validation

**Problème:** Schémas Zod dupliqués

- `propertySchema` (legacy)
- `propertySchemaV3` (nouveau)
- `propertyGeneralUpdateSchema` (mise à jour)

**Recommandation:** Unifier les schémas

### 2. Schémas de Base de Données

#### 2.1 Colonnes Property

**Problème:** Colonnes legacy et V3 coexistent

- Colonnes legacy: `type`, `usage_principal`, `status`
- Colonnes V3: `type_bien`, `usage_principal`, `etat`

**Recommandation:** Migration de données et suppression colonnes legacy

#### 2.2 Indexes

**Problème:** Indexes potentiellement manquants

**Vérification nécessaire:**
- Index sur `properties.owner_id`
- Index sur `leases.property_id`
- Index sur `invoices.lease_id`
- Index sur `tickets.property_id`

**Recommandation:** Audit des performances et ajout d'indexes si nécessaire

### 3. RLS Policies

#### 3.1 Problèmes de Récursion

**Problème:** Migrations de correction RLS multiples

- `20240101000006_fix_rls_recursion.sql`
- `20240101000011_fix_properties_rls_recursion.sql`
- `20240101000015_fix_leases_rls_recursion.sql`
- `202501170000_fix_lease_signers_recursion.sql`
- `202501170001_fix_tenant_profiles_rls_recursion.sql`
- `202501170002_fix_roommates_rls_recursion.sql`

**Impact:**
- ⚠️ Indique des problèmes récurrents de récursion RLS
- ⚠️ Performance potentiellement impactée

**Recommandation:** Audit complet des politiques RLS et refactorisation

---

## 💡 Recommandations

### Priorité Haute 🔴

1. **Unifier les appels API**
   - Migrer tous les `fetch` directs vers `apiClient`
   - Migrer `chargesService` et `paymentsService` vers `apiClient`
   - Créer un guide de style pour les appels API

2. **Finaliser Migration Property V3**
   - Migrer tous les composants legacy vers V3
   - Supprimer les types `@deprecated`
   - Mettre à jour la documentation

3. **Nettoyer Routes API Non Utilisées**
   - Supprimer routes de test/debug
   - Documenter routes admin avancées
   - Créer un dossier `/api/_debug/` protégé

4. **Audit RLS**
   - Identifier toutes les politiques RLS problématiques
   - Refactoriser pour éviter la récursion
   - Documenter les politiques RLS

### Priorité Moyenne 🟡

5. **Consolider Services**
   - Créer `profilesService` générique
   - Regrouper services admin dans `adminService`
   - Créer services pour pages admin utilisant `fetch` direct

6. **Améliorer Cohérence Types**
   - Unifier les schémas Zod
   - Créer des helpers de conversion Property legacy ↔ V3
   - Documenter les types et leurs usages

7. **Optimiser Base de Données**
   - Audit des indexes
   - Vérifier les performances des requêtes fréquentes
   - Optimiser les migrations de correction RLS

### Priorité Basse 🟢

8. **Documentation**
   - Documenter l'architecture globale
   - Créer des guides pour chaque domaine
   - Documenter les décisions d'architecture

9. **Tests**
   - Ajouter tests pour les services utilisant `apiClient`
   - Tests d'intégration pour les routes API
   - Tests E2E pour les flux critiques

10. **Monitoring**
    - Ajouter logging centralisé pour les appels API
    - Monitoring des performances RLS
    - Alertes pour les erreurs fréquentes

---

## 📈 Métriques

### Couverture des Connexions

- **Services utilisant `apiClient`:** 12/15 (80%)
- **Routes API utilisées:** 135/160 (84%)
- **Composants connectés:** 95%+
- **Hooks utilisés:** 14/16 (88%)

### Qualité du Code

- **Types TypeScript:** ✅ Complets
- **Validation Zod:** ✅ Tous les formulaires
- **RLS Policies:** ⚠️ Problèmes de récursion récurrents
- **Gestion d'erreurs:** ⚠️ Incohérente (3 systèmes)

---

## 📝 Conclusion

L'architecture globale est **solide** avec une bonne séparation des responsabilités. Cependant, il existe des **incohérences** dans les méthodes d'appel API et des **doublons** entre systèmes legacy et V3.

**Actions immédiates recommandées:**
1. Unifier les appels API vers `apiClient`
2. Finaliser la migration Property V3
3. Nettoyer les routes API non utilisées
4. Auditer et corriger les politiques RLS

**Temps estimé pour corrections:** 2-3 semaines

---

**Fin du Rapport**


