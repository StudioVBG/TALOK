export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour la gestion des baux (Admin)
 * GET /api/admin/leases - Liste tous les baux (admin uniquement)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

// Mapping des statuts pour filtrage
const STATUS_MAP: Record<string, string> = {
  brouillon: "draft",
  en_attente: "pending_signature",
  actif: "active",
  termine: "terminated",
};

export async function GET(request: NextRequest) {
  try {
    const { error, supabase } = await requireAdmin(request);

    if (error || !supabase) {
      return NextResponse.json(
        { error: error?.message || "Accès non autorisé" },
        { status: error?.status || 403 }
      );
    }

    // Paramètres de requête
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status") ?? undefined;
    const typeParam = searchParams.get("type") ?? undefined;
    const ownerIdParam = searchParams.get("owner_id") ?? undefined;
    const propertyIdParam = searchParams.get("property_id") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    // Mapper le statut si nécessaire
    const mappedStatus = statusParam && statusParam !== "all"
      ? STATUS_MAP[statusParam] ?? statusParam
      : undefined;

    // Construire la requête de base
    let query = supabase
      .from("leases")
      .select(`
        *,
        property:properties(
          id,
          adresse_complete,
          ville,
          code_postal,
          type,
          owner:profiles!properties_owner_id_fkey(
            id,
            prenom,
            nom,
            telephone
          )
        ),
        signers:lease_signers(
          id,
          role,
          signature_status,
          signed_at,
          profile:profiles(
            id,
            prenom,
            nom
          )
        )
      `, { count: "exact" });

    // Appliquer les filtres
    if (mappedStatus) {
      query = query.eq("statut", mappedStatus);
    }

    if (typeParam && typeParam !== "all") {
      query = query.eq("type_bail", typeParam);
    }

    if (propertyIdParam) {
      query = query.eq("property_id", propertyIdParam);
    }

    // Filtrer par propriétaire (via la propriété)
    if (ownerIdParam) {
      // On doit d'abord récupérer les propriétés du propriétaire
      const { data: ownerProperties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", ownerIdParam);
      
      const propertyIds = ownerProperties?.map((p: any) => p.id) || [];
      if (propertyIds.length > 0) {
        query = query.in("property_id", propertyIds);
      } else {
        // Aucune propriété, donc aucun bail
        return NextResponse.json({
          leases: [],
          total: 0,
          page,
          limit,
          stats: {
            total: 0,
            draft: 0,
            pending_signature: 0,
            active: 0,
            terminated: 0,
          },
        });
      }
    }

    // Exécuter la requête avec pagination
    const { data: leases, count, error: queryError } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      console.error("Erreur récupération baux admin:", queryError);
      return NextResponse.json(
        { error: queryError.message || "Impossible d'afficher les baux" },
        { status: 500 }
      );
    }

    // Filtrer par recherche si fourni (côté serveur pour les grands datasets)
    let filteredLeases = leases || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLeases = filteredLeases.filter((lease: any) => {
        const property = lease.property;
        const owner = property?.owner;
        const signers = lease.signers || [];
        
        // Chercher dans l'adresse
        const addressMatch = property?.adresse_complete?.toLowerCase().includes(searchLower) ||
          property?.ville?.toLowerCase().includes(searchLower);
        
        // Chercher dans le nom du propriétaire
        const ownerMatch = `${owner?.prenom || ""} ${owner?.nom || ""}`.toLowerCase().includes(searchLower);
        
        // Chercher dans les noms des signataires (locataires)
        const signerMatch = signers.some((s: any) => 
          `${s.profile?.prenom || ""} ${s.profile?.nom || ""}`.toLowerCase().includes(searchLower)
        );
        
        return addressMatch || ownerMatch || signerMatch;
      });
    }

    // Calculer les stats globales
    const { data: statsData } = await supabase
      .from("leases")
      .select("statut");

    const stats = {
      total: statsData?.length || 0,
      draft: statsData?.filter((l: any) => l.statut === "draft").length || 0,
      pending_signature: statsData?.filter((l: any) => l.statut === "pending_signature").length || 0,
      active: statsData?.filter((l: any) => l.statut === "active").length || 0,
      terminated: statsData?.filter((l: any) => l.statut === "terminated").length || 0,
    };

    // Formater les données pour l'affichage
    const formattedLeases = filteredLeases.map((lease: any) => {
      const property = lease.property;
      const owner = property?.owner;
      const signers = lease.signers || [];
      
      // Trouver le locataire principal
      const mainTenant = signers.find((s: any) => s.role === "locataire_principal");
      const colocataires = signers.filter((s: any) => s.role === "colocataire");
      
      return {
        id: lease.id,
        type_bail: lease.type_bail,
        loyer: lease.loyer,
        charges_forfaitaires: lease.charges_forfaitaires,
        loyer_total: (lease.loyer || 0) + (lease.charges_forfaitaires || 0),
        depot_garantie: lease.depot_de_garantie,
        date_debut: lease.date_debut,
        date_fin: lease.date_fin,
        statut: lease.statut,
        created_at: lease.created_at,
        property: property ? {
          id: property.id,
          adresse_complete: property.adresse_complete,
          ville: property.ville,
          code_postal: property.code_postal,
          type: property.type,
        } : null,
        owner: owner ? {
          id: owner.id,
          nom_complet: `${owner.prenom || ""} ${owner.nom || ""}`.trim(),
          telephone: owner.telephone,
        } : null,
        tenant: mainTenant ? {
          id: mainTenant.profile?.id,
          nom_complet: `${mainTenant.profile?.prenom || ""} ${mainTenant.profile?.nom || ""}`.trim(),
          signature_status: mainTenant.signature_status,
        } : null,
        colocataires_count: colocataires.length,
        signers_count: signers.length,
        all_signed: signers.every((s: any) => s.signature_status === "signed"),
      };
    });

    return NextResponse.json({
      leases: formattedLeases,
      total: search ? filteredLeases.length : (count || 0),
      page,
      limit,
      stats,
    });
  } catch (err: any) {
    console.error("Error in GET /api/admin/leases:", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

