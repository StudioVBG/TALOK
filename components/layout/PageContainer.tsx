"use client";

import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /** Appliquer le padding responsive standard */
  withPadding?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

export function PageContainer({
  children,
  className,
  maxWidth = "2xl",
  withPadding = false,
}: PageContainerProps) {
  return (
    <div className={cn(
      // Base: pleine largeur avec overflow contrôlé
      "w-full mx-auto overflow-x-hidden",
      // Max-width selon la prop
      maxWidthClasses[maxWidth],
      // Padding responsive optionnel
      withPadding && "px-4 sm:px-6 lg:px-8",
      className
    )}>
      {children}
    </div>
  );
}

