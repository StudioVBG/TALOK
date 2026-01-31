import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Valeurs d'autocomplete courantes pour les formulaires
 * Conformes à la spécification HTML5 et WCAG 2.1
 */
export type AutocompleteValue =
  | "off"
  | "on"
  | "name"
  | "given-name"
  | "family-name"
  | "email"
  | "tel"
  | "tel-national"
  | "address-line1"
  | "address-line2"
  | "address-level1"
  | "address-level2"
  | "postal-code"
  | "country"
  | "country-name"
  | "bday"
  | "bday-day"
  | "bday-month"
  | "bday-year"
  | "sex"
  | "organization"
  | "organization-title"
  | "current-password"
  | "new-password"
  | "one-time-code"
  | "cc-name"
  | "cc-number"
  | "cc-exp"
  | "cc-exp-month"
  | "cc-exp-year"
  | "cc-csc"
  | "url"
  | "username";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Valeur d'autocomplete pour améliorer l'UX sur mobile
   */
  autoComplete?: AutocompleteValue | string;
  /**
   * Afficher une icône à gauche de l'input
   */
  leftIcon?: React.ReactNode;
  /**
   * Afficher une icône/bouton à droite de l'input
   */
  rightElement?: React.ReactNode;
  /**
   * État d'erreur visuel
   */
  error?: boolean;
  /**
   * Message d'erreur accessible
   */
  errorMessage?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      leftIcon,
      rightElement,
      error,
      errorMessage,
      ...props
    },
    ref
  ) => {
    const errorId = React.useId();
    const hasLeftIcon = !!leftIcon;
    const hasRightElement = !!rightElement;

    // Input de base sans wrapper si pas d'icônes
    if (!hasLeftIcon && !hasRightElement) {
      return (
        <input
          type={type}
          className={cn(
            "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
            "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error && errorMessage ? errorId : undefined}
          {...props}
        />
      );
    }

    // Input avec wrapper pour les icônes
    return (
      <div className="relative">
        {hasLeftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-11 w-full rounded-md border border-input bg-background py-2 text-sm text-foreground",
            "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            hasLeftIcon ? "pl-10 pr-3" : "px-3",
            hasRightElement && !hasLeftIcon && "pr-10",
            hasRightElement && hasLeftIcon && "pr-10",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error && errorMessage ? errorId : undefined}
          {...props}
        />
        {hasRightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
        {error && errorMessage && (
          <span id={errorId} className="sr-only">
            {errorMessage}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

/**
 * Inputs pré-configurés avec autocomplete
 */

interface SpecializedInputProps extends Omit<InputProps, "type" | "autoComplete"> {
  // Permet d'overrider l'autocomplete si nécessaire
  autoComplete?: AutocompleteValue | string;
}

export const EmailInput = React.forwardRef<HTMLInputElement, SpecializedInputProps>(
  (props, ref) => (
    <Input
      ref={ref}
      type="email"
      autoComplete="email"
      inputMode="email"
      {...props}
    />
  )
);
EmailInput.displayName = "EmailInput";

export const PhoneInput = React.forwardRef<HTMLInputElement, SpecializedInputProps>(
  (props, ref) => (
    <Input
      ref={ref}
      type="tel"
      autoComplete="tel"
      inputMode="tel"
      {...props}
    />
  )
);
PhoneInput.displayName = "PhoneInput";

export const PasswordInput = React.forwardRef<HTMLInputElement, SpecializedInputProps & { isNew?: boolean }>(
  ({ isNew = false, ...props }, ref) => (
    <Input
      ref={ref}
      type="password"
      autoComplete={isNew ? "new-password" : "current-password"}
      {...props}
    />
  )
);
PasswordInput.displayName = "PasswordInput";

export const NameInput = React.forwardRef<HTMLInputElement, SpecializedInputProps & { nameType?: "given" | "family" | "full" }>(
  ({ nameType = "full", ...props }, ref) => {
    const autocomplete = nameType === "given" ? "given-name" : nameType === "family" ? "family-name" : "name";
    return (
      <Input
        ref={ref}
        type="text"
        autoComplete={autocomplete}
        {...props}
      />
    );
  }
);
NameInput.displayName = "NameInput";

export const AddressInput = React.forwardRef<HTMLInputElement, SpecializedInputProps & { lineNumber?: 1 | 2 }>(
  ({ lineNumber = 1, ...props }, ref) => (
    <Input
      ref={ref}
      type="text"
      autoComplete={lineNumber === 1 ? "address-line1" : "address-line2"}
      {...props}
    />
  )
);
AddressInput.displayName = "AddressInput";

export const PostalCodeInput = React.forwardRef<HTMLInputElement, SpecializedInputProps>(
  (props, ref) => (
    <Input
      ref={ref}
      type="text"
      autoComplete="postal-code"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={5}
      {...props}
    />
  )
);
PostalCodeInput.displayName = "PostalCodeInput";

export const CityInput = React.forwardRef<HTMLInputElement, SpecializedInputProps>(
  (props, ref) => (
    <Input
      ref={ref}
      type="text"
      autoComplete="address-level2"
      {...props}
    />
  )
);
CityInput.displayName = "CityInput";

export const BirthDateInput = React.forwardRef<HTMLInputElement, SpecializedInputProps>(
  (props, ref) => (
    <Input
      ref={ref}
      type="date"
      autoComplete="bday"
      {...props}
    />
  )
);
BirthDateInput.displayName = "BirthDateInput";

export const AmountInput = React.forwardRef<HTMLInputElement, SpecializedInputProps & { currency?: string }>(
  ({ currency = "€", ...props }, ref) => (
    <Input
      ref={ref}
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      rightElement={<span className="text-muted-foreground text-sm">{currency}</span>}
      {...props}
    />
  )
);
AmountInput.displayName = "AmountInput";

export { Input };
