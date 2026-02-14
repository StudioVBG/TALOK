"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Plus, Calendar, Building2, Euro,
  ChevronRight, Receipt,
} from "lucide-react";

interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  supplier?: string;
  invoice_number?: string;
  site_name?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: "Entretien courant",
  repairs: "Réparations",
  utilities: "Charges",
  insurance: "Assurance",
  management: "Honoraires",
  legal: "Frais juridiques",
  other: "Autres",
};

export default function ExpensesListPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExpenses() {
      try {
        const response = await fetch("/api/copro/expenses");
        if (response.ok) {
          const data = await response.json();
          setExpenses(data.expenses || data || []);
        }
      } catch (error) {
        console.error("Erreur chargement dépenses:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchExpenses();
  }, []);

  // Calcul du total
  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dépenses</h1>
          <p className="text-muted-foreground">
            Suivi des dépenses de vos copropriétés
          </p>
        </div>
        <Button asChild className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
          <Link href="/syndic/expenses/new">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle dépense
          </Link>
        </Button>
      </div>

      {/* Stats rapides */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total dépenses</p>
              <p className="text-xl font-bold text-foreground">
                {totalAmount.toLocaleString("fr-FR")} €
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="text-xl font-bold text-foreground">{expenses.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune dépense enregistrée</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Commencez à enregistrer les dépenses de vos copropriétés.
            </p>
            <Button asChild>
              <Link href="/syndic/expenses/new">
                <Plus className="h-4 w-4 mr-2" />
                Enregistrer une dépense
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <Card key={expense.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground truncate">{expense.description}</p>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {CATEGORY_LABELS[expense.category] || expense.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        {expense.site_name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {expense.site_name}
                          </span>
                        )}
                        {expense.supplier && (
                          <span>{expense.supplier}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(expense.date).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-bold text-foreground">
                      {expense.amount?.toLocaleString("fr-FR")} €
                    </p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
