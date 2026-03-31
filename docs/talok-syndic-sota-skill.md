---
name: talok-syndic-sota
description: >
  Architecture SOTA complète du module Syndic Talok — gestion de copropriété française.
  Utilise ce skill pour TOUT travail sur le syndic : tables, API, UI, AG, comptabilité SRU,
  appels de fonds, travaux, extranet copropriétaire, mutations, conformité réglementaire.
  Déclenche dès que la tâche touche à syndic, copropriété, copropriétaire, AG, assemblée
  générale, tantièmes, appel de fonds, fonds travaux, SRU, résolution, majorité, lot,
  clé de répartition, extranet, quote-part, charges, budget prévisionnel, PPT, DPE collectif.
---

# Talok — Module Syndic SOTA 2026

## 1. Vue d'ensemble

**Positionnement :** Module B2B séparé — le syndic paie, les copropriétaires accèdent gratuitement.
**Objectif ARR :** 500K€ sur 1M€ total Talok.
**Cibles :** Cabinets syndic DROM-COM en priorité, puis métropole.
**Différenciateurs :** DROM-COM natif, TVA multi-territoire, IA OCR, signature interne Talok.

### Pricing syndic

| Plan | Prix HT/copro/mois | Seuil | Features |
|------|--------------------:|------:|----------|
| Starter | 39€ | 1-4 copros | Gestion de base, AG, appels, extranet |
| Pro | 35€ (-10%) | 5-14 copros | + Comptabilité SRU, travaux, mutations |
| Cabinet | 29€ (-20%) | 15+ copros | + Multi-cabinet, API, white-label, IA |

**Add-ons :** État daté 10€/document · Signatures électroniques · Stockage supplémentaire.
**Copropriétaires = accès extranet GRATUIT** (jamais facturés).

### Feature gate actuel

Fichier : `app/owner/copro/CoproGate.tsx`
```tsx
<PlanGate feature="copro_module" mode="blur">
```
Actuellement restreint à Enterprise L+ (499€/mois). À migrer vers plans syndic dédiés.

---

## 2. État d'implémentation (30 mars 2026)

### Score global : ~35%

| Domaine | Score | Détail |
|---------|------:|--------|
| Base de données | 40% | 7/19 tables créées |
| API Routes | 25% | 12/80+ routes |
| UI Syndic | 35% | 31 pages, beaucoup de placeholders |
| UI Copro (extranet) | 25% | 17 pages basiques |
| Conformité réglementaire | 15% | Types OK, logique métier absente |
| Stripe syndic | 0% | Aucune intégration metered billing |
| Comptabilité SRU | 5% | Types charges définis, pas de plan comptable |

### Tables existantes (7) ✅

| Table | Colonnes clés | Fichier type |
|-------|--------------|-------------|
| `sites` | id, name, type, syndic_profile_id, total_tantiemes_general/eau/chauffage/ascenseur, fiscal_year_start_month, iban, siret | `lib/types/copro.ts` |
| `buildings` | id, site_id, building_type, floors_count, has_elevator, heating_type, water_type | `lib/types/copro.ts` |
| `copro_units` | id, site_id, building_id, lot_number, unit_type, tantieme_general/eau/chauffage/ascenseur, occupation_mode, linked_property_id, surface_carrez | `lib/types/copro.ts` |
| `user_site_roles` | id, user_id, role_code, site_id, unit_id, granted_at, is_active | `lib/types/copro.ts` |
| `copro_invites` | id, token, email, site_id, unit_id, target_role, ownership_type, ownership_share, status, expires_at | `lib/types/copro.ts` |
| `assemblies` | id, site_id, assembly_type (AGO/AGE/AGM), status, scheduled_at, quorum_reached, president/secretary/scrutineer, pv_document_id | `lib/types/copro-assemblies.ts` |
| `motions` | id, assembly_id, majority_type, votes_pour/contre/abstention, tantiemes_pour/contre/abstention, is_adopted, category | `lib/types/copro-assemblies.ts` |

### Tables manquantes (12) ❌

| Table | Priorité | Description |
|-------|----------|-------------|
| `floors` | P1 | Étages par bâtiment |
| `copro_lots` | P1 | Clés de répartition par lot (multi-tantièmes) |
| `ownerships` | P1 | Propriété courante et historique |
| `ownership_history` | P2 | Mutations (vente, donation, héritage) |
| `assembly_attendance` | P1 | Feuille de présence AG |
| `proxies` | P1 | Pouvoirs/mandats AG |
| `votes` | P1 | Votes individuels par motion |
| `assembly_documents` | P2 | Convocations, PV, annexes AG |
| `copro_services` | P1 | Types de charges (eau, ascenseur, ménage...) |
| `service_contracts` | P2 | Contrats prestataires |
| `service_expenses` | P1 | Factures fournisseurs |
| `charges_copro` | P1 | Charges réparties par lot |
| `calls_for_funds` | P1 | Appels de fonds (provision, régularisation, travaux) |
| `call_for_funds_items` | P1 | Détail par copropriétaire |
| `copro_payments` | P1 | Paiements copropriétaires |
| `copro_fiscal_years` | P1 | Exercices comptables SRU |
| `copro_accounting_entries` | P1 | Écritures comptables SRU |
| `copro_bank_accounts` | P2 | Comptes bancaires séparés |

### Routes API existantes (12) ✅

| Route | Méthode | Fichier |
|-------|---------|---------|
| `/api/copro/sites` | GET, POST | `app/api/copro/sites/route.ts` (141 LOC) |
| `/api/copro/sites/[siteId]` | GET, PATCH, DELETE | `app/api/copro/sites/[siteId]/route.ts` (164 LOC) |
| `/api/copro/buildings` | GET, POST | `app/api/copro/buildings/route.ts` (201 LOC) |
| `/api/copro/units` | GET, POST, PATCH | `app/api/copro/units/route.ts` (294 LOC) |
| `/api/copro/invites` | GET, POST | `app/api/copro/invites/route.ts` (285 LOC) |
| `/api/copro/invites/[token]` | GET, POST | `app/api/copro/invites/[token]/route.ts` (178 LOC) |
| `/api/copro/assemblies` | GET, POST | `app/api/copro/assemblies/route.ts` (136 LOC) |
| `/api/copro/assemblies/[assemblyId]` | GET, PATCH, DELETE | `app/api/copro/assemblies/[assemblyId]/route.ts` (281 LOC) |
| `/api/copro/charges` | GET, POST | `app/api/copro/charges/route.ts` (191 LOC) |
| `/api/copro/regularisation/calculate` | POST | `app/api/copro/regularisation/calculate/route.ts` (44 LOC) |
| `/api/copro/regularisation/send` | POST | `app/api/copro/regularisation/send/route.ts` (55 LOC) |
| `/api/syndic/dashboard` | GET | `app/api/syndic/dashboard/route.ts` (52 LOC) |

### Pages syndic existantes (31) ✅

```
app/syndic/
├── page.tsx                          # Redirect → dashboard
├── layout.tsx                        # Layout + sidebar syndic
├── error.tsx                         # Error boundary
├── dashboard/
│   ├── page.tsx ✅                   # Dashboard syndic
│   ├── loading.tsx
│   └── error.tsx
├── sites/
│   ├── page.tsx ✅                   # Liste copropriétés
│   ├── loading.tsx
│   ├── error.tsx
│   └── [id]/
│       ├── page.tsx ✅              # Détail copropriété
│       └── edit/page.tsx ✅         # Édition copropriété
├── assemblies/
│   ├── page.tsx ✅                   # Liste AG
│   ├── loading.tsx
│   ├── error.tsx
│   ├── new/page.tsx ✅              # Créer AG
│   └── [id]/
│       ├── page.tsx ✅              # Détail AG (votes, PV)
│       └── edit/page.tsx ✅         # Édition AG
├── expenses/
│   ├── page.tsx ✅                   # Liste dépenses
│   ├── loading.tsx
│   ├── error.tsx
│   └── new/page.tsx ✅              # Saisir dépense
├── calls/
│   ├── page.tsx ✅                   # Liste appels de fonds
│   └── new/page.tsx ✅              # Créer appel
├── invites/
│   └── page.tsx ✅                   # Invitations copropriétaires
└── onboarding/
    ├── profile/page.tsx ✅           # Étape 1 : Profil syndic
    ├── site/page.tsx ✅              # Étape 2 : Créer copropriété
    ├── buildings/page.tsx ✅         # Étape 3 : Bâtiments
    ├── units/page.tsx ✅             # Étape 4 : Lots
    ├── owners/page.tsx ✅            # Étape 5 : Copropriétaires
    ├── tantiemes/page.tsx ✅         # Étape 6 : Tantièmes
    └── complete/page.tsx ✅          # Étape 7 : Terminé
```

### Pages extranet copropriétaire existantes (17) ✅

```
app/copro/
├── page.tsx                          # Redirect
├── layout.tsx                        # Layout copropriétaire
├── error.tsx
├── dashboard/
│   ├── page.tsx ✅
│   ├── loading.tsx
│   └── error.tsx
├── assemblies/
│   ├── page.tsx ✅                   # Mes AG
│   └── [id]/page.tsx ✅             # Détail AG + voter
├── charges/
│   ├── page.tsx ✅                   # Mes charges
│   ├── loading.tsx
│   └── error.tsx
├── documents/
│   ├── page.tsx ✅                   # Mes documents copro
│   ├── loading.tsx
│   └── error.tsx
└── tickets/
    ├── page.tsx ✅                   # Mes signalements
    ├── loading.tsx
    └── error.tsx
```

### Services TypeScript existants (6 fichiers)

| Fichier | Rôle |
|---------|------|
| `features/copro/services/sites.service.ts` | CRUD sites, buildings, units |
| `features/copro/services/invites.service.ts` | Création, validation, acceptation invitations |
| `features/copro/services/assemblies.service.ts` | CRUD assemblées, motions |
| `features/copro/services/charges.service.ts` | Services, dépenses, répartition |
| `features/copro/services/regularisation.service.ts` | Calcul régularisation locataire |
| `features/copro/services/index.ts` | Export central |

### Types TypeScript existants (5 fichiers)

| Fichier | LOC | Contenu |
|---------|----:|---------|
| `lib/types/copro.ts` | 591 | Site, Building, CoproUnit, Ownership, RBAC (12 rôles, 30+ permissions) |
| `lib/types/copro-assemblies.ts` | 544 | Assembly, Motion, Proxy, Vote, QuorumResult, MotionResult |
| `lib/types/copro-charges.ts` | 544 | CoproService (28 types), ServiceContract, Expense, ChargeCopro, CallForFunds, Payment |
| `lib/types/copro-locatif.ts` | 150 | Bridge copro↔locatif, TenantCharge, Regularisation, Décret 87-713 |
| `lib/types/copro-invites.ts` | — | Types pour lib/types/copro.ts (intégrés) |

---

## 3. Cadre réglementaire

### Textes fondateurs

| Texte | Contenu clé |
|-------|-------------|
| **Loi n°65-557 du 10/07/1965** | Statut copropriété : lots, parties communes, AG, syndic |
| **Décret n°67-223 du 17/03/1967** | Application loi 1965 : convocation, majorités, comptabilité |
| **Loi ALUR (2014)** | Fonds travaux ≥5%, immatriculation RNC, extranet, compte séparé |
| **Loi ELAN (2018)** | Visioconférence AG, vote par correspondance, seuils DPE |
| **Loi Climat & Résilience (2021)** | PPT obligatoire, DPE collectif, interdiction passoires |
| **Loi Habitat Dégradé (2024)** | Copropriétés dégradées, administrateur provisoire renforcé |
| **Décret comptable SRU (2005)** | Plan comptable copropriété, 5 annexes annuelles |
| **Décret n°2025-XXX** | Portail numérique obligatoire, notification électronique |

### Obligations 2026 nouvelles

| Obligation | Échéance | Impact Talok |
|-----------|----------|-------------|
| DPE collectif <50 lots | 01/01/2026 | Stocker + alerter expiration |
| PPT (Plan Pluriannuel Travaux) | Obligatoire <50 lots | Module travaux + projections |
| Portail numérique copropriétaire | 2026 | = Notre extranet copro |
| Notification électronique | Avec consentement | Champ `notification_consent` |
| Fonds travaux ≥ 5% budget | Depuis ALUR | Vérifier à chaque budget |

### Spécificités DROM-COM

| Territoire | TVA | Spécificités |
|-----------|----:|-------------|
| Martinique | 8,5% | RTAA DOM, risque cyclonique/sismique |
| Guadeloupe | 8,5% | RTAA DOM, risque cyclonique/sismique |
| Réunion | 8,5% | RTAA DOM, risque cyclonique |
| Guyane | 2,1% | Réglementation thermique spécifique |
| Mayotte | 0% | Cadastre en cours, régime foncier spécial |
| Métropole | 20% | Régime standard |

**RTAA DOM** = Réglementation Thermique, Acoustique et Aération des DOM.
Calendriers AG décalés (saison cyclonique juin-novembre à éviter).

---

## 4. Modèle de données complet (19+ tables)

### 4.1 `sites` ✅ EXISTANTE

```sql
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  code TEXT,
  type TEXT NOT NULL CHECK (type IN ('copropriete','lotissement','residence_mixte','asl','aful')),
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT DEFAULT 'FR',
  siret TEXT,
  numero_immatriculation TEXT,          -- RNC (Registre National des Copropriétés)
  date_reglement TEXT,
  bank_account_id TEXT,
  iban TEXT,
  bic TEXT,
  fiscal_year_start_month INT DEFAULT 1,
  total_tantiemes_general INT DEFAULT 10000,
  total_tantiemes_eau INT DEFAULT 0,
  total_tantiemes_chauffage INT DEFAULT 0,
  total_tantiemes_ascenseur INT DEFAULT 0,
  syndic_type TEXT CHECK (syndic_type IN ('professionnel','benevole','cooperatif')),
  syndic_profile_id UUID REFERENCES profiles(id),
  syndic_company_name TEXT,
  syndic_siret TEXT,
  syndic_address TEXT,
  syndic_email TEXT,
  syndic_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  archived_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users
);
```

### 4.2 `buildings` ✅ EXISTANTE

```sql
CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  code TEXT,
  building_type TEXT CHECK (building_type IN ('immeuble','maison','parking','local_commercial','autre')),
  address_line1 TEXT,
  address_line2 TEXT,
  floors_count INT DEFAULT 1,
  has_basement BOOLEAN DEFAULT false,
  basement_levels INT DEFAULT 0,
  has_elevator BOOLEAN DEFAULT false,
  elevator_count INT DEFAULT 0,
  construction_year INT,
  renovation_year INT,
  heating_type TEXT CHECK (heating_type IN ('collectif','individuel','mixte','aucun')),
  water_type TEXT CHECK (water_type IN ('collectif','individuel','compteurs_divisionnaires')),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 `copro_units` ✅ EXISTANTE

```sql
CREATE TABLE copro_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  floor_id UUID REFERENCES floors(id) ON DELETE SET NULL,
  lot_number TEXT NOT NULL,
  lot_suffix TEXT,
  cadastral_reference TEXT,
  unit_type TEXT NOT NULL CHECK (unit_type IN (
    'appartement','maison','studio','duplex','triplex',
    'local_commercial','bureau','cave','parking','box','garage',
    'jardin','terrasse','balcon','local_technique','loge_gardien','autre'
  )),
  surface_carrez NUMERIC,
  surface_habitable NUMERIC,
  surface_utile NUMERIC,
  rooms_count INT DEFAULT 1,
  floor_level INT,
  door_number TEXT,
  staircase TEXT,
  position TEXT,
  tantieme_general INT NOT NULL DEFAULT 0,
  tantieme_eau INT DEFAULT 0,
  tantieme_chauffage INT DEFAULT 0,
  tantieme_ascenseur INT DEFAULT 0,
  occupation_mode TEXT CHECK (occupation_mode IN ('owner_occupied','rented','vacant','secondary')),
  linked_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 `user_site_roles` ✅ EXISTANTE

```sql
CREATE TABLE user_site_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users,
  role_code TEXT NOT NULL CHECK (role_code IN (
    'platform_admin','syndic','conseil_syndical','president_cs',
    'coproprietaire_occupant','coproprietaire_bailleur','coproprietaire_nu',
    'usufruitier','locataire','occupant','prestataire','gardien'
  )),
  tenant_id UUID,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES copro_units(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES auth.users,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.5 `copro_invites` ✅ EXISTANTE

```sql
CREATE TABLE copro_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES copro_units(id) ON DELETE SET NULL,
  target_role TEXT NOT NULL,
  ownership_type TEXT CHECK (ownership_type IN ('pleine_propriete','nue_propriete','usufruit','indivision','sci','autre')),
  ownership_share NUMERIC DEFAULT 1.0,
  personal_message TEXT,
  invited_by UUID NOT NULL REFERENCES auth.users,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','accepted','expired','cancelled')),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users,
  expires_at TIMESTAMPTZ NOT NULL,
  reminder_count INT DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.6 `assemblies` ✅ EXISTANTE

```sql
CREATE TABLE assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  assembly_number TEXT NOT NULL,
  label TEXT NOT NULL,
  assembly_type TEXT NOT NULL CHECK (assembly_type IN ('AGO','AGE','AGM')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  convocation_sent_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  location_type TEXT CHECK (location_type IN ('physical','video','hybrid')),
  location_address TEXT,
  location_room TEXT,
  video_link TEXT,
  video_password TEXT,
  total_tantiemes INT NOT NULL,
  present_tantiemes INT DEFAULT 0,
  represented_tantiemes INT DEFAULT 0,
  absent_tantiemes INT DEFAULT 0,
  quorum_required INT DEFAULT 0,
  quorum_reached BOOLEAN DEFAULT false,
  quorum_reached_at TIMESTAMPTZ,
  president_name TEXT,
  president_unit_id UUID,
  president_profile_id UUID,
  secretary_name TEXT,
  secretary_unit_id UUID,
  secretary_profile_id UUID,
  scrutineer_name TEXT,
  scrutineer_unit_id UUID,
  scrutineer_profile_id UUID,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','convoked','in_progress','suspended','closed','cancelled')),
  convocation_document_id UUID,
  pv_document_id UUID,
  pv_signed_at TIMESTAMPTZ,
  notes TEXT,
  agenda TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users
);
```

### 4.7 `motions` ✅ EXISTANTE

```sql
CREATE TABLE motions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  motion_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  majority_type TEXT NOT NULL CHECK (majority_type IN ('simple','absolute','double','unanimity')),
  required_percentage NUMERIC,
  category TEXT CHECK (category IN (
    'general','budget','travaux_courants','travaux_majeurs',
    'modification_reglement','vente_parties_communes','mandats','autre'
  )),
  associated_amount NUMERIC,
  associated_description TEXT,
  votes_pour INT DEFAULT 0,
  votes_contre INT DEFAULT 0,
  votes_abstention INT DEFAULT 0,
  tantiemes_pour INT DEFAULT 0,
  tantiemes_contre INT DEFAULT 0,
  tantiemes_abstention INT DEFAULT 0,
  is_adopted BOOLEAN,
  adoption_percentage NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','voting','voted','adopted','rejected','deferred','withdrawn')),
  voted_at TIMESTAMPTZ,
  display_order INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.8 `floors` ❌ À CRÉER

```sql
CREATE TABLE floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  level INT NOT NULL,                   -- -2, -1, 0 (RDC), 1, 2...
  name TEXT,                            -- "Rez-de-chaussée", "1er étage"
  display_order INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.9 `ownerships` ❌ À CRÉER

```sql
CREATE TABLE ownerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  ownership_type TEXT NOT NULL CHECK (ownership_type IN ('pleine_propriete','nue_propriete','usufruit','indivision','sci','autre')),
  ownership_share NUMERIC NOT NULL DEFAULT 1.0 CHECK (ownership_share > 0 AND ownership_share <= 1),
  acquisition_date DATE,
  acquisition_type TEXT,
  end_date DATE,
  can_vote BOOLEAN DEFAULT true,
  vote_delegation_to UUID REFERENCES profiles(id),
  is_current BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.10 `ownership_history` ❌ À CRÉER

```sql
CREATE TABLE ownership_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  previous_owner_id UUID REFERENCES profiles(id),
  previous_ownership_share NUMERIC,
  new_owner_id UUID REFERENCES profiles(id),
  new_ownership_share NUMERIC,
  transfer_type TEXT NOT NULL CHECK (transfer_type IN ('vente','donation','heritage','division','fusion','autre')),
  transfer_date DATE NOT NULL,
  transfer_price NUMERIC,
  notary_name TEXT,
  notary_reference TEXT,
  deed_document_id UUID,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.11 `assembly_attendance` ❌ À CRÉER

```sql
CREATE TABLE assembly_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES copro_units(id),
  owner_profile_id UUID REFERENCES profiles(id),
  owner_name TEXT NOT NULL,
  tantiemes INT NOT NULL,
  attendance_type TEXT NOT NULL CHECK (attendance_type IN ('present','represented','absent')),
  represented_by_profile_id UUID REFERENCES profiles(id),
  represented_by_name TEXT,
  proxy_id UUID REFERENCES proxies(id),
  signed_at TIMESTAMPTZ,
  signature_type TEXT CHECK (signature_type IN ('physical','electronic')),
  arrived_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  left_early BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assembly_id, unit_id)
);
```

### 4.12 `proxies` ❌ À CRÉER

```sql
CREATE TABLE proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  grantor_unit_id UUID NOT NULL REFERENCES copro_units(id),
  grantor_profile_id UUID REFERENCES profiles(id),
  grantor_name TEXT NOT NULL,
  grantor_tantiemes INT NOT NULL,
  grantee_profile_id UUID REFERENCES profiles(id),
  grantee_name TEXT NOT NULL,
  grantee_email TEXT,
  grantee_is_syndic BOOLEAN DEFAULT false,
  proxy_type TEXT DEFAULT 'full' CHECK (proxy_type IN ('full','partial','imperative')),
  voting_instructions JSONB DEFAULT '{}',  -- { motion_id: 'pour'|'contre'|'abstention' }
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','validated','used','cancelled','expired')),
  document_id UUID,
  signed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.13 `votes` ❌ À CRÉER

```sql
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_id UUID NOT NULL REFERENCES motions(id) ON DELETE CASCADE,
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES copro_units(id),
  voter_profile_id UUID REFERENCES profiles(id),
  voter_name TEXT NOT NULL,
  is_proxy_vote BOOLEAN DEFAULT false,
  proxy_id UUID REFERENCES proxies(id),
  tantiemes INT NOT NULL,
  vote_value TEXT NOT NULL CHECK (vote_value IN ('pour','contre','abstention')),
  voted_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(motion_id, unit_id)
);
```

### 4.14 `copro_services` ❌ À CRÉER

```sql
CREATE TABLE copro_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  code TEXT,
  service_type TEXT NOT NULL CHECK (service_type IN (
    'eau','eau_chaude','chauffage','climatisation','electricite_commune','gaz_commun',
    'ascenseur','interphone','digicode','videosurveillance',
    'menage','gardiennage','jardinage','piscine','ordures_menageres','tout_a_legout',
    'assurance_immeuble','assurance_rc','honoraires_syndic','frais_bancaires','frais_juridiques',
    'entretien_equipements','contrat_maintenance','travaux_courants','travaux_exceptionnels',
    'ravalement','impots_taxes','taxe_fonciere','autre'
  )),
  scope_type TEXT DEFAULT 'site' CHECK (scope_type IN ('site','building','unit_group','unit_type')),
  scope_building_id UUID REFERENCES buildings(id),
  scope_unit_ids UUID[] DEFAULT '{}',
  scope_unit_types TEXT[] DEFAULT '{}',
  default_allocation_mode TEXT DEFAULT 'tantieme_general' CHECK (default_allocation_mode IN (
    'tantieme_general','tantieme_eau','tantieme_chauffage','tantieme_ascenseur',
    'per_unit','surface_m2','consommation','custom'
  )),
  is_recurring BOOLEAN DEFAULT true,
  recurrence_period TEXT CHECK (recurrence_period IN ('monthly','bimonthly','quarterly','semiannual','yearly')),
  budget_annual NUMERIC DEFAULT 0,
  budget_monthly NUMERIC DEFAULT 0,
  is_recuperable_locatif BOOLEAN DEFAULT false,
  recuperable_ratio_default NUMERIC DEFAULT 0,
  compte_comptable TEXT,
  tva_applicable BOOLEAN DEFAULT false,
  tva_rate NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.15 `service_expenses` ❌ À CRÉER

```sql
CREATE TABLE service_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  service_id UUID REFERENCES copro_services(id),
  contract_id UUID REFERENCES service_contracts(id),
  expense_number TEXT,
  invoice_number TEXT,
  invoice_date DATE NOT NULL,
  provider_name TEXT,
  provider_siret TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fiscal_year INT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  amount_ht NUMERIC NOT NULL,
  amount_tva NUMERIC DEFAULT 0,
  amount_ttc NUMERIC NOT NULL,
  allocation_mode TEXT DEFAULT 'tantieme_general',
  is_allocated BOOLEAN DEFAULT false,
  allocated_at TIMESTAMPTZ,
  allocated_by UUID REFERENCES auth.users,
  recuperable_amount NUMERIC DEFAULT 0,
  non_recuperable_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid','cancelled')),
  payment_date DATE,
  payment_method TEXT,
  payment_reference TEXT,
  invoice_document_id UUID,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending_validation','validated','allocated','cancelled')),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.16 `calls_for_funds` ❌ À CRÉER

```sql
CREATE TABLE calls_for_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  call_number TEXT NOT NULL,
  label TEXT NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('provision','regularisation','travaux','exceptionnel')),
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fiscal_year INT NOT NULL,
  due_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_date DATE DEFAULT CURRENT_DATE,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','validated','sent','partial','closed','cancelled')),
  pdf_document_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.17 `call_for_funds_items` ❌ À CRÉER

```sql
CREATE TABLE call_for_funds_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls_for_funds(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES copro_units(id),
  owner_profile_id UUID REFERENCES profiles(id),
  owner_name TEXT,
  owner_email TEXT,
  lot_number TEXT NOT NULL,
  tantieme_general INT NOT NULL,
  amount NUMERIC NOT NULL,
  previous_balance NUMERIC DEFAULT 0,
  total_due NUMERIC NOT NULL,
  paid_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','partial','paid','cancelled')),
  sent_at TIMESTAMPTZ,
  sent_method TEXT CHECK (sent_method IN ('email','postal','both')),
  email_sent BOOLEAN DEFAULT false,
  postal_sent BOOLEAN DEFAULT false,
  reminder_count INT DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(call_id, unit_id)
);
```

### 4.18 `copro_fiscal_years` ❌ À CRÉER

```sql
CREATE TABLE copro_fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closing','closed','archived')),
  budget_previsionnel NUMERIC DEFAULT 0,
  fonds_travaux_rate NUMERIC DEFAULT 5.0,   -- % du budget (min 5% ALUR)
  fonds_travaux_amount NUMERIC DEFAULT 0,
  opening_balance NUMERIC DEFAULT 0,
  closing_balance NUMERIC,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users,
  approved_at_assembly_id UUID REFERENCES assemblies(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id, fiscal_year)
);
```

### 4.19 `copro_accounting_entries` ❌ À CRÉER

```sql
CREATE TABLE copro_accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  fiscal_year_id UUID NOT NULL REFERENCES copro_fiscal_years(id),
  entry_date DATE NOT NULL,
  entry_number TEXT NOT NULL,
  compte_debit TEXT NOT NULL,           -- Plan comptable SRU
  compte_credit TEXT NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  expense_id UUID REFERENCES service_expenses(id),
  call_id UUID REFERENCES calls_for_funds(id),
  payment_id UUID REFERENCES copro_payments(id),
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users,
  bank_statement_ref TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RÈGLE : jamais modifier une écriture après rapprochement (is_reconciled = true)
```

---

## 5. Plan comptable SRU

### Comptes principaux

| Classe | Comptes | Description |
|--------|---------|-------------|
| **1** | 10xx | Provisions et avances |
| | 102 | Provisions pour travaux (art. 14-2 ALUR) |
| | 103 | Avances |
| | 105 | Fonds de travaux ALUR |
| **4** | 40xx-46xx | Tiers |
| | 401 | Fournisseurs |
| | 409 | Fournisseurs débiteurs |
| | 450 | Copropriétaires — provisions |
| | 451 | Copropriétaires — charges |
| | 459 | Copropriétaires débiteurs divers |
| **5** | 51xx | Trésorerie |
| | 512 | Banque — compte séparé copropriété |
| **6** | 60xx-67xx | Charges |
| | 600 | Eau |
| | 601 | Électricité parties communes |
| | 602 | Chauffage/climatisation |
| | 610 | Fournitures d'entretien |
| | 611 | Prestations de nettoyage |
| | 612 | Gardiennage |
| | 614 | Assurances |
| | 615 | Entretien et réparations |
| | 616 | Ascenseur |
| | 620 | Honoraires syndic |
| | 621 | Frais de gestion courante |
| | 622 | Frais juridiques |
| | 627 | Frais bancaires |
| | 650 | Travaux d'entretien |
| | 672 | Travaux exceptionnels votés AG |
| **7** | 70xx | Produits |
| | 701 | Provisions appelées — budget prévisionnel |
| | 702 | Provisions appelées — travaux |
| | 703 | Produits accessoires (antennes, parking visiteurs) |

### 5 annexes réglementaires annuelles

| Annexe | Nom | Contenu |
|--------|-----|---------|
| **1** | État financier | Bilan : soldes actif (banque, débiteurs) vs passif (fournisseurs, provisions) |
| **2** | Compte de gestion général | Toutes charges et produits de l'exercice |
| **3** | Budget prévisionnel et réalisé | Comparaison budget voté vs réalisé par poste |
| **4** | État des dettes et créances | Détail fournisseurs impayés + copropriétaires débiteurs |
| **5** | Situation de trésorerie | Solde banque, rapprochement bancaire, fonds travaux |

### Cycle comptable

1. **Ouverture** — Report à nouveau de l'exercice précédent
2. **Budget prévisionnel** — Voté en AG, base des appels de provisions
3. **Appels de fonds** — Trimestriels (1/4 du budget + fonds travaux)
4. **Saisie des dépenses** — Factures fournisseurs → écritures 6xx/401
5. **Rapprochement bancaire** — Pointage relevés vs écritures
6. **Régularisation** — Écart provisions/réel → solde ou complément
7. **Clôture** — Arrêté des comptes, production des 5 annexes, approbation AG

### Règles d'imputation par clé de répartition

| Service | Clé par défaut | Alternatives |
|---------|---------------|-------------|
| Eau froide | tantieme_eau | Compteurs individuels |
| Chauffage | tantieme_chauffage | Compteurs individuels, surface |
| Ascenseur | tantieme_ascenseur | Par étage (usage) |
| Ordures | tantieme_general | Par lot (égalitaire) |
| Assurance | tantieme_general | — |
| Gardiennage | tantieme_general | 75% récupérable locataire |
| Travaux | tantieme_general | Vote AG peut changer |

---

## 6. Assemblée Générale — flux complet

### Cycle AG

```
Préparation (brouillon)
  → Convocation (21 jours francs min avant)
  → Feuille de présence + pouvoirs
  → Vérification quorum
  → Séance (votes résolution par résolution)
  → PV signé (président, secrétaire, scrutateur)
  → Notification absents (≤ 1 mois après AG)
```

### Les 5 majorités

| Majorité | Article | Seuil | Exemples |
|----------|---------|-------|----------|
| **Simple** | Art. 24 | >50% des tantièmes des présents/représentés | Budget prévisionnel, entretien courant, syndic (renouvellement) |
| **Absolue** | Art. 25 | >50% de TOUS les tantièmes | Travaux amélioration, changement de syndic, modification règlement intérieur |
| **Passerelle** | Art. 25-1 | Si art.25 échoue mais ≥1/3 des tantièmes → revote immédiat art.24 | Même sujets art.25, 2e chance |
| **Double** | Art. 26 | Majorité en nombre (>50% copropriétaires) ET 2/3 des tantièmes | Modification règlement, aliénation parties communes |
| **Unanimité** | — | 100% de tous les tantièmes | Changement destination immeuble, suppression conciergerie |

### Vote par correspondance (ELAN)

- Formulaire envoyé avec la convocation
- Retour 3 jours francs avant l'AG minimum
- Comptabilisé comme vote exprimé (pas comme absent)

### Visioconférence (ELAN)

- Doit être autorisée par AG préalable (art. 24)
- Lien + mot de passe dans la convocation
- Possibilité d'AG hybride (physical + video)

### Calcul quorum

```
Quorum = (présents_tantiemes + représentés_tantiemes) / total_tantiemes
```
Pas de quorum minimum légal pour les AG (sauf si le règlement de copropriété en prévoit un).
En pratique, l'AG peut valablement délibérer quel que soit le nombre de présents.

---

## 7. Routes API (80+)

### Sites / Copropriétés

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/sites` | ✅ |
| POST | `/api/copro/sites` | ✅ |
| GET | `/api/copro/sites/[siteId]` | ✅ |
| PATCH | `/api/copro/sites/[siteId]` | ✅ |
| DELETE | `/api/copro/sites/[siteId]` | ✅ |
| GET | `/api/copro/sites/[siteId]/stats` | ❌ |
| GET | `/api/copro/sites/[siteId]/tantiemes-summary` | ❌ |

### Bâtiments

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/buildings` | ✅ |
| POST | `/api/copro/buildings` | ✅ |
| PATCH | `/api/copro/buildings/[id]` | ❌ |
| DELETE | `/api/copro/buildings/[id]` | ❌ |

### Lots / Unités

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/units` | ✅ |
| POST | `/api/copro/units` | ✅ |
| PATCH | `/api/copro/units/[id]` | ✅ |
| DELETE | `/api/copro/units/[id]` | ❌ |
| GET | `/api/copro/units/[id]/owners` | ❌ |

### Copropriétaires & Propriété

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/owners` | ❌ |
| GET | `/api/copro/owners/[id]` | ❌ |
| POST | `/api/copro/ownerships` | ❌ |
| PATCH | `/api/copro/ownerships/[id]` | ❌ |
| DELETE | `/api/copro/ownerships/[id]` | ❌ |

### Invitations

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/invites` | ✅ |
| POST | `/api/copro/invites` | ✅ |
| POST | `/api/copro/invites/batch` | ❌ |
| GET | `/api/copro/invites/[token]` | ✅ |
| POST | `/api/copro/invites/[token]` (accept) | ✅ |
| POST | `/api/copro/invites/[id]/resend` | ❌ |
| DELETE | `/api/copro/invites/[id]` | ❌ |

### Assemblées Générales

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/assemblies` | ✅ |
| POST | `/api/copro/assemblies` | ✅ |
| GET | `/api/copro/assemblies/[id]` | ✅ |
| PATCH | `/api/copro/assemblies/[id]` | ✅ |
| DELETE | `/api/copro/assemblies/[id]` | ✅ |
| POST | `/api/copro/assemblies/[id]/convoke` | ❌ |
| POST | `/api/copro/assemblies/[id]/start` | ❌ |
| POST | `/api/copro/assemblies/[id]/close` | ❌ |
| GET | `/api/copro/assemblies/[id]/attendance` | ❌ |
| POST | `/api/copro/assemblies/[id]/attendance` | ❌ |
| GET | `/api/copro/assemblies/[id]/proxies` | ❌ |
| POST | `/api/copro/assemblies/[id]/proxies` | ❌ |
| GET | `/api/copro/assemblies/[id]/motions` | ❌ |
| POST | `/api/copro/assemblies/[id]/motions` | ❌ |
| POST | `/api/copro/assemblies/[id]/motions/[mid]/vote` | ❌ |
| GET | `/api/copro/assemblies/[id]/results` | ❌ |
| POST | `/api/copro/assemblies/[id]/pv/generate` | ❌ |

### Exercices comptables SRU

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/fiscal-years` | ❌ |
| POST | `/api/copro/fiscal-years` | ❌ |
| PATCH | `/api/copro/fiscal-years/[id]` | ❌ |
| POST | `/api/copro/fiscal-years/[id]/close` | ❌ |
| GET | `/api/copro/fiscal-years/[id]/entries` | ❌ |
| POST | `/api/copro/fiscal-years/[id]/entries` | ❌ |
| GET | `/api/copro/fiscal-years/[id]/annexes` | ❌ |
| GET | `/api/copro/fiscal-years/[id]/balance` | ❌ |
| POST | `/api/copro/fiscal-years/[id]/reconcile` | ❌ |

### Services & Dépenses

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/services` | ❌ |
| POST | `/api/copro/services` | ❌ |
| PATCH | `/api/copro/services/[id]` | ❌ |
| GET | `/api/copro/charges` | ✅ |
| POST | `/api/copro/charges` | ✅ |
| GET | `/api/copro/expenses` | ❌ |
| POST | `/api/copro/expenses` | ❌ |
| PATCH | `/api/copro/expenses/[id]` | ❌ |
| POST | `/api/copro/expenses/[id]/allocate` | ❌ |
| POST | `/api/copro/expenses/[id]/validate` | ❌ |

### Contrats prestataires

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/contracts` | ❌ |
| POST | `/api/copro/contracts` | ❌ |
| PATCH | `/api/copro/contracts/[id]` | ❌ |
| DELETE | `/api/copro/contracts/[id]` | ❌ |

### Appels de fonds

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/calls` | ❌ |
| POST | `/api/copro/calls` | ❌ |
| GET | `/api/copro/calls/[id]` | ❌ |
| POST | `/api/copro/calls/[id]/send` | ❌ |
| GET | `/api/copro/calls/[id]/items` | ❌ |
| POST | `/api/copro/calls/[id]/remind` | ❌ |

### Paiements copropriétaire

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/payments` | ❌ |
| POST | `/api/copro/payments` | ❌ |
| POST | `/api/copro/payments/[id]/validate` | ❌ |

### Régularisation locative (bridge)

| Méthode | Route | Statut |
|---------|-------|--------|
| POST | `/api/copro/regularisation/calculate` | ✅ |
| POST | `/api/copro/regularisation/send` | ✅ |

### Mutations & états datés

| Méthode | Route | Statut |
|---------|-------|--------|
| POST | `/api/copro/mutations` | ❌ |
| GET | `/api/copro/mutations/[id]` | ❌ |
| POST | `/api/copro/etat-date/generate` | ❌ |
| GET | `/api/copro/etat-date/[id]` | ❌ |

### Documents copro

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/copro/documents` | ❌ |
| POST | `/api/copro/documents/upload` | ❌ |
| GET | `/api/copro/documents/[id]/download` | ❌ |

### Dashboard syndic

| Méthode | Route | Statut |
|---------|-------|--------|
| GET | `/api/syndic/dashboard` | ✅ |
| GET | `/api/syndic/analytics` | ❌ |
| GET | `/api/syndic/alerts` | ❌ |

### Notifications syndic

| Méthode | Route | Statut |
|---------|-------|--------|
| POST | `/api/copro/notifications/convocation` | ❌ |
| POST | `/api/copro/notifications/call-reminder` | ❌ |
| POST | `/api/copro/notifications/pv-absent` | ❌ |

---

## 8. Pages UI (48 écrans)

### Syndic — app/syndic/ (31 pages)

| URL | Statut | Description |
|-----|--------|-------------|
| `/syndic` | ✅ | Redirect → dashboard |
| `/syndic/dashboard` | ✅ | KPIs, alertes, prochaines AG |
| `/syndic/sites` | ✅ | Liste copropriétés gérées |
| `/syndic/sites/[id]` | ✅ | Détail copropriété (bâtiments, lots, copropriétaires) |
| `/syndic/sites/[id]/edit` | ✅ | Édition copropriété |
| `/syndic/assemblies` | ✅ | Liste AG passées et à venir |
| `/syndic/assemblies/new` | ✅ | Créer une AG |
| `/syndic/assemblies/[id]` | ✅ | Détail AG (motions, votes, PV) |
| `/syndic/assemblies/[id]/edit` | ✅ | Édition AG |
| `/syndic/expenses` | ✅ | Liste dépenses / factures |
| `/syndic/expenses/new` | ✅ | Saisir dépense |
| `/syndic/calls` | ✅ | Liste appels de fonds |
| `/syndic/calls/new` | ✅ | Créer appel de fonds |
| `/syndic/invites` | ✅ | Invitations copropriétaires |
| `/syndic/onboarding/profile` | ✅ | Onboarding étape 1 |
| `/syndic/onboarding/site` | ✅ | Onboarding étape 2 |
| `/syndic/onboarding/buildings` | ✅ | Onboarding étape 3 |
| `/syndic/onboarding/units` | ✅ | Onboarding étape 4 |
| `/syndic/onboarding/owners` | ✅ | Onboarding étape 5 |
| `/syndic/onboarding/tantiemes` | ✅ | Onboarding étape 6 |
| `/syndic/onboarding/complete` | ✅ | Onboarding terminé |
| `/syndic/accounting` | ❌ | Comptabilité SRU |
| `/syndic/accounting/[yearId]` | ❌ | Détail exercice |
| `/syndic/accounting/entries` | ❌ | Écritures comptables |
| `/syndic/contracts` | ❌ | Contrats prestataires |
| `/syndic/mutations` | ❌ | Mutations / états datés |
| `/syndic/documents` | ❌ | GED copropriété |
| `/syndic/works` | ❌ | Travaux en cours |
| `/syndic/reports` | ❌ | Rapports & annexes SRU |
| `/syndic/settings` | ❌ | Paramètres syndic |
| `/syndic/analytics` | ❌ | Analytics multi-copropriétés |

### Extranet copropriétaire — app/copro/ (17 pages)

| URL | Statut | Description |
|-----|--------|-------------|
| `/copro` | ✅ | Redirect |
| `/copro/dashboard` | ✅ | Mon résumé copropriété |
| `/copro/assemblies` | ✅ | Mes AG |
| `/copro/assemblies/[id]` | ✅ | Détail AG + voter |
| `/copro/charges` | ✅ | Mes charges & appels |
| `/copro/documents` | ✅ | Mes documents |
| `/copro/tickets` | ✅ | Mes signalements |
| `/copro/payments` | ❌ | Mes paiements |
| `/copro/profile` | ❌ | Mes coordonnées copro |

### Sidebar syndic (menus)

```
🏢 Dashboard
📋 Copropriétés (sites)
📊 Comptabilité (à créer)
🗳️ Assemblées générales
💰 Appels de fonds
📄 Dépenses
🔧 Contrats (à créer)
🏗️ Travaux (à créer)
📁 Documents (à créer)
📈 Rapports (à créer)
👥 Invitations
⚙️ Paramètres (à créer)
```

---

## 9. Onboarding syndic (7 étapes)

| Étape | URL | Contenu |
|-------|-----|---------|
| 1 | `/syndic/onboarding/profile` | Type de syndic (professionnel/bénévole/coopératif), SIRET, carte pro G, email, téléphone |
| 2 | `/syndic/onboarding/site` | Nom copropriété, adresse, code postal, ville, type (copropriété/lotissement/ASL/AFUL), n° immatriculation RNC, territoire (→ TVA auto) |
| 3 | `/syndic/onboarding/buildings` | Ajouter bâtiments : nom, type, étages, ascenseur, chauffage, eau |
| 4 | `/syndic/onboarding/units` | Ajouter lots : numéro, type, surface Carrez, étage, escalier |
| 5 | `/syndic/onboarding/owners` | Inviter copropriétaires par email, rôle cible, lot assigné, type de propriété |
| 6 | `/syndic/onboarding/tantiemes` | Saisie/vérification tantièmes par lot (général, eau, chauffage, ascenseur), validation somme = total |
| 7 | `/syndic/onboarding/complete` | Récapitulatif, activation copropriété, redirection dashboard |

---

## 10. Pricing & Stripe

### Plans syndic

```typescript
const SYNDIC_PLAN_LIMITS = {
  syndic_starter: {
    maxCopros: 4,
    price: 3900, // centimes/copro/mois
    features: ['sites', 'units', 'invites', 'assemblies', 'calls', 'extranet'],
  },
  syndic_pro: {
    maxCopros: 14,
    price: 3500,
    features: ['...starter', 'accounting_sru', 'contracts', 'mutations', 'reports'],
  },
  syndic_cabinet: {
    maxCopros: Infinity,
    price: 2900,
    features: ['...pro', 'multi_cabinet', 'api_access', 'white_label', 'ai_ocr'],
  },
};
```

### Stripe metered billing (à implémenter)

- Produit Stripe : `prod_syndic_copro_seat`
- Prix : metered, par copropriété active, facturation mensuelle
- Paliers automatiques (usage-based avec tiers)
- Webhook : `invoice.paid` → renouveler accès
- Webhook : `invoice.payment_failed` → alerte + mode dégradé après 15j

### Feature gating syndic

| Feature | Starter | Pro | Cabinet |
|---------|:-------:|:---:|:-------:|
| Gestion copropriétés | ✅ | ✅ | ✅ |
| AG dématérialisée | ✅ | ✅ | ✅ |
| Appels de fonds | ✅ | ✅ | ✅ |
| Extranet copropriétaire | ✅ | ✅ | ✅ |
| Comptabilité SRU | ❌ | ✅ | ✅ |
| Contrats prestataires | ❌ | ✅ | ✅ |
| Mutations & états datés | ❌ | ✅ | ✅ |
| Rapports & annexes PDF | ❌ | ✅ | ✅ |
| Multi-cabinet | ❌ | ❌ | ✅ |
| API & webhooks | ❌ | ❌ | ✅ |
| White-label | ❌ | ❌ | ✅ |
| IA OCR factures | ❌ | ❌ | ✅ |

### Add-ons (tous plans)

| Add-on | Prix |
|--------|-----:|
| État daté | 10€/document |
| Signatures électroniques | Voir grille principale |
| Stockage supplémentaire | 5€/10 Go/mois |

---

## 11. Extranet copropriétaire

### 3 niveaux d'accès

| Niveau | Qui | Documents accessibles |
|--------|-----|----------------------|
| **Tous copropriétaires** | Tout membre du syndicat | Règlement, PV AG, budget, appels de fonds, état des lieux, DPE |
| **Individuel** | Le copropriétaire concerné | Ses appels nominatifs, sa situation comptable, ses paiements |
| **Conseil syndical** | Membres du CS | Contrats, factures détaillées, relevés bancaires, correspondance syndic |

### Inscription copropriétaire

1. Syndic envoie une invitation par email (token unique)
2. Copropriétaire clique → page `/invite/copro?token=xxx`
3. Création de compte ou liaison compte existant
4. Attribution rôle `coproprietaire_occupant` / `coproprietaire_bailleur` / etc.
5. Accès gratuit immédiat à l'extranet `/copro/`

### Fonctionnalités extranet

- Consulter ses charges et appels de fonds
- Télécharger documents (PV, budget, règlement, convocations)
- Voter par correspondance avant l'AG
- Envoyer un signalement (ticket)
- Mettre à jour ses coordonnées
- Recevoir notifications (email, push) avec consentement explicite
- Consulter sa situation comptable personnelle

---

## 12. Phases d'implémentation

### Phase 1 — Fondation DB (2 semaines)

- Créer les 12 tables manquantes (floors → copro_accounting_entries)
- Migrer le feature gate vers plans syndic dédiés
- Configurer Stripe metered billing par copropriété
- RLS sur toutes les nouvelles tables
- **Dépendances :** Aucune
- **Livrable :** Schéma DB complet, Stripe syndic fonctionnel

### Phase 2 — Comptabilité SRU (3 semaines)

- CRUD exercices comptables (copro_fiscal_years)
- Écritures comptables double entrée (copro_accounting_entries)
- Appels de fonds automatiques (calls_for_funds + items)
- Rapprochement bancaire
- Génération PDF 5 annexes réglementaires
- **Dépendances :** Phase 1
- **Livrable :** Module comptable SRU complet

### Phase 3 — AG dématérialisée (2 semaines)

- Feuille de présence (assembly_attendance)
- Pouvoirs/mandats (proxies)
- Votes individuels avec calcul majorités (votes)
- Passerelle art. 25-1 automatique
- Vote par correspondance
- Génération PV automatique (PDF)
- Notification absents (≤1 mois)
- **Dépendances :** Phase 1
- **Livrable :** AG de bout en bout

### Phase 4 — Extranet copropriétaire (1,5 semaines)

- Enrichir les pages `/copro/*` existantes avec données réelles
- Situation comptable individuelle
- Vote par correspondance côté copropriétaire
- Téléchargement documents par niveau d'accès
- Notifications push/email
- **Dépendances :** Phases 2 + 3
- **Livrable :** Extranet fonctionnel

### Phase 5 — Travaux & contrats (1 semaine)

- CRUD contrats prestataires (service_contracts)
- Suivi travaux votés en AG
- Alertes renouvellement contrats
- Lien avec module prestataires Talok existant
- **Dépendances :** Phase 2
- **Livrable :** Gestion travaux et contrats

### Phase 6 — Mutations & états datés (1 semaine)

- Transfert de propriété (ownership_history)
- Génération état daté PDF (add-on 10€)
- Notification nouveau copropriétaire
- Mise à jour automatique tantièmes et droits de vote
- **Dépendances :** Phase 2
- **Livrable :** Module mutations

### Phase 7 — Documents & conformité (1,5 semaines)

- GED copropriété (bucket "documents" existant)
- Génération PDF réglementaires (convocations, PV, annexes, appels)
- Alertes DPE/PPT/conformité
- Stockage documents fondateurs (règlement, EDD, carnet d'entretien)
- **Dépendances :** Phases 2 + 3
- **Livrable :** Conformité documentaire

### Phase 8 — Analytics, alertes, IA (1-2 semaines)

- Dashboard multi-copropriétés
- Analytics financiers (taux recouvrement, impayés, tendances)
- Alertes automatiques (échéances, impayés, contrats)
- OCR factures fournisseurs (IA)
- Suggestions d'optimisation (IA)
- **Dépendances :** Toutes les phases
- **Livrable :** Intelligence syndic

### Résumé

| Phase | Effort | Cumul |
|-------|-------:|------:|
| 1. Fondation DB + Stripe | 2 sem | 2 sem |
| 2. Comptabilité SRU | 3 sem | 5 sem |
| 3. AG dématérialisée | 2 sem | 7 sem |
| 4. Extranet copropriétaire | 1,5 sem | 8,5 sem |
| **MVP vendable** | | **8,5 sem** |
| 5. Travaux & contrats | 1 sem | 9,5 sem |
| 6. Mutations & états datés | 1 sem | 10,5 sem |
| 7. Documents & conformité | 1,5 sem | 12 sem |
| 8. Analytics, alertes, IA | 1-2 sem | 13-14 sem |

---

## 13. Règles TOUJOURS / JAMAIS

### TOUJOURS

- Calculer les majorités en **TANTIÈMES** (jamais en nombre de têtes sauf art. 26 double condition)
- Utiliser le **plan comptable SRU** (jamais le PCG standard)
- Vérifier que la somme des tantièmes = total du site avant tout calcul de charges
- Appliquer la **TVA DROM-COM dynamiquement** (0%, 2,1%, 8,5%, 20%) selon code postal
- Fonds travaux ≥ **5% du budget prévisionnel** (art. 14-2 ALUR)
- Convocation AG ≥ **21 jours francs** avant la date
- Notification PV aux absents ≤ **1 mois** après l'AG
- **Compte bancaire séparé** par copropriété (art. 18 loi 1965)
- **Consentement explicite** pour notification électronique (champ dans user_site_roles)
- Stocker documents dans le **bucket "documents"** existant de Supabase
- Implémenter la **passerelle art. 25-1** automatiquement si art. 25 échoue avec ≥1/3
- Respecter la **récupérabilité Décret 87-713** pour le bridge copro→locatif
- Utiliser `user_profile_id()` et `user_role()` pour les RLS (SOTA 2026)
- Préfixer les migrations SQL avec timestamp `YYYYMMDDHHMMSS`

### JAMAIS

- Supprimer un exercice **clôturé** (status = 'closed' ou 'archived')
- Modifier une écriture après **rapprochement bancaire** (is_reconciled = true)
- Permettre un vote **sans vérification quorum** préalable
- Afficher les données d'une copro à un **syndic non mandaté** (vérifier syndic_profile_id)
- **Hardcoder les taux de TVA** — utiliser calcul dynamique par code postal
- Utiliser **"DOM-TOM"** — dire "DROM-COM" ou "France d'outre-mer"
- Mentionner **"Stripe"** côté utilisateur — dire "paiement en ligne"
- **Facturer les copropriétaires** — seul le syndic paie l'abonnement
- Ignorer la **passerelle art. 25-1** — c'est une obligation légale
- Toucher `lib/subscriptions/plans.ts` sans instruction explicite
- Créer des tables sans **RLS** activé
- Utiliser des `console.log` en production
