"use client";

/**
 * EntitiesPageClient — Client component for the entities list page
 */

import { useMemo } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EntityCard, AddEntityCard } from "@/components/entities/EntityCard";
import { useEntityStore, type LegalEntitySummary } from "@/stores/useEntityStore";

interface EntitiesPageClientProps {
  entities: Record<string, unknown>[];
}

export function EntitiesPageClient({ entities: serverEntities }: EntitiesPageClientProps) {
  const { entities: storeEntities, activeEntityId } = useEntityStore();

  // Prefer store entities (more up-to-date), fall back to server
  const entities: LegalEntitySummary[] = useMemo(() => {
    if (storeEntities.length > 0) return storeEntities;

    return serverEntities.map((e, i) => ({
      id: e.id as string,
      nom: (e.nom as string) || "",
      entityType: (e.entity_type as string) || "particulier",
      legalForm: (e.forme_juridique as string) || null,
      fiscalRegime: (e.regime_fiscal as string) || null,
      siret: (e.siret as string) || null,
      codePostalSiege: (e.code_postal_siege as string) || null,
      villeSiege: (e.ville_siege as string) || null,
      isDefault: i === 0,
      isActive: (e.is_active as boolean) ?? true,
      couleur: (e.couleur as string) || null,
      propertyCount: 0,
      activeLeaseCount: 0,
      hasIban: !!(e.iban as string),
    }));
  }, [storeEntities, serverEntities]);

  if (entities.length === 0) {
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
            {entities.length} entité{entities.length > 1 ? "s" : ""} · Gérez vos sociétés et structures de détention
          </p>
        </div>
        <Button asChild>
          <Link href="/owner/entities/new">
            <Building2 className="h-4 w-4 mr-2" />
            Ajouter une entité
          </Link>
        </Button>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {entities.map((entity) => (
          <EntityCard
            key={entity.id}
            entity={entity}
            isActive={activeEntityId === entity.id}
          />
        ))}
        <AddEntityCard />
      </div>
    </div>
  );
}
