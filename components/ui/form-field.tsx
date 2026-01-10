/**
 * FormField SOTA 2026 - Composant de champ de formulaire accessible
 *
 * Combine Label + Input/Select/Textarea + Error + Helper + ARIA
 * Garantit la cohérence accessibilité WCAG 2.1 AA
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, HelpCircle, CheckCircle2 } from "lucide-react";

// Types
interface BaseFieldProps {
  /** ID unique du champ (généré automatiquement si non fourni) */
  id?: string;
  /** Label du champ */
  label: string;
  /** Nom du champ pour les formulaires */
  name: string;
  /** Message d'erreur */
  error?: string;
  /** Texte d'aide sous le champ */
  helperText?: string;
  /** Tooltip d'aide (icône ?) */
  tooltip?: string;
  /** Champ requis */
  required?: boolean;
  /** Champ désactivé */
  disabled?: boolean;
  /** Afficher l'état de succès */
  showSuccess?: boolean;
  /** Classes CSS additionnelles */
  className?: string;
  /** Classes CSS pour le wrapper */
  wrapperClassName?: string;
}

interface InputFieldProps extends BaseFieldProps {
  type: "text" | "email" | "password" | "number" | "tel" | "url" | "date";
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "url" | "numeric" | "decimal";
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  pattern?: string;
}

interface TextareaFieldProps extends BaseFieldProps {
  type: "textarea";
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  maxLength?: number;
  showCharCount?: boolean;
}

interface SelectFieldProps extends BaseFieldProps {
  type: "select";
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

type FormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

/**
 * Hook pour générer un ID unique
 */
function useUniqueId(providedId?: string): string {
  const generatedId = React.useId();
  return providedId || `field-${generatedId}`;
}

/**
 * Composant FormField accessible
 */
export function FormField(props: FormFieldProps) {
  const {
    label,
    name,
    error,
    helperText,
    tooltip,
    required = false,
    disabled = false,
    showSuccess = false,
    className,
    wrapperClassName,
  } = props;

  const fieldId = useUniqueId(props.id);
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;

  // Construire aria-describedby
  const ariaDescribedBy = [
    error ? errorId : null,
    helperText ? helperId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  // Déterminer l'état visuel
  const hasError = Boolean(error);
  const isSuccess = showSuccess && !hasError;

  return (
    <div className={cn("space-y-2", wrapperClassName)}>
      {/* Label avec indicateur requis et tooltip */}
      <div className="flex items-center gap-1.5">
        <Label
          htmlFor={fieldId}
          className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            hasError && "text-destructive"
          )}
        >
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </Label>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Aide pour ${label}`}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Champ selon le type */}
      <div className="relative">
        {props.type === "textarea" ? (
          <TextareaField
            {...props}
            fieldId={fieldId}
            ariaDescribedBy={ariaDescribedBy}
            hasError={hasError}
            className={className}
          />
        ) : props.type === "select" ? (
          <SelectField
            {...props}
            fieldId={fieldId}
            ariaDescribedBy={ariaDescribedBy}
            hasError={hasError}
            className={className}
          />
        ) : (
          <InputField
            {...props}
            fieldId={fieldId}
            ariaDescribedBy={ariaDescribedBy}
            hasError={hasError}
            isSuccess={isSuccess}
            className={className}
          />
        )}

        {/* Icône d'état */}
        {(hasError || isSuccess) && props.type !== "select" && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {hasError ? (
              <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {/* Message d'erreur */}
      {hasError && (
        <p
          id={errorId}
          className="text-sm text-destructive flex items-center gap-1"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Texte d'aide */}
      {helperText && !hasError && (
        <p id={helperId} className="text-sm text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  );
}

/**
 * Sous-composant Input
 */
function InputField({
  fieldId,
  ariaDescribedBy,
  hasError,
  isSuccess,
  name,
  required,
  disabled,
  className,
  type,
  placeholder,
  value,
  onChange,
  onBlur,
  autoComplete,
  inputMode,
  min,
  max,
  step,
  maxLength,
  pattern,
}: InputFieldProps & {
  fieldId: string;
  ariaDescribedBy?: string;
  hasError: boolean;
  isSuccess: boolean;
}) {
  return (
    <Input
      id={fieldId}
      name={name}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      required={required}
      disabled={disabled}
      autoComplete={autoComplete}
      inputMode={inputMode}
      min={min}
      max={max}
      step={step}
      maxLength={maxLength}
      pattern={pattern}
      aria-invalid={hasError}
      aria-required={required}
      aria-describedby={ariaDescribedBy}
      className={cn(
        hasError && "border-destructive focus-visible:ring-destructive",
        isSuccess && "border-green-500 focus-visible:ring-green-500",
        (hasError || isSuccess) && "pr-10",
        className
      )}
    />
  );
}

/**
 * Sous-composant Textarea
 */
function TextareaField({
  fieldId,
  ariaDescribedBy,
  hasError,
  name,
  required,
  disabled,
  className,
  placeholder,
  value,
  onChange,
  onBlur,
  rows = 3,
  maxLength,
  showCharCount,
}: TextareaFieldProps & {
  fieldId: string;
  ariaDescribedBy?: string;
  hasError: boolean;
}) {
  const charCount = typeof value === "string" ? value.length : 0;

  return (
    <div className="relative">
      <Textarea
        id={fieldId}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={hasError}
        aria-required={required}
        aria-describedby={ariaDescribedBy}
        className={cn(
          hasError && "border-destructive focus-visible:ring-destructive",
          showCharCount && maxLength && "pb-6",
          className
        )}
      />
      {showCharCount && maxLength && (
        <span
          className={cn(
            "absolute bottom-2 right-2 text-xs",
            charCount > maxLength * 0.9
              ? "text-destructive"
              : "text-muted-foreground"
          )}
          aria-live="polite"
        >
          {charCount}/{maxLength}
        </span>
      )}
    </div>
  );
}

/**
 * Sous-composant Select
 */
function SelectField({
  fieldId,
  ariaDescribedBy,
  hasError,
  name,
  required,
  disabled,
  className,
  options,
  value,
  onChange,
  placeholder,
}: SelectFieldProps & {
  fieldId: string;
  ariaDescribedBy?: string;
  hasError: boolean;
}) {
  return (
    <Select
      name={name}
      value={value}
      onValueChange={onChange}
      required={required}
      disabled={disabled}
    >
      <SelectTrigger
        id={fieldId}
        aria-invalid={hasError}
        aria-required={required}
        aria-describedby={ariaDescribedBy}
        className={cn(
          hasError && "border-destructive focus:ring-destructive",
          className
        )}
      >
        <SelectValue placeholder={placeholder || "Sélectionner..."} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Export types pour usage externe
 */
export type { FormFieldProps, InputFieldProps, TextareaFieldProps, SelectFieldProps };
