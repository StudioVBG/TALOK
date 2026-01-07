# 📊 Rapport des Fonctions et Routes du Compte Propriétaire

**Date de génération :** 2025-01-18  
**Version de l'application :** Production

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Routes Frontend (Pages)](#routes-frontend-pages)
3. [Routes API Backend](#routes-api-backend)
4. [Hooks et Services](#hooks-et-services)
5. [Fonctionnalités par module](#fonctionnalités-par-module)
6. [Permissions et sécurité](#permissions-et-sécurité)
7. [Statistiques techniques](#statistiques-techniques)

---

## 🎯 Vue d'ensemble

Le compte propriétaire est une interface complète de gestion locative permettant aux propriétaires de :
- Gérer leur portefeuille de biens immobiliers
- Créer et suivre les baux locatifs
- Gérer les factures et paiements
- Suivre les tickets de maintenance
- Consulter les documents
- Accéder à un tableau de bord avec KPIs

**Base path :** `/owner`

---

## 🖥️ Routes Frontend (Pages)

### 1. Tableau de bord
**Route :** `/owner/dashboard`  
**Fichier :** `app/owner/dashboard/page.tsx`  
**API associée :** `GET /api/owner/dashboard`

**Fonctionnalités :**
- Vue d'ensemble du portefeuille
- Zone 1 : Tâches à faire (relances, signatures en attente, fins de bail)
- Zone 2 : Résumé financier (revenus mensuels, graphiques 6 mois, impayés)
- Zone 3 : Portefeuille par module (habitation, LCD, pro, parking)
- Zone 4 : Conformité et risques

**Composants utilisés :**
- `OwnerTodoSection`
- `OwnerFinanceSummary`
- `OwnerPortfolioByModule`
- `OwnerRiskSection`

---

### 2. Mes biens
**Route :** `/owner/properties`  
**Fichier :** `app/owner/properties/page.tsx`  
**API associée :** `GET /api/properties`

**Fonctionnalités :**
- Liste de tous les biens du propriétaire
- Filtres par type, statut, module
- Recherche par adresse
- Affichage du statut (loué, vacant, en préavis)
- Lien vers les détails de chaque bien
- Bouton "Ajouter un bien"

**Hooks utilisés :**
- `useProperties()` - Liste des propriétés
- `useLeases()` - Liste des baux (chargé conditionnellement)

**Filtres disponibles :**
- Par module : `habitation`, `pro`, `lcd`, `parking`
- Par type : `appartement`, `maison`, `colocation`, `saisonnier`, etc.
- Par statut : `loue`, `vacant`, `en_preavis`

---

### 3. Détails d'un bien
**Route :** `/owner/properties/[id]`  
**Fichier :** `app/owner/properties/[id]/page.tsx`  
**API associée :** `GET /api/properties/[id]`

**Fonctionnalités :**
- Informations détaillées du bien
- Liste des baux associés
- Historique des locations
- Documents attachés
- Tickets de maintenance

**Hooks utilisés :**
- `useProperty(id)` - Détails du bien
- `useLeases(propertyId)` - Baux du bien

---

### 4. Ajouter un bien
**Route :** `/owner/properties/new`  
**Fichier :** `app/owner/properties/new/page.tsx`  
**API associée :** `POST /api/properties`

**Fonctionnalités :**
- Formulaire d'ajout de bien (wizard V3)
- Support des types : appartement, maison, studio, colocation, saisonnier, local commercial, bureaux, entrepôt, parking, box, fonds de commerce
- Création de draft ou bien complet
- Génération automatique d'un code unique

**Composant utilisé :**
- `PropertyWizardV3`

---

### 5. Baux & locataires
**Route :** `/owner/leases`  
**Fichier :** `app/owner/leases/page.tsx`  
**API associée :** `GET /api/leases`

**Fonctionnalités :**
- Liste de tous les baux
- Filtres par propriété, statut
- Affichage des locataires
- Statuts : draft, pending_signature, active, terminated

**Hooks utilisés :**
- `useLeases(propertyId?)` - Liste des baux
- `useProperties()` - Liste des propriétés (pour filtres)

---

### 6. Détails d'un bail
**Route :** `/owner/leases/[id]`  
**Fichier :** `app/owner/leases/[id]/page.tsx`  
**API associée :** `GET /api/leases/[id]`

**Fonctionnalités :**
- Détails complets du bail
- Signataires et statuts de signature
- Factures associées
- Documents (bail, EDL, quittances)

**Hooks utilisés :**
- `useLease(id)` - Détails du bail
- `useProperties()` - Liste des propriétés

---

### 7. Loyers & revenus
**Route :** `/owner/money`  
**Fichier :** `app/owner/money/page.tsx`  
**API associée :** `GET /api/invoices`

**Fonctionnalités :**
- Liste des factures
- Filtres par période, propriété, statut
- Affichage des montants (loyer, charges, total)
- Statuts : draft, sent, paid, late
- Vue des impayés

**Hooks utilisés :**
- `useInvoices()` - Liste des factures
- `useLeases(propertyId?)` - Liste des baux
- `useProperties()` - Liste des propriétés

---

### 8. Documents
**Route :** `/owner/documents`  
**Fichier :** `app/owner/documents/page.tsx`

**Fonctionnalités :**
- Liste des documents
- Filtres par type, propriété, bail
- Upload de documents
- Types : bail, EDL_entree, EDL_sortie, quittance, attestation_assurance, etc.

---

### 9. Aide & services
**Route :** `/owner/support`  
**Fichier :** `app/owner/support/page.tsx`

**Fonctionnalités :**
- Centre d'aide
- Création de tickets de support
- FAQ
- Contact support

---

### 10. Mon profil
**Route :** `/owner/profile`  
**Fichier :** `app/owner/profile/page.tsx`  
**API associée :** `GET /api/me/profile`, `PUT /api/me/profile`

**Fonctionnalités :**
- Informations personnelles
- Informations professionnelles (SIRET, TVA, IBAN)
- Adresse de facturation
- Gestion de l'avatar

---

## 🔌 Routes API Backend

### Routes principales

#### 1. Propriétés

**`GET /api/properties`**
- **Description :** Liste des propriétés selon le rôle
- **Permissions :** Owner (ses propriétés), Admin (toutes), Tenant (via baux)
- **Paramètres query :**
  - `owner_id` (optionnel) - Filtrer par propriétaire
  - `property_id` (optionnel) - Filtrer par propriété
- **Réponse :** `{ properties: Property[] }`
- **Optimisations :**
  - Colonnes essentielles uniquement
  - Timeout de 5 secondes par requête
  - Cache HTTP 60 secondes
  - Limite de 100 propriétés pour owners

**`POST /api/properties`**
- **Description :** Créer une nouvelle propriété
- **Permissions :** Owner uniquement
- **Body :** `{ type_bien, usage_principal? }` (draft) ou données complètes
- **Réponse :** `{ property: Property }`
- **Fonctionnalités :**
  - Génération automatique d'un code unique
  - Support V3 (type_bien) et Legacy (type)
  - Création de draft ou bien complet

**`GET /api/properties/[id]`**
- **Description :** Détails d'une propriété
- **Permissions :** Owner (ses propriétés), Admin, Tenant (via bail)
- **Réponse :** `{ property: Property }`

**`PUT /api/properties/[id]`**
- **Description :** Mettre à jour une propriété
- **Permissions :** Owner (ses propriétés), Admin
- **Body :** Données partielles de la propriété
- **Réponse :** `{ property: Property }`

**`DELETE /api/properties/[id]`**
- **Description :** Supprimer une propriété
- **Permissions :** Owner (ses propriétés), Admin
- **Réponse :** `{ success: true }`

---

#### 2. Baux

**`GET /api/leases`**
- **Description :** Liste des baux selon le rôle
- **Permissions :** Owner (baux de ses propriétés), Tenant (ses baux), Admin (tous)
- **Paramètres query :**
  - `propertyId` ou `property_id` - Filtrer par propriété
  - `owner_id` - Filtrer par propriétaire (owners uniquement)
- **Réponse :** `{ leases: Lease[] }`
- **Optimisations :**
  - Gestion de `property_id=new` (retourne tableau vide)
  - Sous-requête pour owners (évite 2 requêtes séparées)
  - Cache HTTP 60 secondes

**`POST /api/leases`**
- **Description :** Créer un nouveau bail
- **Permissions :** Owner uniquement
- **Body :** Données du bail (type_bail, property_id, loyer, etc.)
- **Réponse :** `{ lease: Lease }`

**`GET /api/leases/[id]`**
- **Description :** Détails d'un bail
- **Permissions :** Owner (baux de ses propriétés), Tenant (ses baux), Admin
- **Réponse :** `{ lease: Lease }`

**`PUT /api/leases/[id]`**
- **Description :** Mettre à jour un bail
- **Permissions :** Owner (baux de ses propriétés), Admin
- **Body :** Données partielles du bail
- **Réponse :** `{ lease: Lease }`

**`DELETE /api/leases/[id]`**
- **Description :** Supprimer un bail
- **Permissions :** Owner (baux de ses propriétés), Admin
- **Réponse :** `{ success: true }`

---

#### 3. Factures

**`GET /api/invoices`**
- **Description :** Liste des factures selon le rôle
- **Permissions :** Owner (ses factures), Tenant (ses factures), Admin (toutes)
- **Réponse :** `{ invoices: Invoice[] }`
- **Tri :** Par période décroissante

**`POST /api/invoices`**
- **Description :** Créer une nouvelle facture
- **Permissions :** Owner uniquement
- **Body :** `{ lease_id, periode, montant_loyer, montant_charges }`
- **Réponse :** `{ invoice: Invoice }`
- **Fonctionnalités :**
  - Calcul automatique du montant_total
  - Vérification que le bail appartient au propriétaire
  - Récupération automatique du locataire principal
  - Émission d'événement `Rent.InvoiceIssued`

**`GET /api/invoices/[id]`**
- **Description :** Détails d'une facture
- **Permissions :** Owner (ses factures), Tenant (ses factures), Admin
- **Réponse :** `{ invoice: Invoice }`

**`PUT /api/invoices/[id]`**
- **Description :** Mettre à jour une facture
- **Permissions :** Owner (ses factures), Admin
- **Body :** Données partielles de la facture
- **Réponse :** `{ invoice: Invoice }`

**`DELETE /api/invoices/[id]`**
- **Description :** Supprimer une facture
- **Permissions :** Owner (ses factures), Admin
- **Réponse :** `{ success: true }`

---

#### 4. Tickets

**`GET /api/tickets`**
- **Description :** Liste des tickets selon le rôle
- **Permissions :** Owner (tickets de ses propriétés), Tenant (ses tickets), Admin (tous)
- **Réponse :** `{ tickets: Ticket[] }`
- **Optimisations :**
  - Cache HTTP 60 secondes
  - Utilisation du service client pour éviter RLS

**`POST /api/tickets`**
- **Description :** Créer un nouveau ticket
- **Permissions :** Owner, Tenant, Provider
- **Body :** `{ property_id, lease_id?, titre, description, priorite }`
- **Réponse :** `{ ticket: Ticket }`
- **Fonctionnalités :**
  - Statut initial : `open`
  - Émission d'événement `Ticket.Opened`

**`GET /api/tickets/[id]`**
- **Description :** Détails d'un ticket
- **Permissions :** Owner (tickets de ses propriétés), Tenant (ses tickets), Admin
- **Réponse :** `{ ticket: Ticket }`

**`PUT /api/tickets/[id]`**
- **Description :** Mettre à jour un ticket
- **Permissions :** Owner (tickets de ses propriétés), Tenant (ses tickets), Admin
- **Body :** Données partielles du ticket
- **Réponse :** `{ ticket: Ticket }`

**`DELETE /api/tickets/[id]`**
- **Description :** Supprimer un ticket
- **Permissions :** Owner (tickets de ses propriétés), Admin
- **Réponse :** `{ success: true }`

---

#### 5. Documents

**`POST /api/documents/upload`**
- **Description :** Uploader un document
- **Permissions :** Owner, Tenant, Admin
- **Body :** FormData avec `file`, `property_id?`, `lease_id?`, `type?`
- **Réponse :** `{ document: Document }`
- **Fonctionnalités :**
  - Upload vers Supabase Storage
  - Création d'entrée dans la table `documents`
  - Nettoyage automatique en cas d'erreur

**`GET /api/documents`**
- **Description :** Liste des documents
- **Permissions :** Owner (documents de ses propriétés), Tenant (ses documents), Admin
- **Réponse :** `{ documents: Document[] }`

---

#### 6. Dashboard propriétaire

**`GET /api/owner/dashboard`**
- **Description :** Données du tableau de bord propriétaire
- **Permissions :** Owner uniquement
- **Réponse :**
  ```json
  {
    zone1_tasks: Task[],
    zone2_finances: {
      chart_data: ChartData[],
      kpis: {
        revenue_current_month: { collected, expected, percentage },
        revenue_last_month: { collected, expected, percentage },
        arrears_amount: number
      }
    },
    zone3_portfolio: {
      modules: Module[],
      compliance: Compliance[],
      performance: Performance | null
    }
  }
  ```
- **Optimisations :**
  - Cache HTTP 5 minutes (s-maxage=300)
  - Requêtes parallélisées (Promise.all)
  - Calculs optimisés des KPIs

---

#### 7. Profil

**`GET /api/me/profile`**
- **Description :** Récupérer le profil de l'utilisateur
- **Permissions :** Utilisateur authentifié
- **Réponse :** `{ profile: Profile }`

**`PUT /api/me/profile`**
- **Description :** Mettre à jour le profil
- **Permissions :** Utilisateur authentifié
- **Body :** Données partielles du profil
- **Réponse :** `{ profile: Profile }`

---

## 🪝 Hooks et Services

### Hooks React Query

**`useProperties()`**
- **Fichier :** `lib/hooks/use-properties.ts`
- **Description :** Hook pour récupérer la liste des propriétés
- **Options :**
  - `enabled` - Contrôler quand la requête s'exécute
  - `staleTime: 30s` - Temps avant considérer les données obsolètes
  - `gcTime: 5min` - Temps avant garbage collection
  - `refetchOnWindowFocus: false` - Ne pas refetch au focus
- **Gestion d'erreurs :**
  - Timeout (504) : Message personnalisé
  - Auth (401/403) : Message personnalisé
  - Retry : Max 1 tentative (sauf auth/timeout)

**`useLeases(propertyId?, options?)`**
- **Fichier :** `lib/hooks/use-leases.ts`
- **Description :** Hook pour récupérer la liste des baux
- **Paramètres :**
  - `propertyId` (optionnel) - Filtrer par propriété
  - `options.enabled` - Contrôler quand la requête s'exécute
- **Options :** Identiques à `useProperties()`

**`useInvoices()`**
- **Fichier :** `lib/hooks/use-invoices.ts`
- **Description :** Hook pour récupérer la liste des factures
- **Options :** Identiques à `useProperties()`

**`useTickets()`**
- **Fichier :** `lib/hooks/use-tickets.ts`
- **Description :** Hook pour récupérer la liste des tickets
- **Options :** Identiques à `useProperties()`

**`useProfile()`**
- **Fichier :** `lib/hooks/use-profile.ts`
- **Description :** Hook pour récupérer le profil utilisateur
- **Retourne :** `{ profile, isLoading, error }`

**`useProperty(id)`**
- **Fichier :** `lib/hooks/use-property.ts`
- **Description :** Hook pour récupérer les détails d'une propriété
- **Paramètres :** `id` - ID de la propriété

**`useLease(id)`**
- **Fichier :** `lib/hooks/use-lease.ts`
- **Description :** Hook pour récupérer les détails d'un bail
- **Paramètres :** `id` - ID du bail

---

### Client API

**`apiClient`**
- **Fichier :** `lib/api-client.ts`
- **Description :** Client API unifié pour les appels aux routes Next.js
- **Méthodes :**
  - `get<T>(endpoint)` - GET request
  - `post<T>(endpoint, data?)` - POST request
  - `put<T>(endpoint, data?)` - PUT request
  - `delete<T>(endpoint)` - DELETE request
  - `patch<T>(endpoint, data?)` - PATCH request
  - `uploadFile<T>(endpoint, formData)` - Upload de fichier
- **Fonctionnalités :**
  - Authentification automatique (Bearer token)
  - Timeout de 20 secondes
  - Gestion des erreurs (404, 400, 504, etc.)
  - Logs en développement uniquement

---

## 🎨 Fonctionnalités par module

### Module Habitation
- **Types de biens :** Appartement, Maison, Studio, Colocation
- **Types de baux :** Nu, Meublé, Colocation
- **Fonctionnalités :**
  - Gestion des colocataires
  - Split des paiements
  - États des lieux (EDL)
  - Compteurs (eau, électricité, gaz)

### Module LCD (Location Courte Durée)
- **Types de biens :** Saisonnier
- **Types de baux :** Saisonnier
- **Fonctionnalités :**
  - Gestion des réservations (à venir)
  - Calcul des nuits vendues
  - Revenus mensuels

### Module Pro & Commerces
- **Types de biens :** Local commercial, Bureaux, Entrepôt, Fonds de commerce
- **Types de baux :** Commercial, Professionnel
- **Fonctionnalités :**
  - Gestion des baux commerciaux
  - TVA applicable
  - Indexation des loyers

### Module Parking
- **Types de biens :** Parking, Box
- **Types de baux :** Parking seul
- **Fonctionnalités :**
  - Gestion des places de parking
  - Baux dédiés parking

---

## 🔒 Permissions et sécurité

### Règles RLS (Row Level Security)

Les règles RLS sont appliquées au niveau Supabase pour garantir que :
- Les propriétaires ne voient que leurs propres propriétés
- Les locataires ne voient que leurs baux et factures
- Les admins ont accès à tout

### Vérifications côté API

Toutes les routes API vérifient :
1. **Authentification :** Utilisateur connecté via `getAuthenticatedUser()`
2. **Profil :** Récupération du profil depuis `profiles`
3. **Rôle :** Vérification du rôle (owner, tenant, admin)
4. **Propriété :** Vérification que le propriétaire possède la ressource

### Service Role Key

Certaines routes utilisent `SUPABASE_SERVICE_ROLE_KEY` pour :
- Contourner RLS quand nécessaire
- Effectuer des opérations administratives
- Éviter les problèmes de permissions

**Routes utilisant Service Role :**
- `GET /api/tickets`
- `POST /api/tickets`
- `POST /api/documents/upload`
- `GET /api/properties` (fallback si service role disponible)

---

## 📈 Statistiques techniques

### Performance

**Timeouts configurés :**
- Authentification : 3 secondes
- Requêtes simples : 5 secondes
- Requêtes complexes : 15-20 secondes
- Client API : 20 secondes

**Cache HTTP :**
- Dashboard : 5 minutes (s-maxage=300)
- Propriétés/Baux/Tickets : 60 secondes (max-age=60)
- Stale-while-revalidate : 120 secondes

**Optimisations :**
- Requêtes parallélisées (Promise.all)
- Colonnes essentielles uniquement
- Limites de résultats (50-100)
- Chargement conditionnel des données

### Limites

**Propriétés :**
- Owners : 100 propriétés max par requête
- Admins : 50 propriétés max par requête
- Tenants : Via baux uniquement

**Baux :**
- 50 baux max par requête
- Filtrage par propriété recommandé

**Factures :**
- Pas de limite explicite
- Tri par période décroissante

**Tickets :**
- Pas de limite explicite
- Tri par date de création décroissante

---

## 🐛 Problèmes connus et solutions

### 1. Timeout sur `/api/properties`
**Symptôme :** Attente interminable, serveur plante  
**Cause :** Requêtes trop lourdes, timeouts insuffisants  
**Solution appliquée :**
- Réduction des colonnes récupérées
- Timeouts optimisés (5s par requête)
- Chargement conditionnel des baux
- Gestion gracieuse des erreurs

### 2. Erreur 404 sur `/documents/upload`
**Symptôme :** Route non trouvée  
**Cause :** Route manquante  
**Solution appliquée :**
- Création de la route `/api/documents/upload`
- Support FormData et Supabase Storage

### 3. Propriétés non visibles
**Symptôme :** Propriétaire ne voit pas ses logements  
**Cause :** Service Role Key manquante ou erreur d'authentification  
**Solution appliquée :**
- Fallback sur client utilisateur si service role indisponible
- Gestion gracieuse des erreurs
- Logs améliorés pour debugging

---

## 📝 Notes de développement

### Structure des fichiers

```
app/
├── app/owner/              # Pages frontend propriétaire
│   ├── dashboard/
│   ├── properties/
│   ├── contracts/
│   ├── money/
│   ├── documents/
│   ├── support/
│   └── profile/
├── api/                    # Routes API
│   ├── properties/
│   ├── leases/
│   ├── invoices/
│   ├── tickets/
│   ├── documents/
│   └── owner/
└── lib/
    ├── hooks/              # Hooks React Query
    ├── api-client.ts       # Client API
    └── config/
        └── owner-routes.ts # Configuration des routes
```

### Conventions de nommage

- **Routes API :** `/api/[ressource]` ou `/api/[ressource]/[id]`
- **Pages :** `/owner/[section]` ou `/owner/[section]/[id]`
- **Hooks :** `use[Resource]()` (camelCase)
- **Types :** `[Resource]Row`, `[Resource]Data` (PascalCase)

### Types TypeScript

Les types sont centralisés dans :
- `lib/types/supabase-client.ts` - Types généraux
- `lib/supabase/database.types.ts` - Types générés depuis Supabase
- `lib/supabase/typed-client.ts` - Types pour les clients Supabase

---

## ✅ Checklist de fonctionnalités

### Propriétés
- [x] Liste des propriétés
- [x] Détails d'une propriété
- [x] Création de propriété (draft et complet)
- [x] Modification de propriété
- [x] Suppression de propriété
- [x] Filtres par type, statut, module
- [x] Recherche par adresse

### Baux
- [x] Liste des baux
- [x] Détails d'un bail
- [x] Création de bail
- [x] Modification de bail
- [x] Suppression de bail
- [x] Gestion des signataires
- [x] Statuts de signature

### Factures
- [x] Liste des factures
- [x] Détails d'une facture
- [x] Création de facture
- [x] Modification de facture
- [x] Suppression de facture
- [x] Filtres par période, propriété, statut
- [x] Calcul des impayés

### Tickets
- [x] Liste des tickets
- [x] Détails d'un ticket
- [x] Création de ticket
- [x] Modification de ticket
- [x] Suppression de ticket
- [x] Gestion des priorités

### Documents
- [x] Upload de documents
- [x] Liste des documents
- [x] Filtres par type, propriété, bail

### Dashboard
- [x] Vue d'ensemble
- [x] Tâches à faire
- [x] Résumé financier
- [x] Portefeuille par module
- [x] Conformité et risques

---

## 🔮 Améliorations futures

### Court terme
- [ ] Pagination pour les listes longues
- [ ] Export CSV/PDF des factures
- [ ] Notifications en temps réel
- [ ] Recherche avancée

### Moyen terme
- [ ] Intégration Stripe pour paiements
- [ ] Intégration Yousign pour signatures
- [ ] Module de réservations pour LCD
- [ ] Calcul automatique de l'indexation

### Long terme
- [ ] Application mobile
- [ ] API publique pour intégrations
- [ ] Module de comptabilité avancé
- [ ] Intelligence artificielle pour recommandations

---

**Fin du rapport**

