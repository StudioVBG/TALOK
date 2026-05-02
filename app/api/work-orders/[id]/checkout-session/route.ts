export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/work-orders/[id]/checkout-session
 *
 * Crée une Stripe Checkout Session pour qu'un propriétaire paie l'intervention
 * d'un prestataire.
 *
 * Architecture : ESCROW via Separate charges and transfers (Stripe Connect).
 *   1. Le proprio paie -> charge sur le compte plateforme Talok (PAS de
 *      transfer_data.destination, donc PAS de routage immédiat).
 *   2. Les fonds sont retenus sur le compte Talok (escrow_status = 'held').
 *   3. La libération vers le compte Connect du prestataire (Transfer Stripe
 *      avec déduction de la commission) est faite plus tard, à des moments
 *      contrôlés par la plateforme :
 *        - Acompte (30%) libéré quand le prestataire démarre l'intervention
 *          (statut 'in_progress')
 *        - Solde (70%) libéré après le délai de contestation 7j ou validation
 *          explicite par le proprio.
 *
 * Cette logique de libération sera implémentée dans le Sprint B (route
 * /release-transfer + cron de libération automatique).
 */
const bodySchema = z.object({
  /** Par défaut 'full' — on paye la totalité en un coup. */
  payment_type: z.enum(["deposit", "balance", "full"]).default("full"),
  /** Montant surchargé si fourni (cents). Sinon auto : basé sur quote ou split deposit/balance. */
  amount_cents: z.number().int().positive().optional(),
});

interface FeeConfig {
  stripe_percent: number;
  stripe_fixed: number;
  platform_percent: number;
  platform_fixed: number;
  deposit_percent: number;
}

const FEE_CONFIG_FALLBACK: FeeConfig = {
  stripe_percent: 0.014,
  stripe_fixed: 0.25,
  platform_percent: 0.01,
  platform_fixed: 0.5,
  deposit_percent: 30,
};

async function loadFeeConfig(serviceClient: any): Promise<FeeConfig> {
  const { data } = await serviceClient
    .from("payment_fee_config")
    .select(
      "stripe_percent, stripe_fixed, platform_percent, platform_fixed, deposit_percent"
    )
    .eq("config_key", "default")
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return FEE_CONFIG_FALLBACK;

  const row = data as Record<string, string | number | null>;
  return {
    stripe_percent: Number(row.stripe_percent ?? FEE_CONFIG_FALLBACK.stripe_percent),
    stripe_fixed: Number(row.stripe_fixed ?? FEE_CONFIG_FALLBACK.stripe_fixed),
    platform_percent: Number(row.platform_percent ?? FEE_CONFIG_FALLBACK.platform_percent),
    platform_fixed: Number(row.platform_fixed ?? FEE_CONFIG_FALLBACK.platform_fixed),
    deposit_percent: Number(row.deposit_percent ?? FEE_CONFIG_FALLBACK.deposit_percent),
  };
}

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

      // 2. Work order + vérif accès
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

      // 3. Vérifier que le prestataire a un compte Connect actif.
      //    Note: en mode escrow on ne passe PAS transfer_data au Checkout
      //    (charge sur compte Talok), mais il faut quand même que le compte
      //    Connect soit prêt pour la future libération (Sprint B).
      const { data: connectAccount } = await serviceClient
        .from("stripe_connect_accounts")
        .select("stripe_account_id, charges_enabled, payouts_enabled")
        .eq("profile_id", workOrder.provider_id)
        .is("entity_id", null)
        .maybeSingle();
      const connect = connectAccount as
        | {
            stripe_account_id: string;
            charges_enabled: boolean;
            payouts_enabled: boolean;
          }
        | null;
      if (!connect?.stripe_account_id) {
        throw new ApiError(
          409,
          "Le prestataire n'a pas encore configuré son compte de paiement"
        );
      }
      if (!connect.charges_enabled || !connect.payouts_enabled) {
        throw new ApiError(
          409,
          "Le compte de paiement du prestataire n'est pas encore actif (KYC en cours)"
        );
      }

      // 4. Charger la config des frais
      const feeConfig = await loadFeeConfig(serviceClient);
      const depositRatio = feeConfig.deposit_percent / 100;

      // 5. Montant : soit surchargé, soit résolu depuis le devis accepté
      let grossCents = amount_cents ?? 0;
      let percentageOfTotal: number | null = null;
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
            grossCents = Math.round(fullCents * depositRatio);
            percentageOfTotal = feeConfig.deposit_percent;
          } else if (payment_type === "balance") {
            grossCents = fullCents - Math.round(fullCents * depositRatio);
            percentageOfTotal = 100 - feeConfig.deposit_percent;
          } else {
            grossCents = fullCents;
            percentageOfTotal = 100;
          }
        }
      } else if (grossCents > 0) {
        percentageOfTotal =
          payment_type === "deposit"
            ? feeConfig.deposit_percent
            : payment_type === "balance"
              ? 100 - feeConfig.deposit_percent
              : 100;
      }
      if (grossCents <= 0) {
        throw new ApiError(
          400,
          "Montant à payer introuvable : fournissez amount_cents ou acceptez d'abord un devis."
        );
      }

      // 6. Calcul des frais (à appliquer au moment du Transfer en Sprint B,
      //    on les enregistre dès maintenant pour traçabilité).
      //    Stripe : 1.4% + 0,25 € (incompressible, prélevé par Stripe sur
      //              la charge plateforme à l'encaissement).
      //    Plateforme : 1.0% + 0,50 € (commission Talok, déduite du transfer).
      const stripeFeeCents =
        Math.round(grossCents * feeConfig.stripe_percent) +
        Math.round(feeConfig.stripe_fixed * 100);
      const platformFeeCents =
        Math.round(grossCents * feeConfig.platform_percent) +
        Math.round(feeConfig.platform_fixed * 100);
      const totalFeesCents = stripeFeeCents + platformFeeCents;
      const netToProviderCents = grossCents - totalFeesCents;

      // 7. URLs de retour
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";
      const successUrl = `${appUrl}/owner/tickets?wo_paid=${workOrder.id}`;
      const cancelUrl = `${appUrl}/owner/tickets?wo_cancel=${workOrder.id}`;

      // 8. Création de la Checkout Session — ESCROW MODE
      //    Pas de transfer_data.destination -> charge encaissée sur le compte
      //    plateforme Talok et y reste jusqu'à la libération manuelle/cron.
      const customerEmail = payerProfile.email ?? user.email ?? undefined;
      const depositLabel = `Acompte (${feeConfig.deposit_percent.toFixed(0)}%)`;
      const balanceLabel = `Solde (${(100 - feeConfig.deposit_percent).toFixed(0)}%)`;
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
                    ? depositLabel
                    : payment_type === "balance"
                      ? balanceLabel
                      : "Paiement intégral",
              },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          // Pas d'application_fee_amount ni transfer_data : escrow.
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

      // 9. Insertion work_order_payments en 'pending' pour traçabilité.
      //    Le webhook passera status='succeeded' + escrow_status='held' à
      //    réception (pas 'released' : la libération est différée).
      await serviceClient.from("work_order_payments").insert({
        work_order_id: workOrder.id,
        payment_type,
        payer_profile_id: payerProfile.id,
        payee_profile_id: workOrder.provider_id,
        gross_amount: formatAmountFromCents(grossCents),
        percentage_of_total: percentageOfTotal,
        stripe_fee: formatAmountFromCents(stripeFeeCents),
        platform_fee: formatAmountFromCents(platformFeeCents),
        total_fees: formatAmountFromCents(totalFeesCents),
        net_amount: formatAmountFromCents(netToProviderCents),
        status: "pending",
        escrow_status: "pending",
        stripe_payment_intent_id: session.payment_intent as string | null,
        metadata: {
          checkout_session_id: session.id,
          fee_config_snapshot: feeConfig,
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
