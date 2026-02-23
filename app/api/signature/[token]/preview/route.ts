export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { LeaseTemplateService } from "@/lib/templates/bail/template.service";
import { numberToWords } from "@/lib/helpers/format";
import { resolveOwnerIdentity } from "@/lib/entities/resolveOwnerIdentity";
import type { BailComplet, TypeBail } from "@/lib/templates/bail/types";
import { verifyTokenCompat } from "@/lib/utils/secure-token";

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * Mapper les données du bail vers le format BailComplet
 * ownerProfile: OwnerIdentity from resolveOwnerIdentity or legacy raw object
 */
function mapLeaseToTemplateData(
  lease: any,
  property: any,
  ownerProfile: any,
  tenantProfile: any,
  tenantEmail: string
): Partial<BailComplet> {
  // Calcul du dépôt de garantie légal
  const getMaxDepotLegal = (typeBail: string, loyerHC: number): number => {
    switch (typeBail) {
      case "nu":
      case "etudiant":
        return loyerHC * 1;
      case "meuble":
      case "colocation":
        return loyerHC * 2;
      case "mobilite":
        return 0;
      case "saisonnier":
        return loyerHC * 2;
      default:
        return loyerHC;
    }
  };

  // Calcul de la durée par défaut selon le type de bail
  // ✅ FIX: Prend en compte le type de bailleur (société = 6 ans pour bail nu)
  const getDureeMois = (type: string, bailleurType?: string): number => {
    switch (type) {
      case "meuble":
        return 12;
      case "nu":
        // 6 ans (72 mois) si bailleur personne morale, 3 ans sinon
        return bailleurType === "societe" ? 72 : 36;
      case "mobilite":
        return 10;
      case "saisonnier":
        if (lease.date_debut && lease.date_fin) {
          const start = new Date(lease.date_debut);
          const end = new Date(lease.date_fin);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return Math.ceil(diffDays / 30);
        }
        return 1;
      default:
        return bailleurType === "societe" ? 72 : 36;
    }
  };

  // Déterminer le jour de paiement
  const jourPaiement = lease.jour_paiement || 5;
  // ✅ FIX: Terme à échoir si jour ≤ 10
  const paiementAvance = jourPaiement <= 10;

  const loyer = lease.loyer ?? property?.loyer_hc ?? 0;
  const charges = lease.charges_forfaitaires ?? property?.charges_mensuelles ?? 0;
  const depotGarantie = lease.depot_de_garantie ?? getMaxDepotLegal(lease.type_bail, loyer);

  // Surface
  const surface = property?.surface_habitable_m2 || property?.surface || 0;

  return {
    reference: lease.id ? lease.id.slice(0, 8).toUpperCase() : "DRAFT",
    date_signature: new Date().toISOString(),
    lieu_signature: property?.ville || "...",

    bailleur: {
      nom: ownerProfile?.displayName || ownerProfile?.nom || "[NOM PROPRIÉTAIRE]",
      prenom: ownerProfile?.entityType === "company" ? "" : (ownerProfile?.firstName || ownerProfile?.prenom || "[PRÉNOM]"),
      adresse: ownerProfile?.address?.street || ownerProfile?.adresse || ownerProfile?.adresse_facturation || "[ADRESSE PROPRIÉTAIRE]",
      code_postal: ownerProfile?.address?.postalCode || "",
      ville: ownerProfile?.address?.city || "",
      email: ownerProfile?.email || "",
      telephone: ownerProfile?.phone || ownerProfile?.telephone || "",
      type: ownerProfile?.entityType === "company" ? "societe" : "particulier",
      raison_sociale: ownerProfile?.companyName || ownerProfile?.raison_sociale || "",
      siret: ownerProfile?.siret ?? undefined,
      representant_nom: ownerProfile?.representative
        ? `${ownerProfile.representative.firstName} ${ownerProfile.representative.lastName}`.trim()
        : undefined,
      representant_qualite: ownerProfile?.representative?.role || undefined,
      est_mandataire: false,
    },

    locataires: [{
      nom: tenantProfile?.nom || lease.tenant_name_pending?.split(" ").slice(1).join(" ") || "[NOM LOCATAIRE]",
      prenom: tenantProfile?.prenom || lease.tenant_name_pending?.split(" ")[0] || "[PRÉNOM]",
      email: tenantProfile?.email || tenantEmail || "",
      telephone: tenantProfile?.telephone || "",
      date_naissance: tenantProfile?.date_naissance || "",
      lieu_naissance: tenantProfile?.lieu_naissance || "",
      nationalite: tenantProfile?.nationalite || "Française",
    }],

    logement: {
      adresse_complete: property?.adresse_complete || property?.adresse || "",
      code_postal: property?.code_postal || "",
      ville: property?.ville || "",
      type: (property?.type as any) || "appartement",
      surface_habitable: surface || 0,
      nb_pieces_principales: property?.nb_pieces || 1,
      etage: property?.etage,
      epoque_construction: property?.annee_construction ? String(property.annee_construction) as any : undefined,
      chauffage_type: property?.chauffage_type || undefined,
      eau_chaude_type: property?.eau_chaude_type || undefined,
      regime: "mono_propriete",
      equipements_privatifs: [],
      annexes: [],
    },

    conditions: {
      type_bail: lease.type_bail || "nu",
      usage: "habitation_principale",
      date_debut: lease.date_debut,
      date_fin: lease.date_fin,
      // Passer le type de bailleur pour calcul durée correcte
      duree_mois: getDureeMois(lease.type_bail, ownerProfile?.entityType === "company" ? "societe" : "particulier"),
      loyer_hc: loyer,
      loyer_en_lettres: numberToWords(loyer),
      charges_montant: charges,
      // ✅ FIX: Ajouter le total en lettres
      loyer_total: loyer + charges,
      loyer_total_en_lettres: numberToWords(loyer + charges),
      depot_garantie: depotGarantie,
      depot_garantie_en_lettres: numberToWords(depotGarantie),
      mode_paiement: "virement",
      periodicite_paiement: "mensuelle",
      jour_paiement: jourPaiement,
      tacite_reconduction: ["nu", "meuble"].includes(lease.type_bail),
      charges_type: "provisions",
      revision_autorisee: true,
      indice_reference: "IRL",
      // ✅ FIX: Terme à échoir si paiement en début de mois
      paiement_avance: paiementAvance,
    } as any,

    diagnostics: {
      dpe: {
        date_realisation: "",
        date_validite: "",
        classe_energie: property?.dpe_classe_energie || property?.energie || undefined,
        classe_ges: property?.dpe_classe_climat || property?.ges || undefined,
        consommation_energie: property?.dpe_consommation || 0,
        emissions_ges: 0,
      }
    },
  };
}

/**
 * GET /api/signature/[token]/preview
 * Retourne le HTML du bail formaté A4 pour prévisualisation
 */
export async function GET(request: Request, { params }: PageProps) {
  try {
    const { token } = await params;
    console.log("[Preview GET] Token reçu:", token?.substring(0, 20) + "...");

    // FIX: Utiliser verifyTokenCompat pour supporter les deux formats (HMAC + legacy)
    const tokenData = verifyTokenCompat(token, 7);
    if (!tokenData) {
      console.log("[Preview GET] ❌ Token invalide ou expiré");
      return NextResponse.json(
        { error: "Lien d'invitation invalide ou expiré" },
        { status: 410 }
      );
    }
    const leaseId = tokenData.entityId;
    const tenantEmail = tokenData.email;
    console.log("[Preview GET] Token décodé:", { leaseId, email: tenantEmail });

    const serviceClient = getServiceClient();

    // Récupérer le bail avec property et owner
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties(
          id,
          adresse_complete,
          code_postal,
          ville,
          type,
          surface,
          surface_habitable_m2,
          nb_pieces,
          etage,
          dpe_classe_energie,
          dpe_classe_climat,
          dpe_consommation,
          chauffage_type,
          eau_chaude_type,
          loyer_hc,
          charges_mensuelles,
          owner_id
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      console.error("[Preview] Erreur récupération bail:", leaseError);
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Résoudre l'identité du propriétaire via le résolveur centralisé (entity-first + fallback)
    const ownerProfile = await resolveOwnerIdentity(serviceClient, {
      leaseId,
      propertyId: lease.property?.id,
      profileId: lease.property?.owner_id,
    });

    // Récupérer le profil locataire s'il existe
    // ✅ FIX: Ajouter les colonnes manquantes (date_naissance, lieu_naissance, etc.)
    let tenantProfile = null;
    const { data: signerData } = await serviceClient
      .from("lease_signers")
      .select(`
        profile:profiles(
          id,
          nom,
          prenom,
          email,
          telephone,
          date_naissance,
          lieu_naissance,
          nationalite,
          adresse
        )
      `)
      .eq("lease_id", leaseId)
      .eq("role", "locataire_principal")
      .maybeSingle();

    if (signerData?.profile) {
      tenantProfile = signerData.profile;

      // Récupérer tenant_profiles si existe
      const { data: tenantProfileData } = await serviceClient
        .from("tenant_profiles")
        .select("*")
        .eq("profile_id", tenantProfile.id)
        .maybeSingle();

      if (tenantProfileData) {
        tenantProfile = { ...tenantProfile, ...tenantProfileData };
      }
    }

    // Mapper les données vers BailComplet
    const bailData = mapLeaseToTemplateData(
      lease,
      lease.property,
      ownerProfile,
      tenantProfile,
      tenantEmail
    );

    // Générer le HTML
    const typeBail = (lease.type_bail || "nu") as TypeBail;
    const html = LeaseTemplateService.generateHTML(typeBail, bailData);

    return NextResponse.json({
      success: true,
      html,
      typeBail,
      leaseId: lease.id,
    });

  } catch (error: unknown) {
    console.error("[Preview] Erreur API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/signature/[token]/preview
 * Met à jour les données locataire et retourne le HTML mis à jour
 */
export async function POST(request: Request, { params }: PageProps) {
  try {
    const { token } = await params;
    const body = await request.json();
    console.log("[Preview POST] Token reçu, données profil:", { nom: body.nom, prenom: body.prenom });

    // FIX: Utiliser verifyTokenCompat pour supporter les deux formats (HMAC + legacy)
    const tokenDataPost = verifyTokenCompat(token, 7);
    if (!tokenDataPost) {
      console.log("[Preview POST] ❌ Token invalide ou expiré");
      return NextResponse.json(
        { error: "Lien d'invitation invalide ou expiré" },
        { status: 410 }
      );
    }
    const postLeaseId = tokenDataPost.entityId;
    const postTenantEmail = tokenDataPost.email;
    console.log("[Preview POST] Token décodé:", { leaseId: postLeaseId });

    const serviceClient = getServiceClient();

    // Récupérer le bail avec property et owner
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties(
          id,
          adresse_complete,
          code_postal,
          ville,
          type,
          surface,
          surface_habitable_m2,
          nb_pieces,
          etage,
          dpe_classe_energie,
          dpe_classe_climat,
          dpe_consommation,
          chauffage_type,
          eau_chaude_type,
          loyer_hc,
          charges_mensuelles,
          owner_id
        )
      `)
      .eq("id", postLeaseId)
      .single();

    if (leaseError || !lease) {
      console.error("[Preview POST] ❌ Erreur récupération bail:", leaseError?.message || "Bail non trouvé");
      console.error("[Preview POST] ❌ Détails:", JSON.stringify(leaseError, null, 2));
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }
    
    console.log("[Preview POST] ✅ Bail trouvé:", lease.id, "Type:", lease.type_bail);

    // Résoudre l'identité du propriétaire via le résolveur centralisé (entity-first + fallback)
    const ownerProfile = await resolveOwnerIdentity(serviceClient, {
      leaseId: postLeaseId,
      propertyId: lease.property?.id,
      profileId: lease.property?.owner_id,
    });

    // Utiliser les données du locataire passées dans le body
    const tenantProfile = {
      nom: body.nom || "",
      prenom: body.prenom || "",
      email: body.email || postTenantEmail,
      telephone: body.telephone || "",
      date_naissance: body.dateNaissance || "",
      lieu_naissance: body.lieuNaissance || "",
      nationalite: body.nationalite || "Française",
    };

    // Mapper les données vers BailComplet
    const bailData = mapLeaseToTemplateData(
      lease,
      lease.property,
      ownerProfile,
      tenantProfile,
      postTenantEmail
    );

    // Générer le HTML
    const typeBail = (lease.type_bail || "nu") as TypeBail;
    const html = LeaseTemplateService.generateHTML(typeBail, bailData);

    return NextResponse.json({
      success: true,
      html,
      typeBail,
      leaseId: lease.id,
    });

  } catch (error: unknown) {
    console.error("[Preview POST] Erreur API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}








