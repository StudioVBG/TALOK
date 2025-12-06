# Module Syndic/Copro

## Vue d'ensemble

Le module Syndic/Copro permet de gérer les copropriétés avec deux interfaces distinctes :

1. **Syndic** (`/app/syndic/`) - Interface de gestion pour les syndics professionnels
2. **Copropriétaire** (`/app/copro/`) - Extranet pour les copropriétaires

---

## Architecture des rôles

### Rôles copropriété

| Rôle | Description | Permissions |
|------|-------------|-------------|
| `syndic` | Gestionnaire de la copropriété | Toutes les opérations |
| `coproprietaire` | Copropriétaire occupant | Lecture, votes, paiements |
| `coproprietaire_bailleur` | Copropriétaire bailleur | Lecture, votes, paiements + charges récupérables |

### Relation avec la gestion locative

Les **copropriétaires bailleurs** ont accès aux deux interfaces :
- Interface propriétaire standard (`/app/owner/`)
- Interface copropriétaire (`/app/copro/`)

Cela permet de :
- Gérer les locations dans les lots de copropriété
- Calculer les charges récupérables sur les locataires
- Effectuer les régularisations annuelles

---

## Structure des pages

### Module Syndic (`/app/syndic/`)

```
/app/syndic/
├── dashboard/          # Tableau de bord syndic
├── sites/              # Liste des copropriétés gérées
│   ├── [id]/           # Détail d'une copropriété
│   │   └── edit/       # Modification
├── assemblies/         # Assemblées générales
│   ├── [id]/           # Détail AG
│   │   └── edit/       # Modification AG
│   └── new/            # Nouvelle AG
├── calls/              # Appels de fonds
│   └── new/            # Nouvel appel
├── expenses/           # Factures fournisseurs
│   └── new/            # Nouvelle facture
├── invites/            # Invitations copropriétaires
└── onboarding/         # Assistant création copro
    ├── profile/        # Profil syndic
    ├── site/           # Info copropriété
    ├── buildings/      # Bâtiments
    ├── units/          # Lots
    ├── tantiemes/      # Tantièmes
    ├── owners/         # Copropriétaires
    └── complete/       # Finalisation
```

### Module Copropriétaire (`/app/copro/`)

```
/app/copro/
├── dashboard/          # Tableau de bord copropriétaire
├── assemblies/         # Assemblées générales
│   └── [id]/           # Détail AG + vote
├── charges/            # Mes appels de charges
├── documents/          # Documents copropriété
└── tickets/            # Signalements parties communes
```

---

## Modèle de données

### Tables principales

```sql
-- Sites de copropriété
copro_sites (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  syndic_profile_id UUID REFERENCES profiles(id),
  fiscal_year_start DATE,
  created_at TIMESTAMPTZ
)

-- Bâtiments
copro_buildings (
  id UUID PRIMARY KEY,
  site_id UUID REFERENCES copro_sites(id),
  name TEXT NOT NULL,
  floors_count INTEGER
)

-- Lots (unités)
copro_units (
  id UUID PRIMARY KEY,
  site_id UUID REFERENCES copro_sites(id),
  building_id UUID REFERENCES copro_buildings(id),
  lot_number TEXT NOT NULL,
  type TEXT, -- 'appartement', 'parking', 'cave', 'commercial'
  owner_profile_id UUID REFERENCES profiles(id),
  tantieme_general INTEGER,
  tantieme_special JSONB
)

-- Assemblées générales
copro_assemblies (
  id UUID PRIMARY KEY,
  site_id UUID REFERENCES copro_sites(id),
  label TEXT NOT NULL, -- 'AGO 2025', 'AGE Travaux'
  type TEXT, -- 'ordinaire', 'extraordinaire'
  scheduled_at TIMESTAMPTZ,
  location TEXT,
  status TEXT -- 'draft', 'convocation_sent', 'ongoing', 'completed'
)

-- Résolutions (motions)
copro_motions (
  id UUID PRIMARY KEY,
  assembly_id UUID REFERENCES copro_assemblies(id),
  order_index INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  majority_type TEXT, -- 'simple', 'absolute', 'double', 'unanimity'
  result TEXT -- 'pending', 'adopted', 'rejected'
)

-- Votes
copro_votes (
  id UUID PRIMARY KEY,
  motion_id UUID REFERENCES copro_motions(id),
  unit_id UUID REFERENCES copro_units(id),
  vote TEXT, -- 'for', 'against', 'abstain'
  proxy_from UUID REFERENCES copro_units(id) -- Si vote par procuration
)

-- Appels de fonds
copro_fund_calls (
  id UUID PRIMARY KEY,
  site_id UUID REFERENCES copro_sites(id),
  label TEXT,
  period TEXT, -- 'T1 2025'
  due_date DATE,
  status TEXT -- 'draft', 'sent', 'overdue', 'closed'
)

-- Détail appels par lot
copro_fund_call_items (
  id UUID PRIMARY KEY,
  fund_call_id UUID REFERENCES copro_fund_calls(id),
  unit_id UUID REFERENCES copro_units(id),
  amount DECIMAL(10,2),
  paid_amount DECIMAL(10,2),
  status TEXT -- 'pending', 'partial', 'paid'
)
```

---

## API Endpoints

### Sites

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/copro/sites` | Liste des sites (syndic: tous ses sites, copro: ses sites) |
| POST | `/api/copro/sites` | Créer un site (syndic uniquement) |
| GET | `/api/copro/sites/[id]` | Détail d'un site |
| PUT | `/api/copro/sites/[id]` | Modifier un site |
| DELETE | `/api/copro/sites/[id]` | Supprimer un site |

### Assemblées

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/copro/assemblies` | Liste des AG |
| POST | `/api/copro/assemblies` | Créer une AG |
| GET | `/api/copro/assemblies/[id]` | Détail AG avec résolutions |
| POST | `/api/copro/assemblies/[id]/votes` | Soumettre un vote |

### Charges

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/copro/calls` | Liste des appels de fonds |
| POST | `/api/copro/calls` | Créer un appel |
| GET | `/api/copro/calls/[id]/items` | Détail par lot |

---

## Services métier

### `features/copro/services/`

```typescript
// sites.service.ts
export async function createSite(data: CreateSiteInput): Promise<Site>
export async function getSiteWithUnits(siteId: string): Promise<SiteWithUnits>
export async function updateSite(siteId: string, data: UpdateSiteInput): Promise<Site>

// assemblies.service.ts
export async function createAssembly(data: CreateAssemblyInput): Promise<Assembly>
export async function getAssemblyWithMotions(assemblyId: string): Promise<AssemblyWithMotions>
export async function recordVote(motionId: string, unitId: string, vote: VoteValue): Promise<void>
export async function calculateResults(assemblyId: string): Promise<AssemblyResults>

// charges.service.ts
export async function createFundCall(data: CreateFundCallInput): Promise<FundCall>
export async function calculateUnitCharges(siteId: string, period: string): Promise<ChargeBreakdown[]>
export async function recordPayment(callItemId: string, amount: number): Promise<void>

// regularisation.service.ts
export async function calculateRecoverableCharges(unitId: string, year: number): Promise<RecoverableCharges>
export async function generateRegularisationDocument(leaseId: string, year: number): Promise<Document>

// invites.service.ts
export async function inviteCoproprietaire(email: string, unitId: string): Promise<Invite>
export async function acceptInvite(token: string, profileId: string): Promise<void>
```

---

## Fonctionnalités implémentées

### ✅ Complètes

- [x] Dashboard syndic avec statistiques
- [x] Dashboard copropriétaire avec solde
- [x] Onboarding création copropriété (7 étapes)
- [x] Liste et détail des sites
- [x] Composants UI (`SiteCard`, `AssemblyCard`)

### ⚠️ Partiellement implémentées

- [ ] Gestion des assemblées générales (UI présente, logique métier incomplète)
- [ ] Système de vote (structure prête, pas de calcul de majorité)
- [ ] Appels de fonds (formulaire présent, pas d'intégration paiement)

### 🧩 À développer

- [ ] Calcul automatique des tantièmes
- [ ] Génération des convocations AG (PDF)
- [ ] Procès-verbal automatique post-AG
- [ ] Intégration comptable
- [ ] Régularisation des charges récupérables
- [ ] Notifications automatiques (relances, rappels AG)

---

## Migration SQL requise

La migration complète pour le module copro se trouve dans :
```
supabase/migrations_old/20251201100001_copro_structure.sql
supabase/migrations_old/20251201100002_copro_rbac.sql
supabase/migrations_old/20251201100003_copro_rls.sql
supabase/migrations_old/20251201100004_copro_invites.sql
supabase/migrations_old/20251201100005_copro_charges.sql
supabase/migrations_old/20251201100006_copro_assemblies.sql
supabase/migrations_old/20251201100007_copro_locatif_bridge.sql
```

### Application

```bash
# Via Supabase CLI
supabase db push

# OU manuellement via SQL Editor dans le dashboard
```

---

## Types TypeScript

### `lib/types/copro.ts`

```typescript
export interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  syndic_profile_id: string;
  fiscal_year_start: string;
  created_at: string;
  units?: UnitCount[];
}

export interface UnitCount {
  count: number;
}

export interface Unit {
  id: string;
  site_id: string;
  building_id: string | null;
  lot_number: string;
  type: 'appartement' | 'parking' | 'cave' | 'commercial';
  owner_profile_id: string;
  tantieme_general: number;
  tantieme_special: Record<string, number>;
}
```

### `lib/types/copro-assemblies.ts`

```typescript
export interface AssemblySummary {
  id: string;
  label: string;
  type: 'ordinaire' | 'extraordinaire';
  scheduled_at: string;
  location: string;
  status: 'draft' | 'convocation_sent' | 'ongoing' | 'completed';
  motions_count: number;
  site: {
    id: string;
    name: string;
  };
}

export interface Motion {
  id: string;
  assembly_id: string;
  order_index: number;
  title: string;
  description: string;
  majority_type: 'simple' | 'absolute' | 'double' | 'unanimity';
  result: 'pending' | 'adopted' | 'rejected';
}

export type VoteValue = 'for' | 'against' | 'abstain';
```

---

## Prochaines étapes recommandées

1. **Court terme**
   - Finaliser les API copro manquantes
   - Implémenter le calcul des majorités pour les votes
   - Ajouter les tests unitaires pour les services

2. **Moyen terme**
   - Génération PDF des convocations et PV
   - Intégration du module de paiement pour les charges
   - Dashboard analytics syndic

3. **Long terme**
   - Import CSV des copropriétaires
   - Intégration comptable (export FEC)
   - Module de travaux avec appels de fonds spéciaux

