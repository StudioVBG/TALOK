/**
 * PropertyTypeSelection - Composant de sélection du type de bien V3 (SOTA 2025)
 * 
 * Améliorations :
 * - FilterBar sticky avec pills et search instantané
 * - Icônes lucide-react (remplace emojis)
 * - Grille responsive 1→2→3→4 cols
 * - Cartes full-click avec états clairs
 * - Navigation clavier (flèches + Enter)
 * - Empty state avec bouton "Effacer le filtre"
 * - Prefetch next step sur hover/focus
 * - Analytics events complets
 */

"use client";

import { useEffect, useState, useCallback, useMemo, useRef, forwardRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PROPERTY_TYPE_GROUPS } from "@/lib/types/property-v3";
import type { PropertyTypeV3 } from "@/lib/types/property-v3";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Building2, 
  Car, 
  Warehouse, 
  Store, 
  Users, 
  Check,
  Search,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WizardStepLayout } from "@/lib/design-system/wizard-layout";
import { emitAnalyticsEvent, PropertyWizardEvents } from "@/lib/helpers/analytics-events";
import { useDebouncedCallback } from "use-debounce";
import { useRouter } from "next/navigation";

interface PropertyTypeSelectionProps {
  selectedType?: PropertyTypeV3 | null;
  onSelect: (type: PropertyTypeV3) => void;
  onContinue?: () => void;
  stepNumber?: number;
  totalSteps?: number;
  mode?: "fast" | "full";
  onModeChange?: (mode: "fast" | "full") => void;
  onBack?: () => void;
}

// Mapping des icônes lucide-react par type
const TYPE_ICONS: Record<PropertyTypeV3, typeof Home> = {
  appartement: Building2,
  maison: Home,
  studio: Home,
  colocation: Users,
  saisonnier: Home,
  parking: Car,
  box: Car,
  local_commercial: Store,
  bureaux: Building2,
  entrepot: Warehouse,
  fonds_de_commerce: Store,
};

// Groupes de filtres
const FILTER_GROUPS = [
  { id: "all", label: "Tous" },
  { id: "habitation", label: "Habitation" },
  { id: "parking", label: "Parking & Box" },
  { id: "locaux", label: "Commercial" },
] as const;

type FilterGroup = typeof FILTER_GROUPS[number]["id"];

// Flatten all types for filtering
const ALL_TYPES = [
  ...PROPERTY_TYPE_GROUPS.habitation,
  ...PROPERTY_TYPE_GROUPS.parking,
  ...PROPERTY_TYPE_GROUPS.locaux,
].map((item) => ({
  ...item,
  icon: TYPE_ICONS[item.value],
  group: 
    PROPERTY_TYPE_GROUPS.habitation.some(t => t.value === item.value) ? "habitation" :
    PROPERTY_TYPE_GROUPS.parking.some(t => t.value === item.value) ? "parking" :
    "locaux",
}));

// Helper pour calculer les colonnes selon breakpoint
function computeCols(width: number): number {
  if (width < 640) return 1; // sm
  if (width < 768) return 2; // md
  if (width < 1280) return 3; // lg
  return 4; // xl
}

// Composant FilterBar sticky
function FilterBar({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: {
  activeFilter: FilterGroup;
  onFilterChange: (filter: FilterGroup) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  const debouncedSearch = useDebouncedCallback((value: string) => {
    onSearchChange(value);
    if (value.length > 0) {
      emitAnalyticsEvent(PropertyWizardEvents.TYPE_SEARCH_USED, {
        query_length: value.length,
      });
    }
  }, 120);

  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
      <div className="flex flex-col gap-3">
        {/* Pills filters */}
        <div className="flex flex-wrap gap-2" role="tablist">
          {FILTER_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={activeFilter === group.id}
              onClick={() => {
                onFilterChange(group.id);
                if (group.id !== "all") {
                  emitAnalyticsEvent(PropertyWizardEvents.TYPE_FILTER_USED, {
                    group: group.id,
                  });
                }
              }}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                activeFilter === group.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {group.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher un type de bien..."
            value={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              debouncedSearch(value);
            }}
            className="pl-9 pr-9"
            aria-label="Rechercher un type de bien"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                debouncedSearch("");
                onSearchChange("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Composant TypeCard amélioré (avec forwardRef pour AnimatePresence)
const TypeCard = forwardRef<HTMLDivElement, {
  type: PropertyTypeV3;
  label: string;
  icon: typeof Home;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
  totalCols: number;
  isGridFocused?: boolean;
}>(({
  type,
  label,
  icon: Icon,
  isSelected,
  onSelect,
  index,
  totalCols,
  isGridFocused = false,
}, ref) => {
  const reducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? false;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ 
        duration: shouldReduceMotion ? 0 : 0.22,
        delay: shouldReduceMotion ? 0 : index * 0.03,
      }}
      className="w-full"
    >
      <motion.button
        type="button"
        role="option"
        aria-pressed={isSelected}
        aria-label={`${label}${isSelected ? " (sélectionné)" : ""}`}
        data-index={index}
        onClick={onSelect}
        tabIndex={isGridFocused ? 0 : -1}
        className={cn(
          "relative w-full rounded-2xl border-2 transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "min-h-[120px] min-w-[120px]",
          isSelected
            ? "border-primary/70 bg-primary/5 shadow-sm"
            : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
        )}
        whileHover={shouldReduceMotion ? {} : { y: -2, scale: 1.01 }}
        whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
        transition={{ duration: 0.22 }}
      >
        <CardContent className="p-6 h-full flex flex-col items-center justify-center gap-3">
          {/* Icon */}
          <motion.div
            animate={isSelected && !shouldReduceMotion ? { scale: 1.1 } : { scale: 1 }}
            transition={{ duration: 0.22 }}
          >
            <Icon className="h-8 w-8 text-primary" />
          </motion.div>

          {/* Label */}
          <h3 className="text-sm font-semibold text-center">{label}</h3>

          {/* Badge "Sélectionné" */}
          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <Badge variant="default" className="text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Sélectionné
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </motion.button>
    </motion.div>
  );
});

TypeCard.displayName = "TypeCard";

// Empty state component
function EmptyState({ onClearFilter }: { onClearFilter: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12"
    >
      <p className="text-muted-foreground mb-4">Aucun type de bien trouvé</p>
      <Button variant="outline" onClick={onClearFilter}>
        Effacer le filtre
      </Button>
    </motion.div>
  );
}

export function PropertyTypeSelection({
  selectedType,
  onSelect,
  onContinue,
  stepNumber = 1,
  totalSteps = 8,
  mode = "full",
  onModeChange,
  onBack,
}: PropertyTypeSelectionProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? false;
  
  const [activeFilter, setActiveFilter] = useState<FilterGroup>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [windowWidth, setWindowWidth] = useState(1024);
  const [isGridFocused, setIsGridFocused] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const canContinue = selectedType !== null && selectedType !== undefined;

  // Compute columns based on window width
  const totalCols = useMemo(() => computeCols(windowWidth), [windowWidth]);

  // Update window width on resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle select with analytics
  const handleSelect = useCallback((type: PropertyTypeV3) => {
    onSelect(type);
    setFocusedIndex(null);
    
    // Émettre l'événement analytics de sélection
    emitAnalyticsEvent(PropertyWizardEvents.TYPE_SELECTED, {
      type_bien: type,
      mode,
    });
  }, [onSelect, mode]);

  // Filter types based on active filter and search
  const filteredTypes = useMemo(() => {
    let filtered = ALL_TYPES;

    // Apply group filter
    if (activeFilter !== "all") {
      filtered = filtered.filter((item) => item.group === activeFilter);
    }

    // Apply search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.value.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activeFilter, debouncedSearchQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredTypes.length === 0) return;

      const currentIndex = focusedIndex ?? (selectedType ? filteredTypes.findIndex(t => t.value === selectedType) : -1);
      const startIndex = currentIndex < 0 ? 0 : currentIndex;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          const nextIndex = Math.min(startIndex + 1, filteredTypes.length - 1);
          setFocusedIndex(nextIndex);
          setIsGridFocused(true);
          requestAnimationFrame(() => {
            const nextCard = gridRef.current?.querySelector(`button[data-index="${nextIndex}"]`) as HTMLElement;
            nextCard?.focus();
          });
          break;
        case "ArrowLeft":
          e.preventDefault();
          const prevIndex = Math.max(startIndex - 1, 0);
          setFocusedIndex(prevIndex);
          setIsGridFocused(true);
          requestAnimationFrame(() => {
            const prevCard = gridRef.current?.querySelector(`button[data-index="${prevIndex}"]`) as HTMLElement;
            prevCard?.focus();
          });
          break;
        case "ArrowDown":
          e.preventDefault();
          const downIndex = Math.min(startIndex + totalCols, filteredTypes.length - 1);
          setFocusedIndex(downIndex);
          setIsGridFocused(true);
          requestAnimationFrame(() => {
            const downCard = gridRef.current?.querySelector(`button[data-index="${downIndex}"]`) as HTMLElement;
            downCard?.focus();
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          const upIndex = Math.max(startIndex - totalCols, 0);
          setFocusedIndex(upIndex);
          setIsGridFocused(true);
          requestAnimationFrame(() => {
            const upCard = gridRef.current?.querySelector(`button[data-index="${upIndex}"]`) as HTMLElement;
            upCard?.focus();
          });
          break;
        case "Enter":
          e.preventDefault();
          if (focusedIndex !== null && focusedIndex >= 0 && filteredTypes[focusedIndex]) {
            handleSelect(filteredTypes[focusedIndex].value);
          } else if (selectedType && canContinue) {
            onContinue?.();
          }
          break;
      }
    },
    [filteredTypes, focusedIndex, selectedType, canContinue, totalCols, onContinue, handleSelect, setIsGridFocused]
  );

  // Émettre l'événement analytics au montage
  useEffect(() => {
    emitAnalyticsEvent(PropertyWizardEvents.TYPE_STEP_VIEW, {
      mode,
      step_number: stepNumber,
      total_steps: totalSteps,
    });
  }, [mode, stepNumber, totalSteps]);

  // Prefetch next step when type is selected
  useEffect(() => {
    if (selectedType) {
      router.prefetch("/app/owner/property/new?step=address");
    }
  }, [selectedType, router]);

  const handleClearFilter = () => {
    setActiveFilter("all");
    setSearchQuery("");
    setDebouncedSearchQuery("");
  };

  return (
    <WizardStepLayout
      title="Ajouter un bien"
      description="Étape 1 — Sélectionnez le type de bien."
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      mode={mode}
      onModeChange={onModeChange}
      progressValue={(stepNumber / totalSteps) * 100}
      onBack={onBack}
      onNext={canContinue ? () => {
        emitAnalyticsEvent(PropertyWizardEvents.CTA_CONTINUE_CLICK, {
          step: "TYPE",
          mode,
        });
        onContinue?.();
      } : undefined}
      canGoNext={canContinue}
      nextLabel="Continuer"
      microCopy="Parfait, on passe à l'adresse ✨"
      showModeSwitch={true}
    >
      <div className="space-y-6">
        {/* FilterBar sticky */}
        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          searchQuery={searchQuery}
          onSearchChange={setDebouncedSearchQuery}
        />

        {/* Grid */}
        <div
          ref={gridRef}
          role="listbox"
          aria-label="Types de biens disponibles"
          onKeyDown={handleKeyDown}
          onFocus={() => setIsGridFocused(true)}
          onBlur={(e) => {
            // Only blur if focus is not moving to a child
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsGridFocused(false);
            }
          }}
          tabIndex={0}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
        >
          <AnimatePresence mode="popLayout">
            {filteredTypes.length > 0 ? (
              filteredTypes.map((item, index) => (
                <TypeCard
                  key={item.value}
                  type={item.value}
                  label={item.label}
                  icon={item.icon}
                  isSelected={selectedType === item.value}
                  onSelect={() => handleSelect(item.value)}
                  index={index}
                  totalCols={totalCols}
                  isGridFocused={isGridFocused}
                />
              ))
            ) : (
              <EmptyState key="empty" onClearFilter={handleClearFilter} />
            )}
          </AnimatePresence>
        </div>

        {/* Info card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.22 }}
          className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4"
        >
          <p className="text-sm text-foreground">
            <strong className="font-semibold text-primary">Le questionnaire s'adapte automatiquement</strong> selon le type de bien sélectionné.
          </p>
        </motion.div>
      </div>
    </WizardStepLayout>
  );
}
