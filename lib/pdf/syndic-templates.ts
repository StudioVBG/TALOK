/**
 * HTML templates for syndic copropriété PDFs (convocations + PV)
 * Uses the new copro_* schema created in Phase 2/8.
 *
 * These HTML strings can be rendered client-side via html2pdf.js
 * or server-side via puppeteer (future enhancement).
 */

// ============================================
// Types
// ============================================

export interface ConvocationPdfData {
  // Site (copropriété)
  site_name: string;
  site_address: string;
  site_city: string;
  site_postal_code: string;

  // Syndic
  syndic_name: string;
  syndic_company?: string;
  syndic_address?: string;
  syndic_email?: string;
  syndic_phone?: string;
  syndic_siret?: string;
  syndic_numero_carte_pro?: string;

  // Assembly
  assembly_reference: string;
  assembly_type: "ordinaire" | "extraordinaire" | "concertation" | "consultation_ecrite";
  assembly_title: string;
  scheduled_at: string; // ISO
  location: string;
  location_address?: string;
  online_meeting_url?: string;
  is_hybrid: boolean;
  fiscal_year?: number;
  second_convocation_at?: string;

  // Recipient
  recipient_name: string;
  recipient_address?: string;
  unit_number?: string;
  unit_tantiemes?: number;

  // Agenda (résolutions)
  resolutions: Array<{
    resolution_number: number;
    title: string;
    description: string;
    category: string;
    majority_rule: string;
    estimated_amount_cents?: number | null;
    contract_partner?: string | null;
  }>;

  // Meta
  generated_at: string;
}

export interface MinutePdfData {
  // Site
  site_name: string;
  site_address: string;

  // Syndic
  syndic_name: string;
  syndic_company?: string;

  // Assembly
  assembly_reference: string;
  assembly_type: "ordinaire" | "extraordinaire" | "concertation" | "consultation_ecrite";
  assembly_title: string;
  scheduled_at: string;
  held_at: string;
  location: string;

  // Présidence
  president_name: string;
  secretary_name: string;
  scrutineers_names: string[];

  // Quorum
  total_tantiemes: number;
  present_tantiemes: number;
  quorum_required: number;
  quorum_reached: boolean;

  // Résolutions votées
  resolutions: Array<{
    resolution_number: number;
    title: string;
    description: string;
    category: string;
    majority_rule: string;
    status: string; // voted_for / voted_against / abstained / adjourned
    votes_for_count: number;
    votes_against_count: number;
    votes_abstain_count: number;
    tantiemes_for: number;
    tantiemes_against: number;
    tantiemes_abstain: number;
  }>;

  // Version + meta
  version: number;
  generated_at: string;
  contestation_deadline?: string;
}

// ============================================
// Helpers
// ============================================

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}

const ASSEMBLY_TYPE_LABELS: Record<string, string> = {
  ordinaire: "Assemblée Générale Ordinaire",
  extraordinaire: "Assemblée Générale Extraordinaire",
  concertation: "Concertation",
  consultation_ecrite: "Consultation écrite",
};

const CATEGORY_LABELS: Record<string, string> = {
  gestion: "Gestion courante",
  budget: "Budget",
  travaux: "Travaux",
  reglement: "Règlement de copropriété",
  honoraires: "Honoraires syndic",
  conseil_syndical: "Conseil syndical",
  assurance: "Assurance",
  conflits: "Actions en justice",
  autre: "Autre",
};

const MAJORITY_LABELS: Record<string, string> = {
  article_24: "Article 24 — Majorité simple",
  article_25: "Article 25 — Majorité absolue",
  article_25_1: "Article 25-1 — Majorité absolue avec passerelle",
  article_26: "Article 26 — Double majorité",
  article_26_1: "Article 26-1 — Double majorité avec passerelle",
  unanimite: "Unanimité",
};

const RESOLUTION_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  proposed: { label: "Non votée", color: "#666" },
  voted_for: { label: "ADOPTÉE", color: "#059669" },
  voted_against: { label: "REJETÉE", color: "#dc2626" },
  abstained: { label: "Abstention majoritaire", color: "#d97706" },
  adjourned: { label: "Ajournée", color: "#ea580c" },
  withdrawn: { label: "Retirée", color: "#6b7280" },
};

// ============================================
// Shared styles
// ============================================

const SHARED_STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #7c3aed;
    }
    .header h1 {
      font-size: 20pt;
      font-weight: bold;
      color: #1e1b4b;
      margin-bottom: 8px;
    }
    .header .subtitle {
      font-size: 13pt;
      color: #555;
      margin-bottom: 4px;
    }
    .header .reference {
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      color: #888;
      margin-top: 8px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
      padding: 20px;
      background: #f9fafb;
      border-left: 4px solid #7c3aed;
      border-radius: 4px;
    }
    .info-block h3 {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 6px;
    }
    .info-block p {
      font-size: 11pt;
      color: #1a1a1a;
      line-height: 1.4;
    }
    .info-block p.strong { font-weight: 600; }
    .section {
      margin-top: 30px;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 14pt;
      font-weight: bold;
      color: #1e1b4b;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 16px;
    }
    .resolution-block {
      margin-bottom: 20px;
      padding: 16px;
      background: #fafafa;
      border-left: 3px solid #7c3aed;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .resolution-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .resolution-title {
      font-weight: bold;
      font-size: 12pt;
      color: #1e1b4b;
      flex: 1;
    }
    .resolution-number {
      display: inline-block;
      font-family: 'Courier New', monospace;
      color: #7c3aed;
      font-weight: bold;
      margin-right: 8px;
    }
    .resolution-meta {
      font-size: 9pt;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .resolution-meta span {
      display: inline-block;
      padding: 2px 8px;
      background: #ede9fe;
      color: #5b21b6;
      border-radius: 12px;
      margin-right: 6px;
    }
    .resolution-description {
      font-size: 10pt;
      color: #374151;
      line-height: 1.6;
      margin: 8px 0;
    }
    .resolution-amount {
      font-size: 10pt;
      color: #d97706;
      font-weight: 600;
      margin-top: 6px;
    }
    .resolution-result {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }
    .vote-counts {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 8px;
    }
    .vote-count {
      text-align: center;
      padding: 8px;
      background: white;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    .vote-count-label {
      font-size: 8pt;
      color: #6b7280;
      text-transform: uppercase;
    }
    .vote-count-value {
      font-size: 14pt;
      font-weight: bold;
      margin: 2px 0;
    }
    .vote-count-tantiemes {
      font-size: 8pt;
      color: #9ca3af;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      font-size: 9pt;
      font-weight: bold;
      border-radius: 12px;
      color: white;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 9pt;
      color: #6b7280;
      text-align: center;
    }
    .legal-notice {
      margin-top: 20px;
      padding: 12px;
      background: #fef3c7;
      border-left: 3px solid #d97706;
      border-radius: 4px;
      font-size: 9pt;
      color: #92400e;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 40px;
      margin-top: 50px;
    }
    .signature-block {
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #333;
      padding-top: 8px;
      margin-top: 60px;
      font-size: 9pt;
      color: #6b7280;
    }
  </style>
`;

// ============================================
// CONVOCATION template
// ============================================

export function generateConvocationHtml(data: ConvocationPdfData): string {
  const typeLabel = ASSEMBLY_TYPE_LABELS[data.assembly_type] || data.assembly_type;

  const resolutionsHtml = data.resolutions
    .map((res) => {
      const amount = res.estimated_amount_cents
        ? `<p class="resolution-amount">Montant estimé : ${formatCents(res.estimated_amount_cents)}</p>`
        : "";
      const partner = res.contract_partner
        ? `<p class="resolution-meta">Prestataire : ${escapeHtml(res.contract_partner)}</p>`
        : "";

      return `
      <div class="resolution-block">
        <div class="resolution-header">
          <div class="resolution-title">
            <span class="resolution-number">Résolution n°${res.resolution_number}</span>
            ${escapeHtml(res.title)}
          </div>
        </div>
        <div class="resolution-meta">
          <span>${escapeHtml(CATEGORY_LABELS[res.category] || res.category)}</span>
          <span>${escapeHtml(MAJORITY_LABELS[res.majority_rule] || res.majority_rule)}</span>
        </div>
        <div class="resolution-description">${escapeHtml(res.description).replace(/\n/g, "<br>")}</div>
        ${partner}
        ${amount}
      </div>
    `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Convocation ${escapeHtml(data.assembly_reference)}</title>
  ${SHARED_STYLES}
</head>
<body>
  <div class="header">
    <h1>CONVOCATION</h1>
    <div class="subtitle">${escapeHtml(typeLabel)}</div>
    <div class="reference">${escapeHtml(data.assembly_reference)}</div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <h3>Copropriété</h3>
      <p class="strong">${escapeHtml(data.site_name)}</p>
      <p>${escapeHtml(data.site_address)}</p>
      <p>${escapeHtml(data.site_postal_code)} ${escapeHtml(data.site_city)}</p>
    </div>
    <div class="info-block">
      <h3>Syndic</h3>
      ${data.syndic_company ? `<p class="strong">${escapeHtml(data.syndic_company)}</p>` : ""}
      <p>${escapeHtml(data.syndic_name)}</p>
      ${data.syndic_address ? `<p>${escapeHtml(data.syndic_address)}</p>` : ""}
      ${data.syndic_email ? `<p>Email : ${escapeHtml(data.syndic_email)}</p>` : ""}
      ${data.syndic_phone ? `<p>Tél : ${escapeHtml(data.syndic_phone)}</p>` : ""}
      ${data.syndic_numero_carte_pro ? `<p style="font-size:9pt;color:#888;">Carte pro : ${escapeHtml(data.syndic_numero_carte_pro)}</p>` : ""}
    </div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <h3>Destinataire</h3>
      <p class="strong">${escapeHtml(data.recipient_name)}</p>
      ${data.unit_number ? `<p>Lot n°${escapeHtml(data.unit_number)}</p>` : ""}
      ${data.unit_tantiemes ? `<p>${data.unit_tantiemes} tantièmes</p>` : ""}
      ${data.recipient_address ? `<p>${escapeHtml(data.recipient_address)}</p>` : ""}
    </div>
    <div class="info-block">
      <h3>Date et lieu</h3>
      <p class="strong">${formatDateTime(data.scheduled_at)}</p>
      <p>${escapeHtml(data.location || "À définir")}</p>
      ${data.location_address ? `<p>${escapeHtml(data.location_address)}</p>` : ""}
      ${data.is_hybrid ? `<p style="color:#2563eb;">✓ Assemblée hybride (présentiel + visio)</p>` : ""}
      ${data.online_meeting_url ? `<p style="font-size:9pt;color:#2563eb;">Lien visio : ${escapeHtml(data.online_meeting_url)}</p>` : ""}
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Ordre du jour</h2>
    ${resolutionsHtml || '<p style="color:#888;">Aucune résolution inscrite.</p>'}
  </div>

  <div class="legal-notice">
    <strong>Mentions légales (loi du 10 juillet 1965) :</strong>
    <ul style="margin-left: 16px; margin-top: 4px;">
      <li>Vous pouvez vous faire représenter par un mandataire (pouvoir).</li>
      <li>Vote par correspondance possible sous 3 jours avant l'assemblée.</li>
      <li>Délai de contestation des décisions : 2 mois à compter de la notification du procès-verbal.</li>
      <li>Les copropriétaires opposants ou défaillants bénéficient d'un délai spécifique pour contester.</li>
    </ul>
    ${data.second_convocation_at ? `<p style="margin-top:8px;"><strong>Seconde convocation :</strong> ${formatDateTime(data.second_convocation_at)} (en cas de défaut de quorum)</p>` : ""}
  </div>

  <div class="footer">
    <p>Document généré le ${formatDateTime(data.generated_at)}</p>
    ${data.fiscal_year ? `<p>Exercice ${data.fiscal_year}</p>` : ""}
  </div>
</body>
</html>`;
}

// ============================================
// MINUTE (PV) template
// ============================================

export function generateMinuteHtml(data: MinutePdfData): string {
  const typeLabel = ASSEMBLY_TYPE_LABELS[data.assembly_type] || data.assembly_type;
  const quorumPercent = data.total_tantiemes > 0 ? ((data.present_tantiemes / data.total_tantiemes) * 100).toFixed(1) : "0";

  const resolutionsHtml = data.resolutions
    .map((res) => {
      const statusConfig = RESOLUTION_STATUS_LABELS[res.status] || RESOLUTION_STATUS_LABELS.proposed;
      const totalTantiemes = res.tantiemes_for + res.tantiemes_against + res.tantiemes_abstain;

      return `
      <div class="resolution-block">
        <div class="resolution-header">
          <div class="resolution-title">
            <span class="resolution-number">Résolution n°${res.resolution_number}</span>
            ${escapeHtml(res.title)}
          </div>
          <span class="status-badge" style="background: ${statusConfig.color}">
            ${statusConfig.label}
          </span>
        </div>
        <div class="resolution-meta">
          <span>${escapeHtml(CATEGORY_LABELS[res.category] || res.category)}</span>
          <span>${escapeHtml(MAJORITY_LABELS[res.majority_rule] || res.majority_rule)}</span>
        </div>
        <div class="resolution-description">${escapeHtml(res.description).replace(/\n/g, "<br>")}</div>

        <div class="resolution-result">
          <div class="vote-counts">
            <div class="vote-count">
              <div class="vote-count-label">POUR</div>
              <div class="vote-count-value" style="color:#059669;">${res.votes_for_count}</div>
              <div class="vote-count-tantiemes">${res.tantiemes_for.toLocaleString("fr-FR")} tant.</div>
            </div>
            <div class="vote-count">
              <div class="vote-count-label">CONTRE</div>
              <div class="vote-count-value" style="color:#dc2626;">${res.votes_against_count}</div>
              <div class="vote-count-tantiemes">${res.tantiemes_against.toLocaleString("fr-FR")} tant.</div>
            </div>
            <div class="vote-count">
              <div class="vote-count-label">ABSTENTION</div>
              <div class="vote-count-value" style="color:#d97706;">${res.votes_abstain_count}</div>
              <div class="vote-count-tantiemes">${res.tantiemes_abstain.toLocaleString("fr-FR")} tant.</div>
            </div>
          </div>
          ${
            totalTantiemes > 0
              ? `<p style="text-align:right;font-size:9pt;color:#6b7280;margin-top:6px;">
                  Total exprimé : ${totalTantiemes.toLocaleString("fr-FR")} tantièmes
                </p>`
              : ""
          }
        </div>
      </div>
    `;
    })
    .join("");

  const scrutineersList = data.scrutineers_names.length > 0
    ? data.scrutineers_names.map((n) => escapeHtml(n)).join(", ")
    : "—";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Procès-verbal ${escapeHtml(data.assembly_reference)}</title>
  ${SHARED_STYLES}
</head>
<body>
  <div class="header">
    <h1>PROCÈS-VERBAL</h1>
    <div class="subtitle">${escapeHtml(typeLabel)}</div>
    <div class="reference">${escapeHtml(data.assembly_reference)} — Version ${data.version}</div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <h3>Copropriété</h3>
      <p class="strong">${escapeHtml(data.site_name)}</p>
      <p>${escapeHtml(data.site_address)}</p>
    </div>
    <div class="info-block">
      <h3>Syndic</h3>
      ${data.syndic_company ? `<p class="strong">${escapeHtml(data.syndic_company)}</p>` : ""}
      <p>${escapeHtml(data.syndic_name)}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <h3>Date de tenue</h3>
      <p class="strong">${formatDateTime(data.held_at)}</p>
      <p>Date convoquée : ${formatDateTime(data.scheduled_at)}</p>
    </div>
    <div class="info-block">
      <h3>Lieu</h3>
      <p>${escapeHtml(data.location || "Non précisé")}</p>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Présidence et quorum</h2>
    <div class="info-grid">
      <div class="info-block">
        <h3>Bureau de l'assemblée</h3>
        <p><strong>Président :</strong> ${escapeHtml(data.president_name)}</p>
        <p><strong>Secrétaire :</strong> ${escapeHtml(data.secretary_name)}</p>
        <p><strong>Scrutateur(s) :</strong> ${scrutineersList}</p>
      </div>
      <div class="info-block">
        <h3>Quorum</h3>
        <p>Tantièmes totaux : ${data.total_tantiemes.toLocaleString("fr-FR")}</p>
        <p>Présents ou représentés : ${data.present_tantiemes.toLocaleString("fr-FR")} (${quorumPercent}%)</p>
        <p>Quorum requis : ${data.quorum_required.toLocaleString("fr-FR")}</p>
        <p style="margin-top:6px;color:${data.quorum_reached ? "#059669" : "#dc2626"};font-weight:bold;">
          ${data.quorum_reached ? "✓ Quorum atteint" : "✗ Quorum non atteint"}
        </p>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Résolutions</h2>
    ${resolutionsHtml || '<p style="color:#888;">Aucune résolution.</p>'}
  </div>

  <div class="signatures">
    <div class="signature-block">
      <div class="signature-line">Le Président<br><strong>${escapeHtml(data.president_name)}</strong></div>
    </div>
    <div class="signature-block">
      <div class="signature-line">Le Secrétaire<br><strong>${escapeHtml(data.secretary_name)}</strong></div>
    </div>
  </div>

  <div class="legal-notice">
    <strong>Délai de contestation (art. 42 loi du 10 juillet 1965) :</strong>
    <p>Les décisions de l'assemblée peuvent être contestées devant le tribunal judiciaire
    dans un délai de <strong>deux mois</strong> à compter de la notification du présent procès-verbal
    aux copropriétaires opposants ou défaillants.</p>
    ${data.contestation_deadline ? `<p style="margin-top:6px;"><strong>Date limite de contestation :</strong> ${formatDate(data.contestation_deadline)}</p>` : ""}
  </div>

  <div class="footer">
    <p>Procès-verbal généré le ${formatDateTime(data.generated_at)} — Version ${data.version}</p>
  </div>
</body>
</html>`;
}
