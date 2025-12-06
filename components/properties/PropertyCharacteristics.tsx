"use client";

/**
 * PropertyCharacteristics - Caractéristiques adaptées au type de bien
 * Architecture SOTA 2025 - Composant de présentation pur
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, 
  Car, 
  Hash, 
  Shield, 
  Flame, 
  Snowflake, 
  Store, 
  Wifi, 
  Accessibility,
  Video
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { 
  PropertyData, 
  PropertyCharacteristicsProps,
  PropertyType 
} from "./types";
import { 
  isHabitationType, 
  isParkingType, 
  isProType,
  TYPE_LABELS 
} from "./types";

// ============================================
// BADGE CARACTÉRISTIQUE
// ============================================

interface CharacteristicBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  bgColor?: string;
}

function CharacteristicBadge({ icon, label, value, bgColor = "bg-muted" }: CharacteristicBadgeProps) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg", bgColor)}>
      <span className="flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ============================================
// CARACTÉRISTIQUES HABITATION
// ============================================

function HabitationCharacteristics({ property }: { property: PropertyData }) {
  return (
    <div className="flex flex-wrap gap-3">
      {/* Surface */}
      {property.surface && (
        <CharacteristicBadge
          icon={<span className="text-blue-600 text-lg">📐</span>}
          label="Surface"
          value={`${property.surface} m²`}
          bgColor="bg-blue-50 dark:bg-blue-500/10"
        />
      )}
      
      {/* Pièces */}
      {property.nb_pieces && property.nb_pieces > 0 && (
        <CharacteristicBadge
          icon={<span className="text-emerald-600 text-lg">🚪</span>}
          label="Pièces"
          value={property.nb_pieces}
          bgColor="bg-emerald-50 dark:bg-emerald-500/10"
        />
      )}
      
      {/* Type */}
      <CharacteristicBadge
        icon={<span className="text-violet-600 text-lg">🏠</span>}
        label="Type"
        value={TYPE_LABELS[property.type] || property.type}
        bgColor="bg-violet-50 dark:bg-violet-500/10"
      />
      
      {/* DPE */}
      {property.dpe_classe_energie && (
        <CharacteristicBadge
          icon={<span className="text-amber-600 text-lg">⚡</span>}
          label="DPE"
          value={property.dpe_classe_energie}
          bgColor="bg-amber-50 dark:bg-amber-500/10"
        />
      )}
      
      {/* Étage */}
      {property.etage !== undefined && property.etage !== null && (
        <CharacteristicBadge
          icon={<Building2 className="h-4 w-4 text-indigo-600" />}
          label="Étage"
          value={property.etage === 0 ? "RDC" : property.etage}
          bgColor="bg-indigo-50 dark:bg-indigo-500/10"
        />
      )}
      
      {/* Chauffage */}
      {property.chauffage_type && property.chauffage_type !== "aucun" && (
        <CharacteristicBadge
          icon={<Flame className="h-4 w-4 text-orange-600" />}
          label="Chauffage"
          value={`${property.chauffage_type}${property.chauffage_energie ? ` (${property.chauffage_energie})` : ""}`}
          bgColor="bg-orange-50 dark:bg-orange-500/10"
        />
      )}
      
      {/* Climatisation */}
      {property.clim_presence && property.clim_presence !== "aucune" && (
        <CharacteristicBadge
          icon={<Snowflake className="h-4 w-4 text-cyan-600" />}
          label="Climatisation"
          value={property.clim_presence}
          bgColor="bg-cyan-50 dark:bg-cyan-500/10"
        />
      )}
      
      {/* Meublé */}
      {property.meuble && (
        <CharacteristicBadge
          icon={<span className="text-teal-600 text-lg">🛋️</span>}
          label="Meublé"
          value="Oui"
          bgColor="bg-teal-50 dark:bg-teal-500/10"
        />
      )}
      
      {/* Ascenseur */}
      {property.ascenseur && (
        <CharacteristicBadge
          icon={<span className="text-slate-600 text-lg">🛗</span>}
          label="Ascenseur"
          value="Oui"
          bgColor="bg-slate-100 dark:bg-slate-500/10"
        />
      )}
      
      {/* Extérieurs */}
      {property.has_balcon && (
        <CharacteristicBadge
          icon={<span className="text-green-600 text-lg">🌿</span>}
          label="Balcon"
          value="Oui"
          bgColor="bg-green-50 dark:bg-green-500/10"
        />
      )}
      
      {property.has_terrasse && (
        <CharacteristicBadge
          icon={<span className="text-green-600 text-lg">☀️</span>}
          label="Terrasse"
          value="Oui"
          bgColor="bg-green-50 dark:bg-green-500/10"
        />
      )}
      
      {property.has_jardin && (
        <CharacteristicBadge
          icon={<span className="text-green-600 text-lg">🌳</span>}
          label="Jardin"
          value="Oui"
          bgColor="bg-green-50 dark:bg-green-500/10"
        />
      )}
      
      {property.has_cave && (
        <CharacteristicBadge
          icon={<span className="text-stone-600 text-lg">🪨</span>}
          label="Cave"
          value="Oui"
          bgColor="bg-stone-100 dark:bg-stone-500/10"
        />
      )}
    </div>
  );
}

// ============================================
// CARACTÉRISTIQUES PARKING
// ============================================

function ParkingCharacteristics({ property }: { property: PropertyData }) {
  const securityFeatures = [
    property.parking_video_surveillance && "Vidéo",
    property.parking_gardien && "Gardien",
    property.parking_portail_securise && "Portail"
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap gap-3">
      {/* Type de parking */}
      <CharacteristicBadge
        icon={<Car className="h-4 w-4 text-purple-600" />}
        label="Type"
        value={
          property.parking_type === "box" ? "Box fermé" : 
          property.parking_type === "place_couverte" ? "Couvert" :
          property.parking_type === "souterrain" ? "Souterrain" : "Extérieur"
        }
        bgColor="bg-purple-50 dark:bg-purple-500/10"
      />
      
      {/* Numéro de place */}
      {property.parking_numero && (
        <CharacteristicBadge
          icon={<Hash className="h-4 w-4 text-blue-600" />}
          label="N° Place"
          value={property.parking_numero}
          bgColor="bg-blue-50 dark:bg-blue-500/10"
        />
      )}
      
      {/* Niveau */}
      {property.parking_niveau && (
        <CharacteristicBadge
          icon={<Building2 className="h-4 w-4 text-indigo-600" />}
          label="Niveau"
          value={property.parking_niveau}
          bgColor="bg-indigo-50 dark:bg-indigo-500/10"
        />
      )}
      
      {/* Gabarit */}
      {property.parking_gabarit && (
        <CharacteristicBadge
          icon={<Car className="h-4 w-4 text-amber-600" />}
          label="Gabarit max"
          value={property.parking_gabarit}
          bgColor="bg-amber-50 dark:bg-amber-500/10"
        />
      )}
      
      {/* Sécurité */}
      {securityFeatures.length > 0 && (
        <CharacteristicBadge
          icon={<Shield className="h-4 w-4 text-red-600" />}
          label="Sécurité"
          value={securityFeatures.join(", ")}
          bgColor="bg-red-50 dark:bg-red-500/10"
        />
      )}
      
      {/* Surface (pour box) */}
      {property.surface && property.surface > 0 && (
        <CharacteristicBadge
          icon={<span className="text-slate-600 text-lg">📐</span>}
          label="Surface"
          value={`${property.surface} m²`}
          bgColor="bg-slate-100 dark:bg-slate-500/10"
        />
      )}
    </div>
  );
}

// ============================================
// CARACTÉRISTIQUES LOCAL PRO
// ============================================

function ProCharacteristics({ property }: { property: PropertyData }) {
  return (
    <div className="flex flex-wrap gap-3">
      {/* Surface */}
      <CharacteristicBadge
        icon={<span className="text-blue-600 text-lg">📐</span>}
        label="Surface"
        value={`${property.local_surface_totale || property.surface} m²`}
        bgColor="bg-blue-50 dark:bg-blue-500/10"
      />
      
      {/* Type de local */}
      {property.local_type && (
        <CharacteristicBadge
          icon={<Store className="h-4 w-4 text-purple-600" />}
          label="Type"
          value={property.local_type}
          bgColor="bg-purple-50 dark:bg-purple-500/10"
        />
      )}
      
      {/* Étage */}
      {property.etage !== undefined && property.etage !== null && (
        <CharacteristicBadge
          icon={<Building2 className="h-4 w-4 text-indigo-600" />}
          label="Étage"
          value={property.etage === 0 ? "RDC" : property.etage}
          bgColor="bg-indigo-50 dark:bg-indigo-500/10"
        />
      )}
      
      {/* Équipements */}
      {property.local_has_vitrine && (
        <CharacteristicBadge
          icon={<span className="text-amber-600 text-lg">🪟</span>}
          label="Vitrine"
          value="Oui"
          bgColor="bg-amber-50 dark:bg-amber-500/10"
        />
      )}
      
      {property.local_access_pmr && (
        <CharacteristicBadge
          icon={<Accessibility className="h-4 w-4 text-green-600" />}
          label="Accès PMR"
          value="Oui"
          bgColor="bg-green-50 dark:bg-green-500/10"
        />
      )}
      
      {property.local_fibre && (
        <CharacteristicBadge
          icon={<Wifi className="h-4 w-4 text-cyan-600" />}
          label="Fibre"
          value="Oui"
          bgColor="bg-cyan-50 dark:bg-cyan-500/10"
        />
      )}
      
      {property.local_clim && (
        <CharacteristicBadge
          icon={<Snowflake className="h-4 w-4 text-sky-600" />}
          label="Climatisation"
          value="Oui"
          bgColor="bg-sky-50 dark:bg-sky-500/10"
        />
      )}
      
      {property.local_alarme && (
        <CharacteristicBadge
          icon={<Shield className="h-4 w-4 text-red-600" />}
          label="Alarme"
          value="Oui"
          bgColor="bg-red-50 dark:bg-red-500/10"
        />
      )}
    </div>
  );
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function PropertyCharacteristics({ 
  property, 
  className,
  variant = "compact"
}: PropertyCharacteristicsProps) {
  const propertyType = property.type;

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-foreground">
          <Building2 className="h-5 w-5 text-primary" />
          Caractéristiques
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isParkingType(propertyType) && (
          <ParkingCharacteristics property={property} />
        )}
        
        {isProType(propertyType) && (
          <ProCharacteristics property={property} />
        )}
        
        {isHabitationType(propertyType) && (
          <HabitationCharacteristics property={property} />
        )}
        
        {/* Fallback pour types inconnus */}
        {!isParkingType(propertyType) && !isProType(propertyType) && !isHabitationType(propertyType) && (
          <HabitationCharacteristics property={property} />
        )}
        
        {/* Visite virtuelle */}
        {property.visite_virtuelle_url && (
          <div className="mt-4 pt-4 border-t border-border">
            <a 
              href={property.visite_virtuelle_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Video className="h-4 w-4" />
              Visite virtuelle disponible
              <span className="opacity-70">↗</span>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

