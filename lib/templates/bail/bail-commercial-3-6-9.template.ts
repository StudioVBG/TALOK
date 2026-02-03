/**
 * Template de bail commercial 3/6/9
 * Conforme aux articles L.145-1 et suivants du Code de commerce
 *
 * Caractéristiques :
 * - Durée minimum : 9 ans
 * - Résiliation triennale (tous les 3 ans) par le preneur
 * - Droit au renouvellement pour le locataire
 * - Plafonnement du loyer lors du renouvellement (sauf exceptions)
 * - Dépôt de garantie : libre (usage 3 mois)
 */

export const BAIL_COMMERCIAL_3_6_9_TEMPLATE = `
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
      border-bottom: 2px solid #1a365d;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #1a365d;
      margin-bottom: 10px;
    }
    .header .subtitle { font-size: 14pt; }
    .header .reference { font-size: 10pt; color: #666; margin-top: 10px; }
    .legal-notice {
      background: #ebf8ff;
      border: 1px solid #90cdf4;
      border-left: 4px solid #3182ce;
      padding: 15px;
      margin-bottom: 25px;
      font-size: 9pt;
    }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      background: #1a365d;
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
      color: #1a365d;
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
    .info-table th { background: #f7fafc; font-weight: bold; width: 40%; }
    .highlight { background: #fffbeb; padding: 10px; border-left: 3px solid #f6ad55; margin: 15px 0; }
    .warning { background: #fff5f5; border-left: 3px solid #fc8181; padding: 10px; margin: 15px 0; }
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
      <h1>Bail Commercial</h1>
      <div class="subtitle">Statut des baux commerciaux (3/6/9)</div>
      <div class="reference">
        Référence : {{REFERENCE_BAIL}}<br>
        Date : {{DATE_SIGNATURE}}
      </div>
    </div>

    <!-- AVIS LÉGAL -->
    <div class="legal-notice">
      <strong>IMPORTANT</strong> - Ce contrat est soumis aux dispositions des articles L.145-1 à L.145-60
      du Code de commerce relatifs aux baux commerciaux. Le preneur bénéficie du droit au renouvellement
      et de la propriété commerciale.
    </div>

    <!-- PARTIES -->
    <div class="section">
      <div class="section-title">I. Désignation des parties</div>
      <div class="section-content">
        <div class="parties-grid">
          <div class="party-box">
            <div class="party-title">LE BAILLEUR</div>
            <div class="party-info">
              <span class="party-label">Nom / Raison sociale :</span>
              <span class="party-value">{{BAILLEUR_NOM_COMPLET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Adresse :</span>
              <span class="party-value">{{BAILLEUR_ADRESSE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">SIRET :</span>
              <span class="party-value">{{BAILLEUR_SIRET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Représenté par :</span>
              <span class="party-value">{{BAILLEUR_REPRESENTANT}}</span>
            </div>
          </div>
          <div class="party-box">
            <div class="party-title">LE PRENEUR</div>
            <div class="party-info">
              <span class="party-label">Raison sociale :</span>
              <span class="party-value">{{PRENEUR_RAISON_SOCIALE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Forme juridique :</span>
              <span class="party-value">{{PRENEUR_FORME_JURIDIQUE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">SIRET :</span>
              <span class="party-value">{{PRENEUR_SIRET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">RCS :</span>
              <span class="party-value">{{PRENEUR_RCS}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Représenté par :</span>
              <span class="party-value">{{PRENEUR_REPRESENTANT}}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- DÉSIGNATION DES LOCAUX -->
    <div class="section">
      <div class="section-title">II. Désignation des locaux</div>
      <div class="section-content">
        <table class="info-table">
          <tr>
            <th>Adresse complète</th>
            <td>{{LOCAL_ADRESSE}}</td>
          </tr>
          <tr>
            <th>Nature des locaux</th>
            <td>{{LOCAL_NATURE}}</td>
          </tr>
          <tr>
            <th>Surface totale</th>
            <td>{{LOCAL_SURFACE}} m²</td>
          </tr>
          <tr>
            <th>Consistance</th>
            <td>{{LOCAL_CONSISTANCE}}</td>
          </tr>
          <tr>
            <th>Accessoires et dépendances</th>
            <td>{{LOCAL_DEPENDANCES}}</td>
          </tr>
          <tr>
            <th>Régime juridique</th>
            <td>{{LOCAL_REGIME}} (lot n°{{LOCAL_LOT}})</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- DESTINATION -->
    <div class="section">
      <div class="section-title">III. Destination des locaux</div>
      <div class="section-content">
        <div class="article">
          <div class="article-content">
            Les locaux sont loués exclusivement pour l'exercice de l'activité suivante :
            <div class="highlight">
              <strong>{{ACTIVITE_PRINCIPALE}}</strong>
              {{#ACTIVITES_CONNEXES}}
              <br>Activités connexes autorisées : {{ACTIVITES_CONNEXES}}
              {{/ACTIVITES_CONNEXES}}
            </div>
            <p style="margin-top: 10px;">
              Le preneur ne pourra exercer dans les lieux aucune autre activité sans l'accord
              écrit et préalable du bailleur (article L.145-47 du Code de commerce).
            </p>
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
            <td><strong>9 ans</strong></td>
          </tr>
          <tr>
            <th>Date d'expiration</th>
            <td>{{DATE_FIN}}</td>
          </tr>
        </table>

        <div class="article">
          <div class="article-title">Article 4.1 - Faculté de résiliation triennale</div>
          <div class="article-content">
            Conformément à l'article L.145-4 du Code de commerce, le preneur aura la faculté
            de donner congé à l'expiration de chaque période triennale, soit aux dates suivantes :
            <ul style="margin: 10px 0 10px 20px;">
              <li>{{DATE_TRIENNALE_1}}</li>
              <li>{{DATE_TRIENNALE_2}}</li>
            </ul>
            Le congé devra être signifié par acte extrajudiciaire au moins 6 mois à l'avance.
          </div>
        </div>

        <div class="warning">
          <strong>ATTENTION</strong> - Le bailleur ne peut pas résilier le bail en cours sauf cas
          prévus par la loi (inexécution des obligations, reconstruction, etc.).
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
            <th>Loyer annuel HT</th>
            <td><strong>{{LOYER_ANNUEL_HT}} €</strong></td>
          </tr>
          <tr>
            <th>Loyer trimestriel HT</th>
            <td>{{LOYER_TRIMESTRIEL_HT}} €</td>
          </tr>
          <tr>
            <th>TVA ({{TVA_TAUX}}%)</th>
            <td>{{TVA_MONTANT}} €</td>
          </tr>
          <tr>
            <th>Loyer trimestriel TTC</th>
            <td><strong>{{LOYER_TRIMESTRIEL_TTC}} €</strong></td>
          </tr>
          <tr>
            <th>Charges et taxes récupérables</th>
            <td>{{CHARGES_PROVISION}} € / trimestre (provision)</td>
          </tr>
          <tr>
            <th>Dépôt de garantie</th>
            <td>{{DEPOT_GARANTIE}} € ({{DEPOT_MOIS}} trimestres)</td>
          </tr>
        </table>

        <div class="article">
          <div class="article-title">Article 5.1 - Indexation du loyer</div>
          <div class="article-content">
            Le loyer sera révisé automatiquement chaque année à la date anniversaire du bail,
            par application de l'indice <strong>{{INDICE_REFERENCE}}</strong>
            ({{INDICE_NOM}}) publié par l'INSEE.
            <br><br>
            Indice de base : {{INDICE_BASE}} ({{INDICE_TRIMESTRE_BASE}})
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 5.2 - Modalités de paiement</div>
          <div class="article-content">
            Le loyer et les charges sont payables d'avance le premier jour de chaque trimestre
            civil, par {{MODE_PAIEMENT}}.
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 5.3 - Option TVA</div>
          <div class="article-content">
            {{#TVA_OPTION}}
            Le bailleur a opté pour l'assujettissement à la TVA conformément à l'article 260-2°
            du Code général des impôts. Le loyer et les charges sont donc majorés de la TVA au
            taux en vigueur.
            {{/TVA_OPTION}}
            {{^TVA_OPTION}}
            Le bailleur n'a pas opté pour l'assujettissement à la TVA. Le loyer est donc
            exonéré de TVA.
            {{/TVA_OPTION}}
          </div>
        </div>
      </div>
    </div>

    <!-- CHARGES ET RÉPARTITION -->
    <div class="section">
      <div class="section-title">VI. Charges, impôts et taxes</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 6.1 - Charges récupérables sur le preneur</div>
          <div class="article-content">
            Conformément à l'article L.145-40-2 du Code de commerce, les charges, impôts, taxes
            et redevances suivants sont récupérables sur le preneur :
            <ul style="margin: 10px 0 10px 20px;">
              <li>Taxe foncière (quote-part locaux loués)</li>
              <li>Taxe sur les bureaux (le cas échéant)</li>
              <li>Charges de copropriété (hors travaux article 606)</li>
              <li>Entretien courant des parties communes</li>
              <li>Eau, électricité, chauffage des parties communes</li>
              <li>{{CHARGES_SPECIFIQUES}}</li>
            </ul>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 6.2 - Charges non récupérables</div>
          <div class="article-content">
            Restent à la charge exclusive du bailleur :
            <ul style="margin: 10px 0 10px 20px;">
              <li>Gros travaux (article 606 du Code civil)</li>
              <li>Honoraires de gestion locative</li>
              <li>Travaux de mise en conformité (hors faute du preneur)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- RENOUVELLEMENT ET CESSION -->
    <div class="section">
      <div class="section-title">VII. Renouvellement et cession</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 7.1 - Droit au renouvellement</div>
          <div class="article-content">
            Le preneur bénéficie d'un droit au renouvellement de son bail conformément aux
            articles L.145-8 et suivants du Code de commerce. Le refus de renouvellement
            par le bailleur ouvre droit à une indemnité d'éviction.
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 7.2 - Cession du bail</div>
          <div class="article-content">
            {{#CESSION_LIBRE}}
            Le preneur pourra céder son droit au bail à l'acquéreur de son fonds de commerce,
            sans autorisation préalable du bailleur.
            {{/CESSION_LIBRE}}
            {{^CESSION_LIBRE}}
            Toute cession du droit au bail est soumise à l'autorisation préalable et écrite
            du bailleur, sauf cession au profit de l'acquéreur du fonds de commerce.
            {{/CESSION_LIBRE}}
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 7.3 - Sous-location</div>
          <div class="article-content">
            {{#SOUS_LOCATION_AUTORISEE}}
            La sous-location totale ou partielle est autorisée, sous réserve d'informer le
            bailleur par lettre recommandée avec AR.
            {{/SOUS_LOCATION_AUTORISEE}}
            {{^SOUS_LOCATION_AUTORISEE}}
            La sous-location est interdite, sauf accord exprès et écrit du bailleur.
            {{/SOUS_LOCATION_AUTORISEE}}
          </div>
        </div>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- OBLIGATIONS -->
    <div class="section">
      <div class="section-title">VIII. Obligations des parties</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 8.1 - Obligations du bailleur</div>
          <div class="article-content">
            Le bailleur s'oblige à :
            <ul style="margin: 10px 0 10px 20px;">
              <li>Délivrer les locaux en bon état</li>
              <li>Assurer la jouissance paisible des lieux</li>
              <li>Entretenir les locaux en état de servir à leur destination</li>
              <li>Effectuer les grosses réparations (article 606 du Code civil)</li>
              <li>Garantir contre les vices cachés</li>
            </ul>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 8.2 - Obligations du preneur</div>
          <div class="article-content">
            Le preneur s'oblige à :
            <ul style="margin: 10px 0 10px 20px;">
              <li>Payer le loyer et les charges aux termes convenus</li>
              <li>User des locaux conformément à leur destination</li>
              <li>Garnir les locaux de mobilier suffisant</li>
              <li>Effectuer les réparations locatives et d'entretien courant</li>
              <li>Assurer les locaux contre l'incendie et les risques locatifs</li>
              <li>Respecter le règlement de copropriété</li>
              <li>Laisser visiter les locaux pour vente ou relocation</li>
              <li>Restituer les locaux en bon état à l'expiration du bail</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- TRAVAUX -->
    <div class="section">
      <div class="section-title">IX. Travaux et aménagements</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 9.1 - Travaux d'aménagement</div>
          <div class="article-content">
            Le preneur pourra effectuer tous travaux d'aménagement et d'embellissement
            nécessaires à son activité, sous réserve de l'accord préalable écrit du bailleur
            pour les travaux affectant le gros œuvre ou modifiant la structure des locaux.
            <br><br>
            Les aménagements réalisés resteront acquis au bailleur en fin de bail sans
            indemnité, sauf stipulation contraire.
          </div>
        </div>
      </div>
    </div>

    <!-- CLAUSES PARTICULIÈRES -->
    <div class="section">
      <div class="section-title">X. Clauses particulières</div>
      <div class="section-content">
        {{CLAUSES_PARTICULIERES}}
      </div>
    </div>

    <!-- ANNEXES -->
    <div class="section">
      <div class="section-title">XI. Annexes</div>
      <div class="section-content">
        <p>Sont annexés au présent bail :</p>
        <ul style="margin: 10px 0 10px 20px;">
          <li>État des lieux d'entrée</li>
          <li>Diagnostics techniques obligatoires (DPE, amiante, etc.)</li>
          <li>Règlement de copropriété (extrait)</li>
          <li>État des travaux des 3 dernières années et à venir</li>
          {{#ANNEXES_SUPPLEMENTAIRES}}
          <li>{{ANNEXES_SUPPLEMENTAIRES}}</li>
          {{/ANNEXES_SUPPLEMENTAIRES}}
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
        <p style="margin-bottom: 30px; font-style: italic;">
          Les parties déclarent avoir pris connaissance de l'ensemble des clauses du présent
          bail et en accepter toutes les conditions.
        </p>

        <div class="signature-grid">
          <div class="signature-box">
            <div class="signature-label">Le Bailleur</div>
            <p style="font-size: 9pt; color: #666;">
              (Signature précédée de la mention "Lu et approuvé")
            </p>
            {{SIGNATURE_BAILLEUR}}
          </div>
          <div class="signature-box">
            <div class="signature-label">Le Preneur</div>
            <p style="font-size: 9pt; color: #666;">
              (Signature précédée de la mention "Lu et approuvé")
            </p>
            {{SIGNATURE_PRENEUR}}
          </div>
        </div>
      </div>
    </div>

  </div>
</body>
</html>
`;

export const BAIL_COMMERCIAL_3_6_9_VARIABLES = [
  // Document
  "DOCUMENT_TITLE",
  "REFERENCE_BAIL",
  "DATE_SIGNATURE",
  "LIEU_SIGNATURE",

  // Bailleur
  "BAILLEUR_NOM_COMPLET",
  "BAILLEUR_ADRESSE",
  "BAILLEUR_SIRET",
  "BAILLEUR_REPRESENTANT",

  // Preneur
  "PRENEUR_RAISON_SOCIALE",
  "PRENEUR_FORME_JURIDIQUE",
  "PRENEUR_SIRET",
  "PRENEUR_RCS",
  "PRENEUR_REPRESENTANT",

  // Locaux
  "LOCAL_ADRESSE",
  "LOCAL_NATURE",
  "LOCAL_SURFACE",
  "LOCAL_CONSISTANCE",
  "LOCAL_DEPENDANCES",
  "LOCAL_REGIME",
  "LOCAL_LOT",

  // Activité
  "ACTIVITE_PRINCIPALE",
  "ACTIVITES_CONNEXES",

  // Durée
  "DATE_DEBUT",
  "DATE_FIN",
  "DATE_TRIENNALE_1",
  "DATE_TRIENNALE_2",

  // Financier
  "LOYER_ANNUEL_HT",
  "LOYER_TRIMESTRIEL_HT",
  "TVA_TAUX",
  "TVA_MONTANT",
  "LOYER_TRIMESTRIEL_TTC",
  "CHARGES_PROVISION",
  "DEPOT_GARANTIE",
  "DEPOT_MOIS",
  "MODE_PAIEMENT",

  // Indexation
  "INDICE_REFERENCE",
  "INDICE_NOM",
  "INDICE_BASE",
  "INDICE_TRIMESTRE_BASE",

  // Options
  "TVA_OPTION",
  "CESSION_LIBRE",
  "SOUS_LOCATION_AUTORISEE",

  // Charges
  "CHARGES_SPECIFIQUES",

  // Clauses
  "CLAUSES_PARTICULIERES",
  "ANNEXES_SUPPLEMENTAIRES",

  // Signatures
  "SIGNATURE_BAILLEUR",
  "SIGNATURE_PRENEUR",
];
