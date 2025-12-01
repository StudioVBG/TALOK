"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Filter, X, ChevronDown, Search, SlidersHorizontal,
  Calendar, Check, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Types
export type FilterType = 
  | "text"
  | "select"
  | "multi-select"
  | "range"
  | "date"
  | "date-range"
  | "boolean"
  | "number";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterDefinition {
  id: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  defaultValue?: any;
}

export interface FilterValue {
  [key: string]: any;
}

interface AdvancedFiltersProps {
  filters: FilterDefinition[];
  values: FilterValue;
  onChange: (values: FilterValue) => void;
  onReset?: () => void;
  className?: string;
  triggerLabel?: string;
  showActiveCount?: boolean;
}

// Composant Filter Item pour chaque type
function FilterItem({
  filter,
  value,
  onChange,
}: {
  filter: FilterDefinition;
  value: any;
  onChange: (value: any) => void;
}) {
  switch (filter.type) {
    case "text":
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{filter.label}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={filter.placeholder || `Rechercher...`}
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      );

    case "select":
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{filter.label}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
              >
                {value
                  ? filter.options?.find((o) => o.value === value)?.label
                  : filter.placeholder || "Sélectionner..."}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder={`Rechercher...`} />
                <CommandList>
                  <CommandEmpty>Aucun résultat</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value=""
                      onSelect={() => onChange(null)}
                    >
                      <span className="text-muted-foreground">Tous</span>
                    </CommandItem>
                    {filter.options?.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => onChange(option.value)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option.label}
                        {option.count !== undefined && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {option.count}
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      );

    case "multi-select":
      const selectedValues = (value as string[]) || [];
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{filter.label}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
              >
                {selectedValues.length > 0
                  ? `${selectedValues.length} sélectionné${selectedValues.length > 1 ? "s" : ""}`
                  : filter.placeholder || "Sélectionner..."}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Rechercher..." />
                <CommandList>
                  <CommandEmpty>Aucun résultat</CommandEmpty>
                  <CommandGroup>
                    {filter.options?.map((option) => {
                      const isSelected = selectedValues.includes(option.value);
                      return (
                        <CommandItem
                          key={option.value}
                          onSelect={() => {
                            if (isSelected) {
                              onChange(selectedValues.filter((v) => v !== option.value));
                            } else {
                              onChange([...selectedValues, option.value]);
                            }
                          }}
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50"
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          {option.label}
                          {option.count !== undefined && (
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {option.count}
                            </Badge>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedValues.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedValues.map((v) => {
                const option = filter.options?.find((o) => o.value === v);
                return (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => onChange(selectedValues.filter((val) => val !== v))}
                  >
                    {option?.label || v}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      );

    case "range":
      const rangeValue = value || [filter.min || 0, filter.max || 100];
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{filter.label}</Label>
            <span className="text-sm text-muted-foreground">
              {rangeValue[0].toLocaleString("fr-FR")} - {rangeValue[1].toLocaleString("fr-FR")}
              {filter.unit && ` ${filter.unit}`}
            </span>
          </div>
          <Slider
            value={rangeValue}
            onValueChange={onChange}
            min={filter.min || 0}
            max={filter.max || 100}
            step={filter.step || 1}
            className="w-full"
          />
        </div>
      );

    case "number":
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{filter.label}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder={filter.placeholder}
              value={value || ""}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
              min={filter.min}
              max={filter.max}
              step={filter.step}
            />
            {filter.unit && (
              <span className="text-sm text-muted-foreground">{filter.unit}</span>
            )}
          </div>
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{filter.label}</Label>
          <Switch
            checked={value || false}
            onCheckedChange={onChange}
          />
        </div>
      );

    case "date":
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{filter.label}</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      );

    case "date-range":
      const dateRange = value || { from: "", to: "" };
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{filter.label}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              placeholder="Du"
              value={dateRange.from || ""}
              onChange={(e) => onChange({ ...dateRange, from: e.target.value })}
            />
            <Input
              type="date"
              placeholder="Au"
              value={dateRange.to || ""}
              onChange={(e) => onChange({ ...dateRange, to: e.target.value })}
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Composant de filtres avancés
 */
export function AdvancedFilters({
  filters,
  values,
  onChange,
  onReset,
  className,
  triggerLabel = "Filtres",
  showActiveCount = true,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localValues, setLocalValues] = useState<FilterValue>(values);

  // Mettre à jour les valeurs locales quand les valeurs externes changent
  useEffect(() => {
    setLocalValues(values);
  }, [values]);

  // Compter les filtres actifs
  const activeCount = useMemo(() => {
    let count = 0;
    for (const [key, val] of Object.entries(localValues)) {
      if (val === null || val === undefined || val === "") continue;
      if (Array.isArray(val) && val.length === 0) continue;
      if (typeof val === "object" && !Array.isArray(val)) {
        if (val.from || val.to) count++;
        continue;
      }
      count++;
    }
    return count;
  }, [localValues]);

  const handleChange = useCallback((filterId: string, value: any) => {
    setLocalValues((prev) => ({
      ...prev,
      [filterId]: value,
    }));
  }, []);

  const handleApply = useCallback(() => {
    onChange(localValues);
    setIsOpen(false);
  }, [localValues, onChange]);

  const handleReset = useCallback(() => {
    const resetValues: FilterValue = {};
    filters.forEach((f) => {
      resetValues[f.id] = f.defaultValue ?? null;
    });
    setLocalValues(resetValues);
    onChange(resetValues);
    onReset?.();
  }, [filters, onChange, onReset]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className={cn("gap-2", className)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {triggerLabel}
          {showActiveCount && activeCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres avancés
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {filters.map((filter, index) => (
            <motion.div
              key={filter.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <FilterItem
                filter={filter}
                value={localValues[filter.id]}
                onChange={(value) => handleChange(filter.id, value)}
              />
              {index < filters.length - 1 && (
                <Separator className="mt-6" />
              )}
            </motion.div>
          ))}
        </div>

        <SheetFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
          <Button onClick={handleApply}>
            Appliquer les filtres
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Version inline pour affichage horizontal
export function InlineFilters({
  filters,
  values,
  onChange,
  onReset,
  className,
}: Omit<AdvancedFiltersProps, "triggerLabel" | "showActiveCount">) {
  const handleChange = useCallback((filterId: string, value: any) => {
    onChange({
      ...values,
      [filterId]: value,
    });
  }, [values, onChange]);

  const hasActiveFilters = useMemo(() => {
    for (const [, val] of Object.entries(values)) {
      if (val === null || val === undefined || val === "") continue;
      if (Array.isArray(val) && val.length === 0) continue;
      return true;
    }
    return false;
  }, [values]);

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {filters.slice(0, 4).map((filter) => (
        <div key={filter.id} className="min-w-[150px]">
          {filter.type === "select" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span className="truncate">
                    {values[filter.id]
                      ? filter.options?.find((o) => o.value === values[filter.id])?.label
                      : filter.label}
                  </span>
                  <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher..." />
                  <CommandList>
                    <CommandEmpty>Aucun résultat</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => handleChange(filter.id, null)}>
                        <span className="text-muted-foreground">Tous</span>
                      </CommandItem>
                      {filter.options?.map((option) => (
                        <CommandItem
                          key={option.value}
                          onSelect={() => handleChange(filter.id, option.value)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              values[filter.id] === option.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
      ))}
      
      {hasActiveFilters && onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1">
          <X className="h-3 w-3" />
          Effacer
        </Button>
      )}
    </div>
  );
}

// Configurations de filtres prédéfinies
export const filterPresets = {
  properties: [
    {
      id: "type",
      label: "Type de bien",
      type: "select" as const,
      options: [
        { value: "appartement", label: "Appartement" },
        { value: "maison", label: "Maison" },
        { value: "studio", label: "Studio" },
        { value: "colocation", label: "Colocation" },
      ],
    },
    {
      id: "status",
      label: "Statut",
      type: "select" as const,
      options: [
        { value: "available", label: "Disponible" },
        { value: "rented", label: "Loué" },
        { value: "maintenance", label: "En travaux" },
      ],
    },
    {
      id: "rent",
      label: "Loyer",
      type: "range" as const,
      min: 0,
      max: 3000,
      step: 50,
      unit: "€",
    },
    {
      id: "surface",
      label: "Surface",
      type: "range" as const,
      min: 0,
      max: 200,
      step: 5,
      unit: "m²",
    },
    {
      id: "city",
      label: "Ville",
      type: "text" as const,
      placeholder: "Rechercher une ville...",
    },
  ],
  
  invoices: [
    {
      id: "status",
      label: "Statut",
      type: "multi-select" as const,
      options: [
        { value: "draft", label: "Brouillon" },
        { value: "sent", label: "Envoyée" },
        { value: "paid", label: "Payée" },
        { value: "late", label: "En retard" },
      ],
    },
    {
      id: "period",
      label: "Période",
      type: "date-range" as const,
    },
    {
      id: "minAmount",
      label: "Montant min",
      type: "number" as const,
      unit: "€",
    },
  ],
  
  tenants: [
    {
      id: "search",
      label: "Recherche",
      type: "text" as const,
      placeholder: "Nom, email, téléphone...",
    },
    {
      id: "hasLease",
      label: "Avec bail actif",
      type: "boolean" as const,
    },
    {
      id: "paymentStatus",
      label: "Paiements",
      type: "select" as const,
      options: [
        { value: "ok", label: "À jour" },
        { value: "late", label: "En retard" },
      ],
    },
  ],
};

export default AdvancedFilters;

