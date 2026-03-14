export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, formatAmountForStripe } from "@/lib/stripe";
import { z } from "zod";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { getServiceClient } from "@/lib/supabase/service-client";
import {
  getTenantInvoicePaymentContext,
  isInvoicePayableStatus,
} from "@/lib/payments/tenant-payment-flow";

const createIntentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive().optional(),
  currency: z.string().default("eur"),
  paymentMethodId: z.string().optional(),
  customerId: z.string().optional(),
});

interface Profile {
  id: string;
  role: "admin" | "owner" | "tenant" | "provider";
}

const REUSABLE_PAYMENT_INTENT_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

function isRecentPendingPayment(createdAt?: string | null, windowMs = 15 * 60 * 1000) {
  if (!createdAt) return false;
  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return Date.now() - createdAtMs <= windowMs;
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
    const { invoiceId, currency, paymentMethodId, customerId } = createIntentSchema.parse(body);
    const serviceClient = getServiceClient();

    const paymentContext = await getTenantInvoicePaymentContext(
      invoiceId,
      typedProfile.id
    );

    if (!paymentContext) {
      throw new ApiError(404, "Facture non trouvée");
    }

    if (typedProfile.role === "tenant" && !paymentContext.canTenantPay) {
      throw new ApiError(403, "Accès non autorisé");
    }

    if (!isInvoicePayableStatus(paymentContext.status)) {
      throw new ApiError(409, "Cette facture n'est pas payable dans son etat actuel");
    }

    if (paymentContext.isAlreadySettled || paymentContext.remainingAmount <= 0) {
      throw new ApiError(409, "Cette facture est deja reglee");
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new ApiError(503, "Paiement Stripe indisponible");
    }

    let paymentMethodType: "cb" | "prelevement" = "cb";

    if (paymentMethodId || customerId) {
      if (!paymentMethodId || !customerId) {
        throw new ApiError(400, "paymentMethodId et customerId doivent etre fournis ensemble");
      }

      const { data: savedMethod, error: savedMethodError } = await serviceClient
        .from("tenant_payment_methods")
        .select("id, type")
        .eq("tenant_profile_id", typedProfile.id)
        .eq("stripe_payment_method_id", paymentMethodId)
        .eq("stripe_customer_id", customerId)
        .eq("status", "active")
        .maybeSingle();

      if (savedMethodError || !savedMethod) {
        throw new ApiError(403, "Moyen de paiement non autorise");
      }

      paymentMethodType = savedMethod.type === "sepa_debit" ? "prelevement" : "cb";
    }

    const amount = paymentContext.remainingAmount;
    const stripeAmount = formatAmountForStripe(amount);

    const { data: latestPendingPayment } = await serviceClient
      .from("payments")
      .select("id, provider_ref, created_at, montant")
      .eq("invoice_id", invoiceId)
      .eq("statut", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const typedPendingPayment = latestPendingPayment as
      | {
          id?: string | null;
          provider_ref?: string | null;
          created_at?: string | null;
          montant?: number | null;
        }
      | null;

    if (
      typedPendingPayment?.id &&
      typedPendingPayment.provider_ref &&
      isRecentPendingPayment(typedPendingPayment.created_at)
    ) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(typedPendingPayment.provider_ref);
        const existingIntentStatus = existingIntent.status;
        const sameAmount = existingIntent.amount === stripeAmount;
        const sameCurrency = existingIntent.currency === currency.toLowerCase();
        const sameCustomer =
          !customerId ||
          !existingIntent.customer ||
          existingIntent.customer === customerId ||
          (typeof existingIntent.customer === "object" && existingIntent.customer.id === customerId);

        if (
          REUSABLE_PAYMENT_INTENT_STATUSES.has(existingIntentStatus) &&
          sameAmount &&
          sameCurrency &&
          sameCustomer &&
          existingIntent.client_secret
        ) {
          return NextResponse.json({
            clientSecret: existingIntent.client_secret,
            paymentIntentId: existingIntent.id,
            paymentId: typedPendingPayment.id,
            reused: true,
          });
        }
      } catch (error) {
        console.warn("[create-intent] Impossible de reutiliser le PaymentIntent existant:", error);
      }
    }

    // Créer le Payment Intent Stripe
    const metadata: Record<string, string> = {
      invoice_id: invoiceId,
      invoiceId,
      user_id: user.id,
      userId: user.id,
      profile_id: typedProfile.id,
      profileId: typedProfile.id,
      type: "rent",
    };

    if (paymentContext.leaseId) {
      metadata.lease_id = paymentContext.leaseId;
      metadata.leaseId = paymentContext.leaseId;
    }

    if (paymentContext.propertyId) {
      metadata.property_id = paymentContext.propertyId;
      metadata.propertyId = paymentContext.propertyId;
    }

    const intentParams: Record<string, unknown> = {
      amount: stripeAmount,
      currency,
      metadata,
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
        moyen: paymentMethodType,
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
