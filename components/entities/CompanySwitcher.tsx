"use client";

/**
 * CompanySwitcher — Sélecteur d'entité dans la sidebar
 *
 * Permet de changer l'entité active pour filtrer le dashboard.
 * - null = "Toutes les entités"
 * - entityId = vue filtrée
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEntityStore } from "@/stores/useEntityStore";
import { Building2, Check, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getEntityIcon, getEntityTypeLabel } from "@/lib/entities/entity-constants";

interface CompanySwitcherProps {
  variant?: "sidebar" | "compact";
}

export function CompanySwitcher({ variant = "sidebar" }: CompanySwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { entities, activeEntityId, setActiveEntity } = useEntityStore();

  // Don't render if no entities
  if (entities.length === 0) return null;

  const activeEntity = activeEntityId
    ? entities.find((e) => e.id === activeEntityId)
    : null;

  const totalProperties = entities.reduce(
    (sum, e) => sum + e.propertyCount,
    0
  );

  const handleSelect = (id: string | null) => {
    setActiveEntity(id);
    setOpen(false);
  };

  if (variant === "compact") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 px-2 h-8 text-xs font-medium"
            aria-label="Changer d'entité"
          >
            {activeEntity ? (
              <>
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[100px]">
                  {activeEntity.nom}
                </span>
              </>
            ) : (
              <>
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span>Toutes</span>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <EntityList
            entities={entities}
            activeEntityId={activeEntityId}
            totalProperties={totalProperties}
            onSelect={handleSelect}
            onNavigate={(path) => {
              setOpen(false);
              router.push(path);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-3 w-full rounded-lg border border-border/50 bg-muted/30 p-3",
            "hover:bg-muted/50 transition-colors text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="Changer d'entité"
        >
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: activeEntity?.couleur
                ? `${activeEntity.couleur}20`
                : "hsl(var(--muted))",
            }}
          >
            {activeEntity ? (
              <Building2
                className="h-4 w-4"
                style={{ color: activeEntity.couleur || undefined }}
              />
            ) : (
              <Building2 className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {activeEntity?.nom || "Toutes les entités"}
            </p>
            <p className="text-xs text-muted-foreground">
              {activeEntity
                ? getEntityTypeLabel(activeEntity.entityType)
                : `${entities.length} entité${entities.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" sideOffset={4}>
        <EntityList
          entities={entities}
          activeEntityId={activeEntityId}
          totalProperties={totalProperties}
          onSelect={handleSelect}
          onNavigate={(path) => {
            setOpen(false);
            router.push(path);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// EntityList — Contenu du popover
// ============================================

interface EntityListProps {
  entities: Array<{
    id: string;
    nom: string;
    entityType: string;
    propertyCount: number;
    couleur: string | null;
  }>;
  activeEntityId: string | null;
  totalProperties: number;
  onSelect: (id: string | null) => void;
  onNavigate: (path: string) => void;
}

function EntityList({
  entities,
  activeEntityId,
  totalProperties,
  onSelect,
  onNavigate,
}: EntityListProps) {
  return (
    <div className="space-y-1">
      {/* Toutes les entités */}
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "flex items-center gap-3 w-full rounded-md px-2 py-2 text-sm transition-colors",
          activeEntityId === null
            ? "bg-primary/10 text-primary"
            : "hover:bg-muted"
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 text-left min-w-0">
          <p className="font-medium truncate">Toutes les entités</p>
          <p className="text-xs text-muted-foreground">
            {totalProperties} bien{totalProperties > 1 ? "s" : ""}
          </p>
        </div>
        {activeEntityId === null && (
          <Check className="h-4 w-4 shrink-0 text-primary" />
        )}
      </button>

      <Separator />

      {/* Liste des entités */}
      {entities.map((entity) => {
        const Icon = getEntityIcon(entity.entityType);
        const isActive = activeEntityId === entity.id;

        return (
          <button
            key={entity.id}
            onClick={() => onSelect(entity.id)}
            className={cn(
              "flex items-center gap-3 w-full rounded-md px-2 py-2 text-sm transition-colors",
              isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}
          >
            <div
              className="h-7 w-7 rounded flex items-center justify-center shrink-0"
              style={{
                backgroundColor: entity.couleur
                  ? `${entity.couleur}20`
                  : "hsl(var(--muted))",
              }}
            >
              <Icon
                className="h-3.5 w-3.5"
                style={{ color: entity.couleur || undefined }}
              />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium truncate">{entity.nom}</p>
              <p className="text-xs text-muted-foreground">
                {getEntityTypeLabel(entity.entityType, true)}
                {entity.propertyCount > 0 &&
                  ` · ${entity.propertyCount} bien${entity.propertyCount > 1 ? "s" : ""}`}
              </p>
            </div>
            {isActive && (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            )}
          </button>
        );
      })}

      <Separator />

      {/* Actions */}
      <button
        onClick={() => onNavigate("/owner/entities/new")}
        className="flex items-center gap-3 w-full rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span>Ajouter une entité</span>
      </button>
      <button
        onClick={() => onNavigate("/owner/entities")}
        className="flex items-center gap-3 w-full rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Settings className="h-4 w-4" />
        <span>Gérer mes entités</span>
      </button>
    </div>
  );
}
