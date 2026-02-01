"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Landmark,
  Plus,
  Building2,
  Euro,
  ChevronRight,
  Shield,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";
import {
  ENTITY_TYPE_LABELS,
  FISCAL_REGIME_LABELS,
  ENTITY_TYPE_COLORS,
} from "@/lib/types/legal-entity";
import type { LegalEntityType, FiscalRegime } from "@/lib/types/legal-entity";

interface EntityItem {
  id: string;
  entity_type: string;
  nom: string;
  nom_commercial?: string | null;
  siren?: string | null;
  siret?: string | null;
  ville_siege?: string | null;
  forme_juridique?: string | null;
  capital_social?: number | null;
  regime_fiscal: string;
  is_active: boolean;
  created_at: string;
  properties_count: number;
  monthly_rent: number;
}

interface EntitiesClientProps {
  entities: EntityItem[];
  ownerType: string;
}

export function EntitiesClient({ entities, ownerType }: EntitiesClientProps) {
  const activeEntities = entities.filter((e) => e.is_active);
  const inactiveEntities = entities.filter((e) => !e.is_active);

  const totalProperties = entities.reduce((sum, e) => sum + e.properties_count, 0);
  const totalRent = entities.reduce((sum, e) => sum + e.monthly_rent, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mes entités</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos structures juridiques (SCI, SARL, etc.)
          </p>
        </div>
        <Button asChild>
          <Link href="/owner/entities/new">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle entité
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Landmark className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{activeEntities.length}</p>
                <p className="text-[11px] text-muted-foreground">Entités actives</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{totalProperties}</p>
                <p className="text-[11px] text-muted-foreground">Biens détenus</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Euro className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(totalRent)}</p>
                <p className="text-[11px] text-muted-foreground">Loyers mensuels</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Shield className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {entities.filter((e) => e.regime_fiscal === "is").length}
                </p>
                <p className="text-[11px] text-muted-foreground">À l'IS</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {entities.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Aucune entité juridique"
          description="Ajoutez vos SCI, SARL ou autres structures pour organiser la gestion de votre patrimoine."
          action={{
            label: "Créer une entité",
            href: "/owner/entities/new",
          }}
        />
      ) : (
        <div className="space-y-4">
          {/* Active entities */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeEntities.map((entity) => (
              <EntityCard key={entity.id} entity={entity} />
            ))}
          </div>

          {/* Inactive entities */}
          {inactiveEntities.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Entités inactives ({inactiveEntities.length})
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inactiveEntities.map((entity) => (
                  <EntityCard key={entity.id} entity={entity} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntityCard({ entity }: { entity: EntityItem }) {
  const typeLabel = ENTITY_TYPE_LABELS[entity.entity_type as LegalEntityType] || entity.entity_type;
  const fiscalLabel = FISCAL_REGIME_LABELS[entity.regime_fiscal as FiscalRegime] || entity.regime_fiscal;
  const color = ENTITY_TYPE_COLORS[entity.entity_type as LegalEntityType] || "#6366f1";

  return (
    <Card className={`hover:shadow-md transition-shadow ${!entity.is_active ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: color }}
            >
              {entity.nom.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-sm">{entity.nom}</p>
              <p className="text-xs text-muted-foreground">{typeLabel}</p>
            </div>
          </div>
          {!entity.is_active && (
            <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500">
              Inactive
            </Badge>
          )}
        </div>

        <div className="space-y-2 text-sm">
          {entity.siret && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">SIRET</span>
              <span className="font-mono text-xs">{entity.siret}</span>
            </div>
          )}
          {entity.ville_siege && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Siège</span>
              <span>{entity.ville_siege}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Régime fiscal</span>
            <Badge variant="outline" className="text-[10px]">{fiscalLabel}</Badge>
          </div>
          {entity.capital_social && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Capital</span>
              <span>{formatCurrency(entity.capital_social)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {entity.properties_count} bien{entity.properties_count !== 1 ? "s" : ""}
            </span>
            {entity.monthly_rent > 0 && (
              <span className="flex items-center gap-1">
                <Euro className="h-3 w-3" />
                {formatCurrency(entity.monthly_rent)}/mois
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
            <Link href={`/owner/entities/${entity.id}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
