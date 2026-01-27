/**
 * Template de bail professionnel
 * Conforme à l'article 57 A de la loi n°86-1290 du 23 décembre 1986
 *
 * Caractéristiques :
 * - Durée minimum : 6 ans
 * - Résiliation par le preneur : préavis de 6 mois
 * - Pas de droit au renouvellement (mais tacite reconduction)
 * - Dépôt de garantie : libre (usage 2 mois)
 * - Réservé aux professions libérales et activités non commerciales
 */

export const BAIL_PROFESSIONNEL_TEMPLATE = `
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
      border-bottom: 2px solid #2d3748;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #2d3748;
      margin-bottom: 10px;
    }
    .header .subtitle { font-size: 14pt; }
    .header .reference { font-size: 10pt; color: #666; margin-top: 10px; }
    .legal-notice {
      background: #e6fffa;
      border: 1px solid #81e6d9;
      border-left: 4px solid #38b2ac;
      padding: 15px;
      margin-bottom: 25px;
      font-size: 9pt;
    }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      background: #2d3748;
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
      color: #2d3748;
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
    .highlight { background: #e6fffa; padding: 10px; border-left: 3px solid #38b2ac; margin: 15px 0; }
    .info { background: #ebf8ff; border-left: 3px solid #4299e1; padding: 10px; margin: 15px 0; }
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
      <h1>Bail Professionnel</h1>
      <div class="subtitle">Activités libérales et non commerciales</div>
      <div class="reference">
        Référence : {{REFERENCE_BAIL}}<br>
        Date : {{DATE_SIGNATURE}}
      </div>
    </div>

    <!-- AVIS LÉGAL -->
    <div class="legal-notice">
      <strong>RÉGIME JURIDIQUE</strong> - Ce contrat est soumis à l'article 57 A de la loi n°86-1290
      du 23 décembre 1986. Il est exclusivement réservé aux activités libérales et professions
      non commerciales. Il ne confère pas de droit au renouvellement mais fait l'objet d'une
      tacite reconduction.
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
            {{#BAILLEUR_SIRET}}
            <div class="party-info">
              <span class="party-label">SIRET :</span>
              <span class="party-value">{{BAILLEUR_SIRET}}</span>
            </div>
            {{/BAILLEUR_SIRET}}
          </div>
          <div class="party-box">
            <div class="party-title">LE PRENEUR</div>
            <div class="party-info">
              <span class="party-label">Nom :</span>
              <span class="party-value">{{PRENEUR_NOM_COMPLET}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">Profession :</span>
              <span class="party-value">{{PRENEUR_PROFESSION}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">N° d'ordre / inscription :</span>
              <span class="party-value">{{PRENEUR_NUMERO_ORDRE}}</span>
            </div>
            <div class="party-info">
              <span class="party-label">SIRET :</span>
              <span class="party-value">{{PRENEUR_SIRET}}</span>
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
            <th>Type de locaux</th>
            <td>{{LOCAL_TYPE}}</td>
          </tr>
          <tr>
            <th>Surface</th>
            <td>{{LOCAL_SURFACE}} m²</td>
          </tr>
          <tr>
            <th>Étage</th>
            <td>{{LOCAL_ETAGE}}</td>
          </tr>
          <tr>
            <th>Description</th>
            <td>{{LOCAL_DESCRIPTION}}</td>
          </tr>
          <tr>
            <th>Équipements inclus</th>
            <td>{{LOCAL_EQUIPEMENTS}}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- DESTINATION -->
    <div class="section">
      <div class="section-title">III. Usage et destination</div>
      <div class="section-content">
        <div class="article">
          <div class="article-content">
            Les locaux sont loués exclusivement pour l'exercice de la profession suivante :
            <div class="highlight">
              <strong>{{PROFESSION_EXERCEE}}</strong>
            </div>
            <p style="margin-top: 10px;">
              Le preneur s'engage à exercer son activité dans le respect des règles
              déontologiques de sa profession et de la réglementation en vigueur.
            </p>
          </div>
        </div>

        <div class="info">
          <strong>Activités autorisées :</strong> Réception de clientèle/patients,
          consultations, travail administratif lié à l'activité professionnelle.
          {{#ACTIVITES_ANNEXES}}
          <br>Activités annexes : {{ACTIVITES_ANNEXES}}
          {{/ACTIVITES_ANNEXES}}
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
            <th>Durée initiale</th>
            <td><strong>6 ans</strong></td>
          </tr>
          <tr>
            <th>Date d'expiration</th>
            <td>{{DATE_FIN}}</td>
          </tr>
        </table>

        <div class="article">
          <div class="article-title">Article 4.1 - Tacite reconduction</div>
          <div class="article-content">
            À défaut de congé donné par l'une ou l'autre des parties dans les conditions
            prévues ci-après, le bail sera reconduit tacitement pour une durée de 6 ans
            aux mêmes clauses et conditions, sous réserve de la révision du loyer.
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 4.2 - Congé du preneur</div>
          <div class="article-content">
            Le preneur pourra donner congé à tout moment, sous réserve de respecter un
            préavis de <strong>6 mois</strong>. Le congé devra être notifié par lettre
            recommandée avec accusé de réception ou par acte extrajudiciaire.
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 4.3 - Congé du bailleur</div>
          <div class="article-content">
            Le bailleur pourra donner congé pour le terme du bail, sous réserve de
            respecter un préavis de <strong>6 mois</strong> avant l'échéance. Le congé
            devra être motivé (reprise pour habiter, vente, motif légitime et sérieux).
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
            <th>Charges (provision)</th>
            <td>{{CHARGES_PROVISION}} € / mois</td>
          </tr>
          <tr>
            <th>Dépôt de garantie</th>
            <td>{{DEPOT_GARANTIE}} € ({{DEPOT_MOIS}} mois)</td>
          </tr>
        </table>

        <div class="article">
          <div class="article-title">Article 5.1 - Révision du loyer</div>
          <div class="article-content">
            Le loyer sera révisé chaque année à la date anniversaire du bail par
            application de la variation de l'indice <strong>{{INDICE_REFERENCE}}</strong>.
            <br><br>
            Indice de référence : {{INDICE_BASE}} ({{INDICE_TRIMESTRE}})
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 5.2 - Paiement</div>
          <div class="article-content">
            Le loyer et les charges sont payables d'avance le {{JOUR_PAIEMENT}} de
            chaque mois, par {{MODE_PAIEMENT}}.
          </div>
        </div>
      </div>
    </div>

    <!-- OBLIGATIONS -->
    <div class="section">
      <div class="section-title">VI. Obligations des parties</div>
      <div class="section-content">
        <div class="article">
          <div class="article-title">Article 6.1 - Obligations du bailleur</div>
          <div class="article-content">
            <ul style="margin: 10px 0 10px 20px;">
              <li>Délivrer les locaux en bon état d'usage</li>
              <li>Assurer la jouissance paisible des lieux</li>
              <li>Effectuer les grosses réparations (article 606 du Code civil)</li>
              <li>Maintenir les locaux conformes à leur destination</li>
            </ul>
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 6.2 - Obligations du preneur</div>
          <div class="article-content">
            <ul style="margin: 10px 0 10px 20px;">
              <li>Payer le loyer et les charges aux termes convenus</li>
              <li>User des locaux conformément à leur destination professionnelle</li>
              <li>Effectuer les réparations locatives et l'entretien courant</li>
              <li>Assurer les locaux (responsabilité civile professionnelle et multirisques)</li>
              <li>Ne pas transformer les locaux sans autorisation</li>
              <li>Respecter le règlement de l'immeuble et les normes professionnelles</li>
              <li>Afficher les documents obligatoires (tarifs, diplômes, etc.)</li>
              <li>Restituer les locaux en bon état en fin de bail</li>
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
          <div class="article-title">Article 7.1 - Cession du bail</div>
          <div class="article-content">
            {{#CESSION_AUTORISEE}}
            Le preneur pourra céder son droit au bail à un successeur exerçant la même
            profession, sous réserve de l'agrément du bailleur qui ne pourra être refusé
            sans motif légitime.
            {{/CESSION_AUTORISEE}}
            {{^CESSION_AUTORISEE}}
            Toute cession du bail est interdite sans l'accord préalable et écrit du bailleur.
            {{/CESSION_AUTORISEE}}
          </div>
        </div>

        <div class="article">
          <div class="article-title">Article 7.2 - Sous-location</div>
          <div class="article-content">
            {{#SOUS_LOCATION_AUTORISEE}}
            La sous-location partielle est autorisée à un professionnel de santé ou
            profession libérale compatible, sous réserve d'en informer le bailleur.
            {{/SOUS_LOCATION_AUTORISEE}}
            {{^SOUS_LOCATION_AUTORISEE}}
            La sous-location totale ou partielle est interdite.
            {{/SOUS_LOCATION_AUTORISEE}}
          </div>
        </div>
      </div>
    </div>

    <!-- CLAUSES PARTICULIÈRES -->
    <div class="section">
      <div class="section-title">VIII. Clauses particulières</div>
      <div class="section-content">
        {{#RECEPTION_PATIENTS}}
        <div class="article">
          <div class="article-title">Réception de patients/clients</div>
          <div class="article-content">
            Le preneur est autorisé à recevoir sa clientèle/patientèle dans les locaux
            pendant les heures d'ouverture habituelles de l'immeuble. Une plaque
            professionnelle pourra être apposée conformément aux règles de la copropriété.
          </div>
        </div>
        {{/RECEPTION_PATIENTS}}

        {{#ACCESSIBILITE}}
        <div class="article">
          <div class="article-title">Accessibilité</div>
          <div class="article-content">
            Les locaux sont conformes aux normes d'accessibilité pour les personnes à
            mobilité réduite : {{ACCESSIBILITE_DETAILS}}
          </div>
        </div>
        {{/ACCESSIBILITE}}

        {{CLAUSES_SUPPLEMENTAIRES}}
      </div>
    </div>

    <!-- ANNEXES -->
    <div class="section">
      <div class="section-title">IX. Annexes</div>
      <div class="section-content">
        <p>Sont annexés au présent bail :</p>
        <ul style="margin: 10px 0 10px 20px;">
          <li>État des lieux d'entrée</li>
          <li>Diagnostics techniques (DPE, électricité, etc.)</li>
          <li>Règlement de copropriété (extrait le cas échéant)</li>
          {{ANNEXES_LISTE}}
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

        <div class="signature-grid">
          <div class="signature-box">
            <div class="signature-label">Le Bailleur</div>
            <p style="font-size: 9pt; color: #666;">
              (Signature précédée de "Lu et approuvé")
            </p>
            {{SIGNATURE_BAILLEUR}}
          </div>
          <div class="signature-box">
            <div class="signature-label">Le Preneur</div>
            <p style="font-size: 9pt; color: #666;">
              (Signature précédée de "Lu et approuvé")
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

export const BAIL_PROFESSIONNEL_VARIABLES = [
  // Document
  "DOCUMENT_TITLE",
  "REFERENCE_BAIL",
  "DATE_SIGNATURE",
  "LIEU_SIGNATURE",

  // Bailleur
  "BAILLEUR_NOM_COMPLET",
  "BAILLEUR_ADRESSE",
  "BAILLEUR_SIRET",

  // Preneur
  "PRENEUR_NOM_COMPLET",
  "PRENEUR_PROFESSION",
  "PRENEUR_NUMERO_ORDRE",
  "PRENEUR_SIRET",

  // Locaux
  "LOCAL_ADRESSE",
  "LOCAL_TYPE",
  "LOCAL_SURFACE",
  "LOCAL_ETAGE",
  "LOCAL_DESCRIPTION",
  "LOCAL_EQUIPEMENTS",

  // Activité
  "PROFESSION_EXERCEE",
  "ACTIVITES_ANNEXES",

  // Durée
  "DATE_DEBUT",
  "DATE_FIN",

  // Financier
  "LOYER_MENSUEL_HT",
  "TVA_APPLICABLE",
  "TVA_TAUX",
  "TVA_MONTANT",
  "LOYER_MENSUEL_TTC",
  "CHARGES_PROVISION",
  "DEPOT_GARANTIE",
  "DEPOT_MOIS",
  "JOUR_PAIEMENT",
  "MODE_PAIEMENT",

  // Indexation
  "INDICE_REFERENCE",
  "INDICE_BASE",
  "INDICE_TRIMESTRE",

  // Options
  "CESSION_AUTORISEE",
  "SOUS_LOCATION_AUTORISEE",
  "RECEPTION_PATIENTS",
  "ACCESSIBILITE",
  "ACCESSIBILITE_DETAILS",

  // Clauses
  "CLAUSES_SUPPLEMENTAIRES",
  "ANNEXES_LISTE",

  // Signatures
  "SIGNATURE_BAILLEUR",
  "SIGNATURE_PRENEUR",
];
