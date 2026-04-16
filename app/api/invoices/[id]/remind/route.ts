export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { sendPaymentReminder } from "@/lib/emails/resend.service";
import { NextResponse } from "next/server";

/**
 * POST /api/invoices/[id]/remind - Relancer un paiement (BTN-P08)
 *
 * Envoie un email de relance au locataire via Resend et met à jour
 * le compteur de relances sur la facture.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth via RLS client
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Service client pour les queries DB (évite RLS recursion 42P17)
    const serviceClient = getServiceClient();

    // Récupérer la facture avec les infos du bail et du bien
    const { data: invoice, error: invoiceError } = await serviceClient
      .from("invoices")
      .select(`
        *,
        lease:leases!inner(
          id,
          property:properties!inner(
            owner_id,
            adresse_complete,
            ville
          )
        )
      `)
      .eq("id", id as any)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    const invoiceData = invoice as any;

    // Vérifier ownership
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = invoiceData.lease?.property?.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut relancer un paiement" },
        { status: 403 }
      );
    }

    // Vérifier que la facture n'est pas déjà payée
    if (invoiceData.statut === "paid") {
      return NextResponse.json(
        { error: "Cette facture est déjà payée" },
        { status: 400 }
      );
    }

    // Récupérer le profil du locataire
    const { data: tenantProfile } = await serviceClient
      .from("profiles")
      .select("id, user_id, prenom, nom")
      .eq("id", invoiceData.tenant_id as any)
      .single();

    if (!tenantProfile?.user_id) {
      return NextResponse.json(
        { error: "Locataire introuvable" },
        { status: 404 }
      );
    }

    // Récupérer l'email du locataire via auth.admin
    const { data: tenantAuth } = await serviceClient.auth.admin.getUserById(
      tenantProfile.user_id
    );

    const tenantEmail = tenantAuth?.user?.email;
    if (!tenantEmail) {
      return NextResponse.json(
        { error: "Email du locataire introuvable" },
        { status: 404 }
      );
    }

    const tenantName = [tenantProfile.prenom, tenantProfile.nom]
      .filter(Boolean)
      .join(" ") || "Locataire";

    // Calculer les jours de retard
    const dueDate = invoiceData.date_echeance || invoiceData.due_date;
    const referenceDate = dueDate ? new Date(dueDate) : new Date(invoiceData.created_at);
    const now = new Date();
    const daysLate = Math.max(
      0,
      Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const dueDateFormatted = referenceDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Montant en euros (stocké en centimes dans la DB pour certaines factures,
    // mais montant_total est déjà en euros dans le schéma invoices locataire)
    const amount = invoiceData.montant_total;

    // Envoyer l'email via Resend
    const emailResult = await sendPaymentReminder({
      tenantEmail,
      tenantName,
      amount,
      dueDate: dueDateFormatted,
      daysLate,
      invoiceId: id,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: "Impossible d'envoyer l'email de relance" },
        { status: 500 }
      );
    }

    // Mettre à jour le compteur de relances sur la facture
    const currentReminderCount = invoiceData.reminder_count || 0;
    await serviceClient
      .from("invoices")
      .update({
        last_reminder_at: now.toISOString(),
        reminder_count: currentReminderCount + 1,
        statut: invoiceData.statut === "sent" ? "late" : invoiceData.statut,
      } as any)
      .eq("id", id as any);

    // Outbox pour les notifications in-app
    await serviceClient.from("outbox").insert({
      event_type: "Payment.Reminder",
      payload: {
        invoice_id: id,
        lease_id: invoiceData.lease_id,
        tenant_id: tenantProfile.user_id,
        amount,
        month: invoiceData.periode,
      },
    } as any);

    // Audit log
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "payment_reminder_sent",
      entity_type: "invoice",
      entity_id: id,
      metadata: {
        lease_id: invoiceData.lease_id,
        amount,
        days_late: daysLate,
        reminder_count: currentReminderCount + 1,
        tenant_email: tenantEmail,
      },
    } as any);

    return NextResponse.json({
      success: true,
      message: "Relance envoyée",
      reminder_count: currentReminderCount + 1,
    });
  } catch (error: unknown) {
    console.error("[remind] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
