"use client";

/**
 * EntityCard — Carte résumé d'une entité juridique
 *
 * - Toute la carte est cliquable (lien vers la fiche détail)
 * - Menu contextuel (...) avec actions rapides Modifier / Supprimer
 * - Suppression avec confirmation (AlertDialog)
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  User,
  Users,
  ArrowUpDown,
  Check,
  AlertCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useEntityStore, type LegalEntitySummary } from "@/stores/useEntityStore";
import { deleteEntity } from "@/app/owner/entities/actions";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  particulier: "Personnel",
  sci_ir: "SCI · IR",
  sci_is: "SCI · IS",
  sci_construction_vente: "SCCV",
  sarl: "SARL",
  sarl_famille: "SARL de famille",
  eurl: "EURL",
  sas: "SAS",
  sasu: "SASU",
  sa: "SA",
  snc: "SNC",
  indivision: "Indivision",
  demembrement_usufruit: "Usufruit",
  demembrement_nue_propriete: "Nue-propriété",
  holding: "Holding",
};

function getEntityIcon(entityType: string) {
  if (entityType === "particulier") return User;
  if (entityType === "indivision") return Users;
  if (entityType.startsWith("demembrement")) return ArrowUpDown;
  return Building2;
}

interface EntityCardProps {
  entity: LegalEntitySummary;
  isActive?: boolean;
}

export function EntityCard({ entity, isActive }: EntityCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { removeEntity } = useEntityStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const Icon = getEntityIcon(entity.entityType);
  const typeLabel = ENTITY_TYPE_LABELS[entity.entityType] || entity.entityType;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteEntity({ id: entity.id });
      if (result.success) {
        removeEntity(entity.id);
        toast({
          title: "Entité supprimée",
          description: `${entity.nom} a été supprimée.`,
        });
      } else {
        toast({
          title: "Suppression impossible",
          description: result.error || "Une erreur est survenue.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'entité.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card
        className={cn(
          "relative transition-all hover:shadow-md group cursor-pointer",
          isActive && "ring-2 ring-primary"
        )}
      >
        {/* Clickable card link */}
        <Link
          href={`/owner/entities/${entity.id}`}
          className="absolute inset-0 z-0"
          aria-label={`Voir ${entity.nom}`}
        />

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

            {/* Actions dropdown — above the card link */}
            <div className="relative z-10 flex items-center gap-1">
              {entity.isDefault && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Par défaut
                </Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/owner/entities/${entity.id}`);
                    }}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Voir la fiche
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/owner/entities/${entity.id}/edit`);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      setShowDeleteDialog(true);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
          <div className="space-y-1.5">
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
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette entité ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer <strong>{entity.nom}</strong>.
              Cette action est irréversible. Les associés liés seront également
              supprimés. Si l&apos;entité possède encore des biens, la suppression
              sera refusée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
