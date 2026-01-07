"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Home,
  MapPin,
  Check,
  Search,
  Ruler,
  DoorOpen,
  Zap,
  Euro,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/helpers/format";

interface Property {
  id: string;
  adresse_complete?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  type?: string;
  surface?: number;
  nb_pieces?: number;
  loyer_hc?: number;
  charges_forfaitaires?: number;
  dpe_classe?: string;
  dpe_classe_climat?: string;
}

interface PropertySelectorProps {
  properties: Property[];
  selectedPropertyId: string | null;
  onSelect: (property: Property) => void;
}

// Icônes par type de bien
const propertyIcons: Record<string, typeof Home> = {
  appartement: Building2,
  maison: Home,
  studio: Building2,
  colocation: Building2,
  saisonnier: Home,
  default: Building2,
};

// Couleurs DPE
const dpeColors: Record<string, string> = {
  A: "bg-green-500",
  B: "bg-lime-500",
  C: "bg-yellow-500",
  D: "bg-amber-500",
  E: "bg-orange-500",
  F: "bg-red-500",
  G: "bg-red-700",
};

export function PropertySelector({ properties, selectedPropertyId, onSelect }: PropertySelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredProperties = useMemo(() => {
    if (!searchQuery) return properties;
    const query = searchQuery.toLowerCase();
    return properties.filter((p) => 
      p.adresse_complete?.toLowerCase().includes(query) ||
      p.adresse?.toLowerCase().includes(query) ||
      p.ville?.toLowerCase().includes(query) ||
      p.code_postal?.includes(query)
    );
  }, [properties, searchQuery]);

  if (properties.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
        <Building2 className="h-12 w-12 mx-auto text-slate-400 mb-4" />
        <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">
          Aucun bien disponible
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Créez d'abord un bien pour pouvoir créer un bail
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Sélectionnez le bien</h3>
        <Badge variant="outline" className="gap-1">
          {properties.length} bien{properties.length > 1 ? "s" : ""} disponible{properties.length > 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Recherche */}
      {properties.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par adresse, ville..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm"
          />
        </div>
      )}

      {/* Liste des biens */}
      <div className="grid gap-3">
        {filteredProperties.map((property) => {
          const isSelected = selectedPropertyId === property.id;
          const Icon = propertyIcons[property.type || "default"] || Building2;
          const address = property.adresse_complete || property.adresse || "Adresse non renseignée";
          const totalRent = (property.loyer_hc || 0) + (property.charges_forfaitaires || 0);
          
          return (
            <motion.div
              key={property.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="relative cursor-pointer"
              onClick={() => onSelect(property)}
            >
              <div className={cn(
                "relative p-4 rounded-xl border-2 transition-all duration-300",
                "bg-white dark:bg-slate-900",
                isSelected
                  ? "border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:shadow-md"
              )}>
                <div className="flex items-start gap-4">
                  {/* Icône */}
                  <div className={cn(
                    "p-3 rounded-xl shrink-0 transition-colors",
                    isSelected
                      ? "bg-primary text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Infos principales */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                          {address}
                        </h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {property.code_postal} {property.ville}
                        </p>
                      </div>
                      
                      {/* Badge sélectionné */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="shrink-0"
                        >
                          <div className="p-1 bg-primary rounded-full">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Caractéristiques */}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      {property.surface && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Ruler className="h-3 w-3" />
                          {property.surface} m²
                        </span>
                      )}
                      {property.nb_pieces && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DoorOpen className="h-3 w-3" />
                          {property.nb_pieces} pièce{property.nb_pieces > 1 ? "s" : ""}
                        </span>
                      )}
                      {property.dpe_classe && (
                        <span className="flex items-center gap-1 text-xs">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-white text-[10px] font-bold",
                            dpeColors[property.dpe_classe] || "bg-slate-400"
                          )}>
                            DPE {property.dpe_classe}
                          </span>
                        </span>
                      )}
                      {property.type && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {property.type.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>

                    {/* Loyer suggéré */}
                    {totalRent > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Euro className="h-3 w-3" />
                            Loyer suggéré
                          </span>
                          <span className="font-bold text-primary">
                            {formatCurrency(totalRent)}/mois
                          </span>
                        </div>
                        {property.loyer_hc && property.charges_forfaitaires && (
                          <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                            {formatCurrency(property.loyer_hc)} + {formatCurrency(property.charges_forfaitaires)} CC
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredProperties.length === 0 && searchQuery && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Aucun bien ne correspond à "{searchQuery}"
          </p>
        </div>
      )}
    </div>
  );
}

