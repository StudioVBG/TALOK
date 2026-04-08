"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Euro,
  FileText,
  Download,
  Calendar,
  Building2,
  User,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/helpers/format";
import type { MouvementMandant, CRGData } from "@/features/accounting/types";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface MandantInfo {
  id: string;
  nom: string;
  prenom?: string;
  email?: string;
  type: "particulier" | "societe";
  raison_sociale?: string;
  adresse?: string;
  siret?: string;
}

interface MandantDetailData {
  info: MandantInfo;
  entries: MouvementMandant[];
  crgs: CRGData[];
  isLoading: boolean;
}

export const MandantDetailClient = ({ data }: { data: MandantDetailData | null }) => {
  const { info: mandant, entries, crgs, isLoading } = data ?? {
    info: null,
    entries: [],
    crgs: [],
    isLoading: false,
  };

  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!mandant) {
    return (
      <div className="text-center py-12">
        <User className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Mandant non trouve</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/agency/mandates">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux mandats
          </Link>
        </Button>
      </div>
    );
  }

  const totalCredits = entries.reduce(
    (sum, e) => sum + (e.type === "credit" ? e.montant : 0),
    0
  );
  const totalDebits = entries.reduce(
    (sum, e) => sum + (e.type === "debit" ? e.montant : 0),
    0
  );
  const solde = totalCredits - totalDebits;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/agency/mandates">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {mandant.type === "societe" && mandant.raison_sociale
                ? mandant.raison_sociale
                : `${mandant.prenom || ""} ${mandant.nom}`.trim()}
            </h1>
            <p className="text-muted-foreground text-sm">
              Compte mandant
              {mandant.siret && (
                <span className="ml-2 text-xs">SIRET : {mandant.siret}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            CRG
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 bg-gradient-to-br from-emerald-500 to-emerald-600">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-white/80">Total encaisse</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(totalCredits)}</p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-orange-500 to-orange-600">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-white/80">Total debite</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(totalDebits)}</p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-indigo-500 to-indigo-600">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-white/80">Solde</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(solde)}</p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <Euro className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* CRGs */}
      {crgs.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Comptes rendus de gestion</CardTitle>
              <CardDescription>CRG par bien</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {crgs.map((crg) => (
                <div
                  key={crg.numero}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                      <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{crg.bien.adresse}, {crg.bien.ville}</p>
                      <p className="text-xs text-muted-foreground">
                        {crg.periode.libelle} - {crg.numero}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(crg.solde_fin_periode)}</p>
                    <p className="text-xs text-muted-foreground">Solde fin de periode</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Entries table */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Mouvements</CardTitle>
            <CardDescription>
              {entries.length} mouvement{entries.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Libelle</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Categorie</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Debit</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Credit</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm">
                          {new Date(entry.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium">{entry.libelle}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs capitalize">
                            {entry.categorie}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-sm">
                          {entry.type === "debit" ? (
                            <span className="text-red-600">{formatCurrency(entry.montant)}</span>
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-sm">
                          {entry.type === "credit" ? (
                            <span className="text-emerald-600">{formatCurrency(entry.montant)}</span>
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-medium">
                          {entry.solde_cumule != null
                            ? formatCurrency(entry.solde_cumule)
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Aucun mouvement pour ce mandant
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};
