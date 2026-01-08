/**
 * Template de bail de location vide (nu)
 * Conforme à la loi ALUR et au décret n°2015-587 du 29 mai 2015
 * 
 * Durée : 3 ans minimum (6 ans si bailleur personne morale)
 * Dépôt de garantie : 1 mois maximum
 */

export const BAIL_NU_TEMPLATE = `
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
      border-bottom: 2px solid #000;
    }
    
    .header h1 {
      font-size: 18pt;
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
      background: #f5f5f5;
      border: 1px solid #ddd;
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
      background: #333;
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
      color: #333;
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
      border: 1px solid #ccc;
      padding: 15px;
    }
    
    .party-title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #eee;
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
      background: #f5f5f5;
      font-weight: bold;
      width: 40%;
    }
    
    .financial-summary {
      background: #f9f9f9;
      border: 2px solid #333;
      padding: 20px;
      margin: 20px 0;
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
      background: #333;
      color: #fff;
      margin: 10px -20px -20px;
      padding: 12px 20px;
    }
    
    .encadrement-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      margin: 15px 0;
    }
    
    .encadrement-title {
      font-weight: bold;
      color: #856404;
      margin-bottom: 10px;
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
    .diagnostic-value.class-d { color: #fee08b; color: #d9a200; }
    .diagnostic-value.class-e { color: #fdae61; color: #f57c00; }
    .diagnostic-value.class-f { color: #f46d43; color: #e53935; }
    .diagnostic-value.class-g { color: #d73027; }
    
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
      border: 1px solid #ccc;
      padding: 20px;
      min-height: 150px;
    }
    
    .signature-title {
      font-weight: bold;
      margin-bottom: 10px;
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
    
    .annexes-list {
      list-style: none;
      padding: 0;
    }
    
    .annexes-list li {
      padding: 8px 0;
      border-bottom: 1px dashed #ddd;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
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
      <div class="subtitle">Bail de location vide à usage de résidence principale</div>
      <div class="reference">Référence : {{REFERENCE_BAIL}}</div>
    </div>
    
    <div class="legal-notice">
      <strong>Loi n°89-462 du 6 juillet 1989</strong> tendant à améliorer les rapports locatifs<br>
      modifiée par la loi n°2014-366 du 24 mars 2014 (loi ALUR)<br>
      <em>Contrat type défini par le décret n°2015-587 du 29 mai 2015</em>
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
            {{#if MANDATAIRE_NOM}}
            <div class="party-info" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;">
              <span class="party-label">Représenté par (mandataire) :</span><br>
              <span class="party-value">{{MANDATAIRE_NOM}}</span><br>
              <span class="party-value">{{MANDATAIRE_ADRESSE}}</span>
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
            {{#if LOCATAIRE_2_NOM}}
            <div class="party-info" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;">
              <span class="party-label">Et :</span><br>
              <span class="party-value">{{LOCATAIRE_2_NOM}}</span><br>
              <span class="party-value">Né(e) le {{LOCATAIRE_2_DATE_NAISSANCE}} à {{LOCATAIRE_2_LIEU_NAISSANCE}}</span>
            </div>
            {{/if}}
          </div>
        </div>
        
        <p class="article-content">
          <strong>Ci-après dénommés respectivement "le bailleur" et "le locataire".</strong>
        </p>
      </div>
    </div>
    
    <!-- II. OBJET DU CONTRAT -->
    <div class="section">
      <div class="section-title">II. Objet du Contrat</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 1 - Objet</div>
          <p class="article-content">
            Le présent contrat a pour objet la location d'un logement ainsi déterminé, 
            destiné à l'usage exclusif d'habitation principale du locataire.
          </p>
        </div>
      </div>
    </div>
    
    <!-- III. DÉSIGNATION DES LOCAUX -->
    <div class="section">
      <div class="section-title">III. Désignation des Locaux</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 2 - Consistance du logement</div>
          
          <table class="info-table">
            <tr>
              <th>Adresse du logement</th>
              <td>{{LOGEMENT_ADRESSE}}<br>{{LOGEMENT_CODE_POSTAL}} {{LOGEMENT_VILLE}}</td>
            </tr>
            <tr>
              <th>Type de logement</th>
              <td>{{LOGEMENT_TYPE}}</td>
            </tr>
            <tr>
              <th>Régime juridique de l'immeuble</th>
              <td>{{LOGEMENT_REGIME}}</td>
            </tr>
            <tr>
              <th>Période de construction</th>
              <td>{{LOGEMENT_PERIODE_CONSTRUCTION}}</td>
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
        
        <div class="article">
          <div class="article-title">Article 3 - Éléments d'équipement</div>
          <p class="article-content">
            <strong>Équipements à usage privatif :</strong><br>
            {{LOGEMENT_EQUIPEMENTS}}
          </p>
          {{#if LOGEMENT_PARTIES_COMMUNES}}
          <p class="article-content" style="margin-top: 10px;">
            <strong>Parties et équipements communs :</strong><br>
            {{LOGEMENT_PARTIES_COMMUNES}}
          </p>
          {{/if}}
        </div>
        
        {{#if LOGEMENT_ANNEXES}}
        <div class="article">
          <div class="article-title">Article 4 - Annexes au logement</div>
          <p class="article-content">
            Le présent bail comprend également les annexes suivantes :<br>
            {{LOGEMENT_ANNEXES}}
          </p>
        </div>
        {{/if}}
        
        <div class="article">
          <div class="article-title">Article 5 - Modalités de production de chauffage et d'eau chaude</div>
          <table class="info-table">
            <tr>
              <th>Chauffage</th>
              <td>{{CHAUFFAGE_DISPLAY}}</td>
            </tr>
            <tr>
              <th>Production d'eau chaude</th>
              <td>{{EAU_CHAUDE_DISPLAY}}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
    
    <!-- IV. DATE DE PRISE D'EFFET ET DURÉE -->
    <div class="section page-break">
      <div class="section-title">IV. Date de Prise d'Effet et Durée</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 6 - Durée du bail</div>
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
            {{#if TACITE_RECONDUCTION}}
            À l'expiration de cette durée, le contrat sera reconduit tacitement pour une durée 
            de trois ans, sauf congé délivré dans les conditions légales.
            {{else}}
            Le présent bail prendra fin à la date sus-indiquée sans reconduction tacite.
            {{/if}}
          </p>
        </div>
      </div>
    </div>
    
    <!-- V. CONDITIONS FINANCIÈRES -->
    <div class="section">
      <div class="section-title">V. Conditions Financières</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 7 - Loyer</div>
          
          <div class="financial-summary">
            <div class="financial-row">
              <span>Loyer mensuel hors charges</span>
              <span><strong>{{LOYER_HC}} €</strong></span>
            </div>
            <div class="financial-row">
              <span>Provision sur charges (régularisation annuelle)</span>
              <span>{{CHARGES_MONTANT}} €</span>
            </div>
            {{#if COMPLEMENT_LOYER}}
            <div class="financial-row">
              <span>Complément de loyer</span>
              <span>{{COMPLEMENT_LOYER}} €</span>
            </div>
            {{/if}}
            <div class="financial-row total">
              <span>TOTAL MENSUEL À PAYER</span>
              <span>{{LOYER_TOTAL}} €</span>
            </div>
          </div>
          
          <p class="article-content">
            Soit en toutes lettres : <strong>{{LOYER_TOTAL_LETTRES}}</strong>
          </p>
          
          <table class="info-table" style="margin-top: 15px;">
            <tr>
              <th>Modalités de paiement</th>
              <td>{{MODE_PAIEMENT}}</td>
            </tr>
            <tr>
              <th>Périodicité</th>
              <td>{{PERIODICITE_PAIEMENT}}</td>
            </tr>
            <tr>
              <th>Date de paiement</th>
              <td>Le {{JOUR_PAIEMENT}} de chaque mois, {{TERME_PAIEMENT}}</td>
            </tr>
          </table>
        </div>
        
        {{#if ZONE_ENCADREMENT}}
        <div class="encadrement-box">
          <div class="encadrement-title">⚠️ Zone soumise à l'encadrement des loyers</div>
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
              <td>{{COMPLEMENT_LOYER}} €</td>
            </tr>
            <tr>
              <th>Justification du complément</th>
              <td>{{COMPLEMENT_JUSTIFICATION}}</td>
            </tr>
            {{/if}}
          </table>
          <p style="font-size: 9pt; margin-top: 10px;">
            Décret applicable : {{DECRET_ENCADREMENT}}
          </p>
        </div>
        {{/if}}
        
        {{#if LOYER_PRECEDENT}}
        <div class="article">
          <div class="article-title">Article 8 - Loyer du précédent locataire</div>
          <p class="article-content">
            Le montant du loyer appliqué au précédent locataire était de <strong>{{LOYER_PRECEDENT}} €</strong>.<br>
            Date de versement du dernier loyer : {{DATE_DERNIER_LOYER}}.
            {{#if LOYER_REVISION_JUSTIFICATION}}
            <br><br>
            <em>Justification de l'évolution du loyer :</em> {{LOYER_REVISION_JUSTIFICATION}}
            {{/if}}
          </p>
        </div>
        {{/if}}
        
        <div class="article">
          <div class="article-title">Article 9 - Révision du loyer</div>
          <p class="article-content">
            {{#if REVISION_AUTORISEE}}
            Le loyer sera révisé chaque année à la date anniversaire du bail, en fonction de la variation 
            de l'Indice de Référence des Loyers (IRL) publié par l'INSEE.<br><br>
            Indice de référence : <strong>IRL du {{TRIMESTRE_REFERENCE}}</strong>
            {{else}}
            Le présent bail ne prévoit pas de révision annuelle du loyer.
            {{/if}}
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 10 - Dépôt de garantie</div>
          <p class="article-content">
            Le locataire verse ce jour au bailleur la somme de <strong>{{DEPOT_GARANTIE}} €</strong> 
            ({{DEPOT_LETTRES}}) à titre de dépôt de garantie.<br><br>
            
            Cette somme ne pourra faire l'objet d'aucune révision et sera restituée au locataire 
            dans un délai maximum de :
            <ul style="margin-top: 10px; padding-left: 20px;">
              <li><strong>Un mois</strong> après la remise des clés si l'état des lieux de sortie 
              est conforme à l'état des lieux d'entrée</li>
              <li><strong>Deux mois</strong> dans le cas contraire</li>
            </ul>
          </p>
        </div>
      </div>
    </div>
    
    <!-- VI. TRAVAUX -->
    <div class="section">
      <div class="section-title">VI. Travaux</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 11 - Travaux effectués depuis le dernier contrat</div>
          {{#if TRAVAUX_REALISES}}
          <table class="info-table">
            <tr>
              <th>Nature des travaux</th>
              <th>Montant</th>
              <th>À la charge de</th>
            </tr>
            {{#each TRAVAUX}}
            <tr>
              <td>{{this.nature}}</td>
              <td>{{this.montant}} €</td>
              <td>{{this.charge}}</td>
            </tr>
            {{/each}}
          </table>
          {{else}}
          <p class="article-content">
            Aucun travaux n'a été réalisé dans le logement depuis le dernier contrat de location.
          </p>
          {{/if}}
        </div>
      </div>
    </div>
    
    <!-- VII. GARANTIES -->
    <div class="section page-break">
      <div class="section-title">VII. Garanties</div>
      <div class="section-content">
        {{#if GARANT_NOM}}
        <div class="article">
          <div class="article-title">Article 12 - Cautionnement</div>
          <div class="party-box">
            <div class="party-title">LE GARANT</div>
            <div class="party-info">
              <span class="party-label">Nom et prénom :</span><br>
              <span class="party-value">{{GARANT_NOM}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Adresse :</span><br>
              <span class="party-value">{{GARANT_ADRESSE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Type de garantie :</span><br>
              <span class="party-value">{{GARANT_TYPE}}</span>
            </div>
          </div>
          <p class="article-content" style="margin-top: 15px;">
            La personne désignée ci-dessus se porte caution {{GARANT_TYPE_ENGAGEMENT}} pour le locataire, 
            pour le paiement du loyer, des charges et des réparations locatives.
          </p>
        </div>
        {{else}}
        <div class="article">
          <div class="article-title">Article 12 - Cautionnement</div>
          <p class="article-content">
            Le présent bail est conclu sans cautionnement.
          </p>
        </div>
        {{/if}}
      </div>
    </div>
    
    <!-- VIII. CLAUSES ET CONDITIONS GÉNÉRALES -->
    <div class="section">
      <div class="section-title">VIII. Clauses et Conditions Générales</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 13 - Destination des locaux</div>
          <p class="article-content">
            Les locaux loués sont destinés exclusivement à l'habitation du locataire et des personnes 
            vivant habituellement avec lui. {{#if ACTIVITE_PRO_AUTORISEE}}L'exercice d'une activité professionnelle 
            est autorisé dans les conditions suivantes : {{ACTIVITE_PRO_CONDITIONS}}.{{/if}}
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 14 - Obligations du locataire</div>
          <p class="article-content">
            Le locataire s'engage à :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Payer le loyer et les charges aux termes convenus</li>
              <li>User paisiblement des locaux loués suivant la destination prévue au contrat</li>
              <li>Répondre des dégradations et pertes survenues pendant la durée du contrat</li>
              <li>Prendre à sa charge l'entretien courant du logement et les réparations locatives</li>
              <li>Laisser exécuter les travaux d'amélioration des parties communes ou privatives</li>
              <li>Ne pas transformer les locaux sans l'accord écrit du bailleur</li>
              <li>S'assurer contre les risques locatifs et fournir une attestation au bailleur chaque année</li>
            </ul>
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 15 - Obligations du bailleur</div>
          <p class="article-content">
            Le bailleur s'engage à :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Remettre au locataire un logement décent ne laissant pas apparaître de risques manifestes</li>
              <li>Délivrer un logement en bon état d'usage et de réparation</li>
              <li>Assurer au locataire la jouissance paisible du logement</li>
              <li>Entretenir les locaux en état de servir à l'usage prévu</li>
              <li>Ne pas s'opposer aux aménagements réalisés par le locataire</li>
              <li>Remettre gratuitement une quittance au locataire qui en fait la demande</li>
              <li>Transmettre les informations nécessaires pour la régularisation des charges</li>
            </ul>
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 16 - Résiliation du bail</div>
          <p class="article-content">
            <strong>Par le locataire :</strong> Le locataire peut donner congé à tout moment, 
            sous réserve de respecter un préavis de trois mois, ramené à un mois dans certains cas 
            prévus par la loi (mutation professionnelle, perte d'emploi, nouvel emploi, état de santé, 
            bénéficiaire du RSA ou de l'AAH, zone tendue...).<br><br>
            
            <strong>Par le bailleur :</strong> Le bailleur peut donner congé au locataire pour 
            la fin du bail, moyennant un préavis de six mois, et uniquement pour l'un des motifs suivants :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Reprise pour habiter</li>
              <li>Vente du logement</li>
              <li>Motif légitime et sérieux (notamment en cas d'inexécution par le locataire de ses obligations)</li>
            </ul>
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 17 - Sous-location</div>
          <p class="article-content">
            {{#if SOUS_LOCATION_AUTORISEE}}
            La sous-location est autorisée avec l'accord écrit préalable du bailleur. 
            Le montant du loyer de sous-location ne pourra excéder le loyer principal.
            {{else}}
            La sous-location totale ou partielle du logement est interdite.
            {{/if}}
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 18 - Clause résolutoire</div>
          <p class="article-content">
            À défaut de paiement du loyer ou des charges aux termes convenus, deux mois après 
            un commandement de payer demeuré infructueux, le présent bail sera résilié de plein 
            droit si le locataire ne se libère pas de sa dette avant que le juge n'ait statué.
          </p>
        </div>
      </div>
    </div>
    
    <!-- IX. DIAGNOSTICS TECHNIQUES -->
    <div class="section page-break">
      <div class="section-title">IX. Dossier de Diagnostic Technique</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 19 - Performance énergétique (DPE)</div>
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
          <p style="font-size: 9pt; color: #666;">
            Estimation des coûts annuels d'énergie : entre {{DPE_COUT_MIN}} € et {{DPE_COUT_MAX}} €
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 20 - Autres diagnostics</div>
          <table class="info-table">
            <tr>
              <th>Diagnostic</th>
              <th>Date</th>
              <th>Résultat</th>
            </tr>
            {{#if CREP_DATE}}
            <tr>
              <td>Constat de risque d'exposition au plomb (CREP)</td>
              <td>{{CREP_DATE}}</td>
              <td>{{CREP_RESULTAT}}</td>
            </tr>
            {{/if}}
            {{#if ELECTRICITE_DATE}}
            <tr>
              <td>État de l'installation intérieure d'électricité</td>
              <td>{{ELECTRICITE_DATE}}</td>
              <td>{{ELECTRICITE_RESULTAT}}</td>
            </tr>
            {{/if}}
            {{#if GAZ_DATE}}
            <tr>
              <td>État de l'installation intérieure de gaz</td>
              <td>{{GAZ_DATE}}</td>
              <td>{{GAZ_RESULTAT}}</td>
            </tr>
            {{/if}}
            {{#if ERP_DATE}}
            <tr>
              <td>État des risques et pollutions (ERP)</td>
              <td>{{ERP_DATE}}</td>
              <td>Annexé au contrat</td>
            </tr>
            {{/if}}
            {{#if BRUIT_DATE}}
            <tr>
              <td>Diagnostic bruit</td>
              <td>{{BRUIT_DATE}}</td>
              <td>Zone {{BRUIT_ZONE}}</td>
            </tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>
    
    <!-- X. ANNEXES -->
    <div class="section">
      <div class="section-title">X. Documents Annexés au Contrat</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 21 - Liste des documents annexés</div>
          <p class="article-content">
            Les documents suivants sont annexés au présent contrat et en font partie intégrante :
          </p>
          <ul class="annexes-list">
            <li class="checkbox-item">
              <div class="checkbox checked"></div>
              <span>État des lieux d'entrée</span>
            </li>
            <li class="checkbox-item">
              <div class="checkbox checked"></div>
              <span>Notice d'information relative aux droits et obligations des locataires et des bailleurs</span>
            </li>
            <li class="checkbox-item">
              <div class="checkbox checked"></div>
              <span>Dossier de diagnostic technique (DPE, CREP, etc.)</span>
            </li>
            {{#if COPROPRIETE}}
            <li class="checkbox-item">
              <div class="checkbox checked"></div>
              <span>Extraits du règlement de copropriété</span>
            </li>
            {{/if}}
            <li class="checkbox-item">
              <div class="checkbox checked"></div>
              <span>Attestation d'assurance habitation du locataire</span>
            </li>
            {{#if GARANT_NOM}}
            <li class="checkbox-item">
              <div class="checkbox checked"></div>
              <span>Acte de cautionnement</span>
            </li>
            {{/if}}
          </ul>
        </div>
      </div>
    </div>
    
    <!-- XI. SIGNATURES -->
    <div class="section signature-section">
      <div class="section-title">XI. Signatures</div>
      <div class="section-content">
        <p class="article-content">
          Fait à <strong>{{LIEU_SIGNATURE}}</strong>, le <strong>{{DATE_SIGNATURE}}</strong>,<br>
          en {{NB_EXEMPLAIRES}} exemplaires originaux, dont un pour chaque partie.
        </p>
        
        <p class="article-content" style="margin: 20px 0; font-style: italic; font-size: 10pt;">
          Chaque partie reconnaît avoir reçu un exemplaire du présent contrat et de ses annexes.
          Le locataire reconnaît avoir pris connaissance de l'ensemble des conditions du bail.
        </p>
        
        <div class="signature-grid">
          <div class="signature-box">
            <div class="signature-title">Le Bailleur</div>
            <p class="signature-mention">Signature précédée de la mention manuscrite "Lu et approuvé"</p>
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
            <p class="signature-mention">Signature précédée de la mention manuscrite "Lu et approuvé"</p>
            {{#if LOCATAIRE_SIGNATURE_IMAGE}}
            <img src="{{LOCATAIRE_SIGNATURE_IMAGE}}" alt="Signature locataire" class="signature-image" />
            <p class="signature-date">Signé électroniquement le {{LOCATAIRE_DATE_SIGNATURE}}</p>
            {{else}}
            <div class="signature-line"></div>
            {{/if}}
            <p style="font-size: 9pt;">{{LOCATAIRE_NOM_COMPLET}}</p>
          </div>
        </div>
        
        {{#if GARANT_NOM}}
        <div style="margin-top: 30px;">
          <div class="signature-box" style="max-width: 50%;">
            <div class="signature-title">Le Garant</div>
            <p class="signature-mention">
              Signature précédée de la mention manuscrite :<br>
              "Bon pour engagement de caution {{GARANT_TYPE_ENGAGEMENT}} au profit du locataire 
              {{LOCATAIRE_NOM_COMPLET}}, à hauteur du loyer et des charges, soit {{LOYER_TOTAL}} € 
              par mois à ce jour"
            </p>
            {{#if GARANT_SIGNATURE_IMAGE}}
            <img src="{{GARANT_SIGNATURE_IMAGE}}" alt="Signature garant" class="signature-image" />
            <p class="signature-date">Signé électroniquement le {{GARANT_DATE_SIGNATURE}}</p>
            {{else}}
            <div class="signature-line"></div>
            {{/if}}
            <p style="font-size: 9pt;">{{GARANT_NOM}}</p>
          </div>
        </div>
        {{/if}}
      </div>
    </div>
    
    <div class="footer">
      <p>Ce contrat type est établi conformément au décret n°2015-587 du 29 mai 2015.</p>
      <p>Document généré le {{DATE_GENERATION}} - Référence : {{REFERENCE_BAIL}}</p>
    </div>
  </div>

  <!-- Page Certificat de Signature (uniquement si signé) -->
  {{#if IS_SIGNED}}
  <div class="page" style="page-break-before: always; padding: 20mm;">
    <div class="header">
      <h1>CERTIFICAT DE SIGNATURE ÉLECTRONIQUE</h1>
      <div class="subtitle">Dossier de Preuve Numérique</div>
    </div>

    <div class="section">
      <div class="section-title">🛡️ Validité Juridique</div>
      <div class="section-content">
        <p style="font-size: 10pt; color: #333; line-height: 1.6; text-align: justify; margin-bottom: 20px;">
          Ce document a été signé électroniquement conformément aux dispositions de l'article 1367 du Code Civil français et du règlement européen eIDAS n°910/2014. 
          L'intégrité du document et l'identité des signataires sont garanties par un horodatage cryptographique et une empreinte numérique (Hash) unique.
        </p>
      </div>
    </div>

    {{CERTIFICATE_HTML}}

    <div class="footer" style="margin-top: 50px;">
      <p><strong>Note technique :</strong> L'empreinte numérique SHA-256 garantit que le contenu du document n'a pas été modifié depuis sa signature. Toute altération, même mineure, du fichier PDF rendrait le certificat invalide.</p>
    </div>
  </div>
  {{/if}}
</body>
</html>
`;

// Variables disponibles pour ce template
export const BAIL_NU_VARIABLES = [
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
  'BAILLEUR_SIRET',
  'MANDATAIRE_NOM',
  'MANDATAIRE_ADRESSE',
  
  // Locataire
  'LOCATAIRE_NOM_COMPLET',
  'LOCATAIRE_DATE_NAISSANCE',
  'LOCATAIRE_LIEU_NAISSANCE',
  'LOCATAIRE_2_NOM',
  'LOCATAIRE_2_DATE_NAISSANCE',
  'LOCATAIRE_2_LIEU_NAISSANCE',
  
  // Logement
  'LOGEMENT_ADRESSE',
  'LOGEMENT_CODE_POSTAL',
  'LOGEMENT_VILLE',
  'LOGEMENT_TYPE',
  'LOGEMENT_REGIME',
  'LOGEMENT_PERIODE_CONSTRUCTION',
  'LOGEMENT_SURFACE',
  'LOGEMENT_NB_PIECES',
  'LOGEMENT_ETAGE',
  'LOGEMENT_NB_ETAGES',
  'LOGEMENT_EQUIPEMENTS',
  'LOGEMENT_PARTIES_COMMUNES',
  'LOGEMENT_ANNEXES',
  'CHAUFFAGE_TYPE',
  'CHAUFFAGE_ENERGIE',
  'CHAUFFAGE_DISPLAY',
  'EAU_CHAUDE_TYPE',
  'EAU_CHAUDE_ENERGIE',
  'EAU_CHAUDE_DISPLAY',
  
  // Bail
  'BAIL_DATE_DEBUT',
  'BAIL_DUREE',
  'BAIL_DATE_FIN',
  'TACITE_RECONDUCTION',
  
  // Financier
  'LOYER_HC',
  'LOYER_LETTRES',
  'CHARGES_MONTANT',
  'COMPLEMENT_LOYER',
  'LOYER_TOTAL',
  'MODE_PAIEMENT',
  'PERIODICITE_PAIEMENT',
  'JOUR_PAIEMENT',
  'TERME_PAIEMENT',
  'DEPOT_GARANTIE',
  'DEPOT_LETTRES',
  
  // Encadrement
  'ZONE_ENCADREMENT',
  'LOYER_REFERENCE',
  'LOYER_REFERENCE_MAJORE',
  'COMPLEMENT_JUSTIFICATION',
  'DECRET_ENCADREMENT',
  
  // Historique loyer
  'LOYER_PRECEDENT',
  'DATE_DERNIER_LOYER',
  'LOYER_REVISION_JUSTIFICATION',
  
  // Révision
  'REVISION_AUTORISEE',
  'TRIMESTRE_REFERENCE',
  
  // Travaux
  'TRAVAUX_REALISES',
  'TRAVAUX',
  
  // Garant
  'GARANT_NOM',
  'GARANT_ADRESSE',
  'GARANT_TYPE',
  'GARANT_TYPE_ENGAGEMENT',
  
  // Clauses
  'ACTIVITE_PRO_AUTORISEE',
  'ACTIVITE_PRO_CONDITIONS',
  'SOUS_LOCATION_AUTORISEE',
  'COPROPRIETE',
  
  // Diagnostics
  'DPE_CLASSE',
  'DPE_CLASSE_LOWER',
  'DPE_GES',
  'DPE_GES_LOWER',
  'DPE_CONSOMMATION',
  'DPE_COUT_MIN',
  'DPE_COUT_MAX',
  'CREP_DATE',
  'CREP_RESULTAT',
  'ELECTRICITE_DATE',
  'ELECTRICITE_RESULTAT',
  'GAZ_DATE',
  'GAZ_RESULTAT',
  'ERP_DATE',
  'BRUIT_DATE',
  'BRUIT_ZONE',
];

export default BAIL_NU_TEMPLATE;

