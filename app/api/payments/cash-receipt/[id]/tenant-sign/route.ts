export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/cash-receipt/[id]/tenant-sign
 * Le locataire signe un reçu créé par le propriétaire.
 * Finalise le paiement et marque la facture comme payée.
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { cashReceiptTenantSignatureSchema } from "@/lib/validations";
import { sendPushNotification } from "@/lib/push/send";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: receiptId } = await params;

    // Filet défensif : un id non-UUID produirait une erreur Postgres 22P02
    // encapsulée en 500. On retourne un 404 clair à la place.
    if (!receiptId || !UUID_REGEX.test(receiptId)) {
      return NextResponse.json(
        { error: "Identifiant de reçu invalide" },
        { status: 404 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = cashReceiptTenantSignatureSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return NextResponse.json(
        { error: "Données invalides", details: errors, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { tenant_signature, tenant_signed_at, geolocation, device_info } = parsed.data;

    const serviceClient = getServiceClient();

    // Profil locataire
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier le reçu et sa propriété
    const { data: receipt, error: receiptError } = await serviceClient
      .from("cash_receipts")
      .select(`
        id, status, tenant_id, owner_id, invoice_id, amount, receipt_number,
        owner:profiles!cash_receipts_owner_id_fkey(id, user_id, prenom, nom)
      `)
      .eq("id", receiptId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json({ error: "Reçu non trouvé" }, { status: 404 });
    }

    const receiptAny = receipt as any;

    if (receiptAny.tenant_id !== profile.id && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Ce reçu n'est pas adressé à votre compte" },
        { status: 403 }
      );
    }

    if (receiptAny.status !== "pending_tenant" && receiptAny.status !== "draft") {
      return NextResponse.json(
        { error: "Ce reçu a déjà été signé" },
        { status: 400 }
      );
    }

    // RPC atomique: signer + créer paiement + marquer facture payée
    const { data: signedRaw, error: rpcError } = await serviceClient.rpc(
      "sign_cash_receipt_as_tenant",
      {
        p_receipt_id: receiptId,
        p_tenant_signature: tenant_signature,
        p_tenant_signed_at: tenant_signed_at || new Date().toISOString(),
        p_latitude: geolocation?.lat ?? null,
        p_longitude: geolocation?.lng ?? null,
        p_device_info: device_info || {},
      } as any
    );

    if (rpcError) {
      console.error("Erreur RPC sign_cash_receipt_as_tenant:", rpcError);
      if (rpcError.message?.includes("déjà été signé")) {
        return NextResponse.json({ error: "Ce reçu a déjà été signé" }, { status: 400 });
      }
      throw new Error(rpcError.message || "Erreur lors de la signature");
    }

    const signed = signedRaw as Record<string, any>;
    const ownerFullName = `${receiptAny.owner?.prenom ?? ""} ${receiptAny.owner?.nom ?? ""}`.trim() || "Propriétaire";
    const tenantFullName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Locataire";

    // Fire-and-forget: notifications au propriétaire + audit
    const notifPromise = (async () => {
      try {
        if (receiptAny.owner?.user_id) {
          await serviceClient.from("notifications").insert({
            profile_id: receiptAny.owner.id,
            user_id: receiptAny.owner.user_id,
            type: "cash_receipt_signed",
            title: "Reçu espèces signé",
            message: `${tenantFullName} a signé le reçu ${receiptAny.receipt_number} de ${receiptAny.amount}€. La facture est marquée comme payée.`,
            data: { receipt_id: receiptId, invoice_id: receiptAny.invoice_id },
            metadata: { receipt_id: receiptId, invoice_id: receiptAny.invoice_id },
            action_url: `/owner/finances/invoices/${receiptAny.invoice_id}`,
            is_read: false,
            priority: "normal",
            status: "pending",
            channels_status: { in_app: "sent" },
          });

          // Push (Web + FCM natif) — boucle de rétroaction pour le propriétaire
          try {
            await sendPushNotification(
              receiptAny.owner.id,
              `Reçu espèces signé — ${Number(receiptAny.amount).toLocaleString("fr-FR")} €`,
              `${tenantFullName} a contresigné le reçu ${receiptAny.receipt_number}.`,
              { route: `/owner/finances/invoices/${receiptAny.invoice_id}` }
            );
          } catch (pushErr) {
            console.error("[tenant-sign] push notification failed:", pushErr);
          }
        }

        await serviceClient.from("audit_log").insert({
          user_id: user.id,
          action: "cash_receipt_signed_by_tenant",
          entity_type: "cash_receipt",
          entity_id: receiptId,
          metadata: {
            invoice_id: receiptAny.invoice_id,
            amount: receiptAny.amount,
            has_geolocation: !!geolocation,
          },
        });
      } catch (err) {
        console.error("[tenant-sign] notification error (non-blocking):", err);
      }
    })();

    void notifPromise;

    return NextResponse.json({
      success: true,
      receipt_id: signed.id,
      receipt_number: signed.receipt_number,
      status: signed.status,
      message: `Reçu ${signed.receipt_number} signé avec succès. Merci !`,
    });
  } catch (error: unknown) {
    console.error("Erreur POST tenant-sign:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
