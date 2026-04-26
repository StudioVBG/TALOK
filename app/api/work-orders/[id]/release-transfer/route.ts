export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";
import {
  releaseEscrowToProvider,
  findHeldPayments,
  EscrowReleaseError,
} from "@/lib/work-orders/release-escrow";

/**
 * POST /api/work-orders/[id]/release-transfer
 *
 * Libère un (ou plusieurs) paiements escrow vers le compte Connect du
 * prestataire, en créant un Stripe Transfer.
 *
 * Cas d'usage :
 *   - Propriétaire valide explicitement après les travaux (raccourcit le
 *     délai de contestation 7j)
 *   - Admin support libère manuellement après résolution d'un litige
 *   - Cron auto (réservé au cron via header autorisé, voir /api/cron/release-escrow)
 *
 * Body (optionnel) :
 *   - payment_type: 'deposit' | 'balance' | 'full' — filtre quel paiement libérer.
 *     Si absent, libère TOUS les paiements en escrow_status='held' du WO.
 *
 * Permissions :
 *   - Owner du WO (via property_id)
 *   - Admin
 */
const bodySchema = z.object({
  payment_type: z.enum(["deposit", "balance", "full"]).optional(),
});

export const POST = withSecurity(
  async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ) {
    try {
      const { user, error: authError } = await getAuthenticatedUser(request);
      if (authError) throw new ApiError(authError.status || 401, authError.message);
      if (!user) throw new ApiError(401, "Non authentifié");

      const { id: workOrderId } = await context.params;
      const body = await request.json().catch(() => ({}));
      const { payment_type } = bodySchema.parse(body);

      const serviceClient = getServiceClient();

      // 1. Profil + check permissions
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) throw new ApiError(404, "Profil non trouvé");
      const profileRow = profile as { id: string; role: string };

      // 2. Work order + check owner
      const { data: wo } = await serviceClient
        .from("work_orders")
        .select("id, property_id, statut")
        .eq("id", workOrderId)
        .maybeSingle();
      if (!wo) throw new ApiError(404, "Intervention introuvable");
      const workOrder = wo as { id: string; property_id: string; statut: string | null };

      if (profileRow.role !== "admin") {
        const { data: property } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", workOrder.property_id)
          .maybeSingle();
        const ownerId = (property as { owner_id: string } | null)?.owner_id;
        if (ownerId !== profileRow.id) {
          throw new ApiError(403, "Seul le propriétaire peut libérer ces fonds");
        }
      }

      // 3. Déterminer la raison de libération selon le statut WO
      // - 'fully_paid' + balance/full → validation explicite (raccourci 7j)
      // - 'in_progress' + deposit → libération acompte au démarrage
      // - sinon → manuelle
      const reason =
        payment_type === "deposit"
          ? "deposit_release_on_start"
          : payment_type === "balance" || payment_type === "full"
            ? "balance_release_on_validation"
            : workOrder.statut === "in_progress"
              ? "deposit_release_on_start"
              : "balance_release_on_validation";

      // 4. Charger les paiements à libérer
      const heldPayments = await findHeldPayments(
        serviceClient,
        workOrderId,
        payment_type,
      );

      if (heldPayments.length === 0) {
        return NextResponse.json({
          released: [],
          message: "Aucun paiement en escrow à libérer",
        });
      }

      // 5. Libérer chaque paiement (séquentiel pour éviter les race conditions
      // côté Stripe Transfer idempotency)
      const released: Array<{
        payment_id: string;
        payment_type: string;
        transfer_id: string;
        net_amount_cents: number;
      }> = [];
      const errors: Array<{ payment_id: string; error: string }> = [];

      for (const heldPayment of heldPayments) {
        try {
          const result = await releaseEscrowToProvider(serviceClient, {
            paymentId: heldPayment.id,
            reason,
            releasedByProfileId: profileRow.id,
          });
          released.push({
            payment_id: result.paymentId,
            payment_type: heldPayment.payment_type,
            transfer_id: result.transferId,
            net_amount_cents: result.netAmountCents,
          });
        } catch (err) {
          if (err instanceof EscrowReleaseError) {
            errors.push({ payment_id: heldPayment.id, error: err.message });
          } else {
            errors.push({
              payment_id: heldPayment.id,
              error: err instanceof Error ? err.message : "Erreur inconnue",
            });
          }
        }
      }

      // 6. Si tous les paiements sont libérés et que c'était un solde/full,
      // avancer le statut WO vers 'paid' (les fonds sont bien chez le presta).
      if (released.length > 0 && errors.length === 0) {
        const releasedTypes = new Set(released.map((r) => r.payment_type));
        if (releasedTypes.has("balance") || releasedTypes.has("full")) {
          await serviceClient
            .from("work_orders")
            .update({ statut: "paid", paid_at: new Date().toISOString() })
            .eq("id", workOrderId);
        }
      }

      const status = errors.length > 0 ? 207 : 200; // 207 Multi-Status si partiel
      return NextResponse.json(
        {
          released,
          errors,
        },
        { status },
      );
    } catch (error) {
      return handleApiError(error);
    }
  },
  {
    routeName: "POST /api/work-orders/[id]/release-transfer",
    csrf: true,
  },
);
