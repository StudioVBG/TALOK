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
  const { data: properties = [], isLoading, error, isError } = useProperties();
  const deleteProperty = useDeleteProperty();

  // Debug logs
  console.log("[PropertiesList] State:", {
    propertiesCount: properties.length,
    isLoading,
    isError,
    error: error?.message,
    properties,
  });

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
      } catch (error: unknown) {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Impossible de supprimer le logement.",
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

  if (error || isError) {
    console.error("[PropertiesList] Error:", error);
    return (
      <div className="text-center py-12 space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Erreur lors du chargement</h3>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : "Erreur inconnue"}
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => window.location.reload()}>Réessayer</Button>
          <Link href="/owner/property/new">
            <Button variant="outline">Créer un logement</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-12 space-y-6">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">Aucun logement enregistré</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Commencez par ajouter votre premier logement pour gérer vos locations.
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <Link href="/owner/property/new">
            <Button size="lg" className="gap-2">
              <span>+</span>
              Ajouter mon premier logement
            </Button>
          </Link>
        </div>
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
        {paginatedProperties.map((property: any) => (
            <PropertyCard
              key={property.id}
              property={property}
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

