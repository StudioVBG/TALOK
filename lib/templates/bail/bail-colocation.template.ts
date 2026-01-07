/**
 * Template de bail de colocation
 * Conforme à la loi ALUR et au décret n°2015-587 du 29 mai 2015
 * 
 * Spécificités :
 * - Bail unique (tous les colocataires) ou bail individuel (par chambre)
 * - Clause de solidarité optionnelle (max 6 mois après départ)
 * - Fin automatique de la solidarité si remplaçant trouvé
 */

export const BAIL_COLOCATION_TEMPLATE = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>{{DOCUMENT_TITLE}}</title>
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
      border-bottom: 2px solid #7c3aed;
    }
    
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
      color: #7c3aed;
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
    
    .badge-coloc {
      display: inline-block;
      background: #7c3aed;
      color: #fff;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 10pt;
      margin-top: 10px;
    }
    
    .badge-type {
      display: inline-block;
      background: {{#if BAIL_UNIQUE}}#059669{{else}}#f59e0b{{/if}};
      color: #fff;
      padding: 3px 10px;
      border-radius: 10px;
      font-size: 9pt;
      margin-left: 10px;
    }
    
    .legal-notice {
      background: #f5f3ff;
      border: 1px solid #7c3aed;
      padding: 15px;
      margin-bottom: 25px;
      font-size: 9pt;
      text-align: center;
    }
    
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      background: #7c3aed;
      color: #fff;
      padding: 8px 15px;
      margin-bottom: 15px;
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
      color: #7c3aed;
    }
    
    .article-content {
      text-align: justify;
    }
    
    /* Grille des colocataires */
    .colocataires-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    
    .colocataire-card {
      border: 1px solid #7c3aed;
      padding: 15px;
      border-radius: 8px;
      background: #faf5ff;
    }
    
    .colocataire-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ddd;
    }
    
    .colocataire-numero {
      background: #7c3aed;
      color: #fff;
      width: 25px;
      height: 25px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }
    
    .colocataire-role {
      font-size: 9pt;
      color: #7c3aed;
      font-weight: 500;
    }
    
    .colocataire-info {
      margin-bottom: 5px;
    }
    
    .colocataire-label {
      font-size: 9pt;
      color: #666;
    }
    
    .colocataire-value {
      font-weight: 500;
    }
    
    .party-box {
      border: 1px solid #7c3aed;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    
    .party-title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #e9d5ff;
      color: #7c3aed;
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
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    
    .info-table th {
      background: #f5f3ff;
      font-weight: bold;
      width: 40%;
    }
    
    .financial-summary {
      background: #f9f9f9;
      border: 2px solid #7c3aed;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    
    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #ddd;
    }
    
    .financial-row:last-child {
      border-bottom: none;
    }
    
    .financial-row.total {
      font-weight: bold;
      font-size: 12pt;
      background: #7c3aed;
      color: #fff;
      margin: 10px -20px -20px;
      padding: 12px 20px;
      border-radius: 0 0 6px 6px;
    }
    
    /* Section spécifique colocation */
    .colocation-highlight {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    
    .colocation-highlight-title {
      font-weight: bold;
      font-size: 12pt;
      color: #d97706;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .solidarite-box {
      background: #fef2f2;
      border: 2px solid #ef4444;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    
    .solidarite-title {
      font-weight: bold;
      font-size: 12pt;
      color: #dc2626;
      margin-bottom: 15px;
    }
    
    .solidarite-warning {
      background: #fff;
      padding: 10px;
      border-radius: 5px;
      font-size: 10pt;
      margin-top: 10px;
    }
    
    .quote-parts-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    
    .quote-parts-table th,
    .quote-parts-table td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: center;
    }
    
    .quote-parts-table th {
      background: #f5f3ff;
    }
    
    .quote-parts-table .total-row {
      font-weight: bold;
      background: #e9d5ff;
    }
    
    .espaces-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 20px 0;
    }
    
    .espace-box {
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 5px;
    }
    
    .espace-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: #7c3aed;
    }
    
    .espace-list {
      list-style: none;
      padding: 0;
    }
    
    .espace-list li {
      padding: 5px 0;
      border-bottom: 1px dashed #eee;
    }
    
    .diagnostic-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 15px 0;
    }
    
    .diagnostic-card {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: center;
      border-radius: 5px;
    }
    
    .diagnostic-label {
      font-size: 9pt;
      color: #666;
    }
    
    .diagnostic-value {
      font-size: 14pt;
      font-weight: bold;
    }
    
    .diagnostic-value.class-a { color: #1a9641; }
    .diagnostic-value.class-b { color: #52b947; }
    .diagnostic-value.class-c { color: #a6d96a; }
    .diagnostic-value.class-d { color: #d9a200; }
    .diagnostic-value.class-e { color: #f57c00; }
    .diagnostic-value.class-f { color: #e53935; }
    .diagnostic-value.class-g { color: #d73027; }
    
    .signature-section {
      margin-top: 40px;
      page-break-inside: avoid;
    }
    
    .signatures-coloc-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: 20px;
    }
    
    .signature-box {
      border: 1px solid #7c3aed;
      padding: 15px;
      min-height: 120px;
      border-radius: 5px;
    }
    
    .signature-box.bailleur {
      grid-column: span 2;
      max-width: 50%;
      margin-bottom: 20px;
    }
    
    .signature-title {
      font-weight: bold;
      margin-bottom: 8px;
      color: #7c3aed;
      font-size: 10pt;
    }
    
    .signature-line {
      border-bottom: 1px solid #000;
      margin: 8px 0;
      min-height: 25px;
    }
    
    .signature-mention {
      font-size: 8pt;
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
      border: 1px solid #000;
      margin-right: 10px;
      flex-shrink: 0;
    }
    
    .checkbox.checked::after {
      content: '✓';
      display: block;
      text-align: center;
      line-height: 12px;
      font-size: 12px;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #7c3aed;
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
      <h1>{{DOCUMENT_TITLE}}</h1>
      <div class="subtitle">
        Bail de colocation {{#if BAIL_MEUBLE}}meublée{{else}}vide{{/if}} 
        à usage de résidence principale
      </div>
      <div>
        <span class="badge-coloc">COLOCATION</span>
        <span class="badge-type">
          {{#if BAIL_UNIQUE}}Bail unique{{else}}Bail individuel{{/if}}
        </span>
      </div>
      <div class="reference">Référence : {{REFERENCE_BAIL}}</div>
    </div>
    
    <div class="legal-notice">
      <strong>Loi n°89-462 du 6 juillet 1989</strong> - Article 8-1 relatif à la colocation<br>
      modifiée par la loi n°2014-366 du 24 mars 2014 (loi ALUR)<br>
      <em>Contrat type défini par le décret n°2015-587 du 29 mai 2015</em>
    </div>
    
    <!-- I. DÉSIGNATION DES PARTIES -->
    <div class="section">
      <div class="section-title">I. Désignation des Parties</div>
      <div class="section-content">
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
        </div>
        
        <!-- Colocataires -->
        <div class="article">
          <div class="article-title">LES COLOCATAIRES</div>
          <div class="colocataires-grid">
            {{#each COLOCATAIRES}}
            <div class="colocataire-card">
              <div class="colocataire-header">
                <span class="colocataire-numero">{{this.numero}}</span>
                <span class="colocataire-role">{{this.role}}</span>
              </div>
              <div class="colocataire-info">
                <span class="colocataire-label">Nom et prénom :</span><br>
                <span class="colocataire-value">{{this.nom_complet}}</span>
              </div>
              <div class="colocataire-info">
                <span class="colocataire-label">Né(e) le :</span><br>
                <span class="colocataire-value">{{this.date_naissance}} à {{this.lieu_naissance}}</span>
              </div>
              {{#if this.chambre}}
              <div class="colocataire-info">
                <span class="colocataire-label">Chambre attribuée :</span><br>
                <span class="colocataire-value">{{this.chambre}}</span>
              </div>
              {{/if}}
            </div>
            {{/each}}
          </div>
        </div>
        
        <p class="article-content">
          <strong>Ci-après dénommés respectivement "le bailleur" et "les colocataires" ou individuellement "le colocataire".</strong>
        </p>
      </div>
    </div>
    
    <!-- II. OBJET DU CONTRAT -->
    <div class="section">
      <div class="section-title">II. Objet et Type du Contrat</div>
      <div class="section-content">
        <div class="colocation-highlight">
          <div class="colocation-highlight-title">
            📋 Type de contrat de colocation
          </div>
          {{#if BAIL_UNIQUE}}
          <p class="article-content">
            Le présent contrat est un <strong>BAIL UNIQUE</strong> signé par l'ensemble des colocataires.
            <br><br>
            Tous les colocataires sont cotitulaires du bail et ont les mêmes droits et obligations 
            vis-à-vis du bailleur. Le logement forme un tout indivisible loué à l'ensemble des colocataires.
          </p>
          {{else}}
          <p class="article-content">
            Le présent contrat est un <strong>BAIL INDIVIDUEL</strong> portant sur une partie privative 
            du logement (chambre) et l'accès aux parties communes.
            <br><br>
            Chaque colocataire dispose de son propre contrat et n'est responsable que de ses propres 
            obligations (loyer, charges de sa quote-part).
          </p>
          {{/if}}
        </div>
        
        <div class="article">
          <div class="article-title">Article 1 - Objet</div>
          <p class="article-content">
            Le présent contrat a pour objet la location en colocation d'un logement 
            {{#if BAIL_MEUBLE}}meublé{{else}}vide{{/if}}, destiné à l'usage exclusif 
            d'habitation principale des colocataires.
          </p>
        </div>
      </div>
    </div>
    
    <!-- III. DÉSIGNATION DES LOCAUX -->
    <div class="section">
      <div class="section-title">III. Désignation des Locaux</div>
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
              <td>{{LOGEMENT_TYPE}} <strong>(COLOCATION)</strong></td>
            </tr>
            <tr>
              <th>Surface habitable totale</th>
              <td><strong>{{LOGEMENT_SURFACE}} m²</strong></td>
            </tr>
            <tr>
              <th>Nombre de pièces principales</th>
              <td>{{LOGEMENT_NB_PIECES}}</td>
            </tr>
            <tr>
              <th>Nombre de chambres</th>
              <td>{{LOGEMENT_NB_CHAMBRES}}</td>
            </tr>
            <tr>
              <th>Nombre maximum de colocataires</th>
              <td>{{NB_COLOCATAIRES_MAX}}</td>
            </tr>
          </table>
        </div>
        
        <div class="article">
          <div class="article-title">Article 3 - Répartition des espaces</div>
          
          <div class="espaces-section">
            <div class="espace-box">
              <div class="espace-title">🔒 Parties Privatives (chambres)</div>
              <ul class="espace-list">
                {{#each CHAMBRES}}
                <li>
                  <strong>{{this.nom}}</strong> - {{this.surface}} m²
                  {{#if this.attribuee_a}}
                  <br><em>Attribuée à : {{this.attribuee_a}}</em>
                  {{/if}}
                </li>
                {{/each}}
              </ul>
            </div>
            
            <div class="espace-box">
              <div class="espace-title">🔓 Parties Communes</div>
              <ul class="espace-list">
                {{#each PARTIES_COMMUNES}}
                <li>{{this}}</li>
                {{/each}}
              </ul>
            </div>
          </div>
        </div>
        
        <div class="article">
          <div class="article-title">Article 4 - Équipements</div>
          <p class="article-content">
            <strong>Équipements des parties communes :</strong><br>
            {{EQUIPEMENTS_COMMUNS}}
          </p>
          {{#if BAIL_MEUBLE}}
          <p class="article-content" style="margin-top: 10px;">
            <strong>Note :</strong> Le mobilier des parties communes et des chambres est détaillé 
            dans l'inventaire annexé au présent contrat.
          </p>
          {{/if}}
        </div>
      </div>
    </div>
    
    <!-- IV. CLAUSE DE SOLIDARITÉ (si applicable) -->
    {{#if CLAUSE_SOLIDARITE}}
    <div class="section page-break">
      <div class="section-title">IV. Clause de Solidarité</div>
      <div class="section-content">
        <div class="solidarite-box">
          <div class="solidarite-title">⚠️ CLAUSE DE SOLIDARITÉ APPLICABLE</div>
          
          <p class="article-content">
            <strong>Article 5 - Engagement solidaire</strong><br><br>
            Les colocataires sont tenus <strong>solidairement</strong> au paiement du loyer, 
            des charges et des réparations locatives.
            <br><br>
            Cette solidarité signifie que le bailleur peut réclamer <strong>l'intégralité</strong> 
            des sommes dues à n'importe lequel des colocataires, à charge pour celui-ci de se 
            retourner contre les autres.
          </p>
          
          <div class="solidarite-warning">
            <strong>Durée de la solidarité après départ :</strong><br>
            En cas de départ d'un colocataire, celui-ci reste solidaire pendant une durée de 
            <strong>{{DUREE_SOLIDARITE_MOIS}} mois</strong> après la date effective de son départ, 
            sauf si un remplaçant figure au bail avant l'expiration de ce délai.
            <br><br>
            <em>Conformément à l'article 8-1 de la loi du 6 juillet 1989, cette durée ne peut 
            excéder 6 mois.</em>
          </div>
          
          <p class="article-content" style="margin-top: 15px;">
            <strong>Article 6 - Fin anticipée de la solidarité</strong><br><br>
            La solidarité du colocataire sortant prend fin automatiquement et de plein droit 
            à la date d'entrée d'un nouveau colocataire dont le nom figure au bail, 
            et ce même avant l'expiration du délai de {{DUREE_SOLIDARITE_MOIS}} mois.
          </p>
        </div>
      </div>
    </div>
    {{else}}
    <div class="section">
      <div class="section-title">IV. Absence de Clause de Solidarité</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 5 - Responsabilité individuelle</div>
          <p class="article-content">
            Le présent bail <strong>ne comporte pas de clause de solidarité</strong>.
            <br><br>
            Chaque colocataire n'est tenu qu'au paiement de sa quote-part du loyer et des charges, 
            telle que définie dans le présent contrat.
          </p>
        </div>
      </div>
    </div>
    {{/if}}
    
    <!-- V. DURÉE DU BAIL -->
    <div class="section">
      <div class="section-title">V. Durée du Bail</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 7 - Durée</div>
          <table class="info-table">
            <tr>
              <th>Date de prise d'effet</th>
              <td><strong>{{BAIL_DATE_DEBUT}}</strong></td>
            </tr>
            <tr>
              <th>Durée du bail</th>
              <td><strong>{{BAIL_DUREE}}</strong></td>
            </tr>
            {{#if BAIL_DATE_FIN}}
            <tr>
              <th>Date de fin prévue</th>
              <td>{{BAIL_DATE_FIN}}</td>
            </tr>
            {{/if}}
          </table>
          
          <p class="article-content" style="margin-top: 15px;">
            {{#if BAIL_MEUBLE}}
            À l'expiration, le contrat sera reconduit tacitement pour une durée d'un an.
            {{else}}
            À l'expiration, le contrat sera reconduit tacitement pour une durée de trois ans.
            {{/if}}
          </p>
        </div>
      </div>
    </div>
    
    <!-- VI. CONDITIONS FINANCIÈRES -->
    <div class="section">
      <div class="section-title">VI. Conditions Financières</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 8 - Loyer global</div>
          
          <div class="financial-summary">
            <div class="financial-row">
              <span>Loyer mensuel global hors charges</span>
              <span><strong>{{LOYER_HC_TOTAL}} €</strong></span>
            </div>
            <div class="financial-row">
              <span>Provisions sur charges</span>
              <span>{{CHARGES_TOTAL}} €</span>
            </div>
            <div class="financial-row total">
              <span>TOTAL MENSUEL GLOBAL</span>
              <span>{{LOYER_TOTAL_GLOBAL}} €</span>
            </div>
          </div>
        </div>
        
        <div class="article">
          <div class="article-title">Article 9 - Répartition entre colocataires</div>
          
          <table class="quote-parts-table">
            <thead>
              <tr>
                <th>Colocataire</th>
                <th>Quote-part (%)</th>
                <th>Loyer HC</th>
                <th>Charges</th>
                <th>Total mensuel</th>
              </tr>
            </thead>
            <tbody>
              {{#each QUOTE_PARTS}}
              <tr>
                <td>{{this.nom}}</td>
                <td>{{this.pourcentage}}%</td>
                <td>{{this.loyer}} €</td>
                <td>{{this.charges}} €</td>
                <td><strong>{{this.total}} €</strong></td>
              </tr>
              {{/each}}
              <tr class="total-row">
                <td>TOTAL</td>
                <td>100%</td>
                <td>{{LOYER_HC_TOTAL}} €</td>
                <td>{{CHARGES_TOTAL}} €</td>
                <td>{{LOYER_TOTAL_GLOBAL}} €</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="article">
          <div class="article-title">Article 10 - Modalités de paiement</div>
          <table class="info-table">
            <tr>
              <th>Mode de paiement</th>
              <td>{{MODE_PAIEMENT}}</td>
            </tr>
            <tr>
              <th>Date de paiement</th>
              <td>Le {{JOUR_PAIEMENT}} de chaque mois</td>
            </tr>
            {{#if PAIEMENT_UNIQUE}}
            <tr>
              <th>Modalité</th>
              <td>Paiement unique par un colocataire désigné</td>
            </tr>
            {{else}}
            <tr>
              <th>Modalité</th>
              <td>Paiement individuel par chaque colocataire</td>
            </tr>
            {{/if}}
          </table>
        </div>
        
        <div class="article">
          <div class="article-title">Article 11 - Dépôt de garantie</div>
          <table class="info-table">
            <tr>
              <th>Dépôt de garantie total</th>
              <td><strong>{{DEPOT_GARANTIE_TOTAL}} €</strong></td>
            </tr>
            {{#each DEPOT_PAR_COLOC}}
            <tr>
              <td style="padding-left: 20px;">• {{this.nom}}</td>
              <td>{{this.montant}} €</td>
            </tr>
            {{/each}}
          </table>
          
          <p class="article-content" style="margin-top: 15px;">
            {{#if BAIL_UNIQUE}}
            En cas de départ d'un colocataire, son dépôt de garantie ne sera restitué qu'à 
            l'expiration du bail ou à l'entrée d'un remplaçant.
            {{else}}
            Le dépôt de garantie de chaque colocataire lui sera restitué individuellement 
            lors de son départ, après état des lieux de sa partie privative.
            {{/if}}
          </p>
        </div>
      </div>
    </div>
    
    <!-- VII. DÉPART ET REMPLACEMENT -->
    <div class="section page-break">
      <div class="section-title">VII. Départ et Remplacement d'un Colocataire</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 12 - Congé d'un colocataire</div>
          <p class="article-content">
            Tout colocataire peut donner congé individuellement, moyennant un préavis de :
            <ul style="padding-left: 20px; margin-top: 10px;">
              {{#if BAIL_MEUBLE}}
              <li><strong>Un mois</strong> (location meublée)</li>
              {{else}}
              <li><strong>Trois mois</strong>, réduit à un mois dans les cas prévus par la loi 
              (zone tendue, mutation, perte d'emploi...)</li>
              {{/if}}
            </ul>
            <br>
            Le congé doit être notifié par lettre recommandée avec accusé de réception ou 
            par acte d'huissier.
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 13 - Remplacement d'un colocataire</div>
          <p class="article-content">
            {{#if BAIL_UNIQUE}}
            Le remplacement d'un colocataire sortant nécessite :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>L'accord préalable et écrit du bailleur</li>
              <li>La signature d'un avenant au bail intégrant le nouveau colocataire</li>
              <li>Un état des lieux intermédiaire si nécessaire</li>
            </ul>
            <br>
            Le bailleur ne peut refuser un remplaçant présentant des garanties équivalentes 
            au colocataire sortant.
            {{else}}
            En cas de bail individuel, le départ d'un colocataire n'affecte pas les autres baux. 
            Le bailleur est libre de chercher un nouveau colocataire selon ses propres critères.
            {{/if}}
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 14 - Effets du départ</div>
          <p class="article-content">
            Le colocataire sortant :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Libère sa partie privative (chambre) dans l'état initial</li>
              <li>Participe à un état des lieux de sa partie privative</li>
              {{#if CLAUSE_SOLIDARITE}}
              <li>Reste solidaire pendant {{DUREE_SOLIDARITE_MOIS}} mois maximum après son départ</li>
              {{/if}}
              <li>Récupère son dépôt de garantie selon les modalités prévues</li>
            </ul>
          </p>
        </div>
      </div>
    </div>
    
    <!-- VIII. DIAGNOSTICS -->
    <div class="section">
      <div class="section-title">VIII. Diagnostics Techniques</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 15 - Performance énergétique</div>
          <div class="diagnostic-grid">
            <div class="diagnostic-card">
              <div class="diagnostic-label">Classe énergie</div>
              <div class="diagnostic-value class-{{DPE_CLASSE_LOWER}}">{{DPE_CLASSE}}</div>
            </div>
            <div class="diagnostic-card">
              <div class="diagnostic-label">Classe GES</div>
              <div class="diagnostic-value class-{{DPE_GES_LOWER}}">{{DPE_GES}}</div>
            </div>
            <div class="diagnostic-card">
              <div class="diagnostic-label">Consommation</div>
              <div class="diagnostic-value">{{DPE_CONSOMMATION}} kWh/m²/an</div>
            </div>
          </div>
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
            <span>État des lieux d'entrée (parties communes + chambres)</span>
          </li>
          {{#if BAIL_MEUBLE}}
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Inventaire du mobilier (commun + chambres)</span>
          </li>
          {{/if}}
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Notice d'information</span>
          </li>
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Dossier de diagnostic technique</span>
          </li>
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Règlement intérieur de la colocation</span>
          </li>
          {{#if CLAUSE_SOLIDARITE}}
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Avenant clause de solidarité signé par tous</span>
          </li>
          {{/if}}
        </ul>
      </div>
    </div>
    
    <!-- X. SIGNATURES -->
    <div class="section signature-section page-break">
      <div class="section-title">X. Signatures</div>
      <div class="section-content">
        <p class="article-content">
          Fait à <strong>{{LIEU_SIGNATURE}}</strong>, le <strong>{{DATE_SIGNATURE}}</strong>,<br>
          en {{NB_EXEMPLAIRES}} exemplaires originaux (un pour le bailleur et un pour chaque colocataire).
        </p>
        
        <p class="article-content" style="margin: 20px 0; font-style: italic; font-size: 10pt;">
          Chaque partie reconnaît avoir reçu un exemplaire du présent contrat et de ses annexes.
          {{#if CLAUSE_SOLIDARITE}}
          <br><strong>Chaque colocataire reconnaît avoir été informé de la clause de solidarité 
          et de ses conséquences.</strong>
          {{/if}}
        </p>
        
        <!-- Signature Bailleur -->
        <div class="signature-box bailleur">
          <div class="signature-title">Le Bailleur</div>
          <p class="signature-mention">"Lu et approuvé"</p>
          <div class="signature-line"></div>
          <p style="font-size: 9pt;">{{BAILLEUR_NOM_COMPLET}}</p>
        </div>
        
        <!-- Signatures Colocataires -->
        <div class="signatures-coloc-grid">
          {{#each COLOCATAIRES}}
          <div class="signature-box">
            <div class="signature-title">Colocataire {{this.numero}} - {{this.role}}</div>
            <p class="signature-mention">"Lu et approuvé{{#if ../CLAUSE_SOLIDARITE}}, y compris la clause de solidarité{{/if}}"</p>
            <div class="signature-line"></div>
            <p style="font-size: 9pt;">{{this.nom_complet}}</p>
          </div>
          {{/each}}
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>Contrat de colocation - Article 8-1 de la loi du 6 juillet 1989</p>
      <p>Document généré le {{DATE_GENERATION}} - Référence : {{REFERENCE_BAIL}}</p>
    </div>
  </div>

  <!-- Page Certificat de Signature (uniquement si signé) -->
  {{#if IS_SIGNED}}
  <div class="page" style="page-break-before: always; padding: 20mm;">
    <div class="header" style="border-bottom-color: #7c3aed;">
      <h1 style="color: #7c3aed;">CERTIFICAT DE SIGNATURE ÉLECTRONIQUE</h1>
      <div class="subtitle">Dossier de Preuve Numérique</div>
    </div>

    <div class="section">
      <div class="section-title" style="background: #7c3aed;">🛡️ Validité Juridique</div>
      <div class="section-content">
        <p style="font-size: 10pt; color: #333; line-height: 1.6; text-align: justify; margin-bottom: 20px;">
          Ce document a été signé électroniquement conformément aux dispositions du Code Civil (Articles 1366 et 1367) 
          et du Règlement européen eIDAS (n°910/2014). La signature électronique avancée utilisée garantit 
          l'identification des signataires et l'intégrité du document.
        </p>
      </div>
    </div>

    {{{CERTIFICATE_HTML}}}

    <div class="section">
      <div class="section-title" style="background: #7c3aed;">📄 Intégrité du Document</div>
      <div class="section-content">
        <div class="party-box" style="background: #f8fafc; border-style: dashed; border-color: #7c3aed;">
          <p style="font-size: 9pt; color: #475569; margin-bottom: 5px;">Empreinte numérique (Hash SHA-256) du document original :</p>
          <code style="font-size: 10pt; font-weight: bold; color: #1e293b; word-break: break-all;">{{DOCUMENT_HASH}}</code>
        </div>
      </div>
    </div>

    <div class="footer" style="border-top-color: #7c3aed;">
      <p>Certificat de Signature - Page générée automatiquement</p>
      <p>Document : Bail de Colocation {{REFERENCE_BAIL}}</p>
    </div>
  </div>
  {{/if}}
</body>
</html>
`;

// Variables disponibles pour le bail colocation
export const BAIL_COLOCATION_VARIABLES = [
  // Système
  'REFERENCE_BAIL',
  'DATE_GENERATION',
  'DATE_SIGNATURE',
  'LIEU_SIGNATURE',
  'NB_EXEMPLAIRES',
  
  // Bailleur
  'BAILLEUR_NOM_COMPLET',
  'BAILLEUR_ADRESSE',
  'BAILLEUR_QUALITE',
  
  // Type de bail
  'BAIL_UNIQUE', // boolean
  'BAIL_MEUBLE', // boolean
  
  // Colocataires (array)
  'COLOCATAIRES', // [{numero, nom_complet, date_naissance, lieu_naissance, role, chambre}]
  'NB_COLOCATAIRES_MAX',
  
  // Logement
  'LOGEMENT_ADRESSE',
  'LOGEMENT_CODE_POSTAL',
  'LOGEMENT_VILLE',
  'LOGEMENT_TYPE',
  'LOGEMENT_SURFACE',
  'LOGEMENT_NB_PIECES',
  'LOGEMENT_NB_CHAMBRES',
  
  // Espaces
  'CHAMBRES', // [{nom, surface, attribuee_a}]
  'PARTIES_COMMUNES', // [string]
  'EQUIPEMENTS_COMMUNS',
  
  // Solidarité
  'CLAUSE_SOLIDARITE', // boolean
  'DUREE_SOLIDARITE_MOIS',
  
  // Durée
  'BAIL_DATE_DEBUT',
  'BAIL_DUREE',
  'BAIL_DATE_FIN',
  
  // Financier global
  'LOYER_HC_TOTAL',
  'CHARGES_TOTAL',
  'LOYER_TOTAL_GLOBAL',
  
  // Quote-parts (array)
  'QUOTE_PARTS', // [{nom, pourcentage, loyer, charges, total}]
  
  // Paiement
  'MODE_PAIEMENT',
  'JOUR_PAIEMENT',
  'PAIEMENT_UNIQUE', // boolean
  
  // Dépôt
  'DEPOT_GARANTIE_TOTAL',
  'DEPOT_PAR_COLOC', // [{nom, montant}]
  
  // Diagnostics
  'DPE_CLASSE',
  'DPE_CLASSE_LOWER',
  'DPE_GES',
  'DPE_GES_LOWER',
  'DPE_CONSOMMATION',
];

export default BAIL_COLOCATION_TEMPLATE;

