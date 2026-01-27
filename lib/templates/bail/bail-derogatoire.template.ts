/**
 * Template de bail commercial dérogatoire (bail précaire)
 * Conforme à l'article L145-5 du Code de commerce
 *
 * Durée : 3 ans maximum (cumul de tous baux successifs)
 * Pas de droit au renouvellement
 * Pas d'indemnité d'éviction
 */

export const BAIL_DEROGATOIRE_TEMPLATE = `
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
      border-bottom: 3px double #e67e22;
    }

    .header h1 {
      font-size: 20pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
      color: #d35400;
    }

    .header .subtitle {
      font-size: 14pt;
      font-weight: normal;
      color: #e67e22;
    }

    .header .reference {
      font-size: 10pt;
      color: #666;
      margin-top: 10px;
    }

    .alerte-derogatoire {
      background: #fff3cd;
      border: 3px solid #ffc107;
      padding: 20px;
      margin-bottom: 25px;
      text-align: center;
    }

    .alerte-derogatoire h2 {
      color: #856404;
      font-size: 14pt;
      margin-bottom: 15px;
    }

    .alerte-derogatoire p {
      font-size: 11pt;
      color: #856404;
      margin-bottom: 10px;
    }

    .alerte-derogatoire .duree-max {
      font-size: 24pt;
      font-weight: bold;
      color: #d35400;
      margin: 15px 0;
    }

    .legal-notice {
      background: #e8f4f8;
      border: 2px solid #2980b9;
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
      background: #d35400;
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
      color: #d35400;
      border-left: 3px solid #e67e22;
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
      border-bottom: 2px solid #e67e22;
      color: #d35400;
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
      background: #fef5e7;
      font-weight: bold;
      width: 40%;
      color: #d35400;
    }

    .financial-summary {
      background: #fef5e7;
      border: 2px solid #d35400;
      padding: 20px;
      margin: 20px 0;
    }

    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f0d9b5;
    }

    .financial-row:last-child {
      border-bottom: none;
    }

    .financial-row.total {
      font-weight: bold;
      font-size: 13pt;
      background: #d35400;
      color: #fff;
      margin: 15px -20px -20px;
      padding: 15px 20px;
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

    .clause-essentielle {
      background: #fff8e1;
      border: 3px solid #ff8f00;
      padding: 20px;
      margin: 20px 0;
    }

    .clause-essentielle-title {
      font-weight: bold;
      color: #e65100;
      font-size: 12pt;
      margin-bottom: 15px;
      text-align: center;
      text-transform: uppercase;
    }

    .timeline-derogatoire {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 20px 0;
      padding: 20px;
      background: linear-gradient(90deg, #e8f5e9, #fff3e0, #ffebee);
      border-radius: 5px;
    }

    .timeline-point {
      text-align: center;
      flex: 1;
    }

    .timeline-date {
      font-size: 12pt;
      font-weight: bold;
      color: #d35400;
    }

    .timeline-label {
      font-size: 9pt;
      color: #666;
    }

    .timeline-arrow {
      font-size: 20pt;
      color: #bdc3c7;
    }

    .historique-baux {
      background: #f5f5f5;
      padding: 15px;
      margin: 15px 0;
      border: 1px solid #ddd;
    }

    .historique-titre {
      font-weight: bold;
      margin-bottom: 10px;
      color: #d35400;
    }

    .historique-table {
      width: 100%;
      border-collapse: collapse;
    }

    .historique-table th,
    .historique-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
      font-size: 10pt;
    }

    .historique-table th {
      background: #e0e0e0;
    }

    .historique-total {
      font-weight: bold;
      background: #fff3e0 !important;
    }

    .warning-box {
      background: #ffebee;
      border: 1px solid #f44336;
      padding: 15px;
      margin: 15px 0;
      font-size: 10pt;
    }

    .warning-box::before {
      content: '⚠️ ';
      font-size: 14pt;
    }

    .info-box {
      background: #e3f2fd;
      border: 1px solid #2196f3;
      padding: 15px;
      margin: 15px 0;
      font-size: 10pt;
    }

    .info-box::before {
      content: 'ℹ️ ';
      font-size: 14pt;
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
      color: #d35400;
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

    .signature-mention {
      font-size: 9pt;
      color: #666;
      font-style: italic;
    }

    .mention-manuscrite {
      background: #fff8e1;
      border: 2px dashed #ffc107;
      padding: 15px;
      margin: 10px 0;
      font-size: 10pt;
      font-style: italic;
    }

    .mention-manuscrite strong {
      color: #d35400;
    }

    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #d35400;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }

    .page-break {
      page-break-before: always;
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
      <div class="subtitle">Bail Commercial Dérogatoire (Bail Précaire)</div>
      <div class="reference">Référence : {{REFERENCE_BAIL}}</div>
    </div>

    <!-- ALERTE SPÉCIFIQUE BAIL DÉROGATOIRE -->
    <div class="alerte-derogatoire">
      <h2>⚠️ BAIL DE COURTE DURÉE - ARTICLE L145-5 CODE DE COMMERCE</h2>
      <p>Ce bail déroge expressément au statut des baux commerciaux.</p>
      <p>Durée maximale légale (cumul de tous baux) :</p>
      <div class="duree-max">3 ANS MAXIMUM</div>
      <p><strong>Ce bail ne confère pas de droit au renouvellement ni d'indemnité d'éviction.</strong></p>
    </div>

    <div class="legal-notice">
      <strong>Article L145-5 du Code de commerce</strong><br>
      Modifié par la loi n°2014-626 du 18 juin 2014 (Loi Pinel)<br>
      <em>Les parties peuvent, lors de l'entrée dans les lieux du preneur, déroger aux dispositions
      du statut des baux commerciaux à la condition que la durée totale du bail ou des baux
      successifs ne soit pas supérieure à trois ans.</em>
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
              <span class="party-label">SIRET :</span><br>
              <span class="party-value">{{BAILLEUR_SIRET}}</span>
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
            {{/if}}
            <div class="party-info">
              <span class="party-label">Adresse :</span><br>
              <span class="party-value">{{BAILLEUR_ADRESSE}}</span>
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
              <span class="party-label">SIRET :</span><br>
              <span class="party-value">{{PRENEUR_SIRET}}</span>
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
              <span class="party-label">Immatriculé au RCS de :</span><br>
              <span class="party-value">{{PRENEUR_RCS}}</span>
            </div>
            {{/if}}
            <div class="party-info">
              <span class="party-label">Adresse :</span><br>
              <span class="party-value">{{PRENEUR_ADRESSE}}</span>
            </div>
          </div>
        </div>
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
            <tr>
              <th>Étage / Niveau</th>
              <td>{{LOCAUX_ETAGE}}</td>
            </tr>
            {{#if LOCAUX_ACCESSOIRES}}
            <tr>
              <th>Accessoires inclus</th>
              <td>{{LOCAUX_ACCESSOIRES}}</td>
            </tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>

    <!-- III. DESTINATION -->
    <div class="section">
      <div class="section-title">III. Destination des Locaux</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 2 - Activité autorisée</div>
          <p class="article-content">
            Les locaux sont loués exclusivement pour l'exercice de l'activité suivante :<br><br>
            <strong>{{ACTIVITE_AUTORISEE}}</strong>
          </p>

          {{#if CODE_APE}}
          <table class="info-table" style="margin-top: 15px;">
            <tr>
              <th>Code APE/NAF</th>
              <td>{{CODE_APE}} - {{LIBELLE_APE}}</td>
            </tr>
          </table>
          {{/if}}

          <div class="info-box" style="margin-top: 15px;">
            Toute modification de l'activité exercée devra faire l'objet d'un accord préalable
            et écrit du Bailleur.
          </div>
        </div>
      </div>
    </div>

    <!-- IV. DURÉE - SECTION CRITIQUE -->
    <div class="section">
      <div class="section-title">IV. Durée du Bail - Dispositions Essentielles</div>
      <div class="section-content">
        <div class="clause-essentielle">
          <div class="clause-essentielle-title">
            Clause dérogatoire au statut des baux commerciaux
          </div>

          <p style="margin-bottom: 15px;">
            Les parties conviennent expressément, conformément à l'article L145-5 du Code de commerce,
            de déroger aux dispositions du statut des baux commerciaux (articles L145-1 à L145-60).
          </p>

          <table class="info-table">
            <tr>
              <th>Date de prise d'effet</th>
              <td><strong>{{BAIL_DATE_DEBUT}}</strong></td>
            </tr>
            <tr>
              <th>Date d'expiration</th>
              <td><strong>{{BAIL_DATE_FIN}}</strong></td>
            </tr>
            <tr>
              <th>Durée du présent bail</th>
              <td><strong>{{BAIL_DUREE_MOIS}} mois</strong></td>
            </tr>
          </table>

          <div class="timeline-derogatoire">
            <div class="timeline-point">
              <div class="timeline-date">{{BAIL_DATE_DEBUT}}</div>
              <div class="timeline-label">Entrée dans les lieux</div>
            </div>
            <div class="timeline-arrow">→</div>
            <div class="timeline-point">
              <div class="timeline-date">{{BAIL_DATE_FIN}}</div>
              <div class="timeline-label">Fin impérative du bail</div>
            </div>
            <div class="timeline-arrow">→</div>
            <div class="timeline-point">
              <div class="timeline-date">{{DATE_LIMITE_3_ANS}}</div>
              <div class="timeline-label">Limite légale 3 ans</div>
            </div>
          </div>
        </div>

        {{#if BAUX_ANTERIEURS}}
        <div class="historique-baux">
          <div class="historique-titre">Historique des baux dérogatoires sur ces locaux</div>
          <table class="historique-table">
            <thead>
              <tr>
                <th>Période</th>
                <th>Durée</th>
                <th>Preneur</th>
              </tr>
            </thead>
            <tbody>
              {{#each BAUX_ANTERIEURS}}
              <tr>
                <td>{{this.debut}} au {{this.fin}}</td>
                <td>{{this.duree_mois}} mois</td>
                <td>{{this.preneur}}</td>
              </tr>
              {{/each}}
              <tr>
                <td>Présent bail</td>
                <td>{{BAIL_DUREE_MOIS}} mois</td>
                <td>{{PRENEUR_NOM_COMPLET}}</td>
              </tr>
              <tr class="historique-total">
                <td colspan="2"><strong>DURÉE TOTALE CUMULÉE</strong></td>
                <td><strong>{{DUREE_CUMULEE_MOIS}} mois / 36 mois max</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        {{/if}}

        <div class="warning-box">
          <strong>ATTENTION :</strong> À l'expiration du présent bail, si le Preneur reste et est
          laissé en possession des locaux, il s'opérera un nouveau bail soumis au statut des baux
          commerciaux (article L145-5 alinéa 2 du Code de commerce). Le Preneur bénéficiera alors
          du droit au renouvellement et de l'indemnité d'éviction.
        </div>

        <div class="article">
          <div class="article-title">Article 3 - Terme du bail</div>
          <p class="article-content">
            Le présent bail prendra fin de plein droit à la date sus-indiquée, sans qu'il soit
            besoin de délivrer congé. Le Preneur devra avoir libéré les lieux et restitué les
            clés au plus tard le <strong>{{BAIL_DATE_FIN}}</strong> à {{HEURE_LIBERATION}}.
            <br><br>
            <strong>Aucune tacite reconduction n'est possible.</strong>
          </p>
        </div>

        <div class="article">
          <div class="article-title">Article 4 - Résiliation anticipée</div>
          <p class="article-content">
            {{#if RESILIATION_ANTICIPEE_PRENEUR}}
            Le Preneur pourra résilier le présent bail à tout moment moyennant un préavis de
            <strong>{{PREAVIS_RESILIATION}} mois</strong>, notifié par lettre recommandée avec
            accusé de réception.
            {{else}}
            Sauf accord amiable des parties, aucune résiliation anticipée n'est possible.
            {{/if}}
            <br><br>
            En cas de défaillance du Preneur dans l'exécution de ses obligations, le Bailleur
            pourra résilier le bail dans les conditions prévues à l'article 9 ci-après.
          </p>
        </div>
      </div>
    </div>

    <!-- V. CONDITIONS FINANCIÈRES -->
    <div class="section page-break">
      <div class="section-title">V. Conditions Financières</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 5 - Loyer</div>

          <div class="financial-summary">
            <div class="financial-row">
              <span>Loyer mensuel hors taxes</span>
              <span><strong>{{LOYER_MENSUEL_HT}} € HT</strong></span>
            </div>
            {{#if TVA_SUR_LOYER}}
            <div class="financial-row">
              <span>TVA ({{TVA_TAUX}}%)</span>
              <span>{{LOYER_TVA_MENSUEL}} €</span>
            </div>
            {{/if}}
            <div class="financial-row">
              <span>Provision sur charges</span>
              <span>{{CHARGES_PROVISION}} €</span>
            </div>
            <div class="financial-row total">
              <span>TOTAL MENSUEL</span>
              <span>{{TOTAL_MENSUEL}} € {{#if TVA_SUR_LOYER}}TTC{{else}}HT{{/if}}</span>
            </div>
          </div>

          <table class="info-table" style="margin-top: 15px;">
            <tr>
              <th>Loyer annuel HT</th>
              <td>{{LOYER_ANNUEL_HT}} € HT</td>
            </tr>
            <tr>
              <th>Loyer au m²/an</th>
              <td>{{LOYER_M2_ANNUEL}} € HT/m²/an</td>
            </tr>
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

        <div class="article">
          <div class="article-title">Article 6 - Révision du loyer</div>
          <p class="article-content">
            {{#if REVISION_AUTORISEE}}
            Le loyer sera révisé chaque année à la date anniversaire du bail, en fonction de la
            variation de l'indice {{INDICE_TYPE}}.
            <br><br>
            <strong>Indice de base :</strong> {{INDICE_BASE}} ({{INDICE_TRIMESTRE_BASE}})
            {{else}}
            Compte tenu de la courte durée du bail, <strong>aucune révision du loyer</strong>
            n'est prévue pendant la durée du présent contrat.
            {{/if}}
          </p>
        </div>

        <div class="article">
          <div class="article-title">Article 7 - Dépôt de garantie</div>
          <table class="info-table">
            <tr>
              <th>Montant du dépôt de garantie</th>
              <td><strong>{{DEPOT_GARANTIE}} €</strong></td>
            </tr>
            <tr>
              <th>Équivalent en mois de loyer</th>
              <td>{{DEPOT_NB_MOIS}} mois</td>
            </tr>
          </table>
          <p class="article-content" style="margin-top: 10px;">
            Ce dépôt sera restitué dans un délai maximum de deux mois suivant la restitution
            des locaux, déduction faite des sommes éventuellement dues par le Preneur.
          </p>
        </div>
      </div>
    </div>

    <!-- VI. CHARGES -->
    <div class="section">
      <div class="section-title">VI. Charges et Taxes</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 8 - Répartition des charges</div>
          <p class="article-content">
            Les charges suivantes sont à la charge du Preneur :
          </p>
          <ul style="margin: 10px 0 10px 20px;">
            <li>Consommations d'eau, électricité, gaz</li>
            <li>Taxe d'enlèvement des ordures ménagères</li>
            <li>Entretien courant des locaux</li>
            <li>Assurance des locaux loués</li>
            {{#if CHARGES_COPRO_PRENEUR}}
            <li>Quote-part des charges de copropriété (fonctionnement)</li>
            {{/if}}
          </ul>

          <p class="article-content" style="margin-top: 15px;">
            Restent à la charge du Bailleur :
          </p>
          <ul style="margin: 10px 0 10px 20px;">
            <li>Taxe foncière</li>
            <li>Gros travaux (article 606 du Code civil)</li>
            <li>Assurance propriétaire non occupant</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- VII. CLAUSE RÉSOLUTOIRE -->
    <div class="section">
      <div class="section-title">VII. Clause Résolutoire</div>
      <div class="section-content">
        <div class="clause-importante">
          <div class="clause-importante-title">Article 9 - Résiliation de plein droit</div>
          <p>
            Le présent bail sera résilié de plein droit, si bon semble au Bailleur, <strong>quinze jours</strong>
            après une mise en demeure par lettre recommandée avec accusé de réception demeurée
            sans effet, dans les cas suivants :
          </p>
          <ul style="margin: 15px 0 15px 20px;">
            <li>Défaut de paiement du loyer ou des charges à leur échéance</li>
            <li>Défaut d'assurance des locaux</li>
            <li>Non-respect de la destination des locaux</li>
            <li>Sous-location ou cession non autorisée</li>
            <li>Inexécution de toute autre obligation du bail</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- VIII. RENONCIATION AU STATUT -->
    <div class="section">
      <div class="section-title">VIII. Renonciation Expresse au Statut des Baux Commerciaux</div>
      <div class="section-content">
        <div class="clause-essentielle">
          <div class="clause-essentielle-title">
            Renonciation aux articles L145-1 à L145-60 du Code de commerce
          </div>

          <p style="margin-bottom: 15px; text-align: justify;">
            Le Preneur déclare avoir une parfaite connaissance des dispositions de l'article L145-5
            du Code de commerce et des conséquences de la signature du présent bail dérogatoire.
          </p>

          <p style="margin-bottom: 15px; text-align: justify;">
            <strong>Le Preneur renonce expressément :</strong>
          </p>

          <ul style="margin: 0 0 15px 20px;">
            <li>Au droit au renouvellement du bail</li>
            <li>À l'indemnité d'éviction en cas de non-renouvellement</li>
            <li>Au plafonnement du loyer</li>
            <li>À la faculté de résiliation triennale</li>
            <li>À l'ensemble des dispositions protectrices du statut des baux commerciaux</li>
          </ul>

          <div class="mention-manuscrite">
            <strong>Mention manuscrite obligatoire du Preneur :</strong><br><br>
            "Je reconnais avoir pris connaissance des dispositions de l'article L145-5 du Code de
            commerce. J'accepte de renoncer au bénéfice du statut des baux commerciaux. Je suis
            informé(e) que ce bail ne me confère aucun droit au renouvellement ni aucune indemnité
            d'éviction."
            <br><br>
            <div style="height: 60px; border: 1px dashed #999; margin-top: 10px;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- IX. ÉTAT DES LIEUX -->
    <div class="section">
      <div class="section-title">IX. État des Lieux et Assurance</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 10 - État des lieux</div>
          <p class="article-content">
            Un état des lieux d'entrée contradictoire sera établi lors de la remise des clés.
            Un état des lieux de sortie sera établi lors de la restitution des locaux.
            <br><br>
            Le Preneur prend les locaux dans l'état où ils se trouvent, sans pouvoir réclamer
            de travaux au Bailleur.
          </p>
        </div>

        <div class="article">
          <div class="article-title">Article 11 - Assurance</div>
          <p class="article-content">
            Le Preneur s'engage à assurer les locaux contre les risques locatifs (incendie,
            dégât des eaux, responsabilité civile) et à justifier de cette assurance à première
            demande du Bailleur.
          </p>
        </div>
      </div>
    </div>

    <!-- X. ANNEXES -->
    <div class="section">
      <div class="section-title">X. Documents Annexés</div>
      <div class="section-content">
        <ul style="list-style: none; padding: 0;">
          <li style="padding: 8px 0; border-bottom: 1px dashed #ddd;">☑ État des lieux d'entrée</li>
          <li style="padding: 8px 0; border-bottom: 1px dashed #ddd;">☑ Diagnostic de performance énergétique (DPE)</li>
          <li style="padding: 8px 0; border-bottom: 1px dashed #ddd;">☑ État des risques et pollutions (ERP)</li>
          {{#if AMIANTE_REQUIS}}
          <li style="padding: 8px 0; border-bottom: 1px dashed #ddd;">☑ Diagnostic amiante</li>
          {{/if}}
          <li style="padding: 8px 0; border-bottom: 1px dashed #ddd;">☑ Plan des locaux</li>
          <li style="padding: 8px 0; border-bottom: 1px dashed #ddd;">☑ Kbis du Preneur</li>
          <li style="padding: 8px 0;">☑ Attestation d'assurance du Preneur</li>
        </ul>
      </div>
    </div>

    <!-- XI. SIGNATURES -->
    <div class="section signature-section page-break">
      <div class="section-title">XI. Signatures des Parties</div>
      <div class="section-content">
        <p class="article-content">
          Fait à <strong>{{LIEU_SIGNATURE}}</strong>, le <strong>{{DATE_SIGNATURE}}</strong>,<br>
          en {{NB_EXEMPLAIRES}} exemplaires originaux.
        </p>

        <div class="warning-box" style="margin: 20px 0;">
          <strong>IMPORTANT :</strong> Avant de signer, le Preneur doit impérativement reproduire
          la mention manuscrite de renonciation au statut des baux commerciaux prévue à l'article VIII.
        </div>

        <div class="signature-grid">
          <div class="signature-box">
            <div class="signature-title">Le Bailleur</div>
            <p class="signature-mention">
              Signature précédée de "Lu et approuvé"
            </p>
            {{#if BAILLEUR_SIGNATURE_IMAGE}}
            <img src="{{BAILLEUR_SIGNATURE_IMAGE}}" alt="Signature bailleur" class="signature-image" />
            {{else}}
            <div class="signature-line"></div>
            {{/if}}
            <p style="font-size: 9pt;">{{BAILLEUR_NOM_COMPLET}}</p>
          </div>

          <div class="signature-box">
            <div class="signature-title">Le Preneur</div>
            <p class="signature-mention">
              Signature précédée de "Lu et approuvé"
            </p>
            {{#if PRENEUR_SIGNATURE_IMAGE}}
            <img src="{{PRENEUR_SIGNATURE_IMAGE}}" alt="Signature preneur" class="signature-image" />
            {{else}}
            <div class="signature-line"></div>
            {{/if}}
            <p style="font-size: 9pt;">{{PRENEUR_NOM_COMPLET}}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p><strong>Bail commercial dérogatoire</strong> - Article L145-5 du Code de commerce</p>
      <p>Durée maximale : 3 ans - Sans droit au renouvellement</p>
      <p>Document généré le {{DATE_GENERATION}} - Référence : {{REFERENCE_BAIL}}</p>
    </div>
  </div>

  <!-- Certificat de signature électronique -->
  {{#if IS_SIGNED}}
  <div class="page" style="page-break-before: always; padding: 20mm;">
    <div class="header">
      <h1>CERTIFICAT DE SIGNATURE ÉLECTRONIQUE</h1>
    </div>
    {{CERTIFICATE_HTML}}
  </div>
  {{/if}}
</body>
</html>
`;

// Variables disponibles pour le template bail dérogatoire
export const BAIL_DEROGATOIRE_VARIABLES = [
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
  'BAILLEUR_SIRET',
  'BAILLEUR_REPRESENTANT',
  'BAILLEUR_REPRESENTANT_QUALITE',
  'BAILLEUR_ADRESSE',
  'BAILLEUR_SIGNATURE_IMAGE',

  // Preneur
  'PRENEUR_IS_SOCIETE',
  'PRENEUR_NOM_COMPLET',
  'PRENEUR_RAISON_SOCIALE',
  'PRENEUR_FORME_JURIDIQUE',
  'PRENEUR_SIRET',
  'PRENEUR_RCS',
  'PRENEUR_REPRESENTANT',
  'PRENEUR_REPRESENTANT_QUALITE',
  'PRENEUR_ADRESSE',
  'PRENEUR_SIGNATURE_IMAGE',

  // Locaux
  'LOCAUX_ADRESSE',
  'LOCAUX_CODE_POSTAL',
  'LOCAUX_VILLE',
  'LOCAUX_NATURE',
  'LOCAUX_SURFACE',
  'LOCAUX_ETAGE',
  'LOCAUX_ACCESSOIRES',

  // Destination
  'ACTIVITE_AUTORISEE',
  'CODE_APE',
  'LIBELLE_APE',

  // Durée - Critique pour bail dérogatoire
  'BAIL_DATE_DEBUT',
  'BAIL_DATE_FIN',
  'BAIL_DUREE_MOIS',
  'DATE_LIMITE_3_ANS',
  'HEURE_LIBERATION',
  'BAUX_ANTERIEURS',
  'DUREE_CUMULEE_MOIS',
  'RESILIATION_ANTICIPEE_PRENEUR',
  'PREAVIS_RESILIATION',

  // Financier
  'LOYER_MENSUEL_HT',
  'LOYER_ANNUEL_HT',
  'LOYER_M2_ANNUEL',
  'TVA_SUR_LOYER',
  'TVA_TAUX',
  'LOYER_TVA_MENSUEL',
  'CHARGES_PROVISION',
  'TOTAL_MENSUEL',
  'MODE_PAIEMENT',
  'JOUR_PAIEMENT',
  'TERME_PAIEMENT',

  // Révision
  'REVISION_AUTORISEE',
  'INDICE_TYPE',
  'INDICE_BASE',
  'INDICE_TRIMESTRE_BASE',

  // Dépôt de garantie
  'DEPOT_GARANTIE',
  'DEPOT_NB_MOIS',

  // Charges
  'CHARGES_COPRO_PRENEUR',

  // Diagnostics
  'AMIANTE_REQUIS',
];

export default BAIL_DEROGATOIRE_TEMPLATE;
