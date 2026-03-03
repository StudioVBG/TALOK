"use client";

/**
 * EntitiesPageClient — Client component for the entities list page
 * Includes search and type-based filtering.
 */

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { EntityCard, AddEntityCard } from "@/components/entities/EntityCard";
import { useEntityStore, type LegalEntitySummary } from "@/stores/useEntityStore";
import { ENTITY_TYPE_LABELS } from "@/lib/entities/entity-constants";
import { cn } from "@/lib/utils";
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
  const { entities: storeEntities, activeEntityId, lastFetchedAt } = useEntityStore();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  // Use store entities if recently fetched (within 30s), otherwise use server data
  const STALE_THRESHOLD = 30_000; // 30 seconds
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
      couleur: e.couleur || null,
      propertyCount: 0,
      activeLeaseCount: 0,
      hasIban: !!e.iban,
    }));
  }, [storeEntities, serverEntities, storeIsFresh]);

  // Filtered entities
  const filteredEntities = useMemo(() => {
    let result: LegalEntitySummary[] = allEntities;

    // Apply type filter
    if (activeFilter !== "all") {
      const group = FILTER_GROUPS.find((g) => g.key === activeFilter);
      if (group?.types) {
        result = result.filter((e) => group.types!.includes(e.entityType));
      }
    }

    // Apply search
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

        {/* Empty state */}
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
        <Button asChild>
          <Link href="/owner/entities/new">
            <Building2 className="h-4 w-4 mr-2" />
            Ajouter une entité
          </Link>
        </Button>
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
          />
        ))}
        <AddEntityCard />
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
    </div>
  );
}
