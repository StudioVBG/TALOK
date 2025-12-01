"use client";
// @ts-nocheck

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Check, AlertCircle } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import StepFrame from "../_components/StepFrame";
import WizardFooter from "../_components/WizardFooter";
import { useNewProperty } from "../_store/useNewProperty";
import { cn } from "@/lib/utils";
import { z } from "zod";

// Schéma de validation
const addressSchema = z.object({
  adresse_complete: z.string().min(1, "L'adresse complète est requise"),
  complement_adresse: z.string().optional().nullable(),
  code_postal: z.string().regex(/^[0-9]{5}$/, "Le code postal doit contenir 5 chiffres"),
  ville: z.string().min(1, "La ville est requise"),
  departement: z.string().length(2, "Le département doit contenir 2 caractères").optional().nullable(),
});

interface AddressSuggestion {
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement: string;
}

// Mapping simplifié code postal -> ville (à remplacer par API externe)
const POSTAL_CODE_TO_CITY: Record<string, string[]> = {
  "97200": ["Fort-de-France"],
  "97220": ["Le Robert", "La Trinité", "Le François"],
  "97232": ["Le Lamentin"],
  "97250": ["Sainte-Marie", "Le Marigot"],
  "97100": ["Basse-Terre"],
  "97400": ["Saint-Denis"],
  "75001": ["Paris 1er"],
  "75002": ["Paris 2e"],
  "75003": ["Paris 3e"],
  "75004": ["Paris 4e"],
  "75005": ["Paris 5e"],
  "75006": ["Paris 6e"],
  "75007": ["Paris 7e"],
  "75008": ["Paris 8e"],
  "75009": ["Paris 9e"],
  "75010": ["Paris 10e"],
  "75011": ["Paris 11e"],
  "75012": ["Paris 12e"],
  "75013": ["Paris 13e"],
  "75014": ["Paris 14e"],
  "75015": ["Paris 15e"],
  "75016": ["Paris 16e"],
  "75017": ["Paris 17e"],
  "75018": ["Paris 18e"],
  "75019": ["Paris 19e"],
  "75020": ["Paris 20e"],
};

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
  const reduced = useReducedMotion();

  const showSuggestions = isFocused && suggestions && suggestions.length > 0;

  // Navigation clavier dans les suggestions
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
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold">
        {label}
        {required && <span className="text-destructive">*</span>}
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
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          required={required}
          className={cn(
            "min-h-[44px]",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {!error && value && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <Check className="h-4 w-4 text-green-500" />
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
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
          transition={{ duration: reduced ? 0 : 0.2 }}
          id={`${id}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </motion.p>
      )}
      {/* Suggestions */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="absolute z-50 mt-1 max-h-64 w-full space-y-1 overflow-y-auto rounded-lg border bg-background p-2 shadow-lg"
          >
            {suggestions.map((suggestion, index) => (
              <motion.div
                key={`${suggestion.code_postal}-${suggestion.ville}-${index}`}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={reduced ? {} : { scale: 1.02, x: 4 }}
                whileTap={reduced ? {} : { scale: 0.98 }}
                onClick={() => {
                  onSelectSuggestion?.(suggestion);
                  setIsFocused(false);
                }}
                className={cn(
                  "cursor-pointer rounded-lg border p-3 transition-colors",
                  index === highlightedIndex
                    ? "border-primary bg-primary/5"
                    : "border-border/50 hover:border-primary/50 hover:bg-primary/2"
                )}
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
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AddressStep() {
  const { draft, patch, next, prev } = useNewProperty();
  const reduced = useReducedMotion();

  const [localAdresse, setLocalAdresse] = useState(draft.address?.adresse_complete || "");
  const [localComplement, setLocalComplement] = useState(draft.address?.complement_adresse || "");
  const [localCodePostal, setLocalCodePostal] = useState(draft.address?.code_postal || "");
  const [localVille, setLocalVille] = useState(draft.address?.ville || "");
  const [localDepartement, setLocalDepartement] = useState(draft.address?.departement || "");

  const [errors, setErrors] = useState<{
    adresse_complete?: string;
    code_postal?: string;
    ville?: string;
  }>({});

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
        patch({
          address: {
            adresse_complete: localAdresse,
            complement_adresse: localComplement,
            code_postal: localCodePostal,
            ville: cities[0],
            departement: dept,
          },
        });
      }
    }
  }, [localCodePostal, localVille, localAdresse, localComplement, patch]);

  // Mise à jour du store
  useEffect(() => {
    patch({
      address: {
        adresse_complete: localAdresse,
        complement_adresse: localComplement,
        code_postal: localCodePostal,
        ville: localVille,
        departement: localDepartement,
      },
    });
  }, [localAdresse, localComplement, localCodePostal, localVille, localDepartement, patch]);

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    setLocalAdresse(suggestion.adresse_complete);
    setLocalCodePostal(suggestion.code_postal);
    setLocalVille(suggestion.ville);
    setLocalDepartement(suggestion.departement);
    patch({
      address: {
        adresse_complete: suggestion.adresse_complete,
        complement_adresse: localComplement,
        code_postal: suggestion.code_postal,
        ville: suggestion.ville,
        departement: suggestion.departement,
      },
    });
  };

  const handleContinue = () => {
    // Validation
    const result = addressSchema.safeParse({
      adresse_complete: localAdresse,
      complement_adresse: localComplement,
      code_postal: localCodePostal,
      ville: localVille,
      departement: localDepartement,
    });

    if (!result.success) {
      const newErrors: typeof errors = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as keyof typeof errors] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    setErrors({});
    next();
  };

  const canContinue = localAdresse.length > 0 && localCodePostal.length === 5 && localVille.length > 0;

  return (
    <StepFrame k="ADDRESS">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Étape 2 — Adresse</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Localisez précisément le bien pour faciliter les diagnostics et la mise en location
          </p>
        </div>

        <div className="space-y-6">
          {/* Adresse complète */}
          <AddressField
            id="adresse_complete"
            label="Adresse complète"
            value={localAdresse}
            onChange={setLocalAdresse}
            placeholder="Ex: 12 Rue du Parc"
            required
            error={errors.adresse_complete}
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
              error={errors.code_postal}
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
              error={errors.ville}
              suggestions={suggestions}
              onSelectSuggestion={handleSelectSuggestion}
            />

            <AddressField
              id="departement"
              label="Département"
              value={localDepartement}
              onChange={(value) => {
                const upper = value.toUpperCase().replace(/\D/g, "").slice(0, 2);
                setLocalDepartement(upper);
              }}
              placeholder="972"
              type="text"
              maxLength={2}
            />
          </div>

          {/* Message d'aide */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Les coordonnées GPS seront calculées automatiquement pour faciliter la localisation sur les cartes.
            </p>
          </div>
        </div>
      </div>

      <WizardFooter
        primary="Continuer"
        onPrimary={handleContinue}
        onBack={prev}
        disabled={!canContinue}
        hint="Vous pourrez compléter plus tard."
      />
    </StepFrame>
  );
}
