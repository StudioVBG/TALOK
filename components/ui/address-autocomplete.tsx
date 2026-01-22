"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, CheckCircle2, Navigation, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { getDepartementCodeFromCP } from "@/lib/helpers/address-utils";

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
  showGeolocation?: boolean;
}

// Cache simple pour les résultats de recherche (évite les requêtes dupliquées)
const searchCache = new Map<string, AddressSuggestion[]>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

function getCachedResult(query: string): AddressSuggestion[] | null {
  const cached = searchCache.get(query);
  const timestamp = cacheTimestamps.get(query);
  if (cached && timestamp && Date.now() - timestamp < CACHE_DURATION) {
    return cached;
  }
  return null;
}

function setCachedResult(query: string, results: AddressSuggestion[]) {
  searchCache.set(query, results);
  cacheTimestamps.set(query, Date.now());
  // Nettoyer le cache si trop grand
  if (searchCache.size > 100) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) {
      searchCache.delete(firstKey);
      cacheTimestamps.delete(firstKey);
    }
  }
}

// Fonction helper pour traiter les résultats de l'API
function processAddressResults(data: any, searchQuery: string): AddressSuggestion[] {
  if (data.features && data.features.length > 0) {
    const results = data.features.map((feature: any) => ({
      label: feature.properties.label,
      housenumber: feature.properties.housenumber,
      street: feature.properties.street,
      city: feature.properties.city,
      postcode: feature.properties.postcode,
      context: feature.properties.context,
      coordinates: feature.geometry.coordinates,
    }));
    return results;
  }
  return [];
}

export function AddressAutocomplete({
  value,
  onSelect,
  onChange,
  placeholder = "Rechercher une adresse...",
  className,
  showGeolocation = true,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSelected, setHasSelected] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Recherche API avec cache
  // SOTA 2026: Validation améliorée pour éviter les erreurs 400
  const searchAddress = useCallback(async (searchQuery: string) => {
    // 1. Nettoyer et valider la requête
    const trimmedQuery = searchQuery.trim();

    // 2. Vérifier longueur minimale après trim
    if (trimmedQuery.length < 3 || hasSelected) {
      setSuggestions([]);
      setNoResults(false);
      return;
    }

    // 3. Vérifier que la requête contient au moins une lettre
    // Évite les erreurs 400 pour les requêtes comme "01 " ou "123"
    if (!/[a-zA-ZÀ-ÿ]/.test(trimmedQuery)) {
      setSuggestions([]);
      setNoResults(false);
      return;
    }

    // 4. Vérifier que la requête n'est pas juste des espaces et chiffres
    const alphaContent = trimmedQuery.replace(/[\d\s]/g, '');
    if (alphaContent.length < 2) {
      setSuggestions([]);
      setNoResults(false);
      return;
    }

    // Vérifier le cache (utiliser trimmedQuery pour le cache)
    const cached = getCachedResult(trimmedQuery);
    if (cached) {
      setSuggestions(cached);
      setNoResults(cached.length === 0);
      setIsOpen(cached.length > 0);
      return;
    }

    setIsLoading(true);
    setNoResults(false);

    try {
      // Retirer le paramètre type=housenumber qui peut causer des erreurs 400
      // L'API retourne automatiquement les résultats les plus pertinents
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(trimmedQuery)}&limit=6&autocomplete=1`
      );
      
      if (!response.ok) {
        // Si erreur 400, réessayer sans autocomplete
        if (response.status === 400) {
          const fallbackResponse = await fetch(
            `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(trimmedQuery)}&limit=6`
          );
          if (!fallbackResponse.ok) {
            // Ne pas logger l'erreur pour les requêtes courtes, c'est normal
            setSuggestions([]);
            setNoResults(true);
            return;
          }
          const fallbackData = await fallbackResponse.json();
          const results = processAddressResults(fallbackData, trimmedQuery);
          setSuggestions(results);
          setCachedResult(trimmedQuery, results);
          setIsOpen(results.length > 0);
          setNoResults(results.length === 0);
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const results = processAddressResults(data, trimmedQuery);
      setSuggestions(results);
      setCachedResult(trimmedQuery, results);
      setIsOpen(results.length > 0);
      setNoResults(results.length === 0);
    } catch (error) {
      console.error("Address search error:", error);
      setSuggestions([]);
      setNoResults(true);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [hasSelected]);

  // Géolocalisation
  const handleGeolocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoError("Géolocalisation non supportée");
      return;
    }

    setIsGeolocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Reverse geocoding avec l'API BAN
          const response = await fetch(
            `https://api-adresse.data.gouv.fr/reverse/?lon=${position.coords.longitude}&lat=${position.coords.latitude}`
          );
          const data = await response.json();

          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            const suggestion: AddressSuggestion = {
              label: feature.properties.label,
              housenumber: feature.properties.housenumber,
              street: feature.properties.street,
              city: feature.properties.city,
              postcode: feature.properties.postcode,
              context: feature.properties.context,
              coordinates: feature.geometry.coordinates,
            };
            handleSelect(suggestion);
          } else {
            setGeoError("Adresse non trouvée");
          }
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          setGeoError("Erreur de géolocalisation");
        } finally {
          setIsGeolocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setGeoError(
          error.code === 1
            ? "Permission refusée"
            : error.code === 2
            ? "Position indisponible"
            : "Délai dépassé"
        );
        setIsGeolocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // Effet de recherche
  useEffect(() => {
    searchAddress(debouncedQuery);
  }, [debouncedQuery, searchAddress]);

  // Gérer la sélection
  const handleSelect = (suggestion: AddressSuggestion) => {
    // Utiliser le helper centralisé pour extraire le département
    const departementCode = getDepartementCodeFromCP(suggestion.postcode);

    setQuery(suggestion.label);
    setHasSelected(true);
    setSuggestions([]);
    setIsOpen(false);
    setNoResults(false);
    setGeoError(null);
    
    onSelect({
      adresse_complete: suggestion.label,
      ville: suggestion.city,
      code_postal: suggestion.postcode,
      departement: departementCode || undefined,
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
    setGeoError(null);
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
      <div className="relative flex gap-2">
        <div className="relative flex-1">
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
        
        {/* Bouton de géolocalisation */}
        {showGeolocation && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={handleGeolocation}
            disabled={isGeolocating}
            title="Utiliser ma position"
          >
            {isGeolocating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Message d'erreur géolocalisation */}
      <AnimatePresence>
        {geoError && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="mt-2 flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            {geoError}
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Message "Aucun résultat" */}
      <AnimatePresence>
        {noResults && query.length >= 3 && !isLoading && !hasSelected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg p-4"
          >
            <div className="flex items-center gap-3 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Aucune adresse trouvée pour "{query}"</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Essayez avec un numéro de rue ou vérifiez l'orthographe.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
