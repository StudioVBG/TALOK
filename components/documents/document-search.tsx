"use client";

/**
 * Composant de recherche full-text pour les documents
 * Utilise l'index GIN PostgreSQL pour une recherche rapide
 */

import { useState, useCallback } from "react";
import { Search, X, Filter, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DocumentSearchProps {
  onSearch: (query: string) => void;
  onCategoryFilter?: (category: string | null) => void;
  placeholder?: string;
  className?: string;
}

const CATEGORY_FILTERS = [
  { value: null, label: "Tous", color: "bg-slate-100" },
  { value: "identite", label: "Identité", color: "bg-slate-100" },
  { value: "contrat", label: "Contrats", color: "bg-blue-100" },
  { value: "finance", label: "Finances", color: "bg-emerald-100" },
  { value: "assurance", label: "Assurances", color: "bg-cyan-100" },
  { value: "diagnostic", label: "Diagnostics", color: "bg-orange-100" },
  { value: "edl", label: "États des lieux", color: "bg-purple-100" },
];

export function DocumentSearch({
  onSearch,
  onCategoryFilter,
  placeholder = "Rechercher un document...",
  className,
}: DocumentSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    onSearch(value);
  }, [onSearch]);

  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category);
    onCategoryFilter?.(category);
  }, [onCategoryFilter]);

  const clearSearch = useCallback(() => {
    setQuery("");
    onSearch("");
  }, [onSearch]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Barre de recherche */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 pr-10 bg-white/80 backdrop-blur-sm"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={clearSearch}
            aria-label="Effacer la recherche"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filtre par catégorie */}
      {onCategoryFilter && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {selectedCategory ? (
                <Badge variant="secondary" className="font-normal">
                  {CATEGORY_FILTERS.find(c => c.value === selectedCategory)?.label}
                </Badge>
              ) : (
                "Filtrer"
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Catégorie</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CATEGORY_FILTERS.map(cat => (
              <DropdownMenuItem
                key={cat.value || "all"}
                onClick={() => handleCategorySelect(cat.value)}
                className={cn(
                  "cursor-pointer",
                  selectedCategory === cat.value && "bg-slate-100"
                )}
              >
                <div className={cn("h-2 w-2 rounded-full mr-2", cat.color)} />
                {cat.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default DocumentSearch;

