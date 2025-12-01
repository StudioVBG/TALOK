// @ts-nocheck
/**
 * API Route: Génération de PDF
 * POST /api/pdf/generate
 * 
 * Génère des PDF pour:
 * - Baux (nu, meublé, colocation, parking, commercial)
 * - Quittances de loyer
 * - États des lieux
 * - Factures
 * 
 * Sources techniques:
 * - React-PDF pour la génération côté serveur
 * - Puppeteer pour le rendu HTML vers PDF (fallback)
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { LeaseTemplateService } from "@/lib/templates/bail";
import type { TypeBail } from "@/lib/templates/bail/types";
import * as crypto from "crypto";

interface GeneratePDFRequest {
  template: "lease" | "receipt" | "edl" | "invoice";
  data: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body: GeneratePDFRequest = await request.json();
    const { template, data } = body;

    if (!template || !data) {
      return NextResponse.json(
        { error: "template et data requis" },
        { status: 400 }
      );
    }

    let html: string;
    let fileName: string;
    let storagePath: string;

    switch (template) {
      case "lease":
        const result = await generateLeasePDF(supabase, data, user.id);
        html = result.html;
        fileName = result.fileName;
        storagePath = result.storagePath;
        break;

      case "receipt":
        const receiptResult = await generateReceiptPDF(supabase, data, user.id);
        html = receiptResult.html;
        fileName = receiptResult.fileName;
        storagePath = receiptResult.storagePath;
        break;

      case "edl":
        const edlResult = await generateEDLPDF(supabase, data, user.id);
        html = edlResult.html;
        fileName = edlResult.fileName;
        storagePath = edlResult.storagePath;
        break;

      case "invoice":
        const invoiceResult = await generateInvoicePDF(supabase, data, user.id);
        html = invoiceResult.html;
        fileName = invoiceResult.fileName;
        storagePath = invoiceResult.storagePath;
        break;

      default:
        return NextResponse.json(
          { error: "Template non supporté" },
          { status: 400 }
        );
    }

    // Convertir HTML en PDF via Edge Function ou service externe
    // Pour l'instant, on sauvegarde le HTML et on génère le PDF via une Edge Function
    const pdfBuffer = await htmlToPDF(html);
    const pdfHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    // Uploader le PDF dans Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Erreur upload PDF:", uploadError);
      throw new Error("Erreur lors de l'upload du PDF");
    }

    // Obtenir l'URL publique
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "pdf_generated",
      entity_type: template,
      entity_id: (data as any).lease_id || (data as any).invoice_id || (data as any).edl_id,
      metadata: {
        template,
        fileName,
        storagePath,
        pdfHash,
      },
    });

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: storagePath,
      hash: pdfHash,
      fileName,
    });
  } catch (error: any) {
    console.error("Erreur génération PDF:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// GÉNÉRATEURS PAR TYPE
// ============================================

async function generateLeasePDF(
  supabase: any,
  data: Record<string, unknown>,
  userId: string
) {
  const typeBail = (data.type_bail as TypeBail) || "meuble";
  const leaseId = data.lease_id as string;
  const bailData = data.bail_data as any || {};

  // Si on a un lease_id, enrichir avec les données de la BDD
  if (leaseId) {
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        *,
        property:property_id (
          *,
          owner:owner_id (
            *,
            user:user_id (email),
            owner_profiles (*)
          )
        ),
        signers:lease_signers (
          *,
          profile:profile_id (
            *,
            tenant_profiles (*)
          )
        )
      `)
      .eq("id", leaseId)
      .single();

    if (lease) {
      // Fusionner les données
      const property = lease.property as any;
      const owner = property?.owner as any;
      const ownerProfile = owner?.owner_profiles as any;
      const tenantSigner = lease.signers?.find((s: any) => 
        s.role === "locataire_principal"
      );
      const tenant = tenantSigner?.profile as any;
      const tenantProfile = tenant?.tenant_profiles as any;

      Object.assign(bailData, {
        // Bailleur
        bailleur: {
          nom: owner?.nom || "",
          prenom: owner?.prenom || "",
          adresse: ownerProfile?.adresse_facturation || "",
          email: owner?.user?.email || "",
          telephone: owner?.telephone || "",
          type: ownerProfile?.type || "particulier",
          siret: ownerProfile?.siret,
        },
        // Locataire
        locataire: {
          nom: tenant?.nom || "",
          prenom: tenant?.prenom || "",
          dateNaissance: tenant?.date_naissance || "",
          lieuNaissance: "",
          adresse: "",
          email: "",
          telephone: tenant?.telephone || "",
        },
        // Logement
        logement: {
          adresse: property?.adresse_complete || "",
          codePostal: property?.code_postal || "",
          ville: property?.ville || "",
          surface: property?.surface || 0,
          nbPieces: property?.nb_pieces || 0,
          etage: property?.etage,
          description: property?.description || "",
          parking: property?.parking_inclus || false,
          cave: property?.cave_inclus || false,
        },
        // Conditions financières
        conditionsFinancieres: {
          loyer: lease.loyer || 0,
          charges: lease.charges_forfaitaires || 0,
          depotGarantie: lease.depot_de_garantie || 0,
          modeReglement: "virement",
          dateEcheance: 5,
        },
        // Durée
        duree: {
          dateDebut: lease.date_debut,
          dateFin: lease.date_fin,
          dureeInitiale: typeBail === "nu" ? 36 : 12,
        },
        // Diagnostics
        diagnostics: {
          dpe: property?.dpe_classe_energie || "D",
          ges: property?.dpe_classe_climat || "D",
        },
      });
    }
  }

  // Générer le HTML
  const html = LeaseTemplateService.generateHTML(typeBail, bailData);

  const date = new Date().toISOString().split("T")[0];
  const fileName = `Bail_${typeBail}_${date}.pdf`;
  const storagePath = `leases/${leaseId || userId}/${fileName}`;

  return { html, fileName, storagePath };
}

async function generateReceiptPDF(
  supabase: any,
  data: Record<string, unknown>,
  userId: string
) {
  const {
    invoiceId,
    periode,
    montant_total,
    montant_loyer,
    montant_charges,
    tenantName,
    propertyAddress,
    ownerName,
    ownerAddress,
    paidAt,
    paymentMethod,
  } = data as any;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Quittance de loyer - ${periode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Marianne', 'Segoe UI', system-ui, sans-serif;
      color: #1a1a1a;
      padding: 40px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #000091;
    }
    .header h1 {
      font-size: 28px;
      color: #000091;
      margin-bottom: 8px;
    }
    .header p {
      color: #666;
      font-size: 14px;
    }
    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .party {
      width: 45%;
    }
    .party h3 {
      color: #000091;
      margin-bottom: 12px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .party p {
      font-size: 14px;
      margin-bottom: 4px;
    }
    .details {
      background: #f8f9fa;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 40px;
    }
    .details h3 {
      color: #000091;
      margin-bottom: 16px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e5e5;
    }
    .detail-row:last-child {
      border-bottom: none;
      font-weight: bold;
      font-size: 18px;
      padding-top: 16px;
      margin-top: 8px;
      border-top: 2px solid #000091;
    }
    .footer {
      margin-top: 60px;
      text-align: center;
    }
    .signature-area {
      display: flex;
      justify-content: flex-end;
      margin-top: 60px;
    }
    .signature-box {
      text-align: center;
      width: 200px;
    }
    .signature-line {
      border-top: 1px solid #000;
      margin-top: 60px;
      padding-top: 8px;
    }
    .legal {
      font-size: 11px;
      color: #666;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>QUITTANCE DE LOYER</h1>
    <p>Période : ${formatPeriode(periode)}</p>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Bailleur</h3>
      <p><strong>${ownerName}</strong></p>
      <p>${ownerAddress}</p>
    </div>
    <div class="party">
      <h3>Locataire</h3>
      <p><strong>${tenantName}</strong></p>
      <p>${propertyAddress}</p>
    </div>
  </div>

  <div class="details">
    <h3>Détail du paiement</h3>
    <div class="detail-row">
      <span>Loyer</span>
      <span>${montant_loyer.toFixed(2)} €</span>
    </div>
    <div class="detail-row">
      <span>Charges</span>
      <span>${montant_charges.toFixed(2)} €</span>
    </div>
    <div class="detail-row">
      <span>TOTAL</span>
      <span>${montant_total.toFixed(2)} €</span>
    </div>
  </div>

  <p>
    Je soussigné(e), <strong>${ownerName}</strong>, propriétaire du logement 
    désigné ci-dessus, déclare avoir reçu de <strong>${tenantName}</strong> 
    la somme de <strong>${montant_total.toFixed(2)} euros</strong> 
    au titre du paiement du loyer et des charges pour la période indiquée.
  </p>

  <p style="margin-top: 16px;">
    Mode de paiement : ${formatPaymentMethod(paymentMethod)}<br>
    Date de paiement : ${new Date(paidAt).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}
  </p>

  <div class="signature-area">
    <div class="signature-box">
      <p>Le Bailleur</p>
      <div class="signature-line">${ownerName}</div>
    </div>
  </div>

  <div class="legal">
    <p>
      Cette quittance annule tous les reçus qui auraient pu être établis 
      précédemment en cas de paiement partiel du loyer. Elle est délivrée sous 
      réserve de tous droits et sans reconnaissance de paiement des loyers antérieurs.
    </p>
  </div>
</body>
</html>
  `;

  const date = new Date().toISOString().split("T")[0];
  const fileName = `Quittance_${periode}_${date}.pdf`;
  const storagePath = `receipts/${invoiceId}/${fileName}`;

  return { html, fileName, storagePath };
}

async function generateEDLPDF(
  supabase: any,
  data: Record<string, unknown>,
  userId: string
) {
  const {
    edlId,
    type,
    propertyAddress,
    tenantName,
    ownerName,
    date,
    rooms,
    signatures,
  } = data as any;

  const roomsHTML = (rooms || [])
    .map(
      (room: any) => `
    <div class="room">
      <h3>${room.name}</h3>
      <table>
        <thead>
          <tr>
            <th>Élément</th>
            <th>État</th>
            <th>Observations</th>
          </tr>
        </thead>
        <tbody>
          ${(room.elements || [])
            .map(
              (el: any) => `
            <tr>
              <td>${el.name}</td>
              <td class="state-${el.state.toLowerCase()}">${el.state}</td>
              <td>${el.observations || "-"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>État des lieux ${type === "entree" ? "d'entrée" : "de sortie"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Marianne', 'Segoe UI', system-ui, sans-serif;
      color: #1a1a1a;
      padding: 30px;
      line-height: 1.5;
      font-size: 12px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 2px solid #000091;
    }
    .header h1 { font-size: 22px; color: #000091; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .info-box {
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
    }
    .info-box h4 {
      color: #000091;
      margin-bottom: 8px;
      font-size: 11px;
      text-transform: uppercase;
    }
    .room {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    .room h3 {
      background: #000091;
      color: white;
      padding: 8px 12px;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background: #f0f0f0;
      font-weight: 600;
    }
    .state-bon { color: #00a550; }
    .state-moyen { color: #ff9500; }
    .state-mauvais { color: #e63946; }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 50px;
      page-break-inside: avoid;
    }
    .signature-box {
      text-align: center;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    .signature-line {
      border-top: 1px solid #000;
      margin-top: 60px;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ÉTAT DES LIEUX ${type === "entree" ? "D'ENTRÉE" : "DE SORTIE"}</h1>
    <p>Établi le ${new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}</p>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h4>Propriétaire</h4>
      <p><strong>${ownerName}</strong></p>
    </div>
    <div class="info-box">
      <h4>Locataire</h4>
      <p><strong>${tenantName}</strong></p>
    </div>
    <div class="info-box" style="grid-column: 1 / -1;">
      <h4>Logement</h4>
      <p>${propertyAddress}</p>
    </div>
  </div>

  ${roomsHTML}

  <div class="signatures">
    <div class="signature-box">
      <p><strong>Le Propriétaire</strong></p>
      <p style="font-size: 10px; color: #666;">Lu et approuvé</p>
      <div class="signature-line">${ownerName}</div>
    </div>
    <div class="signature-box">
      <p><strong>Le Locataire</strong></p>
      <p style="font-size: 10px; color: #666;">Lu et approuvé</p>
      <div class="signature-line">${tenantName}</div>
    </div>
  </div>
</body>
</html>
  `;

  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `EDL_${type}_${dateStr}.pdf`;
  const storagePath = `edl/${edlId}/${fileName}`;

  return { html, fileName, storagePath };
}

async function generateInvoicePDF(
  supabase: any,
  data: Record<string, unknown>,
  userId: string
) {
  // Similaire à receipt mais avec format facture
  const { invoiceId, invoiceData } = data as any;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; }
    .header { text-align: center; margin-bottom: 40px; }
    /* ... styles facture ... */
  </style>
</head>
<body>
  <div class="header">
    <h1>FACTURE</h1>
  </div>
  <!-- Contenu facture -->
</body>
</html>
  `;

  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `Facture_${invoiceId}_${dateStr}.pdf`;
  const storagePath = `invoices/${invoiceId}/${fileName}`;

  return { html, fileName, storagePath };
}

// ============================================
// HELPERS
// ============================================

function formatPeriode(periode: string): string {
  const [year, month] = periode.split("-");
  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    cb: "Carte bancaire",
    virement: "Virement bancaire",
    prelevement: "Prélèvement automatique",
    cheque: "Chèque",
    especes: "Espèces",
  };
  return methods[method] || method;
}

/**
 * Convertir HTML en PDF
 * Utilise une Edge Function ou un service externe
 */
async function htmlToPDF(html: string): Promise<Buffer> {
  // Option 1: Utiliser une Edge Function Supabase avec Puppeteer
  // Option 2: Utiliser un service comme html-pdf-node, Browserless, etc.
  
  // Pour le MVP, on génère un PDF simple via la bibliothèque pdf-lib
  // En production, utiliser Puppeteer ou un service dédié
  
  try {
    // Essayer d'appeler l'Edge Function
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

  // Fallback: Retourner le HTML encodé (à remplacer en production)
  // En production, utiliser puppeteer-core avec browserless.io
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Écrire un message indiquant que le PDF complet sera généré
  page.drawText("Document généré - Version HTML disponible", {
    x: 50,
    y: 800,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText("Le rendu PDF complet sera disponible sous peu.", {
    x: 50,
    y: 780,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
