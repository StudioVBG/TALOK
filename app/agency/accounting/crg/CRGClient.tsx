"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Receipt,
  Send,
  Download,
  Plus,
  Eye,
  CheckCircle,
  Mail,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/utils/format-cents";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useAgencyDashboard, type MandantCard } from "@/lib/hooks/use-agency-dashboard";
import { useMandantDetail, type MandantCRG, type CRGStatus } from "@/lib/hooks/use-mandant-detail";

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

const crgStatusConfig: Record<CRGStatus, { label: string; color: string; icon: React.ElementType }> = {
  genere: {
    label: "Genere",
    color: "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400",
    icon: CheckCircle,
  },
  envoye: {
    label: "Envoye",
    color: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400",
    icon: Mail,
  },
  vu_par_mandant: {
    label: "Vu par mandant",
    color: "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400",
    icon: Eye,
  },
};

// ---------------------------------------------------------------------------
// Generate CRG Form
// ---------------------------------------------------------------------------

function GenerateCRGForm({
  mandants,
  onClose,
}: {
  mandants: MandantCard[];
  onClose: () => void;
}) {
  const [selectedMandant, setSelectedMandant] = useState("");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const mandantDetail = useMandantDetail(selectedMandant);

  const handleGenerate = async () => {
    if (!selectedMandant || !period) return;
    try {
      await mandantDetail.generateCrg({ period });
      onClose();
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Card className="border-0 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">Generer un CRG</CardTitle>
        <CardDescription>
          Selectionnez un mandant et une periode pour generer le Compte Rendu de Gestion
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">
            Mandant
          </label>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            value={selectedMandant}
            onChange={(e) => setSelectedMandant(e.target.value)}
          >
            <option value="">Selectionner un mandant</option>
            {mandants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.nbProperties} bien(s)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">
            Periode
          </label>
          <input
            type="month"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleGenerate}
            disabled={!selectedMandant || !period || mandantDetail.isGeneratingCrg}
            className="bg-[#2563EB] hover:bg-[#1B2A6B] text-white"
          >
            <Receipt className="w-4 h-4 mr-1" />
            {mandantDetail.isGeneratingCrg ? "Generation..." : "Generer"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CRG Preview
// ---------------------------------------------------------------------------

function CRGPreview({ crg }: { crg: MandantCRG }) {
  return (
    <div className="mt-3 p-4 rounded-lg bg-muted/50 border border-border">
      <h4 className="text-sm font-semibold text-foreground mb-3">
        Apercu — CRG {crg.period}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Poste</th>
              <th className="text-right px-3 py-2 font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-2 text-foreground">Loyers encaisses</td>
              <td className="px-3 py-2 text-right font-medium">
                {formatCents(crg.totalLoyersCents)}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-3 py-2 text-foreground">Honoraires de gestion</td>
              <td className="px-3 py-2 text-right font-medium text-amber-600 dark:text-amber-400">
                -{formatCents(crg.totalCommissionCents)}
              </td>
            </tr>
            <tr className="bg-muted/30">
              <td className="px-3 py-2 font-semibold text-foreground">
                Net a reverser
              </td>
              <td className="px-3 py-2 text-right font-bold text-foreground">
                {formatCents(crg.totalReverseCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Genere le {formatDate(crg.generatedAt)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mandant CRG Group
// ---------------------------------------------------------------------------

function MandantCRGGroup({
  mandant,
}: {
  mandant: MandantCard;
}) {
  const [expanded, setExpanded] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { crgs, sendCrg, isSendingCrg } = useMandantDetail(mandant.id);

  if (crgs.length === 0) return null;

  return (
    <Card className="border-0 bg-card/60 backdrop-blur-sm">
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors rounded-t-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1B2A6B] flex items-center justify-center text-white text-xs font-semibold">
              {mandant.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground text-sm">{mandant.name}</p>
              <p className="text-xs text-muted-foreground">
                {crgs.length} CRG — Ref. {mandant.mandateRef}
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-border px-4 pb-4 space-y-3">
            {crgs.map((crg) => {
              const status = crgStatusConfig[crg.status];
              const StatusIcon = status.icon;
              return (
                <div key={crg.id}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
                    <div className="flex items-center gap-2">
                      <StatusIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        {crg.period}
                      </span>
                      <Badge variant="outline" className={cn("text-xs", status.color)}>
                        {status.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(crg.generatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPreviewId(previewId === crg.id ? null : crg.id)
                        }
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Apercu
                      </Button>
                      {crg.downloadUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={crg.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            PDF
                          </a>
                        </Button>
                      )}
                      {crg.status === "genere" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendCrg(crg.id)}
                          disabled={isSendingCrg}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Envoyer
                        </Button>
                      )}
                    </div>
                  </div>
                  {previewId === crg.id && <CRGPreview crg={crg} />}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CRGClient() {
  const [showForm, setShowForm] = useState(false);
  const { mandants, isLoading } = useAgencyDashboard();

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
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
              Comptes Rendus de Gestion
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Generez, envoyez et suivez les CRG de vos mandants
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#2563EB] hover:bg-[#1B2A6B] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generer un CRG
          </Button>
        </motion.div>

        {/* Generate form */}
        {showForm && (
          <motion.div variants={itemVariants}>
            <GenerateCRGForm
              mandants={mandants}
              onClose={() => setShowForm(false)}
            />
          </motion.div>
        )}

        {/* CRG list grouped by mandant */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : mandants.length === 0 ? (
          <motion.div variants={itemVariants}>
            <Card className="border-0 bg-card/60 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  Aucun mandant enregistre. Ajoutez des mandants pour generer des CRG.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div variants={itemVariants} className="space-y-4">
            {mandants.map((m) => (
              <MandantCRGGroup key={m.id} mandant={m} />
            ))}
          </motion.div>
        )}
      </motion.div>
    </PlanGate>
  );
}
