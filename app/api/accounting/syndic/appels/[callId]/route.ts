// @ts-nocheck
/**
 * API Route: Syndic Copropriété — Fund Call Detail
 * GET  /api/accounting/syndic/appels/[callId]  - Get call with lines
 * POST /api/accounting/syndic/appels/[callId]  - Actions: send, payment
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { createEntry } from "@/lib/accounting/engine";
import { getCoproAccount } from "@/lib/accounting/syndic/fund-calls";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ callId: string }>;
}

const PaymentSchema = z.object({
  action: z.literal("payment"),
  lineId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const SendSchema = z.object({
  action: z.literal("send"),
});

/**
 * GET /api/accounting/syndic/appels/[callId]
 */
export async function GET(_request: Request, context: Context) {
  try {
    const { callId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    // Load fund call
    const { data: call, error: callError } = await (supabase as any)
      .from("copro_fund_calls")
      .select("*")
      .eq("id", callId)
      .single();

    if (callError || !call) {
      throw new ApiError(404, "Appel de fonds non trouve");
    }

    // Load call lines
    const { data: lines, error: linesError } = await (supabase as any)
      .from("copro_fund_call_lines")
      .select("*, copro_lots(lot_number, lot_type, surface_m2)")
      .eq("call_id", callId)
      .order("owner_name");

    if (linesError) {
      throw new ApiError(
        500,
        `Erreur chargement lignes: ${linesError.message}`,
      );
    }

    // Calculate totals
    const totalCalled = (lines ?? []).reduce(
      (sum: number, l: any) => sum + (l.amount_cents as number),
      0,
    );
    const totalPaid = (lines ?? []).reduce(
      (sum: number, l: any) => sum + (l.paid_cents as number),
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        ...call,
        lines: lines ?? [],
        totals: {
          calledCents: totalCalled,
          paidCents: totalPaid,
          remainingCents: totalCalled - totalPaid,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/syndic/appels/[callId]
 * Actions:
 *   - { action: "send" } — Mark call as sent
 *   - { action: "payment", lineId, amountCents, paymentDate? } — Record payment
 */
export async function POST(request: Request, context: Context) {
  try {
    const { callId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const action = body.action;

    // Load fund call
    const { data: call, error: callError } = await (supabase as any)
      .from("copro_fund_calls")
      .select("*")
      .eq("id", callId)
      .single();

    if (callError || !call) {
      throw new ApiError(404, "Appel de fonds non trouve");
    }

    // ---- SEND ACTION ----
    if (action === "send") {
      SendSchema.parse(body);

      const { data: updated, error } = await (supabase as any)
        .from("copro_fund_calls")
        .update({
          status: "sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", callId)
        .select()
        .single();

      if (error) {
        throw new ApiError(500, `Erreur envoi appel: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        message: "Appel de fonds marque comme envoye",
        data: updated,
      });
    }

    // ---- PAYMENT ACTION ----
    if (action === "payment") {
      const validation = PaymentSchema.safeParse(body);
      if (!validation.success) {
        throw new ApiError(400, validation.error.errors[0].message);
      }

      const { lineId, amountCents, paymentDate } = validation.data;
      const payDate = paymentDate ?? new Date().toISOString().split("T")[0];

      // Load the call line
      const { data: line, error: lineError } = await (supabase as any)
        .from("copro_fund_call_lines")
        .select("*, copro_lots(lot_number, owner_name)")
        .eq("id", lineId)
        .eq("call_id", callId)
        .single();

      if (lineError || !line) {
        throw new ApiError(404, "Ligne d'appel non trouvee");
      }

      const currentPaid = line.paid_cents as number;
      const totalAmount = line.amount_cents as number;
      const newPaid = currentPaid + amountCents;

      if (newPaid > totalAmount) {
        throw new ApiError(
          400,
          `Le paiement depasse le montant appele. Montant restant: ${totalAmount - currentPaid} centimes`,
        );
      }

      // Determine new payment status
      let paymentStatus: string;
      if (newPaid >= totalAmount) {
        paymentStatus = "paid";
      } else if (newPaid > 0) {
        paymentStatus = "partial";
      } else {
        paymentStatus = "pending";
      }

      // Update call line
      const { error: updateErr } = await (supabase as any)
        .from("copro_fund_call_lines")
        .update({
          paid_cents: newPaid,
          payment_status: paymentStatus,
          paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", lineId);

      if (updateErr) {
        throw new ApiError(
          500,
          `Erreur mise a jour paiement: ${updateErr.message}`,
        );
      }

      // Create accounting entry: D:512000 Banque / C:4500XX Coproprietaire
      const lotNumber = (line.copro_lots as unknown as { lot_number: string })
        ?.lot_number ?? "000";
      const ownerName = line.owner_name as string;
      const coproAccount = getCoproAccount(lotNumber);
      const entityId = call.entity_id as string;
      const exerciseId = call.exercise_id as string | null;

      if (!exerciseId) {
        throw new ApiError(400, "Appel de fonds sans exercice associe — impossible de creer l'ecriture");
      }

      await createEntry(supabase, {
        entityId,
        exerciseId,
        journalCode: "BQ",
        entryDate: payDate,
        label: `Paiement appel de fonds — ${ownerName} (lot ${lotNumber})`,
        source: "auto:copro_payment",
        reference: `AF-${callId}`,
        userId: user.id,
        lines: [
          {
            accountNumber: "512000",
            debitCents: amountCents,
            creditCents: 0,
          },
          {
            accountNumber: coproAccount,
            debitCents: 0,
            creditCents: amountCents,
          },
        ],
      });

      // Update parent call status based on all lines
      const { data: allLines } = await (supabase as any)
        .from("copro_fund_call_lines")
        .select("amount_cents, paid_cents")
        .eq("call_id", callId);

      if (allLines) {
        const totalCalledAll = allLines.reduce(
          (s: number, l: any) => s + (l.amount_cents as number),
          0,
        );
        const totalPaidAll = allLines.reduce(
          (s: number, l: any) => s + (l.paid_cents as number),
          0,
        );

        let callStatus: string;
        if (totalPaidAll >= totalCalledAll) {
          callStatus = "paid";
        } else if (totalPaidAll > 0) {
          callStatus = "partial";
        } else {
          callStatus = "pending";
        }

        await (supabase as any)
          .from("copro_fund_calls")
          .update({
            payment_status: callStatus,
            paid_amount_cents: totalPaidAll,
            paid_at:
              callStatus === "paid" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", callId);
      }

      return NextResponse.json({
        success: true,
        message: `Paiement de ${amountCents} centimes enregistre pour ${ownerName}`,
        data: {
          lineId,
          newPaidCents: newPaid,
          paymentStatus,
          accountingEntry: `D:512000 / C:${coproAccount}`,
        },
      });
    }

    throw new ApiError(
      400,
      "Action invalide. Utilisez 'send' ou 'payment'",
    );
  } catch (error) {
    return handleApiError(error);
  }
}
