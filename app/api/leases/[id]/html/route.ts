export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { LeaseTemplateService } from "@/lib/templates/bail";
import { resolveOwnerIdentity } from "@/lib/entities/resolveOwnerIdentity";
import type { TypeBail, BailComplet, DiagnosticsTechniques, Logement, Bailleur, Annexe } from "@/lib/templates/bail/types";
import { resolveTenantDisplay } from "@/lib/helpers/resolve-tenant-display";

/**
 * GET /api/leases/[id]/html - Récupérer le HTML d'un bail (signé ou non)
 * FIX: Ajout des diagnostics et fallback pour locataire sans profil
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = id;
    const serviceClient = getServiceClient();

    // 1. Récupérer les données complètes du bail avec invited_email/invited_name
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties (*),
        signers:lease_signers (
          id,
          role,
          signature_status,
          signed_at,
          profile_id,
          invited_email,
          invited_name,
          signature_image_path,
          ip_inet,
          user_agent,
          proof_id,
          document_hash,
          proof_metadata,
          profile:profiles(id, prenom, nom, email, telephone, date_naissance, lieu_naissance)
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      console.error("[Lease HTML] Lease not found:", leaseError);
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // 1b. Vérifier que l'utilisateur a accès à ce bail (propriétaire, signataire ou admin)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const isOwner = (lease.property as { owner_id?: string } | null)?.owner_id === profile.id;
    const { data: signer } = await serviceClient
      .from("lease_signers")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    const isAdmin = profile.role === "admin";

    if (!isOwner && !signer && !isAdmin) {
      return NextResponse.json({ error: "Accès non autorisé à ce bail" }, { status: 403 });
    }

    // 2. Résoudre l'identité du propriétaire via le résolveur centralisé (entity-first + fallback)
    const ownerIdentity = await resolveOwnerIdentity(serviceClient, {
      leaseId,
      propertyId: lease.property!.id,
      profileId: lease.property!.owner_id,
    });

    // 3. ✅ FIX: Récupérer les diagnostics depuis la table documents
    const { data: diagnosticsDocuments } = await serviceClient
      .from("documents")
      .select("*")
      .or(`property_id.eq.${lease.property!.id},lease_id.eq.${leaseId}`)
      .in("type", [
        "diagnostic_performance", "dpe",
        "crep", "plomb",
        "electricite", "gaz",
        "erp", "risques",
        "amiante", "bruit"
      ])
      .eq("is_archived", false);

    // Mapper les documents en diagnostics
    const diagnostics: Partial<DiagnosticsTechniques> = {};
    
    // ✅ FIX: Utiliser les données DPE du bien si pas de document
    if (lease.property?.dpe_classe_energie || lease.property?.energie) {
      diagnostics.dpe = {
        date_realisation: new Date().toISOString(),
        date_validite: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(), // +10 ans
        classe_energie: (lease.property.dpe_classe_energie || lease.property.energie || "D") as any,
        classe_ges: (lease.property.dpe_classe_climat || lease.property.ges || "D") as any,
        consommation_energie: lease.property.dpe_consommation || 0,
        emissions_ges: lease.property.dpe_emissions || 0,
        estimation_cout_min: lease.property.dpe_estimation_conso_min ?? undefined,
        estimation_cout_max: lease.property.dpe_estimation_conso_max ?? undefined,
      };
    }

    // Enrichir avec les documents s'ils existent
    if (diagnosticsDocuments) {
      for (const doc of diagnosticsDocuments) {
        const docType = doc.type?.toLowerCase();
        const metadata = (doc.metadata || {}) as Record<string, any>;
        
        if (docType?.includes("dpe") || docType?.includes("performance")) {
          diagnostics.dpe = {
            date_realisation: doc.created_at,
            date_validite: doc.expiry_date || new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
            classe_energie: metadata.classe_energie || diagnostics.dpe?.classe_energie || "D",
            classe_ges: metadata.classe_ges || diagnostics.dpe?.classe_ges || "D",
            consommation_energie: metadata.consommation || diagnostics.dpe?.consommation_energie || 0,
            emissions_ges: metadata.emissions || diagnostics.dpe?.emissions_ges || 0,
          };
        }
        if (docType?.includes("crep") || docType?.includes("plomb")) {
          diagnostics.crep = {
            date_realisation: doc.created_at,
            presence_plomb: metadata.presence_plomb || false,
          };
        }
        if (docType?.includes("electricite")) {
          diagnostics.electricite = {
            date_realisation: doc.created_at,
            date_validite: doc.expiry_date || "",
            anomalies_detectees: metadata.anomalies || false,
            nb_anomalies: metadata.nb_anomalies || 0,
          };
        }
        if (docType?.includes("gaz")) {
          diagnostics.gaz = {
            date_realisation: doc.created_at,
            date_validite: doc.expiry_date || "",
            anomalies_detectees: metadata.anomalies || false,
            type_anomalie: metadata.type_anomalie,
          };
        }
        if (docType?.includes("erp") || docType?.includes("risque")) {
          diagnostics.erp = {
            date_realisation: doc.created_at,
            risques_identifies: metadata.risques || [],
          };
        }
      }
    }

    const typeBail = (lease.type_bail || "meuble") as TypeBail;
    
    // 4. ✅ FIX: Préparer les données locataire avec fallback pour invited_email/invited_name
    // On trie les signataires pour mettre ceux qui ont signé en premier, puis ceux avec un profil
    const sortedSigners = (lease.signers || []).sort((a: any, b: any) => {
      // Priorité 1: Ceux qui ont signé
      if (a.signature_status === 'signed' && b.signature_status !== 'signed') return -1;
      if (a.signature_status !== 'signed' && b.signature_status === 'signed') return 1;
      // Priorité 2: Ceux avec un profil lié
      if (a.profile?.id && !b.profile?.id) return -1;
      if (!a.profile?.id && b.profile?.id) return 1;
      // Priorité 3: Ceux avec un vrai email (pas placeholder)
      const aHasRealEmail = a.invited_email && !a.invited_email.includes('@a-definir');
      const bHasRealEmail = b.invited_email && !b.invited_email.includes('@a-definir');
      if (aHasRealEmail && !bHasRealEmail) return -1;
      if (!aHasRealEmail && bHasRealEmail) return 1;
      return 0;
    });

    console.log("[Lease HTML] Signers after sorting:", sortedSigners.map((s: any) => ({
      role: s.role,
      status: s.signature_status,
      hasProfile: !!s.profile?.id,
      profileName: s.profile ? `${s.profile.prenom} ${s.profile.nom}` : null,
      invitedName: s.invited_name,
      invitedEmail: s.invited_email,
    })));

    const tenantSigner = sortedSigners.find((s: any) => {
      const role = s.role?.toLowerCase() || "";
      return role.includes("locataire") || role.includes("tenant") || role === "principal";
    });

    // SOTA 2026: Résolution centralisée (profile → invited_name → invited_email → placeholder)
    const tenantDisplay = resolveTenantDisplay(tenantSigner);
    const locataires: any[] = [{
      nom: tenantDisplay.nom,
      prenom: tenantDisplay.prenom,
      email: tenantDisplay.email,
      telephone: tenantDisplay.telephone,
      date_naissance: tenantDisplay.dateNaissance,
      lieu_naissance: tenantDisplay.lieuNaissance,
    }];

    // ✅ FIX: Générer les URLs signées AVANT de créer bailData
    // Exposer l'URL dans signature_image (lu par le template) ; garder signature_image_path pour la preuve
    if (lease.signers) {
      for (const signer of lease.signers) {
        if (signer.signature_image_path) {
          const path = signer.signature_image_path;
          try {
            const { data: signedUrl, error: urlError } = await serviceClient.storage
              .from("documents")
              .createSignedUrl(path, 3600);
            if (signedUrl?.signedUrl) {
              (signer as any).signature_image = signedUrl.signedUrl;
            } else if (urlError) {
              console.warn(`[Lease HTML] Failed to generate signed URL for ${signer.role}:`, urlError);
            }
          } catch (err) {
            console.error(`[Lease HTML] Error signing URL for ${signer.role}:`, err);
          }
        }
      }
    }

    const bailData: Partial<BailComplet> = {
      reference: lease.id.slice(0, 8).toUpperCase(),
      date_signature: (lease as any).date_signature || lease.created_at,
      lieu_signature: lease.property?.ville || "N/A",
      bailleur: {
        nom: ownerIdentity.entityType === "company" ? (ownerIdentity.companyName || "") : ownerIdentity.lastName,
        prenom: ownerIdentity.entityType === "company" ? "" : ownerIdentity.firstName,
        adresse: ownerIdentity.address.street || lease.property?.adresse_complete || "",
        code_postal: ownerIdentity.address.postalCode || lease.property?.code_postal || "",
        ville: ownerIdentity.address.city || lease.property?.ville || "",
        type: (ownerIdentity.entityType === "company" ? "societe" : "particulier") as Bailleur['type'],
        est_mandataire: false,
        raison_sociale: ownerIdentity.companyName || "",
        siret: ownerIdentity.siret ?? undefined,
        representant_nom: ownerIdentity.representative
          ? `${ownerIdentity.representative.firstName} ${ownerIdentity.representative.lastName}`.trim()
          : `${ownerIdentity.firstName} ${ownerIdentity.lastName}`.trim(),
        representant_qualite: ownerIdentity.representative?.role || (ownerIdentity.entityType === "company" ? "Gérant" : undefined),
      },
      locataires,
      logement: (() => {
        const prop = lease.property as Record<string, unknown> | null;
        const year = typeof prop?.annee_construction === "number" ? prop.annee_construction : undefined;
        let epoque_construction: Logement["epoque_construction"] | undefined;
        if (year != null) {
          if (year < 1949) epoque_construction = "avant_1949";
          else if (year <= 1974) epoque_construction = "1949_1974";
          else if (year <= 1989) epoque_construction = "1975_1989";
          else if (year <= 2005) epoque_construction = "1990_2005";
          else epoque_construction = "apres_2005";
        }
        const annexes: Annexe[] = [];
        if (prop?.has_balcon) annexes.push({ type: "balcon" });
        if (prop?.has_terrasse) annexes.push({ type: "terrasse" });
        if (prop?.has_cave) annexes.push({ type: "cave" });
        if (prop?.has_jardin) annexes.push({ type: "jardin" });
        if (prop?.has_parking) annexes.push({ type: "parking" });
        return {
          adresse_complete: lease.property?.adresse_complete || "",
          code_postal: lease.property?.code_postal || "",
          ville: lease.property?.ville || "",
          type: (lease.property?.type || "appartement") as Logement["type"],
          surface_habitable: lease.property?.surface || lease.property?.surface_habitable_m2 || 0,
          nb_pieces_principales: lease.property?.nb_pieces || 1,
          etage: lease.property?.etage ?? undefined,
          nb_etages_immeuble: lease.property?.nb_etages_immeuble ?? undefined,
          ascenseur: lease.property?.ascenseur,
          regime: (lease.property?.regime || "mono_propriete") as Logement["regime"],
          annee_construction: lease.property?.annee_construction ?? undefined,
          epoque_construction,
          chauffage_type: lease.property?.chauffage_type as Logement["chauffage_type"],
          chauffage_energie: lease.property?.chauffage_energie as Logement["chauffage_energie"],
          eau_chaude_type: lease.property?.eau_chaude_type as Logement["eau_chaude_type"],
          equipements_privatifs: (lease.property?.equipments as string[] | null) || [],
          annexes,
        };
      })(),
      conditions: {
        type_bail: typeBail,
        usage: "habitation_principale",
        date_debut: lease.date_debut,
        date_fin: lease.date_fin,
        duree_mois: typeBail === "meuble" ? 12 : 36,
        tacite_reconduction: true,
        loyer_hc: lease.loyer,
        loyer_en_lettres: "",
        charges_type: "forfait",
        charges_montant: lease.charges_forfaitaires || 0,
        depot_garantie: lease.depot_de_garantie || 0,
        depot_garantie_en_lettres: "",
        mode_paiement: "virement",
        jour_paiement: 5,
        periodicite_paiement: "mensuelle",
        paiement_avance: true,
        revision_autorisee: true,
        indice_reference: "IRL",
      } as any,
      // ✅ FIX: Ajouter les diagnostics
      diagnostics: Object.keys(diagnostics).length > 0 ? diagnostics as DiagnosticsTechniques : undefined,
      signers: lease.signers,
    };

    // 5. Générer le HTML
    const html = LeaseTemplateService.generateHTML(typeBail, bailData);

    return NextResponse.json({
      html,
      fileName: `Bail_${typeBail}_${lease.property?.ville || "document"}.pdf`
    });
  } catch (error: unknown) {
    console.error("[Lease HTML] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
