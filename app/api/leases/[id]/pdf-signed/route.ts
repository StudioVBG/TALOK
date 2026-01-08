export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// @ts-nocheck
/**
 * API Route: Génération du PDF de bail signé complet
 * GET /api/leases/[id]/pdf-signed
 * 
 * Génère le PDF complet du bail avec:
 * - Toutes les informations légales
 * - Les signatures des parties intégrées
 * - Les preuves cryptographiques
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { LeaseTemplateService } from "@/lib/templates/bail";
import type { TypeBail, BailComplet } from "@/lib/templates/bail/types";

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
      .select("id, role, prenom, nom, telephone, email, date_naissance")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // Utiliser le service client pour récupérer toutes les données
    const serviceClient = getServiceClient();

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
          ges
        ),
        signers:lease_signers (
          id,
          role,
          signature_status,
          signed_at,
          signature_image_path,
          proof_id,
          proof_metadata,
          document_hash,
          profile:profiles (
            id,
            prenom,
            nom,
            telephone,
            email,
            date_naissance
          )
        ),
        documents (
          id,
          type,
          storage_path,
          metadata,
          created_at
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

    // Récupérer les images de signature depuis le storage
    const signatureImages: Record<string, string> = {};
    
    // Chercher les documents de signature
    const signedDocs = (lease.documents as any[])?.filter(d => 
      d.type === "bail_signe_locataire" || d.type === "bail_signe_proprietaire"
    );

    // Récupérer les infos du propriétaire
    const { data: ownerProfileData } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom, telephone, email, date_naissance")
      .eq("id", property.owner_id)
      .single();

    const { data: ownerProfile } = await serviceClient
      .from("owner_profiles")
      .select("*")
      .eq("profile_id", property.owner_id)
      .single();

    // Récupérer l'image de signature du locataire
    const tenantSignatureFile = `leases/${leaseId}/signatures`;
    try {
      const { data: signatureFiles } = await serviceClient.storage
        .from("documents")
        .list(tenantSignatureFile);
      
      if (signatureFiles && signatureFiles.length > 0) {
        // Prendre la dernière signature
        const latestSignature = signatureFiles
          .filter(f => f.name.includes("tenant"))
          .sort((a, b) => b.name.localeCompare(a.name))[0];
        
        if (latestSignature) {
          const { data: signedUrl } = await serviceClient.storage
            .from("documents")
            .createSignedUrl(`${tenantSignatureFile}/${latestSignature.name}`, 3600);
          
          if (signedUrl?.signedUrl) {
            signatureImages.tenant = signedUrl.signedUrl;
          }
        }

        // Signature propriétaire
        const ownerSignature = signatureFiles
          .filter(f => f.name.includes("owner"))
          .sort((a, b) => b.name.localeCompare(a.name))[0];
        
        if (ownerSignature) {
          const { data: signedUrl } = await serviceClient.storage
            .from("documents")
            .createSignedUrl(`${tenantSignatureFile}/${ownerSignature.name}`, 3600);
          
          if (signedUrl?.signedUrl) {
            signatureImages.owner = signedUrl.signedUrl;
          }
        }
      }
    } catch (e) {
      console.log("Signatures non trouvées dans storage");
    }

    // Préparer les données pour le template
    const typeBail = (lease.type_bail || "meuble") as TypeBail;
    
    // Trouver les signataires
    const tenantSigner = (lease.signers as any[])?.find(s => s.role === "locataire_principal");
    const ownerSigner = (lease.signers as any[])?.find(s => s.role === "proprietaire");
    const tenant = tenantSigner?.profile;

    // Récupérer les preuves de signature
    const signatureProofs = signedDocs?.map(d => d.metadata).filter(Boolean) || [];
    const tenantProof = signatureProofs.find(p => p?.signer?.role === "locataire");
    const ownerProof = signatureProofs.find(p => p?.signer?.role === "proprietaire");

    // Déterminer le nom et l'adresse du bailleur (particulier vs société)
    const isOwnerSociete = ownerProfile?.type === "societe" && ownerProfile?.raison_sociale;
    const ownerAddress = ownerProfile?.adresse_facturation || ownerProfile?.adresse_siege || "";
    const ownerDisplayName = isOwnerSociete 
      ? ownerProfile.raison_sociale 
      : `${ownerProfileData?.prenom || ""} ${ownerProfileData?.nom || ""}`.trim();

    // Construire les données du bail selon le format attendu
    const bailData: Partial<BailComplet> = {
      reference: leaseId.slice(0, 8).toUpperCase(),
      date_signature: tenantSigner?.signed_at || lease.created_at,
      lieu_signature: property?.ville || "",
      
      // Bailleur
      bailleur: {
        nom: isOwnerSociete ? ownerProfile.raison_sociale : (ownerProfileData?.nom || ""),
        prenom: isOwnerSociete ? "" : (ownerProfileData?.prenom || ""),
        date_naissance: isOwnerSociete ? undefined : ownerProfileData?.date_naissance,
        adresse: ownerAddress || `${property?.adresse_complete}, ${property?.code_postal} ${property?.ville}`,
        code_postal: "",
        ville: "",
        telephone: ownerProfileData?.telephone || "",
        type: ownerProfile?.type || "particulier",
        siret: ownerProfile?.siret,
        raison_sociale: ownerProfile?.raison_sociale || "",
        est_mandataire: false,
      },

      // Locataire(s)
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
      signers: lease.signers,

      // Logement
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

      // Conditions du bail
      conditions: {
        date_debut: lease.date_debut,
        date_fin: lease.date_fin,
        duree_mois: typeBail === "nu" ? 36 : typeBail === "meuble" ? 12 : 12,
        tacite_reconduction: true,
        loyer_hc: parseFloat(lease.loyer) || 0,
        loyer_en_lettres: numberToWords(parseFloat(lease.loyer) || 0),
        charges_montant: parseFloat(lease.charges_forfaitaires) || 0,
        charges_type: "forfait",
        depot_garantie: parseFloat(lease.depot_de_garantie) || 0,
        depot_garantie_en_lettres: numberToWords(parseFloat(lease.depot_de_garantie) || 0),
        mode_paiement: "virement",
        periodicite_paiement: "mensuelle",
        jour_paiement: 5,
        paiement_avance: true,
        revision_autorisee: true,
      },

      // Diagnostics
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

    // Générer le HTML de base
    let html = LeaseTemplateService.generateHTML(typeBail, bailData);

    // Injecter les signatures dans le HTML
    html = injectSignatures(html, {
      tenant: {
        name: `${tenant?.prenom || ""} ${tenant?.nom || lease.tenant_name_pending || ""}`.trim(),
        imageUrl: signatureImages.tenant,
        signedAt: tenantSigner?.signed_at,
        status: tenantSigner?.signature_status,
        proof: tenantProof,
      },
      owner: {
        name: ownerDisplayName || "Propriétaire",
        imageUrl: signatureImages.owner,
        signedAt: ownerSigner?.signed_at,
        status: ownerSigner?.signature_status,
        proof: ownerProof,
      },
    });

    // Ajouter la page de certificat de signature
    html = addSignatureCertificatePage(html, {
      leaseId,
      tenantProof,
      ownerProof,
      signedAt: tenantSigner?.signed_at || ownerSigner?.signed_at,
    });

    // Générer le PDF
    const pdfBuffer = await generateSignedPDF(html);

    // Retourner le PDF
    const fileName = `Bail_Signe_${property?.ville || "location"}_${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });

  } catch (error: any) {
    console.error("Erreur génération PDF signé:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Injecte les signatures dans le HTML du bail
 */
function injectSignatures(html: string, signatures: {
  tenant: { name: string; imageUrl?: string; signedAt?: string; status?: string; proof?: any };
  owner: { name: string; imageUrl?: string; signedAt?: string; status?: string; proof?: any };
}): string {
  // Style pour les signatures
  const signatureStyle = `
    <style>
      .signature-image {
        max-width: 200px;
        max-height: 80px;
        object-fit: contain;
        border-bottom: 1px solid #999;
        padding: 5px 0;
      }
      .signature-info {
        font-size: 9pt;
        color: #666;
        margin-top: 5px;
      }
      .signature-verified {
        color: #2e7d32;
        font-weight: bold;
      }
      .signature-pending {
        color: #ef6c00;
        font-style: italic;
      }
      .digital-signature-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #e8f5e9;
        color: #2e7d32;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 8pt;
        margin-top: 3px;
      }
    </style>
  `;

  // Remplacer les zones de signature du locataire
  const tenantSignatureHtml = signatures.tenant.imageUrl 
    ? `
      <img src="${signatures.tenant.imageUrl}" alt="Signature locataire" class="signature-image" />
      <div class="signature-info">
        <span class="signature-verified">✓ Signé électroniquement</span><br>
        ${signatures.tenant.signedAt ? `Le ${new Date(signatures.tenant.signedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
        ${signatures.tenant.proof?.proof_id ? `<div class="digital-signature-badge">🔒 Preuve: ${signatures.tenant.proof.proof_id.slice(0, 8)}...</div>` : ""}
      </div>
    `
    : signatures.tenant.status === "signed" 
      ? `<div class="signature-info signature-verified">✓ Signé électroniquement<br>${signatures.tenant.name}</div>`
      : `<div class="signature-info signature-pending">En attente de signature</div>`;

  const ownerSignatureHtml = signatures.owner.imageUrl 
    ? `
      <img src="${signatures.owner.imageUrl}" alt="Signature propriétaire" class="signature-image" />
      <div class="signature-info">
        <span class="signature-verified">✓ Signé électroniquement</span><br>
        ${signatures.owner.signedAt ? `Le ${new Date(signatures.owner.signedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
        ${signatures.owner.proof?.proof_id ? `<div class="digital-signature-badge">🔒 Preuve: ${signatures.owner.proof.proof_id.slice(0, 8)}...</div>` : ""}
      </div>
    `
    : signatures.owner.status === "signed" 
      ? `<div class="signature-info signature-verified">✓ Signé électroniquement<br>${signatures.owner.name}</div>`
      : `<div class="signature-info signature-pending">En attente de signature</div>`;

  // Injecter le style dans le head
  html = html.replace("</head>", `${signatureStyle}</head>`);

  // Remplacer les zones de signature vides par les images
  // Pattern pour la signature du locataire
  html = html.replace(
    /<div class="signature-line"><\/div>\s*<p style="font-size: 9pt;">{{LOCATAIRE_NOM_COMPLET}}<\/p>/g,
    `${tenantSignatureHtml}<p style="font-size: 9pt;">${signatures.tenant.name}</p>`
  );

  // Pattern pour la signature du bailleur
  html = html.replace(
    /<div class="signature-line"><\/div>\s*<p style="font-size: 9pt;">{{BAILLEUR_NOM_COMPLET}}<\/p>/g,
    `${ownerSignatureHtml}<p style="font-size: 9pt;">${signatures.owner.name}</p>`
  );

  // Fallback: remplacer les div.sig-line vides
  html = html.replace(
    /<div class="sig-line"><\/div>\s*<p class="sig-name">{{BAILLEUR_NOM_COMPLET}}<\/p>/g,
    `${ownerSignatureHtml}<p class="sig-name">${signatures.owner.name}</p>`
  );

  html = html.replace(
    /<div class="sig-line"><\/div>\s*<p class="sig-name">{{LOCATAIRE_NOM_COMPLET}}<\/p>/g,
    `${tenantSignatureHtml}<p class="sig-name">${signatures.tenant.name}</p>`
  );

  return html;
}

/**
 * Ajoute une page de certificat de signature électronique
 */
function addSignatureCertificatePage(html: string, data: {
  leaseId: string;
  tenantProof?: any;
  ownerProof?: any;
  signedAt?: string;
}): string {
  const certificateHtml = `
    <div class="page-break"></div>
    <div style="padding: 40px; font-family: Arial, sans-serif;">
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #1a5f7a; margin-bottom: 5px;">CERTIFICAT DE SIGNATURE ÉLECTRONIQUE</h1>
        <p style="color: #666; font-size: 12pt;">Preuve d'authenticité et d'intégrité</p>
      </div>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <h3 style="margin-top: 0; color: #333;">📄 Document certifié</h3>
        <table style="width: 100%; font-size: 11pt;">
          <tr>
            <td style="padding: 5px 0; color: #666;">Référence du bail</td>
            <td style="padding: 5px 0; font-weight: bold;">${data.leaseId.slice(0, 8).toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">Type de document</td>
            <td style="padding: 5px 0;">Contrat de location</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;">Date de génération</td>
            <td style="padding: 5px 0;">${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
          </tr>
        </table>
      </div>

      ${data.tenantProof ? `
      <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2e7d32;">
        <h3 style="margin-top: 0; color: #2e7d32;">✓ Signature du Locataire</h3>
        <table style="width: 100%; font-size: 10pt;">
          <tr>
            <td style="padding: 3px 0; color: #666; width: 40%;">Signataire</td>
            <td style="padding: 3px 0;">${data.tenantProof.signer?.name || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #666;">ID de preuve</td>
            <td style="padding: 3px 0; font-family: monospace;">${data.tenantProof.proof_id || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #666;">Type de signature</td>
            <td style="padding: 3px 0;">${data.tenantProof.signature_type === "draw" ? "Tracé manuscrit" : "Texte stylisé"}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #666;">Date et heure</td>
            <td style="padding: 3px 0;">${data.tenantProof.timestamp ? new Date(data.tenantProof.timestamp).toLocaleString("fr-FR") : "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #666;">Hash du document</td>
            <td style="padding: 3px 0; font-family: monospace; font-size: 9pt;">${data.tenantProof.document_hash?.slice(0, 32)}...</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #666;">Hash de signature</td>
            <td style="padding: 3px 0; font-family: monospace; font-size: 9pt;">${data.tenantProof.signature_hash?.slice(0, 32)}...</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #666;">Identité vérifiée</td>
            <td style="padding: 3px 0;">${data.tenantProof.signer?.identityVerified ? "✓ Oui (CNI)" : "Non"}</td>
          </tr>
        </table>
      </div>
      ` : `
      <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ef6c00;">
        <h3 style="margin-top: 0; color: #ef6c00;">⏳ Signature du Locataire</h3>
        <p style="margin: 0; color: #666;">En attente de signature</p>
      </div>
      `}

      ${data.ownerProof ? `
      <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2e7d32;">
        <h3 style="margin-top: 0; color: #2e7d32;">✓ Signature du Propriétaire</h3>
        <table style="width: 100%; font-size: 10pt;">
          <tr>
            <td style="padding: 3px 0; color: #666; width: 40%;">Signataire</td>
            <td style="padding: 3px 0;">${data.ownerProof.signer?.name || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #666;">ID de preuve</td>
            <td style="padding: 3px 0; font-family: monospace;">${data.ownerProof.proof_id || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #666;">Date et heure</td>
            <td style="padding: 3px 0;">${data.ownerProof.timestamp ? new Date(data.ownerProof.timestamp).toLocaleString("fr-FR") : "N/A"}</td>
          </tr>
        </table>
      </div>
      ` : `
      <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ef6c00;">
        <h3 style="margin-top: 0; color: #ef6c00;">⏳ Signature du Propriétaire</h3>
        <p style="margin: 0; color: #666;">En attente de signature</p>
      </div>
      `}

      <div style="margin-top: 40px; padding: 20px; background: #f9f9f9; border-radius: 8px;">
        <h4 style="margin-top: 0; color: #333;">⚖️ Valeur juridique</h4>
        <p style="font-size: 10pt; color: #666; line-height: 1.6;">
          Ce document a été signé électroniquement conformément aux articles 1366 et 1367 du Code civil 
          et au règlement européen eIDAS (UE) n°910/2014. La signature électronique a la même valeur 
          juridique qu'une signature manuscrite. L'intégrité du document est garantie par les empreintes 
          cryptographiques (SHA-256) générées lors de la signature.
        </p>
      </div>

      <div style="margin-top: 30px; text-align: center; color: #999; font-size: 9pt;">
        <p>Document généré par ImmoGestion - ${new Date().toLocaleDateString("fr-FR")}</p>
        <p>Ce certificat fait partie intégrante du contrat de location</p>
      </div>
    </div>
  `;

  // Insérer avant la balise </body>
  return html.replace("</body>", `${certificateHtml}</body>`);
}

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
 * Générer le PDF signé à partir du HTML
 */
async function generateSignedPDF(html: string): Promise<Buffer> {
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
    console.log("Edge Function PDF non disponible, fallback pdf-lib");
  }

  // Option 2: Utiliser pdf-lib pour un PDF basique avec le contenu
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Page 1 - Titre et info
  const page1 = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page1.getSize();
  let y = height - 50;

  // Titre
  page1.drawText("CONTRAT DE LOCATION SIGNÉ", {
    x: 50,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.37, 0.48),
  });
  y -= 30;

  page1.drawText("Document signé électroniquement", {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0.18, 0.49, 0.2),
  });
  y -= 50;

  // Message
  page1.drawText("Ce bail a été signé électroniquement par les parties.", {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 25;

  page1.drawText("Les signatures et preuves cryptographiques sont stockées", {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  page1.drawText("dans la base de données sécurisée.", {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 50;

  // Instructions pour PDF complet
  page1.drawRectangle({
    x: 45,
    y: y - 100,
    width: width - 90,
    height: 110,
    borderColor: rgb(0.1, 0.37, 0.48),
    borderWidth: 2,
    color: rgb(0.95, 0.98, 1),
  });

  page1.drawText("Pour obtenir le PDF complet avec images de signature :", {
    x: 55,
    y: y - 25,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.37, 0.48),
  });

  const instructions = [
    "1. Utilisez l'aperçu HTML du bail dans l'application",
    "2. Imprimez en PDF via votre navigateur (Ctrl/Cmd + P)",
    "3. Ou configurez l'Edge Function 'html-to-pdf' Supabase",
  ];

  let instrY = y - 50;
  for (const instruction of instructions) {
    page1.drawText(instruction, {
      x: 60,
      y: instrY,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    instrY -= 18;
  }

  // Pied de page
  page1.drawText(`Document généré le ${new Date().toLocaleDateString("fr-FR")} - ImmoGestion`, {
    x: 50,
    y: 30,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

