/**
 * API Route: Regularisation des charges (Sprint 4)
 * POST /api/accounting/regularization - Cree une regularisation avec ecritures comptables
 * GET /api/accounting/regularization - Liste les regularisations par exercice
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { createEntry, validateEntry } from "@/lib/accounting/engine";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounting/regularization
 *
 * Query params:
 * - entityId: string (requis)
 * - propertyId: string (optionnel) - filtre par bien
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "charges");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const propertyId = searchParams.get("propertyId");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    // Validation cross-entity : vérifier que l'utilisateur possède bien
    // l'entité demandée. Sans ce check, un owner pouvait passer n'importe
    // quel entityId UUID dans la query string et lire les régularisations
    // d'une autre SCI (cf. pattern dans accounting/entries/route.ts).
    const isAdmin =
      profile.role === "admin" || profile.role === "platform_admin";
    if (!isAdmin) {
      const { data: entity } = await supabase
        .from("legal_entities")
        .select("id")
        .eq("id", entityId)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) {
        throw new ApiError(403, "Accès refusé à cette entité");
      }
    }

    let query = supabase
      .from("charge_regularizations")
      .select("*")
      .eq("entity_id", entityId)
      .order("exercise_year", { ascending: false });

    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    const { data: regularizations, error } = await query;

    if (error) {
      throw new ApiError(500, `Erreur lors de la recuperation: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: regularizations ?? [],
      meta: {
        entity_id: entityId,
        count: regularizations?.length ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/regularization
 *
 * Body:
 * - entityId: string
 * - propertyId: string
 * - leaseId?: string
 * - exerciseYear: number
 * - provisionsPaidCents: number (provisions versees par le locataire)
 * - actualRecoverableCents: number (charges reelles recuperables)
 * - actualNonRecoverableCents: number (charges reelles non recuperables)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "charges");
    if (featureGate) return featureGate;

    if (profile.role !== "owner" && profile.role !== "admin") {
      throw new ApiError(403, "Seuls les proprietaires peuvent creer des regularisations");
    }

    const body = await request.json();
    const {
      entityId,
      propertyId,
      leaseId,
      exerciseYear,
      provisionsPaidCents,
      actualRecoverableCents,
      actualNonRecoverableCents,
    } = body;

    if (!entityId || !propertyId || !exerciseYear) {
      throw new ApiError(400, "entityId, propertyId et exerciseYear sont requis");
    }

    // Validation cross-entity (cf. GET) — un owner ne doit pas pouvoir
    // créer une régularisation sur une SCI qu'il ne possède pas.
    const isAdmin =
      profile.role === "admin" || profile.role === "platform_admin";
    if (!isAdmin) {
      const { data: entity } = await supabase
        .from("legal_entities")
        .select("id")
        .eq("id", entityId)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) {
        throw new ApiError(403, "Accès refusé à cette entité");
      }
    }

    if (
      typeof provisionsPaidCents !== "number" ||
      typeof actualRecoverableCents !== "number" ||
      typeof actualNonRecoverableCents !== "number"
    ) {
      throw new ApiError(400, "Les montants doivent etre des nombres entiers en centimes");
    }

    // Calculate balance: positive = tenant overpaid, negative = tenant owes more
    const balanceCents = provisionsPaidCents - actualRecoverableCents;

    // Get or create exercise for the entity
    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    const today = new Date().toISOString().split("T")[0];

    const entries: string[] = [];

    // Entry a) Charges recuperees: D:614100 / C:708000
    if (actualRecoverableCents > 0) {
      const entryA = await createEntry(supabase, {
        entityId,
        exerciseId: exercise.id,
        journalCode: "OD",
        entryDate: today,
        label: `Regularisation charges recuperables ${exerciseYear}`,
        source: "auto:charge_regularization",
        reference: `REG-${exerciseYear}-${propertyId.slice(0, 8)}`,
        userId: profile.id,
        lines: [
          {
            accountNumber: "614100",
            debitCents: actualRecoverableCents,
            creditCents: 0,
            label: "Charges reelles recuperables",
          },
          {
            accountNumber: "708000",
            debitCents: 0,
            creditCents: actualRecoverableCents,
            label: "Charges recuperees sur locataire",
          },
        ],
      });
      await validateEntry(supabase, entryA.id, profile.id);
      entries.push(entryA.id);
    }

    // Entry b) Charges non recuperables: D:614200 / C:512100
    if (actualNonRecoverableCents > 0) {
      const entryB = await createEntry(supabase, {
        entityId,
        exerciseId: exercise.id,
        journalCode: "OD",
        entryDate: today,
        label: `Charges non recuperables ${exerciseYear}`,
        source: "auto:charge_regularization",
        reference: `REG-NR-${exerciseYear}-${propertyId.slice(0, 8)}`,
        userId: profile.id,
        lines: [
          {
            accountNumber: "614200",
            debitCents: actualNonRecoverableCents,
            creditCents: 0,
            label: "Charges non recuperables",
          },
          {
            accountNumber: "512100",
            debitCents: 0,
            creditCents: actualNonRecoverableCents,
            label: "Reglement charges non recuperables",
          },
        ],
      });
      await validateEntry(supabase, entryB.id, profile.id);
      entries.push(entryB.id);
    }

    // Insert charge_regularizations record
    const { data: regularization, error: insertError } = await supabase
      .from("charge_regularizations")
      .insert({
        entity_id: entityId,
        property_id: propertyId,
        lease_id: leaseId ?? null,
        exercise_year: exerciseYear,
        provisions_paid_cents: provisionsPaidCents,
        actual_recoverable_cents: actualRecoverableCents,
        actual_non_recoverable_cents: actualNonRecoverableCents,
        balance_cents: balanceCents,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new ApiError(500, `Erreur lors de l'insertion: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        regularizationId: regularization.id,
        balanceCents,
        entries,
      },
      meta: {
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
