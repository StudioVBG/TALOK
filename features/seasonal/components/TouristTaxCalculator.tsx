"use client";

import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

interface TouristTaxCalculatorProps {
  taxPerNightCents: number;
  nights: number;
  guestCount?: number;
  className?: string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function TouristTaxCalculator({
  taxPerNightCents,
  nights,
  guestCount = 1,
  className,
}: TouristTaxCalculatorProps) {
  const totalTax = taxPerNightCents * nights;

  if (taxPerNightCents === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Taxe de séjour non configurée
      </p>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <Calculator className="h-4 w-4 text-muted-foreground" />
      <span>
        Taxe de séjour : {formatCents(taxPerNightCents)} / nuit × {nights} nuit{nights > 1 ? "s" : ""}
        = <span className="font-semibold">{formatCents(totalTax)}</span>
      </span>
    </div>
  );
}
