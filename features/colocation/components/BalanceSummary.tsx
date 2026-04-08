"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Euro, CheckCircle2 } from "lucide-react";
import { colocationExpensesService } from "../services/expenses.service";
import type { ColocationBalanceEntry } from "../types";

interface BalanceSummaryProps {
  propertyId: string;
  currentMemberId?: string;
}

export function BalanceSummary({ propertyId, currentMemberId }: BalanceSummaryProps) {
  const [balances, setBalances] = useState<ColocationBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);

  useEffect(() => {
    loadBalances();
  }, [propertyId]);

  const loadBalances = async () => {
    try {
      const data = await colocationExpensesService.getBalances(propertyId);
      setBalances(data);
    } catch (err) {
      console.error("Erreur chargement soldes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (payerId: string, debtorId: string) => {
    const key = `${payerId}-${debtorId}`;
    setSettling(key);
    try {
      await colocationExpensesService.settleExpenses({
        property_id: propertyId,
        payer_id: payerId,
        debtor_id: debtorId,
      });
      await loadBalances();
    } catch (err) {
      console.error("Erreur reglement:", err);
    } finally {
      setSettling(null);
    }
  };

  if (loading) return null;

  if (balances.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
          <p className="text-muted-foreground">Tous les comptes sont regles</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Euro className="h-5 w-5" />
          Soldes entre colocataires
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {balances.map((balance) => {
            const key = `${balance.payer_id}-${balance.debtor_id}`;
            return (
              <div
                key={key}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{balance.debtor_name}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{balance.payer_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-destructive">
                    {(balance.total_owed_cents / 100).toFixed(2)}€
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSettle(balance.payer_id, balance.debtor_id)}
                    disabled={settling === key}
                  >
                    {settling === key ? "..." : "Regler"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
