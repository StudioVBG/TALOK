/**
 * API Route: Comptabilisation acquisition d'un bien
 * POST /api/accounting/property-acquisitions
 *
 * Permet au propriétaire de saisir le prix d'achat d'un bien et le
 * financement (emprunt vs apport). L'endpoint :
 *   1. Vérifie les permissions (propriétaire de l'entité ou admin)
 *   2. Appelle ensurePropertyAcquisitionEntry qui pose l'écriture
 *      composée (D 211/213/214/215 - C 164/512) selon la décomposition
 *      standard PCG bailleur (15% terrain + 85% amortissable)
 *   3. Retourne l'entryId + le détail des composants calculés
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { ensurePropertyAcquisitionEntry } from "@/lib/accounting/property-acquisition-entry";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateAcquisitionSchema = z.object({
  property_id: z.string().uuid(),
  total_cents: z.number().int().positive(),
  loan_cents: z.number().int().min(0),
  acquisition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  terrain_pct: z.number().min(0).max(50).optional(),
  bank_account: z.string().min(3).max(10).optional(),
  loan_account: z.string().min(3).max(10).optional(),
}).refine((d) => d.loan_cents <= d.total_cents, {
  message: "L'emprunt ne peut pas dépasser le prix d'acquisition",
});

/**
 * POST /api/accounting/property-acquisitions
 */
export async function POST(request: Request) {
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
    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Réservé aux propriétaires");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = CreateAcquisitionSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }
    const data = validation.data;

    // Vérifie l'ownership du bien
    const { data: prop } = await serviceClient
      .from("properties")
      .select("id, owner_id, legal_entity_id")
      .eq("id", data.property_id)
      .maybeSingle();

    if (!prop) throw new ApiError(404, "Bien non trouvé");

    const propRow = prop as { id: string; owner_id: string; legal_entity_id: string | null };
    if (profile.role !== "admin" && propRow.owner_id !== profile.id) {
      throw new ApiError(403, "Ce bien ne vous appartient pas");
    }
    if (!propRow.legal_entity_id) {
      throw new ApiError(
        400,
        "Le bien n'est pas rattaché à une entité juridique — ajoutez-lui une legal_entity avant de comptabiliser l'acquisition",
      );
    }

    const result = await ensurePropertyAcquisitionEntry(
      serviceClient as any,
      {
        propertyId: data.property_id,
        totalCents: data.total_cents,
        loanCents: data.loan_cents,
        acquisitionDate: data.acquisition_date,
        terrainPct: data.terrain_pct,
        bankAccount: data.bank_account,
        loanAccount: data.loan_account,
        userId: user.id,
      },
    );

    if (!result.created) {
      const status =
        result.skippedReason === "already_exists" ? 409 :
        result.skippedReason === "property_not_found" ? 404 :
        result.skippedReason === "entity_not_resolved" ? 400 :
        result.skippedReason === "accounting_disabled" ? 403 :
        result.skippedReason === "amount_invalid" ? 400 :
        500;
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? `Échec : ${result.skippedReason}`,
          skippedReason: result.skippedReason,
          existingEntryId: result.entryId,
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          entryId: result.entryId,
          components: result.components,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
