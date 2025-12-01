/**
 * Template de contrat de location de parking
 * Conforme au droit commun des baux (Code civil, articles 1709 et suivants)
 * 
 * ⚠️ Note juridique importante :
 * Le contrat de location de parking n'est PAS soumis à la loi du 6 juillet 1989.
 * Il relève du droit commun des contrats de louage (Code civil).
 * Les parties disposent donc d'une grande liberté contractuelle.
 */

export const BAIL_PARKING_TEMPLATE = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrat de Location de Parking - {{REFERENCE_BAIL}}</title>
  <style>
    @page {
      margin: 2cm;
      size: A4;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Marianne', 'Segoe UI', system-ui, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
    }
    
    .document {
      max-width: 21cm;
      margin: 0 auto;
      padding: 2cm;
    }
    
    .header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 3px solid #000091;
    }
    
    .header h1 {
      font-size: 18pt;
      font-weight: 700;
      color: #000091;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .header .subtitle {
      font-size: 12pt;
      color: #666;
      font-style: italic;
    }
    
    .header .reference {
      font-size: 10pt;
      color: #888;
      margin-top: 0.5rem;
    }
    
    .legal-notice {
      background: #f5f5fe;
      border-left: 4px solid #000091;
      padding: 1rem;
      margin: 1.5rem 0;
      font-size: 10pt;
      color: #3a3a3a;
    }
    
    .section {
      margin: 1.5rem 0;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 13pt;
      font-weight: 700;
      color: #000091;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e5e5;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .section-title::before {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #000091;
      border-radius: 50%;
    }
    
    .party-box {
      background: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 1.25rem;
      margin: 1rem 0;
    }
    
    .party-box .party-title {
      font-weight: 600;
      color: #000091;
      margin-bottom: 0.75rem;
      font-size: 11pt;
    }
    
    .party-box p {
      margin: 0.25rem 0;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin: 1rem 0;
    }
    
    .info-item {
      padding: 0.75rem;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e9ecef;
    }
    
    .info-item .label {
      font-size: 9pt;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.25rem;
    }
    
    .info-item .value {
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .parking-details {
      background: linear-gradient(135deg, #f5f5fe 0%, #fff 100%);
      border: 2px solid #000091;
      border-radius: 12px;
      padding: 1.5rem;
      margin: 1.5rem 0;
    }
    
    .parking-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .parking-icon {
      font-size: 2rem;
      background: #000091;
      color: #fff;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .parking-type {
      font-size: 14pt;
      font-weight: 700;
      color: #000091;
    }
    
    .features-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    .feature-badge {
      background: #e3e3fd;
      color: #000091;
      padding: 0.35rem 0.75rem;
      border-radius: 20px;
      font-size: 9pt;
      font-weight: 500;
    }
    
    .financial-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    
    .financial-table th,
    .financial-table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }
    
    .financial-table th {
      background: #f5f5fe;
      font-weight: 600;
      color: #000091;
    }
    
    .financial-table .amount {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
    }
    
    .financial-table .total-row {
      background: #000091;
      color: #fff;
    }
    
    .financial-table .total-row td {
      font-weight: 700;
      border: none;
    }
    
    .article {
      margin: 1rem 0;
      padding: 0.75rem 0;
    }
    
    .article-title {
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 0.5rem;
    }
    
    .article-content {
      text-align: justify;
      color: #3a3a3a;
    }
    
    .article-content ul {
      margin: 0.5rem 0 0.5rem 1.5rem;
    }
    
    .article-content li {
      margin: 0.25rem 0;
    }
    
    .highlight-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
    }
    
    .highlight-box.danger {
      background: #f8d7da;
      border-color: #dc3545;
    }
    
    .highlight-box.success {
      background: #d4edda;
      border-color: #28a745;
    }
    
    .signature-section {
      margin-top: 3rem;
      page-break-inside: avoid;
    }
    
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3rem;
      margin-top: 1.5rem;
    }
    
    .signature-box {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 1.5rem;
      min-height: 180px;
    }
    
    .signature-box .sig-title {
      font-weight: 600;
      color: #000091;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e5e5e5;
    }
    
    .signature-box .sig-label {
      font-size: 9pt;
      color: #666;
      margin-bottom: 2rem;
    }
    
    .signature-box .sig-line {
      border-bottom: 1px solid #1a1a1a;
      height: 60px;
    }
    
    .signature-box .sig-name {
      margin-top: 0.5rem;
      font-size: 10pt;
      color: #666;
    }
    
    .footer-legal {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e5e5;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    @media print {
      .document {
        padding: 0;
      }
      
      .section {
        page-break-inside: avoid;
      }
      
      .signature-section {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="document">
    <!-- EN-TÊTE -->
    <header class="header">
      <h1>Contrat de Location de Parking</h1>
      <p class="subtitle">{{PARKING_CATEGORY_LABEL}}</p>
      <p class="reference">Référence : {{REFERENCE_BAIL}} • Établi le {{DATE_GENERATION}}</p>
    </header>
    
    <!-- AVERTISSEMENT JURIDIQUE -->
    <div class="legal-notice">
      <strong>📋 Régime juridique applicable</strong><br>
      Le présent contrat est soumis aux dispositions des articles 1709 et suivants du Code civil relatifs au louage de choses. 
      Il n'est <strong>pas soumis</strong> aux dispositions de la loi n°89-462 du 6 juillet 1989 relative aux rapports locatifs.
      {{#if ACCESSOIRE_LOGEMENT}}
      <br><br>
      <em>Ce parking est loué comme accessoire au logement situé au {{LOGEMENT_LIE_ADRESSE}}.</em>
      {{/if}}
    </div>
    
    <!-- SECTION 1 : PARTIES -->
    <section class="section">
      <h2 class="section-title">Désignation des parties</h2>
      
      <div class="party-box">
        <p class="party-title">LE BAILLEUR</p>
        <p><strong>{{BAILLEUR_NOM_COMPLET}}</strong></p>
        {{#if BAILLEUR_SOCIETE}}
        <p>{{BAILLEUR_RAISON_SOCIALE}} ({{BAILLEUR_FORME_JURIDIQUE}})</p>
        <p>SIRET : {{BAILLEUR_SIRET}}</p>
        <p>Représentée par : {{BAILLEUR_REPRESENTANT}}</p>
        {{/if}}
        <p>Demeurant : {{BAILLEUR_ADRESSE}}</p>
        <p>{{BAILLEUR_CODE_POSTAL}} {{BAILLEUR_VILLE}}</p>
        {{#if BAILLEUR_EMAIL}}<p>Email : {{BAILLEUR_EMAIL}}</p>{{/if}}
        {{#if BAILLEUR_TELEPHONE}}<p>Tél : {{BAILLEUR_TELEPHONE}}</p>{{/if}}
      </div>
      
      <p style="text-align: center; font-weight: 600; margin: 1rem 0; color: #666;">ci-après dénommé « le Bailleur »</p>
      
      <div class="party-box">
        <p class="party-title">LE LOCATAIRE</p>
        <p><strong>{{LOCATAIRE_NOM_COMPLET}}</strong></p>
        {{#if LOCATAIRE_SOCIETE}}
        <p>{{LOCATAIRE_RAISON_SOCIALE}} ({{LOCATAIRE_FORME_JURIDIQUE}})</p>
        <p>SIRET : {{LOCATAIRE_SIRET}}</p>
        {{else}}
        <p>Né(e) le {{LOCATAIRE_DATE_NAISSANCE}} à {{LOCATAIRE_LIEU_NAISSANCE}}</p>
        <p>Nationalité : {{LOCATAIRE_NATIONALITE}}</p>
        {{/if}}
        <p>Demeurant actuellement : {{LOCATAIRE_ADRESSE}}</p>
        <p>{{LOCATAIRE_CODE_POSTAL}} {{LOCATAIRE_VILLE}}</p>
        {{#if LOCATAIRE_EMAIL}}<p>Email : {{LOCATAIRE_EMAIL}}</p>{{/if}}
        {{#if LOCATAIRE_TELEPHONE}}<p>Tél : {{LOCATAIRE_TELEPHONE}}</p>{{/if}}
      </div>
      
      <p style="text-align: center; font-weight: 600; margin: 1rem 0; color: #666;">ci-après dénommé « le Locataire »</p>
    </section>
    
    <!-- SECTION 2 : DÉSIGNATION DU PARKING -->
    <section class="section">
      <h2 class="section-title">Désignation de l'emplacement</h2>
      
      <div class="parking-details">
        <div class="parking-header">
          <div class="parking-icon">{{PARKING_ICON}}</div>
          <div>
            <p class="parking-type">{{PARKING_CATEGORY_LABEL}}</p>
            <p style="color: #666;">{{PARKING_DESCRIPTION}}</p>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-item">
            <p class="label">Adresse</p>
            <p class="value">{{PARKING_ADRESSE}}</p>
            <p style="font-size: 10pt; color: #666;">{{PARKING_CODE_POSTAL}} {{PARKING_VILLE}}</p>
          </div>
          
          <div class="info-item">
            <p class="label">Emplacement</p>
            <p class="value">N° {{PARKING_NUMERO}}</p>
            {{#if PARKING_NIVEAU}}<p style="font-size: 10pt; color: #666;">Niveau : {{PARKING_NIVEAU}}</p>{{/if}}
            {{#if PARKING_ZONE}}<p style="font-size: 10pt; color: #666;">Zone : {{PARKING_ZONE}}</p>{{/if}}
          </div>
          
          {{#if PARKING_DIMENSIONS}}
          <div class="info-item">
            <p class="label">Dimensions</p>
            <p class="value">{{PARKING_LONGUEUR}} × {{PARKING_LARGEUR}} m</p>
            {{#if PARKING_HAUTEUR}}<p style="font-size: 10pt; color: #666;">Hauteur max : {{PARKING_HAUTEUR}} m</p>{{/if}}
          </div>
          {{/if}}
          
          <div class="info-item">
            <p class="label">Type de véhicule autorisé</p>
            <p class="value">{{VEHICULE_TYPE_LABEL}}</p>
          </div>
        </div>
        
        <div class="features-list">
          {{#if PARKING_COUVERT}}<span class="feature-badge">☔ Couvert</span>{{/if}}
          {{#if PARKING_FERME}}<span class="feature-badge">🔒 Fermé</span>{{/if}}
          {{#if PARKING_ECLAIRE}}<span class="feature-badge">💡 Éclairé</span>{{/if}}
          {{#if PARKING_PRISE}}<span class="feature-badge">🔌 Prise électrique</span>{{/if}}
          {{#if PARKING_BORNE_VE}}<span class="feature-badge">⚡ Borne de recharge</span>{{/if}}
          {{#if PARKING_VIDEO}}<span class="feature-badge">📹 Vidéosurveillance</span>{{/if}}
          {{#if PARKING_GARDIEN}}<span class="feature-badge">👮 Gardiennage</span>{{/if}}
          {{#if PARKING_BARRIERE}}<span class="feature-badge">🚧 Barrière automatique</span>{{/if}}
        </div>
      </div>
      
      <div class="article">
        <p class="article-title">Moyens d'accès</p>
        <p class="article-content">
          L'accès à l'emplacement est assuré par : {{ACCES_METHODES}}.
          {{#if ACCES_RESTREINT}}
          <br>Horaires d'accès : {{ACCES_HORAIRES}}.
          {{/if}}
        </p>
      </div>
    </section>
    
    <!-- SECTION 3 : DURÉE -->
    <section class="section">
      <h2 class="section-title">Durée du contrat</h2>
      
      <div class="info-grid">
        <div class="info-item">
          <p class="label">Date d'effet</p>
          <p class="value">{{BAIL_DATE_DEBUT}}</p>
        </div>
        
        <div class="info-item">
          <p class="label">Durée</p>
          <p class="value">{{BAIL_DUREE}}</p>
        </div>
        
        {{#if BAIL_DATE_FIN}}
        <div class="info-item">
          <p class="label">Date de fin prévue</p>
          <p class="value">{{BAIL_DATE_FIN}}</p>
        </div>
        {{/if}}
      </div>
      
      <div class="article">
        <p class="article-content">
          {{#if DUREE_INDETERMINEE}}
          Le présent contrat est conclu pour une <strong>durée indéterminée</strong>, chacune des parties pouvant y mettre fin à tout moment sous réserve de respecter le préavis prévu ci-après.
          {{else}}
          Le présent contrat est conclu pour une <strong>durée déterminée de {{BAIL_DUREE_MOIS}} mois</strong>, du {{BAIL_DATE_DEBUT}} au {{BAIL_DATE_FIN}}.
          À défaut de congé donné par l'une des parties, le contrat sera reconduit tacitement pour des périodes successives de même durée.
          {{/if}}
        </p>
      </div>
      
      <div class="highlight-box">
        <strong>📅 Préavis de résiliation</strong><br>
        • Par le Bailleur : <strong>{{PREAVIS_BAILLEUR}} mois</strong><br>
        • Par le Locataire : <strong>{{PREAVIS_LOCATAIRE}} mois</strong><br>
        <em style="font-size: 10pt;">Le congé doit être notifié par lettre recommandée avec accusé de réception.</em>
      </div>
    </section>
    
    <!-- SECTION 4 : CONDITIONS FINANCIÈRES -->
    <section class="section page-break">
      <h2 class="section-title">Conditions financières</h2>
      
      <table class="financial-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th class="amount">Montant mensuel</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Loyer{{#if TVA_APPLICABLE}} (HT){{/if}}</td>
            <td class="amount">{{LOYER_MENSUEL}} €</td>
          </tr>
          {{#if TVA_APPLICABLE}}
          <tr>
            <td>TVA ({{TVA_TAUX}}%)</td>
            <td class="amount">{{TVA_MONTANT}} €</td>
          </tr>
          {{/if}}
          {{#if CHARGES_MONTANT}}
          <tr>
            <td>Charges ({{CHARGES_TYPE_LABEL}})</td>
            <td class="amount">{{CHARGES_MONTANT}} €</td>
          </tr>
          {{/if}}
          <tr class="total-row">
            <td>TOTAL MENSUEL</td>
            <td class="amount">{{LOYER_TOTAL}} €</td>
          </tr>
        </tbody>
      </table>
      
      <p style="font-style: italic; color: #666; font-size: 10pt; margin: 0.5rem 0;">
        Soit {{LOYER_LETTRES}} euros par mois.
      </p>
      
      <div class="info-grid" style="margin-top: 1.5rem;">
        <div class="info-item">
          <p class="label">Dépôt de garantie</p>
          <p class="value">{{DEPOT_GARANTIE}} €</p>
          <p style="font-size: 10pt; color: #666;">Équivalent à {{DEPOT_MOIS}} mois de loyer</p>
        </div>
        
        <div class="info-item">
          <p class="label">Mode de paiement</p>
          <p class="value">{{MODE_PAIEMENT}}</p>
          <p style="font-size: 10pt; color: #666;">Le {{JOUR_PAIEMENT}} de chaque mois</p>
        </div>
      </div>
      
      {{#if REVISION_AUTORISEE}}
      <div class="article">
        <p class="article-title">Révision du loyer</p>
        <p class="article-content">
          Le loyer sera révisé chaque année à la date anniversaire du contrat, en fonction de la variation de l'indice {{INDICE_REFERENCE}}.
          La révision s'effectuera de plein droit, sans notification préalable.
        </p>
      </div>
      {{/if}}
    </section>
    
    <!-- SECTION 5 : OBLIGATIONS DES PARTIES -->
    <section class="section">
      <h2 class="section-title">Obligations des parties</h2>
      
      <div class="article">
        <p class="article-title">Article 1 - Obligations du Bailleur</p>
        <p class="article-content">
          Le Bailleur s'engage à :
          <ul>
            <li>Délivrer l'emplacement en bon état d'usage et de réparations</li>
            <li>Assurer au Locataire la jouissance paisible de l'emplacement</li>
            <li>Maintenir les équipements communs en bon état de fonctionnement (accès, éclairage des parties communes, etc.)</li>
            <li>Remettre au Locataire les moyens d'accès prévus au contrat</li>
            {{#if PARKING_BORNE_VE}}<li>Assurer le bon fonctionnement et l'entretien de la borne de recharge</li>{{/if}}
          </ul>
        </p>
      </div>
      
      <div class="article">
        <p class="article-title">Article 2 - Obligations du Locataire</p>
        <p class="article-content">
          Le Locataire s'engage à :
          <ul>
            <li>Payer le loyer et les charges aux termes convenus</li>
            <li>User de l'emplacement en bon père de famille et conformément à la destination prévue</li>
            <li>N'y stationner que le type de véhicule autorisé : {{VEHICULE_TYPE_LABEL}}</li>
            <li>Ne procéder à aucune modification de l'emplacement sans l'accord écrit du Bailleur</li>
            <li>Permettre l'accès pour les travaux d'entretien ou de réparation</li>
            <li>Informer le Bailleur de tout dommage ou dégradation</li>
            <li>Restituer l'emplacement en bon état à la fin du contrat</li>
            {{#if ASSURANCE_OBLIGATOIRE}}<li>Souscrire une assurance couvrant sa responsabilité civile</li>{{/if}}
          </ul>
        </p>
      </div>
    </section>
    
    <!-- SECTION 6 : INTERDICTIONS -->
    <section class="section">
      <h2 class="section-title">Interdictions</h2>
      
      <div class="highlight-box danger">
        <strong>⛔ Il est formellement interdit au Locataire de :</strong>
        <ul style="margin-top: 0.5rem; margin-left: 1.5rem;">
          <li>Effectuer des réparations ou travaux mécaniques sur le véhicule</li>
          <li>Stocker des produits inflammables, explosifs ou dangereux</li>
          <li>Utiliser l'emplacement à des fins commerciales ou professionnelles{{#if USAGE_COMMERCIAL_AUTORISE}} (sauf accord préalable){{/if}}</li>
          {{#if SOUS_LOCATION_INTERDITE}}<li>Sous-louer ou prêter l'emplacement à un tiers</li>{{/if}}
          <li>Gêner l'accès ou le stationnement des autres usagers</li>
          <li>Y entreposer des objets ou matériaux encombrants hors du véhicule{{#if STOCKAGE_AUTORISE}} (sauf accord préalable){{/if}}</li>
          <li>Y laisser stationner un véhicule non assuré</li>
        </ul>
      </div>
    </section>
    
    <!-- SECTION 7 : ASSURANCE -->
    <section class="section">
      <h2 class="section-title">Assurance</h2>
      
      <div class="article">
        <p class="article-content">
          {{#if ASSURANCE_LOCATAIRE_OBLIGATOIRE}}
          Le Locataire est tenu de souscrire une assurance couvrant :
          <ul>
            <li>Sa responsabilité civile locative pour les dommages causés à l'emplacement</li>
            <li>Les risques d'incendie, explosion et dégât des eaux</li>
          </ul>
          Le Locataire devra justifier de cette assurance à première demande du Bailleur.
          {{else}}
          Le Bailleur déclare que les parties communes sont couvertes par l'assurance de l'immeuble.
          Le Locataire est vivement encouragé à souscrire une assurance pour son véhicule et ses effets personnels.
          {{/if}}
        </p>
      </div>
      
      <div class="article">
        <p class="article-content">
          <strong>Responsabilité :</strong> Le Bailleur décline toute responsabilité en cas de vol, dégradation, ou dommage au véhicule du Locataire, 
          sauf faute prouvée de sa part ou défaillance des systèmes de sécurité dont il a la charge.
        </p>
      </div>
    </section>
    
    <!-- SECTION 8 : VÉHICULE -->
    {{#if VEHICULE_IMMATRICULATION}}
    <section class="section">
      <h2 class="section-title">Véhicule déclaré</h2>
      
      <div class="info-grid">
        <div class="info-item">
          <p class="label">Immatriculation</p>
          <p class="value">{{VEHICULE_IMMATRICULATION}}</p>
        </div>
        {{#if VEHICULE_MARQUE}}
        <div class="info-item">
          <p class="label">Marque / Modèle</p>
          <p class="value">{{VEHICULE_MARQUE}} {{VEHICULE_MODELE}}</p>
        </div>
        {{/if}}
      </div>
      
      <p style="font-size: 10pt; color: #666; margin-top: 0.5rem;">
        Le Locataire s'engage à informer le Bailleur de tout changement de véhicule dans les meilleurs délais.
      </p>
    </section>
    {{/if}}
    
    <!-- SECTION 9 : CLAUSES PARTICULIÈRES -->
    {{#if CLAUSES_PARTICULIERES}}
    <section class="section">
      <h2 class="section-title">Clauses particulières</h2>
      
      <div class="article">
        <p class="article-content">
          {{CLAUSES_PARTICULIERES}}
        </p>
      </div>
    </section>
    {{/if}}
    
    <!-- SECTION 10 : RÉSILIATION -->
    <section class="section">
      <h2 class="section-title">Résiliation du contrat</h2>
      
      <div class="article">
        <p class="article-title">Résiliation à l'initiative du Locataire</p>
        <p class="article-content">
          Le Locataire peut résilier le présent contrat à tout moment, sous réserve de respecter un préavis de 
          <strong>{{PREAVIS_LOCATAIRE}} mois</strong>. Le préavis court à compter de la réception par le Bailleur de la 
          lettre recommandée avec accusé de réception.
        </p>
      </div>
      
      <div class="article">
        <p class="article-title">Résiliation à l'initiative du Bailleur</p>
        <p class="article-content">
          Le Bailleur peut résilier le présent contrat sous réserve de respecter un préavis de 
          <strong>{{PREAVIS_BAILLEUR}} mois</strong>. Le congé doit être notifié par lettre recommandée avec accusé de réception.
        </p>
      </div>
      
      <div class="article">
        <p class="article-title">Résiliation de plein droit</p>
        <p class="article-content">
          Le présent contrat sera résilié de plein droit, après mise en demeure restée infructueuse pendant 30 jours, dans les cas suivants :
          <ul>
            <li>Non-paiement du loyer ou des charges à leur échéance</li>
            <li>Non-respect des obligations contractuelles</li>
            <li>Usage contraire à la destination de l'emplacement</li>
          </ul>
        </p>
      </div>
    </section>
    
    <!-- SECTION 11 : RESTITUTION -->
    <section class="section">
      <h2 class="section-title">Restitution de l'emplacement</h2>
      
      <div class="article">
        <p class="article-content">
          À la fin du contrat, le Locataire devra :
          <ul>
            <li>Libérer l'emplacement de tout véhicule et objet personnel</li>
            <li>Restituer les clés, badges, télécommandes ou tout autre moyen d'accès</li>
            <li>Remettre l'emplacement dans l'état où il l'a reçu, compte tenu de l'usure normale</li>
          </ul>
        </p>
      </div>
      
      <div class="article">
        <p class="article-content">
          <strong>Dépôt de garantie :</strong> Le dépôt de garantie sera restitué dans un délai maximal de 
          <strong>deux mois</strong> suivant la remise des clés, déduction faite des sommes restant dues au Bailleur 
          et des frais de remise en état s'il y a lieu (sur justificatifs).
        </p>
      </div>
    </section>
    
    <!-- SECTION 12 : ÉLECTION DE DOMICILE -->
    <section class="section">
      <h2 class="section-title">Élection de domicile et litiges</h2>
      
      <div class="article">
        <p class="article-content">
          Pour l'exécution des présentes, les parties font élection de domicile en leurs adresses respectives indiquées en tête du présent contrat.
          <br><br>
          En cas de litige relatif à l'interprétation ou à l'exécution du présent contrat, les parties s'engagent à rechercher 
          une solution amiable avant toute action judiciaire. À défaut d'accord, le tribunal compétent sera celui du lieu 
          de situation de l'emplacement.
        </p>
      </div>
    </section>
    
    <!-- SIGNATURES -->
    <section class="signature-section">
      <h2 class="section-title">Signatures</h2>
      
      <p style="margin-bottom: 1rem; font-size: 10pt; color: #666;">
        Fait en deux exemplaires originaux, à <strong>{{LIEU_SIGNATURE}}</strong>, le <strong>{{DATE_SIGNATURE}}</strong>.
      </p>
      
      <p style="margin-bottom: 1.5rem; font-size: 10pt; font-style: italic;">
        Les parties déclarent avoir pris connaissance de l'ensemble des conditions du présent contrat et les accepter sans réserve.
        Chaque partie reconnaît avoir reçu un exemplaire original du présent contrat.
      </p>
      
      <div class="signature-grid">
        <div class="signature-box">
          <p class="sig-title">Le Bailleur</p>
          <p class="sig-label">Lu et approuvé, "Bon pour accord"</p>
          <div class="sig-line"></div>
          <p class="sig-name">{{BAILLEUR_NOM_COMPLET}}</p>
        </div>
        
        <div class="signature-box">
          <p class="sig-title">Le Locataire</p>
          <p class="sig-label">Lu et approuvé, "Bon pour accord"</p>
          <div class="sig-line"></div>
          <p class="sig-name">{{LOCATAIRE_NOM_COMPLET}}</p>
        </div>
      </div>
    </section>
    
    <!-- PIED DE PAGE -->
    <footer class="footer-legal">
      <p>
        Contrat de location de parking généré automatiquement<br>
        Référence : {{REFERENCE_BAIL}} • {{DATE_GENERATION}}
      </p>
    </footer>
  </div>
</body>
</html>
`;

export default BAIL_PARKING_TEMPLATE;

