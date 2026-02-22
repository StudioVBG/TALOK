"use client";

/**
 * EntityCard — Carte résumé d'une entité juridique
 */

import Link from "next/link";
import { Building2, Check, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LegalEntitySummary } from "@/stores/useEntityStore";
import { ENTITY_TYPE_LABELS, getEntityIcon } from "@/lib/entities/entity-constants";

interface EntityCardProps {
  entity: LegalEntitySummary;
  isActive?: boolean;
}

export function EntityCard({ entity, isActive }: EntityCardProps) {
  const Icon = getEntityIcon(entity.entityType);
  const typeLabel = ENTITY_TYPE_LABELS[entity.entityType] || entity.entityType;
  const hasWarnings = !entity.hasIban || !entity.siret;

  return (
    <Card
      className={cn(
        "relative transition-all hover:shadow-md",
        isActive && "ring-2 ring-primary"
      )}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: entity.couleur
                ? `${entity.couleur}20`
                : "hsl(var(--muted))",
            }}
          >
            <Icon
              className="h-5 w-5"
              style={{ color: entity.couleur || undefined }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{entity.nom}</h3>
            <p className="text-sm text-muted-foreground">{typeLabel}</p>
          </div>
          {entity.isDefault && (
            <Badge variant="secondary" className="text-xs shrink-0">
              Par défaut
            </Badge>
          )}
        </div>

        {/* Info */}
        <div className="space-y-2 mb-4">
          {entity.siret && (
            <p className="text-xs text-muted-foreground font-mono">
              SIRET {entity.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4")}
            </p>
          )}
          {entity.villeSiege && (
            <p className="text-xs text-muted-foreground">
              {entity.codePostalSiege} {entity.villeSiege}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-muted/50 rounded-md p-2 text-center">
            <p className="text-lg font-bold">{entity.propertyCount}</p>
            <p className="text-xs text-muted-foreground">
              bien{entity.propertyCount > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex-1 bg-muted/50 rounded-md p-2 text-center">
            <p className="text-lg font-bold">{entity.activeLeaseCount}</p>
            <p className="text-xs text-muted-foreground">
              ba{entity.activeLeaseCount > 1 ? "ux" : "il"}
            </p>
          </div>
        </div>

        {/* Status indicators */}
        <div className="space-y-1.5 mb-4">
          <StatusRow
            label="IBAN"
            ok={entity.hasIban}
            okLabel="Configuré"
            koLabel="Non configuré"
          />
          <StatusRow
            label="SIRET"
            ok={!!entity.siret}
            okLabel="Renseigné"
            koLabel="Manquant"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/owner/entities/${entity.id}`}>Gérer</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  ok,
  okLabel,
  koLabel,
}: {
  label: string;
  ok: boolean;
  okLabel: string;
  koLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <Check className="h-3 w-3 text-green-600 shrink-0" />
      ) : (
        <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
      )}
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "ml-auto font-medium",
          ok ? "text-green-600" : "text-amber-500"
        )}
      >
        {ok ? okLabel : koLabel}
      </span>
    </div>
  );
}

/**
 * EntityCardSkeleton — Loading state
 */
export function EntityCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <div className="h-3 w-40 bg-muted rounded animate-pulse" />
          <div className="h-3 w-28 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-3 mb-4">
          <div className="flex-1 h-16 bg-muted rounded-md animate-pulse" />
          <div className="flex-1 h-16 bg-muted rounded-md animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * AddEntityCard — Carte "Ajouter une entité"
 */
export function AddEntityCard() {
  return (
    <Link href="/owner/entities/new">
      <Card className="border-dashed hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer h-full">
        <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full min-h-[240px]">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <p className="font-medium text-sm">Ajouter une entité</p>
          <p className="text-xs text-muted-foreground mt-1">
            SCI, SARL, SAS, indivision...
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
