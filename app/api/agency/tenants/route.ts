export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agency/tenants
 *
 * Liste les locataires actifs des biens sous mandat de l'agence appelante.
 * Agrège : agency_mandates → properties (via property_ids) → leases active → profiles (tenant).
 * Ajoute un statut de paiement basé sur les invoices unpaid récentes (best-effort).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface TenantRow {
  tenantId: string;
  leaseId: string;
  name: string;
  email: string | null;
  phone: string | null;
  propertyId: string;
  propertyAddress: string;
  propertyCity: string | null;
  ownerName: string;
  loyer: number;
  since: string | null;
  paymentStatus: "paid" | "pending" | "late" | "unknown";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }
    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { data: mandates, error: mandatesError } = await (supabase as any)
      .from("agency_mandates")
      .select("id, property_ids, status, owner:profiles!agency_mandates_owner_profile_id_fkey(id, prenom, nom)")
      .eq("agency_profile_id", profile.id)
      .eq("status", "active");

    if (mandatesError) {
      return NextResponse.json(
        { error: mandatesError.message ?? "Erreur lecture mandats" },
        { status: 500 },
      );
    }

    const propertyToOwner = new Map<string, string>();
    const propertyIds = new Set<string>();
    for (const m of (mandates ?? []) as Array<{
      property_ids: string[] | null;
      owner: { prenom: string | null; nom: string | null } | null;
    }>) {
      const ownerName = m.owner
        ? `${m.owner.prenom ?? ""} ${m.owner.nom ?? ""}`.trim() || "—"
        : "—";
      for (const pid of m.property_ids ?? []) {
        propertyIds.add(pid);
        if (!propertyToOwner.has(pid)) propertyToOwner.set(pid, ownerName);
      }
    }

    if (propertyIds.size === 0) {
      return NextResponse.json({ tenants: [], stats: defaultStats() });
    }

    const ids = Array.from(propertyIds);

    const { data: properties } = await supabase
      .from("properties")
      .select("id, adresse_complete, ville, code_postal")
      .in("id", ids);

    const propertyById = new Map<string, { adresse: string; ville: string | null }>();
    for (const p of (properties ?? []) as Array<{
      id: string;
      adresse_complete: string | null;
      ville: string | null;
      code_postal: string | null;
    }>) {
      propertyById.set(p.id, {
        adresse: p.adresse_complete ?? "Adresse inconnue",
        ville: [p.code_postal, p.ville].filter(Boolean).join(" ") || null,
      });
    }

    const { data: leases } = await supabase
      .from("leases")
      .select(
        `
        id, property_id, tenant_id, loyer, statut, date_debut,
        tenant:profiles!leases_tenant_id_fkey(id, prenom, nom, email, telephone)
      `,
      )
      .in("property_id", ids)
      .eq("statut", "active");

    const tenants: TenantRow[] = [];
    for (const lease of (leases ?? []) as Array<{
      id: string;
      property_id: string;
      tenant_id: string;
      loyer: number | null;
      date_debut: string | null;
      tenant: {
        id: string;
        prenom: string | null;
        nom: string | null;
        email: string | null;
        telephone: string | null;
      } | null;
    }>) {
      if (!lease.tenant) continue;
      const propInfo = propertyById.get(lease.property_id);
      tenants.push({
        tenantId: lease.tenant.id,
        leaseId: lease.id,
        name:
          `${lease.tenant.prenom ?? ""} ${lease.tenant.nom ?? ""}`.trim() || "Locataire",
        email: lease.tenant.email,
        phone: lease.tenant.telephone,
        propertyId: lease.property_id,
        propertyAddress: propInfo?.adresse ?? "Adresse inconnue",
        propertyCity: propInfo?.ville ?? null,
        ownerName: propertyToOwner.get(lease.property_id) ?? "—",
        loyer: lease.loyer ?? 0,
        since: lease.date_debut,
        paymentStatus: "unknown",
      });
    }

    if (tenants.length > 0) {
      const leaseIds = tenants.map((t) => t.leaseId);
      const { data: openInvoices } = await supabase
        .from("invoices")
        .select("lease_id, statut, due_date")
        .in("lease_id", leaseIds)
        .in("statut", ["pending", "overdue", "unpaid", "late"]);

      const today = new Date().toISOString().split("T")[0];
      const lateLeases = new Set<string>();
      const pendingLeases = new Set<string>();
      for (const inv of (openInvoices ?? []) as Array<{
        lease_id: string;
        statut: string;
        due_date: string | null;
      }>) {
        if (inv.statut === "overdue" || inv.statut === "late" || (inv.due_date && inv.due_date < today)) {
          lateLeases.add(inv.lease_id);
        } else {
          pendingLeases.add(inv.lease_id);
        }
      }

      for (const t of tenants) {
        if (lateLeases.has(t.leaseId)) t.paymentStatus = "late";
        else if (pendingLeases.has(t.leaseId)) t.paymentStatus = "pending";
        else t.paymentStatus = "paid";
      }
    }

    const stats = {
      total: tenants.length,
      upToDate: tenants.filter((t) => t.paymentStatus === "paid").length,
      late: tenants.filter((t) => t.paymentStatus === "late").length,
      pending: tenants.filter((t) => t.paymentStatus === "pending").length,
      totalLoyers: tenants.reduce((sum, t) => sum + t.loyer, 0),
    };

    return NextResponse.json({ tenants, stats });
  } catch (error) {
    console.error("[api/agency/tenants] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}

function defaultStats() {
  return { total: 0, upToDate: 0, late: 0, pending: 0, totalLoyers: 0 };
}
