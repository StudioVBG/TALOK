// @ts-nocheck
/**
 * API Route: Expenses CRUD (liste + création)
 * GET  /api/accounting/expenses?year=2025&entityId=xxx
 * POST /api/accounting/expenses
 *
 * Feature gate: hasAccounting (plan Confort+)
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { userHasFeature } from "@/lib/subscriptions/subscription-service";

const EXPENSE_CATEGORIES = [
  "travaux", "entretien", "assurance", "taxe_fonciere", "charges_copro",
  "frais_gestion", "frais_bancaires", "diagnostic", "mobilier", "honoraires", "autre",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  travaux: "Travaux / réparations",
  entretien: "Entretien courant",
  assurance: "Assurance",
  taxe_fonciere: "Taxe foncière",
  charges_copro: "Charges de copropriété",
  frais_gestion: "Frais de gestion",
  frais_bancaires: "Frais bancaires",
  diagnostic: "Diagnostics",
  mobilier: "Mobilier",
  honoraires: "Honoraires",
  autre: "Autre",
};

async function getOwnerProfile(serviceClient: any, userId: string) {
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", userId)
    .single();
  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
    throw new ApiError(403, "Accès réservé aux propriétaires");
  }
  return profile;
}

/**
 * GET — Liste des dépenses
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const hasAccess = await userHasFeature(user.id, "bank_reconciliation");
    if (!hasAccess) {
      return NextResponse.json(
        { error: "La comptabilité est disponible à partir du plan Confort.", upgrade: true },
        { status: 403 }
      );
    }

    const serviceClient = createServiceRoleClient();
    const profile = await getOwnerProfile(serviceClient, user.id);
    const ownerId = profile.id;

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const entityId = searchParams.get("entityId");
    const category = searchParams.get("category");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = serviceClient
      .from("expenses")
      .select(`
        id, category, description, montant, montant_ttc, tva_montant, tva_taux,
        date_depense, fournisseur, deductible, recurrence, statut, notes,
        property_id, legal_entity_id, created_at,
        property:properties(id, adresse_complete)
      `)
      .eq("owner_profile_id", ownerId)
      .neq("statut", "cancelled")
      .gte("date_depense", `${year}-01-01`)
      .lte("date_depense", `${year}-12-31`)
      .order("date_depense", { ascending: false });

    if (entityId === "personal") {
      query = query.is("legal_entity_id", null);
    } else if (entityId && entityId !== "all") {
      query = query.eq("legal_entity_id", entityId);
    }

    if (category && EXPENSE_CATEGORIES.includes(category as any)) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      expenses: data || [],
      categories: CATEGORY_LABELS,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST — Créer une dépense
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const hasAccess = await userHasFeature(user.id, "bank_reconciliation");
    if (!hasAccess) {
      return NextResponse.json(
        { error: "La comptabilité est disponible à partir du plan Confort.", upgrade: true },
        { status: 403 }
      );
    }

    const serviceClient = createServiceRoleClient();
    const profile = await getOwnerProfile(serviceClient, user.id);
    const ownerId = profile.id;

    const body = await request.json();

    // Validation
    if (!body.description || typeof body.description !== "string") {
      throw new ApiError(400, "La description est requise");
    }
    if (!body.montant || typeof body.montant !== "number" || body.montant <= 0) {
      throw new ApiError(400, "Le montant doit être positif");
    }
    if (!body.category || !EXPENSE_CATEGORIES.includes(body.category)) {
      throw new ApiError(400, "Catégorie invalide");
    }
    if (!body.date_depense) {
      throw new ApiError(400, "La date est requise");
    }

    const { data: expense, error } = await serviceClient
      .from("expenses")
      .insert({
        owner_profile_id: ownerId,
        legal_entity_id: body.legal_entity_id || null,
        property_id: body.property_id || null,
        lease_id: body.lease_id || null,
        category: body.category,
        description: body.description,
        montant: body.montant,
        date_depense: body.date_depense,
        fournisseur: body.fournisseur || null,
        tva_taux: body.tva_taux || 0,
        tva_montant: body.tva_montant || 0,
        deductible: body.deductible !== false,
        recurrence: body.recurrence || "ponctuel",
        notes: body.notes || null,
        created_by: ownerId,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
