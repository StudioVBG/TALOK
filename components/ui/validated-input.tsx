"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, AlertCircle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ValidationRule {
  validate: (value: string | number | undefined) => boolean;
  message: string;
}

interface ValidatedInputProps {
  id: string;
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: "text" | "number" | "email" | "tel";
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  tooltip?: string;
  rules?: ValidationRule[];
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
  inputClassName?: string;
  showSuccessState?: boolean;
  debounceMs?: number;
}

export function ValidatedInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  helpText,
  tooltip,
  rules = [],
  prefix,
  suffix,
  className,
  inputClassName,
  showSuccessState = true,
  debounceMs = 300,
}: ValidatedInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Valider la valeur
  const validate = useCallback((val: string | number | undefined): string | null => {
    // Required check
    if (required && (val === undefined || val === "" || val === null)) {
      return "Ce champ est requis";
    }

    // Custom rules
    for (const rule of rules) {
      if (!rule.validate(val)) {
        return rule.message;
      }
    }

    return null;
  }, [required, rules]);

  // Valider après debounce
  useEffect(() => {
    if (!isTouched) return;

    setIsValidating(true);
    const timeout = setTimeout(() => {
      const validationError = validate(value);
      setError(validationError);
      setIsValidating(false);
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [value, isTouched, validate, debounceMs]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setIsTouched(true);
    // Validation immédiate au blur
    const validationError = validate(value);
    setError(validationError);
  };

  const isValid = isTouched && !error && !isValidating && value !== undefined && value !== "";
  const showError = isTouched && error && !isFocused;
  const showSuccess = showSuccessState && isValid && !isFocused;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <div className="flex items-center gap-2">
        <Label 
          htmlFor={id} 
          className="text-sm font-medium"
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Input avec indicateurs */}
      <div className="relative">
        {/* Prefix */}
        {prefix && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {prefix}
          </div>
        )}

        <Input
          {...({} as any)}
          id={id}
          type={type}
          value={value ?? ""}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-invalid={showError}
          aria-describedby={`${id}-error ${id}-help`}
          className={cn(
            "transition-all duration-200",
            prefix && "pl-10",
            suffix && "pr-10",
            showError && "border-destructive focus-visible:ring-destructive",
            showSuccess && "border-green-500 focus-visible:ring-green-500",
            inputClassName
          )}
        />

        {/* Suffix */}
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {suffix}
          </div>
        )}

        {/* Indicateurs de validation (remplacent le suffix si présent) */}
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 pointer-events-none",
          suffix ? "right-10" : "right-3"
        )}>
          <AnimatePresence mode="wait">
            {isValidating && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
              />
            )}
            {showSuccess && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
              >
                <Check className="h-4 w-4 text-green-500" />
              </motion.div>
            )}
            {showError && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
              >
                <AlertCircle className="h-4 w-4 text-destructive" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-[20px]">
        <AnimatePresence mode="wait">
          {showError && (
            <motion.p
              key="error"
              id={`${id}-error`}
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="text-sm text-destructive flex items-center gap-1"
              role="alert"
            >
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              {error}
            </motion.p>
          )}
          {!showError && helpText && (
            <motion.p
              key="help"
              id={`${id}-help`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground"
            >
              {helpText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Règles de validation pré-définies
export const ValidationRules = {
  minLength: (min: number): ValidationRule => ({
    validate: (value) => String(value || "").length >= min,
    message: `Minimum ${min} caractères requis`,
  }),
  maxLength: (max: number): ValidationRule => ({
    validate: (value) => String(value || "").length <= max,
    message: `Maximum ${max} caractères autorisés`,
  }),
  min: (min: number): ValidationRule => ({
    validate: (value) => Number(value) >= min,
    message: `La valeur minimum est ${min}`,
  }),
  max: (max: number): ValidationRule => ({
    validate: (value) => Number(value) <= max,
    message: `La valeur maximum est ${max}`,
  }),
  postalCodeFR: (): ValidationRule => ({
    validate: (value) => /^[0-9]{5}$/.test(String(value || "")),
    message: "Format invalide (5 chiffres attendus)",
  }),
  email: (): ValidationRule => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")),
    message: "Adresse email invalide",
  }),
  phone: (): ValidationRule => ({
    validate: (value) => /^[0-9+\s()-]{10,}$/.test(String(value || "")),
    message: "Numéro de téléphone invalide",
  }),
  positive: (): ValidationRule => ({
    validate: (value) => Number(value) > 0,
    message: "La valeur doit être positive",
  }),
};

