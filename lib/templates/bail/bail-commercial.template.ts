/**
 * Template de bail commercial 3/6/9
 * Conforme au Code de commerce (Articles L145-1 à L145-60)
 *
 * Durée : 9 ans minimum, résiliation triennale
 * Dépôt de garantie : libre (généralement 3-6 mois)
 * Indexation : ILC, ILAT ou ICC
 */

export const BAIL_COMMERCIAL_TEMPLATE = `
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
      border-bottom: 3px double #000;
    }

    .header h1 {
      font-size: 20pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
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

    .legal-notice {
      background: #e8f4f8;
      border: 2px solid #2980b9;
      padding: 15px;
      margin-bottom: 25px;
      font-size: 9pt;
      text-align: center;
    }

    .legal-notice strong {
      color: #2980b9;
    }

    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      background: #2c3e50;
      color: #fff;
      padding: 10px 15px;
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
      color: #2c3e50;
      border-left: 3px solid #2980b9;
      padding-left: 10px;
    }

    .article-content {
      text-align: justify;
    }

    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 20px;
    }

    .party-box {
      border: 1px solid #bdc3c7;
      padding: 15px;
      background: #f9f9f9;
    }

    .party-title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #2980b9;
      color: #2c3e50;
    }

    .party-info {
      margin-bottom: 5px;
    }

    .party-label {
      color: #7f8c8d;
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
      border: 1px solid #bdc3c7;
      padding: 10px 12px;
      text-align: left;
    }

    .info-table th {
      background: #ecf0f1;
      font-weight: bold;
      width: 40%;
      color: #2c3e50;
    }

    .financial-summary {
      background: #f5f5f5;
      border: 2px solid #2c3e50;
      padding: 20px;
      margin: 20px 0;
    }

    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #ddd;
    }

    .financial-row:last-child {
      border-bottom: none;
    }

    .financial-row.total {
      font-weight: bold;
      font-size: 13pt;
      background: #2c3e50;
      color: #fff;
      margin: 15px -20px -20px;
      padding: 15px 20px;
    }

    .financial-row .label {
      color: #555;
    }

    .financial-row .value {
      font-weight: 600;
    }

    .tva-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      margin: 15px 0;
    }

    .tva-title {
      font-weight: bold;
      color: #856404;
      margin-bottom: 10px;
    }

    .indexation-box {
      background: #d4edda;
      border: 1px solid #28a745;
      padding: 15px;
      margin: 15px 0;
    }

    .indexation-title {
      font-weight: bold;
      color: #155724;
      margin-bottom: 10px;
    }

    .destination-box {
      background: #e3f2fd;
      border: 2px solid #2196f3;
      padding: 20px;
      margin: 15px 0;
    }

    .destination-title {
      font-weight: bold;
      color: #1565c0;
      margin-bottom: 10px;
      font-size: 12pt;
    }

    .clause-importante {
      background: #ffebee;
      border-left: 4px solid #f44336;
      padding: 15px;
      margin: 15px 0;
    }

    .clause-importante-title {
      font-weight: bold;
      color: #c62828;
      margin-bottom: 8px;
    }

    .pas-de-porte-box {
      background: #fff8e1;
      border: 2px solid #ff8f00;
      padding: 20px;
      margin: 15px 0;
    }

    .pas-de-porte-title {
      font-weight: bold;
      color: #e65100;
      margin-bottom: 10px;
      font-size: 12pt;
    }

    .charges-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }

    .charges-table th,
    .charges-table td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }

    .charges-table th {
      background: #f0f0f0;
    }

    .charges-table .bailleur {
      background: #e3f2fd;
    }

    .charges-table .preneur {
      background: #e8f5e9;
    }

    .triennal-timeline {
      display: flex;
      justify-content: space-between;
      margin: 20px 0;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 5px;
    }

    .triennal-period {
      text-align: center;
      flex: 1;
      padding: 10px;
      border-right: 2px dashed #999;
    }

    .triennal-period:last-child {
      border-right: none;
    }

    .triennal-year {
      font-size: 14pt;
      font-weight: bold;
      color: #2980b9;
    }

    .triennal-label {
      font-size: 9pt;
      color: #666;
    }

    .triennal-date {
      font-size: 10pt;
      margin-top: 5px;
    }

    .signature-section {
      margin-top: 40px;
      page-break-inside: avoid;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
      margin-top: 20px;
    }

    .signature-box {
      border: 1px solid #bdc3c7;
      padding: 20px;
      min-height: 150px;
    }

    .signature-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: #2c3e50;
    }

    .signature-line {
      border-bottom: 1px solid #000;
      margin: 10px 0;
      min-height: 40px;
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

    .annexes-list {
      list-style: none;
      padding: 0;
    }

    .annexes-list li {
      padding: 10px 0;
      border-bottom: 1px dashed #ddd;
      display: flex;
      align-items: center;
    }

    .annexes-list li::before {
      content: '☐';
      margin-right: 10px;
      font-size: 14pt;
    }

    .annexes-list li.checked::before {
      content: '☑';
      color: #28a745;
    }

    .page-break {
      page-break-before: always;
    }

    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #2c3e50;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }

    .warning-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 10px 15px;
      margin: 10px 0;
      font-size: 10pt;
    }

    .warning-box::before {
      content: '⚠️ ';
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
      <div class="subtitle">Bail Commercial dit "3-6-9"</div>
      <div class="reference">Référence : {{REFERENCE_BAIL}}</div>
    </div>

    <div class="legal-notice">
      <strong>Code de commerce - Articles L145-1 à L145-60</strong><br>
      Statut des baux commerciaux - Décret n°53-960 du 30 septembre 1953<br>
      <em>Modifié par la loi Pinel n°2014-626 du 18 juin 2014</em>
    </div>

    <!-- I. DÉSIGNATION DES PARTIES -->
    <div class="section">
      <div class="section-title">I. Désignation des Parties</div>
      <div class="section-content">
        <div class="parties-grid">
          <!-- Bailleur -->
          <div class="party-box">
            <div class="party-title">LE BAILLEUR</div>
            {{#if BAILLEUR_IS_SOCIETE}}
            <div class="party-info">
              <span class="party-label">Dénomination sociale :</span><br>
              <span class="party-value">{{BAILLEUR_RAISON_SOCIALE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Forme juridique :</span><br>
              <span class="party-value">{{BAILLEUR_FORME_JURIDIQUE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Capital social :</span><br>
              <span class="party-value">{{BAILLEUR_CAPITAL_SOCIAL}} €</span>
            </div>
            <div class="party-info">
              <span class="party-label">SIRET :</span><br>
              <span class="party-value">{{BAILLEUR_SIRET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">RCS :</span><br>
              <span class="party-value">{{BAILLEUR_RCS}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Représentée par :</span><br>
              <span class="party-value">{{BAILLEUR_REPRESENTANT}}, {{BAILLEUR_REPRESENTANT_QUALITE}}</span>
            </div>
            {{else}}
            <div class="party-info">
              <span class="party-label">Nom et prénom :</span><br>
              <span class="party-value">{{BAILLEUR_NOM_COMPLET}}</span>
            </div>
            {{#if BAILLEUR_DATE_NAISSANCE}}
            <div class="party-info">
              <span class="party-label">Né(e) le :</span><br>
              <span class="party-value">{{BAILLEUR_DATE_NAISSANCE}} à {{BAILLEUR_LIEU_NAISSANCE}}</span>
            </div>
            {{/if}}
            {{/if}}
            <div class="party-info">
              <span class="party-label">Adresse du siège / domicile :</span><br>
              <span class="party-value">{{BAILLEUR_ADRESSE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">N° TVA intracommunautaire :</span><br>
              <span class="party-value">{{BAILLEUR_TVA_INTRA}}</span>
            </div>
          </div>

          <!-- Preneur -->
          <div class="party-box">
            <div class="party-title">LE PRENEUR</div>
            {{#if PRENEUR_IS_SOCIETE}}
            <div class="party-info">
              <span class="party-label">Dénomination sociale :</span><br>
              <span class="party-value">{{PRENEUR_RAISON_SOCIALE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Forme juridique :</span><br>
              <span class="party-value">{{PRENEUR_FORME_JURIDIQUE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Capital social :</span><br>
              <span class="party-value">{{PRENEUR_CAPITAL_SOCIAL}} €</span>
            </div>
            <div class="party-info">
              <span class="party-label">SIRET :</span><br>
              <span class="party-value">{{PRENEUR_SIRET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">RCS :</span><br>
              <span class="party-value">{{PRENEUR_RCS}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Représentée par :</span><br>
              <span class="party-value">{{PRENEUR_REPRESENTANT}}, {{PRENEUR_REPRESENTANT_QUALITE}}</span>
            </div>
            {{else}}
            <div class="party-info">
              <span class="party-label">Nom et prénom :</span><br>
              <span class="party-value">{{PRENEUR_NOM_COMPLET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Né(e) le :</span><br>
              <span class="party-value">{{PRENEUR_DATE_NAISSANCE}} à {{PRENEUR_LIEU_NAISSANCE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Immatriculé au RCS de :</span><br>
              <span class="party-value">{{PRENEUR_RCS}}</span>
            </div>
            {{/if}}
            <div class="party-info">
              <span class="party-label">Adresse du siège / domicile :</span><br>
              <span class="party-value">{{PRENEUR_ADRESSE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">N° TVA intracommunautaire :</span><br>
              <span class="party-value">{{PRENEUR_TVA_INTRA}}</span>
            </div>
          </div>
        </div>

        <p class="article-content">
          <strong>Ci-après dénommés respectivement "le Bailleur" et "le Preneur".</strong>
        </p>
      </div>
    </div>

    <!-- II. DÉSIGNATION DES LOCAUX -->
    <div class="section">
      <div class="section-title">II. Désignation des Locaux</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 1 - Description des locaux</div>

          <table class="info-table">
            <tr>
              <th>Adresse des locaux</th>
              <td>{{LOCAUX_ADRESSE}}<br>{{LOCAUX_CODE_POSTAL}} {{LOCAUX_VILLE}}</td>
            </tr>
            <tr>
              <th>Nature des locaux</th>
              <td>{{LOCAUX_NATURE}}</td>
            </tr>
            <tr>
              <th>Surface totale</th>
              <td><strong>{{LOCAUX_SURFACE}} m²</strong></td>
            </tr>
            {{#if LOCAUX_SURFACE_VENTE}}
            <tr>
              <th>Dont surface de vente</th>
              <td>{{LOCAUX_SURFACE_VENTE}} m²</td>
            </tr>
            {{/if}}
            {{#if LOCAUX_SURFACE_RESERVE}}
            <tr>
              <th>Dont réserves/stockage</th>
              <td>{{LOCAUX_SURFACE_RESERVE}} m²</td>
            </tr>
            {{/if}}
            {{#if LOCAUX_SURFACE_BUREAUX}}
            <tr>
              <th>Dont bureaux</th>
              <td>{{LOCAUX_SURFACE_BUREAUX}} m²</td>
            </tr>
            {{/if}}
            <tr>
              <th>Étage / Niveau</th>
              <td>{{LOCAUX_ETAGE}}</td>
            </tr>
            <tr>
              <th>Lot de copropriété</th>
              <td>{{LOCAUX_LOT_COPRO}}</td>
            </tr>
            <tr>
              <th>Référence cadastrale</th>
              <td>Section {{CADASTRE_SECTION}} - Parcelle {{CADASTRE_PARCELLE}}</td>
            </tr>
          </table>
        </div>

        <div class="article">
          <div class="article-title">Article 2 - Accessoires et dépendances</div>
          <p class="article-content">
            {{#if LOCAUX_ACCESSOIRES}}
            Les accessoires et dépendances suivants sont compris dans la location :<br>
            {{LOCAUX_ACCESSOIRES}}
            {{else}}
            Aucun accessoire ou dépendance n'est compris dans la présente location.
            {{/if}}
          </p>

          {{#if PARKING_INCLUS}}
          <table class="info-table" style="margin-top: 15px;">
            <tr>
              <th>Emplacements de parking</th>
              <td>{{PARKING_NB}} emplacement(s) - {{PARKING_DESCRIPTION}}</td>
            </tr>
          </table>
          {{/if}}
        </div>
      </div>
    </div>

    <!-- III. DESTINATION DES LOCAUX -->
    <div class="section">
      <div class="section-title">III. Destination des Locaux</div>
      <div class="section-content">
        <div class="destination-box">
          <div class="destination-title">Clause de destination (Article L145-47 Code de commerce)</div>

          <div class="article">
            <div class="article-title">Article 3 - Activité autorisée</div>
            <p class="article-content">
              <strong>Activité principale :</strong><br>
              {{ACTIVITE_PRINCIPALE}}
            </p>

            {{#if ACTIVITES_CONNEXES}}
            <p class="article-content" style="margin-top: 10px;">
              <strong>Activités connexes ou complémentaires autorisées :</strong><br>
              {{ACTIVITES_CONNEXES}}
            </p>
            {{/if}}

            {{#if CLAUSE_TOUS_COMMERCES}}
            <div class="warning-box">
              <strong>Clause "tous commerces" :</strong> Le Preneur est autorisé à exercer toute activité
              commerciale, industrielle ou artisanale licite dans les locaux loués, sous réserve des
              dispositions du règlement de copropriété et de la réglementation applicable.
            </div>
            {{/if}}
          </div>

          <div class="article">
            <div class="article-title">Article 4 - Déspécialisation</div>
            <p class="article-content">
              {{#if DESPECIALISATION_PARTIELLE_AUTORISEE}}
              <strong>Déspécialisation partielle (art. L145-47) :</strong> Le Preneur pourra adjoindre
              des activités connexes ou complémentaires à l'activité prévue au bail, en respectant
              la procédure légale d'information du Bailleur.
              {{else}}
              La déspécialisation partielle est soumise à l'accord préalable et écrit du Bailleur.
              {{/if}}
              <br><br>
              <strong>Déspécialisation plénière (art. L145-48 à L145-55) :</strong> Toute transformation
              totale de l'activité nécessitera l'accord exprès du Bailleur ou l'autorisation judiciaire,
              et pourra donner lieu au versement d'une indemnité.
            </p>
          </div>
        </div>

        {{#if CODE_APE}}
        <table class="info-table">
          <tr>
            <th>Code APE/NAF de l'activité</th>
            <td>{{CODE_APE}} - {{LIBELLE_APE}}</td>
          </tr>
        </table>
        {{/if}}
      </div>
    </div>

    <!-- IV. DURÉE DU BAIL -->
    <div class="section page-break">
      <div class="section-title">IV. Durée du Bail</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 5 - Durée et périodes triennales</div>

          <table class="info-table">
            <tr>
              <th>Durée totale du bail</th>
              <td><strong>{{BAIL_DUREE_ANNEES}} ans ({{BAIL_DUREE_MOIS}} mois)</strong></td>
            </tr>
            <tr>
              <th>Date de prise d'effet</th>
              <td><strong>{{BAIL_DATE_DEBUT}}</strong></td>
            </tr>
            <tr>
              <th>Date d'expiration</th>
              <td><strong>{{BAIL_DATE_FIN}}</strong></td>
            </tr>
          </table>

          <div class="triennal-timeline">
            <div class="triennal-period">
              <div class="triennal-label">1ère période</div>
              <div class="triennal-year">Années 1-3</div>
              <div class="triennal-date">{{TRIENNAL_1_DEBUT}} → {{TRIENNAL_1_FIN}}</div>
            </div>
            <div class="triennal-period">
              <div class="triennal-label">2ème période</div>
              <div class="triennal-year">Années 4-6</div>
              <div class="triennal-date">{{TRIENNAL_2_DEBUT}} → {{TRIENNAL_2_FIN}}</div>
            </div>
            <div class="triennal-period">
              <div class="triennal-label">3ème période</div>
              <div class="triennal-year">Années 7-9</div>
              <div class="triennal-date">{{TRIENNAL_3_DEBUT}} → {{TRIENNAL_3_FIN}}</div>
            </div>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 6 - Résiliation triennale</div>
          <p class="article-content">
            Conformément à l'article L145-4 du Code de commerce, le Preneur a la faculté de donner
            congé à l'expiration de chaque période triennale, par acte extrajudiciaire (huissier),
            en respectant un préavis de <strong>six mois</strong> avant la fin de la période.
          </p>

          <table class="info-table" style="margin-top: 15px;">
            <tr>
              <th>1ère possibilité de résiliation</th>
              <td>Congé avant le {{RESILIATION_1_LIMITE}} pour effet au {{TRIENNAL_1_FIN}}</td>
            </tr>
            <tr>
              <th>2ème possibilité de résiliation</th>
              <td>Congé avant le {{RESILIATION_2_LIMITE}} pour effet au {{TRIENNAL_2_FIN}}</td>
            </tr>
            <tr>
              <th>Fin du bail</th>
              <td>Congé avant le {{RESILIATION_3_LIMITE}} pour effet au {{BAIL_DATE_FIN}}</td>
            </tr>
          </table>

          {{#if RENONCIATION_TRIENNALE}}
          <div class="clause-importante">
            <div class="clause-importante-title">Renonciation à la faculté de résiliation triennale</div>
            <p>
              Conformément aux dispositions de l'article L145-4 alinéa 2 du Code de commerce,
              les parties conviennent expressément que le Preneur renonce à sa faculté de donner
              congé à l'expiration des deux premières périodes triennales.
              <br><br>
              <em>Motif : {{RENONCIATION_MOTIF}}</em>
            </p>
          </div>
          {{/if}}
        </div>

        <div class="article">
          <div class="article-title">Article 7 - Droit au renouvellement</div>
          <p class="article-content">
            À l'expiration du bail, le Preneur bénéficie d'un droit au renouvellement conformément
            aux articles L145-8 à L145-30 du Code de commerce, sous réserve de remplir les conditions légales.
            <br><br>
            En cas de refus de renouvellement sans motif grave et légitime, le Bailleur sera tenu
            de verser au Preneur une <strong>indemnité d'éviction</strong> destinée à réparer le préjudice
            causé par le défaut de renouvellement.
          </p>
        </div>
      </div>
    </div>

    <!-- V. CONDITIONS FINANCIÈRES -->
    <div class="section">
      <div class="section-title">V. Conditions Financières</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 8 - Loyer</div>

          <div class="financial-summary">
            <div class="financial-row">
              <span class="label">Loyer annuel hors taxes</span>
              <span class="value"><strong>{{LOYER_ANNUEL_HT}} € HT</strong></span>
            </div>
            <div class="financial-row">
              <span class="label">Soit par mois hors taxes</span>
              <span class="value">{{LOYER_MENSUEL_HT}} € HT</span>
            </div>
            {{#if TVA_SUR_LOYER}}
            <div class="financial-row">
              <span class="label">TVA ({{TVA_TAUX}}%)</span>
              <span class="value">{{LOYER_TVA_ANNUEL}} € / an</span>
            </div>
            <div class="financial-row">
              <span class="label">Loyer annuel TTC</span>
              <span class="value">{{LOYER_ANNUEL_TTC}} € TTC</span>
            </div>
            {{/if}}
            <div class="financial-row">
              <span class="label">Provision pour charges</span>
              <span class="value">{{CHARGES_PROVISION}} € / {{CHARGES_PERIODICITE}}</span>
            </div>
            <div class="financial-row total">
              <span>TOTAL {{TERME_PAIEMENT}}</span>
              <span>{{TOTAL_MENSUEL}} € {{#if TVA_SUR_LOYER}}TTC{{else}}HT{{/if}}</span>
            </div>
          </div>

          <p class="article-content">
            Soit en toutes lettres : <strong>{{LOYER_ANNUEL_LETTRES}}</strong> par an hors taxes.
          </p>

          <table class="info-table" style="margin-top: 15px;">
            <tr>
              <th>Loyer au m²/an</th>
              <td>{{LOYER_M2_ANNUEL}} € HT/m²/an</td>
            </tr>
            <tr>
              <th>Périodicité du paiement</th>
              <td>{{PERIODICITE_PAIEMENT}}</td>
            </tr>
            <tr>
              <th>Terme du paiement</th>
              <td>{{TERME_PAIEMENT}}</td>
            </tr>
            <tr>
              <th>Mode de paiement</th>
              <td>{{MODE_PAIEMENT}}</td>
            </tr>
          </table>
        </div>

        {{#if TVA_SUR_LOYER}}
        <div class="tva-box">
          <div class="tva-title">Option pour l'assujettissement à la TVA</div>
          <p>
            Le Bailleur a opté pour l'assujettissement des loyers à la TVA conformément à l'article
            260-2° du Code général des impôts. Le Preneur s'engage à maintenir son activité soumise
            à la TVA pendant toute la durée du bail.
            <br><br>
            <strong>Taux de TVA applicable :</strong> {{TVA_TAUX}}%
          </p>
        </div>
        {{else}}
        <div class="warning-box">
          Les loyers sont <strong>exonérés de TVA</strong>. Le Bailleur n'a pas opté pour l'assujettissement
          des loyers à la taxe sur la valeur ajoutée.
        </div>
        {{/if}}

        <div class="article">
          <div class="article-title">Article 9 - Indexation du loyer</div>

          <div class="indexation-box">
            <div class="indexation-title">Clause d'indexation (Article L145-38 et L145-39 Code de commerce)</div>
            <p>
              Le loyer sera révisé automatiquement chaque année à la date anniversaire du bail,
              en fonction de la variation de l'indice suivant :
            </p>

            <table class="info-table" style="margin-top: 15px;">
              <tr>
                <th>Indice de référence</th>
                <td><strong>{{INDICE_TYPE}}</strong> ({{INDICE_NOM_COMPLET}})</td>
              </tr>
              <tr>
                <th>Indice de base</th>
                <td>{{INDICE_BASE}} ({{INDICE_TRIMESTRE_BASE}})</td>
              </tr>
              <tr>
                <th>Date de révision</th>
                <td>{{DATE_REVISION_ANNUELLE}}</td>
              </tr>
            </table>

            <p style="margin-top: 15px; font-size: 10pt;">
              <strong>Formule de calcul :</strong><br>
              Nouveau loyer = Loyer initial × (Nouvel indice ÷ Indice de base)
            </p>
          </div>

          {{#if PLAFONNEMENT_REVISION}}
          <div class="warning-box">
            La révision triennale du loyer est plafonnée à la variation de l'indice {{INDICE_TYPE}}
            conformément à l'article L145-34 du Code de commerce, sauf cas de déplafonnement légal.
          </div>
          {{/if}}
        </div>

        {{#if PAS_DE_PORTE}}
        <div class="pas-de-porte-box">
          <div class="pas-de-porte-title">Pas-de-porte / Droit d'entrée</div>
          <table class="info-table">
            <tr>
              <th>Montant du pas-de-porte</th>
              <td><strong>{{PAS_DE_PORTE_MONTANT}} € HT</strong></td>
            </tr>
            <tr>
              <th>Nature fiscale</th>
              <td>{{PAS_DE_PORTE_NATURE}}</td>
            </tr>
            {{#if PAS_DE_PORTE_TVA}}
            <tr>
              <th>TVA applicable</th>
              <td>{{PAS_DE_PORTE_TVA}} €</td>
            </tr>
            {{/if}}
            <tr>
              <th>Modalités de paiement</th>
              <td>{{PAS_DE_PORTE_MODALITES}}</td>
            </tr>
          </table>
          <p style="font-size: 9pt; margin-top: 10px; font-style: italic;">
            {{#if PAS_DE_PORTE_SUPPLEMENT_LOYER}}
            Ce pas-de-porte a la nature d'un supplément de loyer et sera pris en compte pour
            le calcul du loyer de renouvellement.
            {{else}}
            Ce pas-de-porte a la nature d'une indemnité compensant des avantages commerciaux
            et ne sera pas pris en compte pour le calcul du loyer de renouvellement.
            {{/if}}
          </p>
        </div>
        {{/if}}

        <div class="article">
          <div class="article-title">Article 10 - Dépôt de garantie</div>
          <table class="info-table">
            <tr>
              <th>Montant du dépôt de garantie</th>
              <td><strong>{{DEPOT_GARANTIE}} € {{#if TVA_SUR_LOYER}}TTC{{else}}HT{{/if}}</strong></td>
            </tr>
            <tr>
              <th>Équivalent en mois de loyer</th>
              <td>{{DEPOT_NB_MOIS}} mois</td>
            </tr>
            <tr>
              <th>Conditions de restitution</th>
              <td>Dans les 2 mois suivant la restitution des locaux, déduction faite des sommes dues</td>
            </tr>
          </table>

          {{#if DEPOT_INDEXE}}
          <p class="article-content" style="margin-top: 10px;">
            Le dépôt de garantie sera réajusté à chaque révision du loyer, proportionnellement
            à l'augmentation du loyer.
          </p>
          {{/if}}
        </div>
      </div>
    </div>

    <!-- VI. CHARGES ET TAXES -->
    <div class="section page-break">
      <div class="section-title">VI. Charges, Taxes et Répartition</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 11 - Répartition des charges (Loi Pinel)</div>
          <p class="article-content" style="margin-bottom: 15px;">
            Conformément aux articles L145-40-2 et R145-35 du Code de commerce (issus de la loi Pinel),
            les charges sont réparties comme suit entre le Bailleur et le Preneur :
          </p>

          <table class="charges-table">
            <thead>
              <tr>
                <th>Nature de la charge</th>
                <th>Bailleur</th>
                <th>Preneur</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Taxe foncière</td>
                <td class="bailleur">{{#if TF_BAILLEUR}}✓{{/if}}</td>
                <td class="preneur">{{#if TF_PRENEUR}}✓{{/if}}</td>
              </tr>
              <tr>
                <td>Taxe sur les bureaux (si applicable)</td>
                <td class="bailleur">{{#if TSB_BAILLEUR}}✓{{/if}}</td>
                <td class="preneur">{{#if TSB_PRENEUR}}✓{{/if}}</td>
              </tr>
              <tr>
                <td>Charges de copropriété - Fonctionnement</td>
                <td class="bailleur">{{#if COPRO_FONCT_BAILLEUR}}✓{{/if}}</td>
                <td class="preneur">{{#if COPRO_FONCT_PRENEUR}}✓{{/if}}</td>
              </tr>
              <tr>
                <td>Charges de copropriété - Gros travaux (art. 606)</td>
                <td class="bailleur">✓</td>
                <td class="preneur"></td>
              </tr>
              <tr>
                <td>Assurance propriétaire non occupant</td>
                <td class="bailleur">✓</td>
                <td class="preneur"></td>
              </tr>
              <tr>
                <td>Assurance multirisque locaux</td>
                <td class="bailleur"></td>
                <td class="preneur">✓</td>
              </tr>
              <tr>
                <td>Honoraires de gestion</td>
                <td class="bailleur">✓</td>
                <td class="preneur"></td>
              </tr>
              <tr>
                <td>Entretien courant des locaux</td>
                <td class="bailleur"></td>
                <td class="preneur">✓</td>
              </tr>
              <tr>
                <td>Remplacement équipements vétustes</td>
                <td class="bailleur">✓</td>
                <td class="preneur"></td>
              </tr>
            </tbody>
          </table>

          <div class="warning-box" style="margin-top: 15px;">
            <strong>Charges non récupérables sur le Preneur (Loi Pinel) :</strong>
            <ul style="margin: 10px 0 0 20px;">
              <li>Gros travaux (article 606 du Code civil)</li>
              <li>Travaux de mise en conformité ou de mise aux normes</li>
              <li>Honoraires de gestion locative</li>
              <li>Impôts et taxes liés à la propriété (sauf si stipulé au bail)</li>
            </ul>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 12 - Régularisation des charges</div>
          <p class="article-content">
            Les provisions sur charges feront l'objet d'une régularisation annuelle. Le Bailleur
            communiquera au Preneur, avant le {{DATE_REGULARISATION}}, un récapitulatif des
            charges avec les justificatifs correspondants.
          </p>
        </div>
      </div>
    </div>

    <!-- VII. CLAUSE RÉSOLUTOIRE -->
    <div class="section">
      <div class="section-title">VII. Clause Résolutoire</div>
      <div class="section-content">
        <div class="clause-importante">
          <div class="clause-importante-title">Article 13 - Clause résolutoire (Article L145-41 Code de commerce)</div>
          <p>
            Le présent bail sera résilié de plein droit, si bon semble au Bailleur, <strong>un mois</strong>
            après un commandement de payer demeuré infructueux et contenant déclaration par le Bailleur
            de son intention d'user du bénéfice de la présente clause, dans les cas suivants :
          </p>
          <ul style="margin: 15px 0 15px 20px;">
            <li>Défaut de paiement d'un seul terme de loyer, charges ou accessoires à son échéance exacte</li>
            <li>Défaut de paiement du dépôt de garantie ou de son complément</li>
            <li>Défaut d'assurance des locaux</li>
            <li>Non-respect de la destination des locaux</li>
            <li>Sous-location ou cession non autorisée</li>
            <li>Inexécution d'une obligation du bail</li>
          </ul>
          <p style="font-style: italic; font-size: 10pt;">
            Le Preneur pourra toutefois solliciter des délais de paiement auprès du juge des référés,
            conformément à l'article L145-41 alinéa 2 du Code de commerce.
          </p>
        </div>
      </div>
    </div>

    <!-- VIII. GARANTIES -->
    <div class="section">
      <div class="section-title">VIII. Garanties</div>
      <div class="section-content">
        {{#if CAUTION_SOLIDAIRE}}
        <div class="article">
          <div class="article-title">Article 14 - Caution solidaire</div>
          <div class="party-box">
            <div class="party-title">LA CAUTION</div>
            <div class="party-info">
              <span class="party-label">{{#if CAUTION_IS_SOCIETE}}Dénomination sociale{{else}}Nom et prénom{{/if}} :</span><br>
              <span class="party-value">{{CAUTION_NOM}}</span>
            </div>
            {{#if CAUTION_IS_SOCIETE}}
            <div class="party-info">
              <span class="party-label">SIRET :</span><br>
              <span class="party-value">{{CAUTION_SIRET}}</span>
            </div>
            {{/if}}
            <div class="party-info">
              <span class="party-label">Adresse :</span><br>
              <span class="party-value">{{CAUTION_ADRESSE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Montant de l'engagement :</span><br>
              <span class="party-value">{{CAUTION_MONTANT_ENGAGEMENT}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Durée de l'engagement :</span><br>
              <span class="party-value">{{CAUTION_DUREE}}</span>
            </div>
          </div>
        </div>
        {{/if}}

        {{#if GARANTIE_BANCAIRE}}
        <div class="article">
          <div class="article-title">Article 15 - Garantie bancaire</div>
          <table class="info-table">
            <tr>
              <th>Type de garantie</th>
              <td>{{GARANTIE_BANCAIRE_TYPE}}</td>
            </tr>
            <tr>
              <th>Établissement émetteur</th>
              <td>{{GARANTIE_BANCAIRE_BANQUE}}</td>
            </tr>
            <tr>
              <th>Montant garanti</th>
              <td>{{GARANTIE_BANCAIRE_MONTANT}} €</td>
            </tr>
            <tr>
              <th>Durée de validité</th>
              <td>{{GARANTIE_BANCAIRE_DUREE}}</td>
            </tr>
          </table>
        </div>
        {{/if}}
      </div>
    </div>

    <!-- IX. CESSION ET SOUS-LOCATION -->
    <div class="section page-break">
      <div class="section-title">IX. Cession et Sous-location</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 16 - Cession du droit au bail</div>
          <p class="article-content">
            {{#if CESSION_LIBRE}}
            La cession du droit au bail est autorisée, sous réserve d'en informer le Bailleur par
            acte extrajudiciaire et de l'appeler à concourir à l'acte.
            {{else}}
            Toute cession du droit au bail est interdite, sauf cession à un acquéreur du fonds de
            commerce, conformément à l'article L145-16 du Code de commerce.
            {{/if}}
          </p>

          {{#if DROIT_PREEMPTION_BAILLEUR}}
          <div class="warning-box">
            En cas de cession du fonds de commerce ou du droit au bail, le Bailleur bénéficie d'un
            droit de préemption aux mêmes conditions que celles offertes à l'acquéreur pressenti.
          </div>
          {{/if}}
        </div>

        <div class="article">
          <div class="article-title">Article 17 - Sous-location</div>
          <p class="article-content">
            {{#if SOUS_LOCATION_AUTORISEE}}
            La sous-location totale ou partielle des locaux est autorisée avec l'accord préalable
            et écrit du Bailleur. Le Bailleur devra être appelé à concourir à l'acte (article L145-31).
            {{else}}
            La sous-location totale ou partielle des locaux est <strong>strictement interdite</strong>.
            {{/if}}
          </p>
        </div>

        <div class="article">
          <div class="article-title">Article 18 - Droit au bail</div>
          <table class="info-table">
            <tr>
              <th>Valeur estimée du droit au bail</th>
              <td>{{#if DROIT_AU_BAIL_VALEUR}}{{DROIT_AU_BAIL_VALEUR}} €{{else}}À déterminer{{/if}}</td>
            </tr>
            <tr>
              <th>Clause de garantie solidaire cédant</th>
              <td>{{#if GARANTIE_SOLIDAIRE_CEDANT}}Oui - durée : {{GARANTIE_CEDANT_DUREE}}{{else}}Non{{/if}}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>

    <!-- X. TRAVAUX ET AMÉNAGEMENTS -->
    <div class="section">
      <div class="section-title">X. Travaux et Aménagements</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 19 - État des locaux</div>
          <p class="article-content">
            Les locaux sont loués dans l'état où ils se trouvent au jour de la prise de possession,
            tel que constaté par l'état des lieux contradictoire annexé au présent bail.
            <br><br>
            {{#if LOCAUX_CONFORMES}}
            Le Preneur déclare les locaux conformes à l'activité prévue et renonce à tout recours
            contre le Bailleur à ce titre.
            {{else}}
            Le Bailleur s'engage à réaliser les travaux suivants avant la prise de possession :
            <br>{{TRAVAUX_BAILLEUR_LISTE}}
            {{/if}}
          </p>
        </div>

        <div class="article">
          <div class="article-title">Article 20 - Travaux du Preneur</div>
          <p class="article-content">
            <strong>Travaux autorisés sans accord préalable :</strong>
            <ul style="margin: 10px 0 10px 20px;">
              <li>Travaux d'aménagement intérieur non structurels</li>
              <li>Travaux d'adaptation aux normes d'accessibilité</li>
              <li>Décoration et peinture</li>
            </ul>

            <strong>Travaux nécessitant l'accord écrit du Bailleur :</strong>
            <ul style="margin: 10px 0 10px 20px;">
              <li>Travaux touchant au gros œuvre ou à la structure</li>
              <li>Modification des cloisons</li>
              <li>Installation ou modification des réseaux</li>
              <li>Création d'ouvertures ou de fermetures</li>
            </ul>
          </p>

          {{#if ACCESSION_AMELIORATIONS}}
          <div class="warning-box">
            <strong>Accession :</strong> En fin de bail, les améliorations réalisées par le Preneur
            resteront acquises au Bailleur sans indemnité, sauf accord contraire des parties.
          </div>
          {{/if}}
        </div>
      </div>
    </div>

    <!-- XI. ANNEXES -->
    <div class="section">
      <div class="section-title">XI. Documents Annexés</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 21 - Liste des annexes</div>
          <ul class="annexes-list">
            <li class="checked">État des lieux d'entrée</li>
            <li class="checked">Diagnostic de performance énergétique (DPE)</li>
            <li class="checked">État des risques et pollutions (ERP)</li>
            {{#if AMIANTE_REQUIS}}
            <li class="checked">Diagnostic amiante (DAPP)</li>
            {{/if}}
            {{#if COPROPRIETE}}
            <li class="checked">Extraits du règlement de copropriété</li>
            {{/if}}
            <li class="checked">Plan des locaux</li>
            <li class="checked">Inventaire du matériel et équipements (si applicable)</li>
            {{#if CAUTION_SOLIDAIRE}}
            <li class="checked">Acte de cautionnement</li>
            {{/if}}
            {{#if GARANTIE_BANCAIRE}}
            <li class="checked">Garantie bancaire à première demande</li>
            {{/if}}
            <li class="checked">Kbis du Preneur (moins de 3 mois)</li>
            <li class="checked">Attestation d'assurance du Preneur</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- XII. SIGNATURES -->
    <div class="section signature-section">
      <div class="section-title">XII. Signatures des Parties</div>
      <div class="section-content">
        <p class="article-content">
          Fait à <strong>{{LIEU_SIGNATURE}}</strong>, le <strong>{{DATE_SIGNATURE}}</strong>,<br>
          en {{NB_EXEMPLAIRES}} exemplaires originaux, chaque partie reconnaissant en avoir reçu un.
        </p>

        <p class="article-content" style="margin: 20px 0; font-style: italic; font-size: 10pt;">
          Les parties déclarent avoir pris connaissance de l'ensemble des clauses du présent bail,
          de ses annexes, ainsi que des dispositions légales applicables aux baux commerciaux.
          Elles reconnaissent en avoir parfaitement compris la portée et les conséquences juridiques.
        </p>

        <div class="signature-grid">
          <div class="signature-box">
            <div class="signature-title">Le Bailleur</div>
            <p class="signature-mention">
              Signature précédée de la mention manuscrite<br>
              "Lu et approuvé, bon pour accord"
            </p>
            {{#if BAILLEUR_SIGNATURE_IMAGE}}
            <img src="{{BAILLEUR_SIGNATURE_IMAGE}}" alt="Signature bailleur" class="signature-image" />
            <p class="signature-date">Signé électroniquement le {{BAILLEUR_DATE_SIGNATURE}}</p>
            {{else}}
            <div class="signature-line"></div>
            {{/if}}
            <p style="font-size: 9pt;">{{BAILLEUR_NOM_COMPLET}}</p>
          </div>

          <div class="signature-box">
            <div class="signature-title">Le Preneur</div>
            <p class="signature-mention">
              Signature précédée de la mention manuscrite<br>
              "Lu et approuvé, bon pour accord"
            </p>
            {{#if PRENEUR_SIGNATURE_IMAGE}}
            <img src="{{PRENEUR_SIGNATURE_IMAGE}}" alt="Signature preneur" class="signature-image" />
            <p class="signature-date">Signé électroniquement le {{PRENEUR_DATE_SIGNATURE}}</p>
            {{else}}
            <div class="signature-line"></div>
            {{/if}}
            <p style="font-size: 9pt;">{{PRENEUR_NOM_COMPLET}}</p>
          </div>
        </div>

        {{#if CAUTION_SOLIDAIRE}}
        <div style="margin-top: 30px;">
          <div class="signature-box" style="max-width: 60%; margin: 0 auto;">
            <div class="signature-title">La Caution solidaire</div>
            <p class="signature-mention">
              Signature précédée de la mention manuscrite :<br>
              "Bon pour caution solidaire et indivisible du Preneur {{PRENEUR_NOM_COMPLET}}
              pour le paiement des loyers, charges et accessoires du présent bail, dans la limite
              de {{CAUTION_MONTANT_ENGAGEMENT}}, pour une durée de {{CAUTION_DUREE}}."
            </p>
            {{#if CAUTION_SIGNATURE_IMAGE}}
            <img src="{{CAUTION_SIGNATURE_IMAGE}}" alt="Signature caution" class="signature-image" />
            <p class="signature-date">Signé électroniquement le {{CAUTION_DATE_SIGNATURE}}</p>
            {{else}}
            <div class="signature-line"></div>
            {{/if}}
            <p style="font-size: 9pt;">{{CAUTION_NOM}}</p>
          </div>
        </div>
        {{/if}}
      </div>
    </div>

    <div class="footer">
      <p><strong>Bail commercial 3/6/9</strong> - Code de commerce, Articles L145-1 à L145-60</p>
      <p>Document généré le {{DATE_GENERATION}} - Référence : {{REFERENCE_BAIL}}</p>
    </div>
  </div>

  <!-- Page Certificat de Signature (si signé électroniquement) -->
  {{#if IS_SIGNED}}
  <div class="page" style="page-break-before: always; padding: 20mm;">
    <div class="header">
      <h1>CERTIFICAT DE SIGNATURE ÉLECTRONIQUE</h1>
      <div class="subtitle">Dossier de Preuve Numérique</div>
    </div>

    <div class="section">
      <div class="section-title">Validité Juridique</div>
      <div class="section-content">
        <p style="font-size: 10pt; color: #333; line-height: 1.6; text-align: justify; margin-bottom: 20px;">
          Ce document a été signé électroniquement conformément aux dispositions de l'article 1367
          du Code Civil français et du règlement européen eIDAS n°910/2014. L'intégrité du document
          et l'identité des signataires sont garanties par un horodatage cryptographique et une
          empreinte numérique (Hash) unique.
        </p>
      </div>
    </div>

    {{CERTIFICATE_HTML}}

    <div class="footer" style="margin-top: 50px;">
      <p><strong>Note technique :</strong> L'empreinte numérique SHA-256 garantit que le contenu
      du document n'a pas été modifié depuis sa signature.</p>
    </div>
  </div>
  {{/if}}
</body>
</html>
`;

// Variables disponibles pour le template bail commercial
export const BAIL_COMMERCIAL_VARIABLES = [
  // Système
  'DOCUMENT_TITLE',
  'REFERENCE_BAIL',
  'DATE_GENERATION',
  'DATE_SIGNATURE',
  'LIEU_SIGNATURE',
  'NB_EXEMPLAIRES',
  'IS_SIGNED',
  'CERTIFICATE_HTML',

  // Bailleur
  'BAILLEUR_IS_SOCIETE',
  'BAILLEUR_NOM_COMPLET',
  'BAILLEUR_RAISON_SOCIALE',
  'BAILLEUR_FORME_JURIDIQUE',
  'BAILLEUR_CAPITAL_SOCIAL',
  'BAILLEUR_SIRET',
  'BAILLEUR_RCS',
  'BAILLEUR_ADRESSE',
  'BAILLEUR_TVA_INTRA',
  'BAILLEUR_REPRESENTANT',
  'BAILLEUR_REPRESENTANT_QUALITE',
  'BAILLEUR_DATE_NAISSANCE',
  'BAILLEUR_LIEU_NAISSANCE',
  'BAILLEUR_SIGNATURE_IMAGE',
  'BAILLEUR_DATE_SIGNATURE',

  // Preneur
  'PRENEUR_IS_SOCIETE',
  'PRENEUR_NOM_COMPLET',
  'PRENEUR_RAISON_SOCIALE',
  'PRENEUR_FORME_JURIDIQUE',
  'PRENEUR_CAPITAL_SOCIAL',
  'PRENEUR_SIRET',
  'PRENEUR_RCS',
  'PRENEUR_ADRESSE',
  'PRENEUR_TVA_INTRA',
  'PRENEUR_REPRESENTANT',
  'PRENEUR_REPRESENTANT_QUALITE',
  'PRENEUR_DATE_NAISSANCE',
  'PRENEUR_LIEU_NAISSANCE',
  'PRENEUR_SIGNATURE_IMAGE',
  'PRENEUR_DATE_SIGNATURE',

  // Locaux
  'LOCAUX_ADRESSE',
  'LOCAUX_CODE_POSTAL',
  'LOCAUX_VILLE',
  'LOCAUX_NATURE',
  'LOCAUX_SURFACE',
  'LOCAUX_SURFACE_VENTE',
  'LOCAUX_SURFACE_RESERVE',
  'LOCAUX_SURFACE_BUREAUX',
  'LOCAUX_ETAGE',
  'LOCAUX_LOT_COPRO',
  'CADASTRE_SECTION',
  'CADASTRE_PARCELLE',
  'LOCAUX_ACCESSOIRES',
  'PARKING_INCLUS',
  'PARKING_NB',
  'PARKING_DESCRIPTION',

  // Destination
  'ACTIVITE_PRINCIPALE',
  'ACTIVITES_CONNEXES',
  'CLAUSE_TOUS_COMMERCES',
  'DESPECIALISATION_PARTIELLE_AUTORISEE',
  'CODE_APE',
  'LIBELLE_APE',

  // Durée et périodes triennales
  'BAIL_DUREE_ANNEES',
  'BAIL_DUREE_MOIS',
  'BAIL_DATE_DEBUT',
  'BAIL_DATE_FIN',
  'TRIENNAL_1_DEBUT',
  'TRIENNAL_1_FIN',
  'TRIENNAL_2_DEBUT',
  'TRIENNAL_2_FIN',
  'TRIENNAL_3_DEBUT',
  'TRIENNAL_3_FIN',
  'RESILIATION_1_LIMITE',
  'RESILIATION_2_LIMITE',
  'RESILIATION_3_LIMITE',
  'RENONCIATION_TRIENNALE',
  'RENONCIATION_MOTIF',

  // Financier
  'LOYER_ANNUEL_HT',
  'LOYER_MENSUEL_HT',
  'LOYER_ANNUEL_LETTRES',
  'LOYER_M2_ANNUEL',
  'TVA_SUR_LOYER',
  'TVA_TAUX',
  'LOYER_TVA_ANNUEL',
  'LOYER_ANNUEL_TTC',
  'CHARGES_PROVISION',
  'CHARGES_PERIODICITE',
  'TOTAL_MENSUEL',
  'PERIODICITE_PAIEMENT',
  'TERME_PAIEMENT',
  'MODE_PAIEMENT',

  // Indexation
  'INDICE_TYPE',
  'INDICE_NOM_COMPLET',
  'INDICE_BASE',
  'INDICE_TRIMESTRE_BASE',
  'DATE_REVISION_ANNUELLE',
  'PLAFONNEMENT_REVISION',

  // Pas-de-porte
  'PAS_DE_PORTE',
  'PAS_DE_PORTE_MONTANT',
  'PAS_DE_PORTE_NATURE',
  'PAS_DE_PORTE_TVA',
  'PAS_DE_PORTE_MODALITES',
  'PAS_DE_PORTE_SUPPLEMENT_LOYER',

  // Dépôt de garantie
  'DEPOT_GARANTIE',
  'DEPOT_NB_MOIS',
  'DEPOT_INDEXE',

  // Charges et taxes
  'TF_BAILLEUR',
  'TF_PRENEUR',
  'TSB_BAILLEUR',
  'TSB_PRENEUR',
  'COPRO_FONCT_BAILLEUR',
  'COPRO_FONCT_PRENEUR',
  'DATE_REGULARISATION',

  // Garanties
  'CAUTION_SOLIDAIRE',
  'CAUTION_IS_SOCIETE',
  'CAUTION_NOM',
  'CAUTION_SIRET',
  'CAUTION_ADRESSE',
  'CAUTION_MONTANT_ENGAGEMENT',
  'CAUTION_DUREE',
  'CAUTION_SIGNATURE_IMAGE',
  'CAUTION_DATE_SIGNATURE',
  'GARANTIE_BANCAIRE',
  'GARANTIE_BANCAIRE_TYPE',
  'GARANTIE_BANCAIRE_BANQUE',
  'GARANTIE_BANCAIRE_MONTANT',
  'GARANTIE_BANCAIRE_DUREE',

  // Cession et sous-location
  'CESSION_LIBRE',
  'DROIT_PREEMPTION_BAILLEUR',
  'SOUS_LOCATION_AUTORISEE',
  'DROIT_AU_BAIL_VALEUR',
  'GARANTIE_SOLIDAIRE_CEDANT',
  'GARANTIE_CEDANT_DUREE',

  // Travaux
  'LOCAUX_CONFORMES',
  'TRAVAUX_BAILLEUR_LISTE',
  'ACCESSION_AMELIORATIONS',

  // Diagnostics
  'AMIANTE_REQUIS',
  'COPROPRIETE',
];

export default BAIL_COMMERCIAL_TEMPLATE;
