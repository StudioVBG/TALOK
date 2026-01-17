export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/charges/reconciliation - Lancer une régularisation des charges (batch ou par bail)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { lease_id, year, scope = "lease" } = body; // scope: 'lease' | 'all'

    if (scope === "lease" && !lease_id) {
      return NextResponse.json(
        { error: "lease_id requis pour scope='lease'" },
        { status: 400 }
      );
    }

    if (!year) {
      return NextResponse.json(
        { error: "year requis" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";

    // Si scope='all', seul l'admin peut lancer
    if (scope === "all" && !isAdmin) {
      return NextResponse.json(
        { error: "Seul l'admin peut lancer une régularisation globale" },
        { status: 403 }
      );
    }

    const reconciliations = [];

    if (scope === "lease") {
      // Vérifier que l'utilisateur est propriétaire
      const { data: lease } = await supabase
        .from("leases")
        .select(`
          id,
          property:properties!inner(owner_id)
        `)
        .eq("id", lease_id)
        .single();

      if (!lease) {
        return NextResponse.json(
          { error: "Bail non trouvé" },
          { status: 404 }
        );
      }

      const leaseData = lease as any;
      if (leaseData.property.owner_id !== profileData?.id && !isAdmin) {
        return NextResponse.json(
          { error: "Accès non autorisé" },
          { status: 403 }
        );
      }

      const reconciliation = await calculateReconciliation(supabase, lease_id, year);
      reconciliations.push(reconciliation);
    } else {
      // Scope 'all' : tous les baux actifs
      const { data: leases } = await supabase
        .from("leases")
        .select("id")
        // @ts-ignore - Supabase typing issue
        .eq("statut", "active");

      const leasesData = (leases || []) as any[];
      for (const lease of leasesData) {
        try {
          const reconciliation = await calculateReconciliation(supabase, lease.id, year);
          reconciliations.push(reconciliation);
        } catch (error) {
          console.error(`Erreur régularisation pour bail ${lease.id}:`, error);
        }
      }
    }

    // Émettre des événements
    for (const rec of reconciliations) {
      await supabase.from("outbox").insert({
        event_type: "Charge.Reconciled",
        payload: {
          reconciliation_id: rec.id,
          lease_id: rec.lease_id,
          year,
          delta: rec.delta,
        },
      } as any);
    }

    return NextResponse.json({
      success: true,
      reconciliations,
      count: reconciliations.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

async function calculateReconciliation(supabase: any, leaseId: string, year: number) {
  // Calculer le total des charges réelles pour l'année
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { data: charges } = await supabase
    .from("charges")
    .select("montant, periodicite, refacturable_locataire")
    .eq("property_id", (await supabase.from("leases").select("property_id").eq("id", leaseId).single()).data.property_id);

  let totalCharges = 0;
  if (charges) {
    for (const charge of charges) {
      if (!charge.refacturable_locataire) continue;

      let annualAmount = 0;
      switch (charge.periodicite) {
        case "mensuelle":
          annualAmount = charge.montant * 12;
          break;
        case "trimestrielle":
          annualAmount = charge.montant * 4;
          break;
        case "annuelle":
          annualAmount = charge.montant;
          break;
      }
      totalCharges += annualAmount;
    }
  }

  // Calculer le total des provisions versées
  const { data: provisions } = await supabase
    .from("charge_provisions")
    .select("amount")
    .eq("lease_id", leaseId)
    .gte("month", yearStart)
    .lte("month", yearEnd);

  const totalProvisions = provisions?.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;

  // Calculer le delta
  const delta = totalCharges - totalProvisions;

  // Créer ou mettre à jour la régularisation
  const { data: existing } = await supabase
    .from("charge_reconciliations")
    .select("id")
    .eq("lease_id", leaseId)
    .eq("year", year)
    .maybeSingle();

  let reconciliation;
  if (existing) {
    const { data: updated, error } = await supabase
      .from("charge_reconciliations")
      .update({
        total_charges: totalCharges,
        total_provisions: totalProvisions,
        delta,
        status: "calculated",
      } as any)
      .eq("id", (existing as any).id)
      .select()
      .single();
    if (error) throw error;
    reconciliation = updated;
  } else {
    const { data: created, error } = await supabase
      .from("charge_reconciliations")
      .insert({
        lease_id: leaseId,
        year,
        total_charges: totalCharges,
        total_provisions: totalProvisions,
        delta,
        status: "calculated",
      } as any)
      .select()
      .single();
    if (error) throw error;
    reconciliation = created;
  }

  return reconciliation;
}

