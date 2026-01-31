import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-10 rounded-md px-3",
        lg: "h-12 rounded-md px-8",
        icon: "h-11 w-11",
        xs: "h-9 rounded-md px-2 text-xs",
        // Touch-friendly sizes for mobile (minimum 44px as per WCAG)
        touch: "h-11 min-w-[44px] px-4 py-2",
        "touch-icon": "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Affiche un état de chargement
   */
  isLoading?: boolean;
  /**
   * Texte affiché pendant le chargement
   */
  loadingText?: string;
  /**
   * Position de l'icône de chargement
   * @default "left"
   */
  loadingPosition?: "left" | "right";
  /**
   * Icône à afficher à gauche du texte
   */
  leftIcon?: React.ReactNode;
  /**
   * Icône à afficher à droite du texte
   */
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      loadingText,
      loadingPosition = "left",
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || isLoading;

    // Loader component
    const LoaderIcon = (
      <Loader2
        className={cn(
          "h-4 w-4 animate-spin",
          loadingPosition === "left" && children && "mr-2",
          loadingPosition === "right" && children && "ml-2"
        )}
        aria-hidden="true"
      />
    );

    // If asChild, render children directly with loading wrapper
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        {...props}
      >
        {/* Loading indicator or left icon */}
        {isLoading && loadingPosition === "left" && LoaderIcon}
        {!isLoading && leftIcon && (
          <span className={cn(children && "mr-2")} aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Button text */}
        {isLoading && loadingText ? loadingText : children}

        {/* Right icon or loading indicator */}
        {!isLoading && rightIcon && (
          <span className={cn(children && "ml-2")} aria-hidden="true">
            {rightIcon}
          </span>
        )}
        {isLoading && loadingPosition === "right" && LoaderIcon}

        {/* Screen reader text for loading state */}
        {isLoading && (
          <span className="sr-only">
            {loadingText || "Chargement en cours..."}
          </span>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

/**
 * IconButton - Bouton avec icône uniquement
 *
 * Accessibilité: Nécessite un aria-label obligatoire
 */
interface IconButtonProps extends Omit<ButtonProps, "children" | "leftIcon" | "rightIcon"> {
  /**
   * Label accessible obligatoire pour les lecteurs d'écran
   */
  "aria-label": string;
  /**
   * Icône à afficher
   */
  icon: React.ReactNode;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = "icon", className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size={size}
        className={cn("p-0", className)}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
      </Button>
    );
  }
);
IconButton.displayName = "IconButton";

export { Button, IconButton, buttonVariants };
