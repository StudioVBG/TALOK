export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";
import { injectChargeEntryForWorkOrder } from "@/lib/tickets/inject-charge-entry";

/**
 * POST /api/work-orders/[id]/inject-charges
 *
 * Injecte manuellement le coût d'une intervention dans les charges
 * récupérables (charge_entries), si `is_tenant_chargeable=true` et
 * `charge_category_code` posé. Idempotent.
 *
 * Appel typique : le propriétaire, une fois le prestataire payé, clique
 * "Ajouter aux charges récupérables" sur la page ticket. L'écriture sera
 * agrégée par la régularisation annuelle du bail.
 */
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
      const serviceClient = getServiceClient();

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) throw new ApiError(404, "Profil non trouvé");
      const profileData = profile as { id: string; role: string };

      // Autorisation owner/admin sur la propriété
      const { data: wo } = await serviceClient
        .from("work_orders")
        .select("id, property_id")
        .eq("id", workOrderId)
        .maybeSingle();
      if (!wo) throw new ApiError(404, "Intervention introuvable");
      const workOrder = wo as { id: string; property_id: string };

      if (profileData.role !== "admin") {
        const { data: property } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", workOrder.property_id)
          .maybeSingle();
        const ownerId = (property as { owner_id: string } | null)?.owner_id;
        if (ownerId !== profileData.id) {
          throw new ApiError(
            403,
            "Seul le propriétaire peut imputer cette intervention aux charges"
          );
        }
      }

      const result = await injectChargeEntryForWorkOrder(
        serviceClient,
        workOrderId
      );

      if (!result.ok) {
        const status = result.code === "WORK_ORDER_NOT_FOUND" ? 404 : 409;
        return NextResponse.json(
          { error: result.message, code: result.code },
          { status }
        );
      }

      return NextResponse.json({
        charge_entry_id: result.charge_entry_id,
        amount_cents: result.amount_cents,
        created: result.created,
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
  {
    routeName: "POST /api/work-orders/[id]/inject-charges",
    csrf: true,
  }
);
