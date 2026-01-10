/**
 * API Route: Tenant Details
 * GET /api/tenants/:id - Détails d'un locataire
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tenants/:id
 * Récupère les détails d'un locataire
 */
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouvé");
    }

    // Récupérer le locataire avec ses baux
    const { data: tenant, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        prenom,
        nom,
        email,
        telephone,
        avatar_url,
        date_naissance,
        adresse_ligne1,
        ville,
        code_postal,
        pays,
        created_at
      `
      )
      .eq("id", id)
      .single();

    if (error || !tenant) {
      throw new ApiError(404, "Locataire non trouvé");
    }

    // Récupérer les baux du locataire
    const { data: leases } = await supabase
      .from("lease_signers")
      .select(
        `
        role,
        signature_status,
        signed_at,
        lease:leases(
          id,
          statut,
          date_debut,
          date_fin,
          loyer,
          charges_forfaitaires,
          depot_de_garantie,
          type_bail,
          property:properties(
            id,
            nom,
            adresse_ligne1,
            ville,
            code_postal,
            owner_id,
            owner:profiles!properties_owner_id_fkey(
              id,
              prenom,
              nom
            )
          ),
          unit:units(
            id,
            nom,
            property:properties(
              id,
              nom,
              adresse_ligne1,
              ville,
              code_postal,
              owner_id,
              owner:profiles!properties_owner_id_fkey(
                id,
                prenom,
                nom
              )
            )
          )
        )
      `
      )
      .eq("profile_id", id)
      .in("role", ["locataire_principal", "locataire", "colocataire"]);

    // Vérifier les droits d'accès
    if (profile.role !== "admin") {
      const hasAccess = (leases || []).some((ls: any) => {
        const property = ls.lease?.property || ls.lease?.unit?.property;
        return property?.owner_id === profile.id;
      });

      if (!hasAccess && profile.id !== id) {
        throw new ApiError(403, "Accès non autorisé à ce locataire");
      }
    }

    // Récupérer les factures
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, periode, montant_total, statut, created_at")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(12);

    // Récupérer les paiements
    const { data: payments } = await supabase
      .from("payments")
      .select(
        `
        id,
        montant,
        moyen,
        date_paiement,
        statut,
        invoice:invoices!inner(
          periode,
          lease_id
        )
      `
      )
      .eq("invoice.tenant_id", id)
      .order("date_paiement", { ascending: false })
      .limit(12);

    // Formater les baux
    const formattedLeases = (leases || []).map((ls: any) => {
      const property = ls.lease?.property || ls.lease?.unit?.property;
      const owner = property?.owner;
      return {
        id: ls.lease?.id,
        role: ls.role,
        signature_status: ls.signature_status,
        signed_at: ls.signed_at,
        statut: ls.lease?.statut,
        date_debut: ls.lease?.date_debut,
        date_fin: ls.lease?.date_fin,
        loyer: ls.lease?.loyer,
        charges: ls.lease?.charges_forfaitaires,
        depot_garantie: ls.lease?.depot_de_garantie,
        type_bail: ls.lease?.type_bail,
        property: property
          ? {
              id: property.id,
              nom: property.nom,
              adresse: property.adresse_ligne1,
              ville: property.ville,
              code_postal: property.code_postal,
            }
          : null,
        owner: owner
          ? {
              id: owner.id,
              nom: `${owner.prenom || ""} ${owner.nom || ""}`.trim(),
            }
          : null,
        unit: ls.lease?.unit
          ? {
              id: ls.lease.unit.id,
              nom: ls.lease.unit.nom,
            }
          : null,
      };
    });

    // Calculer les statistiques
    const stats = {
      nb_baux: formattedLeases.length,
      baux_actifs: formattedLeases.filter((l) => l.statut === "active").length,
      total_facture: (invoices || []).reduce(
        (sum, inv) => sum + (inv.montant_total || 0),
        0
      ),
      total_paye: (payments || [])
        .filter((p) => p.statut === "succeeded")
        .reduce((sum, p) => sum + (p.montant || 0), 0),
      factures_impayees: (invoices || []).filter(
        (inv) => inv.statut === "sent" || inv.statut === "late"
      ).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...tenant,
        leases: formattedLeases,
        invoices: invoices || [],
        payments: payments || [],
        stats,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
