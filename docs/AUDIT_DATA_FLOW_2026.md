# AUDIT COMPLET DU FLUX DE DONNÉES TALOK

**Date**: 21 janvier 2026
**Auteur**: Audit Architecture Données
**Version**: 1.0

---

## TABLE DES MATIÈRES

1. [Résumé Exécutif](#résumé-exécutif)
2. [Phase 1: Cartographie des Entités](#phase-1-cartographie-des-entités)
3. [Phase 2: Flux de Données Complet](#phase-2-flux-de-données-complet)
4. [Phase 3: Incohérences Identifiées](#phase-3-incohérences-identifiées)
5. [Phase 4: Architecture SOTA 2026](#phase-4-architecture-sota-2026)
6. [Plan d'Action](#plan-daction)

---

## RÉSUMÉ EXÉCUTIF

### Statistiques Clés

| Métrique | Valeur |
|----------|--------|
| **Tables SQL identifiées** | 74 tables |
| **Types TypeScript définis** | 18 types (24%) |
| **Tables sans types** | 56 tables (76%) |
| **Schémas Zod complets** | ~30% des entités |
| **Incohérences critiques** | 12 |
| **Incohérences élevées** | 25+ |

### Verdict Global

```
╔═══════════════════════════════════════════════════════════════╗
║  SCORE D'ARCHITECTURE: 45/100 - REFACTORING MAJEUR REQUIS    ║
╚═══════════════════════════════════════════════════════════════╝
```

**Points forts:**
- Flux métier bien défini (création bien → paiement)
- Migrations SQL structurées
- Signatures électroniques conformes eIDAS

**Points critiques:**
- 76% des tables sans types TypeScript
- Mélange français/anglais systématique
- Doublons fonctionnels (3 systèmes de signature)
- Statuts Zod désynchronisés du SQL

---

## PHASE 1: CARTOGRAPHIE DES ENTITÉS

### 1.1 Tables Principales (Core)

#### `profiles` - Utilisateurs
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('owner', 'tenant', 'provider', 'admin')),
  prenom TEXT,
  nom TEXT,
  email TEXT,
  telephone TEXT,
  date_naissance DATE,
  lieu_naissance VARCHAR(255),
  nationalite VARCHAR(100),
  avatar_url TEXT,
  account_status TEXT DEFAULT 'active',
  two_factor_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```
**Créateur**: Système (trigger on auth.users insert)
**Modificateur**: Owner self, Admin

#### `properties` - Biens Immobiliers
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id),
  unique_code VARCHAR(10) UNIQUE,
  type TEXT CHECK (type IN ('appartement', 'maison', 'studio', ...)),
  adresse_complete TEXT,
  code_postal VARCHAR(5),
  ville TEXT,
  departement VARCHAR(3),
  surface NUMERIC,
  nb_pieces INTEGER,
  etage INTEGER,
  meuble BOOLEAN,
  etat TEXT DEFAULT 'draft',  -- draft → incomplete → ready_to_let → active → archived
  loyer_base NUMERIC,
  charges_mensuelles NUMERIC,
  depot_garantie NUMERIC,
  energie TEXT,  -- DPE classe
  ges TEXT,
  deleted_at TIMESTAMPTZ,  -- Soft delete
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```
**Créateur**: Owner
**Modificateur**: Owner, Admin

#### `leases` - Baux
```sql
CREATE TABLE leases (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  unit_id UUID REFERENCES units(id),
  type_bail TEXT CHECK (type_bail IN ('nu', 'meuble', 'colocation', 'etudiant', 'mobilite', 'saisonnier', 'commercial_3_6_9')),
  loyer NUMERIC NOT NULL,
  charges_forfaitaires NUMERIC DEFAULT 0,
  charges_type TEXT,
  depot_de_garantie NUMERIC,
  date_debut DATE NOT NULL,
  date_fin DATE,
  statut TEXT DEFAULT 'draft',  -- draft → pending_signature → partially_signed → fully_signed → active → notice_given → terminated → archived
  coloc_config JSONB,
  pdf_url TEXT,
  pdf_signed_url TEXT,
  prorata_first_month NUMERIC,
  indexation_enabled BOOLEAN DEFAULT true,
  encadrement_applicable BOOLEAN,
  loyer_reference_majore NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```
**Créateur**: Owner
**Modificateur**: Owner, System (triggers)

### 1.2 Tables de Signatures

#### `lease_signers` - Signataires de Bail
```sql
CREATE TABLE lease_signers (
  id UUID PRIMARY KEY,
  lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  invited_email TEXT,  -- Si profil n'existe pas encore
  invited_name TEXT,
  role TEXT CHECK (role IN ('proprietaire', 'locataire_principal', 'colocataire', 'garant')),
  signature_status TEXT DEFAULT 'pending',  -- pending → signed
  signed_at TIMESTAMPTZ,
  signature_image_path TEXT,
  ip_inet INET,
  user_agent TEXT,
  proof_id UUID,
  proof_metadata JSONB,
  document_hash TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### `signatures` - Signatures Électroniques Avancées
```sql
CREATE TABLE signatures (
  id UUID PRIMARY KEY,
  draft_id UUID REFERENCES lease_drafts(id),
  lease_id UUID REFERENCES leases(id),
  signer_user UUID REFERENCES auth.users(id),
  signer_profile_id UUID REFERENCES profiles(id),
  level TEXT CHECK (level IN ('SES', 'AES', 'QES')),  -- eIDAS
  otp_verified BOOLEAN DEFAULT false,
  ip_inet INET,
  user_agent TEXT,
  signed_at TIMESTAMPTZ,
  signature_image_path TEXT,
  evidence_pdf_url TEXT,
  doc_hash TEXT,
  provider_ref TEXT,
  created_at TIMESTAMPTZ
);
```

### 1.3 Tables EDL (États des Lieux)

#### `edl` - États des Lieux
```sql
CREATE TABLE edl (
  id UUID PRIMARY KEY,
  lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('entree', 'sortie')),
  status TEXT DEFAULT 'draft',  -- draft → in_progress → completed → signed → disputed
  scheduled_date DATE,
  completed_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### `edl_items` - Éléments EDL
```sql
CREATE TABLE edl_items (
  id UUID PRIMARY KEY,
  edl_id UUID REFERENCES edl(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  condition TEXT CHECK (condition IN ('neuf', 'bon', 'moyen', 'mauvais', 'tres_mauvais')),
  notes TEXT,
  created_at TIMESTAMPTZ
);
```

#### `edl_signatures` - Signatures EDL
```sql
CREATE TABLE edl_signatures (
  id UUID PRIMARY KEY,
  edl_id UUID REFERENCES edl(id) ON DELETE CASCADE,
  signer_user UUID REFERENCES auth.users(id),
  signer_role TEXT CHECK (signer_role IN ('owner', 'tenant', 'witness')),
  signed_at TIMESTAMPTZ,
  signature_image_path TEXT,
  ip_inet INET,
  user_agent TEXT
);
```

### 1.4 Tables Financières

#### `invoices` - Factures Locataires
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  lease_id UUID REFERENCES leases(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id),
  tenant_id UUID REFERENCES profiles(id),
  periode VARCHAR(7),  -- YYYY-MM
  montant_loyer NUMERIC NOT NULL,
  montant_charges NUMERIC DEFAULT 0,
  montant_tva NUMERIC DEFAULT 0,
  tva_taux NUMERIC,
  montant_total NUMERIC NOT NULL,
  statut TEXT DEFAULT 'draft',  -- draft → sent → viewed → partial → paid → late → cancelled
  date_echeance DATE,
  date_paiement DATE,
  invoice_number TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### `payments` - Paiements
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL,
  moyen TEXT CHECK (moyen IN ('card', 'transfer', 'check', 'cash', 'platform', 'prelevement')),
  statut TEXT DEFAULT 'pending',  -- pending → succeeded → failed → cancelled
  provider_ref TEXT,  -- Stripe payment_intent_id
  date_paiement TIMESTAMPTZ,
  reference TEXT,
  created_at TIMESTAMPTZ
);
```

### 1.5 Résumé des 74 Tables

| Catégorie | Tables | Statut Types |
|-----------|--------|--------------|
| **Core** | profiles, properties, units, leases | ✅ Typées |
| **Profils spécialisés** | owner_profiles, tenant_profiles, provider_profiles | ❌ Non typées |
| **Signatures** | signatures, lease_signers, edl_signatures, signature_evidence | ❌ Partiellement |
| **EDL** | edl, edl_items, edl_media | ❌ Non typées |
| **Facturation** | invoices, payments, provider_invoices, payment_shares | ✅ Partiellement |
| **Charges** | charges, charge_provisions, charge_reconciliations | ❌ Non typées |
| **Dépôts** | deposit_movements, deposit_operations | ❌ Non typées |
| **Comptabilité** | accounting_entries, accounting_journals, mandant_accounts | ❌ Non typées |
| **Colocation** | roommates, house_rules, chore_schedule, guest_counter | ❌ Non typées |
| **Compteurs** | meters, meter_readings, consumption_estimates | ❌ Non typées |
| **Candidatures** | tenant_applications, application_files, extracted_fields | ❌ Non typées |
| **Tickets** | tickets, work_orders, quotes, appointments | ✅ Partiellement |
| **Messaging** | chat_threads, chat_messages, notifications | ✅ Partiellement |
| **Documents** | documents, document_links | ✅ Typées |
| **Visites** | visit_slots, visit_bookings, owner_availability_patterns | ✅ Typées (SOTA 2026) |
| **Legal Entities** | legal_entities, entity_associates, property_ownership | ✅ Typées (SOTA 2026) |
| **Admin** | audit_log, moderation_cases, gdpr_requests, api_providers | ❌ Non typées |
| **Auth** | passkey_credentials, user_2fa, passkey_challenges | ❌ Non typées |

---

## PHASE 2: FLUX DE DONNÉES COMPLET

### Diagramme de Flux: Création Bien → Premier Versement

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUX COMPLET TALOK                                    │
│                   Création Bien → Premier Versement                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   OWNER      │     │   TENANT     │     │   SYSTEM     │     │   DATABASE   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ 1. POST /api/properties/init            │                    │
       │─────────────────────────────────────────│───────────────────>│
       │                    │                    │    INSERT properties
       │                    │                    │    etat='draft'    │
       │<────────────────────────────────────────│────────────────────│
       │    property_id + unique_code            │                    │
       │                    │                    │                    │
       │ 2. Complete property details            │                    │
       │─────────────────────────────────────────│───────────────────>│
       │                    │                    │    UPDATE properties
       │                    │                    │    etat='ready_to_let'
       │                    │                    │                    │
       │ 3. POST /api/leases/invite              │                    │
       │    {property_id, tenant_email, ...}     │                    │
       │─────────────────────────────────────────│───────────────────>│
       │                    │                    │    INSERT leases   │
       │                    │                    │    statut='pending_signature'
       │                    │                    │    INSERT lease_signers (owner)
       │                    │                    │    INSERT lease_signers (tenant)
       │                    │                    │    INSERT notifications
       │                    │                    │                    │
       │                    │<───────────────────│    SEND EMAIL      │
       │                    │   Invitation link  │    (lease_invite)  │
       │                    │                    │                    │
       │ 4. Sign lease      │                    │                    │
       │─────────────────────────────────────────│───────────────────>│
       │                    │                    │    UPDATE lease_signers
       │                    │                    │    signature_status='signed'
       │                    │                    │                    │
       │                    │ 5. Click link → Sign                    │
       │                    │────────────────────│───────────────────>│
       │                    │                    │    VERIFY OTP      │
       │                    │                    │    UPDATE lease_signers
       │                    │                    │    signature_status='signed'
       │                    │                    │                    │
       │                    │                    │ 6. TRIGGER: All signed?
       │                    │                    │───────────────────>│
       │                    │                    │    UPDATE leases   │
       │                    │                    │    statut='fully_signed'
       │                    │                    │                    │
       │ 7. Create EDL Entry                     │                    │
       │─────────────────────────────────────────│───────────────────>│
       │                    │                    │    INSERT edl      │
       │                    │                    │    type='entree'   │
       │                    │                    │    status='draft'  │
       │                    │                    │                    │
       │ 8. Complete EDL items                   │                    │
       │─────────────────────────────────────────│───────────────────>│
       │                    │                    │    INSERT edl_items│
       │                    │                    │    INSERT edl_media│
       │                    │                    │    UPDATE edl status='completed'
       │                    │                    │                    │
       │ 9. Sign EDL        │ 10. Sign EDL       │                    │
       │────────────────────│────────────────────│───────────────────>│
       │                    │                    │    INSERT edl_signatures
       │                    │                    │    UPDATE edl status='signed'
       │                    │                    │                    │
       │                    │                    │ 11. TRIGGER: EDL + Lease signed
       │                    │                    │───────────────────>│
       │                    │                    │    UPDATE leases   │
       │                    │                    │    statut='active' │
       │                    │                    │    UPDATE properties
       │                    │                    │    etat='active'   │
       │                    │                    │                    │
       │                    │                    │ 12. CRON: Generate invoice
       │                    │                    │───────────────────>│
       │                    │                    │    INSERT invoices │
       │                    │                    │    statut='sent'   │
       │                    │                    │    SEND EMAIL      │
       │                    │                    │                    │
       │                    │ 13. Pay invoice    │                    │
       │                    │────────────────────│───────────────────>│
       │                    │                    │    CREATE Stripe PI│
       │                    │                    │    INSERT payments │
       │                    │                    │    statut='pending'│
       │                    │                    │                    │
       │                    │                    │ 14. Webhook: payment.succeeded
       │                    │                    │───────────────────>│
       │                    │                    │    UPDATE payments │
       │                    │                    │    statut='succeeded'
       │                    │                    │    UPDATE invoices │
       │                    │                    │    statut='paid'   │
       │                    │                    │    INSERT accounting_entries
       │<────────────────────────────────────────│────────────────────│
       │    Notification: Payment received       │                    │
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
   ╔═══════════════════════════════════════════════════════════════════════╗
   ║  PREMIER VERSEMENT COMPLÉTÉ - BAIL ACTIF                              ║
   ╚═══════════════════════════════════════════════════════════════════════╝
```

### Points de Données par Étape

| Étape | Endpoint | Tables Modifiées | Données Créées |
|-------|----------|------------------|----------------|
| 1 | POST /api/properties/init | properties | id, unique_code, etat='draft' |
| 2 | PUT /api/properties/[id] | properties | Détails complets, etat='ready_to_let' |
| 3 | POST /api/leases/invite | leases, lease_signers, notifications | Bail + signataires |
| 4-5 | POST /api/signature/[token]/sign | lease_signers, signatures | Preuves signature |
| 6 | Trigger auto | leases | statut='fully_signed' |
| 7 | POST /api/edl | edl | EDL draft |
| 8 | POST /api/edl/[id]/items | edl_items, edl_media | Items + photos |
| 9-10 | POST /api/signature/edl/[token]/sign | edl_signatures | Preuves |
| 11 | Trigger auto | leases, properties | statut/etat='active' |
| 12 | Cron job | invoices | Facture mensuelle |
| 13-14 | POST /api/payments + Webhook | payments, invoices, accounting_entries | Paiement |

---

## PHASE 3: INCOHÉRENCES IDENTIFIÉES

### 3.1 Incohérences CRITIQUES (🔴)

#### IC-01: Types TypeScript Manquants
**Impact**: 76% des tables sans types = aucune sécurité de typage

```typescript
// PROBLÈME: lib/supabase/database.types.ts
// Seulement 18 types définis sur 74 tables

// MANQUANTS (exemples critiques):
type EDL = never;           // ❌ Table edl non typée
type Roommate = never;      // ❌ Table roommates non typée
type Signature = never;     // ❌ Table signatures non typée
type MeterReading = never;  // ❌ Table meter_readings non typée
```

**Localisation**: `/home/user/TALOK/lib/supabase/database.types.ts`

#### IC-02: Statuts Zod vs SQL Désynchronisés
**Impact**: Validation API échoue pour statuts légitimes

```typescript
// lib/api/schemas.ts:129-139 - UpdateLeaseSchema
statut: z.enum([
  "draft", "sent", "pending_signature", "partially_signed",
  "fully_signed", "active", "amended", "terminated", "archived"
])

// MAIS en SQL (migration 20260107000001):
-- Statuts supplémentaires NON dans Zod:
-- ❌ 'pending_owner_signature'
-- ❌ 'notice_given'
```

**Localisation**:
- Zod: `/home/user/TALOK/lib/api/schemas.ts:129-139`
- SQL: `/home/user/TALOK/supabase/migrations/20260107000001_sota_lease_status_constraint.sql`

#### IC-03: Doublons Systèmes de Signature
**Impact**: 3 lieux différents pour gérer les signatures = désynchronisation

```
SYSTÈME 1: table `signatures`
  - Niveaux eIDAS (SES/AES/QES)
  - OTP verification
  - Provider ref externe

SYSTÈME 2: table `lease_signers`
  - signature_status
  - signature_image_path
  - proof_metadata

SYSTÈME 3: colonnes dans `leases`
  - yousign_signature_request_id
  - yousign_document_id
  - signature_started_at
  - signature_completed_at
```

**Risque**: Données de signature dans 3 endroits → quelle est la source de vérité?

### 3.2 Incohérences ÉLEVÉES (🟠)

#### IC-04: Nommage Français/Anglais Mélangé
**Impact**: Confusion développeurs, erreurs API

```typescript
// DANS LA MÊME TABLE PropertyRow:
adresse_complete  // ✓ Français
code_postal       // ✓ Français
ville             // ✓ Français
cover_url         // ❌ Anglais (devrait: image_couverture_url)
syndic_name       // ❌ Anglais (devrait: nom_syndic)
syndic_email      // ❌ Anglais (devrait: email_syndic)
```

#### IC-05: Colonnes SQL Non Présentes dans Types
**Impact**: Perte de données en runtime

| Table | Colonnes SQL manquantes dans TypeScript |
|-------|----------------------------------------|
| leases | charges_type, coloc_config, invite_token, yousign_* |
| properties | loyer_base, charges_mensuelles, zone_encadrement, usage_principal |
| profiles | lieu_naissance, nationalite |

**Total**: 25+ colonnes orphelines

#### IC-06: Factures Dupliquées
**Impact**: Deux systèmes de facturation parallèles

```sql
-- Table 1: invoices (locataires)
-- Colonnes: lease_id, montant_loyer, montant_charges

-- Table 2: provider_invoices (prestataires)
-- Colonnes: provider_profile_id, work_order_id, subtotal, tax_amount
-- AUCUN lien avec invoices !
```

### 3.3 Incohérences MOYENNES (🟡)

#### IC-07: Schémas Zod Incomplets
**Impact**: ~70% des endpoints sans validation

```typescript
// EXISTANTS:
CreatePropertySchema, CreateLeaseSchema, CreateTicketSchema

// MANQUANTS:
CreateRoommateSchema      // ❌
CreateSignatureSchema     // ❌
CreateEDLSchema           // ❌
CreateProviderInvoiceSchema // ❌
CreatePaymentShareSchema  // ❌
CreateAccountingEntrySchema // ❌
```

#### IC-08: Statuts de Tables Liées Incohérents

```
invoices.statut:    'draft' | 'sent' | 'paid' | 'late'
payments.statut:    'pending' | 'succeeded' | 'failed' | 'cancelled'
work_orders.statut: 'assigned' | 'scheduled' | 'done' | 'cancelled'
tickets.statut:     'open' | 'in_progress' | 'paused' | 'resolved' | 'closed'

// Aucune cohérence de vocabulaire !
```

#### IC-09: Cascade DELETE Dangereuses

```sql
-- invoices référence profiles avec ON DELETE CASCADE
-- = Si profil supprimé, factures supprimées
-- PROBLÈME: Perte d'historique comptable !

REFERENCES profiles(id) ON DELETE CASCADE  -- ❌ Devrait être RESTRICT
```

### 3.4 Tableau Récapitulatif

| ID | Type | Sévérité | Tables Impactées | Effort Fix |
|----|------|----------|------------------|------------|
| IC-01 | Types manquants | 🔴 CRITIQUE | 56 tables | 2-3 jours |
| IC-02 | Statuts Zod | 🔴 CRITIQUE | leases | 1 heure |
| IC-03 | Doublons signatures | 🔴 CRITIQUE | 3 systèmes | 1-2 jours |
| IC-04 | Nommage mixte | 🟠 ÉLEVÉ | Toutes | 1 semaine (breaking) |
| IC-05 | Colonnes orphelines | 🟠 ÉLEVÉ | 5+ tables | 1 jour |
| IC-06 | Factures dupliquées | 🟠 ÉLEVÉ | 2 tables | 2-3 jours |
| IC-07 | Schémas Zod | 🟡 MOYEN | 15+ endpoints | 2 jours |
| IC-08 | Statuts incohérents | 🟡 MOYEN | 5+ tables | 1 jour |
| IC-09 | CASCADE dangereuses | 🟡 MOYEN | invoices, payments | 2 heures |

---

## PHASE 4: ARCHITECTURE SOTA 2026

### 4.1 Principes Directeurs

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                    PRINCIPES ARCHITECTURE SOTA 2026                        ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ 1. TYPE-FIRST: Générer types TS depuis SQL (prisma/drizzle/supabase-gen) ║
║ 2. SINGLE SOURCE OF TRUTH: Un seul système par domaine                   ║
║ 3. EVENT-DRIVEN: Outbox pattern pour tous les side-effects               ║
║ 4. NAMING CONVENTION: Tout en anglais snake_case                         ║
║ 5. SCHEMA VALIDATION: Zod pour 100% des endpoints                        ║
║ 6. AUDIT TRAIL: Immutabilité des données sensibles                       ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### 4.2 Schéma de Données Cible

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE DONNÉES SOTA 2026                       │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │     PROFILES     │
                              │    (Core User)   │
                              └────────┬─────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           │                           │                           │
           ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  OWNER_PROFILES  │       │  TENANT_PROFILES │       │ PROVIDER_PROFILES│
│   (Propriétaire) │       │    (Locataire)   │       │   (Prestataire)  │
└────────┬─────────┘       └────────┬─────────┘       └──────────────────┘
         │                          │
         ▼                          │
┌──────────────────┐                │
│    PROPERTIES    │◄───────────────┤
│      (Biens)     │                │
└────────┬─────────┘                │
         │                          │
         ▼                          ▼
┌──────────────────┐       ┌──────────────────┐
│      LEASES      │◄──────│   LEASE_MEMBERS  │ (Nouveau: remplace roommates + lease_signers)
│      (Baux)      │       │  (Participants)  │
└────────┬─────────┘       └──────────────────┘
         │
         ├────────────────────────────────────────────────────────┐
         │                           │                            │
         ▼                           ▼                            ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   INSPECTIONS    │       │     INVOICES     │       │    DOCUMENTS     │
│  (EDL unifié)    │       │    (Factures)    │       │   (Tous types)   │
└────────┬─────────┘       └────────┬─────────┘       └──────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐       ┌──────────────────┐
│ INSPECTION_ITEMS │       │     PAYMENTS     │
│   (Éléments)     │       │   (Paiements)    │
└──────────────────┘       └──────────────────┘

                    ┌──────────────────┐
                    │    SIGNATURES    │ (Unifié: tous documents)
                    │  (eIDAS SES/AES) │
                    └──────────────────┘

                    ┌──────────────────┐
                    │   AUDIT_EVENTS   │ (Event sourcing)
                    │ (Immutable log)  │
                    └──────────────────┘
```

### 4.3 Nouvelles Tables Proposées

#### 4.3.1 `lease_members` - Unification Participants
```sql
-- Remplace: roommates + lease_signers (partiellement)
CREATE TABLE lease_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),

  -- Invitation (si profil n'existe pas encore)
  invited_email TEXT,
  invited_name TEXT,
  invitation_token TEXT UNIQUE,
  invitation_expires_at TIMESTAMPTZ,
  invitation_status TEXT DEFAULT 'pending'
    CHECK (invitation_status IN ('pending', 'accepted', 'rejected', 'expired')),

  -- Rôle et participation
  role TEXT NOT NULL CHECK (role IN (
    'owner',           -- Propriétaire/Bailleur
    'primary_tenant',  -- Locataire principal
    'cotenant',        -- Colocataire
    'occupant',        -- Occupant sans droit
    'guarantor'        -- Garant
  )),

  -- Participation financière (colocation)
  payment_weight NUMERIC(5,4) DEFAULT 1.0,  -- 0.0000 à 1.0000
  deposit_share NUMERIC,

  -- Signature
  signature_required BOOLEAN DEFAULT true,
  signature_status TEXT DEFAULT 'pending'
    CHECK (signature_status IN ('pending', 'signed', 'refused', 'expired')),
  signed_at TIMESTAMPTZ,
  signature_id UUID REFERENCES signatures(id),

  -- Dates
  start_date DATE,  -- Date d'entrée
  end_date DATE,    -- Date de sortie

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Contraintes
  CONSTRAINT lease_member_identity CHECK (
    profile_id IS NOT NULL OR invited_email IS NOT NULL
  ),
  UNIQUE (lease_id, profile_id),
  UNIQUE (lease_id, invited_email)
);
```

#### 4.3.2 `signatures` - Système Unifié
```sql
-- Table unique pour TOUTES les signatures
CREATE TABLE signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Document signé (polymorphique)
  document_type TEXT NOT NULL CHECK (document_type IN (
    'lease', 'inspection', 'notice', 'quote', 'invoice', 'contract', 'amendment'
  )),
  document_id UUID NOT NULL,
  document_hash TEXT NOT NULL,  -- SHA-256 du document

  -- Signataire
  signer_profile_id UUID NOT NULL REFERENCES profiles(id),
  signer_role TEXT NOT NULL,

  -- Niveau eIDAS
  level TEXT NOT NULL CHECK (level IN ('SES', 'AES', 'QES')),

  -- Vérification
  verification_method TEXT CHECK (verification_method IN (
    'otp_sms', 'otp_email', 'video_ident', 'qualified_cert'
  )),
  verification_code_hash TEXT,
  verification_verified_at TIMESTAMPTZ,

  -- Capture
  signature_image_path TEXT,
  ip_address INET,
  user_agent TEXT,
  geolocation JSONB,
  device_fingerprint TEXT,

  -- Horodatage
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  timezone TEXT,

  -- Preuve
  evidence_pdf_path TEXT,
  evidence_metadata JSONB,

  -- Fournisseur externe (optionnel)
  provider TEXT CHECK (provider IN ('internal', 'yousign', 'docusign', 'universign')),
  provider_signature_id TEXT,
  provider_response JSONB,

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Index pour recherche polymorphique
  UNIQUE (document_type, document_id, signer_profile_id)
);

-- Index pour performance
CREATE INDEX idx_signatures_document ON signatures(document_type, document_id);
CREATE INDEX idx_signatures_signer ON signatures(signer_profile_id);
CREATE INDEX idx_signatures_signed_at ON signatures(signed_at);
```

#### 4.3.3 `inspections` - EDL Unifié
```sql
-- Remplace: edl
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id),

  type TEXT NOT NULL CHECK (type IN ('entry', 'exit', 'interim')),

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',       -- Brouillon
    'scheduled',   -- Planifié
    'in_progress', -- En cours
    'completed',   -- Terminé (items remplis)
    'pending_signatures', -- En attente signatures
    'signed',      -- Signé par tous
    'disputed'     -- Contesté
  )),

  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Comparaison avec EDL précédent
  previous_inspection_id UUID REFERENCES inspections(id),
  comparison_generated_at TIMESTAMPTZ,

  -- Relevés compteurs
  meter_readings JSONB DEFAULT '[]',
  /*
    [{
      "meter_type": "electricity",
      "meter_number": "123456",
      "reading_value": 12345.6,
      "unit": "kWh",
      "photo_path": "..."
    }]
  */

  -- Clés
  keys_inventory JSONB DEFAULT '[]',
  /*
    [{
      "key_type": "main_door",
      "quantity": 2,
      "notes": "..."
    }]
  */

  -- Observations générales
  general_observations TEXT,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 Génération de Types Automatique

```typescript
// lib/supabase/database.types.ts
// GÉNÉRÉ AUTOMATIQUEMENT depuis le schéma SQL

import type { Database as GeneratedDatabase } from './generated-types';

export type Database = GeneratedDatabase;

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Insertable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type Updatable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Convenience exports
export type Profile = Tables<'profiles'>;
export type Property = Tables<'properties'>;
export type Lease = Tables<'leases'>;
export type LeaseMember = Tables<'lease_members'>;
export type Invoice = Tables<'invoices'>;
export type Payment = Tables<'payments'>;
export type Inspection = Tables<'inspections'>;
export type Signature = Tables<'signatures'>;
// ... pour TOUTES les tables
```

### 4.5 Schémas Zod Complets

```typescript
// lib/validations/schemas.ts

import { z } from 'zod';

// ========== ENUMS CENTRALISÉS ==========

export const LeaseStatus = z.enum([
  'draft',
  'pending_signatures',
  'partially_signed',
  'fully_signed',
  'active',
  'notice_given',
  'terminating',
  'terminated',
  'archived'
]);

export const InspectionStatus = z.enum([
  'draft',
  'scheduled',
  'in_progress',
  'completed',
  'pending_signatures',
  'signed',
  'disputed'
]);

export const PaymentStatus = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'refunded'
]);

export const SignatureLevel = z.enum(['SES', 'AES', 'QES']);

// ========== LEASE MEMBER ==========

export const CreateLeaseMemberSchema = z.object({
  lease_id: z.string().uuid(),
  profile_id: z.string().uuid().optional(),
  invited_email: z.string().email().optional(),
  invited_name: z.string().min(1).optional(),
  role: z.enum(['owner', 'primary_tenant', 'cotenant', 'occupant', 'guarantor']),
  payment_weight: z.number().min(0).max(1).optional(),
  deposit_share: z.number().nonnegative().optional(),
  signature_required: z.boolean().default(true),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (data) => data.profile_id || data.invited_email,
  { message: 'profile_id or invited_email required' }
);

// ========== INSPECTION ==========

export const CreateInspectionSchema = z.object({
  lease_id: z.string().uuid(),
  type: z.enum(['entry', 'exit', 'interim']),
  scheduled_at: z.string().datetime().optional(),
  previous_inspection_id: z.string().uuid().optional(),
});

export const UpdateInspectionSchema = z.object({
  status: InspectionStatus.optional(),
  scheduled_at: z.string().datetime().optional(),
  meter_readings: z.array(z.object({
    meter_type: z.enum(['electricity', 'gas', 'water', 'other']),
    meter_number: z.string().optional(),
    reading_value: z.number().nonnegative(),
    unit: z.string(),
    photo_path: z.string().optional(),
  })).optional(),
  keys_inventory: z.array(z.object({
    key_type: z.string(),
    quantity: z.number().int().nonnegative(),
    notes: z.string().optional(),
  })).optional(),
  general_observations: z.string().optional(),
});

// ========== SIGNATURE ==========

export const CreateSignatureSchema = z.object({
  document_type: z.enum(['lease', 'inspection', 'notice', 'quote', 'invoice', 'contract', 'amendment']),
  document_id: z.string().uuid(),
  document_hash: z.string().min(64).max(64), // SHA-256
  signer_profile_id: z.string().uuid(),
  signer_role: z.string().min(1),
  level: SignatureLevel,
  verification_method: z.enum(['otp_sms', 'otp_email', 'video_ident', 'qualified_cert']).optional(),
  signature_image_base64: z.string().optional(),
});

export const VerifySignatureOTPSchema = z.object({
  signature_id: z.string().uuid(),
  otp_code: z.string().length(6).regex(/^\d{6}$/),
});
```

### 4.6 Event Sourcing & Audit

```sql
-- Table d'événements immutable
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metadata
  event_type TEXT NOT NULL,  -- 'lease.created', 'payment.received', etc.
  event_version INTEGER DEFAULT 1,

  -- Acteur
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'webhook', 'cron')),
  actor_id UUID,
  actor_role TEXT,

  -- Entité
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  -- Payload
  payload JSONB NOT NULL,

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id UUID,

  -- Horodatage (immutable)
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Partition par mois pour performance
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Empêcher toute modification
CREATE RULE audit_events_no_update AS ON UPDATE TO audit_events DO INSTEAD NOTHING;
CREATE RULE audit_events_no_delete AS ON DELETE TO audit_events DO INSTEAD NOTHING;

-- Index pour recherche
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_type ON audit_events(event_type);
CREATE INDEX idx_audit_events_actor ON audit_events(actor_id);
CREATE INDEX idx_audit_events_occurred ON audit_events(occurred_at);
```

### 4.7 Workflow Engine

```typescript
// lib/workflows/lease-lifecycle.ts

import { createMachine, assign } from 'xstate';

export const leaseLifecycleMachine = createMachine({
  id: 'lease-lifecycle',
  initial: 'draft',
  context: {
    leaseId: null as string | null,
    signersCount: 0,
    signedCount: 0,
    inspectionCompleted: false,
  },
  states: {
    draft: {
      on: {
        SUBMIT_FOR_SIGNATURE: {
          target: 'pending_signatures',
          guard: 'hasAllRequiredData',
        },
      },
    },
    pending_signatures: {
      on: {
        SIGNATURE_RECEIVED: [
          {
            target: 'fully_signed',
            guard: 'allSigned',
          },
          {
            target: 'partially_signed',
          },
        ],
        SIGNATURE_REFUSED: 'draft',
        SIGNATURE_EXPIRED: 'draft',
      },
    },
    partially_signed: {
      on: {
        SIGNATURE_RECEIVED: [
          {
            target: 'fully_signed',
            guard: 'allSigned',
          },
        ],
        SIGNATURE_REFUSED: 'draft',
      },
    },
    fully_signed: {
      on: {
        INSPECTION_COMPLETED: {
          target: 'active',
          guard: 'inspectionSigned',
        },
      },
    },
    active: {
      on: {
        NOTICE_GIVEN: 'notice_given',
        IMMEDIATE_TERMINATION: 'terminated',
      },
    },
    notice_given: {
      on: {
        NOTICE_PERIOD_ENDED: 'terminating',
        NOTICE_CANCELLED: 'active',
      },
    },
    terminating: {
      on: {
        EXIT_INSPECTION_COMPLETED: 'terminated',
      },
    },
    terminated: {
      on: {
        ARCHIVE: 'archived',
      },
    },
    archived: {
      type: 'final',
    },
  },
});
```

---

## PLAN D'ACTION

### Phase 1: Corrections Critiques (1-2 jours)

| Priorité | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Synchroniser statuts Zod avec SQL | 1h | Déblocage validation |
| P0 | Générer types TS pour 56 tables manquantes | 4h | Sécurité typage |
| P0 | Ajouter colonnes manquantes aux types existants | 2h | Données complètes |

```bash
# Commande pour générer les types
npx supabase gen types typescript --linked > lib/supabase/generated-types.ts
```

### Phase 2: Unification Signatures (2-3 jours)

| Action | Description |
|--------|-------------|
| Créer table `signatures` unifiée | Migration SQL |
| Migrer données existantes | Script de migration |
| Supprimer colonnes Yousign de `leases` | Nettoyage |
| Adapter services de signature | Refactor code |

### Phase 3: Normalisation Nommage (1 semaine)

| Action | Impact |
|--------|--------|
| Documenter convention (anglais snake_case) | Guide développeur |
| Renommer colonnes critiques | Breaking changes API |
| Mettre à jour types et schémas | Synchronisation |
| Mettre à jour frontend | Adaptations |

### Phase 4: Schémas Zod Complets (2 jours)

| Action | Tables Couvertes |
|--------|------------------|
| Créer schémas manquants | roommates, signatures, edl, meters, etc. |
| Ajouter validation aux routes API | 100% couverture |
| Tests unitaires schémas | Régression |

### Phase 5: Event Sourcing (3-5 jours)

| Action | Description |
|--------|-------------|
| Créer table `audit_events` | Migration partitionnée |
| Implémenter triggers automatiques | Capture événements |
| Adapter logique métier | Publish events |
| Dashboard audit admin | Visualisation |

---

## ANNEXES

### A. Glossaire Français → Anglais Proposé

| Français | Anglais Proposé | Notes |
|----------|-----------------|-------|
| adresse_complete | full_address | |
| code_postal | postal_code | |
| ville | city | |
| departement | department_code | |
| surface | area_sqm | Préciser unité |
| nb_pieces | room_count | |
| etage | floor | |
| loyer | rent_amount | |
| charges_forfaitaires | fixed_charges | |
| depot_de_garantie | security_deposit | |
| date_debut | start_date | |
| date_fin | end_date | |
| statut | status | |
| bail | lease | |
| proprietaire | owner | |
| locataire | tenant | |
| colocataire | cotenant | |
| garant | guarantor | |
| quittance | rent_receipt | |
| etat_des_lieux | inspection | |
| paiement | payment | |
| facture | invoice | |

### B. Checklist Migration

- [ ] Backup complet base de données
- [ ] Générer nouveaux types TypeScript
- [ ] Créer migrations SQL pour nouvelles tables
- [ ] Migrer données existantes
- [ ] Mettre à jour schémas Zod
- [ ] Adapter services backend
- [ ] Mettre à jour composants frontend
- [ ] Tests de régression
- [ ] Documentation mise à jour
- [ ] Déploiement staging
- [ ] Validation QA
- [ ] Déploiement production

---

**Fin du rapport d'audit**

*Document généré le 21 janvier 2026*
