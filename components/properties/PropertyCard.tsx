"use client";

import { memo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Home, MapPin, Ruler, BedDouble, Users, Euro, Calendar, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SmartImageCard } from "@/components/ui/smart-image-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

interface PropertyCardProps {
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

// Composant PropertyCard mémorisé pour éviter les re-renders inutiles
export const PropertyCard = memo(function PropertyCard({
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

// Composant pour une version compacte (liste)
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

export default PropertyCard;



