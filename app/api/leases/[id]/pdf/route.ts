export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Route: Génération et téléchargement du PDF d'un bail
 * GET /api/leases/[id]/pdf
 * 
 * PATTERN: Création unique → Lectures multiples
 * 1. Calculer le hash des données du bail
 * 2. Vérifier si un PDF avec ce hash existe déjà
 * 3. Si oui → retourner URL signée (LECTURE)
 * 4. Si non → générer, stocker, puis retourner (CRÉATION)
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { LeaseTemplateService } from "@/lib/templates/bail";
import type { TypeBail, BailComplet } from "@/lib/templates/bail/types";
import crypto from "crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;

    if (!leaseId) {
      return NextResponse.json(
        { error: "ID du bail requis" },
        { status: 400 }
      );
    }

    // Vérifier l'authentification
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer le profil de l'utilisateur
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom, telephone, date_naissance")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer le bail avec toutes les données associées
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties (
          id,
          owner_id,
          adresse_complete,
          code_postal,
          ville,
          type,
          surface,
          nb_pieces,
          etage,
          energie,
          ges,
          loyer_hc,
          loyer_base,
          charges_forfaitaires,
          charges_mensuelles
        ),
        signers:lease_signers (
          id,
          role,
          signature_status,
          signed_at,
          profile:profiles (
            id,
            prenom,
            nom,
            telephone,
            date_naissance
          )
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier les permissions
    const property = lease.property as any;
    const isOwner = property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";
    const isSigner = (lease.signers as any[])?.some(s => s.profile?.id === profile.id);

    if (!isOwner && !isAdmin && !isSigner) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à voir ce bail" },
        { status: 403 }
      );
    }

    // === CALCUL DU HASH basé sur les données clés du bail ===
    // Le hash change si les données importantes du bail changent
    const isDraft = lease.statut === "draft";
    const finalLoyer = isDraft 
      ? (property?.loyer_hc ?? property?.loyer_base ?? lease.loyer ?? 0)
      : (lease.loyer ?? 0);
    const finalCharges = isDraft 
      ? (property?.charges_forfaitaires ?? property?.charges_mensuelles ?? lease.charges_forfaitaires ?? 0)
      : (lease.charges_forfaitaires ?? 0);

    const dataHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({
        lease_id: leaseId,
        type_bail: lease.type_bail,
        loyer: finalLoyer,
        charges: finalCharges,
        depot: lease.depot_de_garantie,
        date_debut: lease.date_debut,
        date_fin: lease.date_fin,
        statut: lease.statut,
        updated_at: lease.updated_at,
        signers_count: (lease.signers as any[])?.length || 0,
      }))
      .digest("hex")
      .slice(0, 16); // Hash court pour le nom de fichier

    // === VÉRIFICATION CACHE: Le document existe-t-il déjà ? ===
    const { data: existingDoc } = await serviceClient
      .from("documents")
      .select("id, storage_path, metadata")
      .eq("type", "bail")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Si document existe ET hash identique → LECTURE (pas de régénération)
    if (existingDoc?.storage_path && (existingDoc.metadata as any)?.hash === dataHash) {
      const { data: signedUrl, error: urlError } = await serviceClient.storage
        .from("documents")
        .createSignedUrl(existingDoc.storage_path, 3600); // 1h

      if (!urlError && signedUrl?.signedUrl) {
        // Journaliser l'accès en lecture
        await serviceClient.from("audit_log").insert({
          user_id: user.id,
          action: "read",
          entity_type: "document",
          entity_id: existingDoc.id,
          metadata: { type: "bail", cached: true },
        } as any);

        return NextResponse.redirect(signedUrl.signedUrl);
      }
    }

    // === CRÉATION: Données ont changé ou document n'existe pas ===
    
    // Récupérer les infos du propriétaire
    const { data: ownerProfile } = await serviceClient
      .from("owner_profiles")
      .select("*")
      .eq("profile_id", property.owner_id)
      .single();

    const typeBail = (lease.type_bail || "meuble") as TypeBail;
    const tenantSigner = (lease.signers as any[])?.find(s => s.role === "locataire_principal");
    const tenant = tenantSigner?.profile;
    const isOwnerSociete = ownerProfile?.type === "societe" && ownerProfile?.raison_sociale;
    const ownerAddress = ownerProfile?.adresse_facturation || ownerProfile?.adresse_siege || "";

    const finalDepot = isDraft
      ? (lease.depot_de_garantie ?? finalLoyer)
      : (lease.depot_de_garantie ?? 0);

    // Construire les données du bail selon le format attendu
    const bailData: Partial<BailComplet> = {
      reference: leaseId.slice(0, 8).toUpperCase(),
      date_signature: lease.created_at,
      lieu_signature: property?.ville || "",
      
      bailleur: {
        nom: isOwnerSociete ? ownerProfile.raison_sociale : (profile.nom || ""),
        prenom: isOwnerSociete ? "" : (profile.prenom || ""),
        date_naissance: isOwnerSociete ? undefined : profile.date_naissance,
        adresse: ownerAddress || `${property?.adresse_complete}, ${property?.code_postal} ${property?.ville}`,
        code_postal: "",
        ville: "",
        telephone: profile.telephone || "",
        type: ownerProfile?.type || "particulier",
        siret: ownerProfile?.siret,
        raison_sociale: ownerProfile?.raison_sociale || "",
        est_mandataire: false,
      },

      locataires: tenant ? [{
        nom: tenant.nom || lease.tenant_name_pending || "",
        prenom: tenant.prenom || "",
        date_naissance: tenant.date_naissance,
        lieu_naissance: "",
        nationalite: "Française",
        telephone: tenant.telephone || "",
      }] : lease.tenant_name_pending ? [{
        nom: lease.tenant_name_pending,
        prenom: "",
        date_naissance: undefined,
        lieu_naissance: "",
        nationalite: "Française",
        telephone: "",
      }] : [],

      logement: {
        adresse_complete: property?.adresse_complete || "",
        code_postal: property?.code_postal || "",
        ville: property?.ville || "",
        type: property?.type || "appartement",
        surface_habitable: property?.surface || 0,
        nb_pieces_principales: property?.nb_pieces || 1,
        etage: property?.etage,
        nb_etages_immeuble: undefined,
        epoque_construction: "apres_2005",
        regime: "mono_propriete",
        chauffage_type: "individuel",
        chauffage_energie: "electricite",
        eau_chaude_type: "individuel",
        eau_chaude_energie: "electricite",
        equipements_privatifs: [],
        parties_communes: [],
        annexes: [],
      },

      conditions: {
        date_debut: lease.date_debut,
        date_fin: lease.date_fin,
        duree_mois: typeBail === "nu" ? 36 : typeBail === "meuble" ? 12 : 12,
        tacite_reconduction: true,
        loyer_hc: parseFloat(String(finalLoyer)) || 0,
        loyer_en_lettres: numberToWords(parseFloat(String(finalLoyer)) || 0),
        charges_montant: parseFloat(String(finalCharges)) || 0,
        charges_type: "forfait",
        depot_garantie: parseFloat(String(finalDepot)) || 0,
        depot_garantie_en_lettres: numberToWords(parseFloat(String(finalDepot)) || 0),
        mode_paiement: "virement",
        periodicite_paiement: "mensuelle",
        jour_paiement: 5,
        paiement_avance: true,
        revision_autorisee: true,
      },

      diagnostics: {
        dpe: {
          date_realisation: new Date().toISOString(),
          classe_energie: property?.energie || "D",
          classe_ges: property?.ges || "D",
          consommation_energie: 150,
          estimation_cout_min: 800,
          estimation_cout_max: 1200,
        },
      },
    };

    // Générer le HTML
    const html = LeaseTemplateService.generateHTML(typeBail, bailData);

    // Générer le PDF
    const pdfBuffer = await generatePDF(html);

    // === STOCKAGE du PDF dans Supabase Storage ===
    const storagePath = `bails/${leaseId}/${dataHash}.pdf`;

    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true, // Remplacer si existe
        cacheControl: "31536000", // Cache 1 an
      });

    if (!uploadError) {
      // Mettre à jour ou créer l'entrée documents
      if (existingDoc) {
        // Mettre à jour avec le nouveau hash
        await serviceClient
          .from("documents")
          .update({
            title: `Bail - ${property?.adresse_complete || property?.ville || leaseId.slice(0, 8)}`,
            storage_path: storagePath,
            metadata: { 
              hash: dataHash, 
              type_bail: typeBail,
              generated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", existingDoc.id);
      } else {
        // Créer nouvelle entrée
        await serviceClient.from("documents").insert({
          type: "bail",
          title: `Bail - ${property?.adresse_complete || property?.ville || leaseId.slice(0, 8)}`,
          owner_id: property.owner_id,
          property_id: property.id,
          lease_id: leaseId,
          storage_path: storagePath,
          metadata: { 
            hash: dataHash, 
            type_bail: typeBail,
            generated_at: new Date().toISOString(),
          },
        } as any);
      }

      // Journaliser la création
      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        action: "create",
        entity_type: "document",
        entity_id: leaseId,
        metadata: { type: "bail", storage_path: storagePath, cached: false },
      } as any);

      // Retourner URL signée
      const { data: signedUrl } = await serviceClient.storage
        .from("documents")
        .createSignedUrl(storagePath, 3600);

      if (signedUrl?.signedUrl) {
        return NextResponse.redirect(signedUrl.signedUrl);
      }
    }

    // Fallback: retourner le PDF directement
    const fileName = `Bail_${typeBail}_${property?.ville || "location"}_${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });

  } catch (error: any) {
    console.error("Erreur génération PDF bail:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// HELPERS
// ============================================

function numberToWords(n: number): string {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  if (n < 20) return units[Math.floor(n)];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = Math.floor(n % 10);
    if (t === 7 || t === 9) {
      return tens[t] + (u === 1 && t === 7 ? '-et-' : '-') + units[10 + u];
    }
    return tens[t] + (u === 1 && t !== 8 ? '-et-' : (u ? '-' : '')) + units[u];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = Math.floor(n % 100);
    return (h === 1 ? 'cent' : units[h] + ' cent') + (r ? ' ' + numberToWords(r) : (h > 1 ? 's' : ''));
  }
  if (n < 10000) {
    const m = Math.floor(n / 1000);
    const r = Math.floor(n % 1000);
    return (m === 1 ? 'mille' : units[m] + ' mille') + (r ? ' ' + numberToWords(r) : '');
  }
  return `${n.toFixed(2)} euros`;
}

/**
 * Générer le PDF à partir du HTML
 */
async function generatePDF(html: string): Promise<Buffer> {
  // Option 1: Essayer l'Edge Function Supabase
  try {
    const edgeFunctionUrl = process.env.SUPABASE_FUNCTIONS_URL;
    if (edgeFunctionUrl) {
      const response = await fetch(`${edgeFunctionUrl}/html-to-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ html }),
      });

      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
    }
  } catch (error) {
    console.error("Edge Function PDF non disponible:", error);
  }

  // Option 2: Utiliser pdf-lib pour un PDF basique
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const page1 = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page1.getSize();
  let y = height - 50;

  // Titre
  page1.drawText("CONTRAT DE LOCATION", {
    x: 50,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0, 0, 0.5),
  });
  y -= 30;

  page1.drawText("Conforme à la loi ALUR du 24 mars 2014", {
    x: 50,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 50;

  page1.drawText("Ce document est une version prévisualisation.", {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  page1.drawText("Le PDF complet avec toutes les clauses légales sera généré", {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  page1.drawText("lors de l'activation du bail après signatures.", {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 40;

  page1.drawText("Pour générer le PDF complet :", {
    x: 50,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 25;

  const instructions = [
    "1. Configurez la variable SUPABASE_FUNCTIONS_URL",
    "2. Déployez l'Edge Function 'html-to-pdf'",
    "3. Ou utilisez l'aperçu HTML et imprimez en PDF",
  ];

  for (const instruction of instructions) {
    page1.drawText(instruction, {
      x: 60,
      y,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 18;
  }

  y -= 30;

  page1.drawRectangle({
    x: 45,
    y: y - 60,
    width: width - 90,
    height: 70,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  page1.drawText("Astuce : Utilisez la page d'apercu pour imprimer le bail complet", {
    x: 55,
    y: y - 25,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.5),
  });

  page1.drawText("en PDF via votre navigateur (Cmd/Ctrl + P > Enregistrer en PDF)", {
    x: 55,
    y: y - 45,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  page1.drawText(`Document généré le ${new Date().toLocaleDateString("fr-FR")}`, {
    x: 50,
    y: 30,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
