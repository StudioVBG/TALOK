"use client";

/**
 * EntitiesPageClient — Client component for the entities list page
 * Includes search, type-based filtering, bulk selection and deduplication.
 */

import { useMemo, useState } from "react";
import { Building2, Search, Trash2, CheckSquare, X, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { EntityCard, AddEntityCard } from "@/components/entities/EntityCard";
import { useEntityStore, type LegalEntitySummary } from "@/stores/useEntityStore";
import { ENTITY_TYPE_LABELS } from "@/lib/entities/entity-constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
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
import { bulkDeleteEntities, findDuplicateEntities, deduplicateEntities } from "./actions";
import { useAuth } from "@/lib/hooks/use-auth";
import type { LegalEntity } from "@/lib/types/legal-entity";

interface EntitiesPageClientProps {
  entities: LegalEntity[];
}

const FILTER_GROUPS = [
  { key: "all", label: "Toutes" },
  { key: "sci", label: "SCI", types: ["sci_ir", "sci_is", "sci_construction_vente"] },
  { key: "commercial", label: "Sociétés", types: ["sarl", "sarl_famille", "eurl", "sas", "sasu", "sa", "snc", "holding"] },
  { key: "special", label: "Spéciales", types: ["indivision", "demembrement_usufruit", "demembrement_nue_propriete"] },
  { key: "personal", label: "Personnel", types: ["particulier"] },
];

export function EntitiesPageClient({ entities: serverEntities }: EntitiesPageClientProps) {
  const { entities: storeEntities, activeEntityId, lastFetchedAt, fetchEntities, removeEntity } = useEntityStore();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Dedup state
  const [isDedupLoading, setIsDedupLoading] = useState(false);
  const [showDedupDialog, setShowDedupDialog] = useState(false);
  const [dupInfo, setDupInfo] = useState<{ groups: number; total: number } | null>(null);

  // Use store entities if recently fetched (within 30s), otherwise use server data
  const STALE_THRESHOLD = 30_000;
  const storeIsFresh = lastFetchedAt && (Date.now() - lastFetchedAt) < STALE_THRESHOLD;

  const allEntities: LegalEntitySummary[] = useMemo(() => {
    if (storeEntities.length > 0 && storeIsFresh) return storeEntities;

    return serverEntities.map((e, i) => ({
      id: e.id,
      nom: e.nom || "",
      entityType: e.entity_type || "particulier",
      legalForm: e.forme_juridique || null,
      fiscalRegime: e.regime_fiscal || null,
      siret: e.siret || null,
      codePostalSiege: e.code_postal_siege || null,
      villeSiege: e.ville_siege || null,
      isDefault: i === 0,
      isActive: e.is_active ?? true,
      status: (e.status as 'draft' | 'active' | 'archived') || 'active',
      couleur: e.couleur || null,
      propertyCount: 0,
      activeLeaseCount: 0,
      hasIban: !!e.iban,
    }));
  }, [storeEntities, serverEntities, storeIsFresh]);

  // Filtered entities
  const filteredEntities = useMemo(() => {
    let result: LegalEntitySummary[] = allEntities;

    if (activeFilter !== "all") {
      const group = FILTER_GROUPS.find((g) => g.key === activeFilter);
      if (group?.types) {
        result = result.filter((e) => group.types!.includes(e.entityType));
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((e) => {
        const label = ENTITY_TYPE_LABELS[e.entityType] || e.entityType;
        return (
          e.nom.toLowerCase().includes(q) ||
          label.toLowerCase().includes(q) ||
          (e.siret && e.siret.includes(q)) ||
          (e.villeSiege && e.villeSiege.toLowerCase().includes(q))
        );
      });
    }

    return result;
  }, [allEntities, activeFilter, search]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredEntities.map((e) => e.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const result = await bulkDeleteEntities({ ids: Array.from(selectedIds) });
      if (result.success && result.data) {
        const { deleted, deactivated, failed } = result.data;
        // Remove from store
        for (const id of [...deleted, ...deactivated]) {
          removeEntity(id);
        }
        toast({
          title: "Suppression terminée",
          description: `${deleted.length} supprimée(s), ${deactivated.length} désactivée(s)${failed.length > 0 ? `, ${failed.length} échec(s)` : ""}`,
        });
        // Refresh
        if (profile?.id) await fetchEntities(profile.id);
      } else if (!result.success) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Erreur inattendue", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
      exitSelectionMode();
    }
  };

  const handleFindDuplicates = async () => {
    setIsDedupLoading(true);
    try {
      const result = await findDuplicateEntities();
      if (result.success && result.data) {
        if (result.data.length === 0) {
          toast({ title: "Aucun doublon", description: "Aucun doublon trouvé." });
        } else {
          const totalDups = result.data.reduce((sum: number, g: { count: number }) => sum + g.count - 1, 0);
          setDupInfo({ groups: result.data.length, total: totalDups });
          setShowDedupDialog(true);
        }
      } else if (!result.success) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Erreur inattendue", variant: "destructive" });
    } finally {
      setIsDedupLoading(false);
    }
  };

  const handleDedup = async () => {
    setIsDedupLoading(true);
    try {
      const result = await deduplicateEntities();
      if (result.success && result.data) {
        toast({
          title: "Doublons supprimés",
          description: `${result.data.totalRemoved} doublon(s) supprimé(s) (${result.data.deleted} supprimé(s), ${result.data.deactivated} désactivé(s))`,
        });
        if (profile?.id) await fetchEntities(profile.id);
      } else if (!result.success) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Erreur inattendue", variant: "destructive" });
    } finally {
      setIsDedupLoading(false);
      setShowDedupDialog(false);
    }
  };

  if (allEntities.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Mes entités juridiques</h1>
            <p className="text-muted-foreground">
              Gérez vos sociétés et structures de détention
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">
            Aucune entité juridique
          </h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Créez votre première entité pour gérer vos biens via une SCI, SARL,
            SAS ou en indivision. Vos baux et quittances utiliseront
            automatiquement les informations de l&apos;entité.
          </p>
          <Button asChild>
            <Link href="/owner/entities/new">
              <Building2 className="h-4 w-4 mr-2" />
              Créer une entité
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mes entités juridiques</h1>
          <p className="text-muted-foreground">
            {allEntities.length} entité{allEntities.length > 1 ? "s" : ""} · Gérez vos sociétés et structures de détention
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!selectionMode ? (
            <>
              {allEntities.length > 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFindDuplicates}
                  disabled={isDedupLoading}
                >
                  {isDedupLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Supprimer les doublons
                </Button>
              )}
              {allEntities.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectionMode(true)}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Sélection
                </Button>
              )}
              <Button asChild>
                <Link href="/owner/entities/new">
                  <Building2 className="h-4 w-4 mr-2" />
                  Ajouter
                </Link>
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""}
              </span>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Tout
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Aucun
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer ({selectedIds.size})
              </Button>
              <Button variant="ghost" size="sm" onClick={exitSelectionMode}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      {allEntities.length > 3 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, type, SIRET, ville..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_GROUPS.map((group) => {
              const count =
                group.key === "all"
                  ? allEntities.length
                  : group.types
                    ? allEntities.filter((e) => group.types!.includes(e.entityType)).length
                    : 0;
              if (count === 0 && group.key !== "all") return null;
              return (
                <Badge
                  key={group.key}
                  variant={activeFilter === group.key ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer select-none",
                    activeFilter === group.key
                      ? ""
                      : "hover:bg-muted"
                  )}
                  onClick={() => setActiveFilter(group.key)}
                >
                  {group.label}
                  {count > 0 && (
                    <span className="ml-1 text-xs opacity-70">({count})</span>
                  )}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredEntities.map((entity) => (
          <EntityCard
            key={entity.id}
            entity={entity}
            isActive={activeEntityId === entity.id}
            selectable={selectionMode}
            selected={selectedIds.has(entity.id)}
            onToggle={toggleSelection}
          />
        ))}
        {!selectionMode && <AddEntityCard />}
      </div>

      {/* No results */}
      {filteredEntities.length === 0 && allEntities.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Aucune entité ne correspond à votre recherche.</p>
          <button
            className="text-primary text-sm mt-2 hover:underline"
            onClick={() => { setSearch(""); setActiveFilter("all"); }}
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedIds.size} entité{selectedIds.size > 1 ? "s" : ""} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les entités sans dépendances seront supprimées définitivement.
              Les entités avec des biens ou baux associés seront désactivées (suppression logique).
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? (
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

      {/* Dedup Confirmation Dialog */}
      <AlertDialog open={showDedupDialog} onOpenChange={setShowDedupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer les doublons</AlertDialogTitle>
            <AlertDialogDescription>
              {dupInfo && (
                <>
                  {dupInfo.groups} groupe{dupInfo.groups > 1 ? "s" : ""} de doublons détecté{dupInfo.groups > 1 ? "s" : ""} :
                  {" "}<strong>{dupInfo.total} entité{dupInfo.total > 1 ? "s" : ""} en doublon</strong> seront supprimées.
                  <br /><br />
                  Pour chaque groupe, la plus ancienne entité est conservée et ses doublons sont supprimés.
                  Les biens et baux éventuels sont réassignés automatiquement.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDedupLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDedup}
              disabled={isDedupLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDedupLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Nettoyage...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer les doublons
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
