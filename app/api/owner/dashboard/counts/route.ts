export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/owner/dashboard/counts
 *
 * Compteurs live affichés dans le `useRealtimeDashboard` du dashboard
 * propriétaire. Auth via user-scoped client, lectures DB via service client
 * pour éviter la récursion RLS 42P17 sur profiles/leases/properties qui
 * produisait 4x GET 500 dans la console quand l'utilisateur ouvrait le
 * dashboard.
 *
 * Les subscriptions realtime restent côté navigateur (anon client) — seul
 * le fetch initial passe par ce route handler.
 */
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

interface DashboardCountsResponse {
  totalRevenue: number;
  pendingPayments: number;
  latePayments: number;
  activeLeases: number;
  pendingSignatures: number;
  openTickets: number;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 403 });
    }

    const ownerId = (profile as { id: string }).id;

    // Récupérer les propriétés du propriétaire pour filtrer les tables
    // scopées par property_id (leases, tickets, lease_signers via leases).
    const { data: properties } = await serviceClient
      .from("properties")
      .select("id")
      .eq("owner_id", ownerId);

    const propertyIds = (properties || []).map(
      (p) => (p as { id: string }).id,
    );

    if (propertyIds.length === 0) {
      const empty: DashboardCountsResponse = {
        totalRevenue: 0,
        pendingPayments: 0,
        latePayments: 0,
        activeLeases: 0,
        pendingSignatures: 0,
        openTickets: 0,
      };
      return NextResponse.json(empty);
    }

    const currentPeriod = `${new Date().getFullYear()}-${String(
      new Date().getMonth() + 1,
    ).padStart(2, "0")}`;

    const [
      invoicesResult,
      leasesResult,
      signersResult,
      ticketsResult,
    ] = await Promise.all([
      serviceClient
        .from("invoices")
        .select("montant_total, statut")
        .eq("owner_id", ownerId)
        .eq("periode", currentPeriod),
      serviceClient
        .from("leases")
        .select("id, statut")
        .in("property_id", propertyIds),
      serviceClient
        .from("lease_signers")
        .select("id, signature_status, lease:leases!inner(property_id)")
        .eq("signature_status", "pending"),
      serviceClient
        .from("tickets")
        .select("id, statut")
        .in("property_id", propertyIds)
        .in("statut", ["open", "in_progress"]),
    ]);

    const invoices =
      (invoicesResult.data as Array<{
        montant_total: number | null;
        statut: string | null;
      }> | null) || [];
    const leases =
      (leasesResult.data as Array<{ id: string; statut: string | null }> | null) ||
      [];
    const signers =
      (signersResult.data as Array<{
        id: string;
        signature_status: string | null;
        lease: { property_id: string | null } | null;
      }> | null) || [];
    const tickets =
      (ticketsResult.data as Array<{ id: string; statut: string | null }> | null) ||
      [];

    const paidInvoices = invoices.filter((i) => i.statut === "paid");
    const totalRevenue = paidInvoices.reduce(
      (sum, i) => sum + (Number(i.montant_total) || 0),
      0,
    );
    const pendingPayments = invoices.filter(
      (i) => i.statut === "sent" || i.statut === "draft",
    ).length;
    const latePayments = invoices.filter((i) => i.statut === "late").length;
    const activeLeases = leases.filter((l) => l.statut === "active").length;

    // Filtrer les signataires pour les propriétés du propriétaire
    const propertyIdSet = new Set(propertyIds);
    const pendingSignatures = signers.filter((s) =>
      s.lease?.property_id ? propertyIdSet.has(s.lease.property_id) : false,
    ).length;

    const openTickets = tickets.length;

    const payload: DashboardCountsResponse = {
      totalRevenue,
      pendingPayments,
      latePayments,
      activeLeases,
      pendingSignatures,
      openTickets,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error: unknown) {
    console.error("[GET /api/owner/dashboard/counts] Erreur:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 },
    );
  }
}
