"use client";

import { useMemo, useCallback } from "react";
import { PropertyCard } from "./property-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useProperties, useDeleteProperty } from "@/lib/hooks";
import { usePagination } from "@/lib/hooks/use-pagination";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PropertiesListSkeleton } from "@/components/skeletons/properties-list-skeleton";
import Link from "next/link";

export function PropertiesList() {
  const { toast } = useToast();
  
  // Utilisation du hook React Query avec cache automatique
  const { data: properties = [], isLoading, error } = useProperties();
  const deleteProperty = useDeleteProperty();

  const pagination = usePagination({
    totalItems: properties.length,
    itemsPerPage: 12,
  });

  const paginatedProperties = useMemo(() => {
    return properties.slice(pagination.startIndex, pagination.endIndex);
  }, [properties, pagination.startIndex, pagination.endIndex]);

  const handleRemove = useCallback(
    async (id: string) => {
      try {
        await deleteProperty.mutateAsync(id);
        toast({
          title: "Logement supprimé",
          description: "Le logement a été supprimé avec succès.",
        });
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de supprimer le logement.",
          variant: "destructive",
        });
      }
    },
    [deleteProperty, toast]
  );

  const handleRefresh = useCallback(() => {
    // React Query invalide automatiquement le cache après les mutations
    // Pas besoin de refetch manuel
  }, []);

  if (isLoading) {
    return <PropertiesListSkeleton />;
  }

  if (error) {
    console.error("[PropertiesList] Error:", error);
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          Erreur lors du chargement : {error instanceof Error ? error.message : "Erreur inconnue"}
        </p>
        <div className="space-y-2">
          <Button onClick={() => window.location.reload()}>Réessayer</Button>
          <Button 
            variant="outline" 
            onClick={() => {
              console.log("Debug info:", {
                error,
                profile: "Vérifiez la console pour le profil"
              });
            }}
          >
            Debug
          </Button>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Aucun logement enregistré.</p>
        <Link href="/properties/new">
          <Button>Ajouter un logement</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Mes logements ({properties.length})</h2>
        <Link href="/properties/new">
          <Button>Ajouter un logement</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paginatedProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property as any}
              onRefresh={handleRefresh}
              onRemove={handleRemove}
            />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={pagination.previousPage}
                className={!pagination.canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => pagination.goToPage(page)}
                  isActive={page === pagination.currentPage}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={pagination.nextPage}
                className={!pagination.canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

