export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/properties/[id] - Récupérer les détails d'une propriété (admin)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClientFromRequest(request);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier rôle admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Récupérer la propriété avec owner
    const { data: property, error } = await supabase
      .from("properties")
      .select(`
        *,
        owner:profiles!owner_id(
          id, 
          prenom, 
          nom, 
          email, 
          telephone
        )
      `)
      .eq("id", id)
      .single();

    if (error || !property) {
      console.error("[GET /api/admin/properties/[id]] Erreur:", error);
      return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
    }

    // Récupérer les baux associés
    const { data: leases } = await supabase
      .from("leases")
      .select(`
        id,
        date_debut,
        date_fin,
        loyer,
        charges_forfaitaires,
        statut,
        lease_signers(
          profile_id,
          role,
          profiles:profile_id(
            id,
            prenom,
            nom,
            email
          )
        )
      `)
      .eq("property_id", id)
      .order("date_debut", { ascending: false });

    // Trouver le bail actif OU le bail en attente de signature
    const now = new Date();
    
    // Priorité 1: Bail actif
    let activeLease = leases?.find((lease: any) => {
      const startDate = new Date(lease.date_debut);
      const endDate = lease.date_fin ? new Date(lease.date_fin) : null;
      return startDate <= now && (!endDate || endDate >= now) && lease.statut === "active";
    });

    // Priorité 2: Bail en attente de signature (locataire a signé, propriétaire non)
    let pendingLease = null;
    if (!activeLease) {
      pendingLease = leases?.find((lease: any) => 
        lease.statut === "pending_owner_signature" || 
        lease.statut === "pending_signature"
      );
    }

    // Le bail "courant" est soit actif, soit en attente
    const currentLease = activeLease || pendingLease;

    // Trouver le locataire principal du bail courant
    let currentTenant = null;
    if (currentLease?.lease_signers) {
      const tenantSigner = currentLease.lease_signers.find(
        (s: any) => s.role === "locataire_principal" || s.role === "colocataire"
      );
      if (tenantSigner?.profiles) {
        currentTenant = tenantSigner.profiles;
      }
    }

    // Déterminer le statut de la propriété
    let statut: "vacant" | "loue" | "en_travaux" | "signature_en_cours" = "vacant";
    if (activeLease) {
      statut = "loue";
    } else if (pendingLease) {
      statut = "signature_en_cours";
    }

    // Extraire les tenants du bail pour le format attendu
    const tenants = currentLease?.lease_signers
      ?.filter((s: any) => s.role === "locataire_principal" || s.role === "colocataire")
      ?.map((s: any) => s.profiles)
      ?.filter(Boolean) || [];

    return NextResponse.json({
      property: {
        // Identité
        id: property.id,
        type: property.type || "appartement",
        unique_code: property.unique_code,
        
        // Adresse
        adresse_complete: property.adresse_complete,
        ville: property.ville,
        code_postal: property.code_postal,
        latitude: property.latitude,
        longitude: property.longitude,
        
        // Caractéristiques générales
        surface: property.surface,
        nb_pieces: property.nb_pieces,
        nb_chambres: property.nb_chambres,
        etage: property.etage,
        ascenseur: property.ascenseur,
        
        // Habitation
        meuble: property.meuble,
        dpe_classe_energie: property.dpe_classe_energie,
        dpe_classe_climat: property.dpe_classe_climat,
        chauffage_type: property.chauffage_type,
        chauffage_energie: property.chauffage_energie,
        eau_chaude_type: property.eau_chaude_type,
        clim_presence: property.clim_presence,
        clim_type: property.clim_type,
        
        // Extérieurs
        has_balcon: property.has_balcon,
        has_terrasse: property.has_terrasse,
        has_jardin: property.has_jardin,
        has_cave: property.has_cave,
        
        // Parking
        parking_type: property.parking_type,
        parking_numero: property.parking_numero,
        parking_niveau: property.parking_niveau,
        parking_gabarit: property.parking_gabarit,
        parking_portail_securise: property.parking_portail_securise,
        parking_video_surveillance: property.parking_video_surveillance,
        parking_gardien: property.parking_gardien,
        
        // Local pro
        local_type: property.local_type,
        local_surface_totale: property.local_surface_totale,
        local_has_vitrine: property.local_has_vitrine,
        local_access_pmr: property.local_access_pmr,
        local_clim: property.local_clim,
        local_fibre: property.local_fibre,
        local_alarme: property.local_alarme,
        
        // Financier
        loyer_hc: property.loyer_hc || currentLease?.loyer || 0,
        charges_mensuelles: property.charges_mensuelles || currentLease?.charges_forfaitaires || 0,
        depot_garantie: property.depot_garantie || 0,
        loyer_actuel: currentLease?.loyer || property.loyer_reference,
        
        // Média
        visite_virtuelle_url: property.visite_virtuelle_url,
        
        // Status et dates
        statut,
        created_at: property.created_at,
        updated_at: property.updated_at,
      },
      // Owner séparé pour le composant PropertyOwnerInfo
      owner: property.owner || null,
      // Locataire actuel
      current_tenant: currentTenant,
      // Bail formaté pour PropertyOccupation
      current_lease: currentLease ? {
        id: currentLease.id,
        statut: currentLease.statut,
        date_debut: currentLease.date_debut,
        date_fin: currentLease.date_fin,
        loyer: currentLease.loyer,
        charges: currentLease.charges_forfaitaires || 0,
        tenants: tenants,
        lease_signers: currentLease.lease_signers
      } : null,
      pending_lease: pendingLease ? {
        id: pendingLease.id,
        statut: pendingLease.statut,
        loyer: pendingLease.loyer
      } : null
    });
  } catch (error: unknown) {
    console.error("[GET /api/admin/properties/[id]] Erreur serveur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

