/**
 * Template de bail mobilité
 * Conforme à la loi ELAN n°2018-1021 du 23 novembre 2018
 * 
 * ⚠️ Caractéristiques spécifiques du bail mobilité :
 * - Durée : 1 à 10 mois (non renouvelable, non reconductible)
 * - Dépôt de garantie : INTERDIT
 * - Public éligible : étudiants, formation professionnelle, stage, apprentissage,
 *   service civique, mutation professionnelle, mission temporaire
 * - Logement obligatoirement meublé
 * - Garantie Visale possible
 */

export const BAIL_MOBILITE_TEMPLATE = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bail Mobilité</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
      background: #fff;
      padding: 20mm;
    }
    
    .page {
      max-width: 210mm;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #6366f1;
    }
    
    .header h1 {
      font-size: 20pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
      color: #4f46e5;
    }
    
    .header .subtitle {
      font-size: 14pt;
      font-weight: normal;
    }
    
    .header .reference {
      font-size: 10pt;
      color: #666;
      margin-top: 10px;
    }
    
    .badge-mobilite {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #fff;
      padding: 10px 25px;
      border-radius: 25px;
      font-size: 12pt;
      margin-top: 15px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    
    .legal-notice {
      background: #eef2ff;
      border: 2px solid #6366f1;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 25px;
      font-size: 10pt;
    }
    
    .legal-notice strong {
      color: #4f46e5;
    }
    
    /* Alerte spéciale bail mobilité */
    .mobilite-alert {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #f59e0b;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .mobilite-alert-title {
      font-weight: bold;
      font-size: 12pt;
      color: #92400e;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .mobilite-features {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-top: 15px;
    }
    
    .mobilite-feature {
      background: #fff;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    
    .mobilite-feature-icon {
      font-size: 24pt;
      margin-bottom: 8px;
    }
    
    .mobilite-feature-label {
      font-size: 9pt;
      color: #92400e;
      text-transform: uppercase;
    }
    
    .mobilite-feature-value {
      font-weight: bold;
      color: #d97706;
      font-size: 11pt;
    }
    
    /* Alerte dépôt de garantie interdit */
    .no-depot-alert {
      background: #fef2f2;
      border: 2px solid #ef4444;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
    
    .no-depot-icon {
      font-size: 36pt;
      margin-bottom: 10px;
    }
    
    .no-depot-title {
      font-weight: bold;
      font-size: 14pt;
      color: #dc2626;
      margin-bottom: 10px;
    }
    
    .no-depot-text {
      font-size: 10pt;
      color: #991b1b;
    }
    
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #fff;
      padding: 10px 15px;
      margin-bottom: 15px;
      border-radius: 5px;
    }
    
    .section-content {
      padding: 0 15px;
    }
    
    .article {
      margin-bottom: 20px;
    }
    
    .article-title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 8px;
      color: #4f46e5;
    }
    
    .article-content {
      text-align: justify;
    }
    
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .party-box {
      border: 2px solid #6366f1;
      padding: 15px;
      border-radius: 10px;
      background: #f5f3ff;
    }
    
    .party-title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #c7d2fe;
      color: #4f46e5;
    }
    
    .party-info {
      margin-bottom: 5px;
    }
    
    .party-label {
      color: #666;
      font-size: 9pt;
    }
    
    .party-value {
      font-weight: 500;
    }
    
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    
    .info-table th,
    .info-table td {
      border: 1px solid #c7d2fe;
      padding: 10px 12px;
      text-align: left;
    }
    
    .info-table th {
      background: #eef2ff;
      font-weight: bold;
      width: 40%;
      color: #3730a3;
    }
    
    /* Motif de mobilité */
    .motif-box {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border: 2px solid #10b981;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .motif-title {
      font-weight: bold;
      font-size: 12pt;
      color: #047857;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .motif-selected {
      background: #fff;
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 15px;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .motif-icon {
      font-size: 28pt;
    }
    
    .motif-details {
      flex: 1;
    }
    
    .motif-label {
      font-weight: bold;
      color: #047857;
      font-size: 12pt;
    }
    
    .motif-description {
      font-size: 10pt;
      color: #065f46;
      margin-top: 5px;
    }
    
    /* Durée du bail */
    .duree-section {
      background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
      border: 2px solid #a855f7;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .duree-title {
      font-weight: bold;
      font-size: 12pt;
      color: #7e22ce;
      margin-bottom: 15px;
    }
    
    .duree-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    
    .duree-item {
      background: #fff;
      border: 1px solid #d8b4fe;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    
    .duree-item-label {
      font-size: 9pt;
      color: #7e22ce;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    
    .duree-item-value {
      font-size: 16pt;
      font-weight: bold;
      color: #a855f7;
    }
    
    .duree-warning {
      background: #fff;
      border: 1px dashed #a855f7;
      border-radius: 8px;
      padding: 15px;
      margin-top: 15px;
      font-size: 10pt;
      color: #6b21a8;
    }
    
    .financial-summary {
      background: #fff;
      border: 2px solid #6366f1;
      padding: 20px;
      margin: 20px 0;
      border-radius: 10px;
    }
    
    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e0e7ff;
    }
    
    .financial-row:last-child {
      border-bottom: none;
    }
    
    .financial-row.total {
      font-weight: bold;
      font-size: 13pt;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #fff;
      margin: 15px -20px -20px;
      padding: 15px 20px;
      border-radius: 0 0 8px 8px;
    }
    
    /* Garantie Visale */
    .visale-box {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      border: 2px solid #3b82f6;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .visale-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 15px;
    }
    
    .visale-logo {
      background: #fff;
      border-radius: 8px;
      padding: 10px 15px;
      font-weight: bold;
      color: #1d4ed8;
      font-size: 14pt;
    }
    
    .visale-title {
      font-weight: bold;
      font-size: 12pt;
      color: #1e40af;
    }
    
    .visale-content {
      background: #fff;
      border-radius: 8px;
      padding: 15px;
    }
    
    .visale-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    
    .visale-item {
      padding: 10px;
      background: #eff6ff;
      border-radius: 5px;
    }
    
    .visale-label {
      font-size: 9pt;
      color: #1e40af;
      text-transform: uppercase;
    }
    
    .visale-value {
      font-weight: bold;
      color: #1d4ed8;
    }
    
    /* Inventaire meublé */
    .inventaire-section {
      background: #fffbeb;
      border: 2px solid #f59e0b;
      padding: 20px;
      margin: 20px 0;
      border-radius: 10px;
    }
    
    .inventaire-title {
      font-weight: bold;
      font-size: 12pt;
      color: #d97706;
      margin-bottom: 15px;
    }
    
    .inventaire-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    
    .inventaire-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #fff;
      border-radius: 5px;
      border: 1px solid #fcd34d;
    }
    
    .inventaire-check {
      color: #22c55e;
      margin-right: 10px;
      font-weight: bold;
    }
    
    .signature-section {
      margin-top: 40px;
      page-break-inside: avoid;
    }
    
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 20px;
    }
    
    .signature-box {
      border: 2px solid #6366f1;
      padding: 20px;
      min-height: 150px;
      border-radius: 10px;
    }
    
    .signature-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: #4f46e5;
    }
    
    .signature-line {
      border-bottom: 1px solid #000;
      margin: 10px 0;
      min-height: 30px;
    }
    
    .signature-image {
      max-width: 200px;
      max-height: 80px;
      object-fit: contain;
      margin: 10px 0;
    }
    
    .signature-date {
      font-size: 8pt;
      color: #666;
      margin-top: 5px;
    }
    
    .signature-mention {
      font-size: 9pt;
      color: #666;
      font-style: italic;
    }
    
    .checkbox-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    
    .checkbox {
      width: 14px;
      height: 14px;
      border: 1px solid #6366f1;
      margin-right: 10px;
      flex-shrink: 0;
      border-radius: 3px;
    }
    
    .checkbox.checked::after {
      content: '✓';
      display: block;
      text-align: center;
      line-height: 12px;
      font-size: 12px;
      color: #22c55e;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #6366f1;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }
    
    @media print {
      body {
        padding: 0;
      }
      .page {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- EN-TÊTE -->
    <div class="header">
      <h1>Bail Mobilité</h1>
      <div class="subtitle">Location meublée de courte durée pour personnes en mobilité</div>
      <div class="badge-mobilite">🚀 BAIL MOBILITÉ</div>
      <div class="reference">Référence : {{REFERENCE_BAIL}}</div>
    </div>
    
    <div class="legal-notice">
      <strong>📋 Régime juridique applicable</strong><br>
      Le présent contrat est un <strong>bail mobilité</strong> régi par les articles 25-12 à 25-18 de la loi 
      n°89-462 du 6 juillet 1989, introduits par la <strong>loi ELAN n°2018-1021 du 23 novembre 2018</strong>.
      <br><br>
      Ce bail est réservé aux locataires justifiant, à la date de prise d'effet du bail, être dans l'une 
      des situations de mobilité prévues par la loi.
    </div>
    
    <!-- Caractéristiques spéciales du bail mobilité -->
    <div class="mobilite-alert">
      <div class="mobilite-alert-title">
        ⚡ Caractéristiques du bail mobilité
      </div>
      <div class="mobilite-features">
        <div class="mobilite-feature">
          <div class="mobilite-feature-icon">📅</div>
          <div class="mobilite-feature-label">Durée</div>
          <div class="mobilite-feature-value">1 à 10 mois</div>
        </div>
        <div class="mobilite-feature">
          <div class="mobilite-feature-icon">🔄</div>
          <div class="mobilite-feature-label">Renouvellement</div>
          <div class="mobilite-feature-value">Non renouvelable</div>
        </div>
        <div class="mobilite-feature">
          <div class="mobilite-feature-icon">💰</div>
          <div class="mobilite-feature-label">Dépôt de garantie</div>
          <div class="mobilite-feature-value">Interdit</div>
        </div>
      </div>
    </div>
    
    <!-- I. DÉSIGNATION DES PARTIES -->
    <div class="section">
      <div class="section-title">I. Désignation des Parties</div>
      <div class="section-content">
        <div class="parties-grid">
          <!-- Bailleur -->
          <div class="party-box">
            <div class="party-title">LE BAILLEUR</div>
            {{#if IS_SOCIETE}}
            <div class="party-info">
              <span class="party-label">Dénomination :</span><br>
              <span class="party-value">{{BAILLEUR_RAISON_SOCIALE}} ({{BAILLEUR_FORME_JURIDIQUE}})</span>
            </div>
            <div class="party-info">
              <span class="party-label">Représentée par :</span><br>
              <span class="party-value">{{BAILLEUR_REPRESENTANT}}, {{BAILLEUR_REPRESENTANT_QUALITE}}</span>
            </div>
            {{/if}}
            {{#unless IS_SOCIETE}}
            <div class="party-info">
              <span class="party-label">Nom et prénom :</span><br>
              <span class="party-value">{{BAILLEUR_NOM_COMPLET}}</span>
            </div>
            {{#if BAILLEUR_DATE_NAISSANCE}}
            <div class="party-info">
              <span class="party-label">Né(e) le :</span><br>
              <span class="party-value">{{BAILLEUR_DATE_NAISSANCE}} {{#if BAILLEUR_LIEU_NAISSANCE}}à {{BAILLEUR_LIEU_NAISSANCE}}{{/if}}</span>
            </div>
            {{/if}}
            {{/unless}}
            <div class="party-info">
              <span class="party-label">Adresse :</span><br>
              <span class="party-value">{{BAILLEUR_ADRESSE}}</span>
            </div>
            {{#if BAILLEUR_EMAIL}}
            <div class="party-info">
              <span class="party-label">Email :</span>
              <span class="party-value">{{BAILLEUR_EMAIL}}</span>
            </div>
            {{/if}}
          </div>
          
          <!-- Locataire -->
          <div class="party-box">
            <div class="party-title">LE LOCATAIRE</div>
            <div class="party-info">
              <span class="party-label">Nom et prénom :</span><br>
              <span class="party-value">{{LOCATAIRE_NOM_COMPLET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Né(e) le :</span><br>
              <span class="party-value">{{LOCATAIRE_DATE_NAISSANCE}} à {{LOCATAIRE_LIEU_NAISSANCE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Adresse actuelle :</span><br>
              <span class="party-value">{{LOCATAIRE_ADRESSE}}</span><br>
              <span class="party-value">{{LOCATAIRE_CODE_POSTAL}} {{LOCATAIRE_VILLE}}</span>
            </div>
            {{#if LOCATAIRE_EMAIL}}
            <div class="party-info">
              <span class="party-label">Email :</span>
              <span class="party-value">{{LOCATAIRE_EMAIL}}</span>
            </div>
            {{/if}}
          </div>
        </div>
        
        <p class="article-content">
          <strong>Ci-après dénommés respectivement "le bailleur" et "le locataire".</strong>
        </p>
      </div>
    </div>
    
    <!-- II. MOTIF DE MOBILITÉ -->
    <div class="section">
      <div class="section-title">II. Justification de la Mobilité</div>
      <div class="section-content">
        <div class="motif-box">
          <div class="motif-title">
            ✅ Motif de mobilité justifiant le bail
          </div>
          
          <div class="motif-selected">
            <div class="motif-icon">{{MOTIF_ICON}}</div>
            <div class="motif-details">
              <div class="motif-label">{{MOTIF_LABEL}}</div>
              <div class="motif-description">{{MOTIF_DESCRIPTION}}</div>
            </div>
          </div>
          
          <table class="info-table" style="margin-top: 20px;">
            {{#if ETABLISSEMENT_NOM}}
            <tr>
              <th>Établissement / Entreprise</th>
              <td>{{ETABLISSEMENT_NOM}}</td>
            </tr>
            {{/if}}
            {{#if FORMATION_INTITULE}}
            <tr>
              <th>Formation / Mission</th>
              <td>{{FORMATION_INTITULE}}</td>
            </tr>
            {{/if}}
            {{#if DATE_DEBUT_MOBILITE}}
            <tr>
              <th>Date de début</th>
              <td>{{DATE_DEBUT_MOBILITE}}</td>
            </tr>
            {{/if}}
            {{#if DATE_FIN_MOBILITE}}
            <tr>
              <th>Date de fin prévue</th>
              <td>{{DATE_FIN_MOBILITE}}</td>
            </tr>
            {{/if}}
          </table>
          
          <p style="margin-top: 15px; font-size: 10pt; color: #065f46; font-style: italic;">
            Le locataire déclare sur l'honneur être dans la situation de mobilité mentionnée ci-dessus 
            et s'engage à fournir les justificatifs correspondants.
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 1 - Justificatifs fournis</div>
          <p class="article-content">
            Le locataire a fourni les justificatifs suivants attestant de sa situation de mobilité :
          </p>
          <ul style="padding-left: 20px; margin-top: 10px;">
            {{#each JUSTIFICATIFS}}
            <li>{{this}}</li>
            {{/each}}
          </ul>
        </div>
      </div>
    </div>
    
    <!-- III. DÉSIGNATION DU LOGEMENT -->
    <div class="section">
      <div class="section-title">III. Désignation du Logement</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 2 - Description du logement</div>
          
          <table class="info-table">
            <tr>
              <th>Adresse du logement</th>
              <td>{{LOGEMENT_ADRESSE}}<br>{{LOGEMENT_CODE_POSTAL}} {{LOGEMENT_VILLE}}</td>
            </tr>
            <tr>
              <th>Type de logement</th>
              <td>{{LOGEMENT_TYPE}} <strong>(MEUBLÉ)</strong></td>
            </tr>
            <tr>
              <th>Régime juridique</th>
              <td>{{LOGEMENT_REGIME}}</td>
            </tr>
            <tr>
              <th>Surface habitable (loi Boutin)</th>
              <td><strong>{{LOGEMENT_SURFACE}} m²</strong></td>
            </tr>
            <tr>
              <th>Nombre de pièces principales</th>
              <td>{{LOGEMENT_NB_PIECES}}</td>
            </tr>
            {{#if LOGEMENT_ETAGE}}
            <tr>
              <th>Étage</th>
              <td>{{LOGEMENT_ETAGE}}</td>
            </tr>
            {{/if}}
          </table>
        </div>
        
        <div class="inventaire-section">
          <div class="inventaire-title">📋 Mobilier obligatoire (décret n°2015-981)</div>
          <p style="font-size: 9pt; margin-bottom: 15px; color: #92400e;">
            Le bail mobilité concerne obligatoirement un logement meublé. Le logement comprend :
          </p>
          
          <div class="inventaire-grid">
            <div class="inventaire-item">
              <span class="inventaire-check">✓</span>
              Literie avec couette ou couverture
            </div>
            <div class="inventaire-item">
              <span class="inventaire-check">✓</span>
              Volets ou rideaux occultants
            </div>
            <div class="inventaire-item">
              <span class="inventaire-check">✓</span>
              Plaques de cuisson
            </div>
            <div class="inventaire-item">
              <span class="inventaire-check">✓</span>
              Four ou micro-ondes
            </div>
            <div class="inventaire-item">
              <span class="inventaire-check">✓</span>
              Réfrigérateur avec congélateur
            </div>
            <div class="inventaire-item">
              <span class="inventaire-check">✓</span>
              Vaisselle et ustensiles
            </div>
            <div class="inventaire-item">
              <span class="inventaire-check">✓</span>
              Table et sièges
            </div>
            <div class="inventaire-item">
              <span class="inventaire-check">✓</span>
              Étagères de rangement
            </div>
            <div class="inventaire-item">
              <span class="inventaire-check">✓</span>
              Luminaires
            </div>
            <div class="inventaire-item">
              <span class="inventaire-check">✓</span>
              Matériel d'entretien
            </div>
          </div>
          
          <p style="margin-top: 15px; font-size: 9pt; font-style: italic; color: #92400e;">
            Un inventaire détaillé du mobilier est annexé au présent contrat.
          </p>
        </div>
        
        {{#if LOGEMENT_ANNEXES}}
        <div class="article">
          <div class="article-title">Article 3 - Annexes au logement</div>
          <p class="article-content">
            {{LOGEMENT_ANNEXES}}
          </p>
        </div>
        {{/if}}
      </div>
    </div>
    
    <!-- IV. DURÉE DU BAIL -->
    <div class="section page-break">
      <div class="section-title">IV. Durée du Bail</div>
      <div class="section-content">
        <div class="duree-section">
          <div class="duree-title">📅 Période du bail mobilité</div>
          
          <div class="duree-grid">
            <div class="duree-item">
              <div class="duree-item-label">Date d'effet</div>
              <div class="duree-item-value">{{BAIL_DATE_DEBUT}}</div>
            </div>
            <div class="duree-item">
              <div class="duree-item-label">Date de fin</div>
              <div class="duree-item-value">{{BAIL_DATE_FIN}}</div>
            </div>
            <div class="duree-item">
              <div class="duree-item-label">Durée totale</div>
              <div class="duree-item-value">{{BAIL_DUREE_MOIS}} mois</div>
            </div>
          </div>
          
          <div class="duree-warning">
            <strong>⚠️ Important :</strong> Le bail mobilité est conclu pour une durée comprise entre 
            <strong>1 et 10 mois</strong>. Il <strong>ne peut pas être renouvelé ni reconduit</strong>. 
            Toutefois, les parties peuvent conclure un avenant pour modifier la durée du bail, 
            sans que la durée totale ne puisse excéder 10 mois.
          </div>
        </div>
        
        <div class="article">
          <div class="article-title">Article 4 - Fin du bail</div>
          <p class="article-content">
            Le bail prendra fin automatiquement à la date indiquée ci-dessus, sans qu'il soit nécessaire 
            de délivrer congé.
            <br><br>
            <strong>Résiliation anticipée par le locataire :</strong> Le locataire peut résilier le bail 
            à tout moment, sous réserve de respecter un préavis de <strong>un mois</strong>.
            <br><br>
            <strong>Résiliation par le bailleur :</strong> Le bailleur ne peut pas résilier le bail 
            avant son terme, sauf en cas de manquement grave du locataire à ses obligations.
          </p>
        </div>
      </div>
    </div>
    
    <!-- V. CONDITIONS FINANCIÈRES -->
    <div class="section">
      <div class="section-title">V. Conditions Financières</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 5 - Loyer</div>
          
          <div class="financial-summary">
            <div class="financial-row">
              <span>Loyer mensuel hors charges</span>
              <span><strong>{{LOYER_HC}} €</strong></span>
            </div>
            <div class="financial-row">
              <span>{{CHARGES_TYPE_LABEL}}</span>
              <span>{{CHARGES_MONTANT}} €</span>
            </div>
            {{#if COMPLEMENT_LOYER}}
            <div class="financial-row">
              <span>Complément de loyer</span>
              <span>{{COMPLEMENT_LOYER}} €</span>
            </div>
            {{/if}}
            <div class="financial-row total">
              <span>TOTAL MENSUEL</span>
              <span>{{LOYER_TOTAL}} €</span>
            </div>
          </div>
          
          <p class="article-content">
            Soit en toutes lettres : <strong>{{LOYER_TOTAL_LETTRES}}</strong>
          </p>
          
          <table class="info-table" style="margin-top: 15px;">
            <tr>
              <th>Mode de paiement</th>
              <td>{{MODE_PAIEMENT}}</td>
            </tr>
            <tr>
              <th>Date de paiement</th>
              <td>Le {{JOUR_PAIEMENT}} de chaque mois, {{TERME_PAIEMENT}}</td>
            </tr>
          </table>
        </div>
        
        {{#if ZONE_ENCADREMENT}}
        <div class="article">
          <div class="article-title">Encadrement des loyers</div>
          <table class="info-table">
            <tr>
              <th>Loyer de référence</th>
              <td>{{LOYER_REFERENCE}} €/m²</td>
            </tr>
            <tr>
              <th>Loyer de référence majoré</th>
              <td>{{LOYER_REFERENCE_MAJORE}} €/m²</td>
            </tr>
            {{#if COMPLEMENT_LOYER}}
            <tr>
              <th>Complément de loyer</th>
              <td>{{COMPLEMENT_LOYER}} € - {{COMPLEMENT_JUSTIFICATION}}</td>
            </tr>
            {{/if}}
          </table>
        </div>
        {{/if}}
        
        <!-- DÉPÔT DE GARANTIE INTERDIT -->
        <div class="no-depot-alert">
          <div class="no-depot-icon">🚫</div>
          <div class="no-depot-title">DÉPÔT DE GARANTIE INTERDIT</div>
          <div class="no-depot-text">
            Conformément à l'article 25-14 de la loi du 6 juillet 1989, 
            <strong>aucun dépôt de garantie ne peut être exigé</strong> dans le cadre d'un bail mobilité.
          </div>
        </div>
      </div>
    </div>
    
    <!-- VI. GARANTIE VISALE -->
    {{#if GARANTIE_VISALE}}
    <div class="section">
      <div class="section-title">VI. Garantie Visale</div>
      <div class="section-content">
        <div class="visale-box">
          <div class="visale-header">
            <div class="visale-logo">VISALE</div>
            <div class="visale-title">Garantie locative Action Logement</div>
          </div>
          
          <div class="visale-content">
            <p style="margin-bottom: 15px;">
              Le locataire bénéficie de la garantie Visale, qui couvre les impayés de loyer et 
              les dégradations locatives.
            </p>
            
            <div class="visale-info">
              <div class="visale-item">
                <div class="visale-label">N° de visa Visale</div>
                <div class="visale-value">{{VISALE_NUMERO}}</div>
              </div>
              <div class="visale-item">
                <div class="visale-label">Date de validité</div>
                <div class="visale-value">{{VISALE_DATE_VALIDITE}}</div>
              </div>
            </div>
            
            <p style="margin-top: 15px; font-size: 10pt; color: #1e40af;">
              La garantie Visale se substitue au dépôt de garantie et couvre jusqu'à 
              {{VISALE_PLAFOND}} € de loyers impayés.
            </p>
          </div>
        </div>
      </div>
    </div>
    {{else}}
    <div class="section">
      <div class="section-title">VI. Garantie</div>
      <div class="section-content">
        <div class="article">
          <p class="article-content">
            {{#if GARANT_NOM}}
            Le locataire bénéficie d'une caution personnelle :
            <br><br>
            <strong>Nom du garant :</strong> {{GARANT_NOM}}<br>
            <strong>Adresse :</strong> {{GARANT_ADRESSE}}<br>
            <strong>Type d'engagement :</strong> {{GARANT_TYPE_ENGAGEMENT}}
            {{else}}
            Le présent bail est conclu sans cautionnement ni garantie Visale.
            {{/if}}
          </p>
        </div>
      </div>
    </div>
    {{/if}}
    
    <!-- VII. OBLIGATIONS DES PARTIES -->
    <div class="section page-break">
      <div class="section-title">VII. Obligations des Parties</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 6 - Obligations du bailleur</div>
          <p class="article-content">
            Le bailleur s'engage à :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Délivrer un logement décent et meublé conformément au décret n°2015-981</li>
              <li>Assurer au locataire la jouissance paisible du logement</li>
              <li>Entretenir les locaux et le mobilier en état de servir</li>
              <li>Remettre gratuitement une quittance au locataire</li>
              <li>Ne pas s'opposer aux aménagements réalisés par le locataire</li>
            </ul>
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 7 - Obligations du locataire</div>
          <p class="article-content">
            Le locataire s'engage à :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Payer le loyer et les charges aux termes convenus</li>
              <li>User paisiblement des locaux et du mobilier</li>
              <li>Répondre des dégradations survenues pendant la durée du bail</li>
              <li>Prendre à sa charge l'entretien courant du logement</li>
              <li>Ne pas transformer les locaux sans accord écrit du bailleur</li>
              <li>S'assurer contre les risques locatifs</li>
              <li>Permettre l'accès pour les réparations urgentes</li>
            </ul>
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 8 - Sous-location</div>
          <p class="article-content">
            {{#if SOUS_LOCATION_AUTORISEE}}
            La sous-location est autorisée avec l'accord écrit préalable du bailleur. 
            Le prix de la sous-location ne peut excéder le loyer principal.
            {{else}}
            La sous-location est interdite.
            {{/if}}
          </p>
        </div>
      </div>
    </div>
    
    <!-- VIII. DIAGNOSTICS -->
    <div class="section">
      <div class="section-title">VIII. Diagnostics Techniques</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 9 - Performance énergétique (DPE)</div>
          <table class="info-table">
            <tr>
              <th>Classe énergie</th>
              <td><strong style="font-size: 14pt; color: {{DPE_COLOR}};">{{DPE_CLASSE}}</strong></td>
            </tr>
            <tr>
              <th>Classe GES</th>
              <td><strong style="font-size: 14pt;">{{DPE_GES}}</strong></td>
            </tr>
            <tr>
              <th>Consommation énergétique</th>
              <td>{{DPE_CONSOMMATION}} kWh/m²/an</td>
            </tr>
          </table>
        </div>
        
        <div class="article">
          <div class="article-title">Article 10 - Autres diagnostics</div>
          <p class="article-content">
            Les diagnostics suivants sont annexés au présent contrat :
          </p>
          <ul style="padding-left: 20px; margin-top: 10px;">
            <li>Diagnostic de performance énergétique (DPE)</li>
            {{#if CREP}}<li>Constat de risque d'exposition au plomb (CREP)</li>{{/if}}
            {{#if ELECTRICITE}}<li>État de l'installation intérieure d'électricité</li>{{/if}}
            {{#if GAZ}}<li>État de l'installation intérieure de gaz</li>{{/if}}
            {{#if ERP}}<li>État des risques et pollutions (ERP)</li>{{/if}}
            {{#if BRUIT}}<li>Diagnostic bruit</li>{{/if}}
          </ul>
        </div>
      </div>
    </div>
    
    <!-- IX. ANNEXES -->
    <div class="section">
      <div class="section-title">IX. Documents Annexés</div>
      <div class="section-content">
        <ul style="list-style: none; padding: 0;">
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>État des lieux d'entrée</span>
          </li>
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Inventaire détaillé du mobilier</span>
          </li>
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Justificatif de mobilité du locataire</span>
          </li>
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Notice d'information</span>
          </li>
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Dossier de diagnostic technique</span>
          </li>
          {{#if GARANTIE_VISALE}}
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Visa Visale</span>
          </li>
          {{/if}}
          {{#if COPROPRIETE}}
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Extraits du règlement de copropriété</span>
          </li>
          {{/if}}
        </ul>
      </div>
    </div>
    
    <!-- X. SIGNATURES -->
    <div class="section signature-section">
      <div class="section-title">X. Signatures</div>
      <div class="section-content">
        <p class="article-content">
          Fait en deux exemplaires, à <strong>{{LIEU_SIGNATURE}}</strong>, le <strong>{{DATE_SIGNATURE}}</strong>.
        </p>
        
        <p class="article-content" style="margin: 20px 0; font-style: italic; font-size: 10pt;">
          Les parties déclarent avoir pris connaissance de l'ensemble des conditions du présent bail mobilité 
          et les accepter sans réserve. Le locataire reconnaît être informé que ce bail ne peut être 
          ni renouvelé ni reconduit.
        </p>
        
        <div class="signature-grid">
          <div class="signature-box">
            <div class="signature-title">Le Bailleur</div>
            <p class="signature-mention">"Lu et approuvé"</p>
            {{#if BAILLEUR_SIGNATURE_IMAGE}}
            <img src="{{BAILLEUR_SIGNATURE_IMAGE}}" alt="Signature bailleur" class="signature-image" />
            <p class="signature-date">Signé électroniquement le {{BAILLEUR_DATE_SIGNATURE}}</p>
            {{else}}
            <div class="signature-line"></div>
            {{/if}}
            <p style="font-size: 9pt;">{{BAILLEUR_NOM_COMPLET}}</p>
          </div>
          
          <div class="signature-box">
            <div class="signature-title">Le Locataire</div>
            <p class="signature-mention">"Lu et approuvé"</p>
            {{#if LOCATAIRE_SIGNATURE_IMAGE}}
            <img src="{{LOCATAIRE_SIGNATURE_IMAGE}}" alt="Signature locataire" class="signature-image" />
            <p class="signature-date">Signé électroniquement le {{LOCATAIRE_DATE_SIGNATURE}}</p>
            {{else}}
            <div class="signature-line"></div>
            {{/if}}
            <p style="font-size: 9pt;">{{LOCATAIRE_NOM_COMPLET}}</p>
          </div>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>Bail mobilité - Loi ELAN n°2018-1021 du 23 novembre 2018</p>
      <p>Articles 25-12 à 25-18 de la loi n°89-462 du 6 juillet 1989</p>
      <p>Document généré le {{DATE_GENERATION}} - Référence : {{REFERENCE_BAIL}}</p>
    </div>
  </div>
</body>
</html>
`;

// Variables disponibles pour le bail mobilité
export const BAIL_MOBILITE_VARIABLES = [
  // Système
  'REFERENCE_BAIL',
  'DATE_GENERATION',
  'DATE_SIGNATURE',
  'LIEU_SIGNATURE',
  
  // Bailleur
  'BAILLEUR_NOM_COMPLET',
  'BAILLEUR_ADRESSE',
  'BAILLEUR_CODE_POSTAL',
  'BAILLEUR_VILLE',
  'BAILLEUR_SIRET',
  'BAILLEUR_EMAIL',
  
  // Locataire
  'LOCATAIRE_NOM_COMPLET',
  'LOCATAIRE_DATE_NAISSANCE',
  'LOCATAIRE_LIEU_NAISSANCE',
  'LOCATAIRE_ADRESSE',
  'LOCATAIRE_CODE_POSTAL',
  'LOCATAIRE_VILLE',
  'LOCATAIRE_EMAIL',
  
  // Motif de mobilité
  'MOTIF_ICON', // emoji
  'MOTIF_LABEL', // "Formation professionnelle", "Études", etc.
  'MOTIF_DESCRIPTION',
  'ETABLISSEMENT_NOM',
  'FORMATION_INTITULE',
  'DATE_DEBUT_MOBILITE',
  'DATE_FIN_MOBILITE',
  'JUSTIFICATIFS', // Array
  
  // Logement
  'LOGEMENT_ADRESSE',
  'LOGEMENT_CODE_POSTAL',
  'LOGEMENT_VILLE',
  'LOGEMENT_TYPE',
  'LOGEMENT_REGIME',
  'LOGEMENT_SURFACE',
  'LOGEMENT_NB_PIECES',
  'LOGEMENT_ETAGE',
  'LOGEMENT_NB_ETAGES',
  'LOGEMENT_ANNEXES',
  
  // Durée
  'BAIL_DATE_DEBUT',
  'BAIL_DATE_FIN',
  'BAIL_DUREE_MOIS',
  
  // Financier
  'LOYER_HC',
  'LOYER_LETTRES',
  'CHARGES_MONTANT',
  'CHARGES_TYPE_LABEL',
  'COMPLEMENT_LOYER',
  'LOYER_TOTAL',
  'MODE_PAIEMENT',
  'JOUR_PAIEMENT',
  'TERME_PAIEMENT',
  
  // Encadrement
  'ZONE_ENCADREMENT',
  'LOYER_REFERENCE',
  'LOYER_REFERENCE_MAJORE',
  'COMPLEMENT_JUSTIFICATION',
  
  // Garantie Visale
  'GARANTIE_VISALE', // boolean
  'VISALE_NUMERO',
  'VISALE_DATE_VALIDITE',
  'VISALE_PLAFOND',
  
  // Garant (si pas Visale)
  'GARANT_NOM',
  'GARANT_ADRESSE',
  'GARANT_TYPE_ENGAGEMENT',
  
  // Sous-location
  'SOUS_LOCATION_AUTORISEE',
  
  // Diagnostics
  'DPE_CLASSE',
  'DPE_COLOR',
  'DPE_GES',
  'DPE_CONSOMMATION',
  'CREP',
  'ELECTRICITE',
  'GAZ',
  'ERP',
  'BRUIT',
  
  // Copropriété
  'COPROPRIETE',
];

// Motifs de mobilité autorisés
export const MOTIFS_MOBILITE = [
  {
    code: 'formation_pro',
    icon: '📚',
    label: 'Formation professionnelle',
    description: 'Formation professionnelle continue ou initiale',
  },
  {
    code: 'etudes_sup',
    icon: '🎓',
    label: 'Études supérieures',
    description: 'Études dans un établissement d\'enseignement supérieur',
  },
  {
    code: 'contrat_apprentissage',
    icon: '🔧',
    label: 'Contrat d\'apprentissage',
    description: 'Apprentissage dans le cadre d\'un contrat de travail',
  },
  {
    code: 'stage',
    icon: '💼',
    label: 'Stage',
    description: 'Stage conventionné dans une entreprise ou administration',
  },
  {
    code: 'engagement_volontaire',
    icon: '🤝',
    label: 'Engagement volontaire',
    description: 'Service civique ou volontariat associatif',
  },
  {
    code: 'mutation_pro',
    icon: '🏢',
    label: 'Mutation professionnelle',
    description: 'Mutation ou mobilité professionnelle temporaire',
  },
  {
    code: 'mission_temporaire',
    icon: '📋',
    label: 'Mission temporaire',
    description: 'Mission temporaire dans le cadre de l\'activité professionnelle',
  },
];

export default BAIL_MOBILITE_TEMPLATE;

