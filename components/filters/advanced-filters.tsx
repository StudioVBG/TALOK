"use client";

import { useState } from "react";
import {
  Filter,
  X,
  ChevronDown,
  Building2,
  Euro,
  MapPin,
  Home,
  Bed,
  Bath,
  Square,
  Thermometer,
  Car,
  Trees,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

// Types de filtres pour les propriétés
export interface PropertyFilters {
  type?: string[];
  statut?: string[];
  surface_min?: number;
  surface_max?: number;
  loyer_min?: number;
  loyer_max?: number;
  nb_pieces_min?: number;
  nb_pieces_max?: number;
  nb_chambres_min?: number;
  ville?: string;
  dpe?: string[];
  meuble?: boolean;
  parking?: boolean;
  balcon?: boolean;
  terrasse?: boolean;
  jardin?: boolean;
  cave?: boolean;
  ascenseur?: boolean;
}

// Types de filtres pour les locataires
export interface TenantFilters {
  statut?: string[];
  bail_type?: string[];
  paiement_statut?: string[];
  revenus_min?: number;
  revenus_max?: number;
  score_min?: number;
}

interface AdvancedFiltersProps {
  type: "properties" | "tenants";
  filters: PropertyFilters | TenantFilters;
  onFiltersChange: (filters: PropertyFilters | TenantFilters) => void;
  className?: string;
}

// Options pour les filtres de propriétés
const PROPERTY_TYPES = [
  { value: "appartement", label: "Appartement" },
  { value: "maison", label: "Maison" },
  { value: "studio", label: "Studio" },
  { value: "parking", label: "Parking" },
  { value: "local_commercial", label: "Local commercial" },
  { value: "bureaux", label: "Bureaux" },
];

const PROPERTY_STATUS = [
  { value: "libre", label: "Libre" },
  { value: "loue", label: "Loué" },
  { value: "travaux", label: "En travaux" },
];

const DPE_OPTIONS = ["A", "B", "C", "D", "E", "F", "G"];

// Options pour les filtres de locataires
const TENANT_STATUS = [
  { value: "actif", label: "Actif" },
  { value: "en_attente", label: "En attente" },
  { value: "ancien", label: "Ancien" },
];

const PAYMENT_STATUS = [
  { value: "a_jour", label: "À jour" },
  { value: "retard", label: "En retard" },
  { value: "impaye", label: "Impayé" },
];

export function AdvancedFilters({
  type,
  filters,
  onFiltersChange,
  className,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Compteur de filtres actifs
  const activeFiltersCount = Object.entries(filters).filter(([_, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "boolean") return value;
    return true;
  }).length;

  const handleReset = () => {
    onFiltersChange({});
  };

  const updateFilter = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    // Supprimer les valeurs vides
    if (value === undefined || value === null || value === "" || 
        (Array.isArray(value) && value.length === 0)) {
      delete (newFilters as any)[key];
    }
    onFiltersChange(newFilters);
  };

  const toggleArrayFilter = (key: string, value: string) => {
    const current = (filters as any)[key] || [];
    const newValue = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    updateFilter(key, newValue);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("gap-2", className)}
        >
          <Filter className="h-4 w-4" />
          Filtres
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <div className="p-4 border-b flex items-center justify-between">
          <h4 className="font-semibold">Filtres avancés</h4>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="h-3 w-3 mr-1" />
              Réinitialiser
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {type === "properties" ? (
            <PropertyFiltersContent
              filters={filters as PropertyFilters}
              updateFilter={updateFilter}
              toggleArrayFilter={toggleArrayFilter}
            />
          ) : (
            <TenantFiltersContent
              filters={filters as TenantFilters}
              updateFilter={updateFilter}
              toggleArrayFilter={toggleArrayFilter}
            />
          )}
        </div>

        <div className="p-4 border-t bg-muted/30">
          <Button className="w-full" onClick={() => setIsOpen(false)}>
            Appliquer les filtres
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Contenu des filtres pour les propriétés
function PropertyFiltersContent({
  filters,
  updateFilter,
  toggleArrayFilter,
}: {
  filters: PropertyFilters;
  updateFilter: (key: string, value: any) => void;
  toggleArrayFilter: (key: string, value: string) => void;
}) {
  return (
    <Accordion type="multiple" defaultValue={["type", "price"]} className="px-4">
      {/* Type de bien */}
      <AccordionItem value="type">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Type de bien
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 gap-2">
            {PROPERTY_TYPES.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start h-8 text-xs",
                  filters.type?.includes(option.value) && "bg-primary/10 border-primary"
                )}
                onClick={() => toggleArrayFilter("type", option.value)}
              >
                {filters.type?.includes(option.value) && (
                  <Check className="h-3 w-3 mr-1" />
                )}
                {option.label}
              </Button>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Statut */}
      <AccordionItem value="status">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Statut
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_STATUS.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 text-xs",
                  filters.statut?.includes(option.value) && "bg-primary/10 border-primary"
                )}
                onClick={() => toggleArrayFilter("statut", option.value)}
              >
                {filters.statut?.includes(option.value) && (
                  <Check className="h-3 w-3 mr-1" />
                )}
                {option.label}
              </Button>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Prix / Loyer */}
      <AccordionItem value="price">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Loyer
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Min (€)</Label>
              <Input
                type="number"
                placeholder="0"
                value={filters.loyer_min || ""}
                onChange={(e) => updateFilter("loyer_min", e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Max (€)</Label>
              <Input
                type="number"
                placeholder="5000"
                value={filters.loyer_max || ""}
                onChange={(e) => updateFilter("loyer_max", e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 mt-1"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Surface */}
      <AccordionItem value="surface">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <Square className="h-4 w-4" />
            Surface
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Min (m²)</Label>
              <Input
                type="number"
                placeholder="0"
                value={filters.surface_min || ""}
                onChange={(e) => updateFilter("surface_min", e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Max (m²)</Label>
              <Input
                type="number"
                placeholder="500"
                value={filters.surface_max || ""}
                onChange={(e) => updateFilter("surface_max", e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 mt-1"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Pièces */}
      <AccordionItem value="rooms">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <Bed className="h-4 w-4" />
            Pièces & chambres
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Pièces min</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={filters.nb_pieces_min || ""}
                  onChange={(e) => updateFilter("nb_pieces_min", e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Pièces max</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={filters.nb_pieces_max || ""}
                  onChange={(e) => updateFilter("nb_pieces_max", e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8 mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Chambres min</Label>
              <Input
                type="number"
                placeholder="1"
                value={filters.nb_chambres_min || ""}
                onChange={(e) => updateFilter("nb_chambres_min", e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 mt-1"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* DPE */}
      <AccordionItem value="dpe">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4" />
            DPE
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex gap-1">
            {DPE_OPTIONS.map((dpe) => (
              <Button
                key={dpe}
                variant="outline"
                size="sm"
                className={cn(
                  "w-8 h-8 p-0 text-xs font-bold",
                  filters.dpe?.includes(dpe) && "bg-primary/10 border-primary",
                  dpe === "A" && "text-green-600",
                  dpe === "B" && "text-lime-600",
                  dpe === "C" && "text-yellow-600",
                  dpe === "D" && "text-orange-500",
                  dpe === "E" && "text-orange-600",
                  dpe === "F" && "text-red-500",
                  dpe === "G" && "text-red-700"
                )}
                onClick={() => toggleArrayFilter("dpe", dpe)}
              >
                {dpe}
              </Button>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Équipements */}
      <AccordionItem value="amenities">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Équipements
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Meublé</Label>
              <Switch
                checked={filters.meuble || false}
                onCheckedChange={(v) => updateFilter("meuble", v || undefined)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Parking</Label>
              <Switch
                checked={filters.parking || false}
                onCheckedChange={(v) => updateFilter("parking", v || undefined)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Balcon</Label>
              <Switch
                checked={filters.balcon || false}
                onCheckedChange={(v) => updateFilter("balcon", v || undefined)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Terrasse</Label>
              <Switch
                checked={filters.terrasse || false}
                onCheckedChange={(v) => updateFilter("terrasse", v || undefined)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Jardin</Label>
              <Switch
                checked={filters.jardin || false}
                onCheckedChange={(v) => updateFilter("jardin", v || undefined)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Cave</Label>
              <Switch
                checked={filters.cave || false}
                onCheckedChange={(v) => updateFilter("cave", v || undefined)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Ascenseur</Label>
              <Switch
                checked={filters.ascenseur || false}
                onCheckedChange={(v) => updateFilter("ascenseur", v || undefined)}
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Localisation */}
      <AccordionItem value="location">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Localisation
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div>
            <Label className="text-xs">Ville</Label>
            <Input
              placeholder="Paris, Lyon..."
              value={filters.ville || ""}
              onChange={(e) => updateFilter("ville", e.target.value || undefined)}
              className="h-8 mt-1"
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// Contenu des filtres pour les locataires
function TenantFiltersContent({
  filters,
  updateFilter,
  toggleArrayFilter,
}: {
  filters: TenantFilters;
  updateFilter: (key: string, value: any) => void;
  toggleArrayFilter: (key: string, value: string) => void;
}) {
  return (
    <Accordion type="multiple" defaultValue={["status", "payment"]} className="px-4">
      {/* Statut */}
      <AccordionItem value="status">
        <AccordionTrigger className="text-sm">Statut du locataire</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-wrap gap-2">
            {TENANT_STATUS.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 text-xs",
                  filters.statut?.includes(option.value) && "bg-primary/10 border-primary"
                )}
                onClick={() => toggleArrayFilter("statut", option.value)}
              >
                {filters.statut?.includes(option.value) && (
                  <Check className="h-3 w-3 mr-1" />
                )}
                {option.label}
              </Button>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Statut de paiement */}
      <AccordionItem value="payment">
        <AccordionTrigger className="text-sm">Statut de paiement</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_STATUS.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 text-xs",
                  filters.paiement_statut?.includes(option.value) && "bg-primary/10 border-primary"
                )}
                onClick={() => toggleArrayFilter("paiement_statut", option.value)}
              >
                {filters.paiement_statut?.includes(option.value) && (
                  <Check className="h-3 w-3 mr-1" />
                )}
                {option.label}
              </Button>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Revenus */}
      <AccordionItem value="income">
        <AccordionTrigger className="text-sm">Revenus mensuels</AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Min (€)</Label>
              <Input
                type="number"
                placeholder="0"
                value={filters.revenus_min || ""}
                onChange={(e) => updateFilter("revenus_min", e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Max (€)</Label>
              <Input
                type="number"
                placeholder="10000"
                value={filters.revenus_max || ""}
                onChange={(e) => updateFilter("revenus_max", e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 mt-1"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Score */}
      <AccordionItem value="score">
        <AccordionTrigger className="text-sm">Score minimum</AccordionTrigger>
        <AccordionContent>
          <div>
            <Label className="text-xs">Score min (0-100)</Label>
            <Input
              type="number"
              placeholder="0"
              min={0}
              max={100}
              value={filters.score_min || ""}
              onChange={(e) => updateFilter("score_min", e.target.value ? Number(e.target.value) : undefined)}
              className="h-8 mt-1"
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export default AdvancedFilters;
