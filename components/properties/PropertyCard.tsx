"use client";

import { memo } from "react";
import Link from "next/link";
import { Home, MapPin, Ruler, Users, Calendar, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SmartImageCard } from "@/components/ui/smart-image-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

export interface PropertyCardProps {
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    type: string;
    surface?: number;
    nb_pieces?: number;
    loyer_hc?: number;
    photos?: { url: string; is_main?: boolean }[];
    status?: "vacant" | "rented" | "pending";
  };
  activeLease?: {
    id: string;
    date_fin?: string;
    tenant_name?: string;
  } | null;
  entityName?: string | null;
  href?: string;
  className?: string;
  onClick?: () => void;
}

// Labels des types de propriétés
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  parking: "Parking",
  commercial: "Commercial",
  bureau: "Bureau",
  colocation: "Colocation",
};

// ============================================
// PropertyCard - Full card (grid view, all screens)
// ============================================
export const PropertyCard = memo(function PropertyCard({
  property,
  activeLease,
  entityName,
  href,
  className,
  onClick,
}: PropertyCardProps) {
  const mainPhoto = property.photos?.find((p) => p.is_main)?.url || property.photos?.[0]?.url;
  const status = activeLease ? "rented" : "vacant";

  const content = (
    <Card
      className={cn(
        "group overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-0 bg-white dark:bg-slate-900",
        className
      )}
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <SmartImageCard
          src={mainPhoto}
          alt={property.adresse_complete}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Badges overlay */}
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge className="bg-white/90 backdrop-blur-sm text-slate-900 border-0 shadow-sm">
            {PROPERTY_TYPE_LABELS[property.type] || property.type}
          </Badge>
        </div>

        <div className="absolute top-3 right-3">
          <StatusBadge
            status={status === "rented" ? "Loué" : "Vacant"}
            type={status === "rented" ? "success" : "neutral"}
          />
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4 space-y-3">
        {/* Address */}
        <div>
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
            {property.adresse_complete}
          </h3>
          <div className="flex items-center text-muted-foreground text-sm mt-1">
            <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" />
            <span className="line-clamp-1">
              {property.code_postal} {property.ville}
            </span>
          </div>
        </div>

        {/* Entity badge */}
        {entityName && (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-xs text-indigo-600 font-medium truncate">{entityName}</span>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {property.surface && (
            <div className="flex items-center gap-1">
              <Ruler className="h-4 w-4" />
              <span>{property.surface} m²</span>
            </div>
          )}
          {property.nb_pieces && (
            <div className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              <span>{property.nb_pieces} p.</span>
            </div>
          )}
        </div>

        {/* Rent & Tenant Info */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            {property.loyer_hc ? (
              <div className="font-semibold text-lg">
                {formatCurrency(property.loyer_hc)}
                <span className="text-xs text-muted-foreground font-normal">/mois</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Loyer non défini</span>
            )}
          </div>

          {activeLease && (
            <div className="text-right text-xs text-muted-foreground">
              {activeLease.tenant_name && (
                <div className="flex items-center gap-1 justify-end">
                  <Users className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{activeLease.tenant_name}</span>
                </div>
              )}
              {activeLease.date_fin && (
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <Calendar className="h-3 w-3" />
                  <span>Fin: {formatDateShort(activeLease.date_fin)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
});

// ============================================
// PropertyCardCompact - Horizontal compact card (list view)
// ============================================
export const PropertyCardCompact = memo(function PropertyCardCompact({
  property,
  activeLease,
  href,
  className,
  onClick,
}: PropertyCardProps) {
  const mainPhoto = property.photos?.find((p) => p.is_main)?.url || property.photos?.[0]?.url;
  const status = activeLease ? "rented" : "vacant";

  const content = (
    <Card
      className={cn(
        "group flex overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer border",
        className
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative w-24 h-24 shrink-0 overflow-hidden">
        <SmartImageCard
          src={mainPhoto}
          alt={property.adresse_complete}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
              {property.adresse_complete}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {property.code_postal} {property.ville}
            </p>
          </div>
          <StatusBadge
            status={status === "rented" ? "Loué" : "Vacant"}
            type={status === "rented" ? "success" : "neutral"}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{PROPERTY_TYPE_LABELS[property.type] || property.type}</span>
            {property.surface && <span>{property.surface} m²</span>}
          </div>
          {property.loyer_hc && (
            <span className="font-semibold text-sm">
              {formatCurrency(property.loyer_hc)}/mois
            </span>
          )}
        </div>
      </div>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
});

// ============================================
// PropertyCardTableRow - Desktop table row variant
// ============================================
export const PropertyCardTableRow = memo(function PropertyCardTableRow({
  property,
  activeLease,
  href,
  className,
  onClick,
}: PropertyCardProps) {
  const mainPhoto = property.photos?.find((p) => p.is_main)?.url || property.photos?.[0]?.url;
  const status = activeLease ? "rented" : "vacant";

  const content = (
    <div
      className={cn(
        "group flex items-center gap-4 p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800",
        "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer",
        "min-h-[64px]",
        className
      )}
      onClick={onClick}
      role="row"
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
        <SmartImageCard
          src={mainPhoto}
          alt={property.adresse_complete}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Address */}
      <div className="flex-1 min-w-0" role="cell">
        <p className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
          {property.adresse_complete}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {property.code_postal} {property.ville}
        </p>
      </div>

      {/* Type */}
      <div className="hidden lg:block w-28 shrink-0 text-sm text-muted-foreground" role="cell">
        {PROPERTY_TYPE_LABELS[property.type] || property.type}
      </div>

      {/* Surface */}
      <div className="hidden lg:flex items-center gap-1 w-20 shrink-0 text-sm text-muted-foreground" role="cell">
        {property.surface && (
          <>
            <Ruler className="h-3.5 w-3.5" />
            <span>{property.surface} m²</span>
          </>
        )}
      </div>

      {/* Rooms */}
      <div className="hidden xl:flex items-center gap-1 w-16 shrink-0 text-sm text-muted-foreground" role="cell">
        {property.nb_pieces && (
          <>
            <Home className="h-3.5 w-3.5" />
            <span>{property.nb_pieces} p.</span>
          </>
        )}
      </div>

      {/* Rent */}
      <div className="w-28 shrink-0 text-right" role="cell">
        {property.loyer_hc ? (
          <span className="font-semibold text-sm">
            {formatCurrency(property.loyer_hc)}
            <span className="text-xs text-muted-foreground font-normal">/mois</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </div>

      {/* Tenant */}
      <div className="hidden md:block w-32 shrink-0 text-right text-xs text-muted-foreground" role="cell">
        {activeLease?.tenant_name && (
          <div className="flex items-center gap-1 justify-end">
            <Users className="h-3 w-3" />
            <span className="truncate max-w-[100px]">{activeLease.tenant_name}</span>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="w-20 shrink-0 flex justify-end" role="cell">
        <StatusBadge
          status={status === "rented" ? "Loué" : "Vacant"}
          type={status === "rented" ? "success" : "neutral"}
        />
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
});

// ============================================
// PropertyListResponsive - Responsive container
// Mobile: cards (PropertyCard)
// Desktop: table rows (PropertyCardTableRow)
// ============================================
interface PropertyListResponsiveProps {
  properties: PropertyCardProps["property"][];
  activeLeases?: Record<string, PropertyCardProps["activeLease"]>;
  hrefBuilder?: (property: PropertyCardProps["property"]) => string;
  onPropertyClick?: (property: PropertyCardProps["property"]) => void;
  className?: string;
  /** Force a specific view mode (overrides responsive behavior) */
  viewMode?: "card" | "compact" | "table";
}

export const PropertyListResponsive = memo(function PropertyListResponsive({
  properties,
  activeLeases = {},
  hrefBuilder,
  onPropertyClick,
  className,
  viewMode,
}: PropertyListResponsiveProps) {
  if (properties.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">Aucun bien trouvé</p>
        <p className="text-sm mt-1">Essayez de modifier vos filtres</p>
      </div>
    );
  }

  // Forced card view
  if (viewMode === "card") {
    return (
      <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", className)}>
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            activeLease={activeLeases[property.id]}
            href={hrefBuilder?.(property)}
            onClick={onPropertyClick ? () => onPropertyClick(property) : undefined}
          />
        ))}
      </div>
    );
  }

  // Forced compact view
  if (viewMode === "compact") {
    return (
      <div className={cn("space-y-2", className)}>
        {properties.map((property) => (
          <PropertyCardCompact
            key={property.id}
            property={property}
            activeLease={activeLeases[property.id]}
            href={hrefBuilder?.(property)}
            onClick={onPropertyClick ? () => onPropertyClick(property) : undefined}
          />
        ))}
      </div>
    );
  }

  // Forced table view
  if (viewMode === "table") {
    return (
      <div className={cn("border rounded-lg overflow-hidden", className)} role="table">
        <TableHeader />
        <div role="rowgroup">
          {properties.map((property) => (
            <PropertyCardTableRow
              key={property.id}
              property={property}
              activeLease={activeLeases[property.id]}
              href={hrefBuilder?.(property)}
              onClick={onPropertyClick ? () => onPropertyClick(property) : undefined}
            />
          ))}
        </div>
      </div>
    );
  }

  // Default: responsive — cards on mobile, table on desktop
  return (
    <div className={className}>
      {/* Mobile: card grid */}
      <div className="md:hidden grid gap-3 grid-cols-1 sm:grid-cols-2">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            activeLease={activeLeases[property.id]}
            href={hrefBuilder?.(property)}
            onClick={onPropertyClick ? () => onPropertyClick(property) : undefined}
          />
        ))}
      </div>

      {/* Desktop: table rows */}
      <div className="hidden md:block border rounded-lg overflow-hidden" role="table">
        <TableHeader />
        <div role="rowgroup">
          {properties.map((property) => (
            <PropertyCardTableRow
              key={property.id}
              property={property}
              activeLease={activeLeases[property.id]}
              href={hrefBuilder?.(property)}
              onClick={onPropertyClick ? () => onPropertyClick(property) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

/** Table header row for desktop table view */
function TableHeader() {
  return (
    <div
      className="flex items-center gap-4 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider"
      role="row"
    >
      <div className="w-12 shrink-0" role="columnheader" aria-label="Photo" />
      <div className="flex-1 min-w-0" role="columnheader">Adresse</div>
      <div className="hidden lg:block w-28 shrink-0" role="columnheader">Type</div>
      <div className="hidden lg:block w-20 shrink-0" role="columnheader">Surface</div>
      <div className="hidden xl:block w-16 shrink-0" role="columnheader">Pièces</div>
      <div className="w-28 shrink-0 text-right" role="columnheader">Loyer</div>
      <div className="hidden md:block w-32 shrink-0 text-right" role="columnheader">Locataire</div>
      <div className="w-20 shrink-0 text-right" role="columnheader">Statut</div>
    </div>
  );
}

export default PropertyCard;
