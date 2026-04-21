export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";
import { stripe, formatAmountForStripe } from "@/lib/stripe";

/**
 * POST /api/work-orders/[id]/checkout-session
 *
 * Crée une Stripe Checkout Session pour payer l'intervention au prestataire.
 * Le propriétaire paie par CB (ou moyen configuré) via la page Stripe hébergée,
 * puis est redirigé vers success_url. Les side-effects (marquer le paiement
 * succeeded, avancer le work_order, injecter en charge récupérable) sont
 * déclenchés par le webhook Stripe (checkout.session.completed).
 *
 * Architecture : Stripe Connect — le montant net va sur le compte Connect
 * du prestataire, les frais plateforme restent sur le compte plateforme.
 */
const bodySchema = z.object({
  /** Par défaut 'full' — on paye la totalité en un coup. */
  payment_type: z.enum(["deposit", "balance", "full"]).default("full"),
  /** Montant surchargé si fourni (cents). Sinon auto : basé sur quote ou split 2/3-1/3. */
  amount_cents: z.number().int().positive().optional(),
});

const PLATFORM_FEE_PCT = 0.01; // 1% — aligné payment_fee_config default
const PLATFORM_FEE_FIXED_CENTS = 50; // 0,50 €

export const POST = withSecurity(
  async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const { user, error: authError } = await getAuthenticatedUser(request);
      if (authError) throw new ApiError(authError.status || 401, authError.message);
      if (!user) throw new ApiError(401, "Non authentifié");

      const { id: workOrderId } = await context.params;
      const body = await request.json().catch(() => ({}));
      const { payment_type, amount_cents } = bodySchema.parse(body);

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new ApiError(503, "Paiement indisponible : Stripe non configuré");
      }

      const serviceClient = getServiceClient();

      // 1. Profil payeur (owner ou admin)
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role, email, prenom, nom")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) throw new ApiError(404, "Profil non trouvé");
      const payerProfile = profile as {
        id: string;
        role: string;
        email: string | null;
        prenom: string | null;
        nom: string | null;
      };

      // 2. Work order + vérif accès + résolution provider Stripe Connect
      const { data: wo } = await serviceClient
        .from("work_orders")
        .select(
          "id, property_id, title, description, provider_id, statut, accepted_quote_id"
        )
        .eq("id", workOrderId)
        .maybeSingle();
      if (!wo) throw new ApiError(404, "Intervention introuvable");
      const workOrder = wo as {
        id: string;
        property_id: string;
        title: string | null;
        description: string | null;
        provider_id: string | null;
        statut: string | null;
        accepted_quote_id: string | null;
      };

      if (payerProfile.role !== "admin") {
        const { data: property } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", workOrder.property_id)
          .maybeSingle();
        const ownerId = (property as { owner_id: string } | null)?.owner_id;
        if (ownerId !== payerProfile.id) {
          throw new ApiError(403, "Seul le propriétaire peut régler cette intervention");
        }
      }

      if (!workOrder.provider_id) {
        throw new ApiError(409, "Aucun prestataire n'est assigné à cette intervention");
      }

      // 3. Compte Stripe Connect du prestataire
      const { data: payoutAccount } = await serviceClient
        .from("provider_payout_accounts")
        .select("stripe_account_id, stripe_account_status")
        .eq("profile_id", workOrder.provider_id)
        .maybeSingle();
      const payout = payoutAccount as
        | { stripe_account_id: string; stripe_account_status: string }
        | null;
      if (!payout?.stripe_account_id) {
        throw new ApiError(
          409,
          "Le prestataire n'a pas encore configuré son compte de paiement"
        );
      }
      if (payout.stripe_account_status !== "enabled") {
        throw new ApiError(
          409,
          "Le compte de paiement du prestataire n'est pas encore actif"
        );
      }

      // 4. Montant : soit surchargé, soit résolu depuis le devis accepté
      let grossCents = amount_cents ?? 0;
      if (grossCents === 0 && workOrder.accepted_quote_id) {
        const { data: quote } = await serviceClient
          .from("provider_quotes")
          .select("total_amount")
          .eq("id", workOrder.accepted_quote_id)
          .maybeSingle();
        const quoteTotal = Number(
          (quote as { total_amount: number | string } | null)?.total_amount ?? 0
        );
        if (quoteTotal > 0) {
          const fullCents = Math.round(quoteTotal * 100);
          if (payment_type === "deposit") {
            grossCents = Math.round(fullCents * (2 / 3));
          } else if (payment_type === "balance") {
            grossCents = fullCents - Math.round(fullCents * (2 / 3));
          } else {
            grossCents = fullCents;
          }
        }
      }
      if (grossCents <= 0) {
        throw new ApiError(
          400,
          "Montant à payer introuvable : fournissez amount_cents ou acceptez d'abord un devis."
        );
      }

      // 5. Frais plateforme (à retenir sur le transfer vers le provider)
      const applicationFeeCents =
        Math.round(grossCents * PLATFORM_FEE_PCT) + PLATFORM_FEE_FIXED_CENTS;

      // 6. URLs de retour
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr";
      const successUrl = `${appUrl}/owner/tickets?wo_paid=${workOrder.id}`;
      const cancelUrl = `${appUrl}/owner/tickets?wo_cancel=${workOrder.id}`;

      // 7. Création de la Checkout Session — Stripe Connect (destination charge)
      const customerEmail = payerProfile.email ?? user.email ?? undefined;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: customerEmail,
        line_items: [
          {
            price_data: {
              currency: "eur",
              unit_amount: grossCents,
              product_data: {
                name: `Intervention : ${workOrder.title || "Prestation"}`,
                description:
                  payment_type === "deposit"
                    ? "Acompte (2/3)"
                    : payment_type === "balance"
                      ? "Solde (1/3)"
                      : "Paiement intégral",
              },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeCents,
          transfer_data: {
            destination: payout.stripe_account_id,
          },
          metadata: {
            type: "work_order_payment",
            work_order_id: workOrder.id,
            payment_type,
            payer_profile_id: payerProfile.id,
            payee_profile_id: workOrder.provider_id,
            property_id: workOrder.property_id,
          },
        },
        metadata: {
          type: "work_order_payment",
          work_order_id: workOrder.id,
          payment_type,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      // 8. Insertion work_order_payments en 'pending' pour traçabilité
      //    Le webhook passera status='succeeded' à réception.
      await serviceClient.from("work_order_payments").insert({
        work_order_id: workOrder.id,
        payment_type,
        payer_profile_id: payerProfile.id,
        payee_profile_id: workOrder.provider_id,
        gross_amount: formatAmountFromCents(grossCents),
        platform_fee: formatAmountFromCents(applicationFeeCents),
        stripe_fee: 0,
        total_fees: formatAmountFromCents(applicationFeeCents),
        net_amount: formatAmountFromCents(grossCents - applicationFeeCents),
        status: "pending",
        escrow_status: "pending",
        stripe_payment_intent_id: session.payment_intent as string | null,
        metadata: {
          checkout_session_id: session.id,
        },
      } as any);

      return NextResponse.json({
        url: session.url,
        session_id: session.id,
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
  {
    routeName: "POST /api/work-orders/[id]/checkout-session",
    csrf: true,
  }
);

function formatAmountFromCents(cents: number): number {
  return Math.round(cents) / 100;
}
