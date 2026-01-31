"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageLoadingProps {
  /** Message optionnel sous le spinner */
  message?: string;
  /** Taille du spinner */
  size?: "sm" | "md" | "lg";
  /** Classes CSS additionnelles */
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

/**
 * Composant de chargement de page réutilisable
 * Utilisé dans les fichiers loading.tsx de Next.js
 *
 * @example
 * // app/owner/properties/loading.tsx
 * export { PageLoading as default } from "@/components/ui/page-loading"
 *
 * @example
 * // Avec message personnalisé
 * <PageLoading message="Chargement de vos biens..." />
 */
export function PageLoading({
  message = "Chargement...",
  size = "md",
  className,
}: PageLoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[400px] gap-4",
        className
      )}
    >
      <Loader2
        className={cn("animate-spin text-primary", sizeClasses[size])}
      />
      {message && (
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      )}
    </div>
  );
}

export default PageLoading;
