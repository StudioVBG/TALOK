"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Info, CreditCard, Building2, Percent, ArrowRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  calculatePaymentFees,
  calculateDepositAndBalance,
  formatEuros,
  type PaymentFees,
  type DepositBalanceCalculation,
} from "@/lib/types/intervention-flow";
import { cn } from "@/lib/utils";

interface PaymentFeesDisplayProps {
  amount: number;
  showDeposit?: boolean;
  variant?: "compact" | "detailed";
  className?: string;
}

/**
 * Affiche les frais de paiement de manière transparente
 */
export function PaymentFeesDisplay({
  amount,
  showDeposit = false,
  variant = "detailed",
  className,
}: PaymentFeesDisplayProps) {
  const fees = useMemo(() => calculatePaymentFees(amount), [amount]);
  const depositBreakdown = useMemo(
    () => (showDeposit ? calculateDepositAndBalance(amount) : null),
    [amount, showDeposit]
  );

  if (variant === "compact") {
    return (
      <div className={cn("text-sm", className)}>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Frais de paiement</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 cursor-help">
                  {formatEuros(fees.total_fees)}
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Stripe: {formatEuros(fees.stripe_fee)}</p>
                <p>Plateforme: {formatEuros(fees.platform_fee)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Taux effectif: {fees.effective_rate}%
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center justify-between font-medium">
          <span>Net prestataire</span>
          <span className="text-green-600">{formatEuros(fees.net_amount)}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-orange-500" />
          Frais de paiement
        </CardTitle>
        <CardDescription>
          Frais transparents: 2.4% + 0.75€
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Montant brut */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Montant payé par le client</span>
          <span className="font-semibold">{formatEuros(fees.gross_amount)}</span>
        </div>

        <Separator />

        {/* Détail des frais */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              Frais Stripe (1.4% + 0.25€)
            </span>
            <span className="text-red-500">- {formatEuros(fees.stripe_fee)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Percent className="h-3.5 w-3.5" />
              Frais plateforme (1% + 0.50€)
            </span>
            <span className="text-red-500">- {formatEuros(fees.platform_fee)}</span>
          </div>
        </div>

        <Separator />

        {/* Net prestataire */}
        <div className="flex items-center justify-between">
          <span className="font-medium">Vous recevez</span>
          <div className="text-right">
            <span className="text-lg font-bold text-green-600">
              {formatEuros(fees.net_amount)}
            </span>
            <Badge variant="outline" className="ml-2 text-xs">
              {fees.effective_rate}% de frais
            </Badge>
          </div>
        </div>

        {/* Breakdown acompte/solde */}
        {showDeposit && depositBreakdown && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Répartition acompte / solde
              </h4>

              {/* Acompte */}
              <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">
                    Acompte ({depositBreakdown.deposit_percent}%)
                  </span>
                  <span className="font-semibold text-blue-700">
                    {formatEuros(depositBreakdown.deposit_amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-600">Frais sur acompte</span>
                  <span className="text-red-500">- {formatEuros(depositBreakdown.deposit_fees)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-blue-600">Net acompte</span>
                  <span className="text-green-600">{formatEuros(depositBreakdown.deposit_net)}</span>
                </div>
              </div>

              {/* Solde */}
              <div className="bg-green-50 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">
                    Solde ({depositBreakdown.balance_percent}%)
                  </span>
                  <span className="font-semibold text-green-700">
                    {formatEuros(depositBreakdown.balance_amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-green-600">Frais sur solde</span>
                  <span className="text-red-500">- {formatEuros(depositBreakdown.balance_fees)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-green-600">Net solde</span>
                  <span className="text-green-600">{formatEuros(depositBreakdown.balance_net)}</span>
                </div>
              </div>

              {/* Total */}
              <div className="bg-slate-100 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total net prestataire</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatEuros(depositBreakdown.total_net)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total des frais: {formatEuros(depositBreakdown.total_fees)} 
                  ({((depositBreakdown.total_fees / amount) * 100).toFixed(2)}%)
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Version inline pour les résumés
 */
export function PaymentFeesInline({ amount }: { amount: number }) {
  const fees = useMemo(() => calculatePaymentFees(amount), [amount]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-sm cursor-help underline decoration-dotted">
            Net: {formatEuros(fees.net_amount)}
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p>Montant brut: {formatEuros(fees.gross_amount)}</p>
            <p>Frais Stripe: -{formatEuros(fees.stripe_fee)}</p>
            <p>Frais plateforme: -{formatEuros(fees.platform_fee)}</p>
            <Separator className="my-1" />
            <p className="font-medium">Net: {formatEuros(fees.net_amount)}</p>
            <p className="text-muted-foreground">Taux: {fees.effective_rate}%</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

