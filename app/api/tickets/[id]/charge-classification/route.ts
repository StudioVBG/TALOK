export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";

/**
 * PATCH /api/tickets/[id]/charge-classification
 *
 * Permet au propriétaire (ou admin) de confirmer/modifier la suggestion
 * automatique de classification "charges récupérables" sur un ticket.
 * Met à jour aussi le work_order lié si présent, pour cohérence.
 */
const bodySchema = z.object({
  is_tenant_chargeable: z.boolean().nullable(),
  charge_category_code: z
    .enum([
      "ascenseurs",
      "eau_chauffage",
      "installations_individuelles",
      "parties_communes",
      "espaces_exterieurs",
      "taxes_redevances",
    ])
    .nullable(),
});

export const PATCH = withSecurity(
  async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const { user, error: authError } = await getAuthenticatedUser(request);
      if (authError) throw new ApiError(authError.status || 401, authError.message);
      if (!user) throw new ApiError(401, "Non authentifié");

      const { id: ticketId } = await context.params;
      const body = await request.json();
      const validated = bodySchema.parse(body);

      // Cohérence : si pas récupérable, on force category à null
      if (validated.is_tenant_chargeable !== true) {
        validated.charge_category_code = null;
      }

      const serviceClient = getServiceClient();

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) throw new ApiError(404, "Profil non trouvé");
      const profileData = profile as { id: string; role: string };

      const { data: ticket } = await serviceClient
        .from("tickets")
        .select("id, property_id, work_order_id")
        .eq("id", ticketId)
        .maybeSingle();

      if (!ticket) throw new ApiError(404, "Ticket introuvable");
      const ticketData = ticket as {
        id: string;
        property_id: string | null;
        work_order_id: string | null;
      };

      // Autorisation : owner de la propriété ou admin
      if (profileData.role !== "admin" && ticketData.property_id) {
        const { data: property } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", ticketData.property_id)
          .maybeSingle();
        const ownerId = (property as { owner_id: string } | null)?.owner_id;
        if (ownerId !== profileData.id) {
          throw new ApiError(403, "Seul le propriétaire peut modifier la classification");
        }
      }

      // Mise à jour du ticket
      const { error: tErr } = await serviceClient
        .from("tickets")
        .update({
          is_tenant_chargeable: validated.is_tenant_chargeable,
          charge_category_code: validated.charge_category_code,
        })
        .eq("id", ticketId);
      if (tErr) throw tErr;

      // Miroir sur le work_order lié s'il existe
      if (ticketData.work_order_id) {
        await serviceClient
          .from("work_orders")
          .update({
            is_tenant_chargeable: validated.is_tenant_chargeable,
            charge_category_code: validated.charge_category_code,
          })
          .eq("id", ticketData.work_order_id);
      }

      return NextResponse.json({
        is_tenant_chargeable: validated.is_tenant_chargeable,
        charge_category_code: validated.charge_category_code,
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
  {
    routeName: "PATCH /api/tickets/[id]/charge-classification",
    csrf: true,
  }
);
