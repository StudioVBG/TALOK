export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { LeaseTemplateService } from "@/lib/templates/bail/template.service";
import { numberToWords } from "@/lib/helpers/format";
import type { BailComplet, TypeBail } from "@/lib/templates/bail/types";

interface PageProps {
  params: Promise<{ token: string }>;
}

// Décoder le token (format: leaseId:email:timestamp en base64url)
function decodeToken(token: string): { leaseId: string; tenantEmail: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [leaseId, tenantEmail, timestampStr] = decoded.split(":");
    if (!leaseId || !tenantEmail || !timestampStr) return null;
    return { leaseId, tenantEmail, timestamp: parseInt(timestampStr, 10) };
  } catch {
    return null;
  }
}

// Vérifier si le token est expiré (30 jours)
function isTokenExpired(timestamp: number): boolean {
  return Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000;
}

/**
 * Mapper les données du bail vers le format BailComplet
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
      nom: ownerProfile?.type === "societe" && ownerProfile?.raison_sociale
        ? ownerProfile.raison_sociale
        : ownerProfile?.nom || "[NOM PROPRIÉTAIRE]",
      prenom: ownerProfile?.type === "societe" ? "" : ownerProfile?.prenom || "[PRÉNOM]",
      adresse: ownerProfile?.adresse || ownerProfile?.adresse_facturation || "[ADRESSE PROPRIÉTAIRE]",
      code_postal: "",
      ville: "",
      email: ownerProfile?.email || "",
      telephone: ownerProfile?.telephone || "",
      type: ownerProfile?.type === "societe" ? "societe" : "particulier",
      raison_sociale: ownerProfile?.raison_sociale || "",
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
      // ✅ FIX: Passer le type de bailleur pour calcul durée correcte
      duree_mois: getDureeMois(lease.type_bail, ownerProfile?.type),
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
    },

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

    // Décoder le token
    const tokenData = decodeToken(token);
    if (!tokenData) {
      console.log("[Preview GET] ❌ Token invalide");
      return NextResponse.json(
        { error: "Lien d'invitation invalide" },
        { status: 404 }
      );
    }
    console.log("[Preview GET] Token décodé:", { leaseId: tokenData.leaseId, email: tokenData.tenantEmail });

    // Vérifier expiration
    if (isTokenExpired(tokenData.timestamp)) {
      console.log("[Preview GET] ❌ Token expiré");
      return NextResponse.json(
        { error: "Le lien d'invitation a expiré" },
        { status: 410 }
      );
    }

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
      .eq("id", tokenData.leaseId)
      .single();

    if (leaseError || !lease) {
      console.error("[Preview] Erreur récupération bail:", leaseError);
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer le profil propriétaire complet via owner_id
    const ownerId = lease.property?.owner_id;
    let ownerProfile: Record<string, any> = {};

    if (ownerId) {
      // D'abord le profil de base
      const { data: profileData } = await serviceClient
        .from("profiles")
        .select("id, prenom, nom, email, telephone")
        .eq("id", ownerId)
        .maybeSingle();
      
      if (profileData) {
        ownerProfile = { ...profileData };
      }
      
      // Puis les données propriétaire étendues
      const { data: ownerProfileData } = await serviceClient
        .from("owner_profiles")
        .select("*")
        .eq("profile_id", ownerId)
        .maybeSingle();

      if (ownerProfileData) {
        ownerProfile = { ...ownerProfile, ...ownerProfileData };
      }
    }

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
      .eq("lease_id", tokenData.leaseId)
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
      tokenData.tenantEmail
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

  } catch (error: any) {
    console.error("[Preview] Erreur API:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
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

    // Décoder le token
    const tokenData = decodeToken(token);
    if (!tokenData) {
      console.log("[Preview POST] ❌ Token invalide");
      return NextResponse.json(
        { error: "Lien d'invitation invalide" },
        { status: 404 }
      );
    }
    console.log("[Preview POST] Token décodé:", { leaseId: tokenData.leaseId });

    // Vérifier expiration
    if (isTokenExpired(tokenData.timestamp)) {
      console.log("[Preview POST] ❌ Token expiré");
      return NextResponse.json(
        { error: "Le lien d'invitation a expiré" },
        { status: 410 }
      );
    }

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
      .eq("id", tokenData.leaseId)
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

    // ✅ FIX: Récupérer le profil propriétaire via owner_id (pas owner.id qui n'existe pas)
    const ownerId = lease.property?.owner_id;
    let ownerProfile: Record<string, any> = {};

    if (ownerId) {
      // D'abord le profil de base
      const { data: profileData } = await serviceClient
        .from("profiles")
        .select("id, prenom, nom, email, telephone")
        .eq("id", ownerId)
        .maybeSingle();
      
      if (profileData) {
        ownerProfile = { ...profileData };
      }
      
      // Puis les données propriétaire étendues
      const { data: ownerProfileData } = await serviceClient
        .from("owner_profiles")
        .select("*")
        .eq("profile_id", ownerId)
        .maybeSingle();

      if (ownerProfileData) {
        ownerProfile = { ...ownerProfile, ...ownerProfileData };
      }
    }

    // Utiliser les données du locataire passées dans le body
    const tenantProfile = {
      nom: body.nom || "",
      prenom: body.prenom || "",
      email: body.email || tokenData.tenantEmail,
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
      tokenData.tenantEmail
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

  } catch (error: any) {
    console.error("[Preview POST] Erreur API:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}








