// =====================================================
// Templates HTML pour génération PDF
// =====================================================

import type { ServiceType } from '@/lib/types/copro-charges';
import { SERVICE_TYPE_LABELS } from '@/lib/types/copro-charges';

// =====================================================
// Types
// =====================================================

export interface PdfOwnerInfo {
  name: string;
  address: string;
  email?: string;
  phone?: string;
  siret?: string;
}

export interface PdfTenantInfo {
  name: string;
  address: string;
  email?: string;
}

export interface PdfPropertyInfo {
  name: string;
  lot_number: string;
  address: string;
}

export interface RegularisationChargeItem {
  service_type: ServiceType;
  label: string;
  amount: number;
}

export interface RegularisationPdfData {
  owner: PdfOwnerInfo;
  tenant: PdfTenantInfo;
  property: PdfPropertyInfo;
  fiscal_year: number;
  period_start: string;
  period_end: string;
  occupation_days: number;
  total_days: number;
  prorata_ratio: number;
  charges: RegularisationChargeItem[];
  total_charges: number;
  total_provisions: number;
  balance: number;
  generated_at: string;
}

export interface CallForFundsItem {
  label: string;
  amount: number;
}

export interface CallForFundsPdfData {
  site_name: string;
  site_address: string;
  owner: PdfOwnerInfo;
  unit: {
    lot_number: string;
    description: string;
    tantiemes: number;
    total_tantiemes: number;
  };
  call_number: string;
  period_label: string;
  due_date: string;
  items: CallForFundsItem[];
  total_amount: number;
  generated_at: string;
}

export interface MotionPdfData {
  order: number;
  title: string;
  description: string;
  required_majority: string;
  result?: 'approved' | 'rejected' | 'deferred';
  votes_for?: number;
  votes_against?: number;
  votes_abstain?: number;
  tantiemes_for?: number;
  tantiemes_against?: number;
}

export interface AssemblyPvPdfData {
  site_name: string;
  site_address: string;
  assembly_type: 'AGO' | 'AGE' | 'AGM';
  assembly_number: string;
  date: string;
  location: string;
  president_name: string;
  secretary_name: string;
  scrutineer_name?: string;
  total_tantiemes: number;
  present_tantiemes: number;
  represented_tantiemes: number;
  quorum_reached: boolean;
  attendees: Array<{
    lot_number: string;
    owner_name: string;
    tantiemes: number;
    status: 'present' | 'represented' | 'absent';
    proxy_holder?: string;
  }>;
  motions: MotionPdfData[];
  notes?: string;
  generated_at: string;
}

// =====================================================
// Styles CSS communs
// =====================================================

const baseStyles = `
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .header h2 {
      font-size: 14pt;
      font-weight: normal;
      color: #555;
    }
    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 25px;
    }
    .party {
      width: 48%;
    }
    .party-label {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 9pt;
      color: #666;
      margin-bottom: 5px;
    }
    .party-name {
      font-weight: bold;
      font-size: 12pt;
    }
    .party-details {
      font-size: 10pt;
      color: #555;
    }
    .info-box {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .info-label {
      color: #666;
    }
    .info-value {
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #f0f0f0;
      font-weight: bold;
      font-size: 10pt;
      text-transform: uppercase;
      color: #555;
    }
    td.amount {
      text-align: right;
      font-family: 'Courier New', monospace;
    }
    .total-row {
      font-weight: bold;
      background: #f5f5f5;
    }
    .total-row td {
      border-top: 2px solid #333;
    }
    .balance-row {
      font-size: 14pt;
    }
    .balance-positive {
      color: #d32f2f;
    }
    .balance-negative {
      color: #388e3c;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 9pt;
      color: #666;
    }
    .legal-text {
      font-size: 9pt;
      color: #666;
      font-style: italic;
      margin-top: 20px;
    }
    .signature-area {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 45%;
      border-top: 1px solid #999;
      padding-top: 10px;
      text-align: center;
      font-size: 10pt;
      color: #666;
    }
    .page-break {
      page-break-before: always;
    }
    .motion-box {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .motion-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .motion-order {
      background: #333;
      color: white;
      padding: 3px 10px;
      border-radius: 3px;
      font-size: 10pt;
    }
    .motion-majority {
      font-size: 9pt;
      color: #666;
    }
    .motion-title {
      font-weight: bold;
      font-size: 12pt;
      margin-bottom: 8px;
    }
    .motion-description {
      font-size: 10pt;
      color: #555;
      margin-bottom: 10px;
    }
    .motion-result {
      padding: 8px;
      border-radius: 4px;
      font-weight: bold;
      text-align: center;
    }
    .motion-approved {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .motion-rejected {
      background: #ffebee;
      color: #c62828;
    }
    .motion-deferred {
      background: #fff3e0;
      color: #ef6c00;
    }
    .vote-details {
      display: flex;
      justify-content: space-around;
      margin-top: 10px;
      font-size: 10pt;
    }
    .vote-item {
      text-align: center;
    }
    .vote-count {
      font-weight: bold;
      font-size: 12pt;
    }
  </style>
`;

// =====================================================
// Template: Régularisation des charges
// =====================================================

export function generateRegularisationHtml(data: RegularisationPdfData): string {
  const chargesRows = data.charges.map(charge => `
    <tr>
      <td>${charge.label}</td>
      <td class="amount">${formatCurrency(charge.amount)}</td>
    </tr>
  `).join('');

  const balanceClass = data.balance > 0 ? 'balance-positive' : 'balance-negative';
  const balanceText = data.balance > 0 
    ? `Le locataire devra s'acquitter de la somme de ${formatCurrency(data.balance)} correspondant au complément de charges.`
    : `Le bailleur devra rembourser la somme de ${formatCurrency(Math.abs(data.balance))} au locataire correspondant au trop-perçu de provisions.`;

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Décompte de régularisation ${data.fiscal_year}</title>
      ${baseStyles}
    </head>
    <body>
      <div class="header">
        <h1>DÉCOMPTE DE RÉGULARISATION</h1>
        <h2>DES CHARGES LOCATIVES - Année ${data.fiscal_year}</h2>
      </div>

      <div class="parties">
        <div class="party">
          <div class="party-label">Bailleur</div>
          <div class="party-name">${data.owner.name}</div>
          <div class="party-details">
            ${data.owner.address}<br>
            ${data.owner.email ? `Email: ${data.owner.email}<br>` : ''}
            ${data.owner.siret ? `SIRET: ${data.owner.siret}` : ''}
          </div>
        </div>
        <div class="party">
          <div class="party-label">Locataire</div>
          <div class="party-name">${data.tenant.name}</div>
          <div class="party-details">
            ${data.property.name}<br>
            Lot n°${data.property.lot_number}<br>
            ${data.property.address}
          </div>
        </div>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Période</span>
          <span class="info-value">Du ${formatDate(data.period_start)} au ${formatDate(data.period_end)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Occupation</span>
          <span class="info-value">${data.occupation_days} jours sur ${data.total_days} (${(data.prorata_ratio * 100).toFixed(1)}%)</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nature de la charge</th>
            <th style="text-align: right">Montant</th>
          </tr>
        </thead>
        <tbody>
          ${chargesRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td>Total des charges réelles</td>
            <td class="amount">${formatCurrency(data.total_charges)}</td>
          </tr>
          <tr>
            <td>Provisions versées</td>
            <td class="amount">- ${formatCurrency(data.total_provisions)}</td>
          </tr>
          <tr class="total-row balance-row">
            <td>SOLDE</td>
            <td class="amount ${balanceClass}">${data.balance >= 0 ? '+' : ''}${formatCurrency(data.balance)}</td>
          </tr>
        </tfoot>
      </table>

      <p class="legal-text">
        ${balanceText}
      </p>
      <p class="legal-text">
        Ce décompte est établi conformément aux articles 23 et suivants de la loi n° 89-462 du 6 juillet 1989 
        et au décret n° 87-713 du 26 août 1987 fixant la liste des charges récupérables.
      </p>

      <div class="footer">
        Document généré le ${formatDate(data.generated_at)}
      </div>
    </body>
    </html>
  `;
}

// =====================================================
// Template: Appel de fonds COPRO
// =====================================================

export function generateCallForFundsHtml(data: CallForFundsPdfData): string {
  const itemsRows = data.items.map(item => `
    <tr>
      <td>${item.label}</td>
      <td class="amount">${formatCurrency(item.amount)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Appel de fonds ${data.call_number}</title>
      ${baseStyles}
    </head>
    <body>
      <div class="header">
        <h1>APPEL DE FONDS</h1>
        <h2>${data.site_name}</h2>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Appel n°</span>
          <span class="info-value">${data.call_number}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Période</span>
          <span class="info-value">${data.period_label}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date limite de paiement</span>
          <span class="info-value">${formatDate(data.due_date)}</span>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <div class="party-label">Copropriétaire</div>
          <div class="party-name">${data.owner.name}</div>
          <div class="party-details">
            ${data.owner.address}<br>
            ${data.owner.email ? `Email: ${data.owner.email}` : ''}
          </div>
        </div>
        <div class="party">
          <div class="party-label">Lot</div>
          <div class="party-name">N° ${data.unit.lot_number}</div>
          <div class="party-details">
            ${data.unit.description}<br>
            Tantièmes: ${data.unit.tantiemes} / ${data.unit.total_tantiemes}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Désignation</th>
            <th style="text-align: right">Montant</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td>TOTAL À PAYER</td>
            <td class="amount">${formatCurrency(data.total_amount)}</td>
          </tr>
        </tfoot>
      </table>

      <p class="legal-text">
        En cas de non-paiement à la date d'échéance, des pénalités de retard pourront être appliquées 
        conformément au règlement de copropriété.
      </p>

      <div class="info-box" style="margin-top: 30px;">
        <div class="info-row">
          <span class="info-label">Règlement par virement</span>
          <span></span>
        </div>
        <div class="info-row">
          <span class="info-label">IBAN</span>
          <span class="info-value">FR76 XXXX XXXX XXXX XXXX XXXX XXX</span>
        </div>
        <div class="info-row">
          <span class="info-label">Référence</span>
          <span class="info-value">${data.call_number} - LOT ${data.unit.lot_number}</span>
        </div>
      </div>

      <div class="footer">
        ${data.site_name} - ${data.site_address}<br>
        Document généré le ${formatDate(data.generated_at)}
      </div>
    </body>
    </html>
  `;
}

// =====================================================
// Template: PV d'Assemblée Générale
// =====================================================

export function generateAssemblyPvHtml(data: AssemblyPvPdfData): string {
  const assemblyTypeLabel = {
    AGO: 'Assemblée Générale Ordinaire',
    AGE: 'Assemblée Générale Extraordinaire',
    AGM: 'Assemblée Générale Mixte'
  }[data.assembly_type];

  // Tableau de présence
  const attendeesRows = data.attendees.map(a => `
    <tr>
      <td>${a.lot_number}</td>
      <td>${a.owner_name}</td>
      <td class="amount">${a.tantiemes}</td>
      <td>${a.status === 'present' ? '✓' : ''}</td>
      <td>${a.status === 'represented' ? `✓ (${a.proxy_holder})` : ''}</td>
      <td>${a.status === 'absent' ? '✓' : ''}</td>
    </tr>
  `).join('');

  // Résolutions
  const motionsHtml = data.motions.map(motion => {
    const resultClass = motion.result === 'approved' ? 'motion-approved' : 
                        motion.result === 'rejected' ? 'motion-rejected' : 'motion-deferred';
    const resultLabel = motion.result === 'approved' ? 'ADOPTÉE' :
                        motion.result === 'rejected' ? 'REJETÉE' : 'REPORTÉE';
    
    return `
      <div class="motion-box">
        <div class="motion-header">
          <span class="motion-order">Résolution ${motion.order}</span>
          <span class="motion-majority">${motion.required_majority}</span>
        </div>
        <div class="motion-title">${motion.title}</div>
        <div class="motion-description">${motion.description}</div>
        ${motion.result ? `
          <div class="motion-result ${resultClass}">${resultLabel}</div>
          <div class="vote-details">
            <div class="vote-item">
              <div class="vote-count">${motion.votes_for || 0}</div>
              <div>Pour</div>
              <div style="font-size: 9pt; color: #666;">${motion.tantiemes_for || 0} t.</div>
            </div>
            <div class="vote-item">
              <div class="vote-count">${motion.votes_against || 0}</div>
              <div>Contre</div>
              <div style="font-size: 9pt; color: #666;">${motion.tantiemes_against || 0} t.</div>
            </div>
            <div class="vote-item">
              <div class="vote-count">${motion.votes_abstain || 0}</div>
              <div>Abstention</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>PV ${data.assembly_type} - ${data.site_name}</title>
      ${baseStyles}
    </head>
    <body>
      <div class="header">
        <h1>PROCÈS-VERBAL</h1>
        <h2>${assemblyTypeLabel}</h2>
        <p style="margin-top: 10px; font-size: 12pt;">${data.site_name}</p>
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">N° d'assemblée</span>
          <span class="info-value">${data.assembly_number}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date</span>
          <span class="info-value">${formatDate(data.date)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Lieu</span>
          <span class="info-value">${data.location}</span>
        </div>
      </div>

      <h3 style="margin-bottom: 10px;">Bureau de l'assemblée</h3>
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Président de séance</span>
          <span class="info-value">${data.president_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Secrétaire</span>
          <span class="info-value">${data.secretary_name}</span>
        </div>
        ${data.scrutineer_name ? `
        <div class="info-row">
          <span class="info-label">Scrutateur</span>
          <span class="info-value">${data.scrutineer_name}</span>
        </div>
        ` : ''}
      </div>

      <h3 style="margin-bottom: 10px;">Quorum</h3>
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Tantièmes total copropriété</span>
          <span class="info-value">${data.total_tantiemes}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tantièmes présents</span>
          <span class="info-value">${data.present_tantiemes}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tantièmes représentés</span>
          <span class="info-value">${data.represented_tantiemes}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Total (présents + représentés)</span>
          <span class="info-value">${data.present_tantiemes + data.represented_tantiemes} (${((data.present_tantiemes + data.represented_tantiemes) / data.total_tantiemes * 100).toFixed(1)}%)</span>
        </div>
        <div class="info-row">
          <span class="info-label">Quorum atteint</span>
          <span class="info-value" style="color: ${data.quorum_reached ? '#2e7d32' : '#c62828'}">
            ${data.quorum_reached ? 'OUI' : 'NON'}
          </span>
        </div>
      </div>

      <div class="page-break"></div>

      <h3 style="margin-bottom: 15px;">Feuille de présence</h3>
      <table>
        <thead>
          <tr>
            <th>Lot</th>
            <th>Copropriétaire</th>
            <th style="text-align: right">Tantièmes</th>
            <th>Présent</th>
            <th>Représenté</th>
            <th>Absent</th>
          </tr>
        </thead>
        <tbody>
          ${attendeesRows}
        </tbody>
      </table>

      <div class="page-break"></div>

      <h3 style="margin-bottom: 15px;">Résolutions</h3>
      ${motionsHtml}

      ${data.notes ? `
        <h3 style="margin-top: 30px; margin-bottom: 10px;">Observations</h3>
        <div class="info-box">
          <p>${data.notes}</p>
        </div>
      ` : ''}

      <p class="legal-text" style="margin-top: 40px;">
        La séance est levée à ___h___, le présent procès-verbal a été dressé et sera notifié 
        à tous les copropriétaires dans le délai légal d'un mois conformément à l'article 17 
        du décret du 17 mars 1967.
      </p>

      <div class="signature-area">
        <div class="signature-box">
          Le Président de séance<br><br><br><br>
          ${data.president_name}
        </div>
        <div class="signature-box">
          Le Secrétaire<br><br><br><br>
          ${data.secretary_name}
        </div>
      </div>

      <div class="footer">
        ${data.site_name} - ${data.site_address}<br>
        Document généré le ${formatDate(data.generated_at)}
      </div>
    </body>
    </html>
  `;
}

// =====================================================
// Helpers
// =====================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

