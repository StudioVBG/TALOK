"use client";

import Link, { LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useCallback, MouseEvent, ReactNode } from "react";
import { usePrefetch } from "@/lib/hooks/use-prefetch";

interface SmartLinkProps extends Omit<LinkProps, "href"> {
  href: string;
  children: ReactNode;
  className?: string;
  prefetchType?: "property" | "lease" | "invoice" | "properties" | "dashboard" | "none";
  prefetchId?: string;
  prefetchDelay?: number;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Composant Link amélioré avec prefetch intelligent
 * 
 * Précharge automatiquement les données au survol pour une navigation instantanée
 * 
 * @example
 * <SmartLink 
 *   href={`/app/owner/properties/${id}`} 
 *   prefetchType="property" 
 *   prefetchId={id}
 * >
 *   Voir le bien
 * </SmartLink>
 */
export const SmartLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(
  (
    {
      href,
      children,
      className,
      prefetchType = "none",
      prefetchId,
      prefetchDelay = 100,
      onClick,
      ...props
    },
    ref
  ) => {
    const {
      prefetchProperty,
      prefetchLease,
      prefetchInvoices,
      prefetchProperties,
      prefetchOwnerDashboard,
    } = usePrefetch();

    const handleMouseEnter = useCallback(() => {
      // Délai pour éviter les prefetch sur simple passage de souris
      const timeout = setTimeout(() => {
        switch (prefetchType) {
          case "property":
            if (prefetchId) prefetchProperty(prefetchId);
            break;
          case "lease":
            if (prefetchId) prefetchLease(prefetchId);
            break;
          case "invoice":
            prefetchInvoices(prefetchId);
            break;
          case "properties":
            prefetchProperties();
            break;
          case "dashboard":
            prefetchOwnerDashboard();
            break;
          default:
            break;
        }
      }, prefetchDelay);

      return () => clearTimeout(timeout);
    }, [
      prefetchType,
      prefetchId,
      prefetchDelay,
      prefetchProperty,
      prefetchLease,
      prefetchInvoices,
      prefetchProperties,
      prefetchOwnerDashboard,
    ]);

    return (
      <Link
        ref={ref}
        href={href}
        className={className}
        onMouseEnter={handleMouseEnter}
        onClick={onClick}
        {...props}
      >
        {children}
      </Link>
    );
  }
);

SmartLink.displayName = "SmartLink";

/**
 * Version button du SmartLink
 */
interface SmartButtonLinkProps extends SmartLinkProps {
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const SmartButtonLink = forwardRef<HTMLAnchorElement, SmartButtonLinkProps>(
  ({ variant = "default", size = "default", className, ...props }, ref) => {
    // Classes de base du bouton (simplifiées)
    const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50";
    
    const variantClasses = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    };
    
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-9 px-3 text-sm",
      lg: "h-11 px-8",
      icon: "h-10 w-10",
    };

    const combinedClassName = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className || ""}`;

    return <SmartLink ref={ref} className={combinedClassName} {...props} />;
  }
);

SmartButtonLink.displayName = "SmartButtonLink";

export default SmartLink;

