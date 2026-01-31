/**
 * Template de bail commercial dérogatoire (bail précaire)
 * Conforme à l'article L.145-5 du Code de commerce
 *
 * Caractéristiques :
 * - Durée maximum : 3 ans (36 mois)
 * - Pas de droit au renouvellement
 * - Pas d'indemnité d'éviction
 * - Dépôt de garantie : libre (usage 3 mois)
 * - Dérogation au statut des baux commerciaux
 */

export const BAIL_COMMERCIAL_DEROGATOIRE_TEMPLATE = `
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
      border-bottom: 2px solid #744210;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #744210;
      margin-bottom: 10px;
    }
    .header .subtitle { font-size: 14pt; }
    .header .reference { font-size: 10pt; color: #666; margin-top: 10px; }
    .warning-notice {
      background: #fffbeb;
      border: 2px solid #f6ad55;
      border-left: 5px solid #dd6b20;
      padding: 15px;
      margin-bottom: 25px;
      font-size: 10pt;
    }
    .warning-notice strong { color: #c05621; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      background: #744210;
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
      color: #744210;
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
    .info-table th { background: #faf5ff; font-weight: bold; width: 40%; }
    .highlight { background: #fffbeb; padding: 10px; border-left: 3px solid #f6ad55; margin: 15px 0; }
    .alert { background: #fff5f5; border: 1px solid #fc8181; padding: 15px; margin: 15px 0; }
    .alert strong { color: #c53030; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 40px; }
    .signature-box { border-top: 1px solid #000; padding-top: 10px; min-height: 100px; }
    .signature-label { font-weight: bold; margin-bottom: 5px; }
    .mention-manuscrite { border: 1px dashed #999; padding: 15px; margin: 15px 0; background: #fafafa; }
    .page-break { page-break-after: always; }
    @media print { body { padding: 15mm; } }
  </style>
</head>
<body>
  <div class="page">
    <!-- EN-TÊTE -->
    <div class="header">
      <h1>Bail Commercial Dérogatoire</h1>
      <div class="subtitle">Convention d'occupation précaire</div>
      <div class="reference">
        Référence : {{REFERENCE_BAIL}}<br>
        Date : {{DATE_SIGNATURE}}
      </div>
    </div>

    <!-- AVERTISSEMENT IMPORTANT -->
    <div class="warning-notice">
      <strong>AVERTISSEMENT - BAIL DÉROGATOIRE AU STATUT DES BAUX COMMERCIAUX</strong>
      <br><br>
      En application de l'article L.145-5 du Code de commerce, le présent bail déroge
      expressément au statut des baux commerciaux. En conséquence :
      <ul style="margin: 10px 0 0 20px;">
        <li><strong>La durée totale ne peut excéder 3 ans</strong></li>
        <li><strong>Le preneur ne bénéficie d'aucun droit au renouvellement</strong></li>
        <li><strong>Aucune indemnité d'éviction n'est due en fin de bail</strong></li>
        <li><strong>Le maintien dans les lieux au-delà du terme entraîne l'application
            du statut des baux commerciaux</strong></li>
      </ul>
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
          </div>
          <div class="party-box">
            <div class="party-title">LE PRENEUR</div>
            <div class="party-info">
              <span class="party-label">Raison sociale :</span>
              <span class="party-value">{{PRENEUR_RAISON_SOCIALE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">SIRET :</span>
              <span class="party-value">{{PRENEUR_SIRET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Représenté par :</span>
              <span class="party-value">{{PRENEUR_REPRESENTANT}}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- LOCAUX -->
    <div class="section">
      <div class="section-title">II. Désignation des locaux</div>
      <div class="section-content">
        <table class="info-table">
          <tr>
            <th>Adresse</th>
            <td>{{LOCAL_ADRESSE}}</td>
          </tr>
          <tr>
            <th>Nature</th>
            <td>{{LOCAL_NATURE}}</td>
          </tr>
          <tr>
            <th>Surface</th>
            <td>{{LOCAL_SURFACE}} m²</td>
          </tr>
          <tr>
            <th>Description</th>
            <td>{{LOCAL_DESCRIPTION}}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- DESTINATION -->
    <div class="section">
      <div class="section-title">III. Destination</div>
      <div class="section-content">
        <div class="article">
          <div class="article-content">
            Les locaux sont loués pour l'exercice de l'activité suivante :
            <div class="highlight">
              <strong>{{ACTIVITE_AUTORISEE}}</strong>
            </div>
            Le preneur ne pourra exercer aucune autre activité sans accord écrit du bailleur.
          </div>
        </div>
      </div>
    </div>

    <!-- DURÉE - SECTION CRITIQUE -->
    <div class="section">
      <div class="section-title">IV. Durée du bail - Article essentiel</div>
      <div class="section-content">
        <table class="info-table">
          <tr>
            <th>Date de prise d'effet</th>
            <td>{{DATE_DEBUT}}</td>
          </tr>
          <tr>
            <th>Durée</th>
            <td><strong>{{DUREE_MOIS}} mois</strong></td>
          </tr>
          <tr>
            <th>Date d'expiration impérative</th>
            <td><strong>{{DATE_FIN}}</strong></td>
          </tr>
        </table>

        <div class="alert">
          <strong>CLAUSE ESSENTIELLE ET DÉTERMINANTE</strong>
          <br><br>
          Le présent bail est conclu pour une durée ferme de {{DUREE_MOIS}} mois prenant
          fin de plein droit le {{DATE_FIN}} à minuit, sans qu'il soit besoin de congé
          ou de mise en demeure.
          <br><br>
          Les parties reconnaissent expressément que cette durée limitée constitue une
          condition essentielle et déterminante de leur consentement, sans laquelle
          le présent bail n'aurait pas été conclu.
          <br><br>
          <strong>À l'expiration du bail, le preneur devra impérativement libérer les
          lieux et remettre les clés au bailleur.</strong> Tout maintien dans les lieux
          au-delà du terme entraînera l'application de plein droit du statut des baux
          commerciaux (article L.145-5 alinéa 2 du Code de commerce).
        </div>

        <div class="article">
          <div class="article-title">Résiliation anticipée</div>
          <div class="article-content">
            {{#RESILIATION_ANTICIPEE}}
            Le preneur pourra résilier le bail de manière anticipée sous réserve de
            respecter un préavis de {{PREAVIS_MOIS}} mois.
            {{/RESILIATION_ANTICIPEE}}
            {{^RESILIATION_ANTICIPEE}}
            Le bail est conclu pour une durée ferme. Aucune résiliation anticipée
            n'est possible sauf accord exprès des deux parties.
            {{/RESILIATION_ANTICIPEE}}
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
            <th>Loyer mensuel HT</th>
            <td><strong>{{LOYER_MENSUEL_HT}} €</strong></td>
          </tr>
          {{#TVA_APPLICABLE}}
          <tr>
            <th>TVA ({{TVA_TAUX}}%)</th>
            <td>{{TVA_MONTANT}} €</td>
          </tr>
          <tr>
            <th>Loyer mensuel TTC</th>
            <td><strong>{{LOYER_MENSUEL_TTC}} €</strong></td>
          </tr>
          {{/TVA_APPLICABLE}}
          <tr>
            <th>Charges</th>
            <td>{{CHARGES_MONTANT}} € / mois</td>
          </tr>
          <tr>
            <th>Dépôt de garantie</th>
            <td>{{DEPOT_GARANTIE}} €</td>
          </tr>
        </table>

        <div class="article">
          <div class="article-title">Paiement</div>
          <div class="article-content">
            Le loyer et les charges sont payables d'avance le {{JOUR_PAIEMENT}} de
            chaque mois par {{MODE_PAIEMENT}}.
          </div>
        </div>

        {{#INDEXATION}}
        <div class="article">
          <div class="article-title">Révision du loyer</div>
          <div class="article-content">
            Le loyer sera révisé annuellement selon l'indice {{INDICE_REFERENCE}}.
            Indice de base : {{INDICE_BASE}}.
          </div>
        </div>
        {{/INDEXATION}}
      </div>
    </div>

    <!-- OBLIGATIONS -->
    <div class="section">
      <div class="section-title">VI. Obligations des parties</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Obligations du preneur</div>
          <div class="article-content">
            <ul style="margin: 10px 0 10px 20px;">
              <li>Payer le loyer et les charges aux termes convenus</li>
              <li>User des locaux conformément à leur destination</li>
              <li>Entretenir les locaux et effectuer les réparations locatives</li>
              <li>S'assurer contre les risques locatifs</li>
              <li>Ne pas céder le bail ni sous-louer sans autorisation</li>
              <li>Respecter le règlement de l'immeuble</li>
              <li><strong>Libérer les locaux au plus tard le {{DATE_FIN}}</strong></li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- CESSION ET SOUS-LOCATION -->
    <div class="section">
      <div class="section-title">VII. Cession et sous-location</div>
      <div class="section-content">
        <div class="article">
          <div class="article-content">
            Toute cession du bail ou sous-location, totale ou partielle, est
            <strong>strictement interdite</strong> sans l'accord préalable et écrit du bailleur.
          </div>
        </div>
      </div>
    </div>

    <!-- CLAUSE MANUSCRITE OBLIGATOIRE -->
    <div class="section">
      <div class="section-title">VIII. Mentions manuscrites obligatoires</div>
      <div class="section-content">
        <p style="margin-bottom: 15px;">
          Le preneur doit recopier de sa main la mention suivante :
        </p>

        <div class="mention-manuscrite">
          <p style="font-style: italic; margin-bottom: 10px;">
            "Je soussigné(e), {{PRENEUR_REPRESENTANT}}, agissant pour le compte de
            {{PRENEUR_RAISON_SOCIALE}}, reconnais avoir pris connaissance des dispositions
            de l'article L.145-5 du Code de commerce et accepte expressément que le présent
            bail soit conclu en dérogation au statut des baux commerciaux. Je reconnais
            que ce bail ne me confère aucun droit au renouvellement ni à indemnité d'éviction
            et que je devrai libérer les locaux au plus tard le {{DATE_FIN}}."
          </p>
          <div style="min-height: 80px; border-bottom: 1px dotted #999; margin-top: 20px;">
            <span style="font-size: 9pt; color: #666;">Mention manuscrite du preneur :</span>
          </div>
        </div>
      </div>
    </div>

    <!-- SIGNATURES -->
    <div class="section">
      <div class="section-title">Signatures</div>
      <div class="section-content">
        <p style="margin-bottom: 20px;">
          Fait en deux exemplaires originaux à {{LIEU_SIGNATURE}}, le {{DATE_SIGNATURE}}.
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
            <div class="signature-label">Le Preneur</div>
            <p style="font-size: 9pt; color: #666;">
              Signature précédée de "Lu et approuvé"
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

export const BAIL_COMMERCIAL_DEROGATOIRE_VARIABLES = [
  "DOCUMENT_TITLE",
  "REFERENCE_BAIL",
  "DATE_SIGNATURE",
  "LIEU_SIGNATURE",
  "BAILLEUR_NOM_COMPLET",
  "BAILLEUR_ADRESSE",
  "BAILLEUR_SIRET",
  "PRENEUR_RAISON_SOCIALE",
  "PRENEUR_SIRET",
  "PRENEUR_REPRESENTANT",
  "LOCAL_ADRESSE",
  "LOCAL_NATURE",
  "LOCAL_SURFACE",
  "LOCAL_DESCRIPTION",
  "ACTIVITE_AUTORISEE",
  "DATE_DEBUT",
  "DATE_FIN",
  "DUREE_MOIS",
  "RESILIATION_ANTICIPEE",
  "PREAVIS_MOIS",
  "LOYER_MENSUEL_HT",
  "TVA_APPLICABLE",
  "TVA_TAUX",
  "TVA_MONTANT",
  "LOYER_MENSUEL_TTC",
  "CHARGES_MONTANT",
  "DEPOT_GARANTIE",
  "JOUR_PAIEMENT",
  "MODE_PAIEMENT",
  "INDEXATION",
  "INDICE_REFERENCE",
  "INDICE_BASE",
  "SIGNATURE_BAILLEUR",
  "SIGNATURE_PRENEUR",
];
