export const runtime = 'nodejs';

/**
 * API Route pour le dashboard prestataire
 * GET /api/provider/dashboard
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

type WorkOrderStatut = "assigned" | "scheduled" | "in_progress" | "done" | "cancelled";
const PENDING_STATUTS: WorkOrderStatut[] = ["assigned", "scheduled", "in_progress"];

interface DashboardPayload {
  profile_id: string;
  stats: {
    total_interventions: number;
    completed_interventions: number;
    pending_interventions: number;
    total_revenue: number;
    avg_rating: number | null;
    total_reviews: number;
  };
  pending_orders: Array<{
    id: string;
    ticket_id: string | null;
    statut: string;
    cout_estime: number;
    date_intervention_prevue: string | null;
    created_at: string;
    ticket: { titre: string; priorite: string };
    property: { adresse: string; ville: string };
  }>;
  recent_reviews: Array<{
    id: string;
    rating_overall: number;
    comment: string | null;
    created_at: string;
    reviewer: { prenom: string | null; nom: string | null };
  }>;
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    if (profile.role !== "provider") {
      return NextResponse.json(
        { error: "Accès non autorisé - rôle prestataire requis" },
        { status: 403 }
      );
    }

    // RPC provider_dashboard (SECURITY DEFINER) — chemin rapide
    const { data: rpcData, error: rpcError } = await serviceClient.rpc("provider_dashboard", {
      p_user_id: user.id,
    });

    if (!rpcError && rpcData && typeof rpcData === "object") {
      // La RPC peut renvoyer NULL si le profil n'est pas provider (déjà vérifié plus haut)
      // ou un objet valide. On vérifie la présence des clés attendues avant de renvoyer tel quel.
      const candidate = rpcData as Partial<DashboardPayload>;
      if (candidate.stats && Array.isArray(candidate.pending_orders) && Array.isArray(candidate.recent_reviews)) {
        return NextResponse.json(candidate);
      }
    }

    if (rpcError) {
      console.warn("[provider/dashboard] RPC failed, using direct queries fallback:", rpcError.message);
    }

    // Fallback — queries directes via serviceClient (bypass RLS, cohérent avec la RPC SECURITY DEFINER)
    const [workOrdersResult, reviewsResult] = await Promise.allSettled([
      serviceClient
        .from("work_orders")
        .select(
          "id, ticket_id, statut, cout_estime, cout_final, date_intervention_prevue, created_at, " +
          "ticket:tickets(titre, priorite), property:properties(adresse_complete, ville)"
        )
        .eq("provider_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50),
      serviceClient
        .from("provider_reviews")
        .select("id, rating_overall, comment, created_at, reviewer:profiles!reviewer_profile_id(prenom, nom)")
        .eq("provider_profile_id", profile.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const workOrders =
      workOrdersResult.status === "fulfilled" ? (workOrdersResult.value.data as any[]) || [] : [];
    const reviews =
      reviewsResult.status === "fulfilled" ? (reviewsResult.value.data as any[]) || [] : [];

    if (workOrdersResult.status === "rejected") {
      console.warn("[provider/dashboard] work_orders query failed:", workOrdersResult.reason);
    }
    if (reviewsResult.status === "rejected") {
      console.warn("[provider/dashboard] provider_reviews query failed:", reviewsResult.reason);
    }

    const totalInterventions = workOrders.length;
    const completedInterventions = workOrders.filter((wo) => wo.statut === "done").length;
    const pendingInterventions = workOrders.filter((wo) =>
      PENDING_STATUTS.includes(wo.statut)
    ).length;
    const totalRevenue = workOrders
      .filter((wo) => wo.statut === "done")
      .reduce((sum, wo) => sum + Number(wo.cout_final ?? wo.cout_estime ?? 0), 0);

    const ratings = reviews.map((r) => r.rating_overall).filter((r) => typeof r === "number");
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

    const pendingOrders: DashboardPayload["pending_orders"] = workOrders
      .filter((wo) => PENDING_STATUTS.includes(wo.statut))
      .slice(0, 5)
      .map((wo) => {
        const ticket = Array.isArray(wo.ticket) ? wo.ticket[0] : wo.ticket;
        const property = Array.isArray(wo.property) ? wo.property[0] : wo.property;
        return {
          id: wo.id,
          ticket_id: wo.ticket_id ?? null,
          statut: wo.statut,
          cout_estime: Number(wo.cout_estime ?? 0),
          date_intervention_prevue: wo.date_intervention_prevue ?? null,
          created_at: wo.created_at,
          ticket: {
            titre: ticket?.titre ?? "Intervention",
            priorite: ticket?.priorite ?? "normale",
          },
          property: {
            adresse: property?.adresse_complete ?? "",
            ville: property?.ville ?? "",
          },
        };
      });

    const recentReviews: DashboardPayload["recent_reviews"] = reviews.slice(0, 5).map((r) => {
      const reviewer = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer;
      return {
        id: r.id,
        rating_overall: r.rating_overall,
        comment: r.comment ?? null,
        created_at: r.created_at,
        reviewer: {
          prenom: reviewer?.prenom ?? null,
          nom: reviewer?.nom ?? null,
        },
      };
    });

    const payload: DashboardPayload = {
      profile_id: profile.id,
      stats: {
        total_interventions: totalInterventions,
        completed_interventions: completedInterventions,
        pending_interventions: pendingInterventions,
        total_revenue: totalRevenue,
        avg_rating: avgRating,
        total_reviews: reviews.length,
      },
      pending_orders: pendingOrders,
      recent_reviews: recentReviews,
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error("[provider/dashboard] Unhandled error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
