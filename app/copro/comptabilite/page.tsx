"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatCurrency } from "@/lib/helpers/format";
import {
  Euro,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Building2,
  Wallet,
} from "lucide-react";

interface AccountEntry {
  id: string;
  date: string;
  label: string;
  debit_cents: number;
  credit_cents: number;
  balance_cents: number;
}

interface AccountSummary {
  site_name: string;
  lot_number: string;
  tantiemes: number;
  tantiemes_total: number;
  balance_cents: number;
  total_called_cents: number;
  total_paid_cents: number;
  entries: AccountEntry[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function CoproComptabilitePage() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccount() {
      try {
        const res = await fetch("/api/copro/account/my");
        if (res.ok) {
          const data = await res.json();
          setAccounts(data.accounts || (data ? [data] : []));
        }
      } catch (err) {
        console.error("Erreur chargement compte:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAccount();
  }, []);

  if (loading) {
    return <ComptaSkeleton />;
  }

  // Aggregate totals across all sites
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance_cents, 0);
  const totalCalled = accounts.reduce((sum, a) => sum + a.total_called_cents, 0);
  const totalPaid = accounts.reduce((sum, a) => sum + a.total_paid_cents, 0);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-foreground">Mon compte coproprietaire</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Solde, releve et historique des operations
        </p>
      </motion.div>

      {/* Summary */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Solde</p>
                <p className={`text-2xl font-bold ${totalBalance > 0 ? "text-red-600 dark:text-red-400" : totalBalance < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                  {formatCurrency(totalBalance / 100)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalBalance > 0 ? "Vous devez" : totalBalance < 0 ? "Credit en votre faveur" : "Compte equilibre"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                <Wallet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total appele</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalCalled / 100)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <ArrowUpRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total verse</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalPaid / 100)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <ArrowDownRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Per-site accounts */}
      {accounts.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-12 text-center">
              <Euro className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground">
                Aucune donnee comptable
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Votre compte coproprietaire n&apos;a pas encore d&apos;operations.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        accounts.map((account) => (
          <motion.div key={`${account.site_name}-${account.lot_number}`} variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    {account.site_name} - Lot {account.lot_number}
                  </CardTitle>
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 border-0">
                    {account.tantiemes}/{account.tantiemes_total} tantiemes
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Account balance summary */}
                <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg bg-muted/50">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Appele</p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(account.total_called_cents / 100)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Verse</p>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(account.total_paid_cents / 100)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Solde</p>
                    <p className={`text-sm font-semibold ${account.balance_cents > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatCurrency(account.balance_cents / 100)}
                    </p>
                  </div>
                </div>

                {/* Entries table */}
                {account.entries.length > 0 ? (
                  <div className="overflow-x-auto -mx-4 sm:-mx-6">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                            Date
                          </th>
                          <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                            Libelle
                          </th>
                          <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                            Debit
                          </th>
                          <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                            Credit
                          </th>
                          <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                            Solde
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {account.entries.map((entry) => (
                          <tr key={entry.id} className="border-b border-border/50 last:border-0">
                            <td className="py-2.5 px-4 sm:px-6 text-muted-foreground">
                              {new Date(entry.date).toLocaleDateString("fr-FR")}
                            </td>
                            <td className="py-2.5 px-4 sm:px-6 text-foreground">
                              {entry.label}
                            </td>
                            <td className="py-2.5 px-4 sm:px-6 text-right text-foreground">
                              {entry.debit_cents > 0 ? formatCurrency(entry.debit_cents / 100) : ""}
                            </td>
                            <td className="py-2.5 px-4 sm:px-6 text-right text-emerald-600 dark:text-emerald-400">
                              {entry.credit_cents > 0 ? formatCurrency(entry.credit_cents / 100) : ""}
                            </td>
                            <td className={`py-2.5 px-4 sm:px-6 text-right font-medium ${entry.balance_cents > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {formatCurrency(entry.balance_cents / 100)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune operation sur ce lot
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))
      )}
    </motion.div>
  );
}

function ComptaSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
