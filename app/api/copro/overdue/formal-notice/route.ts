export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/copro/overdue/formal-notice
 * Envoie une mise en demeure (recommandé numérique) à un copropriétaire en retard.
 *
 * Body :
 *   { site_id: string, lot_id: string, fund_call_id?: string, recipient_email?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import { sendEmail } from "@/lib/emails/resend.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { site_id, lot_id, fund_call_id, recipient_email } = body as {
      site_id?: string;
      lot_id?: string;
      fund_call_id?: string;
      recipient_email?: string;
    };

    if (!site_id || !lot_id) {
      return NextResponse.json(
        { error: "site_id et lot_id requis" },
        { status: 400 }
      );
    }

    const auth = await requireSyndic(request, { siteId: site_id });
    if (auth instanceof NextResponse) return auth;

    // Récupère les lignes impayées du lot (sur tous les appels ou sur l'appel cible)
    let linesQuery = auth.serviceClient
      .from("copro_fund_call_lines")
      .select("id, call_id, lot_id, owner_name, amount_cents, paid_cents, payment_status")
      .eq("lot_id", lot_id)
      .in("payment_status", ["pending", "partial", "overdue"]);

    if (fund_call_id) {
      linesQuery = linesQuery.eq("call_id", fund_call_id);
    }

    const { data: lines } = await linesQuery;
    const remainingCents = (lines ?? []).reduce(
      (sum: number, l: unknown) =>
        sum +
        Math.max(0, ((l as { amount_cents?: number }).amount_cents ?? 0) - ((l as { paid_cents?: number }).paid_cents ?? 0)),
      0
    );

    const ownerName = (lines?.[0] as { owner_name?: string } | undefined)?.owner_name ?? "Copropriétaire";

    if (recipient_email) {
      try {
        await sendEmail({
          to: recipient_email,
          subject: "Mise en demeure de payer — Charges de copropriété",
          html: `<p>Madame, Monsieur ${ownerName},</p>
                 <p>Malgré nos précédentes relances, nous constatons que la somme de
                 <strong>${(remainingCents / 100).toFixed(2)} €</strong> reste due au titre des charges de copropriété.</p>
                 <p>Nous vous mettons en demeure de procéder au règlement intégral de cette somme dans un délai de
                 <strong>30 jours</strong> à compter de la réception du présent courrier.</p>
                 <p>À défaut, nous serons contraints d'engager une procédure judiciaire conformément à l'article 19-2
                 de la loi du 10 juillet 1965, sans nouvelle relance préalable.</p>
                 <p>Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
                 <p>Le syndic</p>`,
          text: `Mise en demeure — Montant dû : ${(remainingCents / 100).toFixed(2)} €`,
          tags: [{ name: "type", value: "copro_formal_notice" }],
        });
      } catch (err) {
        console.error("[overdue/formal-notice] email error", err);
      }
    }

    const { data: inserted, error: insertError } = await auth.serviceClient
      .from("copro_overdue_notices")
      .insert({
        site_id,
        fund_call_id: fund_call_id ?? null,
        lot_id,
        notice_type: "formal_notice",
        channel: recipient_email ? "email" : "postal",
        recipient_name: ownerName,
        recipient_email: recipient_email ?? null,
        amount_due_cents: remainingCents,
        days_late: 0,
        message: "Mise en demeure de payer",
        sent_by_user_id: auth.user.id,
        sent_by_profile_id: auth.profile.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, notice: inserted });
  } catch (error) {
    console.error("[overdue/formal-notice:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
