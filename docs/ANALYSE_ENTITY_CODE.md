# Analyse Complète du Code Entity — TALOK

**Date** : 2026-02-19
**Scope** : Architecture des entités, types TypeScript, schéma SQL, cohérence du modèle de données
**Stack** : Supabase (PostgreSQL 15), Next.js 14+, TypeScript

---

## Table des Matières

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Architecture des Entités](#2-architecture-des-entités)
3. [Incohérences Critiques des Types](#3-incohérences-critiques-des-types)
4. [Problèmes SQL et Intégrité de la Base](#4-problèmes-sql-et-intégrité-de-la-base)
5. [Problèmes RLS (Row-Level Security)](#5-problèmes-rls)
6. [Recommandations](#6-recommandations)

---

## 1. Résumé Exécutif

### Statistiques Clés

| Métrique | Valeur |
|----------|--------|
| **Tables en base** | 127+ |
| **Migrations SQL** | 244 |
| **Types d'entités** | 35+ entités core |
| **Fichiers de types TS** | 28 |
| **Conflits de types critiques** | 4 types majeurs (`PaymentMethod`, `PropertyStatus`, `LeaseStatus`, `InvoiceStatus`) |
| **Définitions en conflit** | 20+ définitions redondantes/incompatibles |
| **Routes API** | 150+ |
| **FK manquantes ou récemment corrigées** | 8-10 |
| **Migrations RLS correctives** | 10+ (derniers 2 mois) |

### Sévérité

| Sévérité | Nombre | Description |
|----------|--------|-------------|
| **CRITICAL** | 4 | Collisions de noms de types, définitions conflictuelles |
| **HIGH** | 6 | FK manquantes, status enum incohérents, nommage mixte FR/EN |
| **MEDIUM** | 5 | Types non définis, design fragile documents, performance RLS |
| **LOW** | 3 | Duplication de types, types manquants pour tables secondaires |

---

## 2. Architecture des Entités

### 2.1 Graphe de Dépendances Principal

```
auth.users (Supabase Auth)
  └── profiles (1:1 via user_id)
      ├── owner_profiles (1:1)
      ├── tenant_profiles (1:1)
      ├── provider_profiles (1:1)
      └── guarantor_profiles (1:1)

      ├── properties (1:N via owner_id)
      │   ├── units (1:N — colocation)
      │   │   └── leases (1:N via unit_id)
      │   ├── leases (1:N via property_id)
      │   │   ├── lease_signers (1:N)
      │   │   ├── invoices (1:N)
      │   │   │   └── payments (1:N)
      │   │   ├── edl (1:N)
      │   │   ├── roommates (1:N)
      │   │   ├── meters (1:N)
      │   │   └── deposit_movements (1:N)
      │   ├── charges (1:N)
      │   ├── photos (1:N)
      │   ├── documents (1:N — multi-parent)
      │   └── tickets (1:N)
      │       └── work_orders (1:N)

      ├── legal_entities (1:N)
      │   ├── entity_associates (1:N)
      │   └── property_ownership (1:N)

      ├── guarantor_engagements (1:N)
      └── documents (multi-parent possible)
```

### 2.2 Entités Core

| Entité | Fichier type TS | Table SQL | Description |
|--------|----------------|-----------|-------------|
| Profile | `lib/types/index.ts` | `profiles` | Base utilisateur (5 rôles) |
| Property | `lib/types/property-v3.ts` | `properties` | Bien immobilier (15 types) |
| Lease | `lib/types/index.ts` | `leases` | Bail (12 types) |
| LeaseSigner | `lib/types/index.ts` | `lease_signers` | Signataire de bail |
| Invoice | `lib/types/index.ts` | `invoices` | Facture locataire |
| Payment | `lib/types/index.ts` | `payments` | Paiement |
| Document | `lib/types/ged.ts` | `documents` | GED (45+ types) |
| Ticket | `lib/types/index.ts` | `tickets` | Maintenance |
| WorkOrder | `lib/types/index.ts` | `work_orders` | Ordre de travail |
| LegalEntity | `lib/types/legal-entity.ts` | `legal_entities` | Structure juridique |
| Guarantor | `lib/types/guarantor.ts` | `guarantor_profiles` | Garant |

### 2.3 Entités Spécialisées (SOTA 2026 / GAP)

| Entité | Fichier | Description |
|--------|---------|-------------|
| CommercialLease | `lib/types/index.ts` | Baux 3-6-9 (GAP-003) |
| ProfessionalLease | `lib/types/index.ts` | Bail professionnel Art. 57A (GAP-004) |
| StudentLease | `lib/types/index.ts` | Bail étudiant 9 mois (GAP-008) |
| LocationGerance | `lib/types/index.ts` | Location-gérance (GAP-005) |
| TaxeSejour | `lib/types/index.ts` | Déclaration taxe de séjour (GAP-006) |
| Building | `lib/types/index.ts` | Immeuble |
| Site (Copro) | `lib/types/copro.ts` | Copropriété/lotissement |
| FurnitureInventory | migrations | Inventaire mobilier (GAP-002) |
| SignatureSession | migrations | Signature électronique unifiée |

---

## 3. Incohérences Critiques des Types

### 3.1 `PaymentMethod` — 5 DÉFINITIONS CONFLICTUELLES

| Fichier | Ligne | Valeurs | Problème |
|---------|-------|---------|----------|
| `lib/types/index.ts` | 166 | `cb, virement, prelevement, especes, cheque, autre` | Source SOTA 2026 |
| `lib/types/invoicing.ts` | 32 | `card, transfer, check, cash, platform` | **CONFLIT** — anglais |
| `lib/types/intervention-flow.ts` | 63 | `card, sepa_debit, bank_transfer, direct` | **CONFLIT** — Stripe |
| `lib/types/end-of-lease.ts` | 59 | `virement, cheque, especes` | **COLLISION DE NOM** |
| `lib/types/copro-charges.ts` | 50 | `CoproPaymentMethod` (nommé) | OK (pas de collision) |

**Impact** : Import simultané impossible, risque de runtime mismatch.

### 3.2 `PropertyStatus` — 5 DÉFINITIONS CONFLICTUELLES

| Fichier | Ligne | Valeurs | Problème |
|---------|-------|---------|----------|
| `lib/types/index.ts` | 48 | `brouillon, en_attente, published, publie, rejete, rejected, archive, archived` | **DEPRECATED + DOUBLONS** |
| `lib/types/status.ts` | 17 | `draft, pending_review, published, rejected, archived` | Source SOTA 2026 |
| `lib/types/property-v3.ts` | 86 | `draft, pending_review, published, rejected, archived` | Aligné avec status.ts |
| `lib/owner/types.ts` | 7 | `loue, en_preavis, vacant, a_completer` | **COLLISION** — statut opérationnel |
| `components/properties/types.ts` | 23 | `vacant, loue, en_travaux, signature_en_cours` | **COLLISION** — valeurs différentes |

**Impact** : Confusion entre statut de workflow (`draft → published`) et statut opérationnel (`vacant → loue`). Les deux exportent le même nom `PropertyStatus`.

### 3.3 `LeaseStatus` — 5 DÉFINITIONS CONFLICTUELLES

| Fichier | Ligne | Valeurs | Problème |
|---------|-------|---------|----------|
| `lib/types/index.ts` | 149 | 11 valeurs (incl. `sent`, `pending_owner_signature`, `amended`) | Trop de valeurs |
| `lib/types/status.ts` | 40 | 8 valeurs | Source SOTA 2026 |
| `app/owner/_data/fetchLeaseDetails.ts` | 31 | 8 valeurs (incl. `cancelled`) | **CONFLIT** — `cancelled` inexistant en DB |
| `lib/owner/types.ts` | 8 | 4 valeurs | **TROP SIMPLIFIÉ** |
| `components/properties/types.ts` | 25 | 5 valeurs (incl. `expired`) | **CONFLIT** — `expired` non défini |

**Impact** : Les réponses API peuvent retourner des valeurs non couvertes par le type TS utilisé côté composant.

### 3.4 `InvoiceStatus` — 6 DÉFINITIONS CONFLICTUELLES

| Fichier | Ligne | Valeurs | Problème |
|---------|-------|---------|----------|
| `lib/types/index.ts` | 162 | `draft, sent, paid, late` | Simplifié |
| `lib/types/status.ts` | 57 | 7 valeurs (+`viewed, partial, cancelled`) | Source SOTA 2026 |
| `lib/types/invoicing.ts` | 13 | 9 valeurs (utilise `overdue` au lieu de `late`) | **CONFLIT** |
| `lib/owner/types.ts` | 9 | 4 valeurs | Identique à index.ts |
| `types/billing.ts` | 26 | `draft, open, paid, void, uncollectible` | **STRIPE** — totalement différent |
| `lib/design-system/tokens.ts` | 85 | 5 clés de style | Doit importer, pas redéfinir |

### 3.5 Incohérence de Nommage des Champs

```
// Français ("statut")
lease.statut: LeaseStatus
invoice.statut: InvoiceStatus

// Anglais ("status")
property.status: PropertyStatus (lib/owner)

// Français autre ("etat")
property.etat: PropertyStatusV3 (en DB + property-v3.ts)
```

Pas de convention unique sur le nommage des champs de statut.

---

## 4. Problèmes SQL et Intégrité de la Base

### 4.1 FK Récemment Corrigées

| Table | Colonne | Correction | Migration |
|-------|---------|------------|-----------|
| `edl` | `entity_id` | Ajout FK → `legal_entities(id)` | `20260207100000` |
| `documents` | `edl_id` | Ajout FK → `edl(id)` | `20260207100000` |
| `furniture_inventories` | `edl_id` | FK pointait vers table inexistante | `20260207100000` |
| `vetusty_reports` | `settlement_id` | FK pointait vers table inexistante | `20260207100000` |
| `copro_units` | `owner_profile_id` | Manquait `ON DELETE SET NULL` | `20260215200003` |
| `copro_units` | `property_id` | Manquait `ON DELETE SET NULL` | `20260215200003` |
| `sites` | `syndic_profile_id` | Manquait `ON DELETE SET NULL` | `20260215200003` |

### 4.2 Contraintes CHECK sur les Statuts (DB)

| Table | Valeurs CHECK | Cohérent avec TS ? |
|-------|--------------|---------------------|
| `leases.statut` | `draft, pending_signature, active, terminated` + `notice_given` (ajouté) | Partiel — TS a plus de valeurs |
| `invoices.statut` | `draft, sent, paid, late` | Partiel — status.ts a 7 valeurs |
| `tickets.statut` | `open, in_progress, resolved, closed` | OK |
| `lease_signers.signature_status` | `pending, signed, refused` | OK |
| `work_orders.statut` | `assigned, scheduled, done, cancelled` | OK |

**Problème** : Les CHECK constraints SQL ne couvrent pas toutes les valeurs définies en TS (ex: `partially_signed`, `fully_signed` pour les baux).

### 4.3 Enums SQL Créés

Types ENUM PostgreSQL créés dans les migrations :
- `export_status`, `furniture_category`, `furniture_condition`
- `signature_document_type`, `signature_session_status`, `signature_participant_status`
- `tax_regime_type`, `lmnp_status_type`
- `white_label_level`, `domain_verification_method`, `ssl_status`

### 4.4 Orphan Records

Le fichier `20260108500000_orphan_cleanup_sota2026.sql` nettoie :
- `lease_signers` sans bail
- `invoices` sans bail
- `documents` avec FK invalides
- `roommates` sans bail
- `edl` sans bail
- `deposit_movements`, `rent_calls`, `charge_regularizations` orphelins

Un framework d'audit complet existe dans `20260212000000_audit_database_integrity.sql` (1530 lignes) avec :
- `audit_orphan_records()` — 40+ tables vérifiées
- `audit_duplicate_records()` — doublons et violations de contraintes
- `audit_missing_fk_constraints()` — colonnes `*_id` sans FK formelle
- `safe_cleanup_orphans()` — nettoyage sécurisé avec archivage

---

## 5. Problèmes RLS

### 5.1 Historique des Corrections RLS (10+ migrations)

| Migration | Problème | Solution |
|-----------|----------|----------|
| `20260213100000` | Récursion RLS sur `profiles` | Fonction `get_my_profile_id()` SECURITY DEFINER |
| `20260216100000` | Politiques permissives `USING(true)` | Suppression des résidus sur `leases`, `notifications`, `professional_orders` |
| `20260215200002` | Accès tenant limité à `active` | Étendu aux états pre/post-active |
| `20260215200000` | Accès tenant aux propriétés avant bail actif | Correction du JOIN pattern |
| `20260215100000` | Audit de sécurité signatures | Restriction des accès |
| `20260207100000` | RLS `vetusty`/`furniture` | Correction du pattern JOIN → profiles |

### 5.2 Pattern de Résolution Adopté

```sql
-- AVANT (causait récursion) :
SELECT id FROM profiles WHERE user_id = auth.uid()

-- APRÈS (SECURITY DEFINER) :
CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT id FROM profiles WHERE user_id = auth.uid() $$;
```

---

## 6. Recommandations

### 6.1 CRITIQUE — Unification des Types (Priorité 1)

**Objectif** : Établir `lib/types/status.ts` comme source unique de vérité.

**Actions :**

1. **Renommer les types en collision** :
   ```typescript
   // end-of-lease.ts
   export type EndOfLeasePaymentMethod = "virement" | "cheque" | "especes";

   // invoicing.ts
   export type ProviderInvoicePaymentMethod = 'card' | 'transfer' | 'check' | 'cash' | 'platform';

   // intervention-flow.ts
   export type WorkOrderPaymentMethod = 'card' | 'sepa_debit' | 'bank_transfer' | 'direct';
   ```

2. **Distinguer statut de workflow et statut opérationnel** :
   ```typescript
   // status.ts
   export type PropertyWorkflowStatus = "draft" | "pending_review" | "published" | "rejected" | "archived";
   export type PropertyOperationalStatus = "vacant" | "loue" | "en_preavis" | "a_completer";
   ```

3. **Supprimer les doublons de `index.ts`** :
   - Retirer les valeurs dupliquées de `PropertyStatus` (`publie`/`published`, etc.)
   - Aligner `LeaseStatus` sur `status.ts` (retirer `sent`, `pending_owner_signature`, `amended`)
   - Re-exporter depuis `status.ts` :
     ```typescript
     export { PropertyStatus, LeaseStatus, InvoiceStatus } from './status';
     ```

4. **Mettre à jour les composants** :
   - `lib/owner/types.ts` → importer depuis `status.ts`
   - `components/properties/types.ts` → importer depuis `status.ts`
   - `app/owner/_data/fetchLeaseDetails.ts` → retirer `cancelled` si absent de la DB

### 6.2 HIGH — Cohérence DB/TS (Priorité 2)

1. **Aligner les CHECK constraints SQL** avec les types TS :
   - Ajouter `partially_signed`, `fully_signed`, `notice_given`, `archived` au CHECK de `leases.statut`
   - Ajouter `viewed`, `partial`, `cancelled` au CHECK de `invoices.statut`

2. **Convention de nommage unique** :
   - Décision : utiliser `status` (anglais) partout OU `statut` (français) partout
   - Recommandation : `status` (anglais) pour cohérence avec le code TS

3. **Ajouter les interfaces TS manquantes** pour :
   - `roommates`, `meter_readings`, `edl_items`, `payment_shares`, `deposit_shares`

### 6.3 MEDIUM — Améliorations Structurelles (Priorité 3)

1. **Documents** : Ajouter une contrainte `CHECK` pour garantir au moins un parent (`owner_id`, `tenant_id`, `property_id`, `lease_id`)

2. **Design-system** : `tokens.ts` doit importer les types de statut au lieu de les redéfinir en dur

3. **Performance RLS** : Continuer la migration vers le pattern `SECURITY DEFINER` pour toutes les tables

### 6.4 LOW — Dette Technique (Priorité 4)

1. Finaliser la dépréciation de `PropertyType`, `RoomType`, `PhotoTag` (V1) au profit des versions V3
2. Supprimer les types `@deprecated` de `index.ts` une fois toutes les références migrées
3. Ajouter des tests TS pour détecter les mismatches de types au build time

---

## Annexe : Fichiers Clés de Référence

| Fichier | Rôle |
|---------|------|
| `lib/types/status.ts` | **Source de vérité** des statuts (SOTA 2026) |
| `lib/types/index.ts` | Types core (à nettoyer) |
| `lib/types/property-v3.ts` | Modèle Property V3 |
| `lib/types/legal-entity.ts` | Structures juridiques |
| `lib/types/invoicing.ts` | Facturation prestataire |
| `lib/types/guarantor.ts` | Module garant |
| `lib/types/end-of-lease.ts` | Fin de bail |
| `lib/types/copro.ts` | Copropriété |
| `supabase/migrations/20260212000000_audit_database_integrity.sql` | Framework d'audit DB |
| `supabase/migrations/20260213100000_fix_rls_all_tables_recursion.sql` | Fix RLS récursion |
| `supabase/migrations/20260216100000_security_audit_rls_fixes.sql` | Audit sécurité RLS |
| `AUDIT_DATABASE_INTEGRITY.md` | Audit intégrité DB (2026-02-12) |
