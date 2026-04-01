import { TYPE_TO_LABEL } from "@/lib/documents/constants";

/**
 * Genere un titre lisible pour un document.
 * Si le type a un label connu, l'utilise. Sinon, nettoie le nom de fichier.
 */
export function getDisplayName(filename: string, type?: string | null): string {
  if (type && type in TYPE_TO_LABEL) {
    return TYPE_TO_LABEL[type as keyof typeof TYPE_TO_LABEL];
  }
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "Document";
}
