import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
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

const inputVariants = cva(
  "flex h-11 w-full rounded-md border bg-background px-3 py-2 text-base sm:text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-input focus-visible:ring-ring",
        error: "border-destructive focus-visible:ring-destructive text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
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
   * Message d'erreur — quand fourni, active le variant error
   * et affiche le message sous le champ
   */
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      variant,
      leftIcon,
      rightElement,
      error,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const computedVariant = error ? "error" : variant;
    const hasLeftIcon = !!leftIcon;
    const hasRightElement = !!rightElement;

    const inputElement = (
      <input
        id={inputId}
        type={type}
        className={cn(
          inputVariants({ variant: computedVariant }),
          hasLeftIcon && "pl-10",
          hasRightElement && "pr-10",
          className
        )}
        ref={ref}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
    );

    // Input with icon wrapper
    if (hasLeftIcon || hasRightElement) {
      return (
        <div className="w-full">
          <div className="relative">
            {hasLeftIcon && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                {leftIcon}
              </div>
            )}
            {inputElement}
            {hasRightElement && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {rightElement}
              </div>
            )}
          </div>
          {error && (
            <p
              id={errorId}
              className="mt-1.5 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      );
    }

    // Plain input without icons
    return (
      <div className="w-full">
        {inputElement}
        {error && (
          <p
            id={errorId}
            className="mt-1.5 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };

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
  ({ currency = "\u20ac", ...props }, ref) => (
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
