/**
 * @deprecated Ce fichier est OBSOLÈTE et n'est plus utilisé.
 * Le wizard actif utilise: features/properties/components/v3/immersive/steps/AddressStep.tsx
 * Ce fichier sera supprimé dans une future version.
 * 
 * AddressStep - Composant de saisie d'adresse V3 avec autocomplete animé (ANCIEN)
 */

"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Check, AlertCircle } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { StepHeader, UnifiedInput, UnifiedHelpMessage, UnifiedFormContainer } from "@/lib/design-system/wizard-components";
import { containerVariants } from "@/lib/design-system/animations";

interface AddressStepProps {
  adresse_complete?: string;
  complement_adresse?: string;
  code_postal?: string;
  ville?: string;
  departement?: string;
  latitude?: number | null;
  longitude?: number | null;
  onChange: (data: {
    adresse_complete?: string;
    complement_adresse?: string;
    code_postal?: string;
    ville?: string;
    departement?: string;
    latitude?: number | null;
    longitude?: number | null;
  }) => void;
  errors?: {
    adresse_complete?: string;
    complement_adresse?: string;
    code_postal?: string;
    ville?: string;
  };
}

// Codes postaux français et DROM (simplifié - à remplacer par API externe si besoin)
// Source : Modèle V3 mentionne France + DROM
const FRENCH_DEPARTMENTS = [
  { code: "972", name: "Martinique", postalCodes: ["97200", "97220", "97232", "97250"] },
  { code: "971", name: "Guadeloupe", postalCodes: ["97100", "97110", "97130"] },
  { code: "973", name: "Guyane", postalCodes: ["97300", "97310"] },
  { code: "974", name: "Réunion", postalCodes: ["97400", "97410", "97420"] },
  { code: "976", name: "Mayotte", postalCodes: ["97600", "97610"] },
  { code: "75", name: "Paris", postalCodes: Array.from({ length: 20 }, (_, i) => `750${String(i + 1).padStart(2, "0")}`) },
  // ... autres départements
] as const;

// Mapping code postal -> ville (simplifié)
const POSTAL_CODE_TO_CITY: Record<string, string[]> = {
  "97200": ["Fort-de-France"],
  "97220": ["Le Robert", "La Trinité", "Le François"],
  "97232": ["Le Lamentin"],
  "97250": ["Sainte-Marie", "Le Marigot"],
  "97100": ["Basse-Terre"],
  "97400": ["Saint-Denis"],
  "75001": ["Paris 1er"],
  "75002": ["Paris 2e"],
  // ... autres mappings
};

interface AddressSuggestion {
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement: string;
}

// Composant de suggestion animée
function SuggestionItem({
  suggestion,
  onSelect,
  isHighlighted,
}: {
  suggestion: AddressSuggestion;
  onSelect: () => void;
  isHighlighted: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
        isHighlighted
          ? "border-primary bg-primary/5"
          : "border-border/50 bg-background/80 backdrop-blur-sm hover:border-primary/50 hover:bg-primary/2"
      }`}
    >
      <div className="flex items-center gap-3">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium">{suggestion.adresse_complete}</p>
          <p className="text-sm text-muted-foreground">
            {suggestion.code_postal} {suggestion.ville} ({suggestion.departement})
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// Composant de champ avec validation inline
function AddressField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  type = "text",
  maxLength,
  suggestions,
  onSelectSuggestion,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  type?: string;
  maxLength?: number;
  suggestions?: AddressSuggestion[];
  onSelectSuggestion?: (suggestion: AddressSuggestion) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const showSuggestions = isFocused && suggestions && suggestions.length > 0;

  // Navigation au clavier dans les suggestions
  useEffect(() => {
    if (!showSuggestions) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, suggestions!.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && suggestions![highlightedIndex] && onSelectSuggestion) {
        e.preventDefault();
        onSelectSuggestion(suggestions![highlightedIndex]);
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSuggestions, highlightedIndex, suggestions, onSelectSuggestion]);

  return (
    <div className="space-y-3">
      <Label htmlFor={id} className="flex items-center gap-2 text-base font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive font-bold">*</span>}
      </Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type={type}
          value={value}
          onChange={(e) => {
            const newValue = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
            onChange(newValue);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)} // Délai pour permettre le clic
          placeholder={placeholder}
          required={required}
          className={`text-base h-12 transition-all ${
            error ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
        />
        {!error && value && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <Check className="h-4 w-4 text-green-500" />
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <AlertCircle className="h-4 w-4 text-destructive" />
          </motion.div>
        )}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-base font-medium text-destructive"
        >
          {error}
        </motion.p>
      )}
      {/* Suggestions animées */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 mt-1 max-h-64 w-full space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-background/95 p-2 shadow-lg backdrop-blur-sm"
          >
            {suggestions.map((suggestion, index) => (
              <SuggestionItem
                key={`${suggestion.code_postal}-${suggestion.ville}-${index}`}
                suggestion={suggestion}
                onSelect={() => {
                  onSelectSuggestion?.(suggestion);
                  setIsFocused(false);
                }}
                isHighlighted={index === highlightedIndex}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AddressStep({ adresse_complete = "", complement_adresse = "", code_postal = "", ville = "", departement = "", onChange, errors }: AddressStepProps) {
  const [localAdresse, setLocalAdresse] = useState(adresse_complete);
  const [localComplement, setLocalComplement] = useState(complement_adresse);
  const [localCodePostal, setLocalCodePostal] = useState(code_postal);
  const [localVille, setLocalVille] = useState(ville);
  const [localDepartement, setLocalDepartement] = useState(departement);

  // Debounce pour les suggestions d'adresse
  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    // NOTE: Intégration future avec API de géolocalisation
    // Options disponibles :
    // - Geoapify (https://www.geoapify.com/) : 3000 requêtes/jour gratuites
    // - Algolia Places (https://www.algolia.com/products/places/) : 1000 requêtes/mois gratuites
    // - Google Places API : Payant mais très complet
    // 
    // Exemple d'implémentation avec Geoapify :
    // const response = await fetch(
    //   `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${process.env.NEXT_PUBLIC_GEOAPIFY_KEY}&limit=5`
    // );
    // const data = await response.json();
    // return data.features.map(f => ({ adresse_complete: f.properties.formatted, ... }));
    //
    // Pour l'instant, suggestions basées sur le code postal uniquement
  }, 300);

  // Suggestions basées sur le code postal
  const suggestions = useMemo(() => {
    if (!localCodePostal || localCodePostal.length < 4) return [];
    const cities = POSTAL_CODE_TO_CITY[localCodePostal] || [];
    return cities.map((city) => ({
      adresse_complete: localAdresse || "",
      code_postal: localCodePostal,
      ville: city,
      departement: localCodePostal.slice(0, 2),
    })) as AddressSuggestion[];
  }, [localCodePostal, localAdresse]);

  // Auto-complétion ville depuis code postal
  useEffect(() => {
    if (localCodePostal.length === 5 && !localVille) {
      const cities = POSTAL_CODE_TO_CITY[localCodePostal];
      if (cities && cities.length === 1) {
        setLocalVille(cities[0]);
        const dept = localCodePostal.slice(0, 2);
        setLocalDepartement(dept);
        onChange({
          ville: cities[0],
          departement: dept,
          code_postal: localCodePostal,
        });
      }
    }
  }, [localCodePostal, localVille, onChange]);

  // Synchronisation avec le parent
  const updateParent = (updates: Partial<typeof onChange extends (data: infer T) => void ? T : never>) => {
    onChange({
      adresse_complete: localAdresse,
      complement_adresse: localComplement,
      code_postal: localCodePostal,
      ville: localVille,
      departement: localDepartement,
      ...updates,
    });
  };

  useEffect(() => {
    updateParent({});
  }, [localAdresse, localComplement, localCodePostal, localVille, localDepartement]);

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    setLocalAdresse(suggestion.adresse_complete);
    setLocalCodePostal(suggestion.code_postal);
    setLocalVille(suggestion.ville);
    setLocalDepartement(suggestion.departement);
    onChange({
      adresse_complete: suggestion.adresse_complete,
      code_postal: suggestion.code_postal,
      ville: suggestion.ville,
      departement: suggestion.departement,
    });
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      {/* Titre et description */}
      <StepHeader
        title="Localisez précisément le bien"
        description="L'adresse complète accélère les diagnostics et la mise en location"
        icon={<MapPin className="h-6 w-6 text-primary" />}
      />

      {/* Formulaire d'adresse */}
      <UnifiedFormContainer>
        {/* Adresse complète */}
        <AddressField
          id="adresse_complete"
          label="Adresse complète"
          value={localAdresse}
          onChange={(value) => {
            setLocalAdresse(value);
            debouncedSearch(value);
          }}
          placeholder="Ex: 12 Rue du Parc"
          required
          error={errors?.adresse_complete}
          suggestions={suggestions}
          onSelectSuggestion={handleSelectSuggestion}
        />

        {/* Complément d'adresse */}
        <AddressField
          id="complement_adresse"
          label="Complément d'adresse"
          value={localComplement}
          onChange={setLocalComplement}
          placeholder="Ex: Bâtiment B, 3e étage"
          error={errors?.complement_adresse}
        />

        {/* Code postal, Ville, Département */}
        <div className="grid gap-4 md:grid-cols-3">
          <AddressField
            id="code_postal"
            label="Code postal"
            value={localCodePostal}
            onChange={(value) => {
              const numeric = value.replace(/\D/g, "").slice(0, 5);
              setLocalCodePostal(numeric);
              if (numeric.length === 5) {
                const cities = POSTAL_CODE_TO_CITY[numeric];
                if (cities && cities.length === 1) {
                  setLocalVille(cities[0]);
                  setLocalDepartement(numeric.slice(0, 2));
                }
              }
            }}
            placeholder="97200"
            required
            error={errors?.code_postal}
            type="text"
            maxLength={5}
          />

          <AddressField
            id="ville"
            label="Ville"
            value={localVille}
            onChange={setLocalVille}
            placeholder="Fort-de-France"
            required
            error={errors?.ville}
            suggestions={suggestions}
            onSelectSuggestion={handleSelectSuggestion}
          />

          <AddressField
            id="departement"
            label="Département"
            value={localDepartement}
            onChange={(value) => {
              const upper = value.toUpperCase().slice(0, 2);
              setLocalDepartement(upper);
            }}
            placeholder="972"
            type="text"
            maxLength={2}
          />
        </div>

        {/* Message d'aide */}
        <UnifiedHelpMessage
          icon="💡"
          message="Les coordonnées GPS seront calculées automatiquement pour faciliter la localisation sur les cartes."
          variant="info"
        />
      </UnifiedFormContainer>
    </motion.div>
  );
}

