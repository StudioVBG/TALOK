/**
 * Template Bail Étudiant - GAP-008 SOTA 2026
 *
 * Contrat de location meublée pour étudiant
 * Conformité:
 * - Loi n°89-462 du 6 juillet 1989 - Article 25-9
 * - Loi ALUR du 24 mars 2014
 * - Décret n°2015-981 du 31 juillet 2015
 */

export const BAIL_ETUDIANT_TEMPLATE = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bail Étudiant - {{REFERENCE}}</title>
  <style>
    :root {
      --primary: #6366f1;
      --primary-dark: #4f46e5;
      --primary-light: #a5b4fc;
      --secondary: #f59e0b;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-600: #4b5563;
      --gray-700: #374151;
      --gray-800: #1f2937;
      --gray-900: #111827;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Marianne', 'Segoe UI', system-ui, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: var(--gray-800);
      background: white;
    }

    @page {
      size: A4;
      margin: 20mm 15mm;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; }
      .no-break { page-break-inside: avoid; }
    }

    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 10mm;
    }

    /* Header */
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 3px solid var(--primary);
      margin-bottom: 25px;
    }

    .header-badge {
      display: inline-block;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      color: white;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 12pt;
      font-weight: 600;
      margin-bottom: 15px;
    }

    .header h1 {
      font-size: 22pt;
      color: var(--gray-900);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .header .subtitle {
      font-size: 11pt;
      color: var(--gray-600);
      font-style: italic;
    }

    .header .reference {
      font-size: 10pt;
      color: var(--gray-600);
      margin-top: 10px;
    }

    /* Sections */
    .section {
      margin-bottom: 25px;
    }

    .section-title {
      background: var(--primary);
      color: white;
      padding: 10px 15px;
      font-size: 12pt;
      font-weight: 600;
      border-radius: 6px 6px 0 0;
      margin-bottom: 0;
    }

    .section-content {
      border: 1px solid var(--gray-200);
      border-top: none;
      border-radius: 0 0 6px 6px;
      padding: 15px;
      background: var(--gray-50);
    }

    /* Info boxes */
    .info-box {
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 15px;
    }

    .info-box-title {
      font-weight: 600;
      color: var(--primary-dark);
      margin-bottom: 10px;
      font-size: 11pt;
      border-bottom: 1px solid var(--gray-200);
      padding-bottom: 8px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px;
    }

    .info-label {
      font-weight: 500;
      color: var(--gray-600);
      font-size: 10pt;
    }

    .info-value {
      color: var(--gray-800);
      font-size: 10pt;
    }

    /* Student badge */
    .student-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, var(--primary-light), var(--primary));
      color: white;
      padding: 6px 12px;
      border-radius: 15px;
      font-size: 10pt;
      font-weight: 500;
    }

    .student-badge::before {
      content: "🎓";
    }

    /* Articles */
    .article {
      margin-bottom: 20px;
    }

    .article-title {
      font-weight: 600;
      color: var(--primary-dark);
      font-size: 11pt;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid var(--primary-light);
    }

    .article-content {
      padding-left: 15px;
    }

    .article-content p {
      margin-bottom: 10px;
      text-align: justify;
    }

    /* Lists */
    ul, ol {
      margin-left: 20px;
      margin-bottom: 10px;
    }

    li {
      margin-bottom: 5px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 10pt;
    }

    th, td {
      border: 1px solid var(--gray-200);
      padding: 10px;
      text-align: left;
    }

    th {
      background: var(--primary);
      color: white;
      font-weight: 600;
    }

    tr:nth-child(even) {
      background: var(--gray-50);
    }

    /* Financial table */
    .financial-table {
      background: white;
    }

    .financial-table .total-row {
      background: var(--primary-light);
      font-weight: 600;
    }

    .financial-table .amount {
      text-align: right;
      font-family: 'Courier New', monospace;
    }

    /* Alert boxes */
    .alert {
      padding: 12px 15px;
      border-radius: 6px;
      margin: 15px 0;
      font-size: 10pt;
    }

    .alert-info {
      background: #dbeafe;
      border-left: 4px solid var(--primary);
      color: var(--primary-dark);
    }

    .alert-warning {
      background: #fef3c7;
      border-left: 4px solid var(--warning);
      color: #92400e;
    }

    .alert-success {
      background: #d1fae5;
      border-left: 4px solid var(--success);
      color: #065f46;
    }

    /* Duration highlight */
    .duration-box {
      background: linear-gradient(135deg, var(--primary-light), #c7d2fe);
      border: 2px solid var(--primary);
      border-radius: 8px;
      padding: 15px;
      text-align: center;
      margin: 15px 0;
    }

    .duration-box .duration-label {
      font-size: 10pt;
      color: var(--primary-dark);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .duration-box .duration-value {
      font-size: 18pt;
      font-weight: 700;
      color: var(--primary-dark);
      margin: 5px 0;
    }

    .duration-box .duration-dates {
      font-size: 11pt;
      color: var(--gray-700);
    }

    /* Equipment list */
    .equipment-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin: 10px 0;
    }

    .equipment-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10pt;
      padding: 5px 10px;
      background: white;
      border-radius: 4px;
      border: 1px solid var(--gray-200);
    }

    .equipment-item::before {
      content: "✓";
      color: var(--success);
      font-weight: bold;
    }

    /* Signatures */
    .signatures {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
      margin-top: 40px;
    }

    .signature-box {
      border: 2px solid var(--gray-300);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }

    .signature-box .role {
      font-weight: 600;
      color: var(--primary-dark);
      margin-bottom: 5px;
    }

    .signature-box .name {
      font-size: 10pt;
      color: var(--gray-600);
      margin-bottom: 15px;
    }

    .signature-box .mention {
      font-size: 9pt;
      color: var(--gray-500);
      font-style: italic;
      margin-bottom: 10px;
    }

    .signature-area {
      min-height: 80px;
      border: 1px dashed var(--gray-300);
      border-radius: 4px;
      margin: 10px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gray-400);
      font-size: 9pt;
    }

    .signature-area img {
      max-height: 70px;
      max-width: 100%;
    }

    .signature-date {
      font-size: 9pt;
      color: var(--gray-600);
      margin-top: 10px;
    }

    /* Garant section */
    .garant-section {
      background: #fef3c7;
      border: 2px solid var(--warning);
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }

    .garant-section .garant-title {
      color: #92400e;
      font-weight: 600;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .garant-section .garant-title::before {
      content: "🛡️";
    }

    /* Visale badge */
    .visale-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--success);
      color: white;
      padding: 8px 15px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 10pt;
    }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid var(--gray-200);
      font-size: 9pt;
      color: var(--gray-500);
      text-align: center;
    }

    .footer .legal {
      margin-bottom: 10px;
    }

    .footer .generated {
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="header-badge">🎓 BAIL ÉTUDIANT</div>
      <h1>Contrat de Location Meublée</h1>
      <p class="subtitle">Bail spécifique pour étudiant - Durée 9 mois</p>
      <p class="subtitle">Article 25-9 de la loi n°89-462 du 6 juillet 1989</p>
      <p class="reference">Référence : {{REFERENCE}}</p>
    </header>

    <!-- Année universitaire -->
    <div class="duration-box no-break">
      <div class="duration-label">Année Universitaire</div>
      <div class="duration-value">{{ANNEE_UNIVERSITAIRE}}</div>
      <div class="duration-dates">Du {{DATE_DEBUT}} au {{DATE_FIN}}</div>
    </div>

    <!-- Parties -->
    <section class="section no-break">
      <h2 class="section-title">ENTRE LES SOUSSIGNÉS</h2>
      <div class="section-content">
        <!-- Bailleur -->
        <div class="info-box">
          <div class="info-box-title">LE BAILLEUR</div>
          <div class="info-grid">
            <span class="info-label">{{#if BAILLEUR_TYPE_SOCIETE}}Raison sociale{{else}}Nom{{/if}} :</span>
            <span class="info-value"><strong>{{BAILLEUR_NOM}}</strong></span>
            {{#if BAILLEUR_REPRESENTANT}}
            <span class="info-label">Représenté par :</span>
            <span class="info-value">{{BAILLEUR_REPRESENTANT}}</span>
            {{/if}}
            {{#if BAILLEUR_SIRET}}
            <span class="info-label">SIRET :</span>
            <span class="info-value">{{BAILLEUR_SIRET}}</span>
            {{/if}}
            <span class="info-label">Adresse :</span>
            <span class="info-value">{{BAILLEUR_ADRESSE}}</span>
            {{#if BAILLEUR_EMAIL}}
            <span class="info-label">Email :</span>
            <span class="info-value">{{BAILLEUR_EMAIL}}</span>
            {{/if}}
            {{#if BAILLEUR_TELEPHONE}}
            <span class="info-label">Téléphone :</span>
            <span class="info-value">{{BAILLEUR_TELEPHONE}}</span>
            {{/if}}
          </div>
        </div>

        <p style="text-align: center; font-weight: 600; margin: 15px 0;">ET</p>

        <!-- Locataire Étudiant -->
        <div class="info-box">
          <div class="info-box-title">
            LE LOCATAIRE
            <span class="student-badge">Étudiant</span>
          </div>
          <div class="info-grid">
            <span class="info-label">Nom :</span>
            <span class="info-value"><strong>{{LOCATAIRE_NOM}}</strong></span>
            <span class="info-label">Prénom :</span>
            <span class="info-value"><strong>{{LOCATAIRE_PRENOM}}</strong></span>
            <span class="info-label">Date de naissance :</span>
            <span class="info-value">{{LOCATAIRE_DATE_NAISSANCE}}</span>
            {{#if LOCATAIRE_LIEU_NAISSANCE}}
            <span class="info-label">Lieu de naissance :</span>
            <span class="info-value">{{LOCATAIRE_LIEU_NAISSANCE}}</span>
            {{/if}}
            {{#if LOCATAIRE_NATIONALITE}}
            <span class="info-label">Nationalité :</span>
            <span class="info-value">{{LOCATAIRE_NATIONALITE}}</span>
            {{/if}}
            <span class="info-label">Email :</span>
            <span class="info-value">{{LOCATAIRE_EMAIL}}</span>
            {{#if LOCATAIRE_TELEPHONE}}
            <span class="info-label">Téléphone :</span>
            <span class="info-value">{{LOCATAIRE_TELEPHONE}}</span>
            {{/if}}
          </div>
        </div>

        <!-- Cursus -->
        <div class="info-box">
          <div class="info-box-title">🎓 CURSUS UNIVERSITAIRE</div>
          <div class="info-grid">
            <span class="info-label">Établissement :</span>
            <span class="info-value"><strong>{{ETABLISSEMENT_NOM}}</strong></span>
            <span class="info-label">Type :</span>
            <span class="info-value">{{ETABLISSEMENT_TYPE}}</span>
            <span class="info-label">Ville :</span>
            <span class="info-value">{{ETABLISSEMENT_VILLE}}</span>
            <span class="info-label">Formation :</span>
            <span class="info-value">{{FORMATION}}</span>
            <span class="info-label">Niveau :</span>
            <span class="info-value">{{NIVEAU_ETUDES}}</span>
            {{#if NUMERO_INE}}
            <span class="info-label">N° INE :</span>
            <span class="info-value">{{NUMERO_INE}}</span>
            {{/if}}
          </div>
        </div>

        <!-- Justificatif -->
        <div class="alert alert-info">
          <strong>Justificatif de scolarité :</strong> {{JUSTIFICATIF_TYPE}}
          {{#if JUSTIFICATIF_NUMERO}} (N° {{JUSTIFICATIF_NUMERO}}){{/if}}
          - Valable jusqu'au {{JUSTIFICATIF_VALIDITE}}
          - Délivré par {{JUSTIFICATIF_EMETTEUR}}
        </div>
      </div>
    </section>

    <!-- Contact responsable (si mineur ou pour urgence) -->
    {{#if RESPONSABLE_NOM}}
    <section class="section no-break">
      <h2 class="section-title">CONTACT PARENT / RESPONSABLE</h2>
      <div class="section-content">
        <div class="info-box">
          <div class="info-grid">
            <span class="info-label">Nom :</span>
            <span class="info-value"><strong>{{RESPONSABLE_NOM}} {{RESPONSABLE_PRENOM}}</strong></span>
            <span class="info-label">Lien :</span>
            <span class="info-value">{{RESPONSABLE_LIEN}}</span>
            <span class="info-label">Téléphone :</span>
            <span class="info-value">{{RESPONSABLE_TELEPHONE}}</span>
            {{#if RESPONSABLE_EMAIL}}
            <span class="info-label">Email :</span>
            <span class="info-value">{{RESPONSABLE_EMAIL}}</span>
            {{/if}}
          </div>
        </div>
      </div>
    </section>
    {{/if}}

    <!-- Désignation du logement -->
    <section class="section no-break">
      <h2 class="section-title">ARTICLE 1 - DÉSIGNATION DU LOGEMENT</h2>
      <div class="section-content">
        <div class="info-box">
          <div class="info-box-title">CARACTÉRISTIQUES DU LOGEMENT</div>
          <div class="info-grid">
            <span class="info-label">Adresse :</span>
            <span class="info-value"><strong>{{LOGEMENT_ADRESSE}}</strong></span>
            <span class="info-label">Code postal :</span>
            <span class="info-value">{{LOGEMENT_CODE_POSTAL}}</span>
            <span class="info-label">Ville :</span>
            <span class="info-value">{{LOGEMENT_VILLE}}</span>
            <span class="info-label">Type :</span>
            <span class="info-value">{{LOGEMENT_TYPE}}</span>
            <span class="info-label">Surface habitable :</span>
            <span class="info-value">{{LOGEMENT_SURFACE}} m²</span>
            {{#if LOGEMENT_ETAGE}}
            <span class="info-label">Étage :</span>
            <span class="info-value">{{LOGEMENT_ETAGE}}{{#if LOGEMENT_ASCENSEUR}} (avec ascenseur){{else}} (sans ascenseur){{/if}}</span>
            {{/if}}
          </div>
        </div>

        <p>Le logement est loué <strong>meublé</strong>, conformément au décret n°2015-981 du 31 juillet 2015 fixant la liste des éléments de mobilier d'un logement meublé.</p>

        <div class="alert alert-info">
          <strong>Important :</strong> Le logement meublé doit comprendre au minimum les éléments listés à l'annexe « Inventaire du mobilier ».
        </div>
      </div>
    </section>

    <!-- Durée du bail -->
    <section class="section no-break page-break">
      <h2 class="section-title">ARTICLE 2 - DURÉE DU BAIL</h2>
      <div class="section-content">
        <div class="duration-box">
          <div class="duration-label">Durée du Bail</div>
          <div class="duration-value">9 MOIS</div>
          <div class="duration-dates">Non renouvelable par tacite reconduction</div>
        </div>

        <div class="article">
          <p>Le présent bail est conclu pour une <strong>durée de neuf mois</strong>, conformément à l'article 25-9 de la loi du 6 juillet 1989.</p>

          <table>
            <tr>
              <th>Date de prise d'effet</th>
              <td>{{DATE_DEBUT}}</td>
            </tr>
            <tr>
              <th>Date de fin</th>
              <td>{{DATE_FIN}}</td>
            </tr>
            <tr>
              <th>Année universitaire</th>
              <td>{{ANNEE_UNIVERSITAIRE}}</td>
            </tr>
          </table>
        </div>

        <div class="alert alert-warning">
          <strong>⚠️ Attention :</strong> Ce bail ne se renouvelle pas par tacite reconduction. À son terme, le locataire doit libérer les lieux. Si les parties souhaitent poursuivre la location, un nouveau bail devra être signé.
        </div>

        <div class="article">
          <div class="article-title">Résiliation anticipée</div>
          <div class="article-content">
            <p>Le locataire peut résilier le bail à tout moment, sous réserve du respect d'un <strong>préavis d'un mois</strong>, notifié par lettre recommandée avec accusé de réception ou par acte d'huissier.</p>
            <p>Le bailleur ne peut donner congé au locataire pendant la durée du bail, sauf en cas de manquement grave du locataire à ses obligations.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Conditions financières -->
    <section class="section no-break">
      <h2 class="section-title">ARTICLE 3 - CONDITIONS FINANCIÈRES</h2>
      <div class="section-content">
        <table class="financial-table">
          <thead>
            <tr>
              <th>Désignation</th>
              <th style="width: 120px;">Montant mensuel</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Loyer hors charges</td>
              <td class="amount">{{LOYER_MENSUEL}} €</td>
            </tr>
            <tr>
              <td>Charges forfaitaires</td>
              <td class="amount">{{CHARGES}} €</td>
            </tr>
            <tr class="total-row">
              <td><strong>TOTAL MENSUEL</strong></td>
              <td class="amount"><strong>{{TOTAL_MENSUEL}} €</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="article">
          <div class="article-title">Dépôt de garantie</div>
          <div class="article-content">
            <p>Un dépôt de garantie d'un montant de <strong>{{DEPOT_GARANTIE}} €</strong> est versé à la signature du bail.</p>
            <p>Ce montant correspond à {{DEPOT_GARANTIE_MOIS}} mois de loyer hors charges, dans la limite légale de deux mois pour les locations meublées (article 25-6 de la loi du 6 juillet 1989).</p>
            <p>Ce dépôt sera restitué dans un délai d'un mois après la restitution des clés si l'état des lieux de sortie est conforme, ou de deux mois en cas de différences constatées.</p>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Modalités de paiement</div>
          <div class="article-content">
            <p>Le loyer et les charges sont payables d'avance, le <strong>{{JOUR_PAIEMENT}}</strong> de chaque mois.</p>
            <p>Mode de paiement : <strong>{{MODE_PAIEMENT}}</strong></p>
          </div>
        </div>

        {{#if APL_ELIGIBLE}}
        <div class="alert alert-success">
          <strong>✓ Logement éligible aux APL :</strong> Le locataire peut effectuer une demande d'aide personnalisée au logement auprès de la CAF.
        </div>
        {{/if}}
      </div>
    </section>

    <!-- Garant ou Visale -->
    {{#if GARANT_NOM}}
    <section class="section no-break">
      <h2 class="section-title">ARTICLE 4 - CAUTIONNEMENT</h2>
      <div class="section-content">
        <div class="garant-section">
          <div class="garant-title">ENGAGEMENT DE CAUTION</div>

          <div class="info-grid">
            <span class="info-label">Nom du garant :</span>
            <span class="info-value"><strong>{{GARANT_NOM}} {{GARANT_PRENOM}}</strong></span>
            <span class="info-label">Adresse :</span>
            <span class="info-value">{{GARANT_ADRESSE}}</span>
            {{#if GARANT_TELEPHONE}}
            <span class="info-label">Téléphone :</span>
            <span class="info-value">{{GARANT_TELEPHONE}}</span>
            {{/if}}
            <span class="info-label">Type de caution :</span>
            <span class="info-value">{{GARANT_TYPE_CAUTION}}</span>
            {{#if GARANT_MONTANT}}
            <span class="info-label">Montant engagé :</span>
            <span class="info-value">{{GARANT_MONTANT}} €</span>
            {{/if}}
          </div>

          <p style="margin-top: 15px; font-size: 10pt;">
            {{#if GARANT_SOLIDAIRE}}
            Le garant s'engage en qualité de <strong>caution solidaire</strong>, renonçant expressément aux bénéfices de discussion et de division. Le bailleur pourra le poursuivre directement, sans avoir à agir préalablement contre le locataire.
            {{else}}
            Le garant s'engage en qualité de <strong>caution simple</strong>. Le bailleur devra préalablement poursuivre le locataire avant de se retourner contre le garant.
            {{/if}}
          </p>
        </div>
      </div>
    </section>
    {{/if}}

    {{#if VISALE_NUMERO}}
    <section class="section no-break">
      <h2 class="section-title">ARTICLE 4 - GARANTIE VISALE</h2>
      <div class="section-content">
        <div style="text-align: center; margin: 20px 0;">
          <span class="visale-badge">✓ Garantie VISALE active</span>
        </div>

        <div class="info-box">
          <div class="info-grid">
            <span class="info-label">N° de visa :</span>
            <span class="info-value"><strong>{{VISALE_NUMERO}}</strong></span>
            <span class="info-label">Montant couvert :</span>
            <span class="info-value">{{VISALE_MONTANT}} €</span>
          </div>
        </div>

        <p>Le locataire bénéficie de la garantie VISALE délivrée par Action Logement. Cette garantie couvre les impayés de loyers et charges, ainsi que les dégradations locatives, dans les conditions définies par le dispositif.</p>

        <div class="alert alert-info">
          <strong>Note :</strong> En cas de mise en jeu de la garantie VISALE, le bailleur devra effectuer sa déclaration d'impayé via le portail visale.fr dans les 30 jours suivant le premier impayé.
        </div>
      </div>
    </section>
    {{/if}}

    <!-- Obligations -->
    <section class="section page-break">
      <h2 class="section-title">ARTICLE 5 - OBLIGATIONS DES PARTIES</h2>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Obligations du bailleur</div>
          <div class="article-content">
            <ul>
              <li>Délivrer un logement décent, répondant aux caractéristiques définies par le décret n°2002-120 du 30 janvier 2002</li>
              <li>Remettre au locataire un logement en bon état d'usage et de réparations, ainsi que les équipements mentionnés au contrat en bon état de fonctionnement</li>
              <li>Assurer la jouissance paisible du logement et le garantir des vices et défauts de nature à y faire obstacle</li>
              <li>Entretenir les locaux en état de servir à l'usage prévu et y faire toutes les réparations autres que locatives</li>
              <li>Remettre gratuitement une quittance de loyer si le locataire en fait la demande</li>
            </ul>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Obligations du locataire</div>
          <div class="article-content">
            <ul>
              <li>Payer le loyer et les charges aux termes convenus</li>
              <li>User paisiblement des locaux loués suivant la destination prévue au contrat</li>
              <li>Répondre des dégradations et pertes survenant dans le logement pendant la durée du bail, sauf preuve de force majeure, de faute du bailleur ou du fait d'un tiers</li>
              <li>Prendre à sa charge les réparations locatives définies par le décret n°87-712 du 26 août 1987</li>
              <li>Laisser exécuter dans les lieux loués les travaux d'amélioration des parties communes ou privatives ainsi que les travaux nécessaires au maintien en état et à l'entretien normal des locaux</li>
              <li>Ne pas transformer les locaux et équipements loués sans l'accord écrit du bailleur</li>
              <li>S'assurer contre les risques locatifs (incendie, dégâts des eaux) et en justifier à la première demande du bailleur</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Inventaire mobilier -->
    <section class="section no-break">
      <h2 class="section-title">ARTICLE 6 - INVENTAIRE DU MOBILIER</h2>
      <div class="section-content">
        <p>Conformément au décret n°2015-981 du 31 juillet 2015, le logement comprend les éléments suivants :</p>

        <div class="equipment-list">
          {{#each EQUIPEMENTS}}
          <div class="equipment-item">{{this}}</div>
          {{/each}}
        </div>

        <div class="alert alert-info">
          <strong>Note :</strong> Un inventaire détaillé et chiffré du mobilier est annexé au présent contrat. Il fait partie intégrante du bail.
        </div>
      </div>
    </section>

    <!-- État des lieux -->
    <section class="section no-break">
      <h2 class="section-title">ARTICLE 7 - ÉTAT DES LIEUX</h2>
      <div class="section-content">
        <p>Un état des lieux est établi contradictoirement par les parties lors de la remise et de la restitution des clés, conformément au décret n°2016-382 du 30 mars 2016.</p>

        <p>L'état des lieux d'entrée est réalisé lors de la remise des clés, et l'état des lieux de sortie lors de leur restitution.</p>

        <div class="alert alert-warning">
          <strong>Important :</strong> En l'absence d'état des lieux d'entrée, le locataire est présumé avoir reçu le logement en bon état de réparations locatives.
        </div>
      </div>
    </section>

    <!-- Clauses particulières -->
    <section class="section no-break">
      <h2 class="section-title">ARTICLE 8 - CLAUSES PARTICULIÈRES</h2>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Justificatif de statut étudiant</div>
          <div class="article-content">
            <p>Le présent bail est conclu au regard du statut d'étudiant du locataire, attesté par le justificatif visé en préambule. Le locataire s'engage à informer le bailleur de tout changement de situation susceptible de remettre en cause ce statut.</p>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Sous-location</div>
          <div class="article-content">
            <p>La sous-location totale ou partielle du logement est <strong>interdite</strong>, sauf accord écrit et préalable du bailleur.</p>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Animaux</div>
          <div class="article-content">
            <p>La détention d'animaux est soumise à l'accord préalable et écrit du bailleur, à l'exception des animaux de compagnie non dangereux et non susceptibles de causer des nuisances.</p>
          </div>
        </div>

        {{#if CLAUSES_PARTICULIERES}}
        <div class="article">
          <div class="article-title">Autres clauses</div>
          <div class="article-content">
            <p>{{CLAUSES_PARTICULIERES}}</p>
          </div>
        </div>
        {{/if}}
      </div>
    </section>

    <!-- Signatures -->
    <section class="section page-break">
      <h2 class="section-title">SIGNATURES</h2>
      <div class="section-content">
        <p style="text-align: center; margin-bottom: 20px;">
          Fait à <strong>{{LIEU_SIGNATURE}}</strong>, le <strong>{{DATE_SIGNATURE}}</strong>, en deux exemplaires originaux.
        </p>

        <div class="signatures">
          <div class="signature-box">
            <div class="role">LE BAILLEUR</div>
            <div class="name">{{BAILLEUR_NOM}}</div>
            <div class="mention">Lu et approuvé, bon pour accord</div>
            <div class="signature-area">
              {{#if SIGNATURE_BAILLEUR}}
              <img src="{{SIGNATURE_BAILLEUR}}" alt="Signature bailleur">
              {{else}}
              Signature
              {{/if}}
            </div>
            <div class="signature-date">Date : {{DATE_SIGNATURE}}</div>
          </div>

          <div class="signature-box">
            <div class="role">LE LOCATAIRE</div>
            <div class="name">{{LOCATAIRE_PRENOM}} {{LOCATAIRE_NOM}}</div>
            <div class="mention">Lu et approuvé, bon pour accord</div>
            <div class="signature-area">
              {{#if SIGNATURE_LOCATAIRE}}
              <img src="{{SIGNATURE_LOCATAIRE}}" alt="Signature locataire">
              {{else}}
              Signature
              {{/if}}
            </div>
            <div class="signature-date">Date : {{DATE_SIGNATURE}}</div>
          </div>
        </div>

        {{#if GARANT_NOM}}
        <div style="margin-top: 30px;">
          <div class="signature-box" style="max-width: 350px; margin: 0 auto;">
            <div class="role">LE GARANT</div>
            <div class="name">{{GARANT_PRENOM}} {{GARANT_NOM}}</div>
            <div class="mention">Lu et approuvé, bon pour caution {{#if GARANT_SOLIDAIRE}}solidaire{{else}}simple{{/if}}</div>
            <div class="signature-area">
              {{#if SIGNATURE_GARANT}}
              <img src="{{SIGNATURE_GARANT}}" alt="Signature garant">
              {{else}}
              Signature
              {{/if}}
            </div>
            <div class="signature-date">Date : {{DATE_SIGNATURE}}</div>
          </div>
        </div>
        {{/if}}
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="legal">
        Bail étudiant conforme à l'article 25-9 de la loi n°89-462 du 6 juillet 1989 modifiée.<br>
        Décret n°2015-981 du 31 juillet 2015 relatif aux éléments de mobilier d'un logement meublé.
      </div>
      <div class="generated">
        Document généré le {{DATE_GENERATION}} - Référence {{REFERENCE}}
      </div>
    </footer>
  </div>
</body>
</html>`;

/**
 * Variables du template bail étudiant
 */
export const BAIL_ETUDIANT_VARIABLES = {
  // Métadonnées
  REFERENCE: 'Référence unique du bail',
  DATE_GENERATION: 'Date de génération du document',
  DATE_SIGNATURE: 'Date de signature',
  LIEU_SIGNATURE: 'Lieu de signature',
  ANNEE_UNIVERSITAIRE: 'Année universitaire (ex: 2025-2026)',

  // Bailleur
  BAILLEUR_NOM: 'Nom ou raison sociale du bailleur',
  BAILLEUR_TYPE_SOCIETE: 'true si personne morale',
  BAILLEUR_REPRESENTANT: 'Représentant légal si société',
  BAILLEUR_SIRET: 'SIRET si applicable',
  BAILLEUR_ADRESSE: 'Adresse du bailleur',
  BAILLEUR_EMAIL: 'Email du bailleur',
  BAILLEUR_TELEPHONE: 'Téléphone du bailleur',

  // Locataire
  LOCATAIRE_NOM: 'Nom du locataire',
  LOCATAIRE_PRENOM: 'Prénom du locataire',
  LOCATAIRE_DATE_NAISSANCE: 'Date de naissance',
  LOCATAIRE_LIEU_NAISSANCE: 'Lieu de naissance',
  LOCATAIRE_NATIONALITE: 'Nationalité',
  LOCATAIRE_EMAIL: 'Email du locataire',
  LOCATAIRE_TELEPHONE: 'Téléphone du locataire',

  // Cursus
  ETABLISSEMENT_NOM: "Nom de l'établissement d'enseignement",
  ETABLISSEMENT_TYPE: "Type d'établissement",
  ETABLISSEMENT_VILLE: "Ville de l'établissement",
  FORMATION: 'Intitulé de la formation',
  NIVEAU_ETUDES: "Niveau d'études",
  NUMERO_INE: 'Numéro INE (optionnel)',

  // Justificatif
  JUSTIFICATIF_TYPE: 'Type de justificatif (carte étudiant, certificat...)',
  JUSTIFICATIF_NUMERO: 'Numéro du justificatif',
  JUSTIFICATIF_VALIDITE: 'Date de validité',
  JUSTIFICATIF_EMETTEUR: 'Établissement émetteur',

  // Responsable
  RESPONSABLE_NOM: 'Nom du parent/responsable',
  RESPONSABLE_PRENOM: 'Prénom du responsable',
  RESPONSABLE_LIEN: 'Lien (père, mère, tuteur...)',
  RESPONSABLE_TELEPHONE: 'Téléphone du responsable',
  RESPONSABLE_EMAIL: 'Email du responsable',

  // Logement
  LOGEMENT_ADRESSE: 'Adresse complète du logement',
  LOGEMENT_CODE_POSTAL: 'Code postal',
  LOGEMENT_VILLE: 'Ville',
  LOGEMENT_TYPE: 'Type de logement (Studio, T1...)',
  LOGEMENT_SURFACE: 'Surface en m²',
  LOGEMENT_ETAGE: 'Étage',
  LOGEMENT_ASCENSEUR: 'true si ascenseur',

  // Conditions financières
  LOYER_MENSUEL: 'Loyer hors charges',
  CHARGES: 'Charges forfaitaires',
  TOTAL_MENSUEL: 'Total mensuel (loyer + charges)',
  DEPOT_GARANTIE: 'Montant du dépôt de garantie',
  DEPOT_GARANTIE_MOIS: 'Nombre de mois de dépôt',
  JOUR_PAIEMENT: 'Jour de paiement mensuel',
  MODE_PAIEMENT: 'Mode de paiement (virement, prélèvement...)',
  APL_ELIGIBLE: 'true si éligible APL',

  // Durée
  DATE_DEBUT: 'Date de début du bail',
  DATE_FIN: 'Date de fin du bail',

  // Garant
  GARANT_NOM: 'Nom du garant',
  GARANT_PRENOM: 'Prénom du garant',
  GARANT_ADRESSE: 'Adresse du garant',
  GARANT_TELEPHONE: 'Téléphone du garant',
  GARANT_TYPE_CAUTION: 'Type (simple/solidaire)',
  GARANT_SOLIDAIRE: 'true si caution solidaire',
  GARANT_MONTANT: 'Montant maximum engagé',

  // Visale
  VISALE_NUMERO: 'Numéro de visa VISALE',
  VISALE_MONTANT: 'Montant couvert',

  // Équipements
  EQUIPEMENTS: 'Liste des équipements du logement meublé',

  // Clauses
  CLAUSES_PARTICULIERES: 'Clauses particulières additionnelles',

  // Signatures
  SIGNATURE_BAILLEUR: 'Image signature bailleur (base64 ou URL)',
  SIGNATURE_LOCATAIRE: 'Image signature locataire',
  SIGNATURE_GARANT: 'Image signature garant',
};
