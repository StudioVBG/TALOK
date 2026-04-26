/**
 * API Route: P&L par bien immobilier
 * GET /api/accounting/pnl-by-property?entityId=...&exerciseId=...
 *
 * Lit la vue v_pnl_by_property (créée par 20260427200000) et regroupe
 * les comptes par classe (6 charges / 7 produits) pour chaque property.
 * Renvoie un résultat net par bien : revenus - charges = rendement.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

interface PnlRow {
  entity_id: string;
  exercise_id: string;
  property_id: string;
  account_number: string;
  account_label: string;
  total_debit_cents: number;
  total_credit_cents: number;
  balance_cents: number;
}

interface PropertyRow {
  id: string;
  adresse_complete: string | null;
  type_bien: string | null;
  surface_loi_carrez: number | null;
}

export interface PropertyPnlResult {
  propertyId: string;
  propertyAddress: string | null;
  propertyType: string | null;
  surfaceM2: number | null;
  /** Revenus = somme des comptes 7xx (en cents). */
  revenueCents: number;
  /** Charges = somme des comptes 6xx (en cents). */
  expensesCents: number;
  /** Résultat net = revenue - expenses (en cents). */
  netResultCents: number;
  /** Rendement net annuel ramené au m² (€/m²/an). */
  yieldPerSqmEuros: number | null;
  /** Détail des comptes mouvementés sur ce bien. */
  accounts: Array<{
    accountNumber: string;
    accountLabel: string;
    classChar: string;
    totalDebitCents: number;
    totalCreditCents: number;
    balanceCents: number;
  }>;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Profil non trouvé");

    const featureGate = await requireAccountingAccess(profile.id, "balance");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const exerciseId = searchParams.get("exerciseId");
    if (!entityId) throw new ApiError(400, "entityId requis");

    if (profile.role !== "admin") {
      const { data: entity } = await serviceClient
        .from("legal_entities")
        .select("id")
        .eq("id", entityId)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) throw new ApiError(403, "Accès refusé à cette entité");
    }

    let query = (serviceClient as any)
      .from("v_pnl_by_property")
      .select("*")
      .eq("entity_id", entityId);

    if (exerciseId) query = query.eq("exercise_id", exerciseId);

    const { data: rows, error } = await query;
    if (error) {
      console.error("[pnl-by-property] view query failed:", error);
      throw new ApiError(500, "Erreur lecture v_pnl_by_property");
    }

    const pnlRows = (rows ?? []) as PnlRow[];

    // Récupère les libellés des biens en une requête
    const propertyIds = Array.from(new Set(pnlRows.map((r) => r.property_id)));
    const properties = new Map<string, PropertyRow>();
    if (propertyIds.length > 0) {
      const { data: propsData } = await serviceClient
        .from("properties")
        .select("id, adresse_complete, type_bien, surface_loi_carrez")
        .in("id", propertyIds);
      for (const p of (propsData ?? []) as PropertyRow[]) {
        properties.set(p.id, p);
      }
    }

    // Agrège par property_id
    const byProperty = new Map<string, PropertyPnlResult>();
    for (const row of pnlRows) {
      const classChar = row.account_number.charAt(0);
      // On ne calcule revenue/expense que sur classes 6 et 7. Les autres
      // comptes (5xx tréso, 4xx tiers, etc.) sont listés dans `accounts`
      // mais n'entrent pas dans le calcul du résultat.
      let acc = byProperty.get(row.property_id);
      if (!acc) {
        const prop = properties.get(row.property_id) ?? null;
        acc = {
          propertyId: row.property_id,
          propertyAddress: prop?.adresse_complete ?? null,
          propertyType: prop?.type_bien ?? null,
          surfaceM2: prop?.surface_loi_carrez ?? null,
          revenueCents: 0,
          expensesCents: 0,
          netResultCents: 0,
          yieldPerSqmEuros: null,
          accounts: [],
        };
        byProperty.set(row.property_id, acc);
      }

      acc.accounts.push({
        accountNumber: row.account_number,
        accountLabel: row.account_label,
        classChar,
        totalDebitCents: Number(row.total_debit_cents),
        totalCreditCents: Number(row.total_credit_cents),
        balanceCents: Number(row.balance_cents),
      });

      if (classChar === "7") {
        // Produit : solde créditeur compte = revenu réalisé
        acc.revenueCents += Number(row.total_credit_cents) - Number(row.total_debit_cents);
      } else if (classChar === "6") {
        // Charge : solde débiteur = charge engagée
        acc.expensesCents += Number(row.total_debit_cents) - Number(row.total_credit_cents);
      }
    }

    // Calcule net + rendement m²
    for (const result of byProperty.values()) {
      result.netResultCents = result.revenueCents - result.expensesCents;
      if (result.surfaceM2 && result.surfaceM2 > 0) {
        result.yieldPerSqmEuros = result.netResultCents / 100 / result.surfaceM2;
      }
      // Tri des comptes : 7xx (revenus) en haut, puis 6xx (charges), puis le reste
      result.accounts.sort((a, b) => {
        if (a.classChar !== b.classChar) {
          // 7 > 6 > rest
          if (a.classChar === "7") return -1;
          if (b.classChar === "7") return 1;
          if (a.classChar === "6") return -1;
          if (b.classChar === "6") return 1;
        }
        return a.accountNumber.localeCompare(b.accountNumber);
      });
    }

    // Tri par résultat net décroissant pour mettre les biens les plus
    // rentables en haut.
    const list = Array.from(byProperty.values()).sort(
      (a, b) => b.netResultCents - a.netResultCents,
    );

    return NextResponse.json({
      success: true,
      data: { properties: list },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
