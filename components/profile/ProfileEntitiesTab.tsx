"use client";

/**
 * ProfileEntitiesTab — Onglet Entités du profil
 *
 * Affiche les entités juridiques du propriétaire avec liens vers les fiches détaillées.
 * Auto-déclenche le fetch si les données ne sont pas encore chargées.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEntityStore } from "@/stores/useEntityStore";
import { useAuth } from "@/lib/hooks/use-auth";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  particulier: "Personnel",
  sci_ir: "SCI IR",
  sci_is: "SCI IS",
  sarl: "SARL",
  sarl_famille: "SARL fam.",
  eurl: "EURL",
  sas: "SAS",
  sasu: "SASU",
  sa: "SA",
  snc: "SNC",
  indivision: "Indivision",
  demembrement_usufruit: "Usufruit",
  demembrement_nue_propriete: "Nue-prop.",
  holding: "Holding",
};

export function ProfileEntitiesTab() {
  const { entities, isLoading, fetchEntities, lastFetchedAt } = useEntityStore();
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
        {entities.map((entity) => {
          const typeLabel =
            ENTITY_TYPE_LABELS[entity.entityType] || entity.entityType;
          const hasSiret = !!entity.siret;

          return (
            <Link
              key={entity.id}
              href={`/owner/entities/${entity.id}`}
              className="block"
            >
              <Card className="hover:border-primary/30 hover:shadow-sm transition-all">
                <CardContent className="flex items-center gap-4 p-4">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: entity.couleur
                        ? `${entity.couleur}20`
                        : "hsl(var(--muted))",
                    }}
                  >
                    <Building2
                      className="h-5 w-5"
                      style={{
                        color: entity.couleur || undefined,
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{entity.nom}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs">
                        {typeLabel}
                      </Badge>
                      {entity.propertyCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {entity.propertyCount} bien
                          {entity.propertyCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasSiret ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="pt-2">
        <Button variant="ghost" size="sm" asChild className="w-full">
          <Link href="/owner/entities">Voir toutes les entités</Link>
        </Button>
      </div>
    </div>
  );
}
