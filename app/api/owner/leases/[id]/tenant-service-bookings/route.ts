export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";
import { TENANT_BOOKABLE_CATEGORIES } from "@/lib/tickets/tenant-service-permissions";

/**
 * PATCH /api/owner/leases/[id]/tenant-service-bookings
 *
 * Permet au propriétaire (ou admin) de configurer sur un bail quelles
 * catégories de services le locataire peut réserver directement.
 */
const bodySchema = z.object({
  enabled: z.boolean(),
  allowed_categories: z.array(z.enum(TENANT_BOOKABLE_CATEGORIES)).default([]),
  max_amount_cents: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
  requires_owner_approval: z.boolean().default(false),
});

export const PATCH = withSecurity(
  async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const { user, error: authError } = await getAuthenticatedUser(request);
      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: authError.status || 401 }
        );
      }
      if (!user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }

      const { id: leaseId } = await context.params;

      const body = await request.json();
      const validated = bodySchema.parse(body);

      const serviceClient = getServiceClient();

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        return NextResponse.json(
          { error: "Profil non trouvé", code: "NO_PROFILE" },
          { status: 404 }
        );
      }

      const profileData = profile as { id: string; role: string };

      const { data: lease } = await serviceClient
        .from("leases")
        .select("id, property_id")
        .eq("id", leaseId)
        .maybeSingle();

      if (!lease) {
        return NextResponse.json(
          { error: "Bail introuvable", code: "LEASE_NOT_FOUND" },
          { status: 404 }
        );
      }

      const leaseData = lease as { id: string; property_id: string };

      if (profileData.role !== "admin") {
        const { data: property } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", leaseData.property_id)
          .maybeSingle();
        const ownerId = (property as { owner_id: string } | null)?.owner_id;
        if (ownerId !== profileData.id) {
          return NextResponse.json(
            {
              error: "Vous n'êtes pas propriétaire de ce bail",
              code: "NO_ACCESS",
            },
            { status: 403 }
          );
        }
      }

      const payload = {
        enabled: validated.enabled,
        allowed_categories: validated.enabled ? validated.allowed_categories : [],
        max_amount_cents: validated.max_amount_cents ?? null,
        requires_owner_approval: validated.requires_owner_approval,
      };

      const { error: updateError } = await serviceClient
        .from("leases")
        .update({ tenant_service_bookings: payload })
        .eq("id", leaseId);

      if (updateError) throw updateError;

      return NextResponse.json({ tenant_service_bookings: payload });
    } catch (error: unknown) {
      return handleApiError(error);
    }
  },
  {
    routeName: "PATCH /api/owner/leases/[id]/tenant-service-bookings",
    csrf: true,
  }
);
