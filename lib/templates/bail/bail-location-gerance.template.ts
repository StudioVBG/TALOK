/**
 * Template HTML pour le Contrat de Location-Gérance
 * GAP-005: Support des contrats de location-gérance de fonds de commerce
 *
 * Cadre légal: Articles L144-1 à L144-13 du Code de commerce
 */

export const BAIL_LOCATION_GERANCE_TEMPLATE = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrat de Location-Gérance - {{REFERENCE}}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 25mm 15mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Times New Roman', Georgia, serif;
      font-size: 11pt;
      line-height: 1.5;
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
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px double #b45309;
    }

    .header h1 {
      font-size: 20pt;
      font-weight: bold;
      color: #b45309;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 10px;
    }

    .header .subtitle {
      font-size: 12pt;
      color: #78350f;
      font-style: italic;
    }

    .header .legal-ref {
      font-size: 9pt;
      color: #92400e;
      margin-top: 8px;
    }

    .reference-box {
      float: right;
      background: #fef3c7;
      padding: 10px 15px;
      border: 1px solid #fcd34d;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
    }

    .reference-box .label {
      font-size: 8pt;
      color: #92400e;
      text-transform: uppercase;
    }

    .reference-box .value {
      font-size: 11pt;
      font-weight: bold;
      color: #78350f;
    }

    /* Articles */
    .article {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .article-title {
      font-size: 13pt;
      font-weight: bold;
      color: #b45309;
      margin-bottom: 12px;
      padding-bottom: 5px;
      border-bottom: 1px solid #fcd34d;
      text-transform: uppercase;
    }

    .article-content {
      text-align: justify;
      padding-left: 10px;
    }

    .article-content p {
      margin-bottom: 10px;
    }

    /* Parties boxes */
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    .party-box {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 15px;
    }

    .party-box h3 {
      font-size: 11pt;
      font-weight: bold;
      color: #b45309;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px dashed #fcd34d;
    }

    .party-info {
      font-size: 10pt;
    }

    .party-info .label {
      font-weight: 600;
      color: #78350f;
    }

    .party-info p {
      margin-bottom: 3px;
    }

    /* Fonds de commerce */
    .fonds-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #b45309;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }

    .fonds-box h3 {
      font-size: 14pt;
      font-weight: bold;
      color: #78350f;
      margin-bottom: 15px;
      text-align: center;
    }

    .fonds-detail {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 5px;
      margin-bottom: 5px;
    }

    .fonds-detail .label {
      font-weight: 600;
      color: #92400e;
    }

    .fonds-detail .value {
      color: #1a1a1a;
    }

    /* Elements lists */
    .elements-section {
      margin: 15px 0;
    }

    .elements-section h4 {
      font-size: 11pt;
      font-weight: bold;
      color: #b45309;
      margin-bottom: 8px;
    }

    .elements-list {
      padding-left: 25px;
    }

    .elements-list li {
      margin-bottom: 3px;
    }

    /* Redevance box */
    .redevance-box {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }

    .redevance-box h3 {
      font-size: 13pt;
      font-weight: bold;
      color: #b45309;
      margin-bottom: 15px;
      text-align: center;
      text-transform: uppercase;
    }

    .redevance-montant {
      font-size: 18pt;
      font-weight: bold;
      color: #78350f;
      text-align: center;
      margin: 15px 0;
      padding: 15px;
      background: white;
      border-radius: 6px;
    }

    .redevance-details {
      font-size: 10pt;
      color: #78350f;
    }

    .redevance-details p {
      margin-bottom: 5px;
    }

    /* Warning box */
    .warning-box {
      background: #fef2f2;
      border: 2px solid #ef4444;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }

    .warning-box h4 {
      color: #b91c1c;
      font-size: 11pt;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .warning-box p {
      font-size: 10pt;
      color: #7f1d1d;
    }

    /* Info box */
    .info-box {
      background: #eff6ff;
      border: 1px solid #3b82f6;
      border-radius: 6px;
      padding: 12px;
      margin: 15px 0;
      font-size: 10pt;
      color: #1e40af;
    }

    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 10pt;
    }

    .data-table th,
    .data-table td {
      border: 1px solid #d4a574;
      padding: 8px 10px;
      text-align: left;
    }

    .data-table th {
      background: #fef3c7;
      font-weight: bold;
      color: #78350f;
    }

    .data-table tr:nth-child(even) {
      background: #fffbeb;
    }

    /* Obligations */
    .obligations-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 20px 0;
    }

    .obligations-box {
      border: 1px solid #d4a574;
      border-radius: 8px;
      padding: 15px;
    }

    .obligations-box.gerant {
      background: #fefce8;
    }

    .obligations-box.loueur {
      background: #f0fdf4;
    }

    .obligations-box h4 {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px dashed;
    }

    .obligations-box.gerant h4 {
      color: #854d0e;
      border-color: #fcd34d;
    }

    .obligations-box.loueur h4 {
      color: #166534;
      border-color: #86efac;
    }

    .obligations-list {
      font-size: 10pt;
      padding-left: 20px;
    }

    .obligations-list li {
      margin-bottom: 5px;
    }

    /* Non-concurrence */
    .non-concurrence-box {
      background: #faf5ff;
      border: 1px solid #a78bfa;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }

    .non-concurrence-box h4 {
      color: #5b21b6;
      font-size: 11pt;
      margin-bottom: 10px;
    }

    /* Publication JAL */
    .publication-box {
      background: #f0f9ff;
      border: 2px solid #0284c7;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }

    .publication-box h4 {
      color: #0369a1;
      font-size: 11pt;
      margin-bottom: 10px;
    }

    .publication-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }

    .publication-item {
      text-align: center;
      padding: 10px;
      background: white;
      border-radius: 4px;
    }

    .publication-item .label {
      font-size: 8pt;
      color: #64748b;
      text-transform: uppercase;
    }

    .publication-item .value {
      font-size: 10pt;
      font-weight: bold;
      color: #0369a1;
    }

    /* Signatures */
    .signatures-section {
      margin-top: 40px;
      page-break-inside: avoid;
    }

    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }

    .signature-box {
      border: 2px solid #d4a574;
      border-radius: 8px;
      padding: 20px;
      min-height: 200px;
    }

    .signature-box h4 {
      font-size: 11pt;
      font-weight: bold;
      color: #78350f;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #fcd34d;
      text-transform: uppercase;
    }

    .signature-info {
      font-size: 10pt;
      margin-bottom: 15px;
    }

    .signature-info .name {
      font-weight: bold;
    }

    .signature-info .quality {
      color: #78350f;
      font-style: italic;
    }

    .signature-area {
      height: 80px;
      border: 1px dashed #d4a574;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fffbeb;
      margin-bottom: 10px;
    }

    .signature-area img {
      max-height: 70px;
      max-width: 90%;
    }

    .signature-area .placeholder {
      color: #b45309;
      font-size: 9pt;
      font-style: italic;
    }

    .signature-date {
      font-size: 9pt;
      color: #78350f;
    }

    .mention-manuscrite {
      font-size: 9pt;
      color: #92400e;
      margin-top: 10px;
      font-style: italic;
    }

    /* Legal footer */
    .legal-footer {
      margin-top: 30px;
      padding: 15px;
      background: #f5f5f4;
      border-radius: 6px;
      font-size: 9pt;
      color: #57534e;
      line-height: 1.4;
    }

    .legal-footer strong {
      color: #44403c;
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

    /* Solidarité box */
    .solidarite-box {
      background: #fff7ed;
      border: 2px solid #ea580c;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }

    .solidarite-box h4 {
      color: #c2410c;
      font-size: 11pt;
      margin-bottom: 10px;
    }

    /* Inventaire */
    .inventaire-section {
      margin: 20px 0;
    }

    .inventaire-section h4 {
      font-size: 11pt;
      font-weight: bold;
      color: #78350f;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <!-- Page 1: Parties et Fonds -->
  <div class="page">
    <div class="reference-box">
      <div class="label">Référence</div>
      <div class="value">{{REFERENCE}}</div>
    </div>

    <div class="header">
      <h1>Contrat de Location-Gérance</h1>
      <div class="subtitle">Gérance libre d'un fonds de commerce</div>
      <div class="legal-ref">Articles L144-1 à L144-13 du Code de commerce</div>
    </div>

    <p style="text-align: center; margin-bottom: 30px; font-size: 10pt; color: #78350f;">
      <strong>ENTRE LES SOUSSIGNÉS :</strong>
    </p>

    <!-- Parties -->
    <div class="parties-grid">
      <!-- Loueur -->
      <div class="party-box">
        <h3>LE LOUEUR DU FONDS</h3>
        <div class="party-info">
          {{#if LOUEUR_IS_SOCIETE}}
          <p><span class="label">Société :</span> {{LOUEUR_RAISON_SOCIALE}}</p>
          <p><span class="label">Forme :</span> {{LOUEUR_FORME_JURIDIQUE}}</p>
          <p><span class="label">Capital :</span> {{LOUEUR_CAPITAL}} €</p>
          <p><span class="label">SIRET :</span> {{LOUEUR_SIRET}}</p>
          <p><span class="label">RCS :</span> {{LOUEUR_RCS}}</p>
          <p><span class="label">Siège :</span> {{LOUEUR_ADRESSE}}</p>
          <p><span class="label">Représentée par :</span> {{LOUEUR_REPRESENTANT}}</p>
          <p><span class="label">Qualité :</span> {{LOUEUR_QUALITE}}</p>
          {{else}}
          <p><span class="label">{{LOUEUR_CIVILITE}}</span> {{LOUEUR_NOM}} {{LOUEUR_PRENOM}}</p>
          <p><span class="label">Né(e) le :</span> {{LOUEUR_DATE_NAISSANCE}}</p>
          <p><span class="label">À :</span> {{LOUEUR_LIEU_NAISSANCE}}</p>
          <p><span class="label">Nationalité :</span> {{LOUEUR_NATIONALITE}}</p>
          <p><span class="label">Domicile :</span> {{LOUEUR_ADRESSE}}</p>
          {{/if}}
        </div>
        <p style="font-size: 10pt; font-style: italic; margin-top: 10px; color: #78350f;">
          ci-après dénommé(e) <strong>« LE LOUEUR »</strong>
        </p>
      </div>

      <!-- Gérant -->
      <div class="party-box">
        <h3>LE LOCATAIRE-GÉRANT</h3>
        <div class="party-info">
          {{#if GERANT_IS_SOCIETE}}
          <p><span class="label">Société :</span> {{GERANT_RAISON_SOCIALE}}</p>
          <p><span class="label">Forme :</span> {{GERANT_FORME_JURIDIQUE}}</p>
          <p><span class="label">Capital :</span> {{GERANT_CAPITAL}} €</p>
          <p><span class="label">SIRET :</span> {{GERANT_SIRET}}</p>
          <p><span class="label">RCS :</span> {{GERANT_RCS}}</p>
          <p><span class="label">Siège :</span> {{GERANT_ADRESSE}}</p>
          <p><span class="label">Représentée par :</span> {{GERANT_REPRESENTANT}}</p>
          <p><span class="label">Qualité :</span> {{GERANT_QUALITE}}</p>
          {{else}}
          <p><span class="label">{{GERANT_CIVILITE}}</span> {{GERANT_NOM}} {{GERANT_PRENOM}}</p>
          <p><span class="label">Né(e) le :</span> {{GERANT_DATE_NAISSANCE}}</p>
          <p><span class="label">À :</span> {{GERANT_LIEU_NAISSANCE}}</p>
          <p><span class="label">Nationalité :</span> {{GERANT_NATIONALITE}}</p>
          <p><span class="label">Domicile :</span> {{GERANT_ADRESSE}}</p>
          {{/if}}
          {{#if GERANT_RCS_DATE}}
          <p><span class="label">Immatriculé RCS :</span> {{GERANT_RCS}} le {{GERANT_RCS_DATE}}</p>
          {{/if}}
          {{#if GERANT_RM}}
          <p><span class="label">Immatriculé RM :</span> {{GERANT_RM}}</p>
          {{/if}}
        </div>
        <p style="font-size: 10pt; font-style: italic; margin-top: 10px; color: #78350f;">
          ci-après dénommé(e) <strong>« LE GÉRANT »</strong>
        </p>
      </div>
    </div>

    <p style="text-align: center; margin: 20px 0; font-size: 11pt;">
      <strong>IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</strong>
    </p>

    <!-- Désignation du fonds -->
    <div class="article">
      <div class="article-title">Article 1 - Désignation du Fonds de Commerce</div>
      <div class="article-content">
        <p>Le Loueur donne en location-gérance au Gérant, qui accepte, le fonds de commerce dont les caractéristiques sont les suivantes :</p>

        <div class="fonds-box">
          <h3>{{FONDS_NOM}}</h3>
          {{#if FONDS_ENSEIGNE}}
          <p style="text-align: center; font-style: italic; margin-bottom: 15px;">Enseigne : « {{FONDS_ENSEIGNE}} »</p>
          {{/if}}

          <div class="fonds-detail">
            <span class="label">Nature :</span>
            <span class="value">{{FONDS_TYPE_LABEL}}</span>
          </div>
          <div class="fonds-detail">
            <span class="label">Activité principale :</span>
            <span class="value">{{FONDS_ACTIVITE}}</span>
          </div>
          {{#if FONDS_ACTIVITES_SECONDAIRES}}
          <div class="fonds-detail">
            <span class="label">Activités secondaires :</span>
            <span class="value">{{FONDS_ACTIVITES_SECONDAIRES}}</span>
          </div>
          {{/if}}
          {{#if FONDS_CODE_APE}}
          <div class="fonds-detail">
            <span class="label">Code APE :</span>
            <span class="value">{{FONDS_CODE_APE}}</span>
          </div>
          {{/if}}
          <div class="fonds-detail">
            <span class="label">Adresse d'exploitation :</span>
            <span class="value">{{FONDS_ADRESSE}}</span>
          </div>
          {{#if FONDS_SURFACE}}
          <div class="fonds-detail">
            <span class="label">Surface des locaux :</span>
            <span class="value">{{FONDS_SURFACE}} m²</span>
          </div>
          {{/if}}
          {{#if FONDS_DATE_CREATION}}
          <div class="fonds-detail">
            <span class="label">Fonds créé le :</span>
            <span class="value">{{FONDS_DATE_CREATION}}</span>
          </div>
          {{/if}}
        </div>
      </div>
    </div>

    <!-- Éléments du fonds -->
    <div class="article">
      <div class="article-title">Article 2 - Éléments composant le Fonds</div>
      <div class="article-content">
        <p>Le fonds de commerce objet du présent contrat comprend les éléments suivants :</p>

        <div class="elements-section">
          <h4>A) Éléments incorporels</h4>
          <ul class="elements-list">
            {{#if FONDS_CLIENTELE}}<li>La clientèle et l'achalandage attachés au fonds</li>{{/if}}
            {{#if FONDS_NOM_COMMERCIAL}}<li>Le nom commercial « {{FONDS_NOM}} »</li>{{/if}}
            {{#if FONDS_ENSEIGNE}}<li>L'enseigne « {{FONDS_ENSEIGNE}} »</li>{{/if}}
            {{#if FONDS_DROIT_BAIL}}<li>Le droit au bail des locaux commerciaux</li>{{/if}}
            {{ELEMENTS_INCORPORELS_SUPPLEMENTAIRES}}
          </ul>
        </div>

        {{#if HAS_LICENCES}}
        <div class="elements-section">
          <h4>B) Licences et Autorisations</h4>
          <table class="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Numéro</th>
                <th>Date d'obtention</th>
                <th>Transférable</th>
              </tr>
            </thead>
            <tbody>
              {{LICENCES_HTML}}
            </tbody>
          </table>
        </div>
        {{/if}}

        <div class="elements-section">
          <h4>C) Éléments corporels</h4>
          {{#if HAS_EQUIPEMENTS}}
          <p>Le matériel et équipements sont détaillés dans l'inventaire annexé au présent contrat.</p>
          <p style="font-style: italic; color: #78350f; margin-top: 5px;">Valeur estimée du matériel : {{EQUIPEMENTS_VALEUR}} € HT</p>
          {{else}}
          <p>Néant - Le fonds ne comprend pas d'éléments corporels spécifiques.</p>
          {{/if}}
        </div>

        {{#if HAS_STOCK}}
        <div class="elements-section">
          <h4>D) Marchandises en stock</h4>
          <p>Le stock de marchandises existant à la date d'entrée en jouissance sera repris par le Gérant.</p>
          <p>Mode d'évaluation : {{STOCK_MODE_EVALUATION}}</p>
          <p>Un inventaire contradictoire sera établi le {{STOCK_DATE_INVENTAIRE}}.</p>
          {{#if STOCK_VALEUR_ESTIMEE}}
          <p style="font-style: italic;">Valeur estimée : {{STOCK_VALEUR_ESTIMEE}} € HT</p>
          {{/if}}
        </div>
        {{/if}}
      </div>
    </div>
  </div>

  <!-- Page 2: Bail commercial, Durée, Redevance -->
  <div class="page">
    {{#if HAS_BAIL_COMMERCIAL}}
    <!-- Bail commercial sous-jacent -->
    <div class="article">
      <div class="article-title">Article 3 - Bail Commercial des Locaux</div>
      <div class="article-content">
        <p>Le fonds de commerce est exploité dans des locaux dont le Loueur est titulaire d'un bail commercial :</p>

        <div class="info-box">
          <p><strong>Bail référence :</strong> {{BAIL_REFERENCE}}</p>
          <p><strong>Bailleur des murs :</strong> {{BAILLEUR_NOM}}</p>
          <p><strong>Date d'échéance :</strong> {{BAIL_DATE_FIN}}</p>
        </div>

        <p>Le Gérant s'engage à respecter toutes les clauses et conditions du bail commercial, notamment celles relatives à la destination des lieux, aux travaux et aux nuisances.</p>

        {{#if AUTORISATION_BAILLEUR}}
        <p>Le bailleur des murs a donné son accord à la mise en location-gérance par courrier en date du {{AUTORISATION_BAILLEUR_DATE}}.</p>
        {{else}}
        <div class="warning-box">
          <h4>⚠️ Attention</h4>
          <p>Le bail commercial peut prévoir une clause d'agrément ou d'interdiction de location-gérance. Le Loueur garantit avoir obtenu les autorisations nécessaires.</p>
        </div>
        {{/if}}
      </div>
    </div>
    {{/if}}

    <!-- Durée -->
    <div class="article">
      <div class="article-title">Article {{#if HAS_BAIL_COMMERCIAL}}4{{else}}3{{/if}} - Durée du Contrat</div>
      <div class="article-content">
        <p>Le présent contrat de location-gérance est consenti pour une durée <strong>{{DUREE_TYPE_LABEL}}</strong>.</p>

        <table class="data-table" style="width: 60%; margin: 15px auto;">
          <tr>
            <th>Prise d'effet</th>
            <td style="text-align: center;"><strong>{{DATE_DEBUT}}</strong></td>
          </tr>
          {{#if DATE_FIN}}
          <tr>
            <th>Échéance</th>
            <td style="text-align: center;"><strong>{{DATE_FIN}}</strong></td>
          </tr>
          <tr>
            <th>Durée</th>
            <td style="text-align: center;"><strong>{{DUREE_MOIS}} mois</strong></td>
          </tr>
          {{/if}}
        </table>

        {{#if TACITE_RECONDUCTION}}
        <p><strong>Tacite reconduction :</strong> À défaut de congé donné par l'une ou l'autre des parties au moins {{PREAVIS_NON_RECONDUCTION_MOIS}} mois avant le terme, le contrat sera reconduit pour une durée équivalente.</p>
        {{/if}}

        {{#unless TACITE_RECONDUCTION}}
        <p>Le contrat prendra fin de plein droit à son terme, sans qu'il soit besoin de délivrer congé.</p>
        {{/unless}}
      </div>
    </div>

    <!-- Redevance -->
    <div class="article">
      <div class="article-title">Article {{#if HAS_BAIL_COMMERCIAL}}5{{else}}4{{/if}} - Redevance</div>
      <div class="article-content">
        <p>En contrepartie de la jouissance du fonds de commerce, le Gérant versera au Loueur une redevance dont les modalités sont les suivantes :</p>

        <div class="redevance-box">
          <h3>{{REDEVANCE_TYPE_LABEL}}</h3>

          {{#if REDEVANCE_MONTANT_MENSUEL}}
          <div class="redevance-montant">
            {{REDEVANCE_MONTANT_MENSUEL}} € HT / mois
            {{#if REDEVANCE_TVA}}
            <br><span style="font-size: 12pt; color: #92400e;">soit {{REDEVANCE_MONTANT_TTC}} € TTC</span>
            {{/if}}
          </div>
          {{/if}}

          {{#if REDEVANCE_POURCENTAGE}}
          <div class="redevance-montant">
            {{REDEVANCE_POURCENTAGE}} % du chiffre d'affaires HT
            {{#if REDEVANCE_MINIMUM_GARANTI}}
            <br><span style="font-size: 12pt; color: #92400e;">avec minimum garanti de {{REDEVANCE_MINIMUM_GARANTI}} € HT / mois</span>
            {{/if}}
          </div>
          {{/if}}

          <div class="redevance-details">
            <p><strong>Échéance :</strong> Le {{REDEVANCE_ECHEANCE_JOUR}} de chaque mois</p>
            <p><strong>Mode de paiement :</strong> {{REDEVANCE_MODE_PAIEMENT}}</p>
            {{#if REDEVANCE_TVA}}
            <p><strong>TVA :</strong> {{REDEVANCE_TVA_TAUX}} %</p>
            {{/if}}
          </div>
        </div>

        {{#if REDEVANCE_INDEXATION}}
        <div class="info-box">
          <strong>Indexation :</strong> La redevance sera indexée annuellement selon la variation de l'indice {{REDEVANCE_INDICE}} (base {{REDEVANCE_INDICE_BASE}} du {{REDEVANCE_INDICE_TRIMESTRE}}).
          <br>Date de révision : {{REDEVANCE_DATE_REVISION}} de chaque année.
        </div>
        {{/if}}
      </div>
    </div>

    {{#if HAS_CAUTIONNEMENT}}
    <!-- Cautionnement -->
    <div class="article">
      <div class="article-title">Article {{#if HAS_BAIL_COMMERCIAL}}6{{else}}5{{/if}} - Garantie / Cautionnement</div>
      <div class="article-content">
        <p>En garantie de l'exécution de ses obligations, le Gérant remet au Loueur :</p>

        <table class="data-table" style="width: 70%; margin: 15px auto;">
          <tr>
            <th>Type de garantie</th>
            <td>{{CAUTIONNEMENT_TYPE_LABEL}}</td>
          </tr>
          <tr>
            <th>Montant</th>
            <td><strong>{{CAUTIONNEMENT_MONTANT}} €</strong></td>
          </tr>
          {{#if CAUTIONNEMENT_BANQUE}}
          <tr>
            <th>Établissement</th>
            <td>{{CAUTIONNEMENT_BANQUE}}</td>
          </tr>
          {{/if}}
          {{#if CAUTIONNEMENT_NUMERO}}
          <tr>
            <th>Référence</th>
            <td>{{CAUTIONNEMENT_NUMERO}}</td>
          </tr>
          {{/if}}
        </table>

        <p>Cette garantie sera restituée dans un délai de trois mois après la fin du contrat et restitution du fonds, déduction faite des sommes éventuellement dues par le Gérant.</p>
      </div>
    </div>
    {{/if}}
  </div>

  <!-- Page 3: Obligations -->
  <div class="page">
    <!-- Obligations du Gérant -->
    <div class="article">
      <div class="article-title">Article {{ARTICLE_OBLIGATIONS_GERANT}} - Obligations du Gérant</div>
      <div class="article-content">
        <p>Le Gérant s'engage à :</p>

        <div class="obligations-box gerant">
          <h4>Obligations d'exploitation</h4>
          <ul class="obligations-list">
            <li>Exploiter le fonds personnellement, de façon continue et conformément à sa destination</li>
            <li>Maintenir le fonds en état d'activité et conserver la clientèle</li>
            <li>Faire figurer sur tous documents commerciaux sa qualité de « locataire-gérant » ou « gérant-mandataire »</li>
            <li>Respecter la réglementation applicable à l'activité exercée</li>
            {{#if OBLIGATION_EXPLOITATION_PERSONNELLE}}
            <li>Ne pas confier l'exploitation à un tiers sans l'accord préalable du Loueur</li>
            {{/if}}
          </ul>
        </div>

        <div class="obligations-box gerant">
          <h4>Obligations financières</h4>
          <ul class="obligations-list">
            <li>Payer la redevance aux échéances convenues</li>
            <li>Acquitter toutes charges et dettes d'exploitation</li>
            <li>Payer la Cotisation Foncière des Entreprises (CFE)</li>
            {{#if CHARGES_LOCATIVES_GERANT}}
            <li>Acquitter les charges locatives du bail commercial</li>
            {{/if}}
            {{#if TAXE_FONCIERE_GERANT}}
            <li>Acquitter la taxe foncière (quote-part locative)</li>
            {{/if}}
          </ul>
        </div>

        <div class="obligations-box gerant">
          <h4>Obligations d'assurance</h4>
          <ul class="obligations-list">
            <li>Souscrire une assurance responsabilité civile professionnelle</li>
            <li>Souscrire une assurance multirisque couvrant les locaux et le matériel</li>
            <li>Justifier annuellement du paiement des primes</li>
          </ul>
        </div>

        <div class="obligations-box gerant">
          <h4>Interdictions</h4>
          <ul class="obligations-list">
            {{#if INTERDICTION_SOUS_LOCATION}}
            <li>Ne pas sous-louer tout ou partie du fonds</li>
            {{/if}}
            {{#if INTERDICTION_CESSION}}
            <li>Ne pas céder le présent contrat</li>
            {{/if}}
            <li>Ne pas modifier l'activité sans accord écrit du Loueur</li>
            <li>Ne pas effectuer de travaux importants sans autorisation</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Obligations du Loueur -->
    <div class="article">
      <div class="article-title">Article {{ARTICLE_OBLIGATIONS_LOUEUR}} - Obligations du Loueur</div>
      <div class="article-content">
        <p>Le Loueur s'engage à :</p>

        <div class="obligations-box loueur">
          <h4>Obligations principales</h4>
          <ul class="obligations-list">
            <li>Délivrer le fonds en état d'être exploité</li>
            <li>Garantir au Gérant la jouissance paisible du fonds</li>
            <li>Garantir le Gérant contre tout trouble de droit</li>
            <li>Informer le Gérant de tout événement affectant le fonds ou le bail commercial</li>
            {{#if OBLIGATION_NON_CONCURRENCE_LOUEUR}}
            <li>S'abstenir de tout acte de concurrence envers le Gérant pendant la durée du contrat</li>
            {{/if}}
            {{#if HAS_BAIL_COMMERCIAL}}
            <li>Maintenir en vigueur le bail commercial des locaux</li>
            {{/if}}
          </ul>
        </div>
      </div>
    </div>

    {{#if HAS_NON_CONCURRENCE}}
    <!-- Clause de non-concurrence -->
    <div class="article">
      <div class="article-title">Article {{ARTICLE_NON_CONCURRENCE}} - Clause de Non-Concurrence</div>
      <div class="article-content">
        <div class="non-concurrence-box">
          <h4>🚫 Engagement de non-concurrence du Gérant</h4>
          <p>À l'expiration du présent contrat, quelle qu'en soit la cause, le Gérant s'interdit :</p>
          <ul class="obligations-list">
            <li>D'exercer une activité similaire ou concurrente pendant une durée de <strong>{{NON_CONCURRENCE_DUREE_MOIS}} mois</strong></li>
            <li>Dans un périmètre de <strong>{{NON_CONCURRENCE_PERIMETRE_KM}} kilomètres</strong> autour du fonds</li>
            {{#if NON_CONCURRENCE_ACTIVITES}}
            <li>Activités concernées : {{NON_CONCURRENCE_ACTIVITES}}</li>
            {{/if}}
          </ul>
          <p style="margin-top: 10px; font-size: 10pt; color: #5b21b6;">
            En contrepartie, le Gérant ne percevra aucune indemnité spécifique. Cette clause est stipulée condition essentielle du contrat.
          </p>
        </div>
      </div>
    </div>
    {{/if}}
  </div>

  <!-- Page 4: Fin de contrat, Solidarité, Publication -->
  <div class="page">
    <!-- Résiliation -->
    <div class="article">
      <div class="article-title">Article {{ARTICLE_RESILIATION}} - Résiliation</div>
      <div class="article-content">
        {{#if CLAUSE_RESILIATION_ANTICIPEE}}
        <p><strong>Résiliation anticipée :</strong> Chaque partie pourra résilier le contrat avant son terme moyennant un préavis de <strong>{{PREAVIS_RESILIATION_MOIS}} mois</strong> adressé par lettre recommandée avec accusé de réception.</p>
        {{/if}}

        <p><strong>Résiliation de plein droit :</strong> Le présent contrat sera résilié de plein droit, sans mise en demeure préalable ni indemnité, dans les cas suivants :</p>
        <ul class="elements-list">
          <li>Défaut de paiement de deux échéances de redevance</li>
          <li>Non-respect des obligations d'exploitation</li>
          <li>Manquement grave aux obligations contractuelles</li>
          <li>Procédure de redressement ou liquidation judiciaire du Gérant</li>
          <li>Perte de la licence ou autorisation administrative nécessaire</li>
          <li>Résiliation du bail commercial sous-jacent</li>
        </ul>

        {{#if INDEMNITE_RESILIATION}}
        <p style="margin-top: 10px;"><strong>Indemnité :</strong> En cas de résiliation pour faute du Gérant, celui-ci devra verser une indemnité forfaitaire de {{INDEMNITE_RESILIATION}} €.</p>
        {{/if}}
      </div>
    </div>

    <!-- Fin de contrat - Restitution -->
    <div class="article">
      <div class="article-title">Article {{ARTICLE_RESTITUTION}} - Restitution du Fonds</div>
      <div class="article-content">
        <p>À l'expiration du contrat, le Gérant devra :</p>
        <ul class="elements-list">
          <li>Restituer le fonds avec tous ses éléments corporels et incorporels</li>
          <li>Remettre le matériel et équipements en bon état d'usage</li>
          <li>Transférer la clientèle au Loueur ou à son successeur</li>
          <li>Cesser immédiatement toute exploitation sous l'enseigne du fonds</li>
          <li>Établir un inventaire contradictoire des éléments du fonds</li>
          <li>Communiquer au Loueur la situation comptable du fonds</li>
        </ul>

        {{#if CONDITIONS_RESTITUTION}}
        <div class="info-box">
          <strong>Conditions particulières de restitution :</strong><br>
          {{CONDITIONS_RESTITUTION}}
        </div>
        {{/if}}
      </div>
    </div>

    <!-- Solidarité fiscale et sociale -->
    <div class="article">
      <div class="article-title">Article {{ARTICLE_SOLIDARITE}} - Solidarité Fiscale et Sociale</div>
      <div class="article-content">
        <div class="solidarite-box">
          <h4>⚠️ Article L144-7 du Code de commerce</h4>
          <p>Jusqu'à la publication du contrat dans un journal d'annonces légales, puis pendant un délai de <strong>{{SOLIDARITE_DUREE_MOIS}} mois</strong> à compter de cette publication, le Loueur est <strong>solidairement responsable</strong> avec le Gérant des dettes contractées par celui-ci à l'occasion de l'exploitation du fonds, qu'il s'agisse :</p>
          <ul class="obligations-list" style="margin-top: 10px;">
            <li>Des dettes fiscales</li>
            <li>Des cotisations sociales</li>
            <li>Des dettes envers les fournisseurs</li>
          </ul>
          <p style="margin-top: 10px; font-size: 10pt; font-style: italic;">
            La même solidarité existe à la fin du contrat jusqu'à la publication de sa cessation.
          </p>
        </div>

        <div class="warning-box">
          <h4>⚠️ Importance de la publication</h4>
          <p>Le Gérant s'engage à procéder à la publication du présent contrat dans un journal d'annonces légales dans les <strong>15 jours</strong> suivant la signature. Un exemplaire de la publication sera remis au Loueur.</p>
        </div>
      </div>
    </div>

    {{#if HAS_PUBLICATION}}
    <!-- Publication effectuée -->
    <div class="article">
      <div class="article-title">Article {{ARTICLE_PUBLICATION}} - Publication</div>
      <div class="article-content">
        <p>Le présent contrat a fait l'objet de la publication légale obligatoire :</p>
        <div class="publication-box">
          <h4>📰 Publication au Journal d'Annonces Légales</h4>
          <div class="publication-grid">
            <div class="publication-item">
              <div class="label">Journal</div>
              <div class="value">{{PUBLICATION_JOURNAL}}</div>
            </div>
            <div class="publication-item">
              <div class="label">Date de parution</div>
              <div class="value">{{PUBLICATION_DATE}}</div>
            </div>
            <div class="publication-item">
              <div class="label">Référence</div>
              <div class="value">{{PUBLICATION_REFERENCE}}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {{/if}}
  </div>

  <!-- Page 5: Dispositions diverses et Signatures -->
  <div class="page">
    <!-- Dispositions diverses -->
    <div class="article">
      <div class="article-title">Article {{ARTICLE_DIVERS}} - Dispositions Diverses</div>
      <div class="article-content">
        <p><strong>Élection de domicile :</strong> Pour l'exécution des présentes, les parties élisent domicile en leur siège ou domicile respectif indiqué ci-dessus.</p>

        <p><strong>Loi applicable :</strong> Le présent contrat est soumis au droit français, notamment aux articles L144-1 à L144-13 du Code de commerce.</p>

        <p><strong>Compétence :</strong> En cas de litige relatif à l'interprétation ou à l'exécution du présent contrat, les parties s'efforceront de trouver une solution amiable. À défaut, les tribunaux compétents seront ceux du lieu de situation du fonds de commerce.</p>

        <p><strong>Annexes :</strong> Les documents suivants sont annexés au présent contrat et en font partie intégrante :</p>
        <ul class="elements-list">
          <li>Inventaire détaillé du matériel et équipements</li>
          {{#if HAS_STOCK}}<li>Inventaire du stock de marchandises</li>{{/if}}
          {{#if HAS_BAIL_COMMERCIAL}}<li>Copie du bail commercial des locaux</li>{{/if}}
          {{#if HAS_LICENCES}}<li>Copies des licences et autorisations</li>{{/if}}
          <li>Attestation d'assurance du Gérant</li>
          {{#if HAS_CAUTIONNEMENT}}<li>Justificatif de la garantie/cautionnement</li>{{/if}}
        </ul>
      </div>
    </div>

    <!-- Mentions légales -->
    <div class="legal-footer">
      <p><strong>Rappel des textes applicables :</strong></p>
      <p>Le présent contrat est régi par les articles L144-1 à L144-13 du Code de commerce relatifs à la location-gérance des fonds de commerce.</p>
      <p>• <strong>Art. L144-1 :</strong> Définition de la location-gérance</p>
      <p>• <strong>Art. L144-3 :</strong> Obligation d'immatriculation du gérant au RCS ou RM</p>
      <p>• <strong>Art. L144-4 :</strong> Conditions relatives au loueur</p>
      <p>• <strong>Art. L144-6 :</strong> Publicité obligatoire dans un JAL</p>
      <p>• <strong>Art. L144-7 :</strong> Solidarité fiscale et sociale du loueur</p>
    </div>

    <!-- Signatures -->
    <div class="signatures-section">
      <p style="text-align: center; margin-bottom: 20px;">
        <strong>Fait en deux exemplaires originaux, à {{LIEU_SIGNATURE}}, le {{DATE_SIGNATURE}}</strong>
      </p>

      <div class="signatures-grid">
        <!-- Signature Loueur -->
        <div class="signature-box">
          <h4>Le Loueur</h4>
          <div class="signature-info">
            <p class="name">{{LOUEUR_SIGNATURE_NOM}}</p>
            {{#if LOUEUR_REPRESENTANT}}
            <p class="quality">Représentant {{LOUEUR_RAISON_SOCIALE}}</p>
            {{/if}}
          </div>
          <div class="signature-area">
            {{#if SIGNATURE_LOUEUR}}
            <img src="{{SIGNATURE_LOUEUR}}" alt="Signature loueur" />
            {{else}}
            <span class="placeholder">Signature</span>
            {{/if}}
          </div>
          <div class="signature-date">
            {{#if DATE_SIGNATURE_LOUEUR}}
            Signé le : {{DATE_SIGNATURE_LOUEUR}}
            {{else}}
            Date : ____________________
            {{/if}}
          </div>
          <p class="mention-manuscrite">Précédé de la mention manuscrite :<br>« Lu et approuvé, bon pour location-gérance »</p>
        </div>

        <!-- Signature Gérant -->
        <div class="signature-box">
          <h4>Le Gérant</h4>
          <div class="signature-info">
            <p class="name">{{GERANT_SIGNATURE_NOM}}</p>
            {{#if GERANT_REPRESENTANT}}
            <p class="quality">Représentant {{GERANT_RAISON_SOCIALE}}</p>
            {{/if}}
          </div>
          <div class="signature-area">
            {{#if SIGNATURE_GERANT}}
            <img src="{{SIGNATURE_GERANT}}" alt="Signature gérant" />
            {{else}}
            <span class="placeholder">Signature</span>
            {{/if}}
          </div>
          <div class="signature-date">
            {{#if DATE_SIGNATURE_GERANT}}
            Signé le : {{DATE_SIGNATURE_GERANT}}
            {{else}}
            Date : ____________________
            {{/if}}
          </div>
          <p class="mention-manuscrite">Précédé de la mention manuscrite :<br>« Lu et approuvé, bon pour prise en location-gérance »</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top: 30px; text-align: center; font-size: 8pt; color: #78350f;">
      Contrat généré le {{DATE_GENERATION}} | Référence : {{REFERENCE}}
    </div>
  </div>
</body>
</html>
`;

/**
 * Variables disponibles pour le template
 */
export const BAIL_LOCATION_GERANCE_VARIABLES = {
  // Référence
  REFERENCE: 'Référence unique du contrat',
  DATE_GENERATION: 'Date de génération du document',

  // Loueur
  LOUEUR_IS_SOCIETE: 'Boolean - personne morale',
  LOUEUR_CIVILITE: 'M. / Mme',
  LOUEUR_NOM: 'Nom du loueur',
  LOUEUR_PRENOM: 'Prénom du loueur',
  LOUEUR_DATE_NAISSANCE: 'Date de naissance',
  LOUEUR_LIEU_NAISSANCE: 'Lieu de naissance',
  LOUEUR_NATIONALITE: 'Nationalité',
  LOUEUR_ADRESSE: 'Adresse complète',
  LOUEUR_RAISON_SOCIALE: 'Raison sociale (si société)',
  LOUEUR_FORME_JURIDIQUE: 'Forme juridique',
  LOUEUR_CAPITAL: 'Capital social',
  LOUEUR_SIRET: 'SIRET',
  LOUEUR_RCS: 'RCS',
  LOUEUR_REPRESENTANT: 'Représentant légal',
  LOUEUR_QUALITE: 'Qualité du représentant',
  LOUEUR_SIGNATURE_NOM: 'Nom pour signature',

  // Gérant
  GERANT_IS_SOCIETE: 'Boolean - personne morale',
  GERANT_CIVILITE: 'M. / Mme',
  GERANT_NOM: 'Nom du gérant',
  GERANT_PRENOM: 'Prénom du gérant',
  GERANT_DATE_NAISSANCE: 'Date de naissance',
  GERANT_LIEU_NAISSANCE: 'Lieu de naissance',
  GERANT_NATIONALITE: 'Nationalité',
  GERANT_ADRESSE: 'Adresse complète',
  GERANT_RAISON_SOCIALE: 'Raison sociale (si société)',
  GERANT_FORME_JURIDIQUE: 'Forme juridique',
  GERANT_CAPITAL: 'Capital social',
  GERANT_SIRET: 'SIRET',
  GERANT_RCS: 'RCS',
  GERANT_RCS_DATE: 'Date immatriculation RCS',
  GERANT_RM: 'Répertoire des Métiers',
  GERANT_REPRESENTANT: 'Représentant légal',
  GERANT_QUALITE: 'Qualité du représentant',
  GERANT_SIGNATURE_NOM: 'Nom pour signature',

  // Fonds de commerce
  FONDS_NOM: 'Nom commercial du fonds',
  FONDS_ENSEIGNE: 'Enseigne',
  FONDS_TYPE_LABEL: 'Type de fonds (label)',
  FONDS_ACTIVITE: 'Activité principale',
  FONDS_ACTIVITES_SECONDAIRES: 'Activités secondaires',
  FONDS_CODE_APE: 'Code APE',
  FONDS_ADRESSE: 'Adresse d\'exploitation',
  FONDS_SURFACE: 'Surface en m²',
  FONDS_DATE_CREATION: 'Date création fonds',
  FONDS_CLIENTELE: 'Boolean - clientèle incluse',
  FONDS_NOM_COMMERCIAL: 'Boolean - nom commercial inclus',
  FONDS_DROIT_BAIL: 'Boolean - droit au bail inclus',
  ELEMENTS_INCORPORELS_SUPPLEMENTAIRES: 'HTML éléments incorporels',

  // Licences
  HAS_LICENCES: 'Boolean - licences présentes',
  LICENCES_HTML: 'HTML tableau licences',

  // Équipements
  HAS_EQUIPEMENTS: 'Boolean - équipements présents',
  EQUIPEMENTS_VALEUR: 'Valeur estimée HT',

  // Stock
  HAS_STOCK: 'Boolean - stock présent',
  STOCK_MODE_EVALUATION: 'Mode d\'évaluation',
  STOCK_DATE_INVENTAIRE: 'Date inventaire',
  STOCK_VALEUR_ESTIMEE: 'Valeur estimée',

  // Bail commercial
  HAS_BAIL_COMMERCIAL: 'Boolean - bail sous-jacent',
  BAIL_REFERENCE: 'Référence bail commercial',
  BAILLEUR_NOM: 'Nom bailleur des murs',
  BAIL_DATE_FIN: 'Date échéance bail',
  AUTORISATION_BAILLEUR: 'Boolean - autorisation obtenue',
  AUTORISATION_BAILLEUR_DATE: 'Date autorisation',

  // Durée
  DUREE_TYPE_LABEL: 'Type de durée (déterminée/indéterminée)',
  DATE_DEBUT: 'Date de prise d\'effet',
  DATE_FIN: 'Date d\'échéance',
  DUREE_MOIS: 'Durée en mois',
  TACITE_RECONDUCTION: 'Boolean',
  PREAVIS_NON_RECONDUCTION_MOIS: 'Préavis non reconduction',

  // Redevance
  REDEVANCE_TYPE_LABEL: 'Type de redevance (label)',
  REDEVANCE_MONTANT_MENSUEL: 'Montant mensuel HT',
  REDEVANCE_MONTANT_TTC: 'Montant mensuel TTC',
  REDEVANCE_POURCENTAGE: 'Pourcentage CA',
  REDEVANCE_MINIMUM_GARANTI: 'Minimum garanti',
  REDEVANCE_ECHEANCE_JOUR: 'Jour d\'échéance',
  REDEVANCE_MODE_PAIEMENT: 'Mode de paiement',
  REDEVANCE_TVA: 'Boolean - TVA applicable',
  REDEVANCE_TVA_TAUX: 'Taux TVA',
  REDEVANCE_INDEXATION: 'Boolean - indexation',
  REDEVANCE_INDICE: 'Indice de référence',
  REDEVANCE_INDICE_BASE: 'Valeur indice base',
  REDEVANCE_INDICE_TRIMESTRE: 'Trimestre indice base',
  REDEVANCE_DATE_REVISION: 'Date révision annuelle',

  // Cautionnement
  HAS_CAUTIONNEMENT: 'Boolean - cautionnement',
  CAUTIONNEMENT_TYPE_LABEL: 'Type de garantie',
  CAUTIONNEMENT_MONTANT: 'Montant',
  CAUTIONNEMENT_BANQUE: 'Établissement bancaire',
  CAUTIONNEMENT_NUMERO: 'Numéro garantie',

  // Obligations
  OBLIGATION_EXPLOITATION_PERSONNELLE: 'Boolean',
  INTERDICTION_SOUS_LOCATION: 'Boolean',
  INTERDICTION_CESSION: 'Boolean',
  CHARGES_LOCATIVES_GERANT: 'Boolean',
  TAXE_FONCIERE_GERANT: 'Boolean',
  OBLIGATION_NON_CONCURRENCE_LOUEUR: 'Boolean',

  // Non-concurrence
  HAS_NON_CONCURRENCE: 'Boolean - clause active',
  NON_CONCURRENCE_DUREE_MOIS: 'Durée en mois',
  NON_CONCURRENCE_PERIMETRE_KM: 'Périmètre en km',
  NON_CONCURRENCE_ACTIVITES: 'Activités concernées',

  // Résiliation
  CLAUSE_RESILIATION_ANTICIPEE: 'Boolean',
  PREAVIS_RESILIATION_MOIS: 'Préavis résiliation',
  INDEMNITE_RESILIATION: 'Indemnité forfaitaire',
  CONDITIONS_RESTITUTION: 'Conditions particulières',

  // Solidarité
  SOLIDARITE_DUREE_MOIS: 'Durée solidarité (6 mois)',

  // Publication
  HAS_PUBLICATION: 'Boolean - publication effectuée',
  PUBLICATION_JOURNAL: 'Nom du journal',
  PUBLICATION_DATE: 'Date de parution',
  PUBLICATION_REFERENCE: 'Référence publication',

  // Numéros d'articles dynamiques
  ARTICLE_OBLIGATIONS_GERANT: 'Numéro article obligations gérant',
  ARTICLE_OBLIGATIONS_LOUEUR: 'Numéro article obligations loueur',
  ARTICLE_NON_CONCURRENCE: 'Numéro article non-concurrence',
  ARTICLE_RESILIATION: 'Numéro article résiliation',
  ARTICLE_RESTITUTION: 'Numéro article restitution',
  ARTICLE_SOLIDARITE: 'Numéro article solidarité',
  ARTICLE_PUBLICATION: 'Numéro article publication',
  ARTICLE_DIVERS: 'Numéro article dispositions diverses',

  // Signatures
  LIEU_SIGNATURE: 'Lieu de signature',
  DATE_SIGNATURE: 'Date de signature',
  SIGNATURE_LOUEUR: 'Image signature loueur (base64)',
  DATE_SIGNATURE_LOUEUR: 'Date signature loueur',
  SIGNATURE_GERANT: 'Image signature gérant (base64)',
  DATE_SIGNATURE_GERANT: 'Date signature gérant',
};

export default BAIL_LOCATION_GERANCE_TEMPLATE;
