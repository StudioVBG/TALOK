"use client";

/**
 * EntitySelector — Sélecteur d'entité pour les formulaires (LeaseWizard, EDL, etc.)
 *
 * Permet de choisir sous quelle entité juridique un document sera signé.
 * - null = profil personnel (owner_profiles fallback)
 * - entityId = entité juridique spécifique
 */

import { useEntityStore } from "@/stores/useEntityStore";
import { Building2, User, ChevronDown, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  className,
}: EntitySelectorProps) {
  const { entities, isLoading } = useEntityStore();

  // If no entities loaded yet or only 1, don't show selector
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

  // If no entities at all, show personal profile only
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
    warnMissingSiret && selectedEntity && !selectedEntity.siret;

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

          {/* Entity options */}
          {entities.map((entity) => {
            const typeLabel =
              ENTITY_TYPE_LABELS[entity.entityType] || entity.entityType;
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
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

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
