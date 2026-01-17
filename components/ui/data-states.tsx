"use client";

/**
 * Unified Data States Components
 *
 * Usage:
 * import { LoadingState, EmptyState, ErrorState } from "@/components/ui/data-states";
 *
 * // Loading
 * if (loading) return <LoadingState message="Chargement des données..." />;
 *
 * // Error
 * if (error) return <ErrorState error={error} onRetry={refetch} />;
 *
 * // Empty
 * if (data.length === 0) return <EmptyState title="Aucune donnée" />;
 */

import { ReactNode } from "react";
import { LucideIcon, Loader2, Inbox, AlertCircle, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Re-export existing components for convenience
export { EmptyState } from "@/components/ui/empty-state";
export { ErrorState } from "@/components/ui/error-state";
export { Skeleton } from "@/components/ui/skeleton";

// =============================================================================
// LoadingState - Composant de chargement avec plusieurs variantes
// =============================================================================

interface LoadingStateProps {
  /** Message affiché pendant le chargement */
  message?: string;
  /** Variante d'affichage */
  variant?: "spinner" | "skeleton" | "dots" | "minimal";
  /** Nombre de squelettes à afficher (pour variant="skeleton") */
  skeletonCount?: number;
  /** Hauteur des squelettes */
  skeletonHeight?: string;
  /** Classes CSS additionnelles */
  className?: string;
  /** Afficher en plein écran */
  fullScreen?: boolean;
}

export function LoadingState({
  message = "Chargement...",
  variant = "spinner",
  skeletonCount = 3,
  skeletonHeight = "h-20",
  className,
  fullScreen = false,
}: LoadingStateProps) {
  const prefersReducedMotion = useReducedMotion();

  const containerClasses = cn(
    "flex flex-col items-center justify-center",
    fullScreen ? "min-h-screen" : "py-12",
    className
  );

  if (variant === "skeleton") {
    return (
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className={cn("w-full", skeletonHeight)} />
        ))}
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{message}</span>
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div className={containerClasses}>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-3 w-3 rounded-full bg-primary"
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      y: [0, -10, 0],
                      opacity: [0.5, 1, 0.5],
                    }
              }
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
        {message && (
          <p className="mt-4 text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    );
  }

  // Default: spinner
  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      className={containerClasses}
    >
      <div className="relative">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl" />
        <div className="relative bg-background p-4 rounded-full shadow-sm ring-1 ring-border">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
      {message && (
        <motion.p
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-sm text-muted-foreground"
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  );
}

// =============================================================================
// DataStateWrapper - Wrapper intelligent pour gérer loading/error/empty
// =============================================================================

interface DataStateWrapperProps<T> {
  /** Données à afficher */
  data: T[] | null | undefined;
  /** État de chargement */
  loading?: boolean;
  /** Erreur éventuelle */
  error?: Error | string | null;
  /** Fonction de réessai en cas d'erreur */
  onRetry?: () => void;
  /** Configuration de l'état vide */
  emptyState?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
      label: string;
      onClick?: () => void;
      href?: string;
    };
  };
  /** Message de chargement */
  loadingMessage?: string;
  /** Variante de chargement */
  loadingVariant?: LoadingStateProps["variant"];
  /** Contenu à afficher quand les données sont disponibles */
  children: ReactNode;
  /** Classes CSS additionnelles */
  className?: string;
}

export function DataStateWrapper<T>({
  data,
  loading = false,
  error = null,
  onRetry,
  emptyState = { title: "Aucune donnée" },
  loadingMessage = "Chargement...",
  loadingVariant = "skeleton",
  children,
  className,
}: DataStateWrapperProps<T>) {
  // Loading state
  if (loading) {
    return (
      <LoadingState
        message={loadingMessage}
        variant={loadingVariant}
        className={className}
      />
    );
  }

  // Error state
  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      <Card className={cn("border-destructive/20 bg-destructive/5", className)}>
        <CardContent className="flex flex-col items-center justify-center py-12 px-6">
          <div className="bg-destructive/10 rounded-full p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Une erreur est survenue</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            {errorMessage}
          </p>
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Réessayer
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    const Icon = emptyState.icon || Inbox;
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center text-center p-8 rounded-lg border border-dashed bg-muted/30",
          className
        )}
      >
        <div className="bg-background p-4 rounded-full shadow-sm ring-1 ring-border mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{emptyState.title}</h3>
        {emptyState.description && (
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            {emptyState.description}
          </p>
        )}
        {emptyState.action && (
          <Button
            onClick={emptyState.action.onClick}
            variant="default"
            size="sm"
            asChild={!!emptyState.action.href}
          >
            {emptyState.action.href ? (
              <a href={emptyState.action.href}>{emptyState.action.label}</a>
            ) : (
              emptyState.action.label
            )}
          </Button>
        )}
      </div>
    );
  }

  // Data available - render children
  return <>{children}</>;
}

// =============================================================================
// Utility: getErrorMessage - Extraction type-safe du message d'erreur
// =============================================================================

/**
 * Extrait un message d'erreur de manière type-safe
 *
 * @example
 * catch (error: unknown) {
 *   toast({ description: getErrorMessage(error) });
 * }
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Une erreur inattendue est survenue";
}
