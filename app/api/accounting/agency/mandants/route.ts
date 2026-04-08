// @ts-nocheck
/**
 * API Route: Agency Mandants
 * POST /api/accounting/agency/mandants - Create a new mandant account
 * GET  /api/accounting/agency/mandants - List mandant accounts with stats
 *
 * Loi Hoguet: each mandant must have a dedicated sub-account 467XXX
 * and a separate bank tracking for funds held on behalf.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateMandantSchema = z.object({
  agencyEntityId: z.string().uuid(),
  ownerEntityId: z.string().uuid(),
  mandateRef: z.string().max(50).optional(),
  commissionRate: z.number().min(0).max(100),
  commissionType: z.enum(["percentage", "fixed"]),
});

// ---------------------------------------------------------------------------
// POST — Create mandant
// ---------------------------------------------------------------------------

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
      throw new ApiError(403, "Profil non trouve");
    }

    // Feature gate
    const featureGate = await requireAccountingAccess(profile.id, "crg");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = CreateMandantSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const {
      agencyEntityId,
      ownerEntityId,
      mandateRef,
      commissionRate,
      commissionType,
    } = validation.data;

    // Resolve owner name from legal_entities
    const { data: ownerEntity } = await supabase
      .from("legal_entities")
      .select("id, nom")
      .eq("id", ownerEntityId)
      .single();

    if (!ownerEntity) {
      throw new ApiError(404, "Entite proprietaire non trouvee");
    }

    // Find next available 467XXX number for this agency
    const { data: existingMandants } = await supabase
      .from("mandant_accounts")
      .select("id")
      .eq("entity_id", agencyEntityId)
      .order("created_at", { ascending: false });

    const mandantIndex = (existingMandants?.length ?? 0) + 1;
    const subAccountNumber = `467${String(mandantIndex).padStart(3, "0")}`;

    // Insert mandant account
    const { data: mandant, error: mandantError } = await supabase
      .from("mandant_accounts")
      .insert({
        entity_id: agencyEntityId,
        owner_entity_id: ownerEntityId,
        mandant_name: ownerEntity.nom,
        mandate_ref: mandateRef ?? null,
        commission_rate: commissionRate,
        commission_type: commissionType,
        sub_account_number: subAccountNumber,
        is_active: true,
      })
      .select()
      .single();

    if (mandantError) {
      throw new ApiError(
        500,
        `Erreur creation mandant: ${mandantError.message}`,
      );
    }

    // Auto-create sub-account 467XXX in chart_of_accounts
    const { error: chartError } = await (supabase as any)
      .from("chart_of_accounts")
      .upsert(
        {
          entity_id: agencyEntityId,
          account_number: subAccountNumber,
          label: `Mandant ${ownerEntity.nom}`,
          account_class: "4",
          account_type: "auxiliary",
          is_active: true,
        },
        { onConflict: "entity_id,account_number" },
      );

    if (chartError) {
      console.error(
        "[Agency Mandants] Chart of accounts insert error:",
        chartError,
      );
      // Non-blocking — mandant is already created
    }

    return NextResponse.json(
      { success: true, data: mandant },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// GET — List mandants with computed stats
// ---------------------------------------------------------------------------

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
      throw new ApiError(403, "Profil non trouve");
    }

    // Feature gate
    const featureGate = await requireAccountingAccess(profile.id, "crg");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const agencyEntityId = searchParams.get("agencyEntityId");

    if (!agencyEntityId) {
      throw new ApiError(400, "agencyEntityId est requis");
    }

    // Fetch active mandant accounts
    const { data: mandants, error } = await supabase
      .from("mandant_accounts")
      .select("*")
      .eq("entity_id", agencyEntityId)
      .eq("is_active", true)
      .order("mandant_name");

    if (error) {
      throw new ApiError(
        500,
        `Erreur chargement mandants: ${error.message}`,
      );
    }

    // Compute stats per mandant: total loyers & pending reversals
    const mandantsWithStats = await Promise.all(
      (mandants ?? []).map(async (mandant) => {
        const accountNumber = mandant.sub_account_number as string;

        // Total loyers: sum of credits on 706000 entries sourced from agency_loyer_mandant
        const { data: loyerEntries } = await (supabase as any)
          .from("accounting_entry_lines")
          .select(
            "credit_cents, accounting_entries!inner(entity_id, source)",
          )
          .eq("accounting_entries.entity_id", agencyEntityId)
          .eq("accounting_entries.source", "auto:agency_loyer_mandant")
          .eq("account_number", "706000");

        const totalLoyersCents = (loyerEntries ?? []).reduce(
          (sum: number, line: any) => sum + ((line.credit_cents as number) || 0),
          0,
        );

        // Pending reversals: current balance on 467XXX sub-account
        // (debit - credit on that account = amount due to mandant)
        const { data: subAccountLines } = await (supabase as any)
          .from("accounting_entry_lines")
          .select(
            "debit_cents, credit_cents, accounting_entries!inner(entity_id)",
          )
          .eq("accounting_entries.entity_id", agencyEntityId)
          .eq("account_number", accountNumber);

        const totalDebit = (subAccountLines ?? []).reduce(
          (sum: number, l: any) => sum + ((l.debit_cents as number) || 0),
          0,
        );
        const totalCredit = (subAccountLines ?? []).reduce(
          (sum: number, l: any) => sum + ((l.credit_cents as number) || 0),
          0,
        );
        const pendingReversalsCents = totalDebit - totalCredit;

        return {
          ...mandant,
          stats: {
            totalLoyersCents,
            pendingReversalsCents: Math.max(0, pendingReversalsCents),
          },
        };
      }),
    );

    return NextResponse.json({
      success: true,
      data: mandantsWithStats,
      meta: { count: mandantsWithStats.length },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
