"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  PiggyBank,
  AlertTriangle,
  Send,
  Euro,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ReversementModal } from "@/components/agency/ReversementModal";
import { PlanGate } from "@/components/subscription/plan-gate";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " EUR";
}

async function fetchAccounts() {
  const res = await fetch("/api/agency/accounts");
  if (!res.ok) throw new Error("Erreur chargement comptes");
  return res.json();
}

async function processReversement(accountId: string, amountCents: number) {
  const res = await fetch(`/api/agency/accounts/${accountId}/reverse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount_cents: amountCents }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Erreur reversement");
  }
  return res.json();
}

export default function AccountsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["agency-accounts"],
    queryFn: fetchAccounts,
  });

  const [selectedAccount, setSelectedAccount] = useState<{
    id: string;
    name: string;
    balance: number;
    iban: string | null;
  } | null>(null);

  const accounts = data?.accounts || [];
  const summary = data?.summary || { total_balance_cents: 0, overdue_count: 0, total_accounts: 0 };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Comptes mandants
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Separation des fonds mandants — Conformite Loi Hoguet
            </p>
          </div>
        </motion.div>

        {/* Summary cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                <PiggyBank className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCents(summary.total_balance_cents)}</p>
                <p className="text-sm text-muted-foreground">Solde total mandants</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.total_accounts}</p>
                <p className="text-sm text-muted-foreground">Comptes mandants</p>
              </div>
            </CardContent>
          </Card>
          {summary.overdue_count > 0 && (
            <Card className="border-0 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{summary.overdue_count}</p>
                  <p className="text-sm text-red-800 dark:text-red-300">Reversements en retard (&gt;30j)</p>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Accounts list */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Comptes par mandant</CardTitle>
              <CardDescription>
                Soldes et reversements pour chaque mandat de gestion
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {accounts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Aucun compte mandant enregistre
                </div>
              ) : (
                <div className="divide-y">
                  {accounts.map((account: any) => {
                    const mandate = account.mandate;
                    const owner = mandate?.owner;
                    const ownerName = owner
                      ? `${owner.prenom || ""} ${owner.nom || ""}`.trim()
                      : "Proprietaire";

                    return (
                      <div key={account.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                            {ownerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{ownerName}</p>
                            <p className="text-xs text-muted-foreground">
                              Mandat {mandate?.mandate_number || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold">{formatCents(account.balance_cents)}</p>
                            {account.last_reversement_at && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                <Clock className="w-3 h-3" />
                                Dernier : {new Date(account.last_reversement_at).toLocaleDateString("fr-FR")}
                              </p>
                            )}
                          </div>

                          {account.reversement_overdue && (
                            <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              En retard
                            </Badge>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={account.balance_cents <= 0}
                            onClick={() => setSelectedAccount({
                              id: account.id,
                              name: ownerName,
                              balance: account.balance_cents,
                              iban: mandate?.mandant_bank_iban || null,
                            })}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Reverser
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Reversement Modal */}
        {selectedAccount && (
          <ReversementModal
            open={!!selectedAccount}
            onClose={() => setSelectedAccount(null)}
            accountId={selectedAccount.id}
            mandantName={selectedAccount.name}
            balanceCents={selectedAccount.balance}
            iban={selectedAccount.iban}
            onReverse={async (id, amount) => {
              await processReversement(id, amount);
              refetch();
            }}
          />
        )}
      </motion.div>
    </PlanGate>
  );
}
