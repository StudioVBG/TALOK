import { z } from "zod";

/**
 * Zod Error Map - Messages d'erreur en français
 *
 * Ce fichier définit les messages d'erreur personnalisés en français
 * pour toutes les validations Zod de l'application.
 *
 * Utilisation :
 * Importer et appliquer globalement dans le layout ou un provider
 *
 * @example
 * import { zodErrorMapFR } from "@/lib/validations/zod-error-map"
 * z.setErrorMap(zodErrorMapFR)
 */

export const zodErrorMapFR: z.ZodErrorMap = (issue, ctx) => {
  let message: string;

  switch (issue.code) {
    // Types de base
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        message = "Ce champ est requis";
      } else {
        message = `Format invalide. Attendu : ${getTypeLabel(issue.expected)}, reçu : ${getTypeLabel(issue.received)}`;
      }
      break;

    // Chaînes de caractères
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        if (issue.minimum === 1) {
          message = "Ce champ ne peut pas être vide";
        } else {
          message = `Minimum ${issue.minimum} caractère${issue.minimum > 1 ? "s" : ""}`;
        }
      } else if (issue.type === "number") {
        message = `La valeur doit être supérieure ou égale à ${issue.minimum}`;
      } else if (issue.type === "array") {
        message = `Au moins ${issue.minimum} élément${issue.minimum > 1 ? "s" : ""} requis`;
      } else {
        message = `Valeur trop petite`;
      }
      break;

    case z.ZodIssueCode.too_big:
      if (issue.type === "string") {
        message = `Maximum ${issue.maximum} caractère${issue.maximum > 1 ? "s" : ""}`;
      } else if (issue.type === "number") {
        message = `La valeur doit être inférieure ou égale à ${issue.maximum}`;
      } else if (issue.type === "array") {
        message = `Maximum ${issue.maximum} élément${issue.maximum > 1 ? "s" : ""}`;
      } else {
        message = `Valeur trop grande`;
      }
      break;

    // Email
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") {
        message = "Adresse email invalide";
      } else if (issue.validation === "url") {
        message = "URL invalide";
      } else if (issue.validation === "uuid") {
        message = "Identifiant invalide";
      } else if (issue.validation === "regex") {
        message = "Format invalide";
      } else if (issue.validation === "datetime") {
        message = "Date et heure invalides";
      } else {
        message = "Format de texte invalide";
      }
      break;

    // Nombres
    case z.ZodIssueCode.not_multiple_of:
      message = `La valeur doit être un multiple de ${issue.multipleOf}`;
      break;

    case z.ZodIssueCode.not_finite:
      message = "La valeur doit être un nombre fini";
      break;

    // Enum
    case z.ZodIssueCode.invalid_enum_value:
      message = `Valeur non autorisée. Options : ${issue.options.join(", ")}`;
      break;

    // Literal
    case z.ZodIssueCode.invalid_literal:
      message = `Valeur attendue : ${JSON.stringify(issue.expected)}`;
      break;

    // Union
    case z.ZodIssueCode.invalid_union:
      message = "Aucun format valide trouvé";
      break;

    case z.ZodIssueCode.invalid_union_discriminator:
      message = `Type non reconnu. Options : ${issue.options.join(", ")}`;
      break;

    // Arguments de fonction
    case z.ZodIssueCode.invalid_arguments:
      message = "Arguments de fonction invalides";
      break;

    case z.ZodIssueCode.invalid_return_type:
      message = "Type de retour invalide";
      break;

    // Date
    case z.ZodIssueCode.invalid_date:
      message = "Date invalide";
      break;

    // Intersection
    case z.ZodIssueCode.invalid_intersection_types:
      message = "Types incompatibles";
      break;

    // Clés non reconnues
    case z.ZodIssueCode.unrecognized_keys:
      message = `Champ${issue.keys.length > 1 ? "s" : ""} non reconnu${issue.keys.length > 1 ? "s" : ""} : ${issue.keys.join(", ")}`;
      break;

    // Personnalisé
    case z.ZodIssueCode.custom:
      message = issue.message || "Validation échouée";
      break;

    default:
      message = ctx.defaultError;
  }

  return { message };
};

/**
 * Traduit les types Zod en français
 */
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    string: "texte",
    number: "nombre",
    bigint: "grand nombre",
    boolean: "booléen",
    date: "date",
    symbol: "symbole",
    undefined: "non défini",
    null: "null",
    array: "liste",
    object: "objet",
    function: "fonction",
    nan: "non-nombre",
    never: "jamais",
    map: "map",
    set: "ensemble",
    promise: "promesse",
  };
  return labels[type] || type;
}

/**
 * Messages d'erreur personnalisés courants
 * À utiliser avec .refine() ou dans les schemas
 */
export const errorMessages = {
  required: "Ce champ est requis",
  email: "Adresse email invalide",
  phone: "Numéro de téléphone invalide (format: 06 XX XX XX XX)",
  password: {
    min: "Le mot de passe doit contenir au moins 8 caractères",
    uppercase: "Le mot de passe doit contenir au moins une majuscule",
    lowercase: "Le mot de passe doit contenir au moins une minuscule",
    number: "Le mot de passe doit contenir au moins un chiffre",
    special: "Le mot de passe doit contenir au moins un caractère spécial",
  },
  date: {
    invalid: "Date invalide",
    future: "La date doit être dans le futur",
    past: "La date doit être dans le passé",
  },
  number: {
    positive: "La valeur doit être positive",
    integer: "La valeur doit être un nombre entier",
  },
  iban: "IBAN invalide",
  siret: "Numéro SIRET invalide (14 chiffres)",
  postalCode: "Code postal invalide",
};

/**
 * Initialise les messages d'erreur français globalement
 * À appeler une seule fois au démarrage de l'application
 */
export function initZodErrorMessages() {
  z.setErrorMap(zodErrorMapFR);
}

export default zodErrorMapFR;
