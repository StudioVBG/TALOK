/**
 * PDF renderer for the tenant account statement (relevé de compte).
 *
 * Builds a single-page, brand-aligned A4 from a SituationLocataire payload.
 * The tenant downloads this from /tenant/account-statement.
 */

import { renderHtmlToPdf } from "@/lib/pdf/html-to-pdf";
import type { SituationLocataire } from "@/features/accounting/types";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? "—";
  return d.toLocaleDateString("fr-FR");
}

const STATUS_TEXT: Record<"solde" | "partiel" | "impaye", string> = {
  solde: "Solde",
  partiel: "Partiel",
  impaye: "Impaye",
};

const STATUS_CSS: Record<"solde" | "partiel" | "impaye", string> = {
  solde: "background:#dcfce7;color:#166534",
  partiel: "background:#fef3c7;color:#92400e",
  impaye: "background:#fee2e2;color:#991b1b",
};

function buildHtml(s: SituationLocataire): string {
  const tenantFullName = `${s.locataire.prenom ?? ""} ${
    s.locataire.nom ?? ""
  }`.trim();

  const rows = s.historique
    .map((row) => {
      return `
        <tr>
          <td>${escapeHtml(row.periode)}</td>
          <td>${formatDate(row.date_echeance)}</td>
          <td class="num">${euro.format(row.montant_appele)}</td>
          <td class="num">${euro.format(row.montant_paye)}</td>
          <td class="num">${euro.format(row.solde)}</td>
          <td><span class="badge" style="${STATUS_CSS[row.statut]}">${
        STATUS_TEXT[row.statut]
      }</span></td>
        </tr>`;
    })
    .join("");

  const aJour = s.situation.a_jour;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Releve de compte - ${escapeHtml(tenantFullName)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #0f172a;
    font-size: 11px;
    margin: 0;
    padding: 24px 28px;
  }
  h1 {
    font-size: 22px;
    margin: 0 0 4px 0;
    letter-spacing: -0.01em;
  }
  h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #475569;
    margin: 24px 0 8px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 12px;
  }
  .header .brand {
    font-weight: 800;
    color: #2563eb;
    font-size: 18px;
    letter-spacing: -0.02em;
  }
  .meta {
    text-align: right;
    color: #475569;
    font-size: 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 16px;
  }
  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 14px;
  }
  .card h3 {
    margin: 0 0 8px;
    font-size: 11px;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.05em;
  }
  .card p { margin: 2px 0; }
  .kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-top: 16px;
  }
  .kpi {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .kpi-label {
    font-size: 9px;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.05em;
  }
  .kpi-value {
    font-size: 16px;
    font-weight: 700;
    margin-top: 4px;
  }
  .kpi-value.profit { color: #16a34a; }
  .kpi-value.loss { color: #dc2626; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  th, td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid #e2e8f0;
  }
  th {
    background: #f1f5f9;
    color: #334155;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 0.04em;
  }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
  }
  .footer {
    margin-top: 24px;
    color: #64748b;
    font-size: 9px;
    line-height: 1.4;
  }
  .status-bar {
    margin-top: 12px;
    padding: 8px 12px;
    border-radius: 6px;
    font-weight: 600;
    text-align: center;
    ${aJour ? "background:#dcfce7;color:#166534" : "background:#fee2e2;color:#991b1b"};
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">TALOK</div>
      <h1>Releve de compte</h1>
      <p style="margin:0;color:#475569">
        ${escapeHtml(tenantFullName)} — bail depuis le ${formatDate(s.bail.date_debut)}
      </p>
    </div>
    <div class="meta">
      <div>Edite le ${formatDate(s.date_edition)}</div>
      <div>${escapeHtml(s.bien.adresse)}</div>
      <div>${escapeHtml(s.bien.code_postal)} ${escapeHtml(s.bien.ville)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Locataire</h3>
      <p><strong>${escapeHtml(tenantFullName)}</strong></p>
      ${
        s.locataire.email
          ? `<p>${escapeHtml(s.locataire.email)}</p>`
          : ""
      }
      ${
        s.locataire.telephone
          ? `<p>${escapeHtml(s.locataire.telephone)}</p>`
          : ""
      }
    </div>
    <div class="card">
      <h3>Bail</h3>
      <p>Du ${formatDate(s.bail.date_debut)}${
    s.bail.date_fin ? ` au ${formatDate(s.bail.date_fin)}` : ""
  }</p>
      <p>Loyer mensuel : <strong>${euro.format(s.bail.total_mensuel)}</strong>
        (dont ${euro.format(s.bail.provisions_charges)} de charges)</p>
      <p>Depot de garantie : ${euro.format(s.bail.depot_garantie)}</p>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Total appele</div>
      <div class="kpi-value">${euro.format(s.situation.total_appele)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total paye</div>
      <div class="kpi-value">${euro.format(s.situation.total_paye)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Solde du</div>
      <div class="kpi-value ${aJour ? "profit" : "loss"}">${euro.format(
    s.situation.solde_du,
  )}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Mois ecoules</div>
      <div class="kpi-value">${s.situation.nb_mois_bail}</div>
    </div>
  </div>

  <div class="status-bar">
    ${aJour ? "Compte a jour — aucun arriere" : "Solde restant du a regler"}
  </div>

  <h2>Historique des echeances</h2>
  <table>
    <thead>
      <tr>
        <th>Periode</th>
        <th>Echeance</th>
        <th class="num">Appele</th>
        <th class="num">Paye</th>
        <th class="num">Solde</th>
        <th>Statut</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:18px">Aucune echeance enregistree</td></tr>`}
    </tbody>
  </table>

  <p class="footer">
    Document genere automatiquement par TALOK. Ce releve est etabli sur la base
    des paiements et factures enregistres a la date d'edition. Pour toute
    contestation, merci de contacter votre proprietaire ou agence dans un
    delai de 15 jours.
  </p>
</body>
</html>`;
}

export async function renderTenantStatementPdf(
  situation: SituationLocataire,
): Promise<Buffer> {
  const html = buildHtml(situation);
  return renderHtmlToPdf(html, { format: "A4", printBackground: true });
}
