"use client";

import { cn } from "@/lib/utils";
import { grids } from "@/lib/design-system/tokens";

interface KpiGridProps {
  children: React.ReactNode;
  className?: string;
}

export function KpiGrid({ children, className }: KpiGridProps) {
  return (
    <div className={cn(grids.kpi, className)}>
      {children}
    </div>
  );
}

