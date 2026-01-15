export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { LeaseTemplateService } from "@/lib/templates/bail";
import type { TypeBail, BailComplet, DiagnosticsTechniques } from "@/lib/templates/bail/types";

/**
 * GET /api/leases/[id]/html - Récupérer le HTML d'un bail (signé ou non)
 * ✅ FIX: Ajout des diagnostics et fallback pour locataire sans profil
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = params.id;
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

    // 2. Récupérer les infos du propriétaire
    const { data: ownerProfile } = await serviceClient
      .from("owner_profiles")
      .select("*, profile:profiles(*)")
      .eq("profile_id", lease.property.owner_id)
      .single();

    // 3. ✅ FIX: Récupérer les diagnostics depuis la table documents
    const { data: diagnosticsDocuments } = await serviceClient
      .from("documents")
      .select("*")
      .or(`property_id.eq.${lease.property.id},lease_id.eq.${leaseId}`)
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
        estimation_cout_min: lease.property.dpe_estimation_conso_min,
        estimation_cout_max: lease.property.dpe_estimation_conso_max,
      };
    }

    // Enrichir avec les documents s'ils existent
    if (diagnosticsDocuments) {
      for (const doc of diagnosticsDocuments) {
        const docType = doc.type?.toLowerCase();
        const metadata = doc.metadata || {};
        
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
    
    console.log("[Lease HTML] Found tenant signer:", tenantSigner ? {
      role: tenantSigner.role,
      hasProfile: !!tenantSigner.profile,
      profileName: tenantSigner.profile ? `${tenantSigner.profile.prenom} ${tenantSigner.profile.nom}` : null,
      invitedName: tenantSigner.invited_name,
      invitedEmail: tenantSigner.invited_email,
    } : "NONE");

    const tenant = tenantSigner?.profile;
    
    // ✅ FIX: Utiliser invited_name/invited_email si pas de profil
    let locataires: any[] = [];
    if (tenant && (tenant.prenom || tenant.nom)) {
      // Cas 1: Le profil est lié avec des données
      locataires = [{
        nom: tenant.nom || "",
        prenom: tenant.prenom || "",
        email: tenant.email || tenantSigner.invited_email || "",
        telephone: tenant.telephone || "",
        date_naissance: tenant.date_naissance || "",
        lieu_naissance: tenant.lieu_naissance || "", // ✅ SOTA 2026: Récupérer lieu_naissance du profil
      }];
      console.log("[Lease HTML] Using profile data:", locataires[0]);
    } else if (tenantSigner?.invited_name && tenantSigner.invited_name.trim() !== "") {
      // Cas 2: Pas de profil mais on a un nom d'invitation
      const invitedName = tenantSigner.invited_name.trim();
      const nameParts = invitedName.split(" ");
      locataires = [{
        nom: nameParts.length > 1 ? nameParts.slice(1).join(" ") : invitedName,
        prenom: nameParts.length > 1 ? nameParts[0] : "",
        email: tenantSigner.invited_email || "",
        telephone: "",
        date_naissance: "",
        lieu_naissance: "",
      }];
      console.log("[Lease HTML] Using invited_name:", locataires[0]);
    } else if (tenantSigner?.invited_email && !tenantSigner.invited_email.includes('@a-definir')) {
      // Cas 3: Pas de nom mais on a un vrai email - extraire le nom de l'email
      const emailName = tenantSigner.invited_email.split('@')[0].replace(/[._]/g, ' ');
      locataires = [{
        nom: emailName,
        prenom: "",
        email: tenantSigner.invited_email,
        telephone: "",
        date_naissance: "",
        lieu_naissance: "",
      }];
      console.log("[Lease HTML] Using email extraction:", locataires[0]);
    } else {
      // Cas 4: Aucune donnée exploitable
      locataires = [{
        nom: "[EN ATTENTE DE LOCATAIRE]",
        prenom: "",
        email: "",
        telephone: "",
        date_naissance: "",
        lieu_naissance: "",
      }];
      console.log("[Lease HTML] No tenant data found, using placeholder");
    }

    // ✅ FIX: Générer les URLs signées AVANT de créer bailData
    // On s'assure de modifier l'objet lease.signers lui-même
    if (lease.signers) {
      for (const signer of lease.signers) {
        if (signer.signature_image_path) {
          console.log(`[Lease HTML] Generating signed URL for ${signer.role}: ${signer.signature_image_path}`);
          try {
            const { data: signedUrl, error: urlError } = await serviceClient.storage
              .from("documents")
              .createSignedUrl(signer.signature_image_path, 3600);
            
            if (signedUrl?.signedUrl) {
              signer.signature_image = signedUrl.signedUrl;
              console.log(`[Lease HTML] ✅ Signed URL generated for ${signer.role}`);
            } else {
              console.log(`[Lease HTML] ❌ Failed to generate signed URL for ${signer.role}:`, urlError);
            }
          } catch (err) {
            console.error(`[Lease HTML] Error signing URL for ${signer.role}:`, err);
          }
        }
      }
    }

    const bailData: Partial<BailComplet> = {
      reference: lease.id.slice(0, 8).toUpperCase(),
      date_signature: lease.date_signature || lease.created_at,
      lieu_signature: lease.property?.ville || "N/A",
      bailleur: {
        nom: ownerProfile?.raison_sociale || ownerProfile?.profile?.nom || "",
        prenom: ownerProfile?.type === 'societe' ? "" : (ownerProfile?.profile?.prenom || ""),
        adresse: ownerProfile?.adresse_facturation || lease.property?.adresse_complete || "",
        code_postal: lease.property?.code_postal || "",
        ville: lease.property?.ville || "",
        type: ownerProfile?.type || "particulier",
        est_mandataire: false,
        // Pour société
        raison_sociale: ownerProfile?.raison_sociale || "",
        representant_nom: ownerProfile?.profile ? `${ownerProfile.profile.prenom || ""} ${ownerProfile.profile.nom || ""}`.trim() : "",
        representant_qualite: ownerProfile?.type === 'societe' ? "Gérant" : undefined,
      },
      locataires,
      logement: {
        adresse_complete: lease.property?.adresse_complete || "",
        code_postal: lease.property?.code_postal || "",
        ville: lease.property?.ville || "",
        type: lease.property?.type || "appartement",
        surface_habitable: lease.property?.surface || lease.property?.surface_habitable_m2 || 0,
        nb_pieces_principales: lease.property?.nb_pieces || 1,
        etage: lease.property?.etage,
        nb_etages_immeuble: lease.property?.nb_etages_immeuble,
        ascenseur: lease.property?.ascenseur,
        regime: lease.property?.regime || "mono_propriete",
        annee_construction: lease.property?.annee_construction,
        chauffage_type: lease.property?.chauffage_type,
        chauffage_energie: lease.property?.chauffage_energie,
        eau_chaude_type: lease.property?.eau_chaude_type,
        equipements_privatifs: lease.property?.equipments || [],
        annexes: [],
      },
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
  } catch (error: any) {
    console.error("[Lease HTML] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
