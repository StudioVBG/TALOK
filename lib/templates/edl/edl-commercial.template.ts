/**
 * Template HTML pour l'État des Lieux Commercial et Professionnel
 * GAP-007: EDL spécifique pour les locaux commerciaux et professionnels
 *
 * Spécificités:
 * - Sections commerciales (façade, vitrine, enseigne)
 * - Conformité ERP et sécurité incendie
 * - Accessibilité PMR
 * - Installations techniques détaillées
 * - Équipements professionnels
 */

export const EDL_COMMERCIAL_TEMPLATE = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>État des lieux {{EDL_TYPE_LABEL}} - {{EDL_REFERENCE}}</title>
  <style>
    @page {
      size: A4;
      margin: 10mm 10mm 15mm 10mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #1a1a1a;
      background: white;
    }

    .page {
      page-break-after: always;
      padding: 0;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10px;
      border-bottom: 3px solid #7c3aed;
      margin-bottom: 12px;
    }

    .header-left h1 {
      font-size: 16pt;
      font-weight: 700;
      color: #7c3aed;
      margin-bottom: 2px;
    }

    .header-left .edl-type {
      font-size: 11pt;
      font-weight: 600;
      color: {{EDL_TYPE_COLOR}};
      text-transform: uppercase;
    }

    .header-left .bail-type-badge {
      display: inline-block;
      padding: 3px 10px;
      background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
      color: white;
      border-radius: 20px;
      font-size: 8pt;
      font-weight: 600;
      margin-top: 4px;
    }

    .header-right {
      text-align: right;
    }

    .reference-box {
      background: #f5f3ff;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #c4b5fd;
    }

    .reference-box .label {
      font-size: 7.5pt;
      color: #6d28d9;
      text-transform: uppercase;
    }

    .reference-box .value {
      font-size: 10pt;
      font-weight: 700;
      color: #5b21b6;
      font-family: 'Courier New', monospace;
    }

    /* Sections */
    .section {
      margin-bottom: 12px;
    }

    .section-title {
      font-size: 10pt;
      font-weight: 700;
      color: #5b21b6;
      padding: 6px 10px;
      background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
      border-left: 4px solid #7c3aed;
      margin-bottom: 8px;
      border-radius: 0 4px 4px 0;
    }

    .section-content {
      padding: 0 5px;
    }

    /* Grid layout */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
    }

    /* Info boxes */
    .info-box {
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 6px;
      padding: 10px;
    }

    .info-box h3 {
      font-size: 9pt;
      font-weight: 600;
      color: #6d28d9;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e9d5ff;
    }

    .info-row {
      display: flex;
      margin-bottom: 3px;
    }

    .info-row .label {
      font-weight: 500;
      color: #6b7280;
      width: 120px;
      flex-shrink: 0;
      font-size: 8.5pt;
    }

    .info-row .value {
      color: #1e293b;
      font-weight: 500;
      font-size: 8.5pt;
    }

    /* Compliance badges */
    .compliance-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 8pt;
      font-weight: 600;
    }

    .compliance-badge.conforme {
      background: #dcfce7;
      color: #166534;
    }

    .compliance-badge.non_conforme {
      background: #fecaca;
      color: #b91c1c;
    }

    .compliance-badge.a_verifier {
      background: #fef3c7;
      color: #92400e;
    }

    .compliance-badge.derogation {
      background: #e9d5ff;
      color: #6d28d9;
    }

    /* Condition badges */
    .condition-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 8pt;
      font-weight: 600;
      text-align: center;
      min-width: 85px;
    }

    .condition-badge.neuf {
      background: #dbeafe;
      color: #1e40af;
    }

    .condition-badge.tres_bon {
      background: #dcfce7;
      color: #166534;
    }

    .condition-badge.bon {
      background: #ecfccb;
      color: #3f6212;
    }

    .condition-badge.usage_normal {
      background: #fef9c3;
      color: #854d0e;
    }

    .condition-badge.mauvais {
      background: #fed7aa;
      color: #c2410c;
    }

    .condition-badge.hors_service {
      background: #fecaca;
      color: #b91c1c;
    }

    .condition-badge.absent {
      background: #e5e7eb;
      color: #4b5563;
    }

    /* Tables */
    .inspection-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 8.5pt;
    }

    .inspection-table th,
    .inspection-table td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }

    .inspection-table th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
      font-size: 8pt;
      text-transform: uppercase;
    }

    .inspection-table tr:nth-child(even) {
      background: #fafafb;
    }

    .inspection-table .element-col {
      width: 35%;
    }

    .inspection-table .etat-col {
      width: 15%;
      text-align: center;
    }

    .inspection-table .conformite-col {
      width: 15%;
      text-align: center;
    }

    .inspection-table .observations-col {
      width: 35%;
    }

    /* ERP Section */
    .erp-card {
      background: #fef2f2;
      border: 2px solid #fecaca;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
    }

    .erp-card h4 {
      color: #b91c1c;
      font-size: 10pt;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .erp-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .erp-item {
      text-align: center;
      padding: 8px;
      background: white;
      border-radius: 4px;
    }

    .erp-item .value {
      font-size: 14pt;
      font-weight: 700;
      color: #b91c1c;
    }

    .erp-item .label {
      font-size: 7.5pt;
      color: #6b7280;
    }

    /* PMR Section */
    .pmr-card {
      background: #eff6ff;
      border: 2px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
    }

    .pmr-card h4 {
      color: #1e40af;
      font-size: 10pt;
      font-weight: 700;
      margin-bottom: 8px;
    }

    /* Checklist items */
    .checklist {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .checklist-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 8.5pt;
    }

    .check-icon {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10pt;
    }

    .check-icon.yes {
      background: #dcfce7;
      color: #166534;
    }

    .check-icon.no {
      background: #fecaca;
      color: #b91c1c;
    }

    .check-icon.na {
      background: #e5e7eb;
      color: #6b7280;
    }

    /* Compteurs commercial */
    .meter-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
    }

    .meter-row {
      display: flex;
      align-items: center;
      padding: 8px;
      background: white;
      border-radius: 6px;
      margin-bottom: 6px;
      border: 1px solid #e2e8f0;
    }

    .meter-row:last-child {
      margin-bottom: 0;
    }

    .meter-icon {
      font-size: 18pt;
      width: 40px;
      text-align: center;
    }

    .meter-info {
      flex: 1;
      margin-left: 10px;
    }

    .meter-info .type {
      font-weight: 600;
      color: #1e293b;
      font-size: 9pt;
    }

    .meter-info .number {
      font-size: 7.5pt;
      color: #64748b;
    }

    .meter-value {
      font-size: 14pt;
      font-weight: 700;
      color: #7c3aed;
    }

    .meter-unit {
      font-size: 8pt;
      color: #64748b;
      margin-left: 4px;
    }

    /* Equipment list */
    .equipment-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .equipment-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px;
    }

    .equipment-card .name {
      font-weight: 600;
      color: #1e293b;
      font-size: 9pt;
      margin-bottom: 4px;
    }

    .equipment-card .details {
      font-size: 7.5pt;
      color: #64748b;
    }

    /* Zone sections */
    .zone-section {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .zone-header {
      background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%);
      color: white;
      padding: 8px 12px;
      border-radius: 6px 6px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .zone-name {
      font-size: 10pt;
      font-weight: 600;
    }

    .zone-surface {
      font-size: 8pt;
      background: rgba(255,255,255,0.2);
      padding: 2px 8px;
      border-radius: 10px;
    }

    .zone-content {
      border: 1px solid #e2e8f0;
      border-top: none;
      border-radius: 0 0 6px 6px;
      padding: 10px;
      background: white;
    }

    /* Differences (sortie) */
    .diff-section {
      background: #fff7ed;
      border: 2px solid #fed7aa;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
    }

    .diff-section h4 {
      color: #c2410c;
      font-size: 10pt;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .diff-item {
      padding: 8px;
      background: white;
      border-radius: 4px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .diff-element {
      font-weight: 600;
      font-size: 9pt;
    }

    .diff-arrow {
      color: #f97316;
      font-weight: bold;
    }

    .diff-cost {
      color: #c2410c;
      font-weight: 700;
    }

    /* Keys table */
    .keys-table {
      width: 100%;
      border-collapse: collapse;
    }

    .keys-table th,
    .keys-table td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    .keys-table th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
      font-size: 8pt;
      text-transform: uppercase;
    }

    .key-qty {
      font-weight: 700;
      color: #7c3aed;
      font-size: 11pt;
    }

    /* Signatures */
    .signatures-section {
      margin-top: 20px;
      page-break-inside: avoid;
    }

    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .signature-box {
      border: 2px solid #e9d5ff;
      border-radius: 8px;
      padding: 15px;
      min-height: 180px;
    }

    .signature-box h4 {
      font-size: 9pt;
      font-weight: 600;
      color: #6d28d9;
      text-transform: uppercase;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e9d5ff;
    }

    .signature-info {
      font-size: 8.5pt;
      margin-bottom: 10px;
    }

    .signature-info .name {
      font-weight: 600;
      color: #1e293b;
    }

    .signature-info .company {
      color: #6b7280;
      font-style: italic;
    }

    .signature-area {
      height: 80px;
      border: 1px dashed #c4b5fd;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #faf5ff;
      margin-bottom: 8px;
    }

    .signature-area img {
      max-height: 70px;
      max-width: 90%;
    }

    .signature-area .placeholder {
      color: #a78bfa;
      font-size: 8.5pt;
    }

    .signature-date {
      font-size: 8pt;
      color: #6b7280;
    }

    /* Reserves box */
    .reserves-box {
      background: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 15px;
    }

    .reserves-box h4 {
      font-size: 9pt;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 6px;
    }

    .reserves-box p {
      font-size: 9pt;
      color: #78350f;
    }

    /* Legal footer */
    .legal-footer {
      margin-top: 20px;
      padding: 12px;
      background: #f5f3ff;
      border-radius: 6px;
      font-size: 7.5pt;
      color: #6d28d9;
      line-height: 1.5;
    }

    .legal-footer strong {
      color: #5b21b6;
    }

    /* Print */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        margin: 0;
        padding: 0;
      }

      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- Page 1: Informations générales -->
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>ÉTAT DES LIEUX</h1>
        <div class="edl-type">{{EDL_TYPE_LABEL}} - LOCAL {{TYPE_LOCAL_LABEL}}</div>
        <div class="bail-type-badge">{{BAIL_TYPE_LABEL}}</div>
      </div>
      <div class="header-right">
        <div class="reference-box">
          <div class="label">Référence</div>
          <div class="value">{{EDL_REFERENCE}}</div>
        </div>
      </div>
    </div>

    <!-- Date -->
    <div class="section">
      <div class="section-title">📅 Date et heure</div>
      <div class="section-content">
        <div class="info-box">
          <div class="grid-2">
            <div class="info-row">
              <span class="label">Date :</span>
              <span class="value">{{DATE_EDL}}</span>
            </div>
            <div class="info-row">
              <span class="label">Heure :</span>
              <span class="value">{{HEURE_DEBUT}}{{#if HEURE_FIN}} - {{HEURE_FIN}}{{/if}}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Parties -->
    <div class="section">
      <div class="section-title">👥 Les parties</div>
      <div class="section-content">
        <div class="grid-2">
          <!-- Bailleur -->
          <div class="info-box">
            <h3>Le Bailleur</h3>
            <div class="info-row">
              <span class="label">Représentant :</span>
              <span class="value">{{BAILLEUR_NOM}} {{BAILLEUR_PRENOM}}</span>
            </div>
            <div class="info-row">
              <span class="label">Qualité :</span>
              <span class="value">{{BAILLEUR_QUALITE}}</span>
            </div>
          </div>

          <!-- Preneur -->
          <div class="info-box">
            <h3>Le Preneur</h3>
            <div class="info-row">
              <span class="label">Représentant :</span>
              <span class="value">{{PRENEUR_NOM}} {{PRENEUR_PRENOM}}</span>
            </div>
            <div class="info-row">
              <span class="label">Qualité :</span>
              <span class="value">{{PRENEUR_QUALITE}}</span>
            </div>
            {{#if PRENEUR_RAISON_SOCIALE}}
            <div class="info-row">
              <span class="label">Société :</span>
              <span class="value">{{PRENEUR_RAISON_SOCIALE}}</span>
            </div>
            {{/if}}
          </div>
        </div>
      </div>
    </div>

    <!-- Local -->
    <div class="section">
      <div class="section-title">🏢 Le local</div>
      <div class="section-content">
        <div class="info-box">
          <div class="grid-2">
            <div>
              <div class="info-row">
                <span class="label">Adresse :</span>
                <span class="value">{{LOCAL_ADRESSE}}</span>
              </div>
              <div class="info-row">
                <span class="label">Ville :</span>
                <span class="value">{{LOCAL_CODE_POSTAL}} {{LOCAL_VILLE}}</span>
              </div>
              <div class="info-row">
                <span class="label">Type de local :</span>
                <span class="value">{{TYPE_LOCAL_LABEL}}</span>
              </div>
            </div>
            <div>
              <div class="info-row">
                <span class="label">Surface totale :</span>
                <span class="value"><strong>{{SURFACE_TOTALE}} m²</strong></span>
              </div>
              {{#if SURFACE_VENTE}}
              <div class="info-row">
                <span class="label">Surface vente :</span>
                <span class="value">{{SURFACE_VENTE}} m²</span>
              </div>
              {{/if}}
              {{#if SURFACE_RESERVE}}
              <div class="info-row">
                <span class="label">Surface réserve :</span>
                <span class="value">{{SURFACE_RESERVE}} m²</span>
              </div>
              {{/if}}
              {{#if SURFACE_BUREAUX}}
              <div class="info-row">
                <span class="label">Surface bureaux :</span>
                <span class="value">{{SURFACE_BUREAUX}} m²</span>
              </div>
              {{/if}}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bail associé -->
    <div class="section">
      <div class="section-title">📄 Bail associé</div>
      <div class="section-content">
        <div class="info-box">
          <div class="grid-2">
            <div>
              <div class="info-row">
                <span class="label">Référence bail :</span>
                <span class="value">{{BAIL_REFERENCE}}</span>
              </div>
              <div class="info-row">
                <span class="label">Type de bail :</span>
                <span class="value">{{BAIL_TYPE_LABEL}}</span>
              </div>
            </div>
            <div>
              <div class="info-row">
                <span class="label">Date d'effet :</span>
                <span class="value">{{BAIL_DATE_EFFET}}</span>
              </div>
              <div class="info-row">
                <span class="label">Loyer HT/mois :</span>
                <span class="value">{{BAIL_LOYER_HT}} €</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Classification ERP -->
    {{#if HAS_ERP}}
    <div class="section">
      <div class="section-title">🔥 Classification ERP et Sécurité Incendie</div>
      <div class="section-content">
        <div class="erp-card">
          <h4>⚠️ Établissement Recevant du Public</h4>
          <div class="erp-grid">
            <div class="erp-item">
              <div class="value">{{ERP_CATEGORIE}}</div>
              <div class="label">Catégorie</div>
            </div>
            <div class="erp-item">
              <div class="value">{{ERP_TYPE}}</div>
              <div class="label">Type</div>
            </div>
            <div class="erp-item">
              <div class="value">{{ERP_CAPACITE}}</div>
              <div class="label">Capacité max.</div>
            </div>
          </div>
        </div>

        <div class="checklist" style="margin-top: 10px;">
          <div class="checklist-item">
            <span class="check-icon {{#if EXTINCTEURS_OK}}yes{{else}}no{{/if}}">{{#if EXTINCTEURS_OK}}✓{{else}}✗{{/if}}</span>
            <span>Extincteurs vérifiés ({{NB_EXTINCTEURS}})</span>
          </div>
          <div class="checklist-item">
            <span class="check-icon {{#if ALARME_INCENDIE}}yes{{else}}no{{/if}}">{{#if ALARME_INCENDIE}}✓{{else}}✗{{/if}}</span>
            <span>Alarme incendie ({{ALARME_TYPE}})</span>
          </div>
          <div class="checklist-item">
            <span class="check-icon {{#if ISSUES_SECOURS_OK}}yes{{else}}no{{/if}}">{{#if ISSUES_SECOURS_OK}}✓{{else}}✗{{/if}}</span>
            <span>Issues de secours ({{NB_ISSUES_SECOURS}})</span>
          </div>
          <div class="checklist-item">
            <span class="check-icon {{#if ECLAIRAGE_SECURITE}}yes{{else}}no{{/if}}">{{#if ECLAIRAGE_SECURITE}}✓{{else}}✗{{/if}}</span>
            <span>Éclairage de sécurité</span>
          </div>
          <div class="checklist-item">
            <span class="check-icon {{#if REGISTRE_SECURITE}}yes{{else}}no{{/if}}">{{#if REGISTRE_SECURITE}}✓{{else}}✗{{/if}}</span>
            <span>Registre de sécurité</span>
          </div>
          <div class="checklist-item">
            <span class="check-icon {{#if DESENFUMAGE}}yes{{else}}no{{/if}}">{{#if DESENFUMAGE}}✓{{else}}✗{{/if}}</span>
            <span>Désenfumage</span>
          </div>
        </div>

        {{#if AVIS_COMMISSION}}
        <div style="margin-top: 10px; padding: 8px; background: {{AVIS_COMMISSION_COLOR}}; border-radius: 4px;">
          <strong>Dernier avis commission sécurité :</strong> {{AVIS_COMMISSION}} ({{DATE_DERNIER_CONTROLE}})
        </div>
        {{/if}}
      </div>
    </div>
    {{/if}}

    <!-- Accessibilité PMR -->
    <div class="section">
      <div class="section-title">♿ Accessibilité PMR</div>
      <div class="section-content">
        <div class="pmr-card">
          <h4>Conformité accessibilité</h4>
          <div class="grid-2">
            <div>
              <div class="checklist">
                <div class="checklist-item">
                  <span class="check-icon {{#if ACCES_PLAIN_PIED}}yes{{else}}no{{/if}}">{{#if ACCES_PLAIN_PIED}}✓{{else}}✗{{/if}}</span>
                  <span>Accès de plain-pied</span>
                </div>
                <div class="checklist-item">
                  <span class="check-icon {{#if RAMPE_ACCES}}yes{{else}}na{{/if}}">{{#if RAMPE_ACCES}}✓{{else}}-{{/if}}</span>
                  <span>Rampe d'accès</span>
                </div>
                <div class="checklist-item">
                  <span class="check-icon {{#if SANITAIRE_PMR}}yes{{else}}no{{/if}}">{{#if SANITAIRE_PMR}}✓{{else}}✗{{/if}}</span>
                  <span>Sanitaire PMR</span>
                </div>
                <div class="checklist-item">
                  <span class="check-icon {{#if PLACE_PMR}}yes{{else}}na{{/if}}">{{#if PLACE_PMR}}✓{{else}}-{{/if}}</span>
                  <span>Place stationnement PMR</span>
                </div>
              </div>
            </div>
            <div>
              <div class="info-row">
                <span class="label">Largeur entrée :</span>
                <span class="value">{{LARGEUR_PORTE_ENTREE}} cm</span>
              </div>
              <div class="info-row">
                <span class="label">Conformité :</span>
                <span class="compliance-badge {{PMR_CONFORMITE}}">{{PMR_CONFORMITE_LABEL}}</span>
              </div>
              {{#if AD_AP_REFERENCE}}
              <div class="info-row">
                <span class="label">Ad'AP :</span>
                <span class="value">{{AD_AP_REFERENCE}}</span>
              </div>
              {{/if}}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Page 2: Façade, Vitrine, Enseigne (si commercial) -->
  {{#if IS_COMMERCIAL}}
  <div class="page">
    <div class="header" style="margin-bottom: 12px;">
      <div class="header-left">
        <h1 style="font-size: 14pt;">ÉTAT DES LIEUX - Façade et Devanture</h1>
        <div class="edl-type" style="font-size: 10pt;">{{EDL_REFERENCE}}</div>
      </div>
    </div>

    <!-- Façade et Vitrine -->
    <div class="zone-section">
      <div class="zone-header">
        <span class="zone-name">🏪 Façade et Vitrine</span>
      </div>
      <div class="zone-content">
        <table class="inspection-table">
          <thead>
            <tr>
              <th class="element-col">Élément</th>
              <th class="etat-col">État</th>
              <th class="observations-col">Observations</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vitrine principale</td>
              <td class="etat-col"><span class="condition-badge {{VITRINE_ETAT}}">{{VITRINE_ETAT_LABEL}}</span></td>
              <td>{{VITRINE_OBSERVATIONS}}</td>
            </tr>
            <tr>
              <td>Type de vitrage : {{VITRINE_TYPE}}</td>
              <td class="etat-col">{{VITRINE_SURFACE}} m²</td>
              <td>Film/Adhésif : {{#if VITRINE_FILM}}Oui{{else}}Non{{/if}}</td>
            </tr>
            <tr>
              <td>Façade</td>
              <td class="etat-col"><span class="condition-badge {{FACADE_ETAT}}">{{FACADE_ETAT_LABEL}}</span></td>
              <td>{{FACADE_OBSERVATIONS}}</td>
            </tr>
            <tr>
              <td>Store / Banne</td>
              <td class="etat-col">
                {{#if STORE_PRESENT}}
                <span class="condition-badge {{STORE_ETAT}}">{{STORE_ETAT_LABEL}}</span>
                {{else}}
                <span class="condition-badge absent">Non présent</span>
                {{/if}}
              </td>
              <td>{{#if STORE_PRESENT}}Type : {{STORE_TYPE}} {{#if STORE_MOTORISE}}(motorisé){{/if}}{{/if}}</td>
            </tr>
            <tr>
              <td>Porte d'entrée</td>
              <td class="etat-col"><span class="condition-badge {{PORTE_ENTREE_ETAT}}">{{PORTE_ENTREE_ETAT_LABEL}}</span></td>
              <td>Type : {{PORTE_ENTREE_TYPE}} - {{PORTE_NB_CLES}} clé(s)</td>
            </tr>
            {{#if HAS_RIDEAU_METALLIQUE}}
            <tr>
              <td>Rideau métallique</td>
              <td class="etat-col"><span class="condition-badge {{RIDEAU_ETAT}}">{{RIDEAU_ETAT_LABEL}}</span></td>
              <td>{{RIDEAU_OBSERVATIONS}}</td>
            </tr>
            {{/if}}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Enseigne -->
    <div class="zone-section">
      <div class="zone-header">
        <span class="zone-name">📍 Enseigne et Signalétique</span>
      </div>
      <div class="zone-content">
        <table class="inspection-table">
          <thead>
            <tr>
              <th class="element-col">Élément</th>
              <th class="etat-col">État</th>
              <th class="conformite-col">Conformité</th>
              <th class="observations-col">Observations</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Enseigne principale</td>
              <td class="etat-col">
                {{#if ENSEIGNE_PRESENTE}}
                <span class="condition-badge {{ENSEIGNE_ETAT}}">{{ENSEIGNE_ETAT_LABEL}}</span>
                {{else}}
                <span class="condition-badge absent">Non présente</span>
                {{/if}}
              </td>
              <td class="conformite-col">
                {{#if ENSEIGNE_AUTORISATION}}
                <span class="compliance-badge conforme">Autorisée</span>
                {{else}}
                <span class="compliance-badge a_verifier">À vérifier</span>
                {{/if}}
              </td>
              <td>{{#if ENSEIGNE_PRESENTE}}Type : {{ENSEIGNE_TYPE}} {{#if ENSEIGNE_ECLAIREE}}(éclairée){{/if}}{{/if}}</td>
            </tr>
            <tr>
              <td>Signalétique intérieure</td>
              <td class="etat-col" colspan="2">
                {{#if SIGNALETIQUE_INTERIEURE}}
                <span class="check-icon yes">✓</span> Présente
                {{else}}
                <span class="check-icon no">✗</span> Absente
                {{/if}}
              </td>
              <td></td>
            </tr>
            <tr>
              <td>Signalétique sorties de secours</td>
              <td class="etat-col" colspan="2">
                {{#if SIGNALETIQUE_SECOURS}}
                <span class="check-icon yes">✓</span> Conforme
                {{else}}
                <span class="check-icon no">✗</span> Non conforme
                {{/if}}
              </td>
              <td></td>
            </tr>
            <tr>
              <td>Signalétique accessibilité</td>
              <td class="etat-col" colspan="2">
                {{#if SIGNALETIQUE_PMR}}
                <span class="check-icon yes">✓</span> Présente
                {{else}}
                <span class="check-icon no">✗</span> Absente
                {{/if}}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    {{#if HAS_PHOTOS_FACADE}}
    <div class="section">
      <div class="section-title">📷 Photos façade et vitrine</div>
      <div class="section-content">
        <div class="grid-3">
          {{PHOTOS_FACADE_HTML}}
        </div>
      </div>
    </div>
    {{/if}}
  </div>
  {{/if}}

  <!-- Page 3: Installations Techniques -->
  <div class="page">
    <div class="header" style="margin-bottom: 12px;">
      <div class="header-left">
        <h1 style="font-size: 14pt;">ÉTAT DES LIEUX - Installations Techniques</h1>
        <div class="edl-type" style="font-size: 10pt;">{{EDL_REFERENCE}}</div>
      </div>
    </div>

    <!-- Climatisation / Chauffage -->
    <div class="zone-section">
      <div class="zone-header">
        <span class="zone-name">❄️ Climatisation et Chauffage</span>
      </div>
      <div class="zone-content">
        <div class="grid-2">
          <div>
            <h4 style="font-size: 9pt; color: #5b21b6; margin-bottom: 8px;">Climatisation</h4>
            {{#if CLIM_PRESENTE}}
            <div class="info-row">
              <span class="label">Type :</span>
              <span class="value">{{CLIM_TYPE}}</span>
            </div>
            <div class="info-row">
              <span class="label">Marque :</span>
              <span class="value">{{CLIM_MARQUE}}</span>
            </div>
            <div class="info-row">
              <span class="label">Puissance :</span>
              <span class="value">{{CLIM_PUISSANCE}} kW</span>
            </div>
            <div class="info-row">
              <span class="label">Dernier entretien :</span>
              <span class="value">{{CLIM_DATE_ENTRETIEN}}</span>
            </div>
            <div class="info-row">
              <span class="label">État :</span>
              <span class="condition-badge {{CLIM_ETAT}}">{{CLIM_ETAT_LABEL}}</span>
            </div>
            {{else}}
            <p style="color: #6b7280; font-style: italic;">Non équipé</p>
            {{/if}}
          </div>
          <div>
            <h4 style="font-size: 9pt; color: #5b21b6; margin-bottom: 8px;">Chauffage</h4>
            <div class="info-row">
              <span class="label">Type :</span>
              <span class="value">{{CHAUFFAGE_TYPE}}</span>
            </div>
            <div class="info-row">
              <span class="label">Équipements :</span>
              <span class="value">{{CHAUFFAGE_EQUIPEMENTS}}</span>
            </div>
            <div class="info-row">
              <span class="label">Dernier entretien :</span>
              <span class="value">{{CHAUFFAGE_DATE_ENTRETIEN}}</span>
            </div>
            <div class="info-row">
              <span class="label">État :</span>
              <span class="condition-badge {{CHAUFFAGE_ETAT}}">{{CHAUFFAGE_ETAT_LABEL}}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Électricité -->
    <div class="zone-section">
      <div class="zone-header">
        <span class="zone-name">⚡ Électricité</span>
      </div>
      <div class="zone-content">
        <div class="grid-2">
          <div>
            <div class="info-row">
              <span class="label">Puissance :</span>
              <span class="value">{{ELEC_PUISSANCE}} kVA</span>
            </div>
            <div class="info-row">
              <span class="label">Tableau conforme :</span>
              <span class="value">
                {{#if ELEC_TABLEAU_CONFORME}}
                <span class="check-icon yes">✓</span> Oui
                {{else}}
                <span class="check-icon no">✗</span> Non
                {{/if}}
              </span>
            </div>
            <div class="info-row">
              <span class="label">Différentiel :</span>
              <span class="value">
                {{#if ELEC_DIFFERENTIEL}}
                <span class="check-icon yes">✓</span> Présent
                {{else}}
                <span class="check-icon no">✗</span> Absent
                {{/if}}
              </span>
            </div>
          </div>
          <div>
            <div class="info-row">
              <span class="label">Nb prises :</span>
              <span class="value">{{ELEC_NB_PRISES}}</span>
            </div>
            <div class="info-row">
              <span class="label">Nb circuits :</span>
              <span class="value">{{ELEC_NB_CIRCUITS}}</span>
            </div>
            <div class="info-row">
              <span class="label">Diag. électrique :</span>
              <span class="value">{{ELEC_DATE_DIAGNOSTIC}}</span>
            </div>
          </div>
        </div>
        {{#if ELEC_OBSERVATIONS}}
        <div style="margin-top: 8px; padding: 6px; background: #fef3c7; border-radius: 4px; font-size: 8.5pt;">
          <strong>Observations :</strong> {{ELEC_OBSERVATIONS}}
        </div>
        {{/if}}
      </div>
    </div>

    <!-- Plomberie -->
    <div class="zone-section">
      <div class="zone-header">
        <span class="zone-name">🚿 Plomberie</span>
      </div>
      <div class="zone-content">
        <div class="checklist">
          <div class="checklist-item">
            <span class="check-icon {{#if PLOMB_ARRIVEE_EAU}}yes{{else}}no{{/if}}">{{#if PLOMB_ARRIVEE_EAU}}✓{{else}}✗{{/if}}</span>
            <span>Arrivée d'eau</span>
          </div>
          <div class="checklist-item">
            <span class="check-icon {{#if PLOMB_EVACUATION}}yes{{else}}no{{/if}}">{{#if PLOMB_EVACUATION}}✓{{else}}✗{{/if}}</span>
            <span>Évacuation</span>
          </div>
        </div>
        {{#if PLOMB_CHAUFFE_EAU}}
        <div class="info-row" style="margin-top: 8px;">
          <span class="label">Chauffe-eau :</span>
          <span class="value">{{PLOMB_CHAUFFE_EAU_TYPE}} - {{PLOMB_CHAUFFE_EAU_CAPACITE}} L</span>
        </div>
        {{/if}}
        <div class="info-row">
          <span class="label">État général :</span>
          <span class="condition-badge {{PLOMB_ETAT}}">{{PLOMB_ETAT_LABEL}}</span>
        </div>
      </div>
    </div>

    <!-- Télécom / IT -->
    <div class="zone-section">
      <div class="zone-header">
        <span class="zone-name">📡 Télécom et Réseau</span>
      </div>
      <div class="zone-content">
        <div class="grid-2">
          <div>
            <div class="info-row">
              <span class="label">Lignes tél. :</span>
              <span class="value">{{TELECOM_NB_LIGNES}}</span>
            </div>
            <div class="info-row">
              <span class="label">Fibre optique :</span>
              <span class="value">
                {{#if TELECOM_FIBRE}}
                <span class="check-icon yes">✓</span> Disponible
                {{else}}
                <span class="check-icon no">✗</span> Non disponible
                {{/if}}
              </span>
            </div>
          </div>
          <div>
            <div class="info-row">
              <span class="label">Prises RJ45 :</span>
              <span class="value">{{TELECOM_NB_RJ45}}</span>
            </div>
            <div class="info-row">
              <span class="label">Baie brassage :</span>
              <span class="value">
                {{#if TELECOM_BAIE}}
                <span class="check-icon yes">✓</span> Présente
                {{else}}
                <span class="check-icon no">✗</span> Absente
                {{/if}}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ventilation -->
    <div class="zone-section">
      <div class="zone-header">
        <span class="zone-name">💨 Ventilation</span>
      </div>
      <div class="zone-content">
        <div class="info-row">
          <span class="label">Type :</span>
          <span class="value">{{VENTILATION_TYPE}}</span>
        </div>
        <div class="info-row">
          <span class="label">État :</span>
          <span class="condition-badge {{VENTILATION_ETAT}}">{{VENTILATION_ETAT_LABEL}}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Page 4: Zones / Pièces -->
  <div class="page">
    <div class="header" style="margin-bottom: 12px;">
      <div class="header-left">
        <h1 style="font-size: 14pt;">ÉTAT DES LIEUX - Détail par zones</h1>
        <div class="edl-type" style="font-size: 10pt;">{{EDL_REFERENCE}}</div>
      </div>
    </div>

    {{ZONES_HTML}}
  </div>

  <!-- Page 5: Compteurs et Équipements -->
  <div class="page">
    <div class="header" style="margin-bottom: 12px;">
      <div class="header-left">
        <h1 style="font-size: 14pt;">ÉTAT DES LIEUX - Compteurs et Équipements</h1>
        <div class="edl-type" style="font-size: 10pt;">{{EDL_REFERENCE}}</div>
      </div>
    </div>

    <!-- Compteurs -->
    <div class="section">
      <div class="section-title">📊 Relevés des compteurs</div>
      <div class="section-content">
        <div class="meter-section">
          <!-- Électricité -->
          <div class="meter-row">
            <div class="meter-icon">⚡</div>
            <div class="meter-info">
              <div class="type">Électricité</div>
              <div class="number">N° {{COMPTEUR_ELEC_NUMERO}} | {{COMPTEUR_ELEC_TYPE}} | {{COMPTEUR_ELEC_PUISSANCE}} kVA</div>
            </div>
            <div>
              <span class="meter-value">{{COMPTEUR_ELEC_INDEX}}</span>
              <span class="meter-unit">kWh</span>
            </div>
          </div>

          <!-- Gaz (si présent) -->
          {{#if COMPTEUR_GAZ_PRESENT}}
          <div class="meter-row">
            <div class="meter-icon">🔥</div>
            <div class="meter-info">
              <div class="type">Gaz</div>
              <div class="number">N° {{COMPTEUR_GAZ_NUMERO}}</div>
            </div>
            <div>
              <span class="meter-value">{{COMPTEUR_GAZ_INDEX}}</span>
              <span class="meter-unit">m³</span>
            </div>
          </div>
          {{/if}}

          <!-- Eau -->
          <div class="meter-row">
            <div class="meter-icon">💧</div>
            <div class="meter-info">
              <div class="type">Eau</div>
              <div class="number">N° {{COMPTEUR_EAU_NUMERO}} {{#if COMPTEUR_EAU_DIVISIONNAIRE}}(divisionnaire){{/if}}</div>
            </div>
            <div>
              <span class="meter-value">{{COMPTEUR_EAU_INDEX}}</span>
              <span class="meter-unit">m³</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Équipements fournis par le bailleur -->
    {{#if HAS_EQUIPEMENTS}}
    <div class="section">
      <div class="section-title">🔧 Équipements fournis par le bailleur</div>
      <div class="section-content">
        <table class="inspection-table">
          <thead>
            <tr>
              <th>Désignation</th>
              <th>Marque / Modèle</th>
              <th style="text-align: center;">État</th>
              <th>Observations</th>
            </tr>
          </thead>
          <tbody>
            {{EQUIPEMENTS_HTML}}
          </tbody>
        </table>
      </div>
    </div>
    {{/if}}

    <!-- Clés remises -->
    <div class="section">
      <div class="section-title">🔑 Clés et badges remis</div>
      <div class="section-content">
        <table class="keys-table">
          <thead>
            <tr>
              <th>Type</th>
              <th style="text-align: center;">Quantité</th>
              <th>Observations</th>
            </tr>
          </thead>
          <tbody>
            {{CLES_HTML}}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Documents annexés -->
    {{#if HAS_DOCUMENTS}}
    <div class="section">
      <div class="section-title">📎 Documents annexés</div>
      <div class="section-content">
        <ul style="font-size: 9pt; padding-left: 20px;">
          {{DOCUMENTS_HTML}}
        </ul>
      </div>
    </div>
    {{/if}}
  </div>

  <!-- Page 6: Différences (EDL Sortie uniquement) -->
  {{#if IS_EDL_SORTIE}}
  <div class="page">
    <div class="header" style="margin-bottom: 12px;">
      <div class="header-left">
        <h1 style="font-size: 14pt;">ÉTAT DES LIEUX - Comparatif Entrée/Sortie</h1>
        <div class="edl-type" style="font-size: 10pt;">{{EDL_REFERENCE}}</div>
      </div>
    </div>

    {{#if HAS_DIFFERENCES}}
    <div class="diff-section">
      <h4>⚠️ Différences constatées</h4>
      {{DIFFERENCES_HTML}}
    </div>

    <div class="info-box" style="margin-top: 15px;">
      <h3>Récapitulatif financier</h3>
      <div class="grid-2">
        <div class="info-row">
          <span class="label">Total estimé :</span>
          <span class="value" style="font-size: 14pt; font-weight: 700; color: #c2410c;">{{TOTAL_ESTIMATIONS}} €</span>
        </div>
        <div class="info-row">
          <span class="label">Imputables au preneur :</span>
          <span class="value">{{NB_IMPUTABLES}} élément(s)</span>
        </div>
      </div>
    </div>
    {{else}}
    <div class="info-box" style="text-align: center; padding: 30px;">
      <div style="font-size: 24pt; margin-bottom: 10px;">✅</div>
      <p style="font-size: 11pt; font-weight: 600; color: #166534;">Aucune différence significative constatée</p>
      <p style="font-size: 9pt; color: #6b7280; margin-top: 5px;">Le local est restitué dans un état conforme à l'état des lieux d'entrée, compte tenu de l'usure normale.</p>
    </div>
    {{/if}}
  </div>
  {{/if}}

  <!-- Page finale: Observations et Signatures -->
  <div class="page">
    <div class="header" style="margin-bottom: 12px;">
      <div class="header-left">
        <h1 style="font-size: 14pt;">ÉTAT DES LIEUX - Conclusion et Signatures</h1>
        <div class="edl-type" style="font-size: 10pt;">{{EDL_REFERENCE}}</div>
      </div>
    </div>

    <!-- État général -->
    <div class="section">
      <div class="section-title">📋 État général du local</div>
      <div class="section-content">
        <div class="grid-2">
          <div class="info-box">
            <div class="info-row">
              <span class="label">État général :</span>
              <span class="condition-badge {{ETAT_GENERAL}}">{{ETAT_GENERAL_LABEL}}</span>
            </div>
          </div>
          <div class="info-box">
            <div class="info-row">
              <span class="label">Conformité :</span>
              <span class="compliance-badge {{CONFORMITE_GLOBALE}}">{{CONFORMITE_GLOBALE_LABEL}}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Observations générales -->
    {{#if OBSERVATIONS_GENERALES}}
    <div class="section">
      <div class="section-title">📝 Observations générales</div>
      <div class="section-content">
        <div class="info-box">
          <p style="font-size: 9pt; line-height: 1.5;">{{OBSERVATIONS_GENERALES}}</p>
        </div>
      </div>
    </div>
    {{/if}}

    <!-- Réserves -->
    {{#if HAS_RESERVES}}
    <div class="section">
      <div class="section-title">⚠️ Réserves émises</div>
      <div class="section-content">
        {{#if RESERVES_PRENEUR}}
        <div class="reserves-box">
          <h4>Réserves du preneur :</h4>
          <p>{{RESERVES_PRENEUR}}</p>
        </div>
        {{/if}}
        {{#if RESERVES_BAILLEUR}}
        <div class="reserves-box">
          <h4>Réserves du bailleur :</h4>
          <p>{{RESERVES_BAILLEUR}}</p>
        </div>
        {{/if}}
      </div>
    </div>
    {{/if}}

    <!-- Mentions légales -->
    <div class="legal-footer">
      <p><strong>Mentions obligatoires :</strong></p>
      <p>Le présent état des lieux, établi contradictoirement entre les parties, fait partie intégrante du contrat de bail {{BAIL_TYPE_LABEL}} dont il ne peut être dissocié.</p>
      {{#if IS_BAIL_COMMERCIAL}}
      <p>Conformément aux articles L145-1 et suivants du Code de commerce, cet état des lieux a été établi lors de la {{#if IS_EDL_SORTIE}}restitution{{else}}prise de possession{{/if}} des locaux.</p>
      {{/if}}
      {{#if IS_BAIL_PROFESSIONNEL}}
      <p>Conformément à l'article 57 A de la loi n°86-1290 du 23 décembre 1986, cet état des lieux a été établi lors de la {{#if IS_EDL_SORTIE}}restitution{{else}}prise de possession{{/if}} des locaux professionnels.</p>
      {{/if}}
      <p>Les parties reconnaissent avoir établi le présent état des lieux de manière contradictoire et en avoir reçu chacune un exemplaire.</p>
    </div>

    <!-- Signatures -->
    <div class="signatures-section">
      <div class="section-title">✍️ Signatures des parties</div>
      <div class="signatures-grid">
        <!-- Signature Bailleur -->
        <div class="signature-box">
          <h4>Le Bailleur</h4>
          <div class="signature-info">
            <div class="name">{{BAILLEUR_NOM}} {{BAILLEUR_PRENOM}}</div>
            <div class="company">{{BAILLEUR_QUALITE}}</div>
          </div>
          <div class="signature-area">
            {{#if SIGNATURE_BAILLEUR}}
            <img src="{{SIGNATURE_BAILLEUR}}" alt="Signature bailleur" />
            {{else}}
            <span class="placeholder">Signature en attente</span>
            {{/if}}
          </div>
          <div class="signature-date">
            {{#if DATE_SIGNATURE_BAILLEUR}}
            Signé le : {{DATE_SIGNATURE_BAILLEUR}}
            {{else}}
            Date : ____________________
            {{/if}}
          </div>
          <p style="font-size: 7.5pt; color: #6b7280; margin-top: 6px;">Lu et approuvé, bon pour accord</p>
        </div>

        <!-- Signature Preneur -->
        <div class="signature-box">
          <h4>Le Preneur</h4>
          <div class="signature-info">
            <div class="name">{{PRENEUR_NOM}} {{PRENEUR_PRENOM}}</div>
            {{#if PRENEUR_RAISON_SOCIALE}}
            <div class="company">{{PRENEUR_RAISON_SOCIALE}}</div>
            {{/if}}
            <div class="company">{{PRENEUR_QUALITE}}</div>
          </div>
          <div class="signature-area">
            {{#if SIGNATURE_PRENEUR}}
            <img src="{{SIGNATURE_PRENEUR}}" alt="Signature preneur" />
            {{else}}
            <span class="placeholder">Signature en attente</span>
            {{/if}}
          </div>
          <div class="signature-date">
            {{#if DATE_SIGNATURE_PRENEUR}}
            Signé le : {{DATE_SIGNATURE_PRENEUR}}
            {{else}}
            Date : ____________________
            {{/if}}
          </div>
          <p style="font-size: 7.5pt; color: #6b7280; margin-top: 6px;">Lu et approuvé, bon pour accord</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top: 25px; text-align: center; font-size: 7.5pt; color: #a78bfa;">
      Document généré le {{DATE_GENERATION}} | Référence : {{EDL_REFERENCE}}
    </div>
  </div>
</body>
</html>
`;

/**
 * Variables disponibles pour le template EDL Commercial
 */
export const EDL_COMMERCIAL_VARIABLES = {
  // Références
  EDL_REFERENCE: 'Référence unique de l\'EDL',
  EDL_TYPE_LABEL: 'Entrée ou Sortie',
  EDL_TYPE_COLOR: 'Couleur selon le type',

  // Type de local et bail
  TYPE_LOCAL_LABEL: 'Label du type de local',
  BAIL_TYPE_LABEL: 'Label du type de bail',
  IS_COMMERCIAL: 'Boolean - bail commercial',
  IS_BAIL_COMMERCIAL: 'Boolean - bail commercial 3/6/9 ou dérogatoire',
  IS_BAIL_PROFESSIONNEL: 'Boolean - bail professionnel',
  IS_EDL_SORTIE: 'Boolean - EDL de sortie',

  // Dates
  DATE_EDL: 'Date de l\'état des lieux',
  HEURE_DEBUT: 'Heure de début',
  HEURE_FIN: 'Heure de fin',
  DATE_GENERATION: 'Date de génération du document',

  // Bailleur
  BAILLEUR_NOM: 'Nom du représentant bailleur',
  BAILLEUR_PRENOM: 'Prénom du représentant bailleur',
  BAILLEUR_QUALITE: 'Qualité (propriétaire, mandataire...)',

  // Preneur
  PRENEUR_NOM: 'Nom du représentant preneur',
  PRENEUR_PRENOM: 'Prénom du représentant preneur',
  PRENEUR_QUALITE: 'Qualité (gérant, directeur...)',
  PRENEUR_RAISON_SOCIALE: 'Raison sociale de la société',

  // Local
  LOCAL_ADRESSE: 'Adresse du local',
  LOCAL_CODE_POSTAL: 'Code postal',
  LOCAL_VILLE: 'Ville',
  SURFACE_TOTALE: 'Surface totale en m²',
  SURFACE_VENTE: 'Surface de vente en m²',
  SURFACE_RESERVE: 'Surface réserve en m²',
  SURFACE_BUREAUX: 'Surface bureaux en m²',

  // Bail
  BAIL_REFERENCE: 'Référence du bail',
  BAIL_DATE_EFFET: 'Date d\'effet du bail',
  BAIL_LOYER_HT: 'Loyer mensuel HT',

  // ERP
  HAS_ERP: 'Boolean - local ERP',
  ERP_CATEGORIE: 'Catégorie ERP (1-5)',
  ERP_TYPE: 'Type ERP (M, N, W...)',
  ERP_CAPACITE: 'Capacité maximale',

  // Sécurité incendie
  NB_EXTINCTEURS: 'Nombre d\'extincteurs',
  EXTINCTEURS_OK: 'Boolean - extincteurs vérifiés',
  ALARME_INCENDIE: 'Boolean - alarme présente',
  ALARME_TYPE: 'Type d\'alarme',
  NB_ISSUES_SECOURS: 'Nombre d\'issues de secours',
  ISSUES_SECOURS_OK: 'Boolean - issues conformes',
  ECLAIRAGE_SECURITE: 'Boolean - éclairage de sécurité',
  REGISTRE_SECURITE: 'Boolean - registre présent',
  DESENFUMAGE: 'Boolean - désenfumage',
  AVIS_COMMISSION: 'Avis de la commission (favorable/défavorable)',
  DATE_DERNIER_CONTROLE: 'Date du dernier contrôle',

  // PMR
  ACCES_PLAIN_PIED: 'Boolean - accès plain-pied',
  RAMPE_ACCES: 'Boolean - rampe présente',
  SANITAIRE_PMR: 'Boolean - sanitaire PMR',
  PLACE_PMR: 'Boolean - place stationnement PMR',
  LARGEUR_PORTE_ENTREE: 'Largeur porte entrée en cm',
  PMR_CONFORMITE: 'Niveau de conformité',
  PMR_CONFORMITE_LABEL: 'Label conformité',
  AD_AP_REFERENCE: 'Référence Ad\'AP',

  // Façade / Vitrine (commercial)
  VITRINE_ETAT: 'État de la vitrine',
  VITRINE_TYPE: 'Type de vitrage',
  VITRINE_SURFACE: 'Surface vitrine m²',
  VITRINE_FILM: 'Boolean - film adhésif',
  FACADE_ETAT: 'État de la façade',
  STORE_PRESENT: 'Boolean - store présent',
  STORE_TYPE: 'Type de store',
  STORE_MOTORISE: 'Boolean - motorisé',
  STORE_ETAT: 'État du store',
  PORTE_ENTREE_ETAT: 'État porte entrée',
  PORTE_ENTREE_TYPE: 'Type de porte',
  PORTE_NB_CLES: 'Nombre de clés',
  HAS_RIDEAU_METALLIQUE: 'Boolean - rideau métallique',
  RIDEAU_ETAT: 'État du rideau',

  // Enseigne
  ENSEIGNE_PRESENTE: 'Boolean - enseigne présente',
  ENSEIGNE_TYPE: 'Type d\'enseigne',
  ENSEIGNE_ECLAIREE: 'Boolean - éclairée',
  ENSEIGNE_ETAT: 'État de l\'enseigne',
  ENSEIGNE_AUTORISATION: 'Boolean - autorisation mairie',
  SIGNALETIQUE_INTERIEURE: 'Boolean',
  SIGNALETIQUE_SECOURS: 'Boolean',
  SIGNALETIQUE_PMR: 'Boolean',

  // Installations techniques
  CLIM_PRESENTE: 'Boolean - climatisation',
  CLIM_TYPE: 'Type de climatisation',
  CLIM_MARQUE: 'Marque',
  CLIM_PUISSANCE: 'Puissance kW',
  CLIM_DATE_ENTRETIEN: 'Date dernier entretien',
  CLIM_ETAT: 'État',
  CHAUFFAGE_TYPE: 'Type de chauffage',
  CHAUFFAGE_EQUIPEMENTS: 'Liste équipements',
  CHAUFFAGE_DATE_ENTRETIEN: 'Date dernier entretien',
  CHAUFFAGE_ETAT: 'État',
  ELEC_PUISSANCE: 'Puissance kVA',
  ELEC_TABLEAU_CONFORME: 'Boolean',
  ELEC_DIFFERENTIEL: 'Boolean',
  ELEC_NB_PRISES: 'Nombre de prises',
  ELEC_NB_CIRCUITS: 'Nombre de circuits',
  ELEC_DATE_DIAGNOSTIC: 'Date diagnostic',
  ELEC_OBSERVATIONS: 'Observations',
  PLOMB_ARRIVEE_EAU: 'Boolean',
  PLOMB_EVACUATION: 'Boolean',
  PLOMB_CHAUFFE_EAU: 'Boolean',
  PLOMB_CHAUFFE_EAU_TYPE: 'Type chauffe-eau',
  PLOMB_CHAUFFE_EAU_CAPACITE: 'Capacité L',
  PLOMB_ETAT: 'État',
  TELECOM_NB_LIGNES: 'Nombre lignes tél',
  TELECOM_FIBRE: 'Boolean',
  TELECOM_NB_RJ45: 'Nombre prises RJ45',
  TELECOM_BAIE: 'Boolean - baie brassage',
  VENTILATION_TYPE: 'Type ventilation',
  VENTILATION_ETAT: 'État',

  // Compteurs
  COMPTEUR_ELEC_NUMERO: 'N° compteur électrique',
  COMPTEUR_ELEC_TYPE: 'Type (Linky, etc.)',
  COMPTEUR_ELEC_PUISSANCE: 'Puissance',
  COMPTEUR_ELEC_INDEX: 'Index kWh',
  COMPTEUR_GAZ_PRESENT: 'Boolean',
  COMPTEUR_GAZ_NUMERO: 'N° compteur gaz',
  COMPTEUR_GAZ_INDEX: 'Index m³',
  COMPTEUR_EAU_NUMERO: 'N° compteur eau',
  COMPTEUR_EAU_INDEX: 'Index m³',
  COMPTEUR_EAU_DIVISIONNAIRE: 'Boolean',

  // HTML dynamique
  ZONES_HTML: 'HTML des zones inspectées',
  EQUIPEMENTS_HTML: 'HTML des équipements',
  CLES_HTML: 'HTML des clés remises',
  DOCUMENTS_HTML: 'HTML des documents annexés',
  DIFFERENCES_HTML: 'HTML des différences (sortie)',
  PHOTOS_FACADE_HTML: 'HTML des photos façade',

  // Booleans contenus
  HAS_EQUIPEMENTS: 'Boolean - équipements présents',
  HAS_DOCUMENTS: 'Boolean - documents annexés',
  HAS_DIFFERENCES: 'Boolean - différences constatées',
  HAS_RESERVES: 'Boolean - réserves émises',
  HAS_PHOTOS_FACADE: 'Boolean - photos façade',

  // Différences (sortie)
  TOTAL_ESTIMATIONS: 'Total estimations réparations',
  NB_IMPUTABLES: 'Nombre éléments imputables',

  // État général
  ETAT_GENERAL: 'État général (code)',
  ETAT_GENERAL_LABEL: 'État général (label)',
  CONFORMITE_GLOBALE: 'Conformité globale (code)',
  CONFORMITE_GLOBALE_LABEL: 'Conformité globale (label)',

  // Observations et réserves
  OBSERVATIONS_GENERALES: 'Observations générales',
  RESERVES_PRENEUR: 'Réserves du preneur',
  RESERVES_BAILLEUR: 'Réserves du bailleur',

  // Signatures
  SIGNATURE_BAILLEUR: 'Image signature bailleur (base64)',
  DATE_SIGNATURE_BAILLEUR: 'Date signature bailleur',
  SIGNATURE_PRENEUR: 'Image signature preneur (base64)',
  DATE_SIGNATURE_PRENEUR: 'Date signature preneur',
};

export default EDL_COMMERCIAL_TEMPLATE;
