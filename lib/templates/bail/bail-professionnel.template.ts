/**
 * Template de bail professionnel
 * Conforme à l'article 57 A de la loi n°86-1290 du 23 décembre 1986
 *
 * Destiné aux professions libérales réglementées ou non
 * Durée minimale : 6 ans
 * Indexation : ILAT (Indice des Loyers des Activités Tertiaires)
 */

export const BAIL_PROFESSIONNEL_TEMPLATE = `
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
      border-bottom: 3px double #1e3a5f;
    }

    .header h1 {
      font-size: 20pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
      color: #1e3a5f;
    }

    .header .subtitle {
      font-size: 14pt;
      font-weight: normal;
      color: #34495e;
    }

    .header .reference {
      font-size: 10pt;
      color: #666;
      margin-top: 10px;
    }

    .legal-notice {
      background: #eef4f9;
      border: 2px solid #1e3a5f;
      padding: 15px;
      margin-bottom: 25px;
      font-size: 9pt;
      text-align: center;
    }

    .legal-notice strong {
      color: #1e3a5f;
    }

    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      background: #1e3a5f;
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
      color: #1e3a5f;
      border-left: 3px solid #3498db;
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
      border-bottom: 2px solid #1e3a5f;
      color: #1e3a5f;
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

    .profession-badge {
      display: inline-block;
      background: #1e3a5f;
      color: #fff;
      padding: 3px 10px;
      border-radius: 3px;
      font-size: 10pt;
      margin-top: 5px;
    }

    .ordre-info {
      background: #e8f4f8;
      border: 1px solid #3498db;
      padding: 10px;
      margin-top: 10px;
      font-size: 10pt;
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
      background: #eef4f9;
      font-weight: bold;
      width: 40%;
      color: #1e3a5f;
    }

    .financial-summary {
      background: #f8f9fa;
      border: 2px solid #1e3a5f;
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
      background: #1e3a5f;
      color: #fff;
      margin: 15px -20px -20px;
      padding: 15px 20px;
    }

    .indexation-box {
      background: #e8f6e8;
      border: 1px solid #27ae60;
      padding: 15px;
      margin: 15px 0;
    }

    .indexation-title {
      font-weight: bold;
      color: #27ae60;
      margin-bottom: 10px;
    }

    .duration-timeline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(90deg, #e8f4f9, #f8f9fa);
      padding: 20px;
      margin: 15px 0;
      border-radius: 5px;
    }

    .timeline-point {
      text-align: center;
    }

    .timeline-date {
      font-size: 14pt;
      font-weight: bold;
      color: #1e3a5f;
    }

    .timeline-label {
      font-size: 9pt;
      color: #666;
    }

    .timeline-arrow {
      font-size: 24pt;
      color: #bdc3c7;
    }

    .warning-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      margin: 15px 0;
      font-size: 10pt;
    }

    .warning-box::before {
      content: '⚠️ ';
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

    .assurance-box {
      background: #e8f5e9;
      border: 2px solid #4caf50;
      padding: 15px;
      margin: 15px 0;
    }

    .assurance-title {
      font-weight: bold;
      color: #2e7d32;
      margin-bottom: 10px;
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
      color: #1e3a5f;
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
      content: '☑';
      margin-right: 10px;
      font-size: 14pt;
      color: #27ae60;
    }

    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #1e3a5f;
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
      <div class="subtitle">Bail à usage exclusivement professionnel</div>
      <div class="reference">Référence : {{REFERENCE_BAIL}}</div>
    </div>

    <div class="legal-notice">
      <strong>Article 57 A de la loi n°86-1290 du 23 décembre 1986</strong><br>
      Modifié par la loi n°2008-776 du 4 août 2008 (LME)<br>
      <em>Bail destiné à l'exercice d'une profession libérale</em>
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
            <div class="party-info">
              <span class="party-label">{{PRENEUR_CIVILITE}}</span><br>
              <span class="party-value" style="font-size: 12pt;">{{PRENEUR_NOM_COMPLET}}</span>
            </div>

            <div class="profession-badge">{{PRENEUR_PROFESSION}}</div>

            <div class="party-info" style="margin-top: 10px;">
              <span class="party-label">Forme d'exercice :</span><br>
              <span class="party-value">{{PRENEUR_FORME_JURIDIQUE}}</span>
            </div>

            {{#if PRENEUR_RAISON_SOCIALE}}
            <div class="party-info">
              <span class="party-label">Dénomination :</span><br>
              <span class="party-value">{{PRENEUR_RAISON_SOCIALE}}</span>
            </div>
            {{/if}}

            {{#if PRENEUR_SIRET}}
            <div class="party-info">
              <span class="party-label">SIRET :</span><br>
              <span class="party-value">{{PRENEUR_SIRET}}</span>
            </div>
            {{/if}}

            <div class="party-info">
              <span class="party-label">Adresse actuelle :</span><br>
              <span class="party-value">{{PRENEUR_ADRESSE}}</span>
            </div>

            {{#if PRENEUR_ORDRE}}
            <div class="ordre-info">
              <strong>Inscription ordinale</strong><br>
              {{PRENEUR_ORDRE}}<br>
              N° : {{PRENEUR_NUMERO_ORDINAL}}
            </div>
            {{/if}}
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
              <th>Surface totale</th>
              <td><strong>{{LOCAUX_SURFACE}} m²</strong></td>
            </tr>
            {{#if LOCAUX_ETAGE}}
            <tr>
              <th>Étage</th>
              <td>{{LOCAUX_ETAGE}}</td>
            </tr>
            {{/if}}
            <tr>
              <th>Nombre de bureaux</th>
              <td>{{LOCAUX_NB_BUREAUX}}</td>
            </tr>
            <tr>
              <th>Description</th>
              <td>{{LOCAUX_DESCRIPTION}}</td>
            </tr>
            <tr>
              <th>Accessibilité PMR</th>
              <td>{{#if LOCAUX_ACCESSIBILITE_PMR}}✓ Conforme{{else}}Non conforme{{/if}}</td>
            </tr>
          </table>
        </div>

        {{#if LOCAUX_ACCESSIBILITE_PMR}}
        <div class="info-box">
          Les locaux sont conformes aux normes d'accessibilité pour les personnes à mobilité réduite,
          permettant l'accueil de la clientèle et la conformité aux obligations réglementaires
          des établissements recevant du public (ERP).
        </div>
        {{/if}}
      </div>
    </div>

    <!-- III. DESTINATION -->
    <div class="section">
      <div class="section-title">III. Destination des Locaux</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 2 - Usage professionnel exclusif</div>
          <p class="article-content">
            Les locaux sont loués à usage <strong>exclusivement professionnel</strong> pour
            l'exercice de la profession suivante :
          </p>

          <div style="background: #eef4f9; padding: 15px; margin: 15px 0; text-align: center;">
            <strong style="font-size: 14pt; color: #1e3a5f;">{{PRENEUR_PROFESSION}}</strong>
          </div>

          <p class="article-content">
            Le Preneur s'engage à n'utiliser les locaux que pour l'exercice de son activité
            professionnelle et à ne pas les transformer en local d'habitation, même partielle.
          </p>

          {{#if SOUS_LOCATION_AUTORISEE}}
          <div class="info-box">
            La sous-location est autorisée avec l'accord préalable et écrit du Bailleur.
          </div>
          {{else}}
          <div class="warning-box">
            Toute sous-location, totale ou partielle, est <strong>strictement interdite</strong>.
          </div>
          {{/if}}
        </div>
      </div>
    </div>

    <!-- IV. DURÉE -->
    <div class="section">
      <div class="section-title">IV. Durée du Bail</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 3 - Durée et effet</div>

          <table class="info-table">
            <tr>
              <th>Durée du bail</th>
              <td><strong>{{BAIL_DUREE_ANNEES}} ans</strong></td>
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

          <div class="duration-timeline">
            <div class="timeline-point">
              <div class="timeline-date">{{BAIL_DATE_DEBUT}}</div>
              <div class="timeline-label">Prise d'effet</div>
            </div>
            <div class="timeline-arrow">→ {{BAIL_DUREE_ANNEES}} ans →</div>
            <div class="timeline-point">
              <div class="timeline-date">{{BAIL_DATE_FIN}}</div>
              <div class="timeline-label">Échéance</div>
            </div>
          </div>

          <div class="info-box">
            Conformément à l'article 57 A de la loi du 23 décembre 1986, la durée minimale du
            bail professionnel est de <strong>six ans</strong>.
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 4 - Résiliation</div>
          <p class="article-content">
            <strong>Résiliation par le Preneur :</strong><br>
            Le Preneur peut donner congé à tout moment, sous réserve de respecter un préavis de
            <strong>{{PREAVIS_LOCATAIRE}} mois</strong>, notifié par lettre recommandée avec
            accusé de réception.
          </p>

          <p class="article-content" style="margin-top: 15px;">
            <strong>Résiliation par le Bailleur :</strong><br>
            Le Bailleur peut donner congé pour la fin du bail en respectant un préavis de
            <strong>{{PREAVIS_BAILLEUR}} mois</strong>, notifié par acte extrajudiciaire.
          </p>

          <div class="warning-box">
            <strong>Absence de droit au renouvellement :</strong> Contrairement au bail commercial,
            le bail professionnel ne confère pas de "propriété commerciale" au Preneur.
            Le Bailleur peut refuser le renouvellement sans avoir à verser d'indemnité d'éviction.
          </div>
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
              <span>Loyer annuel hors charges</span>
              <span><strong>{{LOYER_ANNUEL_HC}} €</strong></span>
            </div>
            <div class="financial-row">
              <span>Soit par mois</span>
              <span>{{LOYER_MENSUEL_HC}} €</span>
            </div>
            <div class="financial-row">
              <span>Loyer au m²/an</span>
              <span>{{LOYER_M2_ANNUEL}} €/m²/an</span>
            </div>
            {{#if TVA_APPLICABLE}}
            <div class="financial-row">
              <span>TVA ({{TVA_TAUX}}%)</span>
              <span>Applicable</span>
            </div>
            {{/if}}
            <div class="financial-row">
              <span>Provision sur charges ({{CHARGES_TYPE}})</span>
              <span>{{CHARGES_MENSUELLES}} € / mois</span>
            </div>
            <div class="financial-row total">
              <span>TOTAL MENSUEL</span>
              <span>{{TOTAL_MENSUEL}} €</span>
            </div>
          </div>

          <p class="article-content">
            Soit en toutes lettres : <strong>{{LOYER_LETTRES}}</strong> par an hors charges.
          </p>

          <table class="info-table" style="margin-top: 15px;">
            <tr>
              <th>Périodicité de paiement</th>
              <td>{{PERIODICITE}}</td>
            </tr>
            <tr>
              <th>Terme</th>
              <td>{{TERME}}</td>
            </tr>
            <tr>
              <th>Date de paiement</th>
              <td>Le {{JOUR_PAIEMENT}} de chaque mois</td>
            </tr>
            <tr>
              <th>Mode de paiement</th>
              <td>{{MODE_PAIEMENT}}</td>
            </tr>
          </table>
        </div>

        <div class="article">
          <div class="article-title">Article 6 - Indexation du loyer</div>

          <div class="indexation-box">
            <div class="indexation-title">Clause d'indexation annuelle</div>
            <p>
              Le loyer sera révisé automatiquement chaque année à la date anniversaire du bail,
              en fonction de la variation de l'indice :
            </p>

            <table class="info-table" style="margin-top: 15px; background: #fff;">
              <tr>
                <th>Indice de référence</th>
                <td><strong>{{INDICE_TYPE}}</strong></td>
              </tr>
              <tr>
                <th>Indice de base</th>
                <td>{{INDICE_BASE}} ({{INDICE_TRIMESTRE_BASE}})</td>
              </tr>
              <tr>
                <th>Date de révision</th>
                <td>{{DATE_REVISION}} de chaque année</td>
              </tr>
            </table>

            <p style="margin-top: 10px; font-size: 10pt;">
              <strong>Formule :</strong> Nouveau loyer = Loyer actuel × (Nouvel indice ÷ Indice de base)
            </p>
          </div>
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
            <tr>
              <th>Restitution</th>
              <td>Dans les 2 mois suivant la restitution des locaux</td>
            </tr>
          </table>
        </div>
      </div>
    </div>

    <!-- VI. ASSURANCES -->
    <div class="section">
      <div class="section-title">VI. Assurances</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 8 - Assurance des locaux</div>
          <p class="article-content">
            Le Preneur s'oblige à assurer les locaux contre les risques locatifs (incendie,
            dégât des eaux, responsabilité civile) et à justifier de cette assurance à première
            demande du Bailleur.
          </p>
        </div>

        {{#if PRENEUR_ASSURANCE_RCP}}
        <div class="assurance-box">
          <div class="assurance-title">Assurance Responsabilité Civile Professionnelle</div>
          <p>
            Le Preneur déclare être titulaire d'une assurance responsabilité civile professionnelle
            obligatoire pour l'exercice de sa profession.
          </p>
          {{#if PRENEUR_ASSURANCE_COMPAGNIE}}
          <p style="margin-top: 10px;">
            <strong>Assureur :</strong> {{PRENEUR_ASSURANCE_COMPAGNIE}}
          </p>
          {{/if}}
          <p style="font-size: 10pt; margin-top: 10px; font-style: italic;">
            Le Preneur s'engage à maintenir cette assurance en vigueur pendant toute la durée
            du bail et à en justifier à première demande.
          </p>
        </div>
        {{/if}}
      </div>
    </div>

    <!-- VII. CHARGES ET TRAVAUX -->
    <div class="section">
      <div class="section-title">VII. Charges et Travaux</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 9 - Répartition des charges</div>
          <p class="article-content">
            Le Preneur prend à sa charge :
          </p>
          <ul style="margin: 10px 0 10px 20px;">
            <li>Les consommations d'eau, d'électricité et de gaz</li>
            <li>L'entretien courant des locaux</li>
            <li>Les menues réparations (article 1754 du Code civil)</li>
            <li>La taxe sur les bureaux (si applicable)</li>
            <li>Sa quote-part des charges de copropriété (fonctionnement)</li>
          </ul>

          <p class="article-content" style="margin-top: 15px;">
            Restent à la charge du Bailleur :
          </p>
          <ul style="margin: 10px 0 10px 20px;">
            <li>Les grosses réparations (article 606 du Code civil)</li>
            <li>La taxe foncière</li>
            <li>L'assurance propriétaire non occupant</li>
          </ul>
        </div>

        <div class="article">
          <div class="article-title">Article 10 - Travaux</div>
          <p class="article-content">
            Le Preneur ne pourra effectuer aucun travaux de modification, d'amélioration ou
            d'aménagement sans l'accord préalable et écrit du Bailleur.
            <br><br>
            Les travaux autorisés seront exécutés aux frais du Preneur et resteront acquis
            au Bailleur en fin de bail sans indemnité, sauf stipulation contraire.
          </p>
        </div>
      </div>
    </div>

    <!-- VIII. CLAUSE RÉSOLUTOIRE -->
    <div class="section">
      <div class="section-title">VIII. Clause Résolutoire</div>
      <div class="section-content">
        <div class="clause-importante">
          <div class="clause-importante-title">Article 11 - Résiliation de plein droit</div>
          <p>
            Le présent bail sera résilié de plein droit, si bon semble au Bailleur, <strong>un mois</strong>
            après un commandement de payer ou une mise en demeure demeurés infructueux, dans les cas suivants :
          </p>
          <ul style="margin: 15px 0 15px 20px;">
            <li>Défaut de paiement du loyer ou des charges à leur échéance</li>
            <li>Défaut d'assurance des locaux</li>
            <li>Non-respect de la destination professionnelle</li>
            <li>Sous-location non autorisée</li>
            <li>Cessation de l'activité professionnelle</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- IX. CESSION DU BAIL -->
    <div class="section">
      <div class="section-title">IX. Cession du Bail</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 12 - Cession</div>
          {{#if CESSION_AUTORISEE}}
          <p class="article-content">
            La cession du présent bail est autorisée, sous réserve de l'accord préalable et écrit
            du Bailleur. Le cessionnaire devra exercer une profession libérale compatible avec
            la destination des locaux.
          </p>
          {{else}}
          <p class="article-content">
            La cession du présent bail est <strong>interdite</strong>, sauf en cas de cession
            de la clientèle professionnelle, et sous réserve de l'accord du Bailleur.
          </p>
          {{/if}}
        </div>
      </div>
    </div>

    <!-- X. ANNEXES -->
    <div class="section">
      <div class="section-title">X. Documents Annexés</div>
      <div class="section-content">
        <ul class="annexes-list">
          <li>État des lieux d'entrée</li>
          <li>Diagnostic de performance énergétique (DPE)</li>
          <li>État des risques et pollutions (ERP)</li>
          <li>Diagnostic amiante (si immeuble construit avant 1997)</li>
          <li>Plan des locaux</li>
          <li>Attestation d'assurance du Preneur</li>
          {{#if PRENEUR_ORDRE}}
          <li>Justificatif d'inscription à l'Ordre professionnel</li>
          {{/if}}
          <li>Attestation d'assurance RCP du Preneur</li>
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
            <p style="font-size: 9pt;">{{PRENEUR_CIVILITE}} {{PRENEUR_NOM_COMPLET}}<br>{{PRENEUR_PROFESSION}}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p><strong>Bail professionnel</strong> - Article 57 A de la loi n°86-1290 du 23 décembre 1986</p>
      <p>Durée minimale : 6 ans - Indexation ILAT</p>
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

// Variables disponibles pour le template bail professionnel
export const BAIL_PROFESSIONNEL_VARIABLES = [
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
  'BAILLEUR_SIRET',
  'BAILLEUR_ADRESSE',
  'BAILLEUR_REPRESENTANT',
  'BAILLEUR_REPRESENTANT_QUALITE',
  'BAILLEUR_SIGNATURE_IMAGE',

  // Preneur
  'PRENEUR_CIVILITE',
  'PRENEUR_NOM_COMPLET',
  'PRENEUR_PROFESSION',
  'PRENEUR_FORME_JURIDIQUE',
  'PRENEUR_RAISON_SOCIALE',
  'PRENEUR_SIRET',
  'PRENEUR_ADRESSE',
  'PRENEUR_ORDRE',
  'PRENEUR_NUMERO_ORDINAL',
  'PRENEUR_ASSURANCE_RCP',
  'PRENEUR_ASSURANCE_COMPAGNIE',
  'PRENEUR_SIGNATURE_IMAGE',

  // Locaux
  'LOCAUX_ADRESSE',
  'LOCAUX_CODE_POSTAL',
  'LOCAUX_VILLE',
  'LOCAUX_SURFACE',
  'LOCAUX_ETAGE',
  'LOCAUX_NB_BUREAUX',
  'LOCAUX_DESCRIPTION',
  'LOCAUX_ACCESSIBILITE_PMR',

  // Durée
  'BAIL_DUREE_ANNEES',
  'BAIL_DATE_DEBUT',
  'BAIL_DATE_FIN',

  // Financier
  'LOYER_ANNUEL_HC',
  'LOYER_MENSUEL_HC',
  'LOYER_M2_ANNUEL',
  'LOYER_LETTRES',
  'TVA_APPLICABLE',
  'TVA_TAUX',
  'CHARGES_TYPE',
  'CHARGES_MENSUELLES',
  'TOTAL_MENSUEL',
  'DEPOT_GARANTIE',
  'DEPOT_NB_MOIS',
  'PERIODICITE',
  'TERME',
  'JOUR_PAIEMENT',
  'MODE_PAIEMENT',

  // Indexation
  'INDICE_TYPE',
  'INDICE_BASE',
  'INDICE_TRIMESTRE_BASE',
  'DATE_REVISION',

  // Résiliation
  'PREAVIS_LOCATAIRE',
  'PREAVIS_BAILLEUR',

  // Options
  'SOUS_LOCATION_AUTORISEE',
  'CESSION_AUTORISEE',
];

export default BAIL_PROFESSIONNEL_TEMPLATE;
