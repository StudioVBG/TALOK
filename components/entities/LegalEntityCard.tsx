"use client";

/**
 * LegalEntityCard - Carte d'affichage d'une entité juridique
 * Avec menu d'actions (modifier, supprimer, définir par défaut)
 * SOTA 2026
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
  Building2,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LegalEntityWithStats } from "@/lib/types/legal-entity";
import {
  ENTITY_TYPE_LABELS,
  FISCAL_REGIME_LABELS,
  ENTITIES_REQUIRING_SIRET,
} from "@/lib/types/legal-entity";

interface LegalEntityCardProps {
  entity: LegalEntityWithStats;
  isDefault?: boolean;
  onSetDefault?: (entityId: string) => Promise<void>;
  onDelete?: (entityId: string) => Promise<void>;
}

export function LegalEntityCard({
  entity,
  isDefault = false,
  onSetDefault,
  onDelete,
}: LegalEntityCardProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  // Determine if SIRET is required for this entity type
  const requiresSiret = ENTITIES_REQUIRING_SIRET.includes(entity.entity_type);

  // Display name - never show UUID
  const displayName = entity.nom && !entity.nom.includes("-") && entity.nom.length > 10
    ? entity.nom
    : entity.nom || `${ENTITY_TYPE_LABELS[entity.entity_type]} (nom à compléter)`;

  // Check if name needs attention (contains UUID pattern)
  const needsNameUpdate = entity.nom?.match(/[0-9a-f]{8}-[0-9a-f]{4}/i) ||
                          entity.nom?.startsWith("Entité de");

  const handleCardClick = () => {
    router.push(`/owner/entities/${entity.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/owner/entities/${entity.id}/edit`);
  };

  const handleSetDefault = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSetDefault) return;
    setIsSettingDefault(true);
    try {
      await onSetDefault(entity.id);
    } finally {
      setIsSettingDefault(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(entity.id);
      setDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card
        className={cn(
          "relative group cursor-pointer transition-all duration-200",
          "hover:border-blue-300 hover:shadow-md",
          isDefault && "border-blue-500 bg-blue-50/30"
        )}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Entity name and badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg truncate">{displayName}</h3>
                {isDefault && (
                  <Badge variant="default" className="bg-blue-600 text-xs">
                    Par défaut
                  </Badge>
                )}
              </div>
              {/* Entity type and fiscal regime */}
              <p className="text-sm text-muted-foreground mt-1">
                {ENTITY_TYPE_LABELS[entity.entity_type]} · {FISCAL_REGIME_LABELS[entity.regime_fiscal]}
              </p>
              {/* Warning for name needing update */}
              {needsNameUpdate && (
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Nom à personnaliser
                </p>
              )}
            </div>

            {/* Actions menu - stop propagation to prevent card click */}
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier
                  </DropdownMenuItem>
                  {!isDefault && onSetDefault && (
                    <DropdownMenuItem
                      onClick={handleSetDefault}
                      disabled={isSettingDefault}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      {isSettingDefault ? "En cours..." : "Définir par défaut"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDialogOpen(true);
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* SIRET display */}
          {entity.siret && (
            <p className="text-sm font-mono text-slate-600">
              SIRET {entity.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4")}
            </p>
          )}

          {/* Stats */}
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-lg font-semibold">{entity.properties_count}</p>
                <p className="text-xs text-muted-foreground">
                  bien{entity.properties_count !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-lg font-semibold">{entity.active_leases}</p>
                <p className="text-xs text-muted-foreground">
                  ba{entity.active_leases !== 1 ? "ux" : "il"}
                </p>
              </div>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex flex-wrap gap-2">
            {/* SIRET indicator - only show if required */}
            {requiresSiret && (
              entity.siret ? (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  SIRET Renseigné
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  SIRET Manquant
                </Badge>
              )
            )}

            {/* IBAN indicator - always relevant */}
            {entity.iban ? (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                IBAN Configuré
              </Badge>
            ) : (
              <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                <AlertCircle className="h-3 w-3 mr-1" />
                IBAN Non configuré
              </Badge>
            )}
          </div>

          {/* View detail link */}
          <div className="flex justify-end pt-2 border-t">
            <span className="text-sm text-slate-400 group-hover:text-blue-500 flex items-center gap-1 transition-colors">
              Voir le détail
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette entité ?</AlertDialogTitle>
            <AlertDialogDescription>
              {entity.properties_count > 0 || entity.active_leases > 0 ? (
                <>
                  <span className="text-red-600 font-medium">Attention :</span> Cette
                  entité a {entity.properties_count} bien(s) et {entity.active_leases}{" "}
                  bail(aux) associé(s). Vous devez d'abord les transférer vers une
                  autre entité.
                </>
              ) : (
                <>
                  Cette action est irréversible. L'entité "{displayName}" sera
                  définitivement supprimée.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || entity.properties_count > 0 || entity.active_leases > 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
