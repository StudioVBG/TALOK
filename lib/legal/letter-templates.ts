/**
 * Modèles de courriers légaux pour les locataires
 *
 * Chaque template prend un contexte (données du bail, locataire, propriétaire)
 * et retourne un courrier HTML prêt à imprimer.
 *
 * Les courriers sont conformes au Code civil + loi du 6 juillet 1989 et
 * peuvent être envoyés en lettre recommandée avec AR (LRAR).
 */

export type LetterKey =
  | "demande_quittance"
  | "contestation_hausse_loyer"
  | "signalement_reparation_urgente"
  | "demande_attestation_loyer"
  | "restitution_caution_relance";

export interface LetterContext {
  tenantFullName: string;
  tenantAddress?: string;
  ownerFullName: string;
  ownerAddress?: string;
  propertyAddress: string;
  leaseStartDate?: string;
  rentMonthly?: number;
  charges?: number;
  cautionAmount?: number;
  city?: string;
}

export interface LetterTemplate {
  key: LetterKey;
  title: string;
  description: string;
  legalReference: string;
  recommendation: string;
  buildBody: (ctx: LetterContext) => string;
}

const formatEuro = (n?: number): string =>
  n === undefined || n === null
    ? "____ €"
    : n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const formatDateFr = (iso?: string): string => {
  if (!iso) return "____________";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "____________";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const todayFr = (): string =>
  new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// ============================================================
// Templates
// ============================================================

export const LETTER_TEMPLATES: Record<LetterKey, LetterTemplate> = {
  demande_quittance: {
    key: "demande_quittance",
    title: "Demande de quittance de loyer",
    description:
      "Le propriétaire est légalement tenu de vous fournir une quittance gratuitement à chaque paiement (article 21 loi du 6 juillet 1989).",
    legalReference: "Article 21 de la loi n° 89-462 du 6 juillet 1989",
    recommendation:
      "Lettre simple ou recommandée avec accusé de réception (LRAR) recommandée si le propriétaire refuse depuis plusieurs mois.",
    buildBody: (ctx) => `
      <p>Madame, Monsieur,</p>

      <p>Je suis locataire du logement situé au <strong>${ctx.propertyAddress}</strong>${
        ctx.leaseStartDate ? `, en vertu d'un bail signé le ${formatDateFr(ctx.leaseStartDate)}` : ""
      }.</p>

      <p>Conformément à l'article 21 de la loi n° 89-462 du 6 juillet 1989, le bailleur est tenu de remettre gratuitement une quittance au locataire qui en fait la demande.</p>

      <p>Je vous saurais donc gré de bien vouloir m'adresser la quittance correspondant aux loyers et charges réglés${
        ctx.rentMonthly ? ` (loyer mensuel ${formatEuro(ctx.rentMonthly)}${ctx.charges ? ` + ${formatEuro(ctx.charges)} de charges` : ""})` : ""
      }, depuis le début de notre bail.</p>

      <p>Je reste à votre disposition pour toute information complémentaire.</p>

      <p>Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>
    `,
  },

  contestation_hausse_loyer: {
    key: "contestation_hausse_loyer",
    title: "Contestation d'une hausse de loyer",
    description:
      "Vous pouvez contester une augmentation de loyer si elle dépasse l'indice de référence des loyers (IRL) ou si elle n'est pas justifiée à la signature du bail (en zone tendue notamment).",
    legalReference: "Article 17-1 de la loi n° 89-462 du 6 juillet 1989",
    recommendation:
      "Lettre recommandée avec accusé de réception (LRAR) obligatoire pour conserver une preuve de la contestation.",
    buildBody: (ctx) => `
      <p>Madame, Monsieur,</p>

      <p>Je suis locataire du logement situé au <strong>${ctx.propertyAddress}</strong>${
        ctx.leaseStartDate ? `, depuis le ${formatDateFr(ctx.leaseStartDate)}` : ""
      }, pour un loyer mensuel de ${formatEuro(ctx.rentMonthly)}${ctx.charges ? ` (charges : ${formatEuro(ctx.charges)})` : ""}.</p>

      <p>Vous m'avez notifié, par courrier en date du __________, une augmentation de loyer portant le montant à __________ €.</p>

      <p>Je vous informe que je conteste cette hausse pour les motifs suivants :</p>

      <ul>
        <li>L'augmentation excède l'indice de référence des loyers (IRL) publié par l'INSEE pour la période concernée ;</li>
        <li>Aucune révision n'est prévue dans le bail OU le délai annuel de révision n'a pas été respecté ;</li>
        <li>Le logement présente des défauts ou non-conformités qui ne justifient pas une réévaluation à la hausse.</li>
      </ul>

      <p>Conformément à l'article 17-1 de la loi du 6 juillet 1989, je vous demande de bien vouloir réviser cette augmentation et m'en transmettre le calcul détaillé (indice IRL de référence, indice IRL de révision, nouveau loyer calculé).</p>

      <p>À défaut d'une réponse satisfaisante sous 30 jours, je me réserve la possibilité de saisir la Commission Départementale de Conciliation (CDC) du département${ctx.city ? ` (${ctx.city})` : ""}.</p>

      <p>Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>
    `,
  },

  signalement_reparation_urgente: {
    key: "signalement_reparation_urgente",
    title: "Signalement d'une réparation urgente",
    description:
      "Le bailleur doit assurer les grosses réparations et le maintien en bon état d'usage du logement (article 6 loi 1989). Cette lettre formalise votre signalement et fait courir le délai de réponse.",
    legalReference: "Article 6 de la loi n° 89-462 du 6 juillet 1989 — décret n° 87-712 du 26 août 1987",
    recommendation:
      "Lettre recommandée avec accusé de réception (LRAR) impérative. À doubler par un email pour traçabilité.",
    buildBody: (ctx) => `
      <p>Madame, Monsieur,</p>

      <p>Je vous informe par la présente d'un dysfonctionnement urgent affectant le logement situé au <strong>${ctx.propertyAddress}</strong>, dont je suis locataire${
        ctx.leaseStartDate ? ` depuis le ${formatDateFr(ctx.leaseStartDate)}` : ""
      }.</p>

      <p><strong>Description du problème :</strong></p>
      <p>__________________________________________________________________<br/>
      __________________________________________________________________<br/>
      __________________________________________________________________</p>

      <p><strong>Date de constatation :</strong> __________</p>

      <p>Conformément à l'article 6 de la loi du 6 juillet 1989, vous êtes tenu d'assurer les grosses réparations ainsi que le maintien en bon état d'usage du logement. Je vous demande donc de procéder aux travaux nécessaires <strong>dans les plus brefs délais</strong>, et au plus tard sous 15 jours à compter de la réception du présent courrier.</p>

      <p>À défaut d'intervention de votre part, je me réserve la possibilité, après mise en demeure, de :</p>
      <ul>
        <li>Faire exécuter les travaux par un professionnel de mon choix et déduire le coût du loyer ;</li>
        <li>Saisir la Commission Départementale de Conciliation (CDC) ;</li>
        <li>Saisir le tribunal judiciaire pour faire ordonner les travaux sous astreinte.</li>
      </ul>

      <p>Je reste à votre disposition pour convenir d'un rendez-vous d'expertise.</p>

      <p>Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>
    `,
  },

  demande_attestation_loyer: {
    key: "demande_attestation_loyer",
    title: "Demande d'attestation de loyer (CAF / administration)",
    description:
      "Une attestation de loyer est nécessaire pour vos démarches CAF, APL, demandes de logement social, dossiers fiscaux ou crédits.",
    legalReference: "Pratique courante — non opposable juridiquement mais usage généralisé",
    recommendation:
      "Lettre simple ou email. Un délai de 15 jours est raisonnable pour la réponse.",
    buildBody: (ctx) => `
      <p>Madame, Monsieur,</p>

      <p>Je suis locataire du logement situé au <strong>${ctx.propertyAddress}</strong>${
        ctx.leaseStartDate ? `, depuis le ${formatDateFr(ctx.leaseStartDate)}` : ""
      }, pour un loyer mensuel de ${formatEuro(ctx.rentMonthly)}${ctx.charges ? ` (charges : ${formatEuro(ctx.charges)})` : ""}.</p>

      <p>Pour les besoins de mes démarches administratives (CAF / APL / dossier de logement social / déclaration fiscale — rayer la mention inutile), je vous prie de bien vouloir m'adresser une attestation de loyer reprenant les éléments suivants :</p>

      <ul>
        <li>L'adresse du logement loué ;</li>
        <li>La date de début du bail ;</li>
        <li>Le montant du loyer mensuel et des charges ;</li>
        <li>L'attestation que les loyers sont à jour à la date de l'attestation.</li>
      </ul>

      <p>Je vous saurais gré de me transmettre cette attestation sous 15 jours.</p>

      <p>Je vous remercie par avance et reste à votre disposition pour tout complément d'information.</p>

      <p>Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>
    `,
  },

  restitution_caution_relance: {
    key: "restitution_caution_relance",
    title: "Relance pour restitution du dépôt de garantie",
    description:
      "Le bailleur doit restituer le dépôt de garantie sous 1 mois (EDL conforme) ou 2 mois (retenues). Au-delà, des intérêts de retard de 10% par mois sont dus.",
    legalReference: "Article 22 de la loi n° 89-462 du 6 juillet 1989",
    recommendation:
      "Lettre recommandée avec accusé de réception (LRAR) impérative pour faire courir les intérêts de retard.",
    buildBody: (ctx) => `
      <p>Madame, Monsieur,</p>

      <p>J'ai quitté le logement situé au <strong>${ctx.propertyAddress}</strong>, dont j'étais locataire${
        ctx.leaseStartDate ? ` depuis le ${formatDateFr(ctx.leaseStartDate)}` : ""
      }, le __________.</p>

      <p>L'état des lieux de sortie a été établi à cette date. Conformément à l'article 22 de la loi du 6 juillet 1989, vous disposiez d'un délai de :</p>

      <ul>
        <li><strong>1 mois</strong> pour restituer le dépôt de garantie de ${formatEuro(ctx.cautionAmount)} si l'état des lieux de sortie était conforme à celui d'entrée ;</li>
        <li><strong>2 mois</strong> en cas de retenues justifiées.</li>
      </ul>

      <p>Or, à ce jour, soit plus de _______ mois après l'état des lieux de sortie, je n'ai toujours pas reçu cette restitution.</p>

      <p>Je vous mets donc en demeure de me restituer le dépôt de garantie ${
        ctx.cautionAmount ? `(${formatEuro(ctx.cautionAmount)})` : ""
      } sous <strong>15 jours</strong> à compter de la réception de cette lettre, étant rappelé qu'à défaut, vous me devrez en outre des <strong>intérêts de retard équivalents à 10% du loyer mensuel hors charges (${formatEuro(ctx.rentMonthly)}) par mois entamé</strong>.</p>

      <p>À défaut de paiement dans ce délai, je saisirai la Commission Départementale de Conciliation, puis le tribunal judiciaire.</p>

      <p>Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>
    `,
  },
};

// ============================================================
// HTML wrapper (lettre formatée à imprimer)
// ============================================================

export function buildLetterHtml(template: LetterTemplate, ctx: LetterContext): string {
  const senderBlock = `
    <div class="sender">
      <strong>${ctx.tenantFullName}</strong>
      ${ctx.tenantAddress ? `<br/>${ctx.tenantAddress}` : ""}
    </div>
  `;

  const recipientBlock = `
    <div class="recipient">
      <strong>${ctx.ownerFullName}</strong>
      ${ctx.ownerAddress ? `<br/>${ctx.ownerAddress}` : ""}
    </div>
  `;

  const subject = `<strong>Objet :</strong> ${template.title}${template.legalReference ? ` (${template.legalReference})` : ""}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${template.title} — ${ctx.tenantFullName}</title>
  <style>
    @page { margin: 2cm; }
    body {
      font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif;
      max-width: 21cm;
      margin: 2cm auto;
      padding: 0 2cm;
      color: #1f2937;
      font-size: 12pt;
      line-height: 1.6;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3em;
    }
    .sender { font-size: 11pt; }
    .recipient {
      text-align: right;
      font-size: 11pt;
    }
    .meta {
      text-align: right;
      margin-bottom: 2em;
      font-size: 11pt;
    }
    .subject {
      margin-bottom: 2em;
      font-size: 12pt;
    }
    .body p { margin: 0.8em 0; }
    .body ul { margin: 0.8em 0; padding-left: 1.5em; }
    .signature {
      margin-top: 3em;
      text-align: right;
    }
    .recommendation {
      margin-top: 4em;
      padding: 1em;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      font-size: 10pt;
    }
    .actions {
      position: fixed;
      bottom: 1em;
      right: 1em;
      display: flex;
      gap: 8px;
    }
    .actions button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
    }
    .actions button:hover { background: #1d4ed8; }
    .actions button.secondary { background: #6b7280; }
    .actions button.secondary:hover { background: #4b5563; }
    @media print {
      .actions, .recommendation { display: none; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${senderBlock}
    ${recipientBlock}
  </div>

  <div class="meta">
    Fait à ${ctx.city || "____________"}, le ${todayFr()}
  </div>

  <div class="subject">${subject}</div>

  <div class="body">
    ${template.buildBody(ctx)}
  </div>

  <div class="signature">
    <p style="margin-bottom: 4em;">Signature :</p>
    <p>${ctx.tenantFullName}</p>
  </div>

  <div class="recommendation">
    <strong>📌 Recommandation :</strong> ${template.recommendation}
  </div>

  <div class="actions">
    <button class="secondary" onclick="window.close()">Fermer</button>
    <button onclick="window.print()">🖨️ Imprimer / PDF</button>
  </div>

  <script>
    // Auto-focus pour permettre Ctrl+P immédiat
    window.addEventListener('load', () => {
      // Pas d'auto-print pour permettre la relecture
    });
  </script>
</body>
</html>`;
}

export function listLetterTemplates(): LetterTemplate[] {
  return Object.values(LETTER_TEMPLATES);
}
