"use client";

/**
 * EntitySelector — Sélecteur d'entité pour les formulaires (LeaseWizard, EDL, etc.)
 *
 * Permet de choisir sous quelle entité juridique un document sera signé.
 * - null = profil personnel (owner_profiles fallback)
 * - entityId = entité juridique spécifique
 *
 * P1-8: Peut filtrer les entités par bien sélectionné (propertyEntityId)
 */

import { useMemo } from "react";
import { useEntityStore } from "@/stores/useEntityStore";
import { Building2, User, AlertCircle, Star } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getEntityTypeLabel } from "@/lib/entities/entity-constants";

// Entités de type "particulier" n'ont pas besoin de SIRET
const ENTITIES_WITHOUT_SIRET = ["particulier"];

interface EntitySelectorProps {
  /** Currently selected entity ID (null = personal profile) */
  value: string | null;
  /** Callback when selection changes */
  onChange: (entityId: string | null) => void;
  /** Label above the selector */
  label?: string;
  /** Additional hint text */
  hint?: string;
  /** Show warning if no entity with SIRET */
  warnMissingSiret?: boolean;
  /** Disable the selector */
  disabled?: boolean;
  /** P1-8: Entity ID that owns the selected property — shown first with a star */
  propertyEntityId?: string | null;
  /** CSS class */
  className?: string;
}

export function EntitySelector({
  value,
  onChange,
  label = "Entité signataire",
  hint,
  warnMissingSiret = false,
  disabled = false,
  propertyEntityId,
  className,
}: EntitySelectorProps) {
  const { entities, isLoading } = useEntityStore();

  // P1-8: Sort entities — property owner entity first, then alphabetical
  const sortedEntities = useMemo(() => {
    if (!propertyEntityId) return entities;
    return [...entities].sort((a, b) => {
      if (a.id === propertyEntityId) return -1;
      if (b.id === propertyEntityId) return 1;
      return a.nom.localeCompare(b.nom);
    });
  }, [entities, propertyEntityId]);

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <label className="text-sm font-medium leading-none">{label}</label>
        )}
        <div className="h-11 rounded-md border border-input bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <label className="text-sm font-medium leading-none">{label}</label>
        )}
        <div className="flex items-center gap-2 h-11 px-3 rounded-md border border-input bg-muted/30 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>Profil personnel</span>
        </div>
        {hint && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }

  const selectedEntity = value
    ? entities.find((e) => e.id === value)
    : null;

  const showSiretWarning =
    warnMissingSiret &&
    selectedEntity &&
    !selectedEntity.siret &&
    !ENTITIES_WITHOUT_SIRET.includes(selectedEntity.entityType);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium leading-none">{label}</label>
      )}
      <Select
        value={value || "__personal__"}
        onValueChange={(v) => onChange(v === "__personal__" ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger className="h-11">
          <SelectValue placeholder="Sélectionner une entité" />
        </SelectTrigger>
        <SelectContent>
          {/* Personal profile option */}
          <SelectItem value="__personal__">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Profil personnel</span>
            </div>
          </SelectItem>

          {/* Entity options — P1-8: property owner entity shown first */}
          {sortedEntities.map((entity) => {
            const typeLabel = getEntityTypeLabel(entity.entityType, true);
            const isPropertyOwner = entity.id === propertyEntityId;
            return (
              <SelectItem key={entity.id} value={entity.id}>
                <div className="flex items-center gap-2">
                  <Building2
                    className="h-4 w-4 shrink-0"
                    style={{ color: entity.couleur || undefined }}
                  />
                  <span className="truncate">{entity.nom}</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 ml-1"
                  >
                    {typeLabel}
                  </Badge>
                  {isPropertyOwner && (
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* P1-8: Hint when selecting a different entity than the property owner */}
      {propertyEntityId && value && value !== propertyEntityId && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            Cette entité ne possède pas ce bien. Vérifiez que le choix est correct.
          </span>
        </div>
      )}

      {showSiretWarning && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            SIRET manquant pour cette entité.{" "}
            <a
              href={`/owner/entities/${value}`}
              className="underline hover:no-underline"
            >
              Compléter
            </a>
          </span>
        </div>
      )}

      {hint && !showSiretWarning && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
