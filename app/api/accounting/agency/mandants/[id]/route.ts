/**
 * API Route: Agency Mandant Detail
 * GET   /api/accounting/agency/mandants/:id - Detail with properties, entries, CRGs
 * PATCH /api/accounting/agency/mandants/:id - Update commission_rate, is_active
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

const UpdateMandantSchema = z.object({
  commissionRate: z.number().min(0).max(100).optional(),
  commissionType: z.enum(["percentage", "fixed"]).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET — Mandant detail
// ---------------------------------------------------------------------------

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
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

    const featureGate = await requireAccountingAccess(profile.id, "crg");
    if (featureGate) return featureGate;

    // Fetch mandant
    const { data: mandant, error: mandantError } = await supabase
      .from("mandant_accounts")
      .select("*")
      .eq("id", id)
      .single();

    if (mandantError || !mandant) {
      throw new ApiError(404, "Mandant non trouve");
    }

    const entityId = mandant.entity_id as string;
    const accountNumber = mandant.sub_account_number as string;

    // Fetch properties linked to this mandant's owner entity
    const { data: properties } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => Promise<{ data: unknown }>;
        };
      };
    })
      .from("properties")
      .select("id, adresse_complete, ville, type, etat")
      .eq("owner_entity_id", mandant.owner_entity_id as string);

    // Fetch recent accounting entries related to this mandant
    const { data: recentEntries } = await (supabase as any)
      .from("accounting_entry_lines")
      .select(
        `
        id,
        account_number,
        label,
        debit_cents,
        credit_cents,
        accounting_entries!inner(
          id, entity_id, entry_number, entry_date, label, source, journal_code
        )
      `,
      )
      .eq("accounting_entries.entity_id", entityId)
      .eq("account_number", accountNumber)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch CRG reports for this mandant
    const { data: crgReports } = await (supabase as any)
      .from("crg_reports")
      .select("*")
      .eq("mandant_id", id)
      .order("period_end", { ascending: false })
      .limit(12);

    // Compute balance on sub-account
    const totalDebit = (recentEntries ?? []).reduce(
      (sum: number, l: any) => sum + ((l.debit_cents as number) || 0),
      0,
    );
    const totalCredit = (recentEntries ?? []).reduce(
      (sum: number, l: any) => sum + ((l.credit_cents as number) || 0),
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        mandant,
        properties: properties ?? [],
        recentEntries: (recentEntries ?? []).map((line: any) => ({
          lineId: line.id,
          accountNumber: line.account_number,
          lineLabel: line.label,
          debitCents: line.debit_cents,
          creditCents: line.credit_cents,
          entry: line.accounting_entries,
        })),
        crgReports: crgReports ?? [],
        balance: {
          subAccountNumber: accountNumber,
          totalDebitCents: totalDebit,
          totalCreditCents: totalCredit,
          soldeCents: totalDebit - totalCredit,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH — Update mandant
// ---------------------------------------------------------------------------

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
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

    const featureGate = await requireAccountingAccess(profile.id, "crg");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = UpdateMandantSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const updates: Record<string, unknown> = {};
    if (validation.data.commissionRate !== undefined) {
      updates.commission_rate = validation.data.commissionRate;
    }
    if (validation.data.commissionType !== undefined) {
      updates.commission_type = validation.data.commissionType;
    }
    if (validation.data.isActive !== undefined) {
      updates.is_active = validation.data.isActive;
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "Aucune donnee a mettre a jour");
    }

    updates.updated_at = new Date().toISOString();

    const { data: mandant, error } = await supabase
      .from("mandant_accounts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, `Erreur mise a jour mandant: ${error.message}`);
    }

    if (!mandant) {
      throw new ApiError(404, "Mandant non trouve");
    }

    return NextResponse.json({ success: true, data: mandant });
  } catch (error) {
    return handleApiError(error);
  }
}
