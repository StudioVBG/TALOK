export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/admin/overview - Vue d'ensemble avec propriétés et utilisateurs liés
 */
export async function GET(request: Request) {
  try {
    const { error, user, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer toutes les données en parallèle avec les relations
    const [
      ownersResult,
      propertiesResult,
      leasesResult,
      tenantsResult,
    ] = await Promise.all([
      // Propriétaires avec leurs propriétés
      supabase
        .from("profiles")
        .select(
          `
          id,
          prenom,
          nom,
          user_id,
          role,
          created_at,
          owner_profiles(type, siret, usage_strategie, tva_optionnelle, tva_taux),
          properties(id, type, usage_principal, sous_usage, adresse_complete, surface, nb_pieces, created_at, tva_applicable)
        `
        )
        .eq("role", "owner"),
      
      // Toutes les propriétés avec leurs propriétaires
      supabase
        .from("properties")
        .select(
          `
          id,
          type,
          usage_principal,
          sous_usage,
          adresse_complete,
          surface,
          nb_pieces,
          owner_id,
          erp_type,
          erp_categorie,
          erp_accessibilite,
          has_irve,
          places_parking,
          parking_badge_count,
          tva_applicable,
          tva_taux,
          etat,
          submitted_at,
          validated_at,
          rejection_reason,
          created_at,
          profiles!properties_owner_id_fkey(id, prenom, nom, user_id)
        `
        )
        .order("created_at", { ascending: false }),
      
      // Baux avec propriétés et locataires
      supabase
        .from("leases")
        .select(
          `
          id,
          property_id,
          statut,
          date_debut,
          date_fin,
          loyer,
          lease_signers(profile_id, role, signature_status)
        `
        ),
      
      // Locataires avec leurs baux
      supabase
        .from("profiles")
        .select(
          `
          id,
          prenom,
          nom,
          user_id,
          role,
          created_at,
          tenant_profiles(situation_pro, revenus_mensuels)
        `
        )
        .eq("role", "tenant"),
    ]);

    // Traiter les données pour créer des relations
    const owners = (ownersResult.data || []) as any[];
    const properties = (propertiesResult.data || []) as any[];
    const leases = (leasesResult.data || []) as any[];
    const tenants = (tenantsResult.data || []) as any[];

    // Créer des maps pour les relations
    const ownerMap = new Map(owners.map(o => [o.id, o]));
    const propertyMap = new Map(properties.map(p => [p.id, p]));
    const leaseMap = new Map<string, any[]>();
    
    leases.forEach(lease => {
      if (lease.property_id) {
        if (!leaseMap.has(lease.property_id)) {
          leaseMap.set(lease.property_id, []);
        }
        leaseMap.get(lease.property_id)!.push(lease);
      }
    });

    // Enrichir les propriétés avec leurs propriétaires et baux
    const enrichedProperties = properties.map(property => {
      const owner = ownerMap.get(property.owner_id);
      const propertyLeases = leaseMap.get(property.id) || [];
      const activeLeases = propertyLeases.filter((l: any) => 
        ["active", "pending_signature"].includes(l.statut)
      );
      
      // Extraire les locataires des baux actifs
      const tenantIds = new Set<string>();
      activeLeases.forEach((lease: any) => {
        if (lease.lease_signers) {
          lease.lease_signers.forEach((signer: any) => {
            if (signer.role === "locataire_principal" || signer.role === "colocataire") {
              tenantIds.add(signer.profile_id);
            }
          });
        }
      });

      return {
        ...property,
        owner: owner ? {
          id: owner.id,
          name: `${owner.prenom || ""} ${owner.nom || ""}`.trim() || "Sans nom",
          email: owner.user_id, // On peut enrichir avec l'email si nécessaire
        } : null,
        leases_count: propertyLeases.length,
        active_leases_count: activeLeases.length,
        tenants_count: tenantIds.size,
      };
    });

    // Enrichir les propriétaires avec leurs statistiques
    const enrichedOwners = owners.map(owner => {
      const ownerProperties = Array.isArray(owner.properties) ? owner.properties : [];
      const totalLeases = ownerProperties.reduce((count: number, prop: any) => {
        return count + (leaseMap.get(prop.id)?.length || 0);
      }, 0);
      const activeLeases = ownerProperties.reduce((count: number, prop: any) => {
        const propLeases = leaseMap.get(prop.id) || [];
        return count + propLeases.filter((l: any) => 
          ["active", "pending_signature"].includes(l.statut)
        ).length;
      }, 0);

      return {
        ...owner,
        name: `${owner.prenom || ""} ${owner.nom || ""}`.trim() || "Sans nom",
        properties_count: ownerProperties.length,
        total_leases: totalLeases,
        active_leases: activeLeases,
        owner_profiles: Array.isArray(owner.owner_profiles) && owner.owner_profiles.length > 0
          ? owner.owner_profiles[0]
          : null,
      };
    });

    const professionalProperties = enrichedProperties.filter(
      (property) => property.usage_principal && property.usage_principal !== "habitation"
    );

    const propertiesWithTva = enrichedProperties.filter((property) => property.tva_applicable);

    return NextResponse.json({
      owners: enrichedOwners,
      properties: enrichedProperties,
      tenants,
      stats: {
        total_owners: enrichedOwners.length,
        total_properties: enrichedProperties.length,
        total_tenants: tenants.length,
        total_leases: leases.length,
        active_leases: leases.filter((l: any) => 
          ["active", "pending_signature"].includes(l.statut)
        ).length,
        professional_properties: professionalProperties.length,
        properties_with_tva: propertiesWithTva.length,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/admin/overview:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

