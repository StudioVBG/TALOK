"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildAvatarUrl } from "@/lib/helpers/format";
import { Euro, Plus } from "lucide-react";
import { colocationExpensesService } from "../services/expenses.service";
import { EXPENSE_CATEGORY_LABELS } from "../types";
import type { ExpenseCategory, ColocationMemberWithDetails } from "../types";
import { ExpenseForm } from "./ExpenseForm";
import { BalanceSummary } from "./BalanceSummary";

interface ExpensesListProps {
  propertyId: string;
  members: ColocationMemberWithDetails[];
  currentMemberId?: string;
}

export function ExpensesList({ propertyId, members, currentMemberId }: ExpensesListProps) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, [propertyId]);

  const loadExpenses = async () => {
    try {
      const data = await colocationExpensesService.getExpenses(propertyId);
      setExpenses(data);
    } catch (err) {
      console.error("Erreur chargement depenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const splitLabels: Record<string, string> = {
    equal: "Egal",
    by_room: "Par chambre",
    custom: "Personnalise",
  };

  return (
    <div className="space-y-6">
      <BalanceSummary propertyId={propertyId} currentMemberId={currentMemberId} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Depenses partagees
          </CardTitle>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune depense enregistree.
            </p>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => {
                const payer = expense.paid_by?.profiles;
                return (
                  <div
                    key={expense.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      expense.is_settled ? "opacity-60 bg-muted/30" : ""
                    }`}
                  >
                    {payer && (
                      <Avatar className="h-8 w-8">
                        {payer.avatar_url && <AvatarImage src={buildAvatarUrl(payer.avatar_url) ?? undefined} />}
                        <AvatarFallback className="text-xs">
                          {(payer.prenom?.[0] || "")}{(payer.nom?.[0] || "")}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{expense.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {new Date(expense.date).toLocaleDateString("fr-FR")}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {EXPENSE_CATEGORY_LABELS[expense.category as ExpenseCategory]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {splitLabels[expense.split_type] || expense.split_type}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        {(expense.amount_cents / 100).toFixed(2)}€
                      </p>
                      {expense.is_settled && (
                        <Badge variant="secondary" className="text-xs">
                          Regle
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseForm
        propertyId={propertyId}
        members={members}
        currentMemberId={currentMemberId}
        open={showForm}
        onOpenChange={setShowForm}
        onSaved={loadExpenses}
      />
    </div>
  );
}
