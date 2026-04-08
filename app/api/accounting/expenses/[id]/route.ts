/**
 * API Route: Expense detail (GET / PUT / DELETE)
 * /api/accounting/expenses/[id]
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
 * GET — Détail d'une dépense
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const hasAccess = await userHasFeature(user.id, "bank_reconciliation");
    if (!hasAccess) {
      return NextResponse.json({ error: "Plan insuffisant", upgrade: true }, { status: 403 });
    }

    const serviceClient = createServiceRoleClient();
    const profile = await getOwnerProfile(serviceClient, user.id);

    const { data, error } = await serviceClient
      .from("expenses")
      .select(`*, property:properties(id, adresse_complete)`)
      .eq("id", id)
      .eq("owner_profile_id", profile.id)
      .single();

    if (error || !data) throw new ApiError(404, "Dépense introuvable");

    return NextResponse.json({ expense: data });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT — Modifier une dépense
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const hasAccess = await userHasFeature(user.id, "bank_reconciliation");
    if (!hasAccess) {
      return NextResponse.json({ error: "Plan insuffisant", upgrade: true }, { status: 403 });
    }

    const serviceClient = createServiceRoleClient();
    const profile = await getOwnerProfile(serviceClient, user.id);

    // Verify ownership
    const { data: existing } = await serviceClient
      .from("expenses")
      .select("id")
      .eq("id", id)
      .eq("owner_profile_id", profile.id)
      .single();
    if (!existing) throw new ApiError(404, "Dépense introuvable");

    const body = await request.json();

    // Only update provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    if (body.description !== undefined) update.description = body.description;
    if (body.montant !== undefined) update.montant = body.montant;
    if (body.category !== undefined) update.category = body.category;
    if (body.date_depense !== undefined) update.date_depense = body.date_depense;
    if (body.fournisseur !== undefined) update.fournisseur = body.fournisseur;
    if (body.property_id !== undefined) update.property_id = body.property_id;
    if (body.legal_entity_id !== undefined) update.legal_entity_id = body.legal_entity_id;
    if (body.tva_taux !== undefined) update.tva_taux = body.tva_taux;
    if (body.tva_montant !== undefined) update.tva_montant = body.tva_montant;
    if (body.deductible !== undefined) update.deductible = body.deductible;
    if (body.recurrence !== undefined) update.recurrence = body.recurrence;
    if (body.notes !== undefined) update.notes = body.notes;
    if (body.statut !== undefined) update.statut = body.statut;

    const { data, error } = await (serviceClient as any)
      .from("expenses")
      .update(update)
      .eq("id", id)
      .eq("owner_profile_id", profile.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ expense: data });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE — Annuler une dépense (soft delete → statut=cancelled)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const hasAccess = await userHasFeature(user.id, "bank_reconciliation");
    if (!hasAccess) {
      return NextResponse.json({ error: "Plan insuffisant", upgrade: true }, { status: 403 });
    }

    const serviceClient = createServiceRoleClient();
    const profile = await getOwnerProfile(serviceClient, user.id);

    const { error } = await (serviceClient as any)
      .from("expenses")
      .update({ statut: "cancelled" })
      .eq("id", id)
      .eq("owner_profile_id", profile.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
