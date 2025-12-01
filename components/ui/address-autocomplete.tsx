"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface AddressSuggestion {
  label: string;
  housenumber?: string;
  street?: string;
  city: string;
  postcode: string;
  context: string;
  coordinates: [number, number]; // [lng, lat]
}

interface AddressAutocompleteProps {
  value: string;
  onSelect: (address: {
    adresse_complete: string;
    ville: string;
    code_postal: string;
    departement?: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onSelect,
  onChange,
  placeholder = "Rechercher une adresse...",
  className,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSelected, setHasSelected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Recherche API
  const searchAddress = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3 || hasSelected) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(searchQuery)}&limit=5&autocomplete=1`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        setSuggestions(
          data.features.map((feature: any) => ({
            label: feature.properties.label,
            housenumber: feature.properties.housenumber,
            street: feature.properties.street,
            city: feature.properties.city,
            postcode: feature.properties.postcode,
            context: feature.properties.context,
            coordinates: feature.geometry.coordinates,
          }))
        );
        setIsOpen(true);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Address search error:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [hasSelected]);

  // Effet de recherche
  useEffect(() => {
    searchAddress(debouncedQuery);
  }, [debouncedQuery, searchAddress]);

  // Gérer la sélection
  const handleSelect = (suggestion: AddressSuggestion) => {
    const departementCode = suggestion.postcode.startsWith("97")
      ? suggestion.postcode.substring(0, 3)
      : suggestion.postcode.substring(0, 2);

    setQuery(suggestion.label);
    setHasSelected(true);
    setSuggestions([]);
    setIsOpen(false);
    
    onSelect({
      adresse_complete: suggestion.label,
      ville: suggestion.city,
      code_postal: suggestion.postcode,
      departement: departementCode,
      latitude: suggestion.coordinates[1],
      longitude: suggestion.coordinates[0],
    });
  };

  // Gérer le changement de texte
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    setHasSelected(false);
    setSelectedIndex(-1);
    onChange?.(newValue);
  };

  // Navigation clavier
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Scroll vers l'élément sélectionné
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className={cn(
            "pl-9 pr-10 h-11 transition-all",
            hasSelected && "border-green-500 focus-visible:ring-green-500/50"
          )}
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : hasSelected ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </motion.div>
          ) : null}
        </div>
      </div>

      {/* Dropdown suggestions */}
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden"
          >
            <ul ref={listRef} className="py-1 max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.postcode}-${suggestion.label}-${index}`}
                  onClick={() => handleSelect(suggestion)}
                  className={cn(
                    "px-3 py-2.5 cursor-pointer transition-colors flex items-start gap-3",
                    selectedIndex === index
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <MapPin className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    selectedIndex === index ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{suggestion.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {suggestion.context}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-3 py-1.5 bg-muted/50 border-t">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                Données : api-adresse.data.gouv.fr
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

