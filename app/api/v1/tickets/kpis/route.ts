export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import {
  apiError,
  apiSuccess,
  requireAuth,
} from "@/lib/api/middleware";

/**
 * GET /api/v1/tickets/kpis
 * KPIs tickets : ouverts, temps moyen résolution, par catégorie, taux satisfaction
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const supabase = createServiceRoleClient();
    const profileId = auth.profile.id;

    // Build base query filter
    let propertyIds: string[] = [];

    if (auth.profile.role === "owner") {
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", profileId);
      propertyIds = properties?.map((p) => p.id) || [];
      if (propertyIds.length === 0) {
        return apiSuccess({
          kpis: {
            total: 0,
            open: 0,
            in_progress: 0,
            resolved: 0,
            closed: 0,
            avg_resolution_hours: null,
            avg_first_response_hours: null,
            avg_satisfaction: null,
            by_category: {},
            by_priority: {},
          },
        });
      }
    } else if (auth.profile.role !== "admin") {
      return apiError("KPIs réservés aux propriétaires et admins", 403);
    }

    // Fetch all relevant tickets
    let query = supabase
      .from("tickets")
      .select("id, statut, priorite, category, created_at, resolved_at, satisfaction_rating");

    if (propertyIds.length > 0) {
      query = query.in("property_id", propertyIds);
    }

    const { data: tickets, error } = await query;

    if (error) {
      console.error("[GET /tickets/kpis] Error:", error);
      return apiError("Erreur lors du calcul des KPIs", 500);
    }

    const allTickets = tickets || [];

    // Counts by status
    const open = allTickets.filter((t) => ["open", "acknowledged", "assigned", "reopened"].includes(t.statut)).length;
    const inProgress = allTickets.filter((t) => t.statut === "in_progress").length;
    const resolved = allTickets.filter((t) => t.statut === "resolved").length;
    const closed = allTickets.filter((t) => t.statut === "closed").length;

    // Average resolution time (hours)
    const resolvedTickets = allTickets.filter((t) => t.resolved_at);
    let avgResolutionHours: number | null = null;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const resolved = new Date(t.resolved_at!).getTime();
        return sum + (resolved - created) / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round(totalHours / resolvedTickets.length);
    }

    // Average satisfaction
    const rated = allTickets.filter((t) => t.satisfaction_rating);
    const avgSatisfaction = rated.length > 0
      ? Math.round((rated.reduce((s, t) => s + t.satisfaction_rating!, 0) / rated.length) * 10) / 10
      : null;

    // By category
    const byCategory: Record<string, number> = {};
    allTickets.forEach((t) => {
      const cat = t.category || "non_categorise";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    // By priority
    const byPriority: Record<string, number> = {};
    allTickets.forEach((t) => {
      byPriority[t.priorite] = (byPriority[t.priorite] || 0) + 1;
    });

    // Average first response time
    let avgFirstResponseHours: number | null = null;
    if (propertyIds.length > 0 || auth.profile.role === "admin") {
      const ticketIds = allTickets.map((t) => t.id);
      if (ticketIds.length > 0) {
        const { data: firstComments } = await supabase
          .from("ticket_comments")
          .select("ticket_id, created_at")
          .in("ticket_id", ticketIds.slice(0, 100))
          .order("created_at", { ascending: true });

        if (firstComments && firstComments.length > 0) {
          const firstByTicket = new Map<string, string>();
          firstComments.forEach((c) => {
            if (!firstByTicket.has(c.ticket_id)) {
              firstByTicket.set(c.ticket_id, c.created_at);
            }
          });

          let totalResponseHours = 0;
          let count = 0;
          firstByTicket.forEach((commentDate, ticketId) => {
            const ticket = allTickets.find((t) => t.id === ticketId);
            if (ticket) {
              const diff = (new Date(commentDate).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
              totalResponseHours += diff;
              count++;
            }
          });

          if (count > 0) {
            avgFirstResponseHours = Math.round(totalResponseHours / count);
          }
        }
      }
    }

    return apiSuccess({
      kpis: {
        total: allTickets.length,
        open,
        in_progress: inProgress,
        resolved,
        closed,
        avg_resolution_hours: avgResolutionHours,
        avg_first_response_hours: avgFirstResponseHours,
        avg_satisfaction: avgSatisfaction,
        by_category: byCategory,
        by_priority: byPriority,
      },
    });
  } catch (error) {
    console.error("[GET /tickets/kpis] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}
