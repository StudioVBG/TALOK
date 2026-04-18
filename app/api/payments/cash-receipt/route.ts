export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/cash-receipt
 * Le propriétaire signe et crée un reçu en attente.
 * Une notification est envoyée au locataire qui signera ensuite
 * depuis SON propre espace (cf. /api/payments/cash-receipt/[id]/tenant-sign).
 *
 * @see Art. 21 loi n°89-462 du 6 juillet 1989
 * @see Décret n°2015-587 du 6 mai 2015
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { cashReceiptInputSchema } from "@/lib/validations";
import { sendCashReceiptSignatureRequest } from "@/lib/emails/resend.service";
import { sendPushNotification } from "@/lib/push/send";
import { sendSMS } from "@/lib/sms";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();

    // Validation Zod SOTA 2026
    const validationResult = cashReceiptInputSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        {
          error: "Données invalides",
          details: errors,
          code: "VALIDATION_ERROR"
        },
        { status: 400 }
      );
    }

    const {
      invoice_id,
      amount,
      owner_signature,
      owner_signed_at,
      geolocation,
      device_info,
      notes,
    } = validationResult.data;

    const serviceClient = getServiceClient();

    // Vérifier le profil propriétaire (service role pour éviter 406 RLS)
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    if (profile.role !== "owner" && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut créer un reçu espèces" },
        { status: 403 }
      );
    }

    // Récupérer la facture avec les infos liées
    const { data: invoice, error: invoiceError } = await serviceClient
      .from("invoices")
      .select(`
        *,
        tenant:profiles!invoices_tenant_id_fkey(id, prenom, nom, user_id, email, telephone),
        lease:leases(
          id,
          property_id,
          property:properties(id, adresse_complete, owner_id)
        )
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que la facture appartient au propriétaire
    const invoiceAny = invoice as any;
    if (profile.role !== "admin" && invoiceAny.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Cette facture ne vous appartient pas" },
        { status: 403 }
      );
    }

    if (invoiceAny.statut === "paid") {
      return NextResponse.json(
        { error: "Cette facture est déjà payée" },
        { status: 400 }
      );
    }

    // ✅ Flow deux étapes: création du reçu en attente (pending_tenant)
    // Aucun paiement créé ici — il le sera lors de la signature locataire.
    const { data: receiptRaw, error: rpcError } = await serviceClient.rpc(
      "create_cash_receipt",
      {
        p_invoice_id: invoice_id,
        p_amount: amount,
        p_owner_signature: owner_signature,
        p_owner_signed_at: owner_signed_at || new Date().toISOString(),
        p_latitude: geolocation?.lat ?? null,
        p_longitude: geolocation?.lng ?? null,
        p_device_info: device_info || {},
        p_notes: notes ?? null,
      } as any
    );

    if (rpcError) {
      console.error("Erreur RPC create_cash_receipt:", rpcError);
      if (rpcError.message.includes("Facture non trouvée")) {
        return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
      }
      if (rpcError.message.includes("Facture déjà payée")) {
        return NextResponse.json({ error: "Cette facture est déjà payée" }, { status: 400 });
      }
      if (rpcError.message.includes("reçu existe déjà")) {
        return NextResponse.json({ error: "Un reçu est déjà en attente de signature" }, { status: 409 });
      }
      throw new Error(rpcError.message || "Erreur lors de la création du reçu");
    }

    const receipt = receiptRaw as Record<string, any>;

    const tenantUserId = invoiceAny.tenant?.user_id as string | undefined;
    const tenantProfileId = invoiceAny.tenant?.id as string | undefined;
    const tenantEmail = invoiceAny.tenant?.email as string | undefined;
    const tenantTelephone = invoiceAny.tenant?.telephone as string | undefined;
    const tenantFullName = `${invoiceAny.tenant?.prenom ?? ""} ${invoiceAny.tenant?.nom ?? ""}`.trim() || "Locataire";
    const ownerFullName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Propriétaire";
    const propertyAddress = (invoiceAny.lease?.property?.adresse_complete as string | undefined) ?? "";
    const receiptPeriod = (receipt.periode as string | undefined) ?? (invoiceAny.periode as string | undefined) ?? "";

    // Fire-and-forget: notifications (ne pas bloquer la réponse HTTP)
    const actionUrl = `/tenant/payments/cash-receipt/${receipt.id}`;
    const notificationsPromise = (async () => {
      try {
        const inserts: any[] = [
          {
            profile_id: profile.id,
            user_id: user.id,
            type: "cash_receipt_pending_tenant",
            title: "Reçu espèces envoyé au locataire",
            message: `Reçu ${receipt.receipt_number} de ${amount}€. En attente de la signature de ${tenantFullName}.`,
            data: { receipt_id: receipt.id, invoice_id },
            metadata: { receipt_id: receipt.id, invoice_id },
            action_url: `/owner/finances/invoices/${invoice_id}`,
            is_read: false,
            priority: "normal",
            status: "pending",
            channels_status: { in_app: "sent" },
          },
        ];

        if (tenantProfileId && tenantUserId) {
          inserts.push({
            profile_id: tenantProfileId,
            user_id: tenantUserId,
            type: "cash_receipt_signature_requested",
            title: "Signature requise — Reçu espèces",
            message: `${ownerFullName} vous demande de signer un reçu de ${amount}€ pour confirmer votre paiement en espèces.`,
            data: { receipt_id: receipt.id, invoice_id },
            metadata: { receipt_id: receipt.id, invoice_id },
            action_url: actionUrl,
            is_read: false,
            priority: "high",
            status: "pending",
            channels_status: { in_app: "sent" },
          });
        }

        await serviceClient.from("notifications").insert(inserts);

        await serviceClient.from("audit_log").insert({
          user_id: user.id,
          action: "cash_receipt_created_pending",
          entity_type: "cash_receipt",
          entity_id: receipt.id,
          metadata: {
            invoice_id,
            amount,
            tenant_profile_id: tenantProfileId,
            has_geolocation: !!geolocation,
          },
        });

        // --- Multi-canal : email (Resend) + push + SMS si téléphone ---
        if (tenantProfileId) {
          // Email Resend
          if (tenantEmail) {
            try {
              await sendCashReceiptSignatureRequest({
                tenantEmail,
                tenantName: tenantFullName,
                ownerName: ownerFullName,
                propertyAddress,
                period: receiptPeriod,
                amount: Number(amount),
                receiptId: receipt.id,
                receiptNumber: receipt.receipt_number,
              });
            } catch (emailErr) {
              console.error("[cash-receipt] email notification failed:", emailErr);
            }
          }

          // Push (Web Push + FCM natif iOS/Android)
          try {
            await sendPushNotification(
              tenantProfileId,
              "Signature requise — Reçu espèces",
              `${ownerFullName} vous demande de contresigner un reçu de ${Number(amount).toLocaleString("fr-FR")} €.`,
              { route: actionUrl }
            );
          } catch (pushErr) {
            console.error("[cash-receipt] push notification failed:", pushErr);
          }

          // SMS de secours si téléphone renseigné
          if (tenantTelephone) {
            try {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";
              await sendSMS({
                to: tenantTelephone,
                body: `[Talok] ${ownerFullName} a enregistré votre paiement de ${Number(amount).toLocaleString("fr-FR")} €. Contresignez votre reçu : ${appUrl}${actionUrl}`,
                context: {
                  type: "notification",
                  profileId: tenantProfileId,
                  relatedId: receipt.id,
                },
              });
            } catch (smsErr) {
              console.error("[cash-receipt] SMS notification failed:", smsErr);
            }
          }
        }
      } catch (err) {
        console.error("[cash-receipt] notification error (non-blocking):", err);
      }
    })();

    // Ne pas attendre la fin des notifications (fire-and-forget)
    void notificationsPromise;

    return NextResponse.json({
      success: true,
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
      status: receipt.status,
      action_url: actionUrl,
      message: "Reçu créé. En attente de la signature du locataire.",
    });
  } catch (error: unknown) {
    console.error("Erreur création reçu espèces:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/cash-receipt
 * Liste les reçus espèces
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("invoice_id");

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    let query = serviceClient
      .from("cash_receipts")
      .select(`
        *,
        invoice:invoices(id, periode, montant_total),
        payment:payments(id, montant, date_paiement)
      `)
      .order("created_at", { ascending: false });

    // Filtrer selon le rôle
    if (profile.role === "owner") {
      query = query.eq("owner_id", profile.id);
    } else if (profile.role === "tenant") {
      query = query.eq("tenant_id", profile.id);
    }

    // Filtrer par facture si spécifié
    if (invoiceId) {
      query = query.eq("invoice_id", invoiceId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erreur récupération reçus:", error);
      throw error;
    }

    return NextResponse.json({ receipts: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
