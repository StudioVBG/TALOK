/**
 * Génération du PDF de bail signé — module partagé SOTA 2026
 *
 * Utilisé par :
 *  - handleLeaseFullySigned() (post-signature automatique)
 *  - GET /api/leases/[id]/pdf-signed (téléchargement à la demande)
 *
 * Utilise getServiceClient() directement — aucune authentification utilisateur requise.
 */

import { getServiceClient } from "@/lib/supabase/service-client";
import { LeaseTemplateService } from "@/lib/templates/bail";
import type { TypeBail, BailComplet } from "@/lib/templates/bail/types";

// ─── Types ───────────────────────────────────────────────────────────

export interface SignatureInfo {
  name: string;
  imageUrl?: string;
  signedAt?: string;
  status?: string;
  proof?: any;
}

export interface GeneratedPdfResult {
  buffer: Buffer;
  fileName: string;
}

// ─── Fonction principale ─────────────────────────────────────────────

export async function generateSignedLeasePDF(leaseId: string): Promise<GeneratedPdfResult> {
  const serviceClient = getServiceClient();

  const { data: lease, error: leaseError } = await serviceClient
    .from("leases")
    .select(`
      *,
      property:properties (
        id, owner_id, adresse_complete, code_postal, ville,
        type, surface, nb_pieces, etage, energie, ges
      ),
      signers:lease_signers (
        id, role, signature_status, signed_at, signature_image_path,
        proof_id, proof_metadata, document_hash,
        profile:profiles (id, prenom, nom, telephone, email, date_naissance)
      ),
      documents (id, type, storage_path, metadata, created_at)
    `)
    .eq("id", leaseId)
    .single();

  if (leaseError || !lease) {
    throw new Error(`Bail non trouvé: ${leaseId}`);
  }

  const property = lease.property as any;
  const signersArr = (lease.signers as any[]) || [];

  // Récupérer les URLs signées pour les images de signature
  const signatureImages: Record<string, string> = {};
  for (const signer of signersArr) {
    if (signer.signature_image_path && signer.signature_status === "signed") {
      try {
        const { data: signedUrl } = await serviceClient.storage
          .from("documents")
          .createSignedUrl(signer.signature_image_path, 3600);

        if (signedUrl?.signedUrl) {
          const role = (signer.role || "").toLowerCase();
          if (["proprietaire", "owner", "bailleur"].includes(role)) {
            signatureImages.owner = signedUrl.signedUrl;
          } else {
            signatureImages.tenant = signedUrl.signedUrl;
          }
        }
      } catch {
        // Non bloquant
      }
    }
  }

  // Documents de signature (preuves)
  const signedDocs = ((lease.documents as any[]) || []).filter(
    (d: any) => d.type === "bail_signe_locataire" || d.type === "bail_signe_proprietaire"
  );

  // Profil propriétaire
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

  const tenantSigner = signersArr.find((s: any) => s.role === "locataire_principal");
  const ownerSigner = signersArr.find((s: any) => s.role === "proprietaire");
  const tenant = tenantSigner?.profile;

  const signatureProofs = signedDocs.map((d: any) => d.metadata).filter(Boolean);
  const tenantProof = signatureProofs.find((p: any) => p?.signer?.role === "locataire");
  const ownerProof = signatureProofs.find((p: any) => p?.signer?.role === "proprietaire");

  const isOwnerSociete = ownerProfile?.type === "societe" && ownerProfile?.raison_sociale;
  const ownerAddress = ownerProfile?.adresse_facturation || ownerProfile?.adresse_siege || "";
  const ownerDisplayName = isOwnerSociete
    ? ownerProfile.raison_sociale
    : `${ownerProfileData?.prenom || ""} ${ownerProfileData?.nom || ""}`.trim();

  const typeBail = (lease.type_bail || "meuble") as TypeBail;

  const bailData: Partial<BailComplet> = {
    reference: leaseId.slice(0, 8).toUpperCase(),
    date_signature: tenantSigner?.signed_at || lease.created_at,
    lieu_signature: property?.ville || "",

    bailleur: {
      nom: isOwnerSociete ? (ownerProfile.raison_sociale || "") : (ownerProfileData?.nom || ""),
      prenom: isOwnerSociete ? "" : (ownerProfileData?.prenom || ""),
      date_naissance: isOwnerSociete ? undefined : (ownerProfileData?.date_naissance ?? undefined),
      adresse: ownerAddress || property?.adresse_complete || "",
      code_postal: "",
      ville: "",
      telephone: ownerProfileData?.telephone || "",
      type: (ownerProfile?.type || "particulier") as "particulier" | "societe",
      siret: ownerProfile?.siret ?? undefined,
      raison_sociale: ownerProfile?.raison_sociale || "",
      est_mandataire: false,
    },

    locataires: tenant
      ? [
          {
            nom: tenant.nom || lease.tenant_name_pending || "",
            prenom: tenant.prenom || "",
            date_naissance: tenant.date_naissance,
            lieu_naissance: "",
            nationalite: "Française",
            telephone: tenant.telephone || "",
          },
        ]
      : lease.tenant_name_pending
        ? [
            {
              nom: lease.tenant_name_pending,
              prenom: "",
              date_naissance: undefined,
              lieu_naissance: "",
              nationalite: "Française",
              telephone: "",
            },
          ]
        : [],
    signers: lease.signers,

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
      type_bail: typeBail as any,
      usage: "habitation_principale",
      date_debut: lease.date_debut,
      date_fin: lease.date_fin ?? undefined,
      duree_mois: typeBail === "nu" ? 36 : typeBail === "meuble" ? 12 : 12,
      tacite_reconduction: true,
      loyer_hc: parseFloat(String(lease.loyer)) || 0,
      loyer_en_lettres: numberToWords(parseFloat(String(lease.loyer)) || 0),
      charges_montant: parseFloat(String(lease.charges_forfaitaires)) || 0,
      charges_type: "forfait",
      depot_garantie: parseFloat(String(lease.depot_de_garantie)) || 0,
      depot_garantie_en_lettres: numberToWords(parseFloat(String(lease.depot_de_garantie)) || 0),
      mode_paiement: "virement",
      periodicite_paiement: "mensuelle",
      jour_paiement: 5,
      paiement_avance: true,
      revision_autorisee: true,
      indice_reference: "IRL",
    },

    diagnostics: {
      dpe: {
        date_realisation: new Date().toISOString(),
        date_validite: new Date(Date.now() + 10 * 365.25 * 24 * 3600 * 1000).toISOString(),
        classe_energie: property?.energie || "D",
        classe_ges: property?.ges || "D",
        consommation_energie: 150,
        emissions_ges: 0,
        estimation_cout_min: 800,
        estimation_cout_max: 1200,
      },
    },
  };

  let html = LeaseTemplateService.generateHTML(typeBail, bailData);

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

  html = addSignatureCertificatePage(html, {
    leaseId,
    tenantProof,
    ownerProof,
    signedAt: tenantSigner?.signed_at || ownerSigner?.signed_at,
  });

  const buffer = await generatePdfFromHtml(html);
  const fileName = `Bail_Signe_${property?.ville || "location"}_${new Date().toISOString().split("T")[0]}.pdf`;

  return { buffer, fileName };
}

// ─── Helpers exportés ────────────────────────────────────────────────

export function injectSignatures(
  html: string,
  signatures: { tenant: SignatureInfo; owner: SignatureInfo }
): string {
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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const buildSignatureHtml = (sig: SignatureInfo) => {
    if (sig.imageUrl) {
      return `
        <img src="${sig.imageUrl}" alt="Signature" class="signature-image" />
        <div class="signature-info">
          <span class="signature-verified">✓ Signé électroniquement</span><br>
          ${sig.signedAt ? `Le ${formatDate(sig.signedAt)}` : ""}
          ${sig.proof?.proof_id ? `<div class="digital-signature-badge">🔒 Preuve: ${sig.proof.proof_id.slice(0, 8)}...</div>` : ""}
        </div>
      `;
    }
    if (sig.status === "signed") {
      return `<div class="signature-info signature-verified">✓ Signé électroniquement<br>${sig.name}</div>`;
    }
    return `<div class="signature-info signature-pending">En attente de signature</div>`;
  };

  const tenantSignatureHtml = buildSignatureHtml(signatures.tenant);
  const ownerSignatureHtml = buildSignatureHtml(signatures.owner);

  html = html.replace("</head>", `${signatureStyle}</head>`);

  html = html.replace(
    /<div class="signature-line"><\/div>\s*<p style="font-size: 9pt;">{{LOCATAIRE_NOM_COMPLET}}<\/p>/g,
    `${tenantSignatureHtml}<p style="font-size: 9pt;">${signatures.tenant.name}</p>`
  );

  html = html.replace(
    /<div class="signature-line"><\/div>\s*<p style="font-size: 9pt;">{{BAILLEUR_NOM_COMPLET}}<\/p>/g,
    `${ownerSignatureHtml}<p style="font-size: 9pt;">${signatures.owner.name}</p>`
  );

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

export function addSignatureCertificatePage(
  html: string,
  data: { leaseId: string; tenantProof?: any; ownerProof?: any; signedAt?: string }
): string {
  const now = new Date();
  const formatFR = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const proofSection = (label: string, proof: any | undefined) => {
    if (!proof) {
      return `
        <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ef6c00;">
          <h3 style="margin-top: 0; color: #ef6c00;">⏳ Signature ${label}</h3>
          <p style="margin: 0; color: #666;">En attente de signature</p>
        </div>
      `;
    }
    return `
      <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2e7d32;">
        <h3 style="margin-top: 0; color: #2e7d32;">✓ Signature ${label}</h3>
        <table style="width: 100%; font-size: 10pt;">
          <tr><td style="padding: 3px 0; color: #666; width: 40%;">Signataire</td><td style="padding: 3px 0;">${proof.signer?.name || "N/A"}</td></tr>
          <tr><td style="padding: 3px 0; color: #666;">ID de preuve</td><td style="padding: 3px 0; font-family: monospace;">${proof.proof_id || "N/A"}</td></tr>
          <tr><td style="padding: 3px 0; color: #666;">Type de signature</td><td style="padding: 3px 0;">${proof.signature_type === "draw" ? "Tracé manuscrit" : "Texte stylisé"}</td></tr>
          <tr><td style="padding: 3px 0; color: #666;">Date et heure</td><td style="padding: 3px 0;">${proof.timestamp ? new Date(proof.timestamp).toLocaleString("fr-FR") : "N/A"}</td></tr>
          <tr><td style="padding: 3px 0; color: #666;">Hash du document</td><td style="padding: 3px 0; font-family: monospace; font-size: 9pt;">${proof.document_hash?.slice(0, 32) || "N/A"}...</td></tr>
          <tr><td style="padding: 3px 0; color: #666;">Hash de signature</td><td style="padding: 3px 0; font-family: monospace; font-size: 9pt;">${proof.signature_hash?.slice(0, 32) || "N/A"}...</td></tr>
          <tr><td style="padding: 3px 0; color: #666;">Identité vérifiée</td><td style="padding: 3px 0;">${proof.signer?.identityVerified ? "✓ Oui (CNI)" : "Non"}</td></tr>
        </table>
      </div>
    `;
  };

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
          <tr><td style="padding: 5px 0; color: #666;">Référence du bail</td><td style="padding: 5px 0; font-weight: bold;">${data.leaseId.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td style="padding: 5px 0; color: #666;">Type de document</td><td style="padding: 5px 0;">Contrat de location</td></tr>
          <tr><td style="padding: 5px 0; color: #666;">Date de génération</td><td style="padding: 5px 0;">${formatFR(now)}</td></tr>
        </table>
      </div>
      ${proofSection("du Locataire", data.tenantProof)}
      ${proofSection("du Propriétaire", data.ownerProof)}
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
        <p>Document généré par ImmoGestion - ${now.toLocaleDateString("fr-FR")}</p>
        <p>Ce certificat fait partie intégrante du contrat de location</p>
      </div>
    </div>
  `;

  return html.replace("</body>", `${certificateHtml}</body>`);
}

export function numberToWords(n: number): string {
  const units = [
    "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
  ];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

  if (n < 20) return units[Math.floor(n)];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = Math.floor(n % 10);
    if (t === 7 || t === 9) {
      return tens[t] + (u === 1 && t === 7 ? "-et-" : "-") + units[10 + u];
    }
    return tens[t] + (u === 1 && t !== 8 ? "-et-" : u ? "-" : "") + units[u];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = Math.floor(n % 100);
    return (h === 1 ? "cent" : units[h] + " cent") + (r ? " " + numberToWords(r) : h > 1 ? "s" : "");
  }
  if (n < 10000) {
    const m = Math.floor(n / 1000);
    const r = Math.floor(n % 1000);
    return (m === 1 ? "mille" : units[m] + " mille") + (r ? " " + numberToWords(r) : "");
  }
  return `${n.toFixed(2)} euros`;
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  try {
    const edgeFunctionUrl = process.env.SUPABASE_FUNCTIONS_URL;
    if (edgeFunctionUrl) {
      const response = await fetch(`${edgeFunctionUrl}/html-to-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ html }),
      });

      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
    }
  } catch {
    console.log("[lease-pdf-generator] Edge Function PDF non disponible, fallback pdf-lib");
  }

  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page1 = pdfDoc.addPage([595, 842]);
  const { width, height } = page1.getSize();
  let y = height - 50;

  page1.drawText("CONTRAT DE LOCATION SIGNÉ", {
    x: 50, y, size: 20, font: fontBold, color: rgb(0.1, 0.37, 0.48),
  });
  y -= 30;

  page1.drawText("Document signé électroniquement", {
    x: 50, y, size: 12, font, color: rgb(0.18, 0.49, 0.2),
  });
  y -= 50;

  page1.drawText("Ce bail a été signé électroniquement par les parties.", {
    x: 50, y, size: 12, font, color: rgb(0, 0, 0),
  });
  y -= 25;

  page1.drawText("Les signatures et preuves cryptographiques sont stockées", {
    x: 50, y, size: 12, font, color: rgb(0, 0, 0),
  });
  y -= 20;

  page1.drawText("dans la base de données sécurisée.", {
    x: 50, y, size: 12, font, color: rgb(0, 0, 0),
  });
  y -= 50;

  page1.drawRectangle({
    x: 45, y: y - 100, width: width - 90, height: 110,
    borderColor: rgb(0.1, 0.37, 0.48), borderWidth: 2, color: rgb(0.95, 0.98, 1),
  });

  page1.drawText("Pour obtenir le PDF complet avec images de signature :", {
    x: 55, y: y - 25, size: 11, font: fontBold, color: rgb(0.1, 0.37, 0.48),
  });

  const instructions = [
    "1. Utilisez l'aperçu HTML du bail dans l'application",
    "2. Imprimez en PDF via votre navigateur (Ctrl/Cmd + P)",
    "3. Ou configurez l'Edge Function 'html-to-pdf' Supabase",
  ];

  let instrY = y - 50;
  for (const instruction of instructions) {
    page1.drawText(instruction, {
      x: 60, y: instrY, size: 10, font, color: rgb(0.3, 0.3, 0.3),
    });
    instrY -= 18;
  }

  page1.drawText(`Document généré le ${new Date().toLocaleDateString("fr-FR")} - ImmoGestion`, {
    x: 50, y: 30, size: 9, font, color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
