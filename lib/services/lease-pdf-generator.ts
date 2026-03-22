/**
 * SOTA 2026 — Generation du document HTML signe de bail
 *
 * Utilise buildBailData() comme unique source de donnees.
 * Les signatures et le certificat sont geres directement par le template
 * via dataToVariables() (BAILLEUR_SIGNATURE_IMAGE, CERTIFICATE_HTML, etc.).
 */

import { getServiceClient } from "@/lib/supabase/service-client";
import { LeaseTemplateService } from "@/lib/templates/bail";
import { buildBailData } from "@/lib/builders/bail-data.builder";

// ─── Types ───────────────────────────────────────────────────────────

export interface GeneratedLeaseDocResult {
  html: string;
  fileName: string;
}

// ─── Fonction principale ─────────────────────────────────────────────

export async function generateSignedLeasePDF(leaseId: string): Promise<GeneratedLeaseDocResult> {
  const serviceClient = getServiceClient();

  const { bailData, typeBail, property } = await buildBailData(serviceClient, leaseId, {
    includeSignatures: true,
    includeDiagnostics: true,
  });

  let html = LeaseTemplateService.generateHTML(typeBail, bailData);

  const sealedDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const sealedBadgeStyle = `<style>
    .sealed-badge { position: fixed; top: 10mm; right: 10mm; background: #059669; color: white; padding: 5px 15px; border-radius: 4px; font-size: 10pt; font-weight: bold; z-index: 1000; }
    @media print { .sealed-badge { position: absolute; } }
  </style>`;
  html = html.replace("</head>", `${sealedBadgeStyle}</head>`);

  html = html.replace(/<body([^>]*)>/, `<body$1><div class="sealed-badge">DOCUMENT SIGNE ET CERTIFIE</div>`);

  const footer = `<footer style="margin-top: 30mm; padding-top: 10mm; border-top: 1px solid #ccc; font-size: 9pt; color: #666;">
    <p>Document scelle le ${sealedDate}</p>
    <p>Reference : ${leaseId.substring(0, 8).toUpperCase()}</p>
  </footer>`;
  html = html.replace("</body>", `${footer}</body>`);

  return {
    html,
    fileName: `Bail_Signe_${property?.ville || "location"}_${new Date().toISOString().split("T")[0]}.html`,
  };
}

// ─── Helpers exports ────────────────────────────────────────────────

export function numberToWords(n: number): string {
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
  if (n < 20) return units[Math.floor(n)];
  if (n < 100) { const t = Math.floor(n / 10); const u = Math.floor(n % 10); if (t === 7 || t === 9) return tens[t] + (u === 1 && t === 7 ? "-et-" : "-") + units[10 + u]; return tens[t] + (u === 1 && t !== 8 ? "-et-" : u ? "-" : "") + units[u]; }
  if (n < 1000) { const h = Math.floor(n / 100); const r = Math.floor(n % 100); return (h === 1 ? "cent" : units[h] + " cent") + (r ? " " + numberToWords(r) : h > 1 ? "s" : ""); }
  if (n < 10000) { const m = Math.floor(n / 1000); const r = Math.floor(n % 1000); return (m === 1 ? "mille" : units[m] + " mille") + (r ? " " + numberToWords(r) : ""); }
  return `${n.toFixed(2)} euros`;
}
