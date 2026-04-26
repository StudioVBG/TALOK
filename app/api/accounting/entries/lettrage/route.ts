/**
 * API Route: Manual lettrage of accounting entry lines
 * POST /api/accounting/entries/lettrage
 *
 * Marks 2+ entry lines with the same lettrage code so the user can
 * pair receivables with their settlements (e.g. clear a 411xxx debit
 * with a 411xxx credit produced by rent_payment_clearing).
 *
 * Requires balanced selection: sum(debit) = sum(credit) across the
 * provided line ids — the engine helper enforces this.
 *
 * Auth:
 *  - admin: any line
 *  - owner: only lines belonging to entities they own
 *  - others: 403
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { applyLettrage, removeLettrage } from "@/lib/accounting/engine";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  line_ids: z.array(z.string().uuid()).min(1, "Au moins 1 ligne requise"),
  // null/empty → délettrage (retire le code) ; valeur → applique le code
  lettrage_code: z
    .union([
      z
        .string()
        .min(1)
        .max(8)
        .regex(/^[A-Z0-9]+$/i, "Code alphanumerique uniquement"),
      z.literal(""),
      z.null(),
    ])
    .optional(),
});

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

    if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
      throw new ApiError(403, "Non autorise");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = BodySchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { line_ids, lettrage_code } = validation.data;
    const isDelettrage = !lettrage_code;
    if (!isDelettrage && line_ids.length < 2) {
      throw new ApiError(400, "Le lettrage requiert au moins 2 lignes");
    }

    // Ownership check for non-admin: every line must belong to an entity
    // the caller owns.
    if (profile.role !== "admin") {
      const { data: lines } = await supabase
        .from("accounting_entry_lines")
        .select("id, accounting_entries!inner(entity_id)")
        .in("id", line_ids);

      const lineRows = (lines ?? []) as Array<{
        id: string;
        accounting_entries:
          | { entity_id: string }
          | { entity_id: string }[];
      }>;

      const entityIds = Array.from(
        new Set(
          lineRows
            .map((l) =>
              Array.isArray(l.accounting_entries)
                ? l.accounting_entries[0]?.entity_id
                : l.accounting_entries?.entity_id,
            )
            .filter(Boolean) as string[],
        ),
      );

      if (entityIds.length > 0) {
        const { data: owned } = await supabase
          .from("legal_entities")
          .select("id")
          .in("id", entityIds)
          .eq("owner_profile_id", profile.id);

        const ownedSet = new Set(
          ((owned ?? []) as Array<{ id: string }>).map((e) => e.id),
        );
        const unauthorized = entityIds.filter((id) => !ownedSet.has(id));
        if (unauthorized.length > 0) {
          throw new ApiError(403, "Acces refuse a certaines lignes");
        }
      }
    }

    if (isDelettrage) {
      await removeLettrage(supabase, line_ids);
      return NextResponse.json({
        success: true,
        data: { line_count: line_ids.length, lettrage_code: null },
      });
    }

    const code = (lettrage_code as string).toUpperCase();
    await applyLettrage(supabase, line_ids, code);
    return NextResponse.json({
      success: true,
      data: { line_count: line_ids.length, lettrage_code: code },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/accounting/entries/lettrage
 *
 * Délettrage : retire le code de lettrage des lignes fournies. Pas de
 * check d'équilibre car c'est une opération neutre côté solde.
 *
 * Body : { line_ids: string[] }
 */
const DeleteSchema = z.object({
  line_ids: z.array(z.string().uuid()).min(1, "Au moins 1 ligne requise"),
});

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
      throw new ApiError(403, "Non autorise");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = DeleteSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }
    const { line_ids } = validation.data;

    if (profile.role !== "admin") {
      const { data: lines } = await supabase
        .from("accounting_entry_lines")
        .select("id, accounting_entries!inner(entity_id)")
        .in("id", line_ids);

      const lineRows = (lines ?? []) as Array<{
        id: string;
        accounting_entries:
          | { entity_id: string }
          | { entity_id: string }[];
      }>;
      const entityIds = Array.from(
        new Set(
          lineRows
            .map((l) =>
              Array.isArray(l.accounting_entries)
                ? l.accounting_entries[0]?.entity_id
                : l.accounting_entries?.entity_id,
            )
            .filter(Boolean) as string[],
        ),
      );
      if (entityIds.length > 0) {
        const { data: owned } = await supabase
          .from("legal_entities")
          .select("id")
          .in("id", entityIds)
          .eq("owner_profile_id", profile.id);
        const ownedSet = new Set(
          ((owned ?? []) as Array<{ id: string }>).map((e) => e.id),
        );
        const unauthorized = entityIds.filter((id) => !ownedSet.has(id));
        if (unauthorized.length > 0) {
          throw new ApiError(403, "Acces refuse a certaines lignes");
        }
      }
    }

    await removeLettrage(supabase, line_ids);

    return NextResponse.json({
      success: true,
      data: { line_count: line_ids.length },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
