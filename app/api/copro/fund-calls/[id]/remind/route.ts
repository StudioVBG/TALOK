export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/copro/fund-calls/[id]/remind
 * Envoie une relance email pour un appel de fonds non payé
 * et enregistre la relance dans copro_overdue_notices.
 *
 * Body (optionnel) :
 *   { line_id?: string, recipient_email?: string }
 *   Si line_id absent : relance toutes les lignes en retard de l'appel.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import { sendEmail } from "@/lib/emails/resend.service";

interface FundCallLine {
  id: string;
  lot_id: string;
  owner_name: string | null;
  amount_cents: number;
  paid_cents: number;
  payment_status: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: callId } = await params;

  try {
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const targetLineId: string | undefined = body.line_id;
    const overrideEmail: string | undefined = body.recipient_email;

    const { data: call, error: callError } = await auth.serviceClient
      .from("copro_fund_calls")
      .select("id, site_id, period_label, due_date, total_amount_cents, total_amount, status")
      .eq("id", callId)
      .maybeSingle();

    if (callError || !call) {
      return NextResponse.json({ error: "Appel de fonds introuvable" }, { status: 404 });
    }

    // Vérification accès au site
    const siteCheck = await requireSyndic(request, { siteId: (call as { site_id: string }).site_id });
    if (siteCheck instanceof NextResponse) return siteCheck;

    let linesQuery = auth.serviceClient
      .from("copro_fund_call_lines")
      .select("id, lot_id, owner_name, amount_cents, paid_cents, payment_status")
      .eq("call_id", callId);

    if (targetLineId) {
      linesQuery = linesQuery.eq("id", targetLineId);
    } else {
      linesQuery = linesQuery.in("payment_status", ["pending", "partial", "overdue"]);
    }

    const { data: lines, error: linesError } = await linesQuery;
    if (linesError) {
      return NextResponse.json({ error: linesError.message }, { status: 500 });
    }

    const overdueLines = (lines ?? []) as unknown as FundCallLine[];
    if (overdueLines.length === 0) {
      return NextResponse.json({ sent: 0, message: "Aucune ligne à relancer" });
    }

    const dueDate = (call as { due_date: string | null }).due_date;
    const periodLabel = (call as { period_label: string | null }).period_label ?? "—";
    const daysLate = dueDate
      ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    let sentCount = 0;
    const noticesToInsert: Array<Record<string, unknown>> = [];

    for (const line of overdueLines) {
      const remaining = Math.max(0, line.amount_cents - line.paid_cents);
      if (remaining === 0) continue;

      const recipient = overrideEmail || `lot-${line.lot_id}@example.invalid`;
      try {
        if (overrideEmail) {
          await sendEmail({
            to: overrideEmail,
            subject: `Relance — Appel de fonds ${periodLabel}`,
            html: `<p>Bonjour ${line.owner_name ?? "Madame, Monsieur"},</p>
                   <p>Nous vous rappelons que l'appel de fonds <strong>${periodLabel}</strong> reste impayé pour un montant de
                   <strong>${(remaining / 100).toFixed(2)} €</strong>${dueDate ? ` (échéance du ${new Date(dueDate).toLocaleDateString("fr-FR")})` : ""}.</p>
                   <p>Merci de procéder au règlement dans les meilleurs délais.</p>
                   <p>Cordialement,<br/>Votre syndic</p>`,
            text: `Relance amiable — Appel de fonds ${periodLabel} — Montant dû : ${(remaining / 100).toFixed(2)} €`,
            tags: [{ name: "type", value: "copro_overdue_reminder" }],
          });
        }
        sentCount += 1;
      } catch (err) {
        console.error("[fund-calls/remind] email error", err);
      }

      noticesToInsert.push({
        site_id: (call as { site_id: string }).site_id,
        fund_call_id: callId,
        fund_call_line_id: line.id,
        lot_id: line.lot_id,
        notice_type: "reminder",
        channel: overrideEmail ? "email" : "in_app",
        recipient_name: line.owner_name,
        recipient_email: overrideEmail ?? null,
        amount_due_cents: remaining,
        days_late: daysLate,
        message: `Relance amiable pour l'appel ${periodLabel}`,
        sent_by_user_id: auth.user.id,
        sent_by_profile_id: auth.profile.id,
      });

      // Met à jour les compteurs sur la ligne
      await auth.serviceClient
        .from("copro_fund_call_lines")
        .update({
          last_reminder_at: new Date().toISOString(),
        })
        .eq("id", line.id);
    }

    if (noticesToInsert.length) {
      const { error: insertError } = await auth.serviceClient
        .from("copro_overdue_notices")
        .insert(noticesToInsert);
      if (insertError) {
        console.error("[fund-calls/remind] insert error", insertError);
      }
    }

    return NextResponse.json({
      sent: sentCount,
      logged: noticesToInsert.length,
    });
  } catch (error) {
    console.error("[fund-calls/remind:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
