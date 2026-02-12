/**
 * Dictionnaire de traductions centralisé — SOTA 2026
 *
 * Architecture:
 * - Langue par défaut : fr (français)
 * - Extensible : ajouter une clé de langue (en, es, pt) pour supporter d'autres langues
 * - Usage : import { t } from "@/lib/i18n/translations"
 *           t("lease.status.active") → "Actif"
 *
 * Ce module NE modifie PAS les routes ni les composants existants.
 * Il centralise les chaînes de caractères pour faciliter la migration i18n future.
 */

type TranslationKey = string;
type TranslationValue = string;
type TranslationMap = Record<TranslationKey, TranslationValue>;

const fr: TranslationMap = {
  // ======== Statuts de bail ========
  "lease.status.draft": "Brouillon",
  "lease.status.pending_signature": "Signature en attente",
  "lease.status.partially_signed": "Partiellement signé",
  "lease.status.fully_signed": "Signé - EDL requis",
  "lease.status.active": "Actif",
  "lease.status.terminated": "Terminé",
  "lease.status.archived": "Archivé",
  "lease.status.cancelled": "Annulé",
  "lease.status.notice_given": "Congé donné",

  // ======== Types de bail ========
  "lease.type.nu": "Habitation (nu)",
  "lease.type.meuble": "Habitation (meublé)",
  "lease.type.colocation": "Colocation",
  "lease.type.saisonnier": "Saisonnier",
  "lease.type.bail_mobilite": "Bail Mobilité",
  "lease.type.contrat_parking": "Parking",
  "lease.type.commercial_3_6_9": "Commercial 3/6/9",
  "lease.type.commercial_derogatoire": "Commercial dérogatoire",
  "lease.type.professionnel": "Professionnel",
  "lease.type.location_gerance": "Location-gérance",
  "lease.type.etudiant": "Bail étudiant",

  // ======== Progression du bail ========
  "lease.progress.title": "Progression du bail",
  "lease.progress.signature": "Signatures",
  "lease.progress.signature.done": "Locataire et propriétaire ont signé",
  "lease.progress.signature.in_progress": "En attente de signatures",
  "lease.progress.signature.pending": "Les deux parties doivent signer",
  "lease.progress.edl": "État des lieux",
  "lease.progress.edl.done": "État des lieux signé",
  "lease.progress.edl.in_progress": "EDL à compléter et signer",
  "lease.progress.edl.pending": "L'EDL sera créé après signature",
  "lease.progress.payment": "1er paiement",
  "lease.progress.payment.done": "Premier versement reçu",
  "lease.progress.payment.in_progress": "En attente du paiement initial",
  "lease.progress.payment.pending": "Loyer + charges + dépôt de garantie",
  "lease.progress.keys": "Remise des clés",
  "lease.progress.keys.done": "Le locataire est installé !",
  "lease.progress.keys.in_progress": "Prêt pour la remise des clés",
  "lease.progress.keys.pending": "Étape finale",
  "lease.progress.complete": "Bail actif - Tout est en ordre !",

  // ======== EDL (État des lieux) ========
  "edl.type.entree": "Entrée",
  "edl.type.sortie": "Sortie",
  "edl.status.draft": "Brouillon",
  "edl.status.scheduled": "Planifié",
  "edl.status.in_progress": "En cours",
  "edl.status.completed": "Terminé",
  "edl.status.signed": "Signé",
  "edl.status.disputed": "Contesté",
  "edl.condition.neuf": "Neuf",
  "edl.condition.bon": "Bon état",
  "edl.condition.moyen": "État moyen",
  "edl.condition.mauvais": "Mauvais état",
  "edl.condition.tres_mauvais": "Très mauvais état",
  "edl.photos.title": "Photos de l'inspection",
  "edl.photos.empty": "Aucune photo",
  "edl.photos.empty_description": "Ajoutez des photos pour documenter l'état de chaque pièce",
  "edl.photos.add": "Ajouter des photos",
  "edl.meters.electricity": "Électricité",
  "edl.meters.gas": "Gaz",
  "edl.meters.water": "Eau",
  "edl.meters.recorded": "Relevé effectué",
  "edl.meters.pending": "À relever",

  // ======== Paiements ========
  "payment.status.pending": "En attente",
  "payment.status.succeeded": "Payé",
  "payment.status.paid": "Payé",
  "payment.status.failed": "Échoué",
  "payment.status.refunded": "Remboursé",
  "payment.method.cb": "Carte bancaire",
  "payment.method.virement": "Virement",
  "payment.method.prelevement": "Prélèvement",
  "payment.method.especes": "Espèces",
  "payment.method.cheque": "Chèque",

  // ======== Relances ========
  "reminder.level.amiable": "Relance amiable",
  "reminder.level.formelle": "Relance formelle",
  "reminder.level.mise_en_demeure": "Mise en demeure",

  // ======== Navigation ========
  "nav.dashboard": "Tableau de bord",
  "nav.properties": "Biens",
  "nav.leases": "Baux & locataires",
  "nav.money": "Loyers & finances",
  "nav.documents": "Documents",
  "nav.tickets": "Tickets",
  "nav.inspections": "États des lieux",
  "nav.tenants": "Locataires",
  "nav.profile": "Profil",
  "nav.help": "Aide",

  // ======== Actions communes ========
  "action.create": "Créer",
  "action.edit": "Modifier",
  "action.delete": "Supprimer",
  "action.save": "Enregistrer",
  "action.cancel": "Annuler",
  "action.confirm": "Confirmer",
  "action.search": "Rechercher",
  "action.export": "Exporter",
  "action.download": "Télécharger",
  "action.print": "Imprimer",
  "action.sign": "Signer",
  "action.send": "Envoyer",
  "action.back": "Retour",
  "action.view": "Voir",
  "action.close": "Fermer",

  // ======== Messages ========
  "message.success": "Succès",
  "message.error": "Erreur",
  "message.loading": "Chargement...",
  "message.no_data": "Aucune donnée",
  "message.confirm_delete": "Êtes-vous sûr de vouloir supprimer ?",
  "message.irreversible": "Cette action est irréversible.",
};

// Langue active (extensible pour le futur)
let currentLocale: "fr" = "fr";
const translations: Record<string, TranslationMap> = { fr };

/**
 * Traduit une clé en utilisant la langue courante.
 * Retourne la clé elle-même si aucune traduction n'est trouvée.
 *
 * @example
 * t("lease.status.active") // → "Actif"
 * t("lease.type.nu")       // → "Habitation (nu)"
 */
export function t(key: string): string {
  return translations[currentLocale]?.[key] ?? key;
}

/**
 * Change la langue active.
 * Prévu pour l'extension future (en, es, pt, etc.).
 */
export function setLocale(locale: "fr"): void {
  currentLocale = locale;
}

/**
 * Retourne la langue active.
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Retourne toutes les traductions pour une catégorie donnée.
 * Utile pour les selects/dropdowns.
 *
 * @example
 * getTranslationsByPrefix("lease.type")
 * // → { "nu": "Habitation (nu)", "meuble": "Habitation (meublé)", ... }
 */
export function getTranslationsByPrefix(prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  const dict = translations[currentLocale] || {};
  const prefixDot = prefix + ".";

  for (const [key, value] of Object.entries(dict)) {
    if (key.startsWith(prefixDot)) {
      result[key.slice(prefixDot.length)] = value;
    }
  }

  return result;
}
