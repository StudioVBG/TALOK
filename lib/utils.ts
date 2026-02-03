import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Re-export common format utilities for convenience
export { formatCurrency, formatDate } from "@/lib/helpers/format";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats d'image acceptés pour l'upload
 */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Valide les fichiers image et retourne les fichiers valides et invalides
 */
export function validateImageFiles(files: FileList | File[]): {
  valid: File[];
  invalid: File[];
  invalidTypes: string[];
} {
  const fileArray = Array.from(files);
  const valid: File[] = [];
  const invalid: File[] = [];
  const invalidTypesSet = new Set<string>();

  fileArray.forEach(file => {
    if (ACCEPTED_IMAGE_TYPES.includes(file.type as any)) {
      valid.push(file);
    } else {
      invalid.push(file);
      invalidTypesSet.add(file.type || file.name.split('.').pop() || 'inconnu');
    }
  });

  return {
    valid,
    invalid,
    invalidTypes: Array.from(invalidTypesSet),
  };
}

