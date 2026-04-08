"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatCurrency } from "@/lib/helpers/format";
import {
  Euro,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Calendar,
  Building2,
} from "lucide-react";

interface AppelDeFonds {
  id: string;
  site_name: string;
  period_label: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: "paye" | "en_attente" | "en_retard";
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const STATUS_CONFIG = {
  paye: {
    label: "Paye",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  en_attente: {
    label: "En attente",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  en_retard: {
    label: "En retard",
    icon: AlertCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
} as const;

export default function CoproAppelsPage() {
  const { profile } = useAuth();
  const [appels, setAppels] = useState<AppelDeFonds[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppels() {
      try {
        const res = await fetch("/api/copro/appels/my");
        if (res.ok) {
          const data = await res.json();
          setAppels(data.appels || data || []);
        }
      } catch (err) {
        console.error("Erreur chargement appels:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAppels();
  }, []);

  if (loading) {
    return <AppelsSkeleton />;
  }

  const totalDue = appels.reduce((sum, a) => sum + a.amount_due, 0);
  const totalPaid = appels.reduce((sum, a) => sum + a.amount_paid, 0);
  const totalRemaining = totalDue - totalPaid;
  const pendingAppels = appels.filter((a) => a.status !== "paye");
  const paidAppels = appels.filter((a) => a.status === "paye");

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-foreground">Mes appels de fonds</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consultez vos appels de fonds et leur statut
        </p>
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total appele</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalDue / 100)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                <Euro className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paye</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalPaid / 100)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reste a payer</p>
                <p className={`text-2xl font-bold ${totalRemaining > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                  {formatCurrency(totalRemaining / 100)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pending appels */}
      {pendingAppels.length > 0 && (
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Appels en cours
          </h2>
          <div className="space-y-3">
            {pendingAppels.map((appel) => (
              <AppelCard key={appel.id} appel={appel} />
            ))}
          </div>
        </motion.div>
      )}

      {/* No pending */}
      {pendingAppels.length === 0 && !loading && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
              <h3 className="text-lg font-semibold text-foreground">
                Vous etes a jour
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Aucun appel de fonds en attente de paiement.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Paid history */}
      {paidAppels.length > 0 && (
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Historique des paiements
          </h2>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                        Periode
                      </th>
                      <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                        Copropriete
                      </th>
                      <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                        Montant
                      </th>
                      <th className="text-center py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidAppels.map((appel) => (
                      <tr key={appel.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 px-4 sm:px-6 text-foreground">
                          {appel.period_label}
                        </td>
                        <td className="py-2.5 px-4 sm:px-6 text-muted-foreground">
                          {appel.site_name}
                        </td>
                        <td className="py-2.5 px-4 sm:px-6 text-right text-foreground font-medium">
                          {formatCurrency(appel.amount_due / 100)}
                        </td>
                        <td className="py-2.5 px-4 sm:px-6 text-center">
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Paye
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

function AppelCard({ appel }: { appel: AppelDeFonds }) {
  const config = STATUS_CONFIG[appel.status];
  const StatusIcon = config.icon;
  const remaining = appel.amount_due - appel.amount_paid;
  const pct = appel.amount_due > 0 ? Math.round((appel.amount_paid / appel.amount_due) * 100) : 0;

  return (
    <Card className={appel.status === "en_retard" ? "border-red-200 dark:border-red-800" : ""}>
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {appel.period_label}
              </h3>
              <Badge className={`${config.className} border-0 gap-1 shrink-0`}>
                <StatusIcon className="w-3 h-3" />
                {config.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {appel.site_name}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Echeance: {new Date(appel.due_date).toLocaleDateString("fr-FR")}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Paye: {formatCurrency(appel.amount_paid / 100)}
                </span>
                <span className="text-muted-foreground">
                  Du: {formatCurrency(appel.amount_due / 100)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <p className={`text-xl font-bold ${remaining > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {formatCurrency(remaining / 100)}
            </p>
            <p className="text-xs text-muted-foreground">reste a payer</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AppelsSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-52" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}
