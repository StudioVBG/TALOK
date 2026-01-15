"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plus, Home, MapPin, Ruler, Euro, Calendar, TrendingUp,
  Thermometer, Car, Wifi, Check, Minus, ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { calculateRentalYield } from "@/lib/services/rental-calculator";

// Types
export interface PropertyForComparison {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  surface: number;
  rooms: number;
  bedrooms?: number;
  floor?: number;
  hasElevator?: boolean;
  hasParking?: boolean;
  hasCellar?: boolean;
  hasBalcony?: boolean;
  hasTerrace?: boolean;
  hasGarden?: boolean;
  furnished?: boolean;
  heatingType?: string;
  energyClass?: string;
  gesClass?: string;
  rent: number;
  charges: number;
  deposit?: number;
  purchasePrice?: number;
  propertyTax?: number;
  condoFees?: number;
  status: "available" | "rented" | "maintenance";
  imageUrl?: string;
}

interface ComparisonMetric {
  id: string;
  label: string;
  icon: typeof Home;
  getValue: (p: PropertyForComparison) => string | number | boolean | null;
  format?: "text" | "number" | "currency" | "boolean" | "area" | "percentage";
  highlight?: "higher" | "lower" | "none";
}

// Métriques de comparaison
const comparisonMetrics: ComparisonMetric[] = [
  {
    id: "type",
    label: "Type",
    icon: Home,
    getValue: (p) => p.type,
    format: "text",
  },
  {
    id: "surface",
    label: "Surface",
    icon: Ruler,
    getValue: (p) => p.surface,
    format: "area",
    highlight: "higher",
  },
  {
    id: "rooms",
    label: "Pièces",
    icon: Home,
    getValue: (p) => p.rooms,
    format: "number",
    highlight: "higher",
  },
  {
    id: "bedrooms",
    label: "Chambres",
    icon: Home,
    getValue: (p) => p.bedrooms ?? null,
    format: "number",
    highlight: "higher",
  },
  {
    id: "rent",
    label: "Loyer",
    icon: Euro,
    getValue: (p) => p.rent,
    format: "currency",
    highlight: "none",
  },
  {
    id: "charges",
    label: "Charges",
    icon: Euro,
    getValue: (p) => p.charges,
    format: "currency",
    highlight: "lower",
  },
  {
    id: "rentPerSqm",
    label: "€/m²",
    icon: TrendingUp,
    getValue: (p) => p.surface > 0 ? Math.round(p.rent / p.surface * 100) / 100 : null,
    format: "currency",
    highlight: "none",
  },
  {
    id: "grossYield",
    label: "Rendement brut",
    icon: TrendingUp,
    getValue: (p) => {
      if (!p.purchasePrice || p.purchasePrice <= 0) return null;
      const result = calculateRentalYield({
        purchasePrice: p.purchasePrice,
        monthlyRent: p.rent,
      });
      return result.grossYield;
    },
    format: "percentage",
    highlight: "higher",
  },
  {
    id: "energyClass",
    label: "DPE",
    icon: Thermometer,
    getValue: (p) => p.energyClass ?? null,
    format: "text",
  },
  {
    id: "floor",
    label: "Étage",
    icon: ArrowUpDown,
    getValue: (p) => p.floor ?? null,
    format: "number",
  },
  {
    id: "hasParking",
    label: "Parking",
    icon: Car,
    getValue: (p) => p.hasParking ?? null,
    format: "boolean",
  },
  {
    id: "hasElevator",
    label: "Ascenseur",
    icon: ArrowUpDown,
    getValue: (p) => p.hasElevator ?? null,
    format: "boolean",
  },
  {
    id: "furnished",
    label: "Meublé",
    icon: Home,
    getValue: (p) => p.furnished ?? null,
    format: "boolean",
  },
];

// Format des valeurs
function formatValue(value: any, format?: ComparisonMetric["format"]): string {
  if (value === null || value === undefined) return "—";
  
  switch (format) {
    case "currency":
      return `${value.toLocaleString("fr-FR")} €`;
    case "number":
      return value.toLocaleString("fr-FR");
    case "area":
      return `${value} m²`;
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "boolean":
      return value ? "Oui" : "Non";
    default:
      return String(value);
  }
}

// Détermine la meilleure valeur pour highlight
function getBestValue(
  values: (string | number | boolean | null)[],
  highlight?: "higher" | "lower" | "none"
): number | null {
  if (highlight === "none" || !highlight) return null;
  
  const numericValues = values
    .map((v, i) => ({ value: typeof v === "number" ? v : null, index: i }))
    .filter((v) => v.value !== null);
  
  if (numericValues.length === 0) return null;
  
  if (highlight === "higher") {
    return numericValues.reduce((best, curr) => 
      (curr.value! > (best.value || -Infinity)) ? curr : best
    ).index;
  } else {
    return numericValues.reduce((best, curr) => 
      (curr.value! < (best.value || Infinity)) ? curr : best
    ).index;
  }
}

interface PropertyCardProps {
  property: PropertyForComparison;
  onRemove: () => void;
  isHighlighted?: boolean;
}

function PropertyCard({ property, onRemove, isHighlighted }: PropertyCardProps) {
  const statusColors = {
    available: "bg-green-100 text-green-700",
    rented: "bg-blue-100 text-blue-700",
    maintenance: "bg-orange-100 text-orange-700",
  };
  
  const statusLabels = {
    available: "Disponible",
    rented: "Loué",
    maintenance: "En travaux",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "relative min-w-[250px] max-w-[300px] rounded-lg border bg-card overflow-hidden",
        isHighlighted && "ring-2 ring-primary"
      )}
    >
      {/* Image */}
      <div className="relative h-32 bg-muted">
        {property.imageUrl ? (
          <img
            src={property.imageUrl}
            alt={property.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7"
          onClick={onRemove}
          aria-label="Retirer de la comparaison"
        >
          <X className="h-4 w-4" />
        </Button>
        <Badge className={cn("absolute bottom-2 left-2", statusColors[property.status])}>
          {statusLabels[property.status]}
        </Badge>
      </div>
      
      {/* Infos */}
      <div className="p-3">
        <h3 className="font-semibold truncate">{property.name || property.type}</h3>
        <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
          <MapPin className="h-3 w-3" />
          {property.city}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {property.rent.toLocaleString("fr-FR")} €
          </span>
          <span className="text-sm text-muted-foreground">
            {property.surface} m²
          </span>
        </div>
      </div>
    </motion.div>
  );
}

interface AddPropertyDialogProps {
  availableProperties: PropertyForComparison[];
  selectedIds: string[];
  onAdd: (property: PropertyForComparison) => void;
}

function AddPropertyDialog({ availableProperties, selectedIds, onAdd }: AddPropertyDialogProps) {
  const [open, setOpen] = useState(false);
  
  const unselectedProperties = availableProperties.filter(
    (p) => !selectedIds.includes(p.id)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-w-[250px] h-auto py-8 border-dashed">
          <div className="flex flex-col items-center gap-2">
            <Plus className="h-8 w-8 text-muted-foreground" />
            <span>Ajouter un bien</span>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sélectionner un bien à comparer</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Rechercher..." />
          <CommandList>
            <CommandEmpty>Aucun bien disponible</CommandEmpty>
            <CommandGroup>
              {unselectedProperties.map((property) => (
                <CommandItem
                  key={property.id}
                  onSelect={() => {
                    onAdd(property);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Home className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <p className="font-medium">{property.name || property.type}</p>
                    <p className="text-sm text-muted-foreground">{property.address}</p>
                  </div>
                  <span className="text-sm font-medium">
                    {property.rent.toLocaleString("fr-FR")} €
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

interface PropertyComparisonProps {
  availableProperties: PropertyForComparison[];
  initialSelection?: string[];
  maxProperties?: number;
  className?: string;
}

/**
 * Composant de comparaison de biens immobiliers
 */
export function PropertyComparison({
  availableProperties,
  initialSelection = [],
  maxProperties = 4,
  className,
}: PropertyComparisonProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection);

  const selectedProperties = useMemo(() => {
    return selectedIds
      .map((id) => availableProperties.find((p) => p.id === id))
      .filter(Boolean) as PropertyForComparison[];
  }, [selectedIds, availableProperties]);

  const handleAddProperty = (property: PropertyForComparison) => {
    if (selectedIds.length < maxProperties) {
      setSelectedIds((prev) => [...prev, property.id]);
    }
  };

  const handleRemoveProperty = (id: string) => {
    setSelectedIds((prev) => prev.filter((pid) => pid !== id));
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* En-tête avec biens sélectionnés */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Comparer les biens</h2>
          <Badge variant="secondary">
            {selectedIds.length}/{maxProperties} biens
          </Badge>
        </div>
        
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            <AnimatePresence>
              {selectedProperties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onRemove={() => handleRemoveProperty(property.id)}
                />
              ))}
            </AnimatePresence>
            
            {selectedIds.length < maxProperties && (
              <AddPropertyDialog
                availableProperties={availableProperties}
                selectedIds={selectedIds}
                onAdd={handleAddProperty}
              />
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Tableau de comparaison */}
      {selectedProperties.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparaison détaillée</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {comparisonMetrics.map((metric) => {
                const values = selectedProperties.map((p) => metric.getValue(p));
                const bestIndex = getBestValue(values, metric.highlight);
                const Icon = metric.icon;

                return (
                  <div
                    key={metric.id}
                    className="grid items-center gap-4 py-2 border-b last:border-0"
                    style={{
                      gridTemplateColumns: `200px repeat(${selectedProperties.length}, 1fr)`,
                    }}
                  >
                    {/* Label */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className="h-4 w-4" />
                      {metric.label}
                    </div>
                    
                    {/* Valeurs */}
                    {values.map((value, index) => (
                      <div
                        key={index}
                        className={cn(
                          "text-sm font-medium text-center py-1 px-2 rounded",
                          bestIndex === index && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        )}
                      >
                        {metric.format === "boolean" ? (
                          value === true ? (
                            <Check className="h-4 w-4 mx-auto text-green-600" />
                          ) : value === false ? (
                            <Minus className="h-4 w-4 mx-auto text-gray-400" />
                          ) : (
                            "—"
                          )
                        ) : (
                          formatValue(value, metric.format)
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message si pas assez de biens */}
      {selectedProperties.length < 2 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Home className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              Sélectionnez au moins 2 biens pour les comparer
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PropertyComparison;

