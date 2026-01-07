/**
 * Service de génération de template EDL
 * Similaire au service de bail mais pour les états des lieux
 */

import { EDL_TEMPLATE, EDL_TEMPLATE_VIERGE } from "./edl.template";
import {
  EDLComplet,
  EDLTemplateVariables,
  CONDITION_LABELS,
  METER_TYPE_LABELS,
  METER_TYPE_ICONS,
  ItemCondition,
} from "./types";
import { formatDate, formatCurrency } from "@/lib/helpers/format";

/**
 * Génère le HTML d'un compteur
 */
function generateMeterHTML(
  type: string,
  meterNumber: string | undefined,
  reading: string,
  unit: string
): string {
  const label = METER_TYPE_LABELS[type] || type;
  const icon = METER_TYPE_ICONS[type] || "📊";
  
  // Formatage de la valeur du relevé
  const isNotRead = reading === "Non relevé" || !reading;
  const displayValue = isNotRead ? "À relever" : reading;
  const displayUnit = isNotRead ? "" : unit;
  const valueClass = isNotRead ? "meter-value pending" : "meter-value";

  return `
    <div class="meter-card">
      <div class="meter-icon">${icon}</div>
      <div class="meter-info">
        <div class="meter-type">${label}</div>
        ${meterNumber ? `<div class="meter-number">N° ${meterNumber}</div>` : ""}
        <div class="${valueClass}" style="${isNotRead ? 'color: #d97706; font-style: italic; font-size: 0.9em;' : ''}">${displayValue} ${displayUnit}</div>
      </div>
    </div>
  `;
}

/**
 * Génère le HTML d'une pièce avec ses éléments
 */
function generateRoomHTML(
  roomName: string,
  items: Array<{
    item_name: string;
    condition: ItemCondition | null;
    notes?: string;
    photos?: string[];
  }>,
  roomPhotos?: string[]
): string {
  const conditionCounts = {
    bon: 0,
    moyen: 0,
    mauvais: 0,
    tres_mauvais: 0,
  };

  items.forEach((item) => {
    if (item.condition) {
      conditionCounts[item.condition]++;
    }
  });

  // Déterminer le badge de la pièce
  let badgeClass = "good";
  let badgeText = "Bon état";
  const total = items.length;
  const badCount = conditionCounts.mauvais + conditionCounts.tres_mauvais;

  if (badCount > total * 0.5) {
    badgeClass = "bad";
    badgeText = "Mauvais état";
  } else if (badCount > 0 || conditionCounts.moyen > total * 0.3) {
    badgeClass = "mixed";
    badgeText = "État mixte";
  }

  const itemsHTML = items
    .map((item) => {
      const conditionLabel = item.condition ? CONDITION_LABELS[item.condition] : "Non évalué";
      const conditionClass = item.condition || "none";
      
      let itemPhotosHTML = "";
      if (item.photos && item.photos.length > 0) {
        itemPhotosHTML = `
          <div class="photos-grid">
            ${item.photos.slice(0, 4).map(url => `
              <div class="photo-thumb">
                <img src="${url}" alt="Photo ${item.item_name}" />
              </div>
            `).join('')}
          </div>
        `;
      }

      return `
        <div class="item-container" style="border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 4px;">
          <div class="item-row" style="display: flex; align-items: center; padding: 4px 12px; border-bottom: none;">
            <span class="item-name" style="flex: 1; font-weight: 500; color: #374151; font-size: 9pt;">${item.item_name}</span>
            <span class="item-condition ${conditionClass}" style="padding: 2px 10px; border-radius: 20px; font-size: 8.5pt; font-weight: 600; text-align: center; min-width: 90px;">
              ${conditionLabel}
            </span>
          </div>
          ${item.notes ? `<div class="item-notes" style="width: calc(100% - 24px); padding: 4px 10px; background: #fffbeb; border-left: 3px solid #f59e0b; font-size: 8.5pt; font-style: italic; color: #92400e; margin: 2px 12px 4px 12px;">${item.notes}</div>` : ""}
          ${itemPhotosHTML}
        </div>
      `;
    })
    .join("");

  let roomPhotosHTML = "";
  if (roomPhotos && roomPhotos.length > 0) {
    roomPhotosHTML = `
      <div class="section-subtitle" style="padding: 6px 15px; font-weight: bold; color: #475569; font-size: 8.5pt;">📸 Photos de la pièce</div>
      <div class="photos-grid">
        ${roomPhotos
          .slice(0, 8)
          .map((url) => `<div class="photo-thumb"><img src="${url}" alt="Photo pièce" /></div>`)
          .join("")}
      </div>
    `;
  }

  return `
    <div class="room-section">
      <div class="room-header">
        <span class="room-name">${roomName}</span>
        <span class="room-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="room-items">
        ${itemsHTML}
      </div>
      ${roomPhotosHTML}
    </div>
  `;
}

/**
 * Génère le HTML des clés
 */
function generateKeysHTML(
  keys: Array<{ type: string; quantite: number; notes?: string }>
): string {
  return keys
    .map(
      (key) => `
      <tr>
        <td>${key.type}</td>
        <td class="key-qty">${key.quantite}</td>
        <td>${key.notes || "-"}</td>
      </tr>
    `
    )
    .join("");
}

/**
 * Génère les pièces vierges pour le template à imprimer
 */
function generateEmptyRoomsHTML(rooms: string[]): string {
  const defaultItems = [
    "Sol",
    "Murs",
    "Plafond",
    "Fenêtre(s)",
    "Porte",
    "Éclairage",
    "Prises électriques",
    "Radiateur/Chauffage",
    "Autre :",
  ];

  return rooms
    .map(
      (roomName) => `
    <div class="page">
      <h1 style="font-size: 14pt;">ÉTAT DES LIEUX - ${roomName}</h1>
      
      <table class="room-table">
        <thead>
          <tr>
            <th>Élément</th>
            <th class="condition-col">Bon</th>
            <th class="condition-col">Moyen</th>
            <th class="condition-col">Mauvais</th>
            <th class="condition-col">Très mauvais</th>
            <th class="notes-col">Observations</th>
          </tr>
        </thead>
        <tbody>
          ${defaultItems
            .map(
              (item) => `
            <tr>
              <td>${item}</td>
              <td class="condition-col"><span class="checkbox"></span></td>
              <td class="condition-col"><span class="checkbox"></span></td>
              <td class="condition-col"><span class="checkbox"></span></td>
              <td class="condition-col"><span class="checkbox"></span></td>
              <td class="notes-col"></td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      
      <h2 style="margin-top: 15px;">📸 Photos (à joindre)</h2>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px;">
        ${Array(4)
          .fill("")
          .map(
            () =>
              '<div style="border: 1px dashed #999; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #999;">Photo</div>'
          )
          .join("")}
      </div>
      
      <h2 style="margin-top: 15px;">📝 Notes supplémentaires</h2>
      <div style="border: 1px solid #999; min-height: 60px; padding: 8px;"></div>
    </div>
  `
    )
    .join("");
}

/**
 * Mappe un EDL complet vers les variables du template
 */
export function mapEDLToTemplateVariables(edl: EDLComplet): EDLTemplateVariables {
  // Comptage des états
  let nbNeuf = 0,
    nbBon = 0,
    nbMoyen = 0,
    nbMauvais = 0,
    nbTresMauvais = 0;

  edl.pieces.forEach((piece) => {
    piece.items.forEach((item) => {
      if (item.condition === "neuf") nbNeuf++;
      else if (item.condition === "bon") nbBon++;
      else if (item.condition === "moyen") nbMoyen++;
      else if (item.condition === "mauvais") nbMauvais++;
      else if (item.condition === "tres_mauvais") nbTresMauvais++;
    });
  });

  const totalElements = nbNeuf + nbBon + nbMoyen + nbMauvais + nbTresMauvais;
  // Neuf + Bon sont considérés comme "bon état" pour le pourcentage global
  const pourcentageBon = totalElements > 0 ? Math.round(((nbNeuf + nbBon) / totalElements) * 100) : 0;

  // Générer HTML des compteurs
  const compteursHTML = edl.compteurs
    .map((c) => generateMeterHTML(c.type, c.meter_number, c.reading, c.unit))
    .join("");

  // Générer HTML des pièces
  const piecesHTML = edl.pieces
    .map((piece) => generateRoomHTML(piece.nom, piece.items, (piece as any).photos))
    .join("");

  // Générer HTML des clés
  const clesHTML = edl.cles_remises ? generateKeysHTML(edl.cles_remises) : "";

  // Signatures (supporte les rôles en anglais et français)
  const signatureBailleur = edl.signatures.find((s) => ["proprietaire", "owner", "propriétaire"].includes(s.signer_type));
  const signatureLocataire = edl.signatures.find((s) => ["locataire", "tenant"].includes(s.signer_type));

  // Nom complet des locataires
  const locatairesNomComplet = edl.locataires
    .map((l) => l.nom_complet || `${l.prenom} ${l.nom}`)
    .join(", ");

  // Liste des locataires pour détail
  const locatairesListe = edl.locataires
    .map(
      (l) => `
    <div class="info-row">
      <span class="label">${l.prenom || ""} ${l.nom || ""}:</span>
      <span class="value">${l.email || ""} ${l.telephone ? `- ${l.telephone}` : ""}</span>
    </div>
  `
    )
    .join("");

  // Générer le HTML du certificat si signé
  let certificateHTML = "";
  if (edl.is_signed) {
    certificateHTML = edl.signatures
      .filter((s) => s.signed_at && s.proof_id)
      .map((s) => `
        <div class="info-box" style="margin-bottom: 20px;">
          <h3 style="color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">
            Preuve de signature : ${s.signer_type === "owner" || s.signer_type === "proprietaire" ? "Bailleur" : "Locataire"}
          </h3>
          <div class="grid-2" style="margin-top: 10px;">
            <div>
              <div class="info-row"><span class="label">Signataire :</span><span class="value">${s.signer_name}</span></div>
              <div class="info-row"><span class="label">ID Preuve :</span><span class="value" style="font-family: monospace; font-size: 9pt;">${s.proof_id}</span></div>
              <div class="info-row"><span class="label">Date/Heure :</span><span class="value">${s.signed_at ? formatDate(s.signed_at) : ""}</span></div>
              <div class="info-row"><span class="label">Adresse IP :</span><span class="value">${s.ip_address || "Non enregistrée"}</span></div>
            </div>
            <div>
              <div class="info-row"><span class="label">ID Document :</span><span class="value" style="font-family: monospace; font-size: 8pt;">${edl.id}</span></div>
              <div class="info-row"><span class="label">Hash Document :</span><span class="value" style="font-family: monospace; font-size: 8pt;">${s.document_hash || "Non généré"}</span></div>
              <div class="info-row"><span class="label">Méthode ID :</span><span class="value">${s.proof_metadata?.signer?.identityMethod || "Vérification standard"}</span></div>
            </div>
          </div>
          <div style="margin-top: 10px; font-size: 8pt; color: #64748b; font-style: italic;">
            Navigateur : ${s.proof_metadata?.metadata?.userAgent || "Non spécifié"}
          </div>
        </div>
      `)
      .join("");
  }

  return {
    // Header
    EDL_REFERENCE: edl.reference,
    EDL_TYPE: edl.type,
    EDL_TYPE_LABEL: edl.type === "entree" ? "D'ENTRÉE" : "DE SORTIE",
    EDL_TYPE_COLOR: edl.type === "entree" ? "#059669" : "#dc2626",
    IS_EDL_ENTREE: edl.type === "entree",
    IS_EDL_SORTIE: edl.type === "sortie",
    DATE_EDL: edl.completed_date
      ? formatDate(edl.completed_date)
      : edl.scheduled_date
      ? formatDate(edl.scheduled_date)
      : "À définir",
    DATE_CREATION: formatDate(edl.created_at),

    // Logement
    LOGEMENT_ADRESSE: edl.logement.adresse_complete,
    LOGEMENT_CODE_POSTAL: edl.logement.code_postal,
    LOGEMENT_VILLE: edl.logement.ville,
    LOGEMENT_TYPE: edl.logement.type_bien,
    LOGEMENT_SURFACE: edl.logement.surface?.toString() || "",
    LOGEMENT_NB_PIECES: edl.logement.nb_pieces?.toString() || "",
    LOGEMENT_ETAGE: edl.logement.etage || "",
    LOGEMENT_NUMERO_LOT: edl.logement.numero_lot || "",

    // Bailleur
    BAILLEUR_NOM_COMPLET:
      edl.bailleur.type === "societe"
        ? edl.bailleur.raison_sociale || edl.bailleur.nom_complet
        : edl.bailleur.nom_complet,
    BAILLEUR_LABEL_NOM: edl.bailleur.type === "societe" ? "Société" : "Nom",
    BAILLEUR_TYPE: edl.bailleur.type,
    BAILLEUR_ADRESSE: edl.bailleur.adresse || "",
    BAILLEUR_TELEPHONE: edl.bailleur.telephone || "",
    BAILLEUR_EMAIL: edl.bailleur.email || "",
    IS_SOCIETE: edl.bailleur.type === "societe",
    BAILLEUR_REPRESENTANT: edl.bailleur.representant || "",

    // Locataires
    LOCATAIRES_NOM_COMPLET: locatairesNomComplet || "À définir",
    LOCATAIRES_LISTE: locatairesListe,
    LOCATAIRES_TELEPHONE: edl.locataires?.[0]?.telephone || "À définir",
    LOCATAIRES_EMAIL: edl.locataires?.[0]?.email || "À définir",
    NB_LOCATAIRES: edl.locataires.length,
    IS_SINGLE_TENANT: edl.locataires.length === 1,

    // Bail
    BAIL_REFERENCE: edl.bail.reference || edl.bail.id.slice(0, 8).toUpperCase(),
    BAIL_TYPE: formatBailType(edl.bail.type_bail),
    BAIL_DATE_DEBUT: formatDate(edl.bail.date_debut),
    BAIL_DATE_FIN: edl.bail.date_fin ? formatDate(edl.bail.date_fin) : "Indéterminée",
    BAIL_LOYER_HC: formatCurrency(edl.bail.loyer_hc),
    BAIL_CHARGES: formatCurrency(edl.bail.charges),
    BAIL_TOTAL: formatCurrency(edl.bail.loyer_hc + edl.bail.charges),

    // Compteurs
    COMPTEURS_HTML: compteursHTML,
    HAS_COMPTEURS: edl.compteurs.length > 0,

    // Pièces
    PIECES_HTML: piecesHTML,
    NB_PIECES_INSPECTEES: edl.pieces.length,

    // Observations
    OBSERVATIONS_GENERALES: edl.observations_generales || "",
    HAS_OBSERVATIONS: !!edl.observations_generales,

    // Clés
    CLES_HTML: clesHTML,
    HAS_CLES: edl.cles_remises ? edl.cles_remises.length > 0 : false,

    // Signatures
    SIGNATURES_HTML: "", // Généré dans le template
    IS_SIGNED: edl.is_signed,
    DATE_SIGNATURE_BAILLEUR: signatureBailleur?.signed_at
      ? formatDate(signatureBailleur.signed_at)
      : "",
    DATE_SIGNATURE_LOCATAIRE: signatureLocataire?.signed_at
      ? formatDate(signatureLocataire.signed_at)
      : "",
    SIGNATURE_IMAGE_BAILLEUR: signatureBailleur?.signature_image || "",
    SIGNATURE_IMAGE_LOCATAIRE: signatureLocataire?.signature_image || "",
    CERTIFICATE_HTML: certificateHTML,

    // Résumé
    RESUME_ETAT: pourcentageBon >= 80 ? "Bon" : pourcentageBon >= 50 ? "Moyen" : "Mauvais",
    NB_ELEMENTS_NEUF: nbNeuf,
    NB_ELEMENTS_BON: nbBon,
    NB_ELEMENTS_MOYEN: nbMoyen,
    NB_ELEMENTS_MAUVAIS: nbMauvais,
    NB_ELEMENTS_TRES_MAUVAIS: nbTresMauvais,
    POURCENTAGE_BON_ETAT: pourcentageBon,
  };
}

/**
 * Formate le type de bail pour affichage
 */
function formatBailType(type: string): string {
  const types: Record<string, string> = {
    nu: "Location nue",
    meuble: "Location meublée",
    colocation: "Colocation",
    saisonnier: "Location saisonnière",
    bail_mobilite: "Bail mobilité",
    commercial_3_6_9: "Bail commercial 3/6/9",
    professionnel: "Bail professionnel",
    contrat_parking: "Contrat de parking",
  };
  return types[type] || type;
}

/**
 * Remplace les variables dans le template
 * Gère les conditions imbriquées en traitant de l'intérieur vers l'extérieur
 */
function replaceVariables(
  template: string,
  variables: Record<string, string | number | boolean>
): string {
  let result = template;

  // Fonction pour traiter une passe de conditions
  const processConditions = (text: string): string => {
    let processed = text;
    
    // 1. Remplacer les conditions {{#if VAR}}...{{else}}...{{/if}} (avec else)
    // Utilise une regex non-greedy qui ne capture pas les {{#if}} imbriqués
    const ifElseRegex = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{else\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;
    processed = processed.replace(ifElseRegex, (match, varName, ifContent, elseContent) => {
      const value = variables[varName];
      return value ? ifContent : elseContent;
    });

    // 2. Remplacer les conditions {{#if VAR}}...{{/if}} (sans else)
    const ifRegex = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;
    processed = processed.replace(ifRegex, (match, varName, content) => {
      const value = variables[varName];
      return value ? content : "";
    });

    // 3. Remplacer les conditions {{#unless VAR}}...{{/unless}}
    const unlessRegex = /\{\{#unless\s+(\w+)\}\}((?:(?!\{\{#unless)[\s\S])*?)\{\{\/unless\}\}/g;
    processed = processed.replace(unlessRegex, (match, varName, content) => {
      const value = variables[varName];
      return !value ? content : "";
    });

    return processed;
  };

  // Traiter les conditions de manière itérative (pour gérer les imbrications)
  let previousResult = "";
  let iterations = 0;
  const maxIterations = 10; // Sécurité contre les boucles infinies
  
  while (result !== previousResult && iterations < maxIterations) {
    previousResult = result;
    result = processConditions(result);
    iterations++;
  }

  // Remplacer les variables simples {{VAR}}
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, String(value ?? ""));
  });

  return result;
}

/**
 * Génère le HTML complet d'un EDL
 */
export function generateEDLHTML(edl: EDLComplet): string {
  const variables = mapEDLToTemplateVariables(edl);
  return replaceVariables(EDL_TEMPLATE, variables as unknown as Record<string, string | number | boolean>);
}

/**
 * Génère le HTML du template vierge à imprimer
 */
export function generateEDLViergeHTML(
  edl: Partial<EDLComplet>,
  rooms: string[] = [
    "Entrée",
    "Salon / Séjour",
    "Cuisine",
    "Chambre 1",
    "Chambre 2",
    "Salle de bain",
    "WC",
  ]
): string {
  const variables: Record<string, string | number | boolean> = {
    EDL_TYPE_LABEL: edl.type === "sortie" ? "DE SORTIE" : "D'ENTRÉE",
    DATE_EDL: edl.scheduled_date
      ? formatDate(edl.scheduled_date)
      : new Date().toLocaleDateString("fr-FR"),
    DATE_CREATION: new Date().toLocaleDateString("fr-FR"),
    EDL_REFERENCE:
      edl.reference || `EDL-${Date.now().toString(36).toUpperCase()}`,
    BAILLEUR_NOM_COMPLET: edl.bailleur?.nom_complet || "",
    BAILLEUR_ADRESSE: edl.bailleur?.adresse || "",
    BAILLEUR_TELEPHONE: edl.bailleur?.telephone || "",
    BAILLEUR_EMAIL: edl.bailleur?.email || "",
    BAILLEUR_REPRESENTANT: (edl.bailleur as any)?.representant || "",
    LOCATAIRES_NOM_COMPLET:
      edl.locataires?.map((l) => `${l.prenom} ${l.nom}`).join(", ") || "",
    LOCATAIRES_TELEPHONE: edl.locataires?.[0]?.telephone || "",
    LOCATAIRES_EMAIL: edl.locataires?.[0]?.email || "",
    LOGEMENT_ADRESSE: edl.logement?.adresse_complete || "",
    LOGEMENT_CODE_POSTAL: edl.logement?.code_postal || "",
    LOGEMENT_VILLE: edl.logement?.ville || "",
    LOGEMENT_TYPE: edl.logement?.type_bien || "",
    LOGEMENT_SURFACE: edl.logement?.surface?.toString() || "",
    LOGEMENT_NB_PIECES: edl.logement?.nb_pieces?.toString() || "",
    LOGEMENT_ETAGE: edl.logement?.etage || "",
    OBSERVATIONS_GENERALES: edl.observations_generales || "",
    COMPTEURS_HTML: (edl.compteurs && edl.compteurs.length > 0)
      ? edl.compteurs.map(c => `
          <tr>
            <td>${METER_TYPE_LABELS[c.type] || c.type} ${METER_TYPE_ICONS[c.type] || ''}</td>
            <td>${c.meter_number || ''}</td>
            <td></td>
            <td>${c.unit}</td>
          </tr>`).join('')
      : `
          <tr><td>Électricité ⚡</td><td></td><td></td><td>kWh</td></tr>
          <tr><td>Gaz 🔥</td><td></td><td></td><td>m³</td></tr>
          <tr><td>Eau froide 💧</td><td></td><td></td><td>m³</td></tr>
          <tr><td>Eau chaude 🚿</td><td></td><td></td><td>m³</td></tr>
        `,
    PIECES_VIERGES_HTML: generateEmptyRoomsHTML(rooms),
  };

  return replaceVariables(EDL_TEMPLATE_VIERGE, variables);
}

/**
 * Valide qu'un EDL est complet pour la génération
 */
export function validateEDLForGeneration(edl: EDLComplet): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Vérifications obligatoires
  if (!edl.logement.adresse_complete) {
    errors.push("L'adresse du logement est obligatoire");
  }

  if (!edl.bailleur.nom_complet && !edl.bailleur.raison_sociale) {
    errors.push("Le nom du bailleur est obligatoire");
  }

  if (edl.locataires.length === 0) {
    errors.push("Au moins un locataire est requis");
  }

  if (edl.pieces.length === 0) {
    errors.push("Au moins une pièce doit être inspectée");
  }

  // Avertissements
  if (edl.compteurs.length === 0) {
    warnings.push("Aucun relevé de compteur n'a été saisi");
  }

  // Vérifier que toutes les pièces ont des éléments évalués
  edl.pieces.forEach((piece) => {
    const unevaluated = piece.items.filter((item) => !item.condition);
    if (unevaluated.length > 0) {
      warnings.push(
        `${unevaluated.length} élément(s) non évalué(s) dans "${piece.nom}"`
      );
    }
  });

  if (!edl.cles_remises || edl.cles_remises.length === 0) {
    warnings.push("Aucune clé n'a été enregistrée");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export default {
  generateEDLHTML,
  generateEDLViergeHTML,
  mapEDLToTemplateVariables,
  validateEDLForGeneration,
};

