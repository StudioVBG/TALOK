/**
 * SOTA 2026 — Generation du document HTML signe de bail
 *
 * Utilise buildBailData() comme unique source de donnees.
 * Injecte les signatures et le certificat.
 */

import { getServiceClient } from "@/lib/supabase/service-client";
import { LeaseTemplateService } from "@/lib/templates/bail";
import { buildBailData } from "@/lib/builders/bail-data.builder";
import { isOwnerRole } from "@/lib/constants/roles";

// ─── Types ───────────────────────────────────────────────────────────

export interface SignatureInfo {
  name: string;
  imageUrl?: string;
  signedAt?: string;
  status?: string;
  proof?: any;
}

export interface GeneratedLeaseDocResult {
  html: string;
  fileName: string;
}

// ─── Fonction principale ─────────────────────────────────────────────

export async function generateSignedLeasePDF(leaseId: string): Promise<GeneratedLeaseDocResult> {
  const serviceClient = getServiceClient();

  const { bailData, typeBail, property, lease } = await buildBailData(serviceClient, leaseId, {
    includeSignatures: true,
    includeDiagnostics: true,
  });

  const signersArr = (lease.signers as any[]) || [];

  // Resolve signature image URLs
  const signatureImages: Record<string, string> = {};
  for (const signer of signersArr) {
    if (signer.signature_image_path && signer.signature_status === "signed") {
      try {
        const { data: signedUrl } = await serviceClient.storage
          .from("documents")
          .createSignedUrl(signer.signature_image_path, 3600);
        if (signedUrl?.signedUrl) {
          signatureImages[isOwnerRole(signer.role) ? "owner" : "tenant"] = signedUrl.signedUrl;
        }
      } catch { /* non-blocking */ }
    }
  }

  const signedDocs = ((lease.documents as any[]) || []).filter(
    (d: any) => d.type === "bail_signe_locataire" || d.type === "bail_signe_proprietaire"
  );
  const signatureProofs = signedDocs.map((d: any) => d.metadata).filter(Boolean);

  const tenantSigner = signersArr.find((s: any) => !isOwnerRole(s.role));
  const ownerSigner = signersArr.find((s: any) => isOwnerRole(s.role));

  let html = LeaseTemplateService.generateHTML(typeBail, bailData);

  html = injectSignatures(html, {
    tenant: {
      name: tenantSigner?.profile ? `${tenantSigner.profile.prenom || ""} ${tenantSigner.profile.nom || ""}`.trim() : (tenantSigner?.invited_name || "Locataire"),
      imageUrl: signatureImages.tenant,
      signedAt: tenantSigner?.signed_at,
      status: tenantSigner?.signature_status,
      proof: signatureProofs.find((p: any) => p?.signer?.role === "locataire"),
    },
    owner: {
      name: bailData.bailleur ? `${bailData.bailleur.prenom || ""} ${bailData.bailleur.nom || ""}`.trim() : "Propriétaire",
      imageUrl: signatureImages.owner,
      signedAt: ownerSigner?.signed_at,
      status: ownerSigner?.signature_status,
      proof: signatureProofs.find((p: any) => p?.signer?.role === "proprietaire"),
    },
  });

  html = addSignatureCertificatePage(html, {
    leaseId,
    tenantProof: signatureProofs.find((p: any) => p?.signer?.role === "locataire"),
    ownerProof: signatureProofs.find((p: any) => p?.signer?.role === "proprietaire"),
    signedAt: tenantSigner?.signed_at || ownerSigner?.signed_at,
  });

  const sealedDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bail de Location - Document Signé</title>
  <style>
    @page { size: A4; margin: 20mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; max-width: 210mm; margin: 0 auto; padding: 20mm; background: white; }
    .sealed-badge { position: fixed; top: 10mm; right: 10mm; background: #059669; color: white; padding: 5px 15px; border-radius: 4px; font-size: 10pt; font-weight: bold; z-index: 1000; }
  </style>
</head>
<body>
  <div class="sealed-badge">DOCUMENT SIGNE ET CERTIFIE</div>
  ${html}
  <footer style="margin-top: 30mm; padding-top: 10mm; border-top: 1px solid #ccc; font-size: 9pt; color: #666;">
    <p>Document scelle le ${sealedDate}</p>
    <p>Reference : ${leaseId.substring(0, 8).toUpperCase()}</p>
  </footer>
</body>
</html>`;

  return {
    html: fullHtml,
    fileName: `Bail_Signe_${property?.ville || "location"}_${new Date().toISOString().split("T")[0]}.html`,
  };
}

// ─── Helpers exports ────────────────────────────────────────────────

export function injectSignatures(
  html: string,
  signatures: { tenant: SignatureInfo; owner: SignatureInfo }
): string {
  const signatureStyle = `<style>
    .signature-image { max-width: 200px; max-height: 80px; object-fit: contain; border-bottom: 1px solid #999; padding: 5px 0; }
    .signature-info { font-size: 9pt; color: #666; margin-top: 5px; }
    .signature-verified { color: #2e7d32; font-weight: bold; }
    .signature-pending { color: #ef6c00; font-style: italic; }
    .digital-signature-badge { display: inline-flex; align-items: center; gap: 5px; background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 4px; font-size: 8pt; margin-top: 3px; }
  </style>`;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const buildSignatureHtml = (sig: SignatureInfo) => {
    if (sig.imageUrl) {
      return `<img src="${sig.imageUrl}" alt="Signature" class="signature-image" />
        <div class="signature-info"><span class="signature-verified">Signe electroniquement</span><br>${sig.signedAt ? `Le ${formatDate(sig.signedAt)}` : ""}
        ${sig.proof?.proof_id ? `<div class="digital-signature-badge">Preuve: ${sig.proof.proof_id.slice(0, 8)}...</div>` : ""}</div>`;
    }
    if (sig.status === "signed") {
      return `<div class="signature-info signature-verified">Signe electroniquement<br>${sig.name}</div>`;
    }
    return `<div class="signature-info signature-pending">En attente de signature</div>`;
  };

  html = html.replace("</head>", `${signatureStyle}</head>`);
  html = html.replace(/<div class="signature-line"><\/div>\s*<p style="font-size: 9pt;">{{LOCATAIRE_NOM_COMPLET}}<\/p>/g, `${buildSignatureHtml(signatures.tenant)}<p style="font-size: 9pt;">${signatures.tenant.name}</p>`);
  html = html.replace(/<div class="signature-line"><\/div>\s*<p style="font-size: 9pt;">{{BAILLEUR_NOM_COMPLET}}<\/p>/g, `${buildSignatureHtml(signatures.owner)}<p style="font-size: 9pt;">${signatures.owner.name}</p>`);
  html = html.replace(/<div class="sig-line"><\/div>\s*<p class="sig-name">{{BAILLEUR_NOM_COMPLET}}<\/p>/g, `${buildSignatureHtml(signatures.owner)}<p class="sig-name">${signatures.owner.name}</p>`);
  html = html.replace(/<div class="sig-line"><\/div>\s*<p class="sig-name">{{LOCATAIRE_NOM_COMPLET}}<\/p>/g, `${buildSignatureHtml(signatures.tenant)}<p class="sig-name">${signatures.tenant.name}</p>`);
  return html;
}

export function addSignatureCertificatePage(
  html: string,
  data: { leaseId: string; tenantProof?: any; ownerProof?: any; signedAt?: string }
): string {
  const now = new Date();
  const formatFR = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const proofSection = (label: string, proof: any | undefined) => {
    if (!proof) return `<div style="background:#fff3e0;padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #ef6c00;"><h3 style="margin-top:0;color:#ef6c00;">En attente — Signature ${label}</h3><p style="margin:0;color:#666;">En attente de signature</p></div>`;
    return `<div style="background:#e8f5e9;padding:20px;border-radius:8px;margin-bottom:20px;border-left:4px solid #2e7d32;">
      <h3 style="margin-top:0;color:#2e7d32;">Signature ${label}</h3>
      <table style="width:100%;font-size:10pt;">
        <tr><td style="padding:3px 0;color:#666;width:40%;">Signataire</td><td>${proof.signer?.name || "N/A"}</td></tr>
        <tr><td style="padding:3px 0;color:#666;">ID de preuve</td><td style="font-family:monospace;">${proof.proof_id || "N/A"}</td></tr>
        <tr><td style="padding:3px 0;color:#666;">Date et heure</td><td>${proof.timestamp ? new Date(proof.timestamp).toLocaleString("fr-FR") : "N/A"}</td></tr>
        <tr><td style="padding:3px 0;color:#666;">Hash du document</td><td style="font-family:monospace;font-size:9pt;">${proof.document_hash?.slice(0, 32) || "N/A"}...</td></tr>
      </table></div>`;
  };

  const certificateHtml = `<div class="page-break"></div>
    <div style="padding:40px;font-family:Arial,sans-serif;">
      <div style="text-align:center;margin-bottom:40px;"><h1 style="color:#1a5f7a;margin-bottom:5px;">CERTIFICAT DE SIGNATURE ELECTRONIQUE</h1><p style="color:#666;font-size:12pt;">Preuve d'authenticite et d'integrite</p></div>
      <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin-bottom:30px;">
        <h3 style="margin-top:0;color:#333;">Document certifie</h3>
        <table style="width:100%;font-size:11pt;">
          <tr><td style="padding:5px 0;color:#666;">Reference</td><td style="font-weight:bold;">${data.leaseId.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td style="padding:5px 0;color:#666;">Date</td><td>${formatFR(now)}</td></tr>
        </table></div>
      ${proofSection("du Locataire", data.tenantProof)}
      ${proofSection("du Proprietaire", data.ownerProof)}
      <div style="margin-top:40px;padding:20px;background:#f9f9f9;border-radius:8px;">
        <h4 style="margin-top:0;color:#333;">Valeur juridique</h4>
        <p style="font-size:10pt;color:#666;line-height:1.6;">Ce document a ete signe electroniquement conformement aux articles 1366 et 1367 du Code civil et au reglement europeen eIDAS (UE) n 910/2014.</p></div>
      <div style="margin-top:30px;text-align:center;color:#999;font-size:9pt;"><p>Genere par Talok - ${now.toLocaleDateString("fr-FR")}</p></div>
    </div>`;

  return html.replace("</body>", `${certificateHtml}</body>`);
}

export function numberToWords(n: number): string {
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
  if (n < 20) return units[Math.floor(n)];
  if (n < 100) { const t = Math.floor(n / 10); const u = Math.floor(n % 10); if (t === 7 || t === 9) return tens[t] + (u === 1 && t === 7 ? "-et-" : "-") + units[10 + u]; return tens[t] + (u === 1 && t !== 8 ? "-et-" : u ? "-" : "") + units[u]; }
  if (n < 1000) { const h = Math.floor(n / 100); const r = Math.floor(n % 100); return (h === 1 ? "cent" : units[h] + " cent") + (r ? " " + numberToWords(r) : h > 1 ? "s" : ""); }
  if (n < 10000) { const m = Math.floor(n / 1000); const r = Math.floor(n % 1000); return (m === 1 ? "mille" : units[m] + " mille") + (r ? " " + numberToWords(r) : ""); }
  return `${n.toFixed(2)} euros`;
}
