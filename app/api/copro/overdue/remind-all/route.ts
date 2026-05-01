export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/copro/overdue/remind-all
 * Relance en masse tous les copropriétaires en retard d'un site.
 *
 * Body :
 *   { site_id: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const siteId: string | undefined = body.site_id;
    if (!siteId) {
      return NextResponse.json({ error: "site_id requis" }, { status: 400 });
    }

    const auth = await requireSyndic(request, { siteId });
    if (auth instanceof NextResponse) return auth;

    // Récupère tous les appels du site
    const { data: calls } = await auth.serviceClient
      .from("copro_fund_calls")
      .select("id, site_id, period_label, due_date")
      .eq("site_id", siteId);

    const callIds = (calls ?? []).map((c: unknown) => (c as { id: string }).id);
    if (callIds.length === 0) {
      return NextResponse.json({ sent: 0, message: "Aucun appel de fonds" });
    }

    const { data: lines } = await auth.serviceClient
      .from("copro_fund_call_lines")
      .select("id, call_id, lot_id, owner_name, amount_cents, paid_cents, payment_status")
      .in("call_id", callIds)
      .in("payment_status", ["pending", "partial", "overdue"]);

    const overdueLines = lines ?? [];
    if (overdueLines.length === 0) {
      return NextResponse.json({ sent: 0, message: "Aucun impayé à relancer" });
    }

    const callMap = new Map(
      (calls ?? []).map((c: unknown) => [(c as { id: string }).id, c])
    );

    const noticesToInsert = overdueLines
      .map((line: unknown) => {
        const l = line as {
          id: string;
          call_id: string;
          lot_id: string;
          owner_name: string | null;
          amount_cents: number;
          paid_cents: number;
        };
        const remaining = Math.max(0, l.amount_cents - l.paid_cents);
        if (remaining === 0) return null;
        const call = callMap.get(l.call_id) as { due_date: string | null; period_label: string | null } | undefined;
        const daysLate = call?.due_date
          ? Math.max(0, Math.floor((Date.now() - new Date(call.due_date).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        return {
          site_id: siteId,
          fund_call_id: l.call_id,
          fund_call_line_id: l.id,
          lot_id: l.lot_id,
          notice_type: "reminder",
          channel: "in_app",
          recipient_name: l.owner_name,
          amount_due_cents: remaining,
          days_late: daysLate,
          message: `Relance groupée pour l'appel ${call?.period_label ?? ""}`,
          sent_by_user_id: auth.user.id,
          sent_by_profile_id: auth.profile.id,
        };
      })
      .filter((n: unknown): n is NonNullable<typeof n> => n !== null);

    if (noticesToInsert.length) {
      const { error: insertError } = await auth.serviceClient
        .from("copro_overdue_notices")
        .insert(noticesToInsert);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // Met à jour les last_reminder_at
      const lineIds = noticesToInsert.map((n: { fund_call_line_id: string }) => n.fund_call_line_id);
      await auth.serviceClient
        .from("copro_fund_call_lines")
        .update({ last_reminder_at: new Date().toISOString() })
        .in("id", lineIds);
    }

    return NextResponse.json({
      sent: noticesToInsert.length,
      total_amount_cents: noticesToInsert.reduce(
        (sum: number, n: { amount_due_cents: number }) => sum + n.amount_due_cents,
        0
      ),
    });
  } catch (error) {
    console.error("[overdue/remind-all:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
