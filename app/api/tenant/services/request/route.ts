export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";
import {
  TENANT_BOOKABLE_CATEGORIES,
  checkTenantBookingPermission,
} from "@/lib/tickets/tenant-service-permissions";
import { suggestForTenantBookableCategory } from "@/lib/tickets/charges-classification";

const bodySchema = z.object({
  provider_id: z.string().uuid(),
  category: z.enum(TENANT_BOOKABLE_CATEGORIES),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  preferred_date: z.string().optional().nullable(),
});

/**
 * POST /api/tenant/services/request
 *
 * Parcours self-service : un locataire réserve un prestataire directement.
 * Crée :
 *   - un ticket (rattaché au bail, visible owner + tenant)
 *   - un work_order assigné au provider choisi
 * Notifie l'owner (informatif) et le provider (nouvelle mission).
 *
 * Si le bail exige `requires_owner_approval`, le work_order est créé en
 * owner_approval_status='pending' et le provider n'est notifié qu'après
 * validation explicite de l'owner (route dédiée, à venir).
 */
export const POST = withSecurity(
  async function POST(request: Request) {
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

      const body = await request.json();
      const validated = bodySchema.parse(body);

      const serviceClient = getServiceClient();

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, email, prenom, nom")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        return NextResponse.json(
          { error: "Profil non trouvé", code: "NO_PROFILE" },
          { status: 404 }
        );
      }

      const profileData = profile as {
        id: string;
        email: string | null;
        prenom: string | null;
        nom: string | null;
      };
      const tenantName =
        `${profileData.prenom ?? ""} ${profileData.nom ?? ""}`.trim() ||
        "Votre locataire";

      // 1. Vérifier la permission
      const decision = await checkTenantBookingPermission({
        serviceClient,
        profileId: profileData.id,
        userEmail: profileData.email ?? user.email ?? null,
        category: validated.category,
      });

      if (!decision.allowed) {
        return NextResponse.json(
          { error: decision.message, code: decision.code },
          { status: decision.status }
        );
      }

      // 2. Vérifier que le provider existe, est actif, et couvre la catégorie
      const { data: provider } = await serviceClient
        .from("providers")
        .select("id, profile_id, company_name, status, is_marketplace, trade_categories")
        .eq("id", validated.provider_id)
        .maybeSingle();

      const providerData = provider as
        | {
            id: string;
            profile_id: string | null;
            company_name: string;
            status: string;
            is_marketplace: boolean;
            trade_categories: string[] | null;
          }
        | null;

      if (!providerData) {
        return NextResponse.json(
          { error: "Prestataire introuvable", code: "PROVIDER_NOT_FOUND" },
          { status: 404 }
        );
      }
      if (providerData.status !== "active" || !providerData.is_marketplace) {
        return NextResponse.json(
          {
            error: "Ce prestataire n'est pas disponible actuellement",
            code: "PROVIDER_UNAVAILABLE",
          },
          { status: 409 }
        );
      }
      if (!(providerData.trade_categories || []).includes(validated.category)) {
        return NextResponse.json(
          {
            error: "Ce prestataire ne couvre pas cette catégorie",
            code: "CATEGORY_MISMATCH",
          },
          { status: 409 }
        );
      }

      const requiresApproval = decision.permissions.requires_owner_approval;
      const approvalStatus = requiresApproval ? "pending" : "not_required";

      // Classification charges récupérables (décret 87-713). Le self-service
      // locataire est par nature récupérable : c'est le locataire qui initie.
      const chargeSuggestion = suggestForTenantBookableCategory(validated.category);

      // 3. Créer le ticket (déclencheur du parcours pour le propriétaire aussi)
      const { data: ticket, error: ticketError } = await serviceClient
        .from("tickets")
        .insert({
          titre: validated.title,
          description: validated.description,
          category: validated.category,
          priorite: "normal",
          property_id: decision.property_id,
          lease_id: decision.lease_id,
          created_by_profile_id: profileData.id,
          owner_id: decision.owner_profile_id,
          assigned_to: providerData.profile_id,
          statut: requiresApproval ? "open" : "assigned",
          is_tenant_chargeable: chargeSuggestion.is_tenant_chargeable,
          charge_category_code: chargeSuggestion.charge_category_code,
        })
        .select("id, reference")
        .single();

      if (ticketError) throw ticketError;
      const ticketRow = ticket as { id: string; reference: string | null };

      // 4. Créer le work_order (hérite de la classification du ticket)
      const { data: workOrder, error: woError } = await serviceClient
        .from("work_orders")
        .insert({
          ticket_id: ticketRow.id,
          property_id: decision.property_id,
          lease_id: decision.lease_id,
          provider_id: providerData.profile_id,
          title: validated.title,
          description: validated.description,
          category: validated.category,
          date_intervention_prevue: validated.preferred_date ?? null,
          statut: requiresApproval ? "assigned" : "assigned",
          requester_role: "tenant",
          owner_approval_status: approvalStatus,
          is_tenant_chargeable: chargeSuggestion.is_tenant_chargeable,
          charge_category_code: chargeSuggestion.charge_category_code,
        })
        .select("id")
        .single();

      if (woError) throw woError;
      const workOrderRow = workOrder as { id: string };

      // 5. Lier le work_order au ticket
      await serviceClient
        .from("tickets")
        .update({ work_order_id: workOrderRow.id })
        .eq("id", ticketRow.id);

      // 6. Notifications : owner toujours, provider seulement si pas d'approbation
      const { data: ownerProfile } = await serviceClient
        .from("profiles")
        .select("user_id")
        .eq("id", decision.owner_profile_id)
        .maybeSingle();

      const ownerUserId = (ownerProfile as { user_id: string } | null)?.user_id ?? null;

      const { data: providerProfile } = providerData.profile_id
        ? await serviceClient
            .from("profiles")
            .select("user_id")
            .eq("id", providerData.profile_id)
            .maybeSingle()
        : { data: null };

      const providerUserId =
        (providerProfile as { user_id: string } | null)?.user_id ?? null;

      const outboxEvents: any[] = [
        {
          event_type: requiresApproval
            ? "TenantService.ApprovalRequested"
            : "TenantService.Booked",
          payload: {
            ticket_id: ticketRow.id,
            ticket_reference: ticketRow.reference,
            work_order_id: workOrderRow.id,
            category: validated.category,
            title: validated.title,
            provider_id: providerData.profile_id,
            provider_company: providerData.company_name,
            tenant_name: tenantName,
            preferred_date: validated.preferred_date ?? null,
            recipient_user_id: ownerUserId,
            requester_role: "tenant",
          },
        },
      ];

      if (!requiresApproval && providerUserId) {
        outboxEvents.push({
          event_type: "WorkOrder.AssignedToProvider",
          payload: {
            ticket_id: ticketRow.id,
            ticket_reference: ticketRow.reference,
            work_order_id: workOrderRow.id,
            category: validated.category,
            title: validated.title,
            preferred_date: validated.preferred_date ?? null,
            recipient_user_id: providerUserId,
          },
        });
      }

      await serviceClient.from("outbox").insert(outboxEvents);

      return NextResponse.json({
        ticket_id: ticketRow.id,
        ticket_reference: ticketRow.reference,
        work_order_id: workOrderRow.id,
        requires_owner_approval: requiresApproval,
      });
    } catch (error: unknown) {
      return handleApiError(error);
    }
  },
  { routeName: "POST /api/tenant/services/request", csrf: true }
);
