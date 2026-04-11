import { TYPE_TO_LABEL } from "@/lib/documents/constants";

/**
 * Lookup case-insensitive dans TYPE_TO_LABEL.
 *
 * En base, les types sont censés être stockés exactement comme dans constants.ts
 * (ex. "EDL_entree"), mais certains documents historiques utilisent la forme
 * lowercase ("edl_entree"). On résout les deux pour garantir un label lisible.
 */
function labelForType(type: string | null | undefined): string | null {
  if (!type) return null;
  if (type in TYPE_TO_LABEL) {
    return TYPE_TO_LABEL[type as keyof typeof TYPE_TO_LABEL];
  }
  const lower = type.toLowerCase();
  for (const key of Object.keys(TYPE_TO_LABEL)) {
    if (key.toLowerCase() === lower) {
      return TYPE_TO_LABEL[key as keyof typeof TYPE_TO_LABEL];
    }
  }
  return null;
}

/**
 * Génère un titre lisible pour un document.
 * Si le type a un label connu, l'utilise. Sinon, nettoie le nom de fichier.
 */
export function getDisplayName(filename: string, type?: string | null): string {
  const label = labelForType(type);
  if (label) return label;
  return cleanFilename(filename);
}

/**
 * Détecte un titre "générique" qui ne mérite pas d'être affiché tel quel.
 * Couvre "Document", "Document.pdf", "DOCUMENT", "document_1", etc. — qui
 * apparaissent quand l'upload n'a pas correctement renseigné le titre.
 */
function isGenericTitle(value: string | null | undefined): boolean {
  if (!value) return true;
  const normalized = value
    .toLowerCase()
    .replace(/\.(pdf|jpe?g|png|webp|heic|heif|doc|docx|html?|txt)$/i, "")
    .replace(/[\s_-]+\d+$/g, "")
    .trim();
  if (!normalized) return true;
  return (
    normalized === "document" ||
    normalized === "fichier" ||
    normalized === "file" ||
    normalized === "untitled" ||
    normalized === "sans titre" ||
    normalized === "sans nom"
  );
}

/**
 * Génère un titre lisible à partir d'un objet document complet.
 * Parcourt plusieurs champs candidats dans l'ordre de priorité.
 *
 * Priorité : title → display_name → original_filename → name → metadata → fallback type label
 *
 * Les titres "génériques" ("Document", "fichier.pdf", etc.) sont ignorés
 * pour éviter d'afficher une étiquette inutile à l'utilisateur.
 */
export function getDocumentDisplayName(doc: {
  title?: string | null;
  display_name?: string | null;
  original_filename?: string | null;
  name?: string | null;
  type?: string | null;
  created_at?: string | null;
  metadata?: Record<string, any> | null;
}): string {
  const candidates = [
    doc.title,
    doc.display_name,
    doc.original_filename ? cleanFilename(doc.original_filename) : null,
    doc.name,
    doc.metadata?.original_name,
    doc.metadata?.title,
  ].filter((s): s is string => !!s && s.length > 0 && !isGenericTitle(s));

  if (candidates.length > 0) {
    return cleanFilename(candidates[0]);
  }

  // Pas de titre exploitable — privilégier le label du type
  const label = labelForType(doc.type);
  if (label) {
    const date = formatSafeShortDate(doc.created_at);
    return date ? `${label} — ${date}` : label;
  }

  // Dernier recours : nom de fichier brut (même générique) ou date
  if (doc.original_filename) {
    return cleanFilename(doc.original_filename);
  }
  const date = formatSafeShortDate(doc.created_at);
  return date ? `Document — ${date}` : "Document";
}

function cleanFilename(name: string): string {
  return name
    .replace(/\.(pdf|jpg|jpeg|png|doc|docx|html?)$/i, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Document";
}

function formatSafeShortDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}
