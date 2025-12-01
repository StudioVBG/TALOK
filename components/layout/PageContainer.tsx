"use client";

import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
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
  maxWidth = "2xl" 
}: PageContainerProps) {
  return (
    <div className={cn("mx-auto", maxWidthClasses[maxWidth], className)}>
      {children}
    </div>
  );
}

