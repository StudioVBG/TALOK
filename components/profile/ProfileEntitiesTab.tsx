"use client";

/**
 * ProfileEntitiesTab — Onglet Entités du profil
 *
 * Affiche les entités juridiques du propriétaire via le composant EntityCard partagé.
 * Auto-déclenche le fetch si les données ne sont pas encore chargées.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EntityCard } from "@/components/entities/EntityCard";
import { useEntityStore } from "@/stores/useEntityStore";
import { useAuth } from "@/lib/hooks/use-auth";

export function ProfileEntitiesTab() {
  const { entities, isLoading, fetchEntities, lastFetchedAt, activeEntityId } =
    useEntityStore();
  const { profile, loading: authLoading } = useAuth();
  const hasFetched = useRef(false);

  // Auto-fetch entities when tab is shown, if not already loaded
  useEffect(() => {
    if (authLoading || !profile?.id || hasFetched.current) return;

    const isStale = !lastFetchedAt || Date.now() - lastFetchedAt > 5 * 60 * 1000;
    if (entities.length === 0 || isStale) {
      hasFetched.current = true;
      fetchEntities(profile.id);
    }
  }, [authLoading, profile?.id, entities.length, lastFetchedAt, fetchEntities]);

  if (authLoading || isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entities.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            Aucune entité juridique
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Créez votre première entité juridique (SCI, SARL, SAS...) pour
            séparer vos biens et simplifier votre gestion locative.
          </p>
          <Button asChild>
            <Link href="/owner/entities/new">
              <Plus className="h-4 w-4 mr-2" />
              Créer une entité
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {entities.length} entité{entities.length > 1 ? "s" : ""} juridique
          {entities.length > 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/owner/entities/new">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle entité
          </Link>
        </Button>
      </div>

      <div className="grid gap-3">
        {entities.map((entity) => (
          <EntityCard
            key={entity.id}
            entity={entity}
            isActive={activeEntityId === entity.id}
            compact
          />
        ))}
      </div>

      <div className="pt-2">
        <Button variant="ghost" size="sm" asChild className="w-full">
          <Link href="/owner/entities">Voir toutes les entités</Link>
        </Button>
      </div>
    </div>
  );
}
