"use client";

/**
 * Page de gestion des entités juridiques
 * /owner/entities
 * SOTA 2026
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/ui/page-transition";
import { Plus, Building2, Loader2 } from "lucide-react";
import { LegalEntityCard } from "@/components/entities/LegalEntityCard";
import type { LegalEntityWithStats } from "@/lib/types/legal-entity";

export default function EntitiesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [entities, setEntities] = useState<LegalEntityWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultEntityId, setDefaultEntityId] = useState<string | null>(null);

  // Fetch entities
  const loadEntities = useCallback(async () => {
    try {
      const response = await fetch("/api/owner/legal-entities?stats=true");
      if (!response.ok) {
        throw new Error("Erreur lors du chargement des entités");
      }
      const data = await response.json();
      setEntities(data.entities || []);

      // TODO: Get default entity from owner_profiles or a setting
      // For now, use the first entity as default
      if (data.entities?.length > 0) {
        setDefaultEntityId(data.entities[0].id);
      }
    } catch (error) {
      console.error("Error loading entities:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les entités juridiques",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  // Handle set default
  const handleSetDefault = async (entityId: string) => {
    try {
      // TODO: Implement API call to set default entity
      setDefaultEntityId(entityId);
      toast({
        title: "Entité par défaut",
        description: "L'entité a été définie comme entité par défaut",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de définir l'entité par défaut",
        variant: "destructive",
      });
    }
  };

  // Handle delete
  const handleDelete = async (entityId: string) => {
    try {
      const response = await fetch(`/api/owner/legal-entities/${entityId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      setEntities((prev) => prev.filter((e) => e.id !== entityId));
      toast({
        title: "Entité supprimée",
        description: "L'entité juridique a été supprimée avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer l'entité",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["owner"]}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Mes entités juridiques
              </h1>
              <p className="text-muted-foreground mt-1">
                Gérez vos structures juridiques (SCI, SARL, etc.) et leurs biens associés
              </p>
            </div>
            <Button
              onClick={() => router.push("/owner/entities/new")}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nouvelle entité
            </Button>
          </div>

          {/* Entities grid or empty state */}
          {entities.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Aucune entité juridique"
              description="Créez votre première entité pour organiser vos biens par structure juridique (SCI, SARL, etc.)"
              action={{
                label: "Créer une entité",
                href: "/owner/entities/new",
              }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {entities.map((entity) => (
                <LegalEntityCard
                  key={entity.id}
                  entity={entity}
                  isDefault={entity.id === defaultEntityId}
                  onSetDefault={handleSetDefault}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Stats summary */}
          {entities.length > 0 && (
            <div className="mt-8 p-4 bg-slate-50 rounded-xl border">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-slate-900">{entities.length}</span>{" "}
                entité{entities.length !== 1 ? "s" : ""} ·{" "}
                <span className="font-medium text-slate-900">
                  {entities.reduce((sum, e) => sum + e.properties_count, 0)}
                </span>{" "}
                bien{entities.reduce((sum, e) => sum + e.properties_count, 0) !== 1 ? "s" : ""} au total ·{" "}
                <span className="font-medium text-slate-900">
                  {entities.reduce((sum, e) => sum + e.active_leases, 0)}
                </span>{" "}
                ba{entities.reduce((sum, e) => sum + e.active_leases, 0) !== 1 ? "ux" : "il"} actif{entities.reduce((sum, e) => sum + e.active_leases, 0) !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </PageTransition>
    </ProtectedRoute>
  );
}
