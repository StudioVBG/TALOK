export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/agency/crg/[id]/send — Send CRG to mandant
 *
 * Marks the CRG as sent and records the sent timestamp.
 * In production, this would also trigger an email notification.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "agency") {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
    }

    // Verify CRG belongs to this agency's mandate
    const { data: crg } = await supabase
      .from("agency_crg")
      .select(`
        id, status, period_start, period_end,
        total_rent_collected_cents, total_fees_cents, net_reversement_cents,
        unpaid_rent_cents,
        mandate:agency_mandates!agency_crg_mandate_id_fkey(
          agency_profile_id,
          owner_profile_id,
          mandate_number,
          owner:profiles!agency_mandates_owner_profile_id_fkey(
            email, prenom, nom
          )
        )
      `)
      .eq("id", id)
      .single();

    if (!crg) {
      return NextResponse.json({ error: "CRG non trouve" }, { status: 404 });
    }

    const mandate = crg.mandate as any;
    if (mandate?.agency_profile_id !== profile.id) {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
    }

    if (crg.status === "sent" || crg.status === "acknowledged") {
      return NextResponse.json({ error: "CRG deja envoye" }, { status: 400 });
    }

    if (crg.status === "draft") {
      return NextResponse.json(
        { error: "Le CRG doit etre genere avant l'envoi" },
        { status: 400 }
      );
    }

    // Update CRG status
    const { data: updated, error: updateError } = await supabase
      .from("agency_crg")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Notification email au mandant. Non-bloquant : si Resend tombe ou
    // si l'email du mandant est absent, le CRG reste marqué comme
    // "sent" — c'est l'action de l'agence qui fait foi (cf. Hoguet).
    // L'erreur est juste loggée et remontée dans le payload pour
    // visibilité côté UI.
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const owner = mandate?.owner;
      const recipientEmail = owner?.email;
      if (recipientEmail) {
        const { sendEmail } = await import("@/lib/emails/resend.service");
        const ownerName =
          `${owner?.prenom ?? ""} ${owner?.nom ?? ""}`.trim() || "Propriétaire";
        const fmt = (cents: number) =>
          (cents / 100).toLocaleString("fr-FR", {
            minimumFractionDigits: 2,
          }) + " €";
        const fmtDate = (d: string) =>
          new Date(d).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          });

        const html = `
          <h2>Votre Compte Rendu de Gestion</h2>
          <p>Bonjour ${ownerName},</p>
          <p>Le compte rendu de gestion du
          <strong>${fmtDate((crg as any).period_start)}</strong> au
          <strong>${fmtDate((crg as any).period_end)}</strong> est disponible
          ${
            mandate?.mandate_number
              ? `pour le mandat ${mandate.mandate_number}`
              : ""
          }.</p>
          <ul style="line-height:1.8">
            <li>Loyers encaissés : <strong>${fmt((crg as any).total_rent_collected_cents ?? 0)}</strong></li>
            <li>Honoraires de gestion : <strong>${fmt((crg as any).total_fees_cents ?? 0)}</strong></li>
            <li>Net à reverser : <strong>${fmt((crg as any).net_reversement_cents ?? 0)}</strong></li>
            ${
              ((crg as any).unpaid_rent_cents ?? 0) > 0
                ? `<li style="color:#b54708">Loyers impayés sur la période : <strong>${fmt((crg as any).unpaid_rent_cents)}</strong></li>`
                : ""
            }
          </ul>
          <p>Connectez-vous à votre espace Talok pour consulter le détail
          et télécharger le PDF.</p>
          <p>Cordialement,<br/>L'équipe Talok</p>
        `;

        const result = await sendEmail({
          to: recipientEmail,
          subject: `Talok — Votre CRG du ${fmtDate((crg as any).period_start)} au ${fmtDate((crg as any).period_end)}`,
          html,
          tags: [
            { name: "category", value: "crg-sent" },
            { name: "crg_id", value: id },
          ],
          // Idempotence : un seul envoi par CRG, même si l'agence
          // rappelle l'endpoint. Les retours partiels (mark sent OK,
          // email KO) ne reproduiront pas l'email à un retry.
          idempotencyKey: `crg-sent-${id}`,
        });
        emailSent = result.success ?? false;
        if (!emailSent) emailError = result.error ?? "send failed";
      } else {
        emailError = "owner email manquant";
      }
    } catch (err) {
      console.error("[agency/crg/[id]/send] email failed:", err);
      emailError = err instanceof Error ? err.message : "unknown";
    }

    return NextResponse.json({
      crg: updated,
      email: { sent: emailSent, error: emailError },
    });
  } catch (error: unknown) {
    console.error("[agency/crg/[id]/send]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
