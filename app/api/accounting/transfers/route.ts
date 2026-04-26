/**
 * API Route: Internal transfers (virements internes entre comptes bancaires
 * de la même entité comptable).
 *
 * GET  /api/accounting/transfers?entityId=...   List recent transfers
 * POST /api/accounting/transfers                Create a transfer
 *
 * Persistance : table `accounting_internal_transfers` qui sert de source
 * de vérité métier (date, montant, comptes, label, créateur). L'écriture
 * comptable double-entrée est posée par le bridge
 * `ensureInternalTransferEntry` après l'insert, idempotent via la
 * référence = transfer.id.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { ensureInternalTransferEntry } from "@/lib/accounting/internal-transfer-entry";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateTransferSchema = z.object({
  entity_id: z.string().uuid(),
  from_account_number: z.string().min(3).max(10),
  to_account_number: z.string().min(3).max(10),
  amount_cents: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().max(255).optional(),
}).refine((d) => d.from_account_number !== d.to_account_number, {
  message: "Les comptes source et destination doivent être différents",
});

/**
 * GET /api/accounting/transfers
 * Liste les virements internes récents pour l'entité, plus récents en tête.
 */
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

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
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

    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "50") || 50,
      200,
    );

    const { data, error } = await (serviceClient as any)
      .from("accounting_internal_transfers")
      .select("*")
      .eq("entity_id", entityId)
      .order("transfer_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new ApiError(500, "Erreur lecture virements");

    return NextResponse.json({ success: true, data: { transfers: data ?? [] } });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/transfers
 * Crée un virement interne et déclenche l'écriture comptable associée.
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
    const validation = CreateTransferSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }
    const data = validation.data;

    if (profile.role !== "admin") {
      const { data: entity } = await serviceClient
        .from("legal_entities")
        .select("id")
        .eq("id", data.entity_id)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) throw new ApiError(403, "Accès refusé à cette entité");
    }

    // 1. Insère le record métier.
    const { data: inserted, error: insertError } = await (serviceClient as any)
      .from("accounting_internal_transfers")
      .insert({
        entity_id: data.entity_id,
        from_account_number: data.from_account_number,
        to_account_number: data.to_account_number,
        amount_cents: data.amount_cents,
        transfer_date: data.date,
        label: data.label ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("[transfers] insert failed:", insertError);
      throw new ApiError(500, "Erreur création virement");
    }

    const transferId = (inserted as { id: string }).id;

    // 2. Pose les 2 écritures équilibrées via le bridge engine. Non
    // bloquant : si l'entité n'a pas activé la compta, on garde le
    // record métier et on retourne le succès au front.
    const entryResult = await ensureInternalTransferEntry(
      serviceClient as any,
      {
        entityId: data.entity_id,
        reference: transferId,
        fromAccountNumber: data.from_account_number,
        toAccountNumber: data.to_account_number,
        amountCents: data.amount_cents,
        date: data.date,
        label: data.label,
        userId: user.id,
      },
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          id: transferId,
          accounting: entryResult,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
