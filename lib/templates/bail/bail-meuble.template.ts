/**
 * Template de bail de location meublée
 * Conforme à la loi ALUR et au décret n°2015-587 du 29 mai 2015
 * Liste du mobilier obligatoire : décret n°2015-981 du 31 juillet 2015
 * 
 * Durée : 1 an minimum (9 mois pour étudiants)
 * Dépôt de garantie : 2 mois maximum
 */

export const BAIL_MEUBLE_TEMPLATE = `
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
      border-bottom: 2px solid #1a5f7a;
    }
    
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
      color: #1a5f7a;
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
    
    .badge-meuble {
      display: inline-block;
      background: #1a5f7a;
      color: #fff;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 10pt;
      margin-top: 10px;
    }
    
    .legal-notice {
      background: #e8f4f8;
      border: 1px solid #1a5f7a;
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
      background: #1a5f7a;
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
      color: #1a5f7a;
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
      border: 1px solid #1a5f7a;
      padding: 15px;
      border-radius: 5px;
    }
    
    .party-title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #e8f4f8;
      color: #1a5f7a;
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
      background: #e8f4f8;
      font-weight: bold;
      width: 40%;
    }
    
    .financial-summary {
      background: #f9f9f9;
      border: 2px solid #1a5f7a;
      padding: 20px;
      margin: 20px 0;
      border-radius: 5px;
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
      background: #1a5f7a;
      color: #fff;
      margin: 10px -20px -20px;
      padding: 12px 20px;
      border-radius: 0 0 3px 3px;
    }
    
    /* Inventaire meublé - spécifique */
    .inventaire-section {
      background: #fff8e6;
      border: 2px solid #ffa500;
      padding: 20px;
      margin: 20px 0;
      border-radius: 5px;
    }
    
    .inventaire-title {
      font-weight: bold;
      font-size: 12pt;
      color: #d97706;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ffa500;
    }
    
    .inventaire-obligatoire {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .inventaire-item {
      display: flex;
      align-items: center;
      padding: 8px;
      background: #fff;
      border-radius: 3px;
    }
    
    .inventaire-checkbox {
      width: 18px;
      height: 18px;
      border: 2px solid #ffa500;
      border-radius: 3px;
      margin-right: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: #059669;
    }
    
    .inventaire-checkbox.checked::after {
      content: '✓';
    }
    
    .inventaire-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    .inventaire-table th,
    .inventaire-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    
    .inventaire-table th {
      background: #fff3cd;
    }
    
    .etat-neuf { color: #059669; }
    .etat-bon { color: #3b82f6; }
    .etat-usage { color: #f59e0b; }
    .etat-mauvais { color: #ef4444; }
    
    .encadrement-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      margin: 15px 0;
      border-radius: 5px;
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
    
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
      margin-top: 20px;
    }
    
    .signature-box {
      border: 1px solid #1a5f7a;
      padding: 20px;
      min-height: 150px;
      border-radius: 5px;
    }
    
    .signature-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: #1a5f7a;
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
      border-top: 1px solid #1a5f7a;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }
    
    .student-badge {
      background: #8b5cf6;
      color: #fff;
      padding: 3px 10px;
      border-radius: 10px;
      font-size: 9pt;
      margin-left: 10px;
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
      <div class="subtitle">Bail de location meublée à usage de résidence principale</div>
      <div class="badge-meuble">MEUBLÉ</div>
      {{#if BAIL_ETUDIANT}}
      <span class="student-badge">BAIL ÉTUDIANT (9 mois)</span>
      {{/if}}
      <div class="reference">Référence : {{REFERENCE_BAIL}}</div>
    </div>
    
    <div class="legal-notice">
      <strong>Loi n°89-462 du 6 juillet 1989</strong> tendant à améliorer les rapports locatifs<br>
      modifiée par la loi n°2014-366 du 24 mars 2014 (loi ALUR)<br>
      <em>Contrat type défini par le décret n°2015-587 du 29 mai 2015</em><br>
      <strong>Liste du mobilier obligatoire : décret n°2015-981 du 31 juillet 2015</strong>
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
            {{#if BAIL_ETUDIANT}}
            <div class="party-info">
              <span class="party-label">Établissement :</span><br>
              <span class="party-value">{{LOCATAIRE_ETABLISSEMENT}}</span>
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
            Le présent contrat a pour objet la location d'un <strong>logement meublé</strong> ainsi 
            déterminé, destiné à l'usage exclusif d'habitation principale du locataire.
            <br><br>
            Le logement est loué meublé, conformément aux dispositions de l'article 25-4 de la loi 
            du 6 juillet 1989. Il comporte les éléments de mobilier définis par le décret n°2015-981 
            du 31 juillet 2015, permettant au locataire d'y dormir, manger et vivre convenablement 
            au regard des exigences de la vie courante.
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
              <td>{{LOGEMENT_TYPE}} <strong>(MEUBLÉ)</strong></td>
            </tr>
            <tr>
              <th>Régime juridique de l'immeuble</th>
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
        
        <div class="article">
          <div class="article-title">Article 3 - Éléments d'équipement</div>
          <p class="article-content">
            <strong>Équipements à usage privatif :</strong><br>
            {{LOGEMENT_EQUIPEMENTS}}
          </p>
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
      </div>
    </div>
    
    <!-- IV. INVENTAIRE DU MOBILIER (SPÉCIFIQUE MEUBLÉ) -->
    <div class="section page-break">
      <div class="section-title">IV. Inventaire du Mobilier</div>
      <div class="section-content">
        <div class="inventaire-section">
          <div class="inventaire-title">📋 Éléments obligatoires (décret n°2015-981)</div>
          <p style="font-size: 9pt; margin-bottom: 15px; color: #666;">
            Un logement meublé doit comporter au minimum les éléments suivants :
          </p>
          
          <div class="inventaire-obligatoire">
            <div class="inventaire-item">
              <div class="inventaire-checkbox {{#if INV_LITERIE}}checked{{/if}}"></div>
              <span>Literie avec couette ou couverture</span>
            </div>
            <div class="inventaire-item">
              <div class="inventaire-checkbox {{#if INV_VOLETS}}checked{{/if}}"></div>
              <span>Volets ou rideaux occultants (chambres)</span>
            </div>
            <div class="inventaire-item">
              <div class="inventaire-checkbox {{#if INV_PLAQUES}}checked{{/if}}"></div>
              <span>Plaques de cuisson</span>
            </div>
            <div class="inventaire-item">
              <div class="inventaire-checkbox {{#if INV_FOUR}}checked{{/if}}"></div>
              <span>Four ou micro-ondes</span>
            </div>
            <div class="inventaire-item">
              <div class="inventaire-checkbox {{#if INV_FRIGO}}checked{{/if}}"></div>
              <span>Réfrigérateur avec compartiment congélation</span>
            </div>
            <div class="inventaire-item">
              <div class="inventaire-checkbox {{#if INV_VAISSELLE}}checked{{/if}}"></div>
              <span>Vaisselle et ustensiles de cuisine</span>
            </div>
            <div class="inventaire-item">
              <div class="inventaire-checkbox {{#if INV_TABLE}}checked{{/if}}"></div>
              <span>Table et sièges</span>
            </div>
            <div class="inventaire-item">
              <div class="inventaire-checkbox {{#if INV_RANGEMENTS}}checked{{/if}}"></div>
              <span>Étagères de rangement</span>
            </div>
            <div class="inventaire-item">
              <div class="inventaire-checkbox {{#if INV_LUMINAIRES}}checked{{/if}}"></div>
              <span>Luminaires</span>
            </div>
            <div class="inventaire-item">
              <div class="inventaire-checkbox {{#if INV_ENTRETIEN}}checked{{/if}}"></div>
              <span>Matériel d'entretien ménager</span>
            </div>
          </div>
        </div>
        
        <div class="article">
          <div class="article-title">Article 5 - Inventaire détaillé du mobilier</div>
          <p class="article-content" style="margin-bottom: 15px;">
            Le logement est loué avec le mobilier suivant, dont l'état est constaté ci-dessous :
          </p>
          
          <table class="inventaire-table">
            <thead>
              <tr>
                <th style="width: 40%;">Désignation</th>
                <th style="width: 15%;">Quantité</th>
                <th style="width: 20%;">État</th>
                <th style="width: 25%;">Observations</th>
              </tr>
            </thead>
            <tbody>
              {{#each INVENTAIRE_MEUBLES}}
              <tr>
                <td>{{this.designation}}</td>
                <td style="text-align: center;">{{this.quantite}}</td>
                <td class="etat-{{this.etat_class}}">{{this.etat}}</td>
                <td>{{this.observations}}</td>
              </tr>
              {{/each}}
            </tbody>
          </table>
          
          <p class="article-content" style="margin-top: 15px; font-size: 9pt; font-style: italic;">
            Le locataire s'engage à restituer le mobilier dans l'état où il l'a reçu, 
            compte tenu de l'usure normale.
          </p>
        </div>
      </div>
    </div>
    
    <!-- V. DATE DE PRISE D'EFFET ET DURÉE -->
    <div class="section">
      <div class="section-title">V. Date de Prise d'Effet et Durée</div>
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
              <td>
                <strong>{{BAIL_DUREE}}</strong>
                {{#if BAIL_ETUDIANT}}
                <span class="student-badge">Bail étudiant</span>
                {{/if}}
              </td>
            </tr>
            {{#if BAIL_DATE_FIN}}
            <tr>
              <th>Date de fin prévue</th>
              <td>{{BAIL_DATE_FIN}}</td>
            </tr>
            {{/if}}
          </table>
          
          <p class="article-content" style="margin-top: 15px;">
            {{#if BAIL_ETUDIANT}}
            Ce bail étudiant de neuf mois n'est pas renouvelable tacitement. 
            Si le locataire souhaite poursuivre la location, un nouveau contrat devra être conclu.
            {{else}}
            À l'expiration de cette durée, le contrat sera reconduit tacitement pour une durée 
            d'un an, sauf congé délivré dans les conditions légales.
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
          <div class="article-title">Article 7 - Loyer</div>
          
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
              <th>Justification</th>
              <td>{{COMPLEMENT_JUSTIFICATION}}</td>
            </tr>
            {{/if}}
          </table>
        </div>
        {{/if}}
        
        <div class="article">
          <div class="article-title">Article 8 - Dépôt de garantie</div>
          <p class="article-content">
            Le locataire verse ce jour au bailleur la somme de <strong>{{DEPOT_GARANTIE}} €</strong> 
            ({{DEPOT_LETTRES}}) à titre de dépôt de garantie.<br><br>
            
            <strong>Note :</strong> Pour une location meublée, le dépôt de garantie est limité à 
            <strong>deux mois de loyer hors charges</strong> maximum.<br><br>
            
            Cette somme sera restituée au locataire dans un délai maximum de :
            <ul style="margin-top: 10px; padding-left: 20px;">
              <li><strong>Un mois</strong> si l'état des lieux de sortie est conforme à l'entrée</li>
              <li><strong>Deux mois</strong> dans le cas contraire</li>
            </ul>
          </p>
        </div>
      </div>
    </div>
    
    <!-- VII. CLAUSES SPÉCIFIQUES AU MEUBLÉ -->
    <div class="section page-break">
      <div class="section-title">VII. Clauses Spécifiques au Logement Meublé</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 9 - Entretien du mobilier</div>
          <p class="article-content">
            Le locataire s'engage à :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Utiliser le mobilier conformément à sa destination</li>
              <li>Entretenir le mobilier en bon père de famille</li>
              <li>Signaler sans délai toute détérioration ou dysfonctionnement</li>
              <li>Ne pas modifier, remplacer ou retirer le mobilier sans accord écrit du bailleur</li>
              <li>Restituer le mobilier dans l'état constaté à l'entrée, compte tenu de l'usure normale</li>
            </ul>
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 10 - Remplacement du mobilier</div>
          <p class="article-content">
            En cas de détérioration d'un élément mobilier due à un usage anormal ou à un défaut 
            d'entretien, le bailleur pourra en demander le remplacement aux frais du locataire.
            <br><br>
            Le bailleur s'engage à remplacer tout élément mobilier devenu vétuste ou défaillant 
            du fait de l'usure normale.
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 11 - Préavis</div>
          <p class="article-content">
            <strong>Par le locataire :</strong> Le locataire peut donner congé à tout moment avec 
            un préavis de <strong>un mois</strong>.<br><br>
            
            <strong>Par le bailleur :</strong> Le bailleur peut donner congé pour la fin du bail, 
            moyennant un préavis de <strong>trois mois</strong>, uniquement pour :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Reprise pour habiter</li>
              <li>Vente du logement</li>
              <li>Motif légitime et sérieux</li>
            </ul>
          </p>
        </div>
      </div>
    </div>
    
    <!-- VIII. CONDITIONS GÉNÉRALES -->
    <div class="section">
      <div class="section-title">VIII. Conditions Générales</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 12 - Obligations du locataire</div>
          <p class="article-content">
            Le locataire s'engage à :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Payer le loyer et les charges aux termes convenus</li>
              <li>User paisiblement des locaux et du mobilier</li>
              <li>Répondre des dégradations survenues pendant la durée du contrat</li>
              <li>Prendre à sa charge l'entretien courant du logement et du mobilier</li>
              <li>Ne pas transformer les locaux sans l'accord écrit du bailleur</li>
              <li>S'assurer contre les risques locatifs</li>
              <li>Permettre l'accès pour les réparations urgentes</li>
            </ul>
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 13 - Obligations du bailleur</div>
          <p class="article-content">
            Le bailleur s'engage à :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Remettre un logement décent et meublé conformément au décret</li>
              <li>Assurer la jouissance paisible du logement</li>
              <li>Entretenir les locaux et le mobilier en état de servir</li>
              <li>Remettre gratuitement une quittance au locataire</li>
              <li>Justifier les charges récupérées</li>
            </ul>
          </p>
        </div>
      </div>
    </div>
    
    <!-- IX. DIAGNOSTICS TECHNIQUES -->
    <div class="section">
      <div class="section-title">IX. Dossier de Diagnostic Technique</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 14 - Performance énergétique (DPE)</div>
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
        
        <div class="article">
          <div class="article-title">Article 15 - Autres diagnostics</div>
          <table class="info-table">
            <tr>
              <th>Diagnostic</th>
              <th>Date</th>
              <th>Résultat</th>
            </tr>
            {{#if CREP_DATE}}
            <tr>
              <td>CREP (Plomb)</td>
              <td>{{CREP_DATE}}</td>
              <td>{{CREP_RESULTAT}}</td>
            </tr>
            {{/if}}
            {{#if ELECTRICITE_DATE}}
            <tr>
              <td>État électricité</td>
              <td>{{ELECTRICITE_DATE}}</td>
              <td>{{ELECTRICITE_RESULTAT}}</td>
            </tr>
            {{/if}}
            {{#if GAZ_DATE}}
            <tr>
              <td>État gaz</td>
              <td>{{GAZ_DATE}}</td>
              <td>{{GAZ_RESULTAT}}</td>
            </tr>
            {{/if}}
            {{#if ERP_DATE}}
            <tr>
              <td>État des risques (ERP)</td>
              <td>{{ERP_DATE}}</td>
              <td>Annexé</td>
            </tr>
            {{/if}}
          </table>
        </div>
      </div>
    </div>
    
    <!-- X. ANNEXES -->
    <div class="section">
      <div class="section-title">X. Documents Annexés</div>
      <div class="section-content">
        <ul class="annexes-list">
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>État des lieux d'entrée</span>
          </li>
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span><strong>Inventaire détaillé et état du mobilier</strong></span>
          </li>
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Notice d'information</span>
          </li>
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Dossier de diagnostic technique</span>
          </li>
          {{#if COPROPRIETE}}
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Extraits du règlement de copropriété</span>
          </li>
          {{/if}}
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Attestation d'assurance habitation</span>
          </li>
        </ul>
      </div>
    </div>
    
    <!-- XI. SIGNATURES -->
    <div class="section signature-section page-break">
      <div class="section-title">XI. Signatures</div>
      <div class="section-content">
        <p class="article-content">
          Fait à <strong>{{LIEU_SIGNATURE}}</strong>, le <strong>{{DATE_SIGNATURE}}</strong>,<br>
          en {{NB_EXEMPLAIRES}} exemplaires originaux.
        </p>
        
        <p class="article-content" style="margin: 20px 0; font-style: italic; font-size: 10pt;">
          Chaque partie reconnaît avoir reçu un exemplaire du présent contrat, de l'inventaire 
          du mobilier et de ses annexes.
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
      <p>Contrat de location meublée - Décret n°2015-587 du 29 mai 2015</p>
      <p>Mobilier conforme au décret n°2015-981 du 31 juillet 2015</p>
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
          Ce document a été signé électroniquement conformément aux dispositions du Code Civil (Articles 1366 et 1367) 
          et du Règlement européen eIDAS (n°910/2014). La signature électronique avancée utilisée garantit 
          l'identification des signataires et l'intégrité du document.
        </p>
      </div>
    </div>

    {{{CERTIFICATE_HTML}}}

    <div class="section">
      <div class="section-title">📄 Intégrité du Document</div>
      <div class="section-content">
        <div class="party-box" style="background: #f8fafc; border-style: dashed;">
          <p style="font-size: 9pt; color: #475569; margin-bottom: 5px;">Empreinte numérique (Hash SHA-256) du document original :</p>
          <code style="font-size: 10pt; font-weight: bold; color: #1e293b; word-break: break-all;">{{DOCUMENT_HASH}}</code>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Certificat de Signature - Page générée automatiquement</p>
      <p>Document : Bail Meublé {{REFERENCE_BAIL}}</p>
    </div>
  </div>
  {{/if}}
</body>
</html>
`;

// Variables disponibles pour le bail meublé
export const BAIL_MEUBLE_VARIABLES = [
  // Variables communes
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
  
  // Locataire
  'LOCATAIRE_NOM_COMPLET',
  'LOCATAIRE_DATE_NAISSANCE',
  'LOCATAIRE_LIEU_NAISSANCE',
  'LOCATAIRE_ETABLISSEMENT', // Pour bail étudiant
  
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
  'LOGEMENT_EQUIPEMENTS',
  'LOGEMENT_ANNEXES',
  
  // Bail
  'BAIL_ETUDIANT',
  'BAIL_DATE_DEBUT',
  'BAIL_DUREE',
  'BAIL_DATE_FIN',
  
  // Inventaire obligatoire (checkboxes)
  'INV_LITERIE',
  'INV_VOLETS',
  'INV_PLAQUES',
  'INV_FOUR',
  'INV_FRIGO',
  'INV_VAISSELLE',
  'INV_TABLE',
  'INV_RANGEMENTS',
  'INV_LUMINAIRES',
  'INV_ENTRETIEN',
  
  // Inventaire détaillé
  'INVENTAIRE_MEUBLES', // Array d'objets
  
  // Financier
  'LOYER_HC',
  'LOYER_LETTRES',
  'CHARGES_MONTANT',
  'CHARGES_TYPE_LABEL',
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
  
  // Diagnostics
  'DPE_CLASSE',
  'DPE_CLASSE_LOWER',
  'DPE_GES',
  'DPE_GES_LOWER',
  'DPE_CONSOMMATION',
  'CREP_DATE',
  'CREP_RESULTAT',
  'ELECTRICITE_DATE',
  'ELECTRICITE_RESULTAT',
  'GAZ_DATE',
  'GAZ_RESULTAT',
  'ERP_DATE',
  
  // Autres
  'COPROPRIETE',
];

export default BAIL_MEUBLE_TEMPLATE;

