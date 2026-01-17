export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  requireApiAccess,
  validateBody,
  getPaginationParams,
  logAudit,
} from "@/lib/api/middleware";
import { CreateTicketSchema } from "@/lib/api/schemas";

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

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = getPaginationParams(searchParams);

    const status = searchParams.get("status");
    const priority = searchParams.get("priority");

    let query = supabase
      .from("tickets")
      .select(`
        *,
        properties!inner(id, adresse_complete, ville, owner_id),
        profiles:created_by_profile_id(prenom, nom),
        work_orders(id, provider_id, statut)
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
 * Create a new ticket
 * Events: Ticket.Opened
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    // Owners and tenants can create tickets
    if (!["owner", "tenant", "admin"].includes(auth.profile.role)) {
      return apiError("Accès non autorisé", 403);
    }

    // SOTA 2026: Gating api_access (Pro+) - only for owners
    if (auth.profile.role === "owner") {
      const apiAccessCheck = await requireApiAccess(auth.profile);
      if (apiAccessCheck) return apiAccessCheck;
    }

    const supabase = await createClient();
    const body = await request.json();
    const { data, error: validationError } = validateBody(CreateTicketSchema, body);

    if (validationError) return validationError;

    // Verify access to property
    const { data: property } = await supabase
      .from("properties")
      .select("owner_id")
      .eq("id", data.property_id)
      .single();

    if (!property) {
      return apiError("Propriété non trouvée", 404);
    }

    // Authorization check
    if (auth.profile.role === "owner" && property.owner_id !== auth.profile.id) {
      return apiError("Accès non autorisé à cette propriété", 403);
    }

    if (auth.profile.role === "tenant") {
      // Tenant must have an active lease for this property
      const { data: lease } = await supabase
        .from("leases")
        .select("id")
        .eq("property_id", data.property_id)
        .eq("statut", "active")
        .single();

      if (!lease) {
        return apiError("Aucun bail actif pour cette propriété", 403);
      }

      const { data: signer } = await supabase
        .from("lease_signers")
        .select("id")
        .eq("lease_id", lease.id)
        .eq("profile_id", auth.profile.id)
        .single();

      if (!signer) {
        return apiError("Vous n'êtes pas locataire de cette propriété", 403);
      }
    }

    // Create ticket
    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        ...data,
        created_by_profile_id: auth.profile.id,
        statut: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /tickets] Error:", error);
      return apiError("Erreur lors de la création", 500);
    }

    // Emit event
    await supabase.from("outbox").insert({
      event_type: "Ticket.Opened",
      payload: {
        ticket_id: ticket.id,
        property_id: data.property_id,
        created_by: auth.profile.id,
        priority: data.priorite,
      },
    });

    // Audit log
    await logAudit(
      supabase,
      "ticket.created",
      "tickets",
      ticket.id,
      auth.user.id,
      null,
      ticket
    );

    return apiSuccess({ ticket }, 201);
  } catch (error: unknown) {
    console.error("[POST /tickets] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

