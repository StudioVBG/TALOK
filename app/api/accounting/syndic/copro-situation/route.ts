/**
 * API Route: Syndic Copropriété — Copropriétaire Situation
 * GET /api/accounting/syndic/copro-situation?profileId=xxx
 *
 * Returns the financial situation for a copropriétaire:
 * - Their lots
 * - Fund calls and payments per lot
 * - Balance per lot
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { getCoproAccount } from "@/lib/accounting/syndic/fund-calls";

export const dynamic = "force-dynamic";

interface LotSituation {
  lotId: string;
  lotNumber: string;
  lotType: string;
  tantiemes: number;
  surfaceM2: number | null;
  coproAccount: string;
  calls: Array<{
    callId: string;
    lineId: string;
    periodLabel: string | null;
    callDate: string;
    dueDate: string;
    amountCents: number;
    paidCents: number;
    paymentStatus: string;
  }>;
  totalCalledCents: number;
  totalPaidCents: number;
  balanceCents: number;
}

/**
 * GET /api/accounting/syndic/copro-situation?profileId=xxx
 */
export async function GET(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      throw new ApiError(400, "profileId est requis");
    }

    // Find lots where owner_profile_id matches
    const { data: lots, error: lotsError } = await (supabase as any)
      .from("copro_lots")
      .select("*")
      .eq("owner_profile_id", profileId)
      .eq("is_active", true)
      .order("lot_number");

    if (lotsError) {
      throw new ApiError(500, `Erreur chargement lots: ${lotsError.message}`);
    }

    if (!lots || lots.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          profileId,
          lots: [],
          totalCalledCents: 0,
          totalPaidCents: 0,
          globalBalanceCents: 0,
        },
      });
    }

    const lotSituations: LotSituation[] = [];

    for (const lot of lots) {
      const lotId = lot.id as string;
      const lotNumber = lot.lot_number as string;
      const coproAccount = getCoproAccount(lotNumber);

      // Get all call lines for this lot
      const { data: callLines } = await supabase
        .from("copro_fund_call_lines")
        .select(
          `
          id,
          amount_cents,
          paid_cents,
          payment_status,
          copro_fund_calls!inner(
            id,
            call_date,
            due_date,
            period_label
          )
        `,
        )
        .eq("lot_id", lotId)
        .order("created_at");

      const calls = (callLines ?? []).map((line) => {
        const callData = line.copro_fund_calls as unknown as {
          id: string;
          call_date: string;
          due_date: string;
          period_label: string | null;
        };

        return {
          callId: callData.id,
          lineId: line.id as string,
          periodLabel: callData.period_label,
          callDate: callData.call_date,
          dueDate: callData.due_date,
          amountCents: line.amount_cents as number,
          paidCents: line.paid_cents as number,
          paymentStatus: line.payment_status as string,
        };
      });

      const totalCalledCents = calls.reduce(
        (s, c) => s + c.amountCents,
        0,
      );
      const totalPaidCents = calls.reduce((s, c) => s + c.paidCents, 0);

      lotSituations.push({
        lotId,
        lotNumber,
        lotType: lot.lot_type as string,
        tantiemes: lot.tantiemes_generaux as number,
        surfaceM2: lot.surface_m2 as number | null,
        coproAccount,
        calls,
        totalCalledCents,
        totalPaidCents,
        balanceCents: totalCalledCents - totalPaidCents,
      });
    }

    const globalCalled = lotSituations.reduce(
      (s, l) => s + l.totalCalledCents,
      0,
    );
    const globalPaid = lotSituations.reduce(
      (s, l) => s + l.totalPaidCents,
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        profileId,
        lots: lotSituations,
        totalCalledCents: globalCalled,
        totalPaidCents: globalPaid,
        globalBalanceCents: globalCalled - globalPaid,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
