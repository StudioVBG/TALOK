/**
 * Template de bail de location saisonnière
 * Conforme à l'article 1-1 de la loi n°89-462 du 6 juillet 1989
 * 
 * ⚠️ Note juridique importante :
 * La location saisonnière n'est PAS soumise au régime protecteur de la loi du 6 juillet 1989.
 * Elle relève du droit commun des baux (Code civil) avec quelques dispositions spécifiques.
 * 
 * Caractéristiques :
 * - Durée maximum : 90 jours consécutifs
 * - Usage : vacances, tourisme (non résidence principale)
 * - Taxe de séjour applicable dans certaines communes
 * - Liberté contractuelle importante
 */

export const BAIL_SAISONNIER_TEMPLATE = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Contrat de location saisonnière</title>
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
      border-bottom: 3px solid #f59e0b;
    }
    
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
      color: #d97706;
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
    
    .badge-saisonnier {
      display: inline-block;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #fff;
      padding: 8px 20px;
      border-radius: 25px;
      font-size: 11pt;
      margin-top: 15px;
      font-weight: bold;
    }
    
    .legal-notice {
      background: #fffbeb;
      border: 1px solid #f59e0b;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin-bottom: 25px;
      font-size: 9pt;
    }
    
    .legal-notice strong {
      color: #d97706;
    }
    
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
      color: #d97706;
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
      border: 2px solid #f59e0b;
      padding: 15px;
      border-radius: 8px;
      background: #fffbeb;
    }
    
    .party-title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #fcd34d;
      color: #d97706;
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
      border: 1px solid #fcd34d;
      padding: 10px 12px;
      text-align: left;
    }
    
    .info-table th {
      background: #fffbeb;
      font-weight: bold;
      width: 40%;
      color: #92400e;
    }
    
    /* Section séjour avec style vacances */
    .sejour-section {
      background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%);
      border: 2px solid #f59e0b;
      padding: 20px;
      margin: 20px 0;
      border-radius: 10px;
    }
    
    .sejour-title {
      font-weight: bold;
      font-size: 14pt;
      color: #d97706;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .sejour-dates {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 15px 0;
    }
    
    .date-box {
      background: #fff;
      border: 1px solid #fcd34d;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    
    .date-label {
      font-size: 9pt;
      color: #92400e;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    
    .date-value {
      font-size: 14pt;
      font-weight: bold;
      color: #d97706;
    }
    
    .duree-badge {
      display: inline-block;
      background: #d97706;
      color: #fff;
      padding: 5px 15px;
      border-radius: 20px;
      font-weight: bold;
    }
    
    .financial-summary {
      background: #fff;
      border: 2px solid #f59e0b;
      padding: 20px;
      margin: 20px 0;
      border-radius: 10px;
    }
    
    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #fcd34d;
    }
    
    .financial-row:last-child {
      border-bottom: none;
    }
    
    .financial-row.total {
      font-weight: bold;
      font-size: 13pt;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #fff;
      margin: 15px -20px -20px;
      padding: 15px 20px;
      border-radius: 0 0 8px 8px;
    }
    
    .financial-row.subtotal {
      background: #fef3c7;
      margin: 5px -20px;
      padding: 10px 20px;
      font-weight: 600;
    }
    
    /* Taxe de séjour */
    .taxe-sejour-box {
      background: #dbeafe;
      border: 1px solid #3b82f6;
      padding: 15px;
      margin: 15px 0;
      border-radius: 8px;
    }
    
    .taxe-sejour-title {
      font-weight: bold;
      color: #1d4ed8;
      margin-bottom: 10px;
    }
    
    /* Arrhes / Acompte */
    .paiement-box {
      background: #f0fdf4;
      border: 2px solid #22c55e;
      padding: 20px;
      margin: 20px 0;
      border-radius: 10px;
    }
    
    .paiement-title {
      font-weight: bold;
      font-size: 12pt;
      color: #15803d;
      margin-bottom: 15px;
    }
    
    .paiement-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    
    .paiement-item {
      background: #fff;
      border: 1px solid #86efac;
      padding: 15px;
      border-radius: 8px;
    }
    
    .paiement-label {
      font-size: 9pt;
      color: #15803d;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    
    .paiement-value {
      font-size: 14pt;
      font-weight: bold;
      color: #166534;
    }
    
    /* Inventaire et équipements */
    .equipements-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin: 15px 0;
    }
    
    .equipement-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #fffbeb;
      border-radius: 5px;
      font-size: 10pt;
    }
    
    .equipement-check {
      color: #22c55e;
      margin-right: 8px;
      font-weight: bold;
    }
    
    /* Annulation */
    .annulation-box {
      background: #fef2f2;
      border: 2px solid #ef4444;
      padding: 20px;
      margin: 20px 0;
      border-radius: 10px;
    }
    
    .annulation-title {
      font-weight: bold;
      font-size: 12pt;
      color: #dc2626;
      margin-bottom: 15px;
    }
    
    .annulation-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .annulation-table th,
    .annulation-table td {
      border: 1px solid #fca5a5;
      padding: 10px;
      text-align: left;
    }
    
    .annulation-table th {
      background: #fee2e2;
      color: #991b1b;
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
      border: 2px solid #f59e0b;
      padding: 20px;
      min-height: 150px;
      border-radius: 8px;
    }
    
    .signature-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: #d97706;
    }
    
    .signature-line {
      border-bottom: 1px solid #000;
      margin: 10px 0;
      min-height: 30px;
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
      border: 1px solid #f59e0b;
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
      border-top: 2px solid #f59e0b;
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
      <h1>Contrat de Location Saisonnière</h1>
      <div class="subtitle">Location de vacances à usage temporaire</div>
      <div class="badge-saisonnier">☀️ LOCATION SAISONNIÈRE</div>
      <div class="reference">Référence : {{REFERENCE_BAIL}}</div>
    </div>
    
    <div class="legal-notice">
      <strong>📋 Régime juridique applicable</strong><br>
      Le présent contrat est soumis aux dispositions de l'<strong>article 1-1 de la loi n°89-462 du 6 juillet 1989</strong> 
      et aux articles 1713 et suivants du Code civil.<br>
      <em>La location saisonnière est exclue du champ d'application du régime protecteur des baux d'habitation 
      (durée minimale, encadrement des loyers, etc.).</em>
      {{#if MEUBLE_TOURISME}}
      <br><br>
      <strong>🏠 Meublé de tourisme classé :</strong> {{CLASSEMENT_ETOILES}} étoiles (n° {{NUMERO_CLASSEMENT}})
      {{/if}}
    </div>
    
    <!-- I. DÉSIGNATION DES PARTIES -->
    <div class="section">
      <div class="section-title">I. Désignation des Parties</div>
      <div class="section-content">
        <div class="parties-grid">
          <!-- Propriétaire -->
          <div class="party-box">
            <div class="party-title">LE PROPRIÉTAIRE (Bailleur)</div>
            <div class="party-info">
              <span class="party-label">Nom et prénom :</span><br>
              <span class="party-value">{{BAILLEUR_NOM_COMPLET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Adresse :</span><br>
              <span class="party-value">{{BAILLEUR_ADRESSE}}</span><br>
              <span class="party-value">{{BAILLEUR_CODE_POSTAL}} {{BAILLEUR_VILLE}}</span>
            </div>
            {{#if BAILLEUR_TELEPHONE}}
            <div class="party-info">
              <span class="party-label">Téléphone :</span>
              <span class="party-value">{{BAILLEUR_TELEPHONE}}</span>
            </div>
            {{/if}}
            {{#if BAILLEUR_EMAIL}}
            <div class="party-info">
              <span class="party-label">Email :</span>
              <span class="party-value">{{BAILLEUR_EMAIL}}</span>
            </div>
            {{/if}}
          </div>
          
          <!-- Locataire -->
          <div class="party-box">
            <div class="party-title">LE LOCATAIRE (Vacancier)</div>
            <div class="party-info">
              <span class="party-label">Nom et prénom :</span><br>
              <span class="party-value">{{LOCATAIRE_NOM_COMPLET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Adresse permanente :</span><br>
              <span class="party-value">{{LOCATAIRE_ADRESSE}}</span><br>
              <span class="party-value">{{LOCATAIRE_CODE_POSTAL}} {{LOCATAIRE_VILLE}}</span>
            </div>
            {{#if LOCATAIRE_TELEPHONE}}
            <div class="party-info">
              <span class="party-label">Téléphone :</span>
              <span class="party-value">{{LOCATAIRE_TELEPHONE}}</span>
            </div>
            {{/if}}
            {{#if LOCATAIRE_EMAIL}}
            <div class="party-info">
              <span class="party-label">Email :</span>
              <span class="party-value">{{LOCATAIRE_EMAIL}}</span>
            </div>
            {{/if}}
          </div>
        </div>
        
        <p class="article-content">
          <strong>Ci-après dénommés respectivement "le propriétaire" et "le locataire".</strong>
        </p>
      </div>
    </div>
    
    <!-- II. OBJET ET DESCRIPTION DU LOGEMENT -->
    <div class="section">
      <div class="section-title">II. Description du Logement</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 1 - Désignation</div>
          
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
              <th>Surface habitable</th>
              <td><strong>{{LOGEMENT_SURFACE}} m²</strong></td>
            </tr>
            <tr>
              <th>Nombre de pièces</th>
              <td>{{LOGEMENT_NB_PIECES}} pièces dont {{LOGEMENT_NB_CHAMBRES}} chambre(s)</td>
            </tr>
            <tr>
              <th>Capacité d'accueil</th>
              <td><strong>{{CAPACITE_PERSONNES}} personnes maximum</strong></td>
            </tr>
            {{#if LOGEMENT_ETAGE}}
            <tr>
              <th>Étage</th>
              <td>{{LOGEMENT_ETAGE}} {{#if ASCENSEUR}}(avec ascenseur){{else}}(sans ascenseur){{/if}}</td>
            </tr>
            {{/if}}
          </table>
        </div>
        
        <div class="article">
          <div class="article-title">Article 2 - Équipements et mobilier</div>
          <p class="article-content">
            Le logement est loué meublé et équipé. Il comprend notamment :
          </p>
          
          <div class="equipements-grid">
            {{#each EQUIPEMENTS}}
            <div class="equipement-item">
              <span class="equipement-check">✓</span>
              {{this}}
            </div>
            {{/each}}
          </div>
          
          <p class="article-content" style="margin-top: 15px; font-size: 10pt; font-style: italic;">
            Un inventaire détaillé du mobilier et des équipements est annexé au présent contrat.
          </p>
        </div>
        
        {{#if LOGEMENT_ANNEXES}}
        <div class="article">
          <div class="article-title">Article 3 - Annexes et extérieurs</div>
          <p class="article-content">
            Le logement comprend également :<br>
            {{LOGEMENT_ANNEXES}}
          </p>
        </div>
        {{/if}}
      </div>
    </div>
    
    <!-- III. PÉRIODE DE LOCATION -->
    <div class="section">
      <div class="section-title">III. Période de Location</div>
      <div class="section-content">
        <div class="sejour-section">
          <div class="sejour-title">
            📅 Dates du séjour
          </div>
          
          <div class="sejour-dates">
            <div class="date-box">
              <div class="date-label">Arrivée</div>
              <div class="date-value">{{DATE_ARRIVEE}}</div>
              <div style="font-size: 10pt; color: #666; margin-top: 5px;">à partir de {{HEURE_ARRIVEE}}</div>
            </div>
            
            <div class="date-box">
              <div class="date-label">Départ</div>
              <div class="date-value">{{DATE_DEPART}}</div>
              <div style="font-size: 10pt; color: #666; margin-top: 5px;">avant {{HEURE_DEPART}}</div>
            </div>
            
            <div class="date-box">
              <div class="date-label">Durée totale</div>
              <div class="date-value">{{DUREE_NUITS}} nuits</div>
              <div style="margin-top: 8px;">
                <span class="duree-badge">{{DUREE_JOURS}} jours</span>
              </div>
            </div>
          </div>
          
          <p style="font-size: 10pt; color: #92400e; margin-top: 15px;">
            ⚠️ <strong>Important :</strong> La durée totale du séjour ne peut excéder 90 jours consécutifs 
            conformément à la réglementation sur les locations saisonnières.
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 4 - Conditions d'arrivée et de départ</div>
          <p class="article-content">
            <strong>Arrivée :</strong> Le locataire pourra prendre possession des lieux le {{DATE_ARRIVEE}} 
            à partir de {{HEURE_ARRIVEE}}. Un état des lieux d'entrée sera établi contradictoirement.
            <br><br>
            <strong>Départ :</strong> Le locataire devra libérer les lieux le {{DATE_DEPART}} avant {{HEURE_DEPART}}, 
            après avoir effectué l'état des lieux de sortie.
            <br><br>
            {{#if REMISE_CLES_PERSONNE}}
            <strong>Remise des clés :</strong> {{REMISE_CLES_MODALITES}}
            {{/if}}
          </p>
        </div>
      </div>
    </div>
    
    <!-- IV. CONDITIONS FINANCIÈRES -->
    <div class="section page-break">
      <div class="section-title">IV. Conditions Financières</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 5 - Prix du séjour</div>
          
          <div class="financial-summary">
            <div class="financial-row">
              <span>Location ({{DUREE_NUITS}} nuits × {{PRIX_NUIT}} €)</span>
              <span><strong>{{PRIX_LOCATION}} €</strong></span>
            </div>
            {{#if FRAIS_MENAGE}}
            <div class="financial-row">
              <span>Forfait ménage de fin de séjour</span>
              <span>{{FRAIS_MENAGE}} €</span>
            </div>
            {{/if}}
            {{#if FRAIS_LINGE}}
            <div class="financial-row">
              <span>Forfait linge de maison</span>
              <span>{{FRAIS_LINGE}} €</span>
            </div>
            {{/if}}
            {{#if CHARGES_COMPRISES}}
            <div class="financial-row">
              <span>Charges (eau, électricité, chauffage)</span>
              <span>Incluses</span>
            </div>
            {{else}}
            <div class="financial-row">
              <span>Provision sur charges</span>
              <span>{{CHARGES_MONTANT}} €</span>
            </div>
            {{/if}}
            <div class="financial-row subtotal">
              <span>Sous-total séjour</span>
              <span><strong>{{SOUS_TOTAL}} €</strong></span>
            </div>
            {{#if TAXE_SEJOUR_APPLICABLE}}
            <div class="financial-row">
              <span>Taxe de séjour ({{NB_PERSONNES}} pers. × {{DUREE_NUITS}} nuits × {{TAXE_SEJOUR_NUIT}} €)</span>
              <span>{{TAXE_SEJOUR_TOTAL}} €</span>
            </div>
            {{/if}}
            <div class="financial-row total">
              <span>TOTAL À RÉGLER</span>
              <span>{{PRIX_TOTAL}} €</span>
            </div>
          </div>
          
          <p class="article-content">
            Soit en toutes lettres : <strong>{{PRIX_TOTAL_LETTRES}}</strong>
          </p>
        </div>
        
        {{#if TAXE_SEJOUR_APPLICABLE}}
        <div class="taxe-sejour-box">
          <div class="taxe-sejour-title">💰 Taxe de séjour</div>
          <p style="font-size: 10pt;">
            Conformément à la délibération du conseil municipal de {{LOGEMENT_VILLE}}, une taxe de séjour 
            de <strong>{{TAXE_SEJOUR_NUIT}} € par personne et par nuit</strong> est applicable.
            <br><br>
            Cette taxe est collectée par le propriétaire et reversée à la commune. 
            Elle est due par toute personne majeure non domiciliée dans la commune.
          </p>
        </div>
        {{/if}}
        
        <div class="article">
          <div class="article-title">Article 6 - Dépôt de garantie (caution)</div>
          <p class="article-content">
            Un dépôt de garantie de <strong>{{DEPOT_GARANTIE}} €</strong> ({{DEPOT_GARANTIE_LETTRES}}) 
            est demandé à la réservation ou à l'arrivée.
            <br><br>
            Ce dépôt sera restitué dans un délai de <strong>{{DELAI_RESTITUTION_DEPOT}} jours</strong> 
            après le départ, déduction faite des éventuelles dégradations constatées ou des frais 
            de remise en état (sur présentation de justificatifs).
            <br><br>
            <strong>Mode de dépôt :</strong> {{MODE_DEPOT_GARANTIE}}
          </p>
        </div>
      </div>
    </div>
    
    <!-- V. MODALITÉS DE PAIEMENT -->
    <div class="section">
      <div class="section-title">V. Modalités de Paiement</div>
      <div class="section-content">
        <div class="paiement-box">
          <div class="paiement-title">📝 Échéancier de paiement</div>
          
          <div class="paiement-grid">
            <div class="paiement-item">
              <div class="paiement-label">{{ACOMPTE_TYPE}} à la réservation</div>
              <div class="paiement-value">{{ACOMPTE_MONTANT}} €</div>
              <div style="font-size: 9pt; color: #666; margin-top: 5px;">
                ({{ACOMPTE_POURCENTAGE}}% du total)
              </div>
            </div>
            
            <div class="paiement-item">
              <div class="paiement-label">Solde à l'arrivée</div>
              <div class="paiement-value">{{SOLDE_MONTANT}} €</div>
              <div style="font-size: 9pt; color: #666; margin-top: 5px;">
                À régler le {{DATE_ARRIVEE}}
              </div>
            </div>
          </div>
          
          <p style="margin-top: 15px; font-size: 10pt;">
            <strong>Modes de paiement acceptés :</strong> {{MODES_PAIEMENT}}
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">⚠️ Distinction Arrhes / Acompte</div>
          <p class="article-content">
            {{#if VERSEMENT_ARRHES}}
            Le versement initial constitue des <strong>ARRHES</strong> au sens de l'article 1590 du Code civil :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>En cas d'annulation par le locataire : les arrhes restent acquises au propriétaire</li>
              <li>En cas d'annulation par le propriétaire : le propriétaire doit restituer le double des arrhes</li>
            </ul>
            {{else}}
            Le versement initial constitue un <strong>ACOMPTE</strong> :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Il engage définitivement les deux parties</li>
              <li>En cas d'annulation par le locataire : le locataire reste redevable de la totalité du prix</li>
              <li>En cas d'annulation par le propriétaire : le propriétaire doit indemniser le locataire</li>
            </ul>
            {{/if}}
          </p>
        </div>
      </div>
    </div>
    
    <!-- VI. CONDITIONS D'ANNULATION -->
    <div class="section">
      <div class="section-title">VI. Conditions d'Annulation</div>
      <div class="section-content">
        <div class="annulation-box">
          <div class="annulation-title">❌ Politique d'annulation</div>
          
          <table class="annulation-table">
            <thead>
              <tr>
                <th>Délai avant l'arrivée</th>
                <th>Conditions</th>
              </tr>
            </thead>
            <tbody>
              {{#each CONDITIONS_ANNULATION}}
              <tr>
                <td>{{this.delai}}</td>
                <td>{{this.condition}}</td>
              </tr>
              {{/each}}
            </tbody>
          </table>
          
          <p style="margin-top: 15px; font-size: 10pt; font-style: italic;">
            En cas de départ anticipé du locataire, aucun remboursement ne sera effectué.
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 7 - Assurance annulation</div>
          <p class="article-content">
            {{#if ASSURANCE_ANNULATION_PROPOSEE}}
            Une assurance annulation est proposée au locataire pour un montant de {{ASSURANCE_ANNULATION_PRIX}} €.
            <br><br>
            <strong>Le locataire déclare :</strong>
            <br>
            ☐ Souscrire à l'assurance annulation
            <br>
            ☐ Ne pas souscrire à l'assurance annulation
            {{else}}
            Il est conseillé au locataire de souscrire une assurance annulation auprès de son assureur.
            {{/if}}
          </p>
        </div>
      </div>
    </div>
    
    <!-- VII. OBLIGATIONS DES PARTIES -->
    <div class="section page-break">
      <div class="section-title">VII. Obligations des Parties</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 8 - Obligations du propriétaire</div>
          <p class="article-content">
            Le propriétaire s'engage à :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Délivrer le logement conforme à la description et en bon état de propreté</li>
              <li>Assurer la jouissance paisible du logement pendant toute la durée du séjour</li>
              <li>Fournir les équipements annoncés en bon état de fonctionnement</li>
              <li>Informer le locataire des modalités de fonctionnement des équipements</li>
              <li>Intervenir en cas de panne ou dysfonctionnement majeur</li>
            </ul>
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 9 - Obligations du locataire</div>
          <p class="article-content">
            Le locataire s'engage à :
            <ul style="padding-left: 20px; margin-top: 10px;">
              <li>Occuper les lieux de manière paisible et en bon père de famille</li>
              <li>Ne pas dépasser la capacité d'accueil de <strong>{{CAPACITE_PERSONNES}} personnes</strong></li>
              <li>Respecter le règlement intérieur {{#if REGLEMENT_COPROPRIETE}}et le règlement de copropriété{{/if}}</li>
              <li>Ne pas sous-louer le logement ni céder ses droits</li>
              <li>Signaler immédiatement tout dommage ou dysfonctionnement</li>
              <li>Restituer le logement dans l'état où il l'a trouvé</li>
              <li>Respecter les horaires de départ</li>
              {{#if ANIMAUX_INTERDITS}}
              <li>Ne pas introduire d'animaux dans le logement</li>
              {{/if}}
              {{#if NON_FUMEUR}}
              <li>Ne pas fumer à l'intérieur du logement</li>
              {{/if}}
            </ul>
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 10 - Assurance</div>
          <p class="article-content">
            Le locataire déclare être titulaire d'une assurance responsabilité civile villégiature 
            couvrant les dommages qu'il pourrait causer au logement et à son contenu.
            <br><br>
            <strong>Compagnie d'assurance :</strong> {{ASSURANCE_LOCATAIRE_COMPAGNIE}}<br>
            <strong>N° de police :</strong> {{ASSURANCE_LOCATAIRE_NUMERO}}
          </p>
        </div>
      </div>
    </div>
    
    <!-- VIII. ÉTAT DES LIEUX -->
    <div class="section">
      <div class="section-title">VIII. État des Lieux</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 11 - État des lieux d'entrée</div>
          <p class="article-content">
            Un état des lieux contradictoire sera établi à l'arrivée du locataire. 
            Le locataire disposera de <strong>24 heures</strong> pour signaler toute anomalie 
            non mentionnée dans l'état des lieux.
          </p>
        </div>
        
        <div class="article">
          <div class="article-title">Article 12 - État des lieux de sortie</div>
          <p class="article-content">
            Un état des lieux de sortie sera établi le jour du départ. En cas d'impossibilité 
            de présence du propriétaire, le locataire laissera les clés selon les modalités convenues 
            et l'état des lieux sera réputé conforme sauf réserves notifiées dans les 48 heures.
          </p>
        </div>
      </div>
    </div>
    
    <!-- IX. LITIGES -->
    <div class="section">
      <div class="section-title">IX. Litiges et Médiation</div>
      <div class="section-content">
        <div class="article">
          <p class="article-content">
            En cas de litige, les parties s'engagent à rechercher une solution amiable avant 
            toute action judiciaire.
            <br><br>
            À défaut d'accord amiable, le tribunal compétent sera celui du lieu de situation du logement.
            <br><br>
            {{#if MEDIATEUR}}
            <strong>Médiateur de la consommation :</strong> {{MEDIATEUR_NOM}}<br>
            {{MEDIATEUR_ADRESSE}}
            {{/if}}
          </p>
        </div>
      </div>
    </div>
    
    <!-- X. ANNEXES -->
    <div class="section">
      <div class="section-title">X. Documents Annexés</div>
      <div class="section-content">
        <ul style="list-style: none; padding: 0;">
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Inventaire détaillé du mobilier et des équipements</span>
          </li>
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Descriptif du logement avec photos</span>
          </li>
          {{#if REGLEMENT_INTERIEUR}}
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Règlement intérieur</span>
          </li>
          {{/if}}
          {{#if DPE_ANNEXE}}
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Diagnostic de performance énergétique (DPE)</span>
          </li>
          {{/if}}
          <li class="checkbox-item">
            <div class="checkbox checked"></div>
            <span>Plan d'accès et informations pratiques</span>
          </li>
        </ul>
      </div>
    </div>
    
    <!-- XI. SIGNATURES -->
    <div class="section signature-section">
      <div class="section-title">XI. Signatures</div>
      <div class="section-content">
        <p class="article-content">
          Fait en deux exemplaires, à <strong>{{LIEU_SIGNATURE}}</strong>, le <strong>{{DATE_SIGNATURE}}</strong>.
        </p>
        
        <p class="article-content" style="margin: 20px 0; font-style: italic; font-size: 10pt;">
          Les parties déclarent avoir pris connaissance de l'ensemble des conditions du présent contrat 
          et les accepter sans réserve.
        </p>
        
        <div class="signature-grid">
          <div class="signature-box">
            <div class="signature-title">Le Propriétaire</div>
            <p class="signature-mention">"Lu et approuvé"</p>
            <div class="signature-line"></div>
            <p style="font-size: 9pt;">{{BAILLEUR_NOM_COMPLET}}</p>
          </div>
          
          <div class="signature-box">
            <div class="signature-title">Le Locataire</div>
            <p class="signature-mention">"Lu et approuvé"</p>
            <div class="signature-line"></div>
            <p style="font-size: 9pt;">{{LOCATAIRE_NOM_COMPLET}}</p>
          </div>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>Contrat de location saisonnière - Article 1-1 de la loi n°89-462 du 6 juillet 1989</p>
      <p>Document généré le {{DATE_GENERATION}} - Référence : {{REFERENCE_BAIL}}</p>
    </div>
  </div>
</body>
</html>
`;

// Variables disponibles pour le bail saisonnier
export const BAIL_SAISONNIER_VARIABLES = [
  // Système
  'REFERENCE_BAIL',
  'DATE_GENERATION',
  'DATE_SIGNATURE',
  'LIEU_SIGNATURE',
  
  // Propriétaire
  'BAILLEUR_NOM_COMPLET',
  'BAILLEUR_ADRESSE',
  'BAILLEUR_CODE_POSTAL',
  'BAILLEUR_VILLE',
  'BAILLEUR_TELEPHONE',
  'BAILLEUR_EMAIL',
  
  // Locataire
  'LOCATAIRE_NOM_COMPLET',
  'LOCATAIRE_ADRESSE',
  'LOCATAIRE_CODE_POSTAL',
  'LOCATAIRE_VILLE',
  'LOCATAIRE_TELEPHONE',
  'LOCATAIRE_EMAIL',
  
  // Logement
  'LOGEMENT_ADRESSE',
  'LOGEMENT_CODE_POSTAL',
  'LOGEMENT_VILLE',
  'LOGEMENT_TYPE',
  'LOGEMENT_SURFACE',
  'LOGEMENT_NB_PIECES',
  'LOGEMENT_NB_CHAMBRES',
  'LOGEMENT_ETAGE',
  'ASCENSEUR',
  'CAPACITE_PERSONNES',
  'LOGEMENT_ANNEXES',
  'EQUIPEMENTS', // Array
  
  // Classement tourisme
  'MEUBLE_TOURISME',
  'CLASSEMENT_ETOILES',
  'NUMERO_CLASSEMENT',
  
  // Dates séjour
  'DATE_ARRIVEE',
  'HEURE_ARRIVEE',
  'DATE_DEPART',
  'HEURE_DEPART',
  'DUREE_NUITS',
  'DUREE_JOURS',
  
  // Remise des clés
  'REMISE_CLES_PERSONNE',
  'REMISE_CLES_MODALITES',
  
  // Prix
  'PRIX_NUIT',
  'PRIX_LOCATION',
  'FRAIS_MENAGE',
  'FRAIS_LINGE',
  'CHARGES_COMPRISES',
  'CHARGES_MONTANT',
  'SOUS_TOTAL',
  'PRIX_TOTAL',
  'PRIX_TOTAL_LETTRES',
  
  // Taxe de séjour
  'TAXE_SEJOUR_APPLICABLE',
  'TAXE_SEJOUR_NUIT',
  'TAXE_SEJOUR_TOTAL',
  'NB_PERSONNES',
  
  // Dépôt de garantie
  'DEPOT_GARANTIE',
  'DEPOT_GARANTIE_LETTRES',
  'DELAI_RESTITUTION_DEPOT',
  'MODE_DEPOT_GARANTIE',
  
  // Paiement
  'VERSEMENT_ARRHES', // boolean (arrhes vs acompte)
  'ACOMPTE_TYPE', // "Arrhes" ou "Acompte"
  'ACOMPTE_MONTANT',
  'ACOMPTE_POURCENTAGE',
  'SOLDE_MONTANT',
  'MODES_PAIEMENT',
  
  // Annulation
  'CONDITIONS_ANNULATION', // Array [{delai, condition}]
  'ASSURANCE_ANNULATION_PROPOSEE',
  'ASSURANCE_ANNULATION_PRIX',
  
  // Règles
  'ANIMAUX_INTERDITS',
  'NON_FUMEUR',
  'REGLEMENT_INTERIEUR',
  'REGLEMENT_COPROPRIETE',
  
  // Assurance locataire
  'ASSURANCE_LOCATAIRE_COMPAGNIE',
  'ASSURANCE_LOCATAIRE_NUMERO',
  
  // Annexes
  'DPE_ANNEXE',
  
  // Médiation
  'MEDIATEUR',
  'MEDIATEUR_NOM',
  'MEDIATEUR_ADRESSE',
];

export default BAIL_SAISONNIER_TEMPLATE;

