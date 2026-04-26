/**
 * /api/v1/tickets/** — Famille **API publique versionnée**.
 *
 * Surface destinée aux **clients externes** (intégrations tiers, scripts,
 * webhooks Pro+). Activée par le forfait `api_access` :
 * pro / enterprise_s / enterprise_m / enterprise_l / enterprise_xl.
 *
 * Caractéristiques :
 * - Feature gating `requireApiAccess` sur les opérations de listing/création
 *   (voir GET et POST ci-dessous) — un owner Free obtiendra 403 API_ACCESS_REQUIRED.
 * - Les routes d'action (`[id]/assign`, `[id]/resolve`, `[id]/close`, etc.) ne
 *   gatent pas, pour ne pas casser les workflows en cours quand un plan expire.
 * - Format de réponse normalisé (`apiSuccess` / `apiError`).
 * - Lecture via `createServiceRoleClient()` + check métier explicite
 *   (creator / owner / assignee / admin) — voir commit 71907d5 (PR #499).
 *
 * Pour les appels **internes UI**, utiliser la famille `/api/tickets/**`
 * (sans gating) via `features/tickets/services/tickets.service.ts`.
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { createServiceRoleClient, getServiceClient } from "@/lib/supabase/service-client";
import {
  apiError,
  apiSuccess,
  requireAuth,
  requireApiAccess,
  validateBody,
  getPaginationParams,
} from "@/lib/api/middleware";
import { CreateTicketSchema } from "@/lib/api/schemas";
import { createTicket } from "@/lib/tickets/create-ticket.service";

/**
 * GET /api/v1/tickets
 * List tickets based on user role
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    // SOTA 2026: Gating api_access (Pro+) - only for owners
    if (auth.profile.role === "owner") {
      const apiAccessCheck = await requireApiAccess(auth.profile);
      if (apiAccessCheck) return apiAccessCheck;
    }

    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = getPaginationParams(searchParams);

    const status = searchParams.get("status");
    const priority = searchParams.get("priority");

    const category = searchParams.get("category");

    let query = supabase
      .from("tickets")
      .select(`
        *,
        properties!inner(id, adresse_complete, ville, owner_id),
        profiles:created_by_profile_id(prenom, nom),
        assignee:profiles!assigned_to(prenom, nom),
        work_orders(id, provider_id, statut, date_intervention_prevue, cout_estime)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter based on role
    if (auth.profile.role === "owner") {
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", auth.profile.id);

      if (properties && properties.length > 0) {
        query = query.in("property_id", properties.map((p) => p.id));
      } else {
        return apiSuccess({ tickets: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
    } else if (auth.profile.role === "tenant") {
      query = query.eq("created_by_profile_id", auth.profile.id);
    } else if (auth.profile.role === "provider") {
      // Providers see tickets assigned to them
      const { data: workOrders } = await supabase
        .from("work_orders")
        .select("ticket_id")
        .eq("provider_id", auth.profile.id);

      if (workOrders && workOrders.length > 0) {
        query = query.in("id", workOrders.map((wo) => wo.ticket_id));
      } else {
        return apiSuccess({ tickets: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
    } else if (auth.profile.role !== "admin") {
      return apiError("Accès non autorisé", 403);
    }

    if (status && status !== "all") {
      query = query.eq("statut", status);
    }

    if (priority && priority !== "all") {
      query = query.eq("priorite", priority);
    }

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /tickets] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    return apiSuccess({
      tickets: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: unknown) {
    console.error("[GET /tickets] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * POST /api/v1/tickets
 * Create a new ticket.
 *
 * Depuis l'unification d'avril 2026, cette route partage intégralement la
 * logique métier avec POST /api/tickets via `createTicket()` service :
 *   - résolution property_id + lease_id par profile_id OU invited_email
 *   - routage parties communes → syndic
 *   - suggestion de classification charges récupérables (décret 87-713)
 *   - outbox Ticket.Opened / Ticket.OpenedPartiesCommunes
 *   - audit log
 *
 * Ce qui reste spécifique à la route v1 :
 *   - wrapper auth (requireAuth), feature gating api_access (owners Pro+),
 *     format de réponse apiSuccess/apiError, code 201 à la création.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    if (!["owner", "tenant", "admin"].includes(auth.profile.role)) {
      return apiError("Accès non autorisé", 403);
    }

    if (auth.profile.role === "owner") {
      const apiAccessCheck = await requireApiAccess(auth.profile);
      if (apiAccessCheck) return apiAccessCheck;
    }

    const body = await request.json();
    const { data, error: validationError } = validateBody(CreateTicketSchema, body);
    if (validationError) return validationError;

    const result = await createTicket({
      serviceClient: getServiceClient(),
      auth: {
        user_id: auth.user.id,
        user_email: auth.user.email ?? null,
        profile_id: auth.profile.id,
        profile_email: (auth.profile as { email?: string | null }).email ?? null,
        profile_role: auth.profile.role,
      },
      input: {
        property_id: data.property_id,
        lease_id: data.lease_id ?? null,
        titre: data.titre,
        description: data.description,
        category: data.category ?? null,
        priorite: data.priorite ?? "normal",
        photos: data.photos ?? [],
      },
    });

    if (!result.ok) {
      return apiError(result.message, result.status);
    }

    return apiSuccess({ ticket: result.ticket }, 201);
  } catch (error: unknown) {
    console.error("[POST /v1/tickets] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

