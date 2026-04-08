export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { withSecurity } from "@/lib/api/with-security";
import { canTransition } from "@/lib/payments/invoice-state-machine";

/**
 * POST /api/invoices/[id]/send
 *
 * Transition invoice from draft → sent.
 * Sends notification to tenant.
 */
export const POST = withSecurity(
  async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const { user, error } = await getAuthenticatedUser(request);

      if (error || !user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }

      const { id: invoiceId } = await context.params;
      const serviceClient = getServiceClient();

      // Profile check
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .single();

      if (!profile || (profile as any).role !== "owner") {
        return NextResponse.json(
          { error: "Seuls les propriétaires peuvent envoyer une facture" },
          { status: 403 }
        );
      }

      // Get invoice
      const { data: invoice, error: invoiceError } = await serviceClient
        .from("invoices")
        .select("id, statut, owner_id, tenant_id, lease_id, montant_total, periode")
        .eq("id", invoiceId)
        .single();

      if (invoiceError || !invoice) {
        return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
      }

      const typedInvoice = invoice as any;

      // Authorization
      if (typedInvoice.owner_id !== (profile as any).id) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
      }

      // Validate transition
      if (!canTransition(typedInvoice.statut, "sent")) {
        return NextResponse.json(
          { error: `Impossible d'envoyer une facture en statut "${typedInvoice.statut}"` },
          { status: 409 }
        );
      }

      // Transition to sent
      const { error: updateError } = await serviceClient
        .from("invoices")
        .update({ statut: "sent" } as any)
        .eq("id", invoiceId);

      if (updateError) throw updateError;

      // Emit event for tenant notification
      await serviceClient.from("outbox").insert({
        event_type: "Rent.InvoiceSent",
        payload: {
          invoice_id: invoiceId,
          lease_id: typedInvoice.lease_id,
          tenant_id: typedInvoice.tenant_id,
          amount: typedInvoice.montant_total,
          periode: typedInvoice.periode,
        },
      } as any);

      // Notify tenant
      if (typedInvoice.tenant_id) {
        const { data: tenantProfile } = await serviceClient
          .from("profiles")
          .select("user_id, email")
          .eq("id", typedInvoice.tenant_id)
          .single();

        if (tenantProfile && (tenantProfile as any).user_id) {
          await serviceClient.rpc("create_notification", {
            p_recipient_id: (tenantProfile as any).user_id,
            p_type: "info",
            p_title: "Nouvelle facture de loyer",
            p_message: `Votre facture de ${typedInvoice.montant_total}€ pour ${typedInvoice.periode} est disponible.`,
            p_link: `/tenant/payments?invoice=${invoiceId}`,
            p_related_id: invoiceId,
            p_related_type: "invoice",
          });
        }
      }

      return NextResponse.json({ success: true, status: "sent" });
    } catch (err: unknown) {
      console.error("[POST /api/invoices/[id]/send] Error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur serveur" },
        { status: 500 }
      );
    }
  },
  { routeName: "POST /api/invoices/[id]/send", csrf: true }
);
