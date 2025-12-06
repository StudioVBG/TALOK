"use client";

/**
 * PropertyFinancials - Données financières
 * Architecture SOTA 2025 - Composant de présentation pur
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Euro } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/helpers/format";
import type { PropertyFinancialsProps } from "./types";

// ============================================
// SOUS-COMPOSANTS
// ============================================

interface FinancialRowProps {
  label: string;
  value: number;
  suffix?: string;
  highlight?: boolean;
}

function FinancialRow({ label, value, suffix = "", highlight = false }: FinancialRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn(
        "font-medium",
        highlight ? "text-lg text-primary" : "text-foreground"
      )}>
        {formatCurrency(value)}{suffix}
      </span>
    </div>
  );
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function PropertyFinancials({
  property,
  className,
  editable = false,
  onChange,
}: PropertyFinancialsProps) {
  const { loyer_hc = 0, charges_mensuelles = 0, depot_garantie = 0 } = property;
  const totalMensuel = loyer_hc + charges_mensuelles;

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-foreground">
          <Euro className="h-5 w-5 text-green-600" />
          Données Financières
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <FinancialRow 
          label="Loyer HC" 
          value={loyer_hc} 
          suffix="/mois"
        />
        
        <FinancialRow 
          label="Charges" 
          value={charges_mensuelles} 
          suffix="/mois"
        />
        
        <div className="border-t border-border my-2" />
        
        <FinancialRow 
          label="Total mensuel" 
          value={totalMensuel} 
          suffix="/mois"
          highlight
        />
        
        {depot_garantie > 0 && (
          <>
            <div className="border-t border-border my-2" />
            <FinancialRow 
              label="Dépôt de garantie" 
              value={depot_garantie}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

