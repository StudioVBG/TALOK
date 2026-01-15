"use client";

/**
 * Composant de contrôles de pagination
 * 
 * Affiche les contrôles de navigation pour les listes paginées.
 * Compatible avec usePaginatedQuery.
 */

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  isLoading?: boolean;
  className?: string;
  showPageSizeSelector?: boolean;
  showTotalCount?: boolean;
  compact?: boolean;
}

export function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
  hasNextPage,
  hasPrevPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  isLoading = false,
  className,
  showPageSizeSelector = true,
  showTotalCount = true,
  compact = false,
}: PaginationControlsProps) {
  // Calculer les pages à afficher
  const getVisiblePages = () => {
    const delta = compact ? 1 : 2;
    const range: (number | "...")[] = [];
    
    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) {
      range.unshift("...");
    }
    if (page + delta < totalPages - 1) {
      range.push("...");
    }

    if (totalPages > 1) {
      range.unshift(1);
    }
    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  };

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4",
        className
      )}
    >
      {/* Info et sélecteur de taille */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {showTotalCount && (
          <span>
            {total > 0 ? (
              <>
                {startItem}-{endItem} sur {total} résultat{total > 1 ? "s" : ""}
              </>
            ) : (
              "Aucun résultat"
            )}
          </span>
        )}

        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Afficher</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden sm:inline">par page</span>
          </div>
        )}
      </div>

      {/* Contrôles de navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* Première page */}
          {!compact && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(1)}
              disabled={!hasPrevPage || isLoading}
              title="Première page"
              aria-label="Première page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Page précédente */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPrevPage || isLoading}
            title="Page précédente"
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Numéros de page */}
          <div className="flex items-center gap-1">
            {getVisiblePages().map((pageNum, idx) =>
              pageNum === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-muted-foreground"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "default" : "outline"}
                  size="icon"
                  className={cn(
                    "h-8 w-8",
                    pageNum === page && "pointer-events-none"
                  )}
                  onClick={() => onPageChange(pageNum as number)}
                  disabled={isLoading}
                >
                  {pageNum}
                </Button>
              )
            )}
          </div>

          {/* Page suivante */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNextPage || isLoading}
            title="Page suivante"
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Dernière page */}
          {!compact && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(totalPages)}
              disabled={!hasNextPage || isLoading}
              title="Dernière page"
              aria-label="Dernière page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default PaginationControls;

