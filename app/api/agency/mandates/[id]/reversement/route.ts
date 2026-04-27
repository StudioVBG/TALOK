export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ensureMandantReversementEntry } from "@/lib/accounting/mandant-reversement-entry";

/**
 * POST /api/agency/mandates/[id]/reversement
 *
 * Pose l'écriture comptable du reversement net au propriétaire mandant
 * (D 467 / C 545) et décrémente le solde de
 * `agency_mandant_accounts.balance_cents`.
 *
 * Body : { amountCents: number, date?: 'YYYY-MM-DD', bankRef?: string,
 *          force?: boolean }
 *
 *   - amountCents : montant en cents, doit être > 0 et ≤ balance courante
 *     sauf si `force=true` (qui autorise une balance négative — avance
 *     agence rare).
 *   - date : date du virement, défaut aujourd'hui.
 *   - bankRef : référence du virement bancaire, utilisée pour
 *     l'idempotence si fournie. Sinon idempotence dérivée de
 *     `${mandateId}:${date}:${amountCents}` — suffisant pour bloquer
 *     les double-clics mais pas les reversements identiques au même
 *     jour.
 *
 * Auth : agency role uniquement, et le mandat doit appartenir à
 * l'agence connectée.
 */
const BodySchema = z.object({
  amountCents: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bankRef: z.string().min(1).max(100).optional(),
  force: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: mandateId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "agency") {
      return NextResponse.json(
        { error: "Acces reserve aux agences" },
        { status: 403 },
      );
    }

    // Vérifier que le mandat appartient à l'agence connectée.
    const { data: mandate } = await supabase
      .from("agency_mandates")
      .select("id, agency_profile_id, status, mandate_number")
      .eq("id", mandateId)
      .single();

    if (!mandate || mandate.agency_profile_id !== profile.id) {
      return NextResponse.json(
        { error: "Mandat non trouve" },
        { status: 404 },
      );
    }

    if (mandate.status === "terminated") {
      return NextResponse.json(
        { error: "Mandat resilie — impossible de poser un reversement" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 },
      );
    }
    const { amountCents, date, bankRef, force } = parsed.data;

    // Référence d'idempotence : préférer la référence bancaire si
    // fournie (la plus stable). Sinon retomber sur un trigramme
    // mandateId/date/montant qui bloque les double-clics rapides à la
    // même date pour le même montant.
    const idempotencyKey =
      bankRef ??
      `${mandateId}:${date ?? new Date().toISOString().split("T")[0]}:${amountCents}`;

    const result = await ensureMandantReversementEntry(
      supabase,
      mandateId,
      amountCents,
      {
        idempotencyKey,
        date,
        userId: user.id,
        enforceSufficientBalance: force !== true,
      },
    );

    if (!result.created && result.skippedReason === "insufficient_balance") {
      return NextResponse.json(
        {
          error:
            "Solde mandant insuffisant. Utilisez `force: true` pour forcer (avance agence).",
          detail: result.error,
        },
        { status: 409 },
      );
    }

    if (!result.created && result.skippedReason !== "already_exists") {
      return NextResponse.json(
        {
          error: `Reversement non posé : ${result.skippedReason ?? "erreur inconnue"}`,
          detail: result.error,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        entryId: result.entryId,
        newBalanceCents: result.newBalanceCents,
        idempotent: result.skippedReason === "already_exists",
      },
    });
  } catch (error: unknown) {
    console.error("[agency/mandates/[id]/reversement]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}
