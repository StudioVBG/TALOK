"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  FileText,
  Euro,
  Send,
  Download,
  RefreshCw,
  Home,
  Receipt,
  FolderOpen,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/utils/format-cents";
import { PlanGate } from "@/components/subscription/plan-gate";
import {
  useMandantDetail,
  type MandantProperty,
  type MandantEntry,
  type MandantLoyerRow,
  type MandantReversement,
  type MandantCRG,
  type MandantDocument,
  type CRGStatus,
} from "@/lib/hooks/use-mandant-detail";

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type TabKey = "biens" | "ecritures" | "loyers" | "reversements" | "crg" | "documents";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "biens", label: "Biens", icon: Home },
  { key: "ecritures", label: "Ecritures", icon: FileText },
  { key: "loyers", label: "Loyers & Honoraires", icon: Euro },
  { key: "reversements", label: "Reversements", icon: RefreshCw },
  { key: "crg", label: "CRG", icon: Receipt },
  { key: "documents", label: "Documents", icon: FolderOpen },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const crgStatusConfig: Record<CRGStatus, { label: string; color: string }> = {
  genere: {
    label: "Genere",
    color: "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400",
  },
  envoye: {
    label: "Envoye",
    color: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400",
  },
  vu_par_mandant: {
    label: "Vu par mandant",
    color: "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
};

const reversementStatusConfig: Record<MandantReversement["status"], { label: string; color: string }> = {
  effectue: {
    label: "Effectue",
    color: "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  en_attente: {
    label: "En attente",
    color: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400",
  },
  en_retard: {
    label: "En retard",
    color: "border-red-500 text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400",
  },
};

// ---------------------------------------------------------------------------
// Tab content components
// ---------------------------------------------------------------------------

function BiensTab({ properties }: { properties: MandantProperty[] }) {
  if (properties.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucun bien rattache a ce mandant
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {properties.map((p) => (
        <Card key={p.id} className="border-0 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">
                  {p.address}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.type}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground">
                    Loyer : {formatCents(p.loyerCents)}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      p.isOccupied
                        ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "border-slate-500 text-slate-600 bg-slate-50 dark:bg-slate-500/10 dark:text-slate-400"
                    )}
                  >
                    {p.isOccupied ? "Occupe" : "Vacant"}
                  </Badge>
                </div>
                {p.tenantName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Locataire : {p.tenantName}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EcrituresTab({ entries }: { entries: MandantEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucune ecriture pour ce mandant
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left px-4 py-2 font-medium">Date</th>
            <th className="text-left px-4 py-2 font-medium">Libelle</th>
            <th className="text-left px-4 py-2 font-medium">Journal</th>
            <th className="text-right px-4 py-2 font-medium">Debit</th>
            <th className="text-right px-4 py-2 font-medium">Credit</th>
            <th className="text-center px-4 py-2 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
            >
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {formatDate(e.entryDate)}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">{e.label}</td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                {e.journalCode}
              </td>
              <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                {e.debitCents > 0 ? formatCents(e.debitCents) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                {e.creditCents > 0 ? formatCents(e.creditCents) : "—"}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={cn(
                    "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border",
                    e.isValidated
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  )}
                >
                  {e.isValidated ? "Valide" : "Brouillon"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoyersTab({ loyers }: { loyers: MandantLoyerRow[] }) {
  if (loyers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucune donnee de loyer disponible
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left px-4 py-2 font-medium">Mois</th>
            <th className="text-right px-4 py-2 font-medium">Loyer brut</th>
            <th className="text-right px-4 py-2 font-medium">Commission</th>
            <th className="text-right px-4 py-2 font-medium">Net reverse</th>
            <th className="text-center px-4 py-2 font-medium">Date reversement</th>
          </tr>
        </thead>
        <tbody>
          {loyers.map((row, idx) => (
            <tr
              key={idx}
              className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-foreground">{row.month}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {formatCents(row.loyerBrutCents)}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-amber-600 dark:text-amber-400">
                {formatCents(row.commissionCents)}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                {formatCents(row.netReverseCents)}
              </td>
              <td className="px-4 py-3 text-center text-muted-foreground">
                {formatDate(row.dateReversement)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReversementsTab({ reversements }: { reversements: MandantReversement[] }) {
  if (reversements.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucun reversement enregistre
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left px-4 py-2 font-medium">Date</th>
            <th className="text-left px-4 py-2 font-medium">Periode</th>
            <th className="text-left px-4 py-2 font-medium">Reference</th>
            <th className="text-right px-4 py-2 font-medium">Montant</th>
            <th className="text-center px-4 py-2 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {reversements.map((r) => {
            const status = reversementStatusConfig[r.status];
            return (
              <tr
                key={r.id}
                className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDate(r.date)}
                </td>
                <td className="px-4 py-3 text-foreground">{r.period}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {r.reference}
                </td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                  {formatCents(r.amountCents)}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant="outline" className={cn("text-xs", status.color)}>
                    {status.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CRGTab({
  crgs,
  onSend,
  isSending,
}: {
  crgs: MandantCRG[];
  onSend: (id: string) => void;
  isSending: boolean;
}) {
  if (crgs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucun CRG genere pour ce mandant
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {crgs.map((crg) => {
        const status = crgStatusConfig[crg.status];
        return (
          <Card key={crg.id} className="border-0 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">
                      CRG — {crg.period}
                    </p>
                    <Badge variant="outline" className={cn("text-xs", status.color)}>
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Genere le {formatDate(crg.generatedAt)}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Loyers : {formatCents(crg.totalLoyersCents)}</span>
                    <span>Commission : {formatCents(crg.totalCommissionCents)}</span>
                    <span>Net : {formatCents(crg.totalReverseCents)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {crg.downloadUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={crg.downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 mr-1" />
                        Telecharger
                      </a>
                    </Button>
                  )}
                  {crg.status === "genere" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSend(crg.id)}
                      disabled={isSending}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Envoyer
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DocumentsTab({ documents }: { documents: MandantDocument[] }) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucun document rattache
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {doc.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {doc.type} — {formatDate(doc.uploadedAt)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a href={doc.url} target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4" />
            </a>
          </Button>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MandantDetailClient({ mandantId }: { mandantId: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("biens");
  const {
    info,
    properties,
    entries,
    loyers,
    reversements,
    crgs,
    documents,
    isLoading,
    error,
    generateCrg,
    isGeneratingCrg,
    sendCrg,
    isSendingCrg,
    reverser,
    isReversing,
  } = useMandantDetail(mandantId);

  if (isLoading) {
    return (
      <PlanGate feature="bank_reconciliation" mode="block">
        <DetailSkeleton />
      </PlanGate>
    );
  }

  if (error || !info) {
    return (
      <PlanGate feature="bank_reconciliation" mode="block">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/agency/accounting">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Link>
          </Button>
          <Card className="border-0 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-destructive">
                Erreur lors du chargement des donnees du mandant.
              </p>
            </CardContent>
          </Card>
        </div>
      </PlanGate>
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
        {/* Back link */}
        <motion.div variants={itemVariants}>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/agency/accounting">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour a la comptabilite
            </Link>
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1B2A6B] flex items-center justify-center text-white text-lg font-semibold">
              {info.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
                {info.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Ref. {info.mandateRef} — Commission {info.commissionRate}% — {info.nbProperties} bien(s)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateCrg({ period: new Date().toISOString().slice(0, 7) })}
              disabled={isGeneratingCrg}
            >
              <Receipt className="w-4 h-4 mr-1" />
              {isGeneratingCrg ? "Generation..." : "Generer CRG"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reverser({ amountCents: 0, period: "" })}
              disabled={isReversing}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Reverser
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("ecritures")}
            >
              <FileText className="w-4 h-4 mr-1" />
              Voir ecritures
            </Button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants}>
          <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap",
                    activeTab === tab.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Tab content */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-6">
              {activeTab === "biens" && <BiensTab properties={properties} />}
              {activeTab === "ecritures" && <EcrituresTab entries={entries} />}
              {activeTab === "loyers" && <LoyersTab loyers={loyers} />}
              {activeTab === "reversements" && (
                <ReversementsTab reversements={reversements} />
              )}
              {activeTab === "crg" && (
                <CRGTab crgs={crgs} onSend={sendCrg} isSending={isSendingCrg} />
              )}
              {activeTab === "documents" && <DocumentsTab documents={documents} />}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </PlanGate>
  );
}
