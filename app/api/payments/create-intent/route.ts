export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, formatAmountForStripe, type PaymentMetadata } from "@/lib/stripe";
import { z } from "zod";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

const createIntentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default("eur"),
  paymentMethodId: z.string().optional(),
  customerId: z.string().optional(),
});

interface Profile {
  id: string;
  role: "admin" | "owner" | "tenant" | "provider";
}

interface InvoiceWithLease {
  id: string;
  tenant_id: string | null;
  lease_id: string | null;
  leases: { property_id: string } | null;
}

export async function POST(request: NextRequest) {
  try {
    // Authentification
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const typedProfile = profile as Profile;

    // Valider les données
    const body = await request.json();
    const { invoiceId, amount, currency, paymentMethodId, customerId } = createIntentSchema.parse(body);

    // Récupérer la facture pour vérifier les permissions
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, tenant_id, lease_id, leases(property_id)")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new ApiError(404, "Facture non trouvée");
    }

    const typedInvoice = invoice as unknown as InvoiceWithLease;

    // Vérifier que le locataire peut payer cette facture
    if (typedProfile.role === "tenant" && typedInvoice.tenant_id !== typedProfile.id) {
      throw new ApiError(403, "Accès non autorisé");
    }

    // Créer le Payment Intent Stripe
    const metadata: PaymentMetadata = {
      invoiceId,
      userId: user.id,
      profileId: typedProfile.id,
      leaseId: typedInvoice.lease_id ?? undefined,
      propertyId: typedInvoice.leases?.property_id,
      type: "rent",
    };

    const intentParams: Record<string, unknown> = {
      amount: formatAmountForStripe(amount),
      currency,
      metadata: metadata as unknown as Record<string, string>,
      description: `Paiement facture ${invoiceId.slice(0, 8)}`,
    };

    if (paymentMethodId && customerId) {
      intentParams.payment_method = paymentMethodId;
      intentParams.customer = customerId;
      intentParams.automatic_payment_methods = { enabled: true, allow_redirects: "never" };
    } else {
      intentParams.automatic_payment_methods = { enabled: true };
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams as any);

    // Créer un enregistrement de paiement en attente
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        invoice_id: invoiceId,
        montant: amount,
        moyen: "cb",
        provider_ref: paymentIntent.id,
        statut: "pending",
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("[create-intent] Erreur création paiement:", paymentError);
      // Annuler le Payment Intent si la DB échoue
      await stripe.paymentIntents.cancel(paymentIntent.id);
      throw new ApiError(500, "Erreur lors de la création du paiement");
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentId: payment.id,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
