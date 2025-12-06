"use client";

/**
 * PropertyDetailsView - Composant principal de visualisation d'une propriété
 * Architecture SOTA 2025 - Composition Pattern
 * 
 * Usage:
 * - Vue Admin: viewerRole="admin" avec showOwnerInfo={true}
 * - Vue Owner: viewerRole="owner" avec canEdit={true}
 * - Vue Tenant: viewerRole="tenant" en lecture seule
 */

import { motion } from "framer-motion";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  MapPin, 
  Edit, 
  Navigation,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Composants partagés
import { PropertyPhotosGallery } from "./PropertyPhotosGallery";
import { PropertyCharacteristics } from "./PropertyCharacteristics";
import { PropertyOccupation } from "./PropertyOccupation";
import { PropertyFinancials } from "./PropertyFinancials";
import { PropertyOwnerInfo } from "./PropertyOwnerInfo";
import { PropertyMetersSection } from "@/components/owner/properties/PropertyMetersSection";

// Types
import type { PropertyDetailsViewProps } from "./types";
import { STATUS_CONFIG, TYPE_LABELS, isParkingType } from "./types";

// Import dynamique de la carte pour éviter les erreurs SSR
const PropertyMap = dynamic(
  () => import("@/components/maps/property-map").then((mod) => mod.PropertyMap),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[200px] bg-muted/50 rounded-xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <MapPin className="h-6 w-6 animate-pulse" />
          <span className="text-sm">Chargement de la carte...</span>
        </div>
      </div>
    )
  }
);

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function PropertyDetailsView({
  // Données
  property,
  photos = [],
  lease,
  owner,
  meters,
  
  // Configuration
  viewerRole,
  
  // Visibilité des sections
  showPhotos = true,
  showMap = true,
  showCharacteristics = true,
  showOccupation = true,
  showFinancials = true,
  showMeters = true,
  showOwnerInfo = false,
  showVirtualTour = true,
  
  // Permissions
  canEdit = false,
  canDelete = false,
  canCreateLease = false,
  
  // Slots
  headerActions,
  footerActions,
  sidebarSlot,
  
  // URLs
  backHref = "/",
  backLabel = "Retour",
  editHref,
  ownerProfileHref,
  createLeaseHref,
  viewLeaseHref,
  
  // Callbacks
  onEdit,
  onDelete,
  
  className,
}: PropertyDetailsViewProps) {
  const status = STATUS_CONFIG[property.statut] || STATUS_CONFIG.vacant;
  const typeLabel = TYPE_LABELS[property.type] || property.type;
  const isParking = isParkingType(property.type);
  
  // Construire l'adresse complète pour l'affichage
  const fullAddress = `${property.adresse_complete}, ${property.code_postal} ${property.ville}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("container mx-auto px-4 py-8 max-w-7xl", className)}
    >
      {/* ========== HEADER ========== */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          asChild 
          variant="ghost" 
          className="pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground"
        >
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Link>
        </Button>

        {/* Actions header */}
        <div className="flex gap-2">
          {headerActions}
          
          {canEdit && editHref && (
            <Button asChild variant="outline">
              <Link href={editHref}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Link>
            </Button>
          )}
          
          {canEdit && onEdit && !editHref && (
            <Button variant="outline" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Button>
          )}
        </div>
      </div>

      {/* ========== BADGES STATUS (si pas de photos) ========== */}
      {!showPhotos && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Badge className={status.color}>{status.label}</Badge>
            <Badge variant="outline">{typeLabel}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{property.adresse_complete}</h1>
          <p className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {property.code_postal} {property.ville}
          </p>
        </div>
      )}

      {/* ========== GALERIE PHOTOS ========== */}
      {showPhotos && (
        <div className="mb-8">
          <PropertyPhotosGallery
            photos={photos}
            propertyType={property.type}
            address={property.adresse_complete}
            location={`${property.code_postal} ${property.ville}`}
            height="450px"
            showAddressOverlay={true}
          />
        </div>
      )}

      {/* ========== CONTENU PRINCIPAL ========== */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Colonne Gauche (2/3) */}
        <div className="md:col-span-2 space-y-6">
          {/* Caractéristiques */}
          {showCharacteristics && (
            <PropertyCharacteristics property={property} />
          )}

          {/* Carte de localisation */}
          {showMap && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-foreground">
                  <Navigation className="h-5 w-5 text-emerald-600" />
                  Localisation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PropertyMap
                  latitude={property.latitude}
                  longitude={property.longitude}
                  address={fullAddress}
                  height="220px"
                  zoom={15}
                  markerColor="primary"
                />
              </CardContent>
            </Card>
          )}

          {/* Données financières */}
          {showFinancials && (
            <PropertyFinancials property={property} />
          )}
        </div>

        {/* Colonne Droite (1/3) */}
        <div className="space-y-6">
          {/* Info propriétaire (Admin only) */}
          {showOwnerInfo && owner && (
            <PropertyOwnerInfo
              owner={owner}
              showContacts={viewerRole === "admin"}
              profileHref={ownerProfileHref}
            />
          )}

          {/* Occupation */}
          {showOccupation && (
            <PropertyOccupation
              propertyId={property.id}
              lease={lease}
              allowActions={canCreateLease || viewerRole === "owner"}
              createLeaseHref={createLeaseHref}
              viewLeaseHref={viewLeaseHref}
            />
          )}

          {/* Compteurs (pas pour parking) */}
          {showMeters && !isParking && (
            <PropertyMetersSection propertyId={property.id} />
          )}

          {/* Slot personnalisé */}
          {sidebarSlot}
        </div>
      </div>

      {/* ========== FOOTER INFO ========== */}
      <div className="mt-8 flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>
            Créé le {format(new Date(property.created_at), "dd MMMM yyyy", { locale: fr })}
          </span>
        </div>
        
        {property.unique_code && (
          <span className="font-mono text-xs">
            Code: {property.unique_code}
          </span>
        )}
      </div>

      {/* Actions footer */}
      {footerActions && (
        <div className="mt-6 pt-6 border-t border-border">
          {footerActions}
        </div>
      )}
    </motion.div>
  );
}

