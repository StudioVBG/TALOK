-- Migration : Seed des templates de bail
-- Insère les templates de bail conformes à la législation française
-- Date : 2024-11-27

-- ============================================
-- 1. TEMPLATE BAIL LOCATION VIDE
-- ============================================

INSERT INTO lease_templates (
  id,
  name,
  type_bail,
  template_content,
  variables,
  version,
  is_active
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'Bail de location vide - Loi ALUR',
  'nu',
  '<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Contrat de location - Bail de location vide</title>
  <style>
    body { font-family: "Times New Roman", serif; font-size: 11pt; line-height: 1.5; padding: 20mm; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .header h1 { font-size: 18pt; text-transform: uppercase; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title { font-size: 12pt; font-weight: bold; background: #333; color: #fff; padding: 8px 15px; margin-bottom: 15px; }
    .article { margin-bottom: 20px; }
    .article-title { font-weight: bold; margin-bottom: 8px; color: #333; }
    .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .info-table th, .info-table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    .info-table th { background: #f5f5f5; width: 40%; }
    .financial-summary { background: #f9f9f9; border: 2px solid #333; padding: 20px; margin: 20px 0; }
    .signature-box { border: 1px solid #ccc; padding: 20px; min-height: 120px; display: inline-block; width: 45%; margin: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Contrat de Location</h1>
    <p>Bail de location vide à usage de résidence principale</p>
    <p><small>Référence : {{REFERENCE_BAIL}}</small></p>
  </div>
  
  <div class="section">
    <div class="section-title">I. Désignation des Parties</div>
    <p><strong>LE BAILLEUR :</strong> {{BAILLEUR_NOM_COMPLET}}<br>
    Adresse : {{BAILLEUR_ADRESSE}}</p>
    <p><strong>LE LOCATAIRE :</strong> {{LOCATAIRE_NOM_COMPLET}}<br>
    Né(e) le {{LOCATAIRE_DATE_NAISSANCE}} à {{LOCATAIRE_LIEU_NAISSANCE}}</p>
  </div>
  
  <div class="section">
    <div class="section-title">II. Désignation du Logement</div>
    <table class="info-table">
      <tr><th>Adresse</th><td>{{LOGEMENT_ADRESSE}}, {{LOGEMENT_CODE_POSTAL}} {{LOGEMENT_VILLE}}</td></tr>
      <tr><th>Type</th><td>{{LOGEMENT_TYPE}}</td></tr>
      <tr><th>Surface habitable</th><td>{{LOGEMENT_SURFACE}} m²</td></tr>
      <tr><th>Nombre de pièces</th><td>{{LOGEMENT_NB_PIECES}}</td></tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">III. Durée du Bail</div>
    <table class="info-table">
      <tr><th>Date de début</th><td>{{BAIL_DATE_DEBUT}}</td></tr>
      <tr><th>Durée</th><td>{{BAIL_DUREE}}</td></tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">IV. Conditions Financières</div>
    <div class="financial-summary">
      <p>Loyer mensuel hors charges : <strong>{{LOYER_HC}} €</strong></p>
      <p>Provisions sur charges : {{CHARGES_MONTANT}} €</p>
      <p><strong>Total mensuel : {{LOYER_TOTAL}} €</strong></p>
    </div>
    <p>Dépôt de garantie : <strong>{{DEPOT_GARANTIE}} €</strong></p>
  </div>
  
  <div class="section">
    <div class="section-title">V. Diagnostics Techniques</div>
    <table class="info-table">
      <tr><th>Classe énergie (DPE)</th><td>{{DPE_CLASSE}}</td></tr>
      <tr><th>Classe GES</th><td>{{DPE_GES}}</td></tr>
      <tr><th>Consommation</th><td>{{DPE_CONSOMMATION}} kWh/m²/an</td></tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">VI. Signatures</div>
    <p>Fait à {{LIEU_SIGNATURE}}, le {{DATE_SIGNATURE}}</p>
    <div class="signature-box">
      <p><strong>Le Bailleur</strong></p>
      <p><small>"Lu et approuvé"</small></p>
    </div>
    <div class="signature-box">
      <p><strong>Le Locataire</strong></p>
      <p><small>"Lu et approuvé"</small></p>
    </div>
  </div>
</body>
</html>',
  '{
    "required": [
      "REFERENCE_BAIL",
      "BAILLEUR_NOM_COMPLET",
      "BAILLEUR_ADRESSE",
      "LOCATAIRE_NOM_COMPLET",
      "LOCATAIRE_DATE_NAISSANCE",
      "LOCATAIRE_LIEU_NAISSANCE",
      "LOGEMENT_ADRESSE",
      "LOGEMENT_CODE_POSTAL",
      "LOGEMENT_VILLE",
      "LOGEMENT_TYPE",
      "LOGEMENT_SURFACE",
      "LOGEMENT_NB_PIECES",
      "BAIL_DATE_DEBUT",
      "BAIL_DUREE",
      "LOYER_HC",
      "CHARGES_MONTANT",
      "LOYER_TOTAL",
      "DEPOT_GARANTIE",
      "DPE_CLASSE",
      "DPE_GES",
      "DPE_CONSOMMATION",
      "LIEU_SIGNATURE",
      "DATE_SIGNATURE"
    ],
    "optional": [
      "LOYER_REFERENCE",
      "LOYER_REFERENCE_MAJORE",
      "COMPLEMENT_LOYER",
      "GARANT_NOM",
      "GARANT_ADRESSE"
    ]
  }'::jsonb,
  1,
  true
) ON CONFLICT (id) DO UPDATE SET
  template_content = EXCLUDED.template_content,
  variables = EXCLUDED.variables,
  version = lease_templates.version + 1,
  updated_at = NOW();

-- ============================================
-- 2. TEMPLATE BAIL LOCATION MEUBLÉE
-- ============================================

INSERT INTO lease_templates (
  id,
  name,
  type_bail,
  template_content,
  variables,
  version,
  is_active
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  'Bail de location meublée - Loi ALUR',
  'meuble',
  '<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Contrat de location meublée</title>
  <style>
    body { font-family: "Times New Roman", serif; font-size: 11pt; line-height: 1.5; padding: 20mm; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a5f7a; padding-bottom: 20px; }
    .header h1 { font-size: 18pt; text-transform: uppercase; color: #1a5f7a; }
    .badge { display: inline-block; background: #1a5f7a; color: #fff; padding: 5px 15px; border-radius: 20px; font-size: 10pt; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title { font-size: 12pt; font-weight: bold; background: #1a5f7a; color: #fff; padding: 8px 15px; margin-bottom: 15px; }
    .inventaire-box { background: #fff8e6; border: 2px solid #ffa500; padding: 20px; margin: 20px 0; }
    .inventaire-item { display: flex; align-items: center; margin: 5px 0; }
    .checkbox { width: 16px; height: 16px; border: 1px solid #000; margin-right: 10px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .info-table th, .info-table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    .info-table th { background: #e8f4f8; width: 40%; }
    .financial-summary { background: #f9f9f9; border: 2px solid #1a5f7a; padding: 20px; margin: 20px 0; }
    .signature-box { border: 1px solid #1a5f7a; padding: 20px; min-height: 120px; display: inline-block; width: 45%; margin: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Contrat de Location Meublée</h1>
    <p>Bail de location meublée à usage de résidence principale</p>
    <span class="badge">MEUBLÉ</span>
    <p><small>Référence : {{REFERENCE_BAIL}}</small></p>
  </div>
  
  <div class="section">
    <div class="section-title">I. Désignation des Parties</div>
    <p><strong>LE BAILLEUR :</strong> {{BAILLEUR_NOM_COMPLET}}<br>
    Adresse : {{BAILLEUR_ADRESSE}}</p>
    <p><strong>LE LOCATAIRE :</strong> {{LOCATAIRE_NOM_COMPLET}}<br>
    Né(e) le {{LOCATAIRE_DATE_NAISSANCE}} à {{LOCATAIRE_LIEU_NAISSANCE}}</p>
  </div>
  
  <div class="section">
    <div class="section-title">II. Désignation du Logement</div>
    <table class="info-table">
      <tr><th>Adresse</th><td>{{LOGEMENT_ADRESSE}}, {{LOGEMENT_CODE_POSTAL}} {{LOGEMENT_VILLE}}</td></tr>
      <tr><th>Type</th><td>{{LOGEMENT_TYPE}} (MEUBLÉ)</td></tr>
      <tr><th>Surface habitable</th><td>{{LOGEMENT_SURFACE}} m²</td></tr>
      <tr><th>Nombre de pièces</th><td>{{LOGEMENT_NB_PIECES}}</td></tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">III. Inventaire du Mobilier Obligatoire</div>
    <p><em>Conformément au décret n°2015-981 du 31 juillet 2015</em></p>
    <div class="inventaire-box">
      <div class="inventaire-item"><div class="checkbox">✓</div> Literie avec couette ou couverture</div>
      <div class="inventaire-item"><div class="checkbox">✓</div> Volets ou rideaux occultants dans les chambres</div>
      <div class="inventaire-item"><div class="checkbox">✓</div> Plaques de cuisson</div>
      <div class="inventaire-item"><div class="checkbox">✓</div> Four ou micro-ondes</div>
      <div class="inventaire-item"><div class="checkbox">✓</div> Réfrigérateur avec compartiment congélation</div>
      <div class="inventaire-item"><div class="checkbox">✓</div> Vaisselle et ustensiles de cuisine</div>
      <div class="inventaire-item"><div class="checkbox">✓</div> Table et sièges</div>
      <div class="inventaire-item"><div class="checkbox">✓</div> Étagères de rangement</div>
      <div class="inventaire-item"><div class="checkbox">✓</div> Luminaires</div>
      <div class="inventaire-item"><div class="checkbox">✓</div> Matériel d''entretien ménager</div>
    </div>
    <p><strong>Inventaire détaillé annexé au présent contrat.</strong></p>
  </div>
  
  <div class="section">
    <div class="section-title">IV. Durée du Bail</div>
    <table class="info-table">
      <tr><th>Date de début</th><td>{{BAIL_DATE_DEBUT}}</td></tr>
      <tr><th>Durée</th><td>{{BAIL_DUREE}}</td></tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">V. Conditions Financières</div>
    <div class="financial-summary">
      <p>Loyer mensuel hors charges : <strong>{{LOYER_HC}} €</strong></p>
      <p>{{CHARGES_TYPE_LABEL}} : {{CHARGES_MONTANT}} €</p>
      <p><strong>Total mensuel : {{LOYER_TOTAL}} €</strong></p>
    </div>
    <p>Dépôt de garantie (max 2 mois) : <strong>{{DEPOT_GARANTIE}} €</strong></p>
  </div>
  
  <div class="section">
    <div class="section-title">VI. Diagnostics Techniques</div>
    <table class="info-table">
      <tr><th>Classe énergie (DPE)</th><td>{{DPE_CLASSE}}</td></tr>
      <tr><th>Classe GES</th><td>{{DPE_GES}}</td></tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">VII. Signatures</div>
    <p>Fait à {{LIEU_SIGNATURE}}, le {{DATE_SIGNATURE}}</p>
    <div class="signature-box">
      <p><strong>Le Bailleur</strong></p>
      <p><small>"Lu et approuvé"</small></p>
    </div>
    <div class="signature-box">
      <p><strong>Le Locataire</strong></p>
      <p><small>"Lu et approuvé"</small></p>
    </div>
  </div>
</body>
</html>',
  '{
    "required": [
      "REFERENCE_BAIL",
      "BAILLEUR_NOM_COMPLET",
      "BAILLEUR_ADRESSE",
      "LOCATAIRE_NOM_COMPLET",
      "LOCATAIRE_DATE_NAISSANCE",
      "LOCATAIRE_LIEU_NAISSANCE",
      "LOGEMENT_ADRESSE",
      "LOGEMENT_CODE_POSTAL",
      "LOGEMENT_VILLE",
      "LOGEMENT_TYPE",
      "LOGEMENT_SURFACE",
      "LOGEMENT_NB_PIECES",
      "BAIL_DATE_DEBUT",
      "BAIL_DUREE",
      "LOYER_HC",
      "CHARGES_MONTANT",
      "CHARGES_TYPE_LABEL",
      "LOYER_TOTAL",
      "DEPOT_GARANTIE",
      "DPE_CLASSE",
      "DPE_GES",
      "LIEU_SIGNATURE",
      "DATE_SIGNATURE"
    ],
    "optional": [
      "INVENTAIRE_MEUBLES",
      "BAIL_ETUDIANT"
    ]
  }'::jsonb,
  1,
  true
) ON CONFLICT (id) DO UPDATE SET
  template_content = EXCLUDED.template_content,
  variables = EXCLUDED.variables,
  version = lease_templates.version + 1,
  updated_at = NOW();

-- ============================================
-- 3. TEMPLATE BAIL COLOCATION
-- ============================================

INSERT INTO lease_templates (
  id,
  name,
  type_bail,
  template_content,
  variables,
  version,
  is_active
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d481',
  'Bail de colocation - Loi ALUR',
  'colocation',
  '<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Contrat de colocation</title>
  <style>
    body { font-family: "Times New Roman", serif; font-size: 11pt; line-height: 1.5; padding: 20mm; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #7c3aed; padding-bottom: 20px; }
    .header h1 { font-size: 18pt; text-transform: uppercase; color: #7c3aed; }
    .badge { display: inline-block; background: #7c3aed; color: #fff; padding: 5px 15px; border-radius: 20px; font-size: 10pt; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title { font-size: 12pt; font-weight: bold; background: #7c3aed; color: #fff; padding: 8px 15px; margin-bottom: 15px; }
    .colocataire-card { border: 1px solid #7c3aed; padding: 15px; margin: 10px 0; border-radius: 8px; background: #faf5ff; }
    .solidarite-box { background: #fef2f2; border: 2px solid #ef4444; padding: 20px; margin: 20px 0; }
    .solidarite-title { font-weight: bold; color: #dc2626; margin-bottom: 10px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .info-table th, .info-table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    .info-table th { background: #f5f3ff; width: 40%; }
    .quote-parts-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .quote-parts-table th, .quote-parts-table td { border: 1px solid #ddd; padding: 10px; text-align: center; }
    .quote-parts-table th { background: #f5f3ff; }
    .signature-box { border: 1px solid #7c3aed; padding: 15px; min-height: 100px; display: inline-block; width: 30%; margin: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Contrat de Colocation</h1>
    <p>Bail de colocation à usage de résidence principale</p>
    <span class="badge">COLOCATION</span>
    <p><small>Référence : {{REFERENCE_BAIL}}</small></p>
  </div>
  
  <div class="section">
    <div class="section-title">I. Désignation des Parties</div>
    <p><strong>LE BAILLEUR :</strong> {{BAILLEUR_NOM_COMPLET}}<br>
    Adresse : {{BAILLEUR_ADRESSE}}</p>
    
    <p><strong>LES COLOCATAIRES :</strong></p>
    {{COLOCATAIRES_HTML}}
  </div>
  
  <div class="section">
    <div class="section-title">II. Désignation du Logement</div>
    <table class="info-table">
      <tr><th>Adresse</th><td>{{LOGEMENT_ADRESSE}}, {{LOGEMENT_CODE_POSTAL}} {{LOGEMENT_VILLE}}</td></tr>
      <tr><th>Type</th><td>{{LOGEMENT_TYPE}} (COLOCATION)</td></tr>
      <tr><th>Surface totale</th><td>{{LOGEMENT_SURFACE}} m²</td></tr>
      <tr><th>Nombre de chambres</th><td>{{LOGEMENT_NB_CHAMBRES}}</td></tr>
    </table>
  </div>
  
  {{CLAUSE_SOLIDARITE_HTML}}
  
  <div class="section">
    <div class="section-title">III. Durée du Bail</div>
    <table class="info-table">
      <tr><th>Date de début</th><td>{{BAIL_DATE_DEBUT}}</td></tr>
      <tr><th>Durée</th><td>{{BAIL_DUREE}}</td></tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">IV. Conditions Financières</div>
    <p><strong>Loyer global :</strong> {{LOYER_HC_TOTAL}} € HC + {{CHARGES_TOTAL}} € charges = <strong>{{LOYER_TOTAL_GLOBAL}} €/mois</strong></p>
    
    <p><strong>Répartition par colocataire :</strong></p>
    <table class="quote-parts-table">
      <tr>
        <th>Colocataire</th>
        <th>Quote-part</th>
        <th>Loyer</th>
        <th>Charges</th>
        <th>Total</th>
      </tr>
      {{QUOTE_PARTS_HTML}}
    </table>
    
    <p><strong>Dépôt de garantie total :</strong> {{DEPOT_GARANTIE_TOTAL}} €</p>
  </div>
  
  <div class="section">
    <div class="section-title">V. Diagnostics Techniques</div>
    <table class="info-table">
      <tr><th>Classe énergie (DPE)</th><td>{{DPE_CLASSE}}</td></tr>
      <tr><th>Classe GES</th><td>{{DPE_GES}}</td></tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">VI. Signatures</div>
    <p>Fait à {{LIEU_SIGNATURE}}, le {{DATE_SIGNATURE}}</p>
    <p><strong>Le Bailleur :</strong></p>
    <div class="signature-box" style="width: 45%;">
      <p>{{BAILLEUR_NOM_COMPLET}}</p>
      <p><small>"Lu et approuvé"</small></p>
    </div>
    <p><strong>Les Colocataires :</strong></p>
    {{SIGNATURES_COLOCATAIRES_HTML}}
  </div>
</body>
</html>',
  '{
    "required": [
      "REFERENCE_BAIL",
      "BAILLEUR_NOM_COMPLET",
      "BAILLEUR_ADRESSE",
      "COLOCATAIRES_HTML",
      "LOGEMENT_ADRESSE",
      "LOGEMENT_CODE_POSTAL",
      "LOGEMENT_VILLE",
      "LOGEMENT_TYPE",
      "LOGEMENT_SURFACE",
      "LOGEMENT_NB_CHAMBRES",
      "BAIL_DATE_DEBUT",
      "BAIL_DUREE",
      "LOYER_HC_TOTAL",
      "CHARGES_TOTAL",
      "LOYER_TOTAL_GLOBAL",
      "QUOTE_PARTS_HTML",
      "DEPOT_GARANTIE_TOTAL",
      "DPE_CLASSE",
      "DPE_GES",
      "LIEU_SIGNATURE",
      "DATE_SIGNATURE",
      "SIGNATURES_COLOCATAIRES_HTML"
    ],
    "optional": [
      "CLAUSE_SOLIDARITE_HTML",
      "BAIL_MEUBLE"
    ]
  }'::jsonb,
  1,
  true
) ON CONFLICT (id) DO UPDATE SET
  template_content = EXCLUDED.template_content,
  variables = EXCLUDED.variables,
  version = lease_templates.version + 1,
  updated_at = NOW();

-- ============================================
-- 4. TEMPLATE BAIL SAISONNIER
-- ============================================

INSERT INTO lease_templates (
  id,
  name,
  type_bail,
  template_content,
  variables,
  version,
  is_active
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d482',
  'Bail de location saisonnière',
  'saisonnier',
  '<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Contrat de location saisonnière</title>
  <style>
    body { font-family: "Times New Roman", serif; font-size: 11pt; line-height: 1.5; padding: 20mm; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #f59e0b; padding-bottom: 20px; }
    .header h1 { font-size: 18pt; text-transform: uppercase; color: #f59e0b; }
    .badge { display: inline-block; background: #f59e0b; color: #fff; padding: 5px 15px; border-radius: 20px; font-size: 10pt; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 12pt; font-weight: bold; background: #f59e0b; color: #fff; padding: 8px 15px; margin-bottom: 15px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .info-table th, .info-table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    .info-table th { background: #fef3c7; width: 40%; }
    .warning-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; margin: 20px 0; }
    .signature-box { border: 1px solid #f59e0b; padding: 20px; min-height: 120px; display: inline-block; width: 45%; margin: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Contrat de Location Saisonnière</h1>
    <span class="badge">SAISONNIER</span>
    <p><small>Référence : {{REFERENCE_BAIL}}</small></p>
  </div>
  
  <div class="warning-box">
    <strong>⚠️ Location saisonnière</strong><br>
    Ce contrat concerne une location de courte durée (maximum 90 jours consécutifs).<br>
    Le logement ne peut pas constituer la résidence principale du locataire.
  </div>
  
  <div class="section">
    <div class="section-title">I. Désignation des Parties</div>
    <p><strong>LE BAILLEUR :</strong> {{BAILLEUR_NOM_COMPLET}}<br>
    Adresse : {{BAILLEUR_ADRESSE}}</p>
    <p><strong>LE LOCATAIRE :</strong> {{LOCATAIRE_NOM_COMPLET}}<br>
    Adresse permanente : {{LOCATAIRE_ADRESSE_PERMANENTE}}</p>
  </div>
  
  <div class="section">
    <div class="section-title">II. Désignation du Logement</div>
    <table class="info-table">
      <tr><th>Adresse</th><td>{{LOGEMENT_ADRESSE}}, {{LOGEMENT_CODE_POSTAL}} {{LOGEMENT_VILLE}}</td></tr>
      <tr><th>Type</th><td>{{LOGEMENT_TYPE}}</td></tr>
      <tr><th>Surface</th><td>{{LOGEMENT_SURFACE}} m²</td></tr>
      <tr><th>Capacité d''accueil</th><td>{{CAPACITE_ACCUEIL}} personnes</td></tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">III. Période de Location</div>
    <table class="info-table">
      <tr><th>Date d''arrivée</th><td>{{DATE_ARRIVEE}} à partir de {{HEURE_ARRIVEE}}</td></tr>
      <tr><th>Date de départ</th><td>{{DATE_DEPART}} avant {{HEURE_DEPART}}</td></tr>
      <tr><th>Durée</th><td>{{DUREE_NUITS}} nuit(s)</td></tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">IV. Conditions Financières</div>
    <table class="info-table">
      <tr><th>Prix par nuit</th><td>{{PRIX_NUIT}} €</td></tr>
      <tr><th>Frais de ménage</th><td>{{FRAIS_MENAGE}} €</td></tr>
      <tr><th>Taxe de séjour</th><td>{{TAXE_SEJOUR}} €</td></tr>
      <tr><th><strong>Total séjour</strong></th><td><strong>{{PRIX_TOTAL}} €</strong></td></tr>
    </table>
    <p>Dépôt de garantie : <strong>{{DEPOT_GARANTIE}} €</strong> (restitué sous 7 jours après départ)</p>
  </div>
  
  <div class="section">
    <div class="section-title">V. Signatures</div>
    <p>Fait à {{LIEU_SIGNATURE}}, le {{DATE_SIGNATURE}}</p>
    <div class="signature-box">
      <p><strong>Le Bailleur</strong></p>
    </div>
    <div class="signature-box">
      <p><strong>Le Locataire</strong></p>
    </div>
  </div>
</body>
</html>',
  '{
    "required": [
      "REFERENCE_BAIL",
      "BAILLEUR_NOM_COMPLET",
      "BAILLEUR_ADRESSE",
      "LOCATAIRE_NOM_COMPLET",
      "LOCATAIRE_ADRESSE_PERMANENTE",
      "LOGEMENT_ADRESSE",
      "LOGEMENT_CODE_POSTAL",
      "LOGEMENT_VILLE",
      "LOGEMENT_TYPE",
      "LOGEMENT_SURFACE",
      "CAPACITE_ACCUEIL",
      "DATE_ARRIVEE",
      "HEURE_ARRIVEE",
      "DATE_DEPART",
      "HEURE_DEPART",
      "DUREE_NUITS",
      "PRIX_NUIT",
      "PRIX_TOTAL",
      "DEPOT_GARANTIE",
      "LIEU_SIGNATURE",
      "DATE_SIGNATURE"
    ],
    "optional": [
      "FRAIS_MENAGE",
      "TAXE_SEJOUR"
    ]
  }'::jsonb,
  1,
  true
) ON CONFLICT (id) DO UPDATE SET
  template_content = EXCLUDED.template_content,
  variables = EXCLUDED.variables,
  version = lease_templates.version + 1,
  updated_at = NOW();

-- ============================================
-- 5. INDEX POUR OPTIMISATION
-- ============================================

-- Index déjà créé dans la migration initiale
-- CREATE INDEX IF NOT EXISTS idx_lease_templates_type_bail ON lease_templates(type_bail);
-- CREATE INDEX IF NOT EXISTS idx_lease_templates_is_active ON lease_templates(is_active);

-- ============================================
-- 6. COMMENTAIRES
-- ============================================

COMMENT ON TABLE lease_templates IS 'Templates de bail conformes à la législation française (loi ALUR, décrets 2015-587 et 2015-981)';
COMMENT ON COLUMN lease_templates.template_content IS 'Contenu HTML du template avec variables {{VARIABLE}}';
COMMENT ON COLUMN lease_templates.variables IS 'JSON définissant les variables requises et optionnelles du template';

-- Log de la migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251127_lease_templates_seed terminée avec succès';
  RAISE NOTICE '4 templates de bail insérés : nu, meublé, colocation, saisonnier';
END $$;

