/**
 * Génère une facture PDF pour un work order avec ventilation TVA conforme.
 *
 * Format : A4, mentions légales obligatoires (n° SIRET prestataire, mention
 * TVA art. 279-0 bis CGI / art. 296 CGI selon localisation, etc.).
 *
 * Cette facture est émise par le PRESTATAIRE au PROPRIETAIRE (pas par Talok).
 * Talok facture sa commission séparément, mensuellement, au prestataire.
 */

import { renderHtmlToPdf } from "./html-to-pdf";

export interface WorkOrderInvoiceData {
  /** Numéro de facture (généré par le prestataire ou Talok) */
  invoiceNumber: string;
  /** Date d'émission au format YYYY-MM-DD */
  invoiceDate: string;
  /** Date d'échéance (optionnel) */
  dueDate?: string | null;

  /** Prestataire (émetteur) */
  provider: {
    companyName: string;
    contactName?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    siret?: string | null;
    vatNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    /** Si en franchise en base TVA, on n'affiche pas la TVA */
    isVatExempt?: boolean;
  };

  /** Propriétaire (destinataire) */
  client: {
    name: string;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
  };

  /** Bien concerné par les travaux */
  property: {
    address: string;
    city: string;
    postalCode: string;
  };

  /** Lignes de devis / facture */
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPriceCents: number;
    taxRate: number; // 0.10, 0.20, etc.
  }>;

  /** Régime TVA appliqué (référence légale) */
  tvaReference: string;

  /** Notes / conditions */
  notes?: string | null;
}

const fmt = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const fmtPct = (rate: number) => {
  const v = rate * 100;
  return v % 1 === 0 ? `${v.toFixed(0)} %` : `${v.toFixed(1).replace(".", ",")} %`;
};

const escapeHtml = (s: string | null | undefined): string => {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

function buildHtml(data: WorkOrderInvoiceData): string {
  // Calculs ventilation
  const linesWithTotals = data.items.map((it) => {
    const lineHTCents = Math.round(it.quantity * it.unitPriceCents);
    const lineTVACents = data.provider.isVatExempt
      ? 0
      : Math.round(lineHTCents * it.taxRate);
    return {
      ...it,
      lineHTCents,
      lineTVACents,
      lineTTCCents: lineHTCents + lineTVACents,
    };
  });

  const totalHT = linesWithTotals.reduce((s, l) => s + l.lineHTCents, 0);
  const totalTVA = linesWithTotals.reduce((s, l) => s + l.lineTVACents, 0);
  const totalTTC = totalHT + totalTVA;

  // Ventilation par taux (utile si plusieurs taux dans la même facture)
  const tvaByRate = new Map<number, { ht: number; tva: number }>();
  linesWithTotals.forEach((l) => {
    const cur = tvaByRate.get(l.taxRate) ?? { ht: 0, tva: 0 };
    tvaByRate.set(l.taxRate, {
      ht: cur.ht + l.lineHTCents,
      tva: cur.tva + l.lineTVACents,
    });
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Facture ${escapeHtml(data.invoiceNumber)}</title>
  <style>
    @page { size: A4; margin: 1.5cm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11pt; line-height: 1.4; margin: 0; padding: 0; }
    h1 { font-size: 24pt; margin: 0 0 4pt; color: #1d4ed8; }
    h2 { font-size: 12pt; margin: 0 0 6pt; color: #475569; text-transform: uppercase; letter-spacing: 0.5pt; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24pt; }
    .header-right { text-align: right; }
    .meta { color: #64748b; font-size: 10pt; }
    .parties { display: flex; gap: 16pt; margin-bottom: 24pt; }
    .party { flex: 1; padding: 12pt; background: #f8fafc; border-radius: 6pt; border: 1pt solid #e2e8f0; }
    .property-banner { padding: 10pt 12pt; background: #eff6ff; border-left: 3pt solid #2563eb; border-radius: 4pt; margin-bottom: 18pt; font-size: 10pt; color: #1e3a8a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16pt; }
    th, td { padding: 8pt 6pt; text-align: left; border-bottom: 0.5pt solid #cbd5e1; }
    th { background: #1e3a8a; color: #fff; font-weight: 600; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.3pt; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 12pt; margin-left: auto; width: 50%; }
    .totals tr td { border: none; padding: 4pt 0; }
    .totals .label { color: #64748b; }
    .totals .ttc { font-size: 14pt; font-weight: 700; padding-top: 8pt; border-top: 1pt solid #1e3a8a; }
    .footer { margin-top: 32pt; padding-top: 12pt; border-top: 0.5pt solid #cbd5e1; font-size: 9pt; color: #64748b; }
    .footer p { margin: 2pt 0; }
    .legal { margin-top: 16pt; font-size: 8.5pt; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>FACTURE</h1>
      <div class="meta">N° ${escapeHtml(data.invoiceNumber)}</div>
      <div class="meta">Émise le ${fmtDate(data.invoiceDate)}</div>
      ${data.dueDate ? `<div class="meta">Échéance : ${fmtDate(data.dueDate)}</div>` : ""}
    </div>
    <div class="header-right">
      <strong>${escapeHtml(data.provider.companyName)}</strong><br />
      ${data.provider.address ? `${escapeHtml(data.provider.address)}<br />` : ""}
      ${data.provider.postalCode ? `${escapeHtml(data.provider.postalCode)} ${escapeHtml(data.provider.city ?? "")}<br />` : ""}
      ${data.provider.siret ? `<span class="meta">SIRET : ${escapeHtml(data.provider.siret)}</span><br />` : ""}
      ${data.provider.vatNumber ? `<span class="meta">TVA : ${escapeHtml(data.provider.vatNumber)}</span>` : ""}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h2>Émetteur</h2>
      <strong>${escapeHtml(data.provider.companyName)}</strong><br />
      ${data.provider.contactName ? `${escapeHtml(data.provider.contactName)}<br />` : ""}
      ${data.provider.email ? `${escapeHtml(data.provider.email)}<br />` : ""}
      ${data.provider.phone ? escapeHtml(data.provider.phone) : ""}
    </div>
    <div class="party">
      <h2>Destinataire</h2>
      <strong>${escapeHtml(data.client.name)}</strong><br />
      ${data.client.address ? `${escapeHtml(data.client.address)}<br />` : ""}
      ${data.client.postalCode ? `${escapeHtml(data.client.postalCode)} ${escapeHtml(data.client.city ?? "")}` : ""}
    </div>
  </div>

  <div class="property-banner">
    <strong>Lieu d'intervention :</strong>
    ${escapeHtml(data.property.address)}, ${escapeHtml(data.property.postalCode)} ${escapeHtml(data.property.city)}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Qté</th>
        <th>Unité</th>
        <th class="num">PU HT</th>
        <th class="num">TVA</th>
        <th class="num">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${linesWithTotals
        .map(
          (l) => `
      <tr>
        <td>${escapeHtml(l.description)}</td>
        <td class="num">${l.quantity}</td>
        <td>${escapeHtml(l.unit)}</td>
        <td class="num">${fmt(l.unitPriceCents)}</td>
        <td class="num">${data.provider.isVatExempt ? "—" : fmtPct(l.taxRate)}</td>
        <td class="num">${fmt(l.lineHTCents)}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <table class="totals">
    <tr>
      <td class="label">Total HT</td>
      <td class="num">${fmt(totalHT)}</td>
    </tr>
    ${
      data.provider.isVatExempt
        ? `<tr>
            <td class="label" colspan="2" style="font-style: italic; color: #64748b; padding-top: 8pt;">
              TVA non applicable, art. 293 B du CGI
            </td>
          </tr>`
        : Array.from(tvaByRate.entries())
            .map(
              ([rate, t]) => `
    <tr>
      <td class="label">TVA ${fmtPct(rate)} sur ${fmt(t.ht)}</td>
      <td class="num">${fmt(t.tva)}</td>
    </tr>`,
            )
            .join("")
    }
    <tr>
      <td class="ttc">Total TTC</td>
      <td class="ttc num">${fmt(totalTTC)}</td>
    </tr>
  </table>

  ${data.notes ? `<div class="footer"><p><strong>Conditions :</strong> ${escapeHtml(data.notes)}</p></div>` : ""}

  <div class="legal">
    <p>${escapeHtml(data.tvaReference)}</p>
    <p>En cas de retard de paiement, application d'une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L.441-10 Code de commerce).</p>
    <p>Tout règlement s'effectue via la plateforme Talok (paiement par carte) ou par virement bancaire.</p>
  </div>
</body>
</html>`;
}

export async function generateWorkOrderInvoicePdf(
  data: WorkOrderInvoiceData,
): Promise<Buffer> {
  const html = buildHtml(data);
  return await renderHtmlToPdf(html, {
    format: "A4",
    margin: { top: "1.5cm", right: "1.5cm", bottom: "1.5cm", left: "1.5cm" },
  });
}
