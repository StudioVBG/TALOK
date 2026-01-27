/**
 * Template de bail mixte (habitation + professionnel)
 * Conforme à l'article 2 de la loi n°89-462 du 6 juillet 1989
 *
 * Caractéristiques :
 * - Usage : résidence principale + activité professionnelle libérale
 * - Durée minimum : 3 ans (6 ans si bailleur personne morale)
 * - Dépôt de garantie : 1 mois maximum
 * - Régime de la loi du 6 juillet 1989 (habitation)
 * - L'activité professionnelle ne doit pas être commerciale
 */

export const BAIL_MIXTE_TEMPLATE = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>{{DOCUMENT_TITLE}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
      background: #fff;
      padding: 20mm;
    }
    .page { max-width: 210mm; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #0d9488;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #0d9488;
      margin-bottom: 10px;
    }
    .header .subtitle { font-size: 14pt; }
    .header .reference { font-size: 10pt; color: #666; margin-top: 10px; }
    .legal-notice {
      background: #f0fdfa;
      border: 1px solid #5eead4;
      border-left: 4px solid #14b8a6;
      padding: 15px;
      margin-bottom: 25px;
      font-size: 9pt;
    }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      background: #0d9488;
      color: #fff;
      padding: 8px 15px;
      margin-bottom: 15px;
    }
    .section-content { padding: 0 15px; }
    .article { margin-bottom: 20px; }
    .article-title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 8px;
      color: #0d9488;
    }
    .article-content { text-align: justify; }
    .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 20px; }
    .party-box { border: 1px solid #ccc; padding: 15px; }
    .party-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .party-info { margin-bottom: 5px; }
    .party-label { color: #666; font-size: 9pt; }
    .party-value { font-weight: 500; }
    .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .info-table th, .info-table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    .info-table th { background: #f0fdfa; font-weight: bold; width: 40%; }
    .highlight { background: #f0fdfa; padding: 10px; border-left: 3px solid #14b8a6; margin: 15px 0; }
    .dual-use { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 15px 0; }
    .use-box { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
    .use-box.habitation { background: #eff6ff; border-color: #93c5fd; }
    .use-box.professionnel { background: #f0fdf4; border-color: #86efac; }
    .use-title { font-weight: bold; margin-bottom: 10px; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 40px; }
    .signature-box { border-top: 1px solid #000; padding-top: 10px; min-height: 100px; }
    .signature-label { font-weight: bold; margin-bottom: 5px; }
    .page-break { page-break-after: always; }
    @media print { body { padding: 15mm; } }
  </style>
</head>
<body>
  <div class="page">
    <!-- EN-TÊTE -->
    <div class="header">
      <h1>Bail Mixte</h1>
      <div class="subtitle">Habitation principale et usage professionnel</div>
      <div class="reference">
        Référence : {{REFERENCE_BAIL}}<br>
        Date : {{DATE_SIGNATURE}}
      </div>
    </div>

    <!-- AVIS LÉGAL -->
    <div class="legal-notice">
      <strong>RÉGIME JURIDIQUE</strong> - Le présent bail est soumis à la loi n°89-462 du
      6 juillet 1989 (article 2). Il permet l'exercice d'une activité professionnelle
      libérale au sein du logement constituant la résidence principale du locataire.
      L'activité exercée ne doit pas être de nature commerciale, artisanale ou agricole.
    </div>

    <!-- PARTIES -->
    <div class="section">
      <div class="section-title">I. Désignation des parties</div>
      <div class="section-content">
        <div class="parties-grid">
          <div class="party-box">
            <div class="party-title">LE BAILLEUR</div>
            <div class="party-info">
              <span class="party-label">Nom :</span>
              <span class="party-value">{{BAILLEUR_NOM_COMPLET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Adresse :</span>
              <span class="party-value">{{BAILLEUR_ADRESSE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Qualité :</span>
              <span class="party-value">{{BAILLEUR_QUALITE}}</span>
            </div>
            {{#BAILLEUR_SIRET}}
            <div class="party-info">
              <span class="party-label">SIRET :</span>
              <span class="party-value">{{BAILLEUR_SIRET}}</span>
            </div>
            {{/BAILLEUR_SIRET}}
          </div>
          <div class="party-box">
            <div class="party-title">LE LOCATAIRE</div>
            <div class="party-info">
              <span class="party-label">Nom :</span>
              <span class="party-value">{{LOCATAIRE_NOM_COMPLET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Date de naissance :</span>
              <span class="party-value">{{LOCATAIRE_DATE_NAISSANCE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Lieu de naissance :</span>
              <span class="party-value">{{LOCATAIRE_LIEU_NAISSANCE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Profession :</span>
              <span class="party-value">{{LOCATAIRE_PROFESSION}}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- DÉSIGNATION DU LOGEMENT -->
    <div class="section">
      <div class="section-title">II. Désignation du logement</div>
      <div class="section-content">
        <table class="info-table">
          <tr>
            <th>Adresse</th>
            <td>{{LOGEMENT_ADRESSE}}</td>
          </tr>
          <tr>
            <th>Type de logement</th>
            <td>{{LOGEMENT_TYPE}}</td>
          </tr>
          <tr>
            <th>Surface habitable</th>
            <td>{{LOGEMENT_SURFACE}} m² (loi Boutin)</td>
          </tr>
          <tr>
            <th>Nombre de pièces</th>
            <td>{{LOGEMENT_PIECES}} pièces principales</td>
          </tr>
          <tr>
            <th>Étage</th>
            <td>{{LOGEMENT_ETAGE}}</td>
          </tr>
          <tr>
            <th>Équipements</th>
            <td>{{LOGEMENT_EQUIPEMENTS}}</td>
          </tr>
          <tr>
            <th>Annexes</th>
            <td>{{LOGEMENT_ANNEXES}}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- DESTINATION - USAGE MIXTE -->
    <div class="section">
      <div class="section-title">III. Destination du logement - Usage mixte</div>
      <div class="section-content">
        <p style="margin-bottom: 15px;">
          Le logement est loué pour un <strong>usage mixte</strong> comprenant :
        </p>

        <div class="dual-use">
          <div class="use-box habitation">
            <div class="use-title" style="color: #1d4ed8;">Usage d'habitation</div>
            <p>Le logement constitue la <strong>résidence principale</strong> du locataire.</p>
            <p style="margin-top: 10px; font-size: 10pt; color: #666;">
              Le locataire s'engage à y établir son domicile et à l'occuper au moins
              8 mois par an, sauf obligation professionnelle, raison de santé ou force majeure.
            </p>
          </div>
          <div class="use-box professionnel">
            <div class="use-title" style="color: #15803d;">Usage professionnel</div>
            <div class="highlight" style="margin: 10px 0;">
              <strong>{{ACTIVITE_PROFESSIONNELLE}}</strong>
            </div>
            <p style="font-size: 10pt; color: #666;">
              Cette activité doit être exercée personnellement par le locataire et ne
              peut être de nature commerciale, artisanale ou agricole.
            </p>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Conditions d'exercice de l'activité professionnelle</div>
          <div class="article-content">
            <ul style="margin: 10px 0 10px 20px;">
              <li>L'activité est exercée exclusivement par le locataire</li>
              <li>Aucune marchandise n'est stockée ou vendue dans les locaux</li>
              <li>La réception de clientèle/patients est autorisée</li>
              <li>Une plaque professionnelle peut être apposée (avec accord copropriété)</li>
              <li>L'activité ne doit pas générer de nuisances pour le voisinage</li>
              {{#CONDITIONS_SPECIFIQUES}}
              <li>{{CONDITIONS_SPECIFIQUES}}</li>
              {{/CONDITIONS_SPECIFIQUES}}
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- DURÉE -->
    <div class="section">
      <div class="section-title">IV. Durée du bail</div>
      <div class="section-content">
        <table class="info-table">
          <tr>
            <th>Date de prise d'effet</th>
            <td>{{DATE_DEBUT}}</td>
          </tr>
          <tr>
            <th>Durée</th>
            <td><strong>{{DUREE_BAIL}}</strong></td>
          </tr>
          <tr>
            <th>Date d'expiration</th>
            <td>{{DATE_FIN}}</td>
          </tr>
        </table>

        <div class="article">
          <div class="article-title">Renouvellement et tacite reconduction</div>
          <div class="article-content">
            À défaut de congé, le bail se renouvelle par tacite reconduction pour la
            même durée. Le congé doit être délivré avec un préavis de 6 mois pour le
            bailleur et de 3 mois pour le locataire (1 mois en zone tendue).
          </div>
        </div>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- CONDITIONS FINANCIÈRES -->
    <div class="section">
      <div class="section-title">V. Conditions financières</div>
      <div class="section-content">
        <table class="info-table">
          <tr>
            <th>Loyer mensuel hors charges</th>
            <td><strong>{{LOYER_HC}} €</strong></td>
          </tr>
          <tr>
            <th>Loyer en lettres</th>
            <td>{{LOYER_LETTRES}}</td>
          </tr>
          <tr>
            <th>Charges ({{CHARGES_TYPE}})</th>
            <td>{{CHARGES_MONTANT}} € / mois</td>
          </tr>
          <tr>
            <th>Total mensuel</th>
            <td><strong>{{LOYER_TOTAL}} €</strong></td>
          </tr>
          <tr>
            <th>Dépôt de garantie</th>
            <td>{{DEPOT_GARANTIE}} € (1 mois maximum)</td>
          </tr>
        </table>

        {{#ENCADREMENT_LOYERS}}
        <div class="highlight">
          <strong>Encadrement des loyers applicable</strong>
          <br>
          Loyer de référence majoré : {{LOYER_REFERENCE_MAJORE}} €/m²
          {{#COMPLEMENT_LOYER}}
          <br>Complément de loyer : {{COMPLEMENT_LOYER}} €
          <br>Justification : {{COMPLEMENT_JUSTIFICATION}}
          {{/COMPLEMENT_LOYER}}
        </div>
        {{/ENCADREMENT_LOYERS}}

        <div class="article">
          <div class="article-title">Révision du loyer</div>
          <div class="article-content">
            Le loyer sera révisé chaque année à la date anniversaire du bail selon la
            variation de l'Indice de Référence des Loyers (IRL) publié par l'INSEE.
            <br><br>
            IRL de référence : {{IRL_BASE}} ({{IRL_TRIMESTRE}})
          </div>
        </div>

        <div class="article">
          <div class="article-title">Paiement</div>
          <div class="article-content">
            Le loyer et les charges sont payables d'avance le {{JOUR_PAIEMENT}} de
            chaque mois, par {{MODE_PAIEMENT}}.
          </div>
        </div>
      </div>
    </div>

    <!-- CHARGES -->
    <div class="section">
      <div class="section-title">VI. Charges récupérables</div>
      <div class="section-content">
        <div class="article">
          <div class="article-content">
            Les charges sont {{#CHARGES_FORFAIT}}forfaitaires{{/CHARGES_FORFAIT}}
            {{^CHARGES_FORFAIT}}provisionnelles et font l'objet d'une régularisation
            annuelle{{/CHARGES_FORFAIT}}.
            <br><br>
            Elles comprennent notamment :
            <ul style="margin: 10px 0 10px 20px;">
              <li>Eau froide et eau chaude (si collectif)</li>
              <li>Chauffage (si collectif)</li>
              <li>Entretien des parties communes</li>
              <li>Ascenseur (si applicable)</li>
              <li>Taxe d'enlèvement des ordures ménagères</li>
              {{CHARGES_LISTE}}
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- OBLIGATIONS -->
    <div class="section">
      <div class="section-title">VII. Obligations des parties</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Obligations du bailleur</div>
          <div class="article-content">
            <ul style="margin: 10px 0 10px 20px;">
              <li>Délivrer le logement en bon état d'usage et de réparations</li>
              <li>Assurer la jouissance paisible du logement</li>
              <li>Entretenir les locaux en état de servir à l'usage prévu</li>
              <li>Effectuer les réparations autres que locatives</li>
              <li>Ne pas s'opposer aux aménagements réalisés par le locataire</li>
            </ul>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Obligations du locataire</div>
          <div class="article-content">
            <ul style="margin: 10px 0 10px 20px;">
              <li>Payer le loyer et les charges aux termes convenus</li>
              <li>User paisiblement des locaux suivant leur destination</li>
              <li>Répondre des dégradations survenues pendant la location</li>
              <li>Prendre à sa charge l'entretien courant et les réparations locatives</li>
              <li>S'assurer contre les risques locatifs</li>
              <li>Ne pas transformer les locaux sans accord écrit</li>
              <li>Permettre l'accès pour travaux et visites</li>
              <li>Exercer l'activité professionnelle dans le respect du voisinage</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- DIAGNOSTICS -->
    <div class="section">
      <div class="section-title">VIII. Diagnostics techniques</div>
      <div class="section-content">
        <p>Les diagnostics suivants sont annexés au présent bail :</p>
        <ul style="margin: 10px 0 10px 20px;">
          <li>Diagnostic de Performance Énergétique (DPE) : Classe {{DPE_ENERGIE}} / GES {{DPE_GES}}</li>
          <li>Constat de Risque d'Exposition au Plomb (CREP) - si applicable</li>
          <li>État des installations de gaz - si applicable</li>
          <li>État des installations électriques - si applicable</li>
          <li>État des Risques et Pollutions (ERP)</li>
          <li>Diagnostic bruit (zones aéroportuaires) - si applicable</li>
        </ul>
      </div>
    </div>

    <!-- CLAUSES PARTICULIÈRES -->
    <div class="section">
      <div class="section-title">IX. Clauses particulières</div>
      <div class="section-content">
        {{#ANIMAUX_AUTORISES}}
        <div class="article">
          <div class="article-title">Animaux</div>
          <div class="article-content">
            Le locataire est autorisé à détenir des animaux domestiques, sous réserve
            qu'ils ne causent pas de troubles de voisinage.
          </div>
        </div>
        {{/ANIMAUX_AUTORISES}}

        {{#PLAQUE_PROFESSIONNELLE}}
        <div class="article">
          <div class="article-title">Plaque professionnelle</div>
          <div class="article-content">
            Le locataire est autorisé à apposer une plaque professionnelle aux dimensions
            réglementaires à l'entrée de l'immeuble et/ou sur la porte du logement,
            sous réserve de l'accord de la copropriété.
          </div>
        </div>
        {{/PLAQUE_PROFESSIONNELLE}}

        {{CLAUSES_SUPPLEMENTAIRES}}
      </div>
    </div>

    <!-- ANNEXES -->
    <div class="section">
      <div class="section-title">X. Annexes</div>
      <div class="section-content">
        <ul style="margin: 10px 0 10px 20px;">
          <li>État des lieux d'entrée</li>
          <li>Dossier de diagnostics techniques</li>
          <li>Notice d'information (droits et obligations)</li>
          <li>Extrait du règlement de copropriété (parties privatives)</li>
          {{#ANNEXES_LISTE}}
          <li>{{ANNEXES_LISTE}}</li>
          {{/ANNEXES_LISTE}}
        </ul>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="section">
      <div class="section-title">Signatures</div>
      <div class="section-content">
        <p style="margin-bottom: 20px;">
          Fait en deux exemplaires originaux à {{LIEU_SIGNATURE}}, le {{DATE_SIGNATURE}}.
        </p>
        <p style="margin-bottom: 20px; font-style: italic; font-size: 10pt;">
          Les parties reconnaissent avoir reçu chacune un exemplaire du présent bail
          ainsi que de ses annexes.
        </p>

        <div class="signature-grid">
          <div class="signature-box">
            <div class="signature-label">Le Bailleur</div>
            <p style="font-size: 9pt; color: #666;">
              Signature précédée de "Lu et approuvé"
            </p>
            {{SIGNATURE_BAILLEUR}}
          </div>
          <div class="signature-box">
            <div class="signature-label">Le Locataire</div>
            <p style="font-size: 9pt; color: #666;">
              Signature précédée de "Lu et approuvé"
            </p>
            {{SIGNATURE_LOCATAIRE}}
          </div>
        </div>
      </div>
    </div>

  </div>
</body>
</html>
`;

export const BAIL_MIXTE_VARIABLES = [
  "DOCUMENT_TITLE",
  "REFERENCE_BAIL",
  "DATE_SIGNATURE",
  "LIEU_SIGNATURE",
  "BAILLEUR_NOM_COMPLET",
  "BAILLEUR_ADRESSE",
  "BAILLEUR_QUALITE",
  "BAILLEUR_SIRET",
  "LOCATAIRE_NOM_COMPLET",
  "LOCATAIRE_DATE_NAISSANCE",
  "LOCATAIRE_LIEU_NAISSANCE",
  "LOCATAIRE_PROFESSION",
  "LOGEMENT_ADRESSE",
  "LOGEMENT_TYPE",
  "LOGEMENT_SURFACE",
  "LOGEMENT_PIECES",
  "LOGEMENT_ETAGE",
  "LOGEMENT_EQUIPEMENTS",
  "LOGEMENT_ANNEXES",
  "ACTIVITE_PROFESSIONNELLE",
  "CONDITIONS_SPECIFIQUES",
  "DATE_DEBUT",
  "DATE_FIN",
  "DUREE_BAIL",
  "LOYER_HC",
  "LOYER_LETTRES",
  "CHARGES_TYPE",
  "CHARGES_MONTANT",
  "LOYER_TOTAL",
  "DEPOT_GARANTIE",
  "ENCADREMENT_LOYERS",
  "LOYER_REFERENCE_MAJORE",
  "COMPLEMENT_LOYER",
  "COMPLEMENT_JUSTIFICATION",
  "IRL_BASE",
  "IRL_TRIMESTRE",
  "JOUR_PAIEMENT",
  "MODE_PAIEMENT",
  "CHARGES_FORFAIT",
  "CHARGES_LISTE",
  "DPE_ENERGIE",
  "DPE_GES",
  "ANIMAUX_AUTORISES",
  "PLAQUE_PROFESSIONNELLE",
  "CLAUSES_SUPPLEMENTAIRES",
  "ANNEXES_LISTE",
  "SIGNATURE_BAILLEUR",
  "SIGNATURE_LOCATAIRE",
];
