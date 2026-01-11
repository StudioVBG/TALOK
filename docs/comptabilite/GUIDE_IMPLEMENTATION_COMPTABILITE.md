# Guide d'Implémentation - Module Comptabilité Talok

## Vue d'Ensemble

Ce guide détaille comment implémenter les fonctionnalités comptables dans Talok : où les ajouter, pour qui, quels forfaits, les flux de données, les routes API, et les patterns UX.

---

## 1. OÙ AJOUTER LES FONCTIONNALITÉS ?

### Structure des Dossiers

```
/home/user/TALOK/
├── features/
│   └── accounting/                    # 🆕 NOUVEAU MODULE À CRÉER
│       ├── components/
│       │   ├── crg-generator.tsx      # Compte rendu de gestion
│       │   ├── balance-mandants.tsx   # Balance des mandants
│       │   ├── export-comptable.tsx   # Interface d'export
│       │   ├── grand-livre.tsx        # Grand livre mandant
│       │   ├── situation-locataire.tsx
│       │   ├── recapitulatif-fiscal.tsx
│       │   └── regularisation-charges.tsx
│       ├── services/
│       │   └── accounting.service.ts  # Service principal
│       ├── hooks/
│       │   └── use-accounting.ts      # Hook React
│       ├── types/
│       │   └── index.ts               # Types TypeScript
│       └── actions/
│           └── accounting.actions.ts  # Server Actions
│
├── app/
│   ├── api/
│   │   └── accounting/                # Routes API existantes + nouvelles
│   │       ├── gl/route.ts            # ✅ Existe (Grand Livre)
│   │       ├── exports/route.ts       # ✅ Existe (Export CSV/FEC)
│   │       ├── crg/route.ts           # 🆕 Compte rendu gestion
│   │       ├── balance/route.ts       # 🆕 Balance mandants
│   │       ├── mandant/[id]/route.ts  # 🆕 Détail par propriétaire
│   │       └── fiscal/route.ts        # 🆕 Récapitulatif fiscal
│   │
│   └── owner/
│       └── accounting/                # 🆕 Pages propriétaire
│           ├── page.tsx               # Dashboard comptable
│           ├── crg/page.tsx           # CRG mensuel/trimestriel
│           ├── fiscal/page.tsx        # Récap fiscal annuel
│           └── exports/page.tsx       # Exports comptables
│
├── components/
│   └── accounting/                    # 🆕 Composants partagés
│       ├── document-preview.tsx
│       ├── export-button.tsx
│       └── period-selector.tsx
│
└── lib/
    └── accounting/                    # 🆕 Utilitaires comptables
        ├── fec-generator.ts           # Génération FEC
        ├── calculations.ts            # Calculs honoraires/TVA
        └── constants.ts               # Plan comptable
```

---

## 2. POUR QUI ? (RÔLES ET ACCÈS)

### Matrice des Accès par Rôle

| Document | Owner | Tenant | Admin | Provider |
|----------|-------|--------|-------|----------|
| **Avis d'échéance** | Génère | Reçoit | Tous | ❌ |
| **Quittance de loyer** | Génère | Reçoit/Télécharge | Tous | ❌ |
| **Compte rendu gestion (CRG)** | ✅ Reçoit | ❌ | ✅ Génère | ❌ |
| **Balance des mandants** | ❌ | ❌ | ✅ Interne | ❌ |
| **Grand livre mandant** | ✅ Sur demande | ❌ | ✅ | ❌ |
| **Situation locataire** | ✅ Consulte | ✅ Consulte | ✅ | ❌ |
| **Récapitulatif fiscal** | ✅ Télécharge | ❌ | ✅ | ❌ |
| **Export FEC** | ❌ | ❌ | ✅ Génère | ❌ |
| **Régularisation charges** | ✅ Génère | ✅ Reçoit | ✅ | ❌ |

### Code d'Autorisation

```typescript
// lib/helpers/permissions.ts - À AJOUTER

export function canAccessAccounting(role: string): boolean {
  return ['admin', 'owner'].includes(role);
}

export function canGenerateFEC(role: string): boolean {
  return role === 'admin';
}

export function canViewCRG(role: string, isOwnProperty: boolean): boolean {
  if (role === 'admin') return true;
  if (role === 'owner' && isOwnProperty) return true;
  return false;
}

export function canViewTenantSituation(
  role: string,
  profileId: string,
  tenantProfileId: string,
  propertyOwnerId: string
): boolean {
  if (role === 'admin') return true;
  if (role === 'tenant' && profileId === tenantProfileId) return true;
  if (role === 'owner' && profileId === propertyOwnerId) return true;
  return false;
}
```

---

## 3. QUELS FORFAITS Y ONT ACCÈS ?

### Forfaits Talok Actuels

| Forfait | Prix | Accès Comptabilité |
|---------|------|-------------------|
| **Gratuit** | 0 €/mois | ❌ Aucun export |
| **Starter** | 9 €/mois | ✅ Quittances + Avis échéance |
| **Confort** | 35 €/mois | ✅ + CRG + Situation locataire |
| **Pro** | 69 €/mois | ✅ + Export CSV/Excel + Récap fiscal |
| **Enterprise** | 249+ €/mois | ✅ + Export FEC + API comptable |

### Feature Keys à Ajouter

```typescript
// lib/subscriptions/plans.ts - AJOUTER ces features

type AccountingFeatureKey =
  | 'accounting_basic'        // Quittances, avis échéance
  | 'accounting_crg'          // Compte rendu de gestion
  | 'accounting_exports'      // Export CSV/Excel
  | 'accounting_fiscal'       // Récapitulatif fiscal
  | 'accounting_fec'          // Export FEC normé
  | 'accounting_api';         // API comptable externe

// Dans PLAN_FEATURES :
export const PLAN_FEATURES: Record<PlanSlug, FeatureKey[]> = {
  gratuit: [],
  starter: ['accounting_basic'],
  confort: ['accounting_basic', 'accounting_crg'],
  pro: ['accounting_basic', 'accounting_crg', 'accounting_exports', 'accounting_fiscal'],
  enterprise_s: ['accounting_basic', 'accounting_crg', 'accounting_exports', 'accounting_fiscal', 'accounting_fec'],
  enterprise_m: ['accounting_basic', 'accounting_crg', 'accounting_exports', 'accounting_fiscal', 'accounting_fec', 'accounting_api'],
  enterprise_l: ['accounting_basic', 'accounting_crg', 'accounting_exports', 'accounting_fiscal', 'accounting_fec', 'accounting_api'],
  enterprise_xl: ['accounting_basic', 'accounting_crg', 'accounting_exports', 'accounting_fiscal', 'accounting_fec', 'accounting_api'],
};
```

### Utilisation du PlanGate

```tsx
// Dans les composants
import { PlanGate } from "@/components/subscription/plan-gate";

<PlanGate feature="accounting_exports" mode="blur">
  <ExportComptableButton />
</PlanGate>

<PlanGate feature="accounting_fec" mode="block">
  <FECExportSection />
</PlanGate>
```

---

## 4. FLUX DE DONNÉES

### Schéma Global

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUX DE DONNÉES COMPTABLES                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   SUPABASE   │     │   SERVICES   │     │  COMPOSANTS  │                │
│  │   (Tables)   │────▶│   (Logic)    │────▶│    (UI)      │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│         │                    │                    │                         │
│         │                    │                    │                         │
│         ▼                    ▼                    ▼                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   invoices   │     │ accounting   │     │ CRGGenerator │                │
│  │   payments   │     │  .service    │     │ ExportButton │                │
│  │   leases     │     │              │     │ FiscalRecap  │                │
│  │   charges    │     │ Calculs:     │     │              │                │
│  │   properties │     │ - Honoraires │     │ États:       │                │
│  └──────────────┘     │ - TVA        │     │ - loading    │                │
│                       │ - Soldes     │     │ - data       │                │
│                       └──────────────┘     │ - error      │                │
│                                            └──────────────┘                │
│                                                   │                         │
│                                                   ▼                         │
│                                            ┌──────────────┐                │
│                                            │   EXPORTS    │                │
│                                            │  CSV / Excel │                │
│                                            │  PDF / FEC   │                │
│                                            └──────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tables Supabase Utilisées

```sql
-- Tables EXISTANTES utilisées pour la comptabilité
invoices        -- Factures/quittances (loyers appelés)
payments        -- Paiements reçus
leases          -- Baux (loyer, charges, dates)
properties      -- Biens (propriétaire, adresse)
charges         -- Charges récurrentes
profiles        -- Propriétaires, locataires
owner_profiles  -- Infos fiscales propriétaire

-- Tables NOUVELLES à créer (optionnel)
accounting_entries    -- Écritures comptables
accounting_journals   -- Journaux (VE, AC, BQ, OD)
mandant_accounts      -- Comptes mandants (467xxx)
fiscal_summaries      -- Récapitulatifs fiscaux cachés
```

### Service Principal

```typescript
// features/accounting/services/accounting.service.ts

import { createClient } from "@/lib/supabase/client";
import { z } from "zod";

export class AccountingService {
  private supabase = createClient();

  /**
   * Génère le Compte Rendu de Gestion pour un propriétaire
   */
  async generateCRG(ownerId: string, periode: { debut: string; fin: string }) {
    // 1. Récupérer les biens du propriétaire
    const { data: properties } = await this.supabase
      .from("properties")
      .select("id, adresse_ligne1, ville")
      .eq("owner_id", ownerId);

    if (!properties?.length) {
      throw new Error("Aucun bien trouvé");
    }

    // 2. Pour chaque bien, récupérer les mouvements
    const crgs = await Promise.all(
      properties.map(async (property) => {
        const movements = await this.getPropertyMovements(
          property.id,
          periode.debut,
          periode.fin
        );

        return {
          property,
          movements,
          totals: this.calculateTotals(movements),
        };
      })
    );

    return crgs;
  }

  /**
   * Récupère tous les mouvements d'un bien sur une période
   */
  async getPropertyMovements(
    propertyId: string,
    startDate: string,
    endDate: string
  ) {
    // Loyers encaissés
    const { data: invoices } = await this.supabase
      .from("invoices")
      .select(`
        *,
        lease:leases!inner(property_id),
        payments(*)
      `)
      .eq("lease.property_id", propertyId)
      .gte("periode", startDate.substring(0, 7))
      .lte("periode", endDate.substring(0, 7));

    // Charges payées
    const { data: charges } = await this.supabase
      .from("charges")
      .select("*")
      .eq("property_id", propertyId);

    return this.transformToMovements(invoices || [], charges || []);
  }

  /**
   * Calcule les honoraires de gestion
   */
  calculateHonoraires(loyerHC: number, tauxHT: number = 0.07): {
    baseHT: number;
    montantHT: number;
    tva: number;
    totalTTC: number;
  } {
    const montantHT = loyerHC * tauxHT;
    const tva = montantHT * 0.20;
    const totalTTC = montantHT + tva;

    return {
      baseHT: loyerHC,
      montantHT: Math.round(montantHT * 100) / 100,
      tva: Math.round(tva * 100) / 100,
      totalTTC: Math.round(totalTTC * 100) / 100,
    };
  }

  /**
   * Génère la balance des mandants
   */
  async generateBalanceMandants(date: string) {
    const { data: owners } = await this.supabase
      .from("profiles")
      .select(`
        id,
        prenom,
        nom,
        owner_profiles!inner(*)
      `)
      .eq("role", "owner");

    const balances = await Promise.all(
      (owners || []).map(async (owner) => {
        const solde = await this.calculateOwnerBalance(owner.id, date);
        return {
          compte: `467${owner.id.substring(0, 3)}`,
          proprietaire: `${owner.prenom} ${owner.nom}`,
          debit: solde < 0 ? Math.abs(solde) : 0,
          credit: solde >= 0 ? solde : 0,
        };
      })
    );

    return balances;
  }

  /**
   * Génère le récapitulatif fiscal annuel
   */
  async generateRecapFiscal(ownerId: string, annee: number) {
    const startDate = `${annee}-01-01`;
    const endDate = `${annee}-12-31`;

    // Revenus bruts
    const { data: invoices } = await this.supabase
      .from("invoices")
      .select(`
        montant_loyer,
        montant_charges,
        lease:leases!inner(
          property:properties!inner(owner_id)
        )
      `)
      .eq("lease.property.owner_id", ownerId)
      .eq("statut", "payee")
      .gte("periode", `${annee}-01`)
      .lte("periode", `${annee}-12`);

    const revenusBruts = {
      loyers: invoices?.reduce((sum, inv) => sum + (inv.montant_loyer || 0), 0) || 0,
      charges: invoices?.reduce((sum, inv) => sum + (inv.montant_charges || 0), 0) || 0,
    };

    // Charges déductibles
    const charges = await this.getChargesDeductibles(ownerId, annee);

    return {
      annee,
      revenusBruts,
      chargesDeductibles: charges,
      revenuFoncierNet: revenusBruts.loyers + revenusBruts.charges - charges.total,
    };
  }

  /**
   * Export FEC (Fichier des Écritures Comptables)
   */
  async exportFEC(annee: number): Promise<string> {
    const entries = await this.getAllAccountingEntries(annee);

    const header = "JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;CompAuxNum;CompAuxLib;PieceRef;PieceDate;EcritureLib;Debit;Credit;EcritureLet;DateLet;ValidDate;Montantdevise;Idevise\n";

    const lines = entries.map((entry) =>
      `${entry.journalCode};${entry.journalLib};${entry.ecritureNum};${entry.ecritureDate};${entry.compteNum};${entry.compteLib};;;${entry.pieceRef};${entry.pieceDate};${entry.ecritureLib};${entry.debit};${entry.credit};;;;0.00;EUR`
    ).join("\n");

    return header + lines;
  }

  // Méthodes privées...
  private transformToMovements(invoices: any[], charges: any[]) { /* ... */ }
  private calculateTotals(movements: any[]) { /* ... */ }
  private async calculateOwnerBalance(ownerId: string, date: string) { /* ... */ }
  private async getChargesDeductibles(ownerId: string, annee: number) { /* ... */ }
  private async getAllAccountingEntries(annee: number) { /* ... */ }
}

export const accountingService = new AccountingService();
```

---

## 5. ROUTES API

### Routes Existantes

```typescript
// GET /api/accounting/gl - Grand Livre (existe déjà)
// GET /api/accounting/exports - Export CSV/Excel (existe déjà)
```

### Routes à Créer

#### Route CRG

```typescript
// app/api/accounting/crg/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { accountingService } from "@/features/accounting/services/accounting.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/crg - Génère un Compte Rendu de Gestion
 *
 * Query params:
 * - owner_id: string (requis pour admin, ignoré pour owner)
 * - start_date: string (YYYY-MM-DD)
 * - end_date: string (YYYY-MM-DD)
 * - format: 'json' | 'pdf' (défaut: json)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const format = searchParams.get("format") || "json";
    let ownerId = searchParams.get("owner_id");

    // Validation des dates
    if (!startDate || !endDate) {
      throw new ApiError(400, "start_date et end_date sont requis");
    }

    // Déterminer l'owner_id selon le rôle
    if (profile.role === "owner") {
      ownerId = profile.id; // Force son propre ID
    } else if (profile.role === "admin") {
      if (!ownerId) {
        throw new ApiError(400, "owner_id requis pour admin");
      }
    } else {
      throw new ApiError(403, "Accès non autorisé");
    }

    // Générer le CRG
    const crg = await accountingService.generateCRG(ownerId, {
      debut: startDate,
      fin: endDate,
    });

    if (format === "pdf") {
      // TODO: Générer PDF
      return NextResponse.json({ error: "PDF non implémenté" }, { status: 501 });
    }

    return NextResponse.json({
      crg,
      periode: { start_date: startDate, end_date: endDate },
      owner_id: ownerId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### Route Balance Mandants

```typescript
// app/api/accounting/balance/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { accountingService } from "@/features/accounting/services/accounting.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/balance - Balance des mandants (Admin only)
 *
 * Query params:
 * - date: string (YYYY-MM-DD) - Date de la balance
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Vérifier rôle admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      throw new ApiError(403, "Réservé aux administrateurs");
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const balance = await accountingService.generateBalanceMandants(date);

    // Calcul des totaux
    const totals = balance.reduce(
      (acc, item) => ({
        debit: acc.debit + item.debit,
        credit: acc.credit + item.credit,
      }),
      { debit: 0, credit: 0 }
    );

    return NextResponse.json({
      balance,
      totals,
      date,
      equilibre: Math.abs(totals.credit - totals.debit) < 0.01,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### Route Récapitulatif Fiscal

```typescript
// app/api/accounting/fiscal/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { accountingService } from "@/features/accounting/services/accounting.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/fiscal - Récapitulatif fiscal annuel (Aide 2044)
 *
 * Query params:
 * - year: number (YYYY)
 * - owner_id: string (admin only)
 * - format: 'json' | 'pdf'
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear() - 1));
    let ownerId = searchParams.get("owner_id");

    // Déterminer owner_id
    if (profile?.role === "owner") {
      ownerId = profile.id;
    } else if (profile?.role !== "admin") {
      throw new ApiError(403, "Accès non autorisé");
    }

    if (!ownerId) {
      throw new ApiError(400, "owner_id requis");
    }

    const recap = await accountingService.generateRecapFiscal(ownerId, year);

    return NextResponse.json({
      recap,
      year,
      owner_id: ownerId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## 6. UX/UI SOTA 2026

### Patterns à Utiliser

#### 1. Dashboard Comptabilité

```tsx
// app/owner/accounting/page.tsx

"use client";

import { motion } from "framer-motion";
import { KPICard } from "@/components/ui/kpi-card";
import { PlanGate } from "@/components/subscription/plan-gate";
import { CRGSection } from "@/features/accounting/components/crg-section";
import { ExportSection } from "@/features/accounting/components/export-section";

export default function AccountingDashboard() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header avec KPIs */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <KPICard
          title="Loyers encaissés"
          value={14400}
          format="currency"
          trend={{ value: 5, isPositive: true }}
          variant="blue"
        />
        <KPICard
          title="Honoraires prélevés"
          value={1209.60}
          format="currency"
          variant="green"
        />
        <KPICard
          title="Solde mandant"
          value={267.80}
          format="currency"
          variant="orange"
        />
        <KPICard
          title="Taux d'encaissement"
          value={98.5}
          format="percentage"
          variant="purple"
        />
      </motion.div>

      {/* Sections principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CRG */}
        <PlanGate feature="accounting_crg" mode="blur">
          <CRGSection />
        </PlanGate>

        {/* Exports */}
        <PlanGate feature="accounting_exports" mode="blur">
          <ExportSection />
        </PlanGate>
      </div>

      {/* Récap fiscal - PRO+ */}
      <PlanGate feature="accounting_fiscal" mode="block">
        <FiscalRecapSection />
      </PlanGate>
    </div>
  );
}
```

#### 2. Composant Export

```tsx
// features/accounting/components/export-section.tsx

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { accountingService } from "../services/accounting.service";

const EXPORT_FORMATS = [
  { value: "csv", label: "CSV", icon: FileText },
  { value: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { value: "fec", label: "FEC (Fiscal)", icon: FileText },
] as const;

const EXPORT_TYPES = [
  { value: "honoraires", label: "Factures d'honoraires" },
  { value: "crg", label: "Compte rendu de gestion" },
  { value: "mandants", label: "Situation mandants" },
  { value: "fiscal", label: "Récapitulatif fiscal" },
] as const;

export function ExportSection() {
  const [format, setFormat] = useState<string>("csv");
  const [type, setType] = useState<string>("honoraires");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/accounting/exports?format=${format}&type=${type}`
      );

      if (!response.ok) {
        throw new Error("Erreur lors de l'export");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${type}_${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();

      toast({
        title: "Export réussi",
        description: "Le fichier a été téléchargé.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer l'export.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exports Comptables
        </CardTitle>
        <CardDescription>
          Générez vos documents pour votre expert-comptable
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type d'export */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Type de document</label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {EXPORT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Format */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Format</label>
          <div className="flex gap-2">
            {EXPORT_FORMATS.map((f) => {
              const Icon = f.icon;
              return (
                <Button
                  key={f.value}
                  variant={format === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat(f.value)}
                  className="flex-1"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {f.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Bouton export */}
        <Button
          onClick={handleExport}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>Génération en cours...</>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

#### 3. Aperçu Document (Modal)

```tsx
// features/accounting/components/document-preview-modal.tsx

"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Mail } from "lucide-react";

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    type: string;
    title: string;
    content: React.ReactNode;
  };
  onDownload: () => void;
  onPrint: () => void;
  onEmail: () => void;
}

export function DocumentPreviewModal({
  open,
  onOpenChange,
  document,
  onDownload,
  onPrint,
  onEmail,
}: DocumentPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{document.title}</DialogTitle>
        </DialogHeader>

        {/* Actions */}
        <div className="flex gap-2 border-b pb-4">
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger PDF
          </Button>
          <Button variant="outline" size="sm" onClick={onPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
          <Button variant="outline" size="sm" onClick={onEmail}>
            <Mail className="h-4 w-4 mr-2" />
            Envoyer par email
          </Button>
        </div>

        {/* Aperçu du document */}
        <div className="bg-white border rounded-lg p-8 shadow-inner">
          {document.content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 7. TUTORIELS & RESSOURCES

### Documentation Existante dans Talok

```
/docs/
├── architecture/          # Architecture technique
├── api/                   # Documentation API
└── comptabilite/          # 🆕 Documentation comptable
    ├── EXEMPLES_DOCUMENTS_COMPTABLES.md  # ✅ Créé
    └── GUIDE_IMPLEMENTATION_COMPTABILITE.md  # ✅ Ce fichier
```

### Ressources Externes Recommandées

| Sujet | Ressource |
|-------|-----------|
| **Plan Comptable Français** | [Plan Comptable Général 2024](https://www.anc.gouv.fr) |
| **Norme FEC** | [Article A47 A-1 du LPF](https://www.legifrance.gouv.fr) |
| **Loi Hoguet** | [Loi n° 70-9 du 2 janvier 1970](https://www.legifrance.gouv.fr) |
| **Next.js App Router** | [Next.js 14 Docs](https://nextjs.org/docs) |
| **Supabase** | [Supabase Docs](https://supabase.com/docs) |
| **shadcn/ui** | [shadcn/ui Components](https://ui.shadcn.com) |
| **Zod Validation** | [Zod Documentation](https://zod.dev) |

### Tutoriels Internes à Créer

1. **Comment ajouter un nouveau document comptable**
2. **Comment créer une route API avec auth**
3. **Comment utiliser le PlanGate pour les features**
4. **Comment générer un PDF depuis Talok**

---

## 8. CHECKLIST D'IMPLÉMENTATION

### Phase 1 : Foundation
- [ ] Créer `/features/accounting/` structure
- [ ] Créer `accounting.service.ts`
- [ ] Ajouter les feature keys dans `plans.ts`
- [ ] Créer les types TypeScript

### Phase 2 : API Routes
- [ ] Route `/api/accounting/crg`
- [ ] Route `/api/accounting/balance`
- [ ] Route `/api/accounting/fiscal`
- [ ] Améliorer `/api/accounting/exports` (FEC)

### Phase 3 : UI Components
- [ ] Dashboard comptabilité owner
- [ ] Composant CRG avec aperçu
- [ ] Modal export avec formats
- [ ] Récap fiscal 2044

### Phase 4 : Intégrations
- [ ] Export PDF via Puppeteer
- [ ] Envoi email avec Resend
- [ ] Stockage documents Supabase Storage

---

*Document créé le 10 janvier 2026 - Talok v2.0*
