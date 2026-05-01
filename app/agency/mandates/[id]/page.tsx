"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  User,
  Building2,
  Euro,
  Calendar,
  Receipt,
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CRGGenerator } from "@/components/agency/CRGGenerator";
import { FeeCalculator } from "@/components/agency/FeeCalculator";

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

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Brouillon", color: "border-slate-500 text-slate-600 bg-slate-50", icon: FileText },
  active: { label: "Actif", color: "border-emerald-500 text-emerald-600 bg-emerald-50", icon: CheckCircle },
  terminated: { label: "Resilie", color: "border-red-500 text-red-600 bg-red-50", icon: XCircle },
  expired: { label: "Expire", color: "border-amber-500 text-amber-600 bg-amber-50", icon: Clock },
};

const crgStatusLabels: Record<string, string> = {
  draft: "Brouillon",
  generated: "Genere",
  sent: "Envoye",
  acknowledged: "Acquitte",
};

export default function MandateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mandateId = params.id as string;

  const [showCRGForm, setShowCRGForm] = useState(false);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [reverseAmountInput, setReverseAmountInput] = useState("");
  const [reverseDate, setReverseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [reverseBankRef, setReverseBankRef] = useState("");
  const [reverseError, setReverseError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["agency-mandate", mandateId],
    queryFn: async () => {
      const res = await fetch(`/api/agency/mandates/${mandateId}`);
      if (!res.ok) throw new Error("Mandat non trouve");
      return res.json();
    },
  });

  const terminateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/agency/mandates/${mandateId}/terminate`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erreur");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-mandate", mandateId] });
      toast({ title: "Mandat resilie", description: "Le mandat a ete resilie." });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const initiateSignatureMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/agency/mandates/${mandateId}/initiate-signature`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Erreur ${res.status}`);
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-mandate", mandateId] });
      toast({
        title: "Mandat envoyé pour signature",
        description: "Le propriétaire mandant va recevoir un email avec le lien de signature.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const sendCrgMutation = useMutation({
    mutationFn: async (crgId: string) => {
      const res = await fetch(`/api/agency/crg/${crgId}/send`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erreur");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-mandate", mandateId] });
      toast({ title: "CRG envoye", description: "Le CRG a ete envoye au mandant." });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async (input: {
      amountCents: number;
      date: string;
      bankRef?: string;
    }) => {
      const res = await fetch(
        `/api/agency/mandates/${mandateId}/reversement`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Erreur ${res.status}`);
      }
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agency-mandate", mandateId] });
      setReverseDialogOpen(false);
      setReverseAmountInput("");
      setReverseBankRef("");
      setReverseError(null);
      toast({
        title: data?.data?.idempotent
          ? "Reversement déjà enregistré"
          : "Reversement posé",
        description: data?.data?.idempotent
          ? "Une écriture existait déjà avec cette référence."
          : "L'écriture comptable a été créée et le solde mandant mis à jour.",
      });
    },
    onError: (err: Error) => {
      setReverseError(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const mandate = data?.mandate;
  if (!mandate) {
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
        <p className="text-muted-foreground">Mandat non trouve</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/agency/mandates">Retour aux mandats</Link>
        </Button>
      </div>
    );
  }

  const owner = mandate.owner;
  const crgs = mandate.crgs || [];
  const account = Array.isArray(mandate.account) ? mandate.account[0] : mandate.account;
  const status = statusConfig[mandate.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Back link */}
      <motion.div variants={itemVariants}>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/agency/mandates">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux mandats
          </Link>
        </Button>
      </motion.div>

      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Mandat {mandate.mandate_number}
            </h1>
            <Badge variant="outline" className={cn("text-sm", status.color)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {mandate.mandate_type === "gestion" ? "Gestion locative" : mandate.mandate_type}
          </p>
        </div>
        <div className="flex gap-2">
          {mandate.status === "draft" && mandate.signature_status !== "pending" && (
            <Button
              size="sm"
              onClick={() => initiateSignatureMutation.mutate()}
              disabled={initiateSignatureMutation.isPending}
            >
              {initiateSignatureMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Envoyer pour signature
            </Button>
          )}
          {mandate.signature_status === "pending" && (
            <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
              <Clock className="w-3 h-3 mr-1" />
              Signature en attente
            </Badge>
          )}
          {mandate.status === "active" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => terminateMutation.mutate()}
              disabled={terminateMutation.isPending}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Resilier
            </Button>
          )}
        </div>
      </motion.div>

      {/* Info cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Owner info */}
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              Mandant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                {(owner?.prenom || owner?.nom || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{owner?.prenom} {owner?.nom}</p>
                <p className="text-muted-foreground">{owner?.email}</p>
              </div>
            </div>
            {owner?.telephone && (
              <p className="text-muted-foreground">Tel : {owner.telephone}</p>
            )}
            {mandate.mandant_bank_iban && (
              <p className="text-muted-foreground font-mono text-xs">
                IBAN : {mandate.mandant_bank_iban}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Mandate details */}
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Details du mandat
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Debut</p>
              <p className="font-medium">{formatDate(mandate.start_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fin</p>
              <p className="font-medium">{formatDate(mandate.end_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Honoraires</p>
              <p className="font-medium">
                {mandate.management_fee_type === "percentage"
                  ? `${mandate.management_fee_rate}%`
                  : `${((mandate.management_fee_fixed_cents || 0) / 100).toFixed(2)} EUR/mois`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Reconduction</p>
              <Badge variant="outline" className={mandate.tacit_renewal ? "border-emerald-500 text-emerald-600" : ""}>
                {mandate.tacit_renewal ? "Tacite" : "Non"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Biens</p>
              <p className="font-medium">{(mandate.property_ids || []).length || "Tous"}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Mandant Account */}
      {account && (
        <motion.div variants={itemVariants}>
          <Card className={cn(
            "border-0 backdrop-blur-sm",
            account.reversement_overdue
              ? "bg-red-50/60 dark:bg-red-900/20"
              : "bg-white/60 dark:bg-slate-900/60"
          )}>
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  account.reversement_overdue
                    ? "bg-red-100 dark:bg-red-900/30"
                    : "bg-emerald-100 dark:bg-emerald-900/30"
                )}>
                  <Euro className={cn(
                    "w-5 h-5",
                    account.reversement_overdue ? "text-red-600" : "text-emerald-600"
                  )} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCents(account.balance_cents)}</p>
                  <p className="text-sm text-muted-foreground">Solde compte mandant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {account.reversement_overdue && (
                  <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Reversement en retard
                  </Badge>
                )}
                {/* Le bouton Reverser n'apparaît qu'avec une balance > 0
                    et un mandat actif. Inutile sur un mandat résilié ou
                    soldé — l'API rejetterait. */}
                {mandate.status === "active" && account.balance_cents > 0 && (
                  <Button
                    size="sm"
                    onClick={() => {
                      // Pré-remplit avec la balance complète : cas le
                      // plus fréquent (l'agence reverse tout le net dû).
                      setReverseAmountInput(
                        (account.balance_cents / 100).toFixed(2),
                      );
                      setReverseDate(new Date().toISOString().split("T")[0]);
                      setReverseBankRef("");
                      setReverseError(null);
                      setReverseDialogOpen(true);
                    }}
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Reverser au mandant
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Dialog Reversement */}
      <Dialog
        open={reverseDialogOpen}
        onOpenChange={(o) => {
          setReverseDialogOpen(o);
          if (!o) setReverseError(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reversement au mandant</DialogTitle>
            <DialogDescription>
              Pose l'écriture comptable D 467 / C 545 et décrémente le
              solde du compte mandant. Idempotent : si une référence
              bancaire est fournie, deux soumissions identiques ne
              créeront qu'une seule écriture.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reverse-amount">Montant (EUR)</Label>
              <Input
                id="reverse-amount"
                type="number"
                step="0.01"
                min="0"
                value={reverseAmountInput}
                onChange={(e) => setReverseAmountInput(e.target.value)}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Solde disponible :{" "}
                {account ? formatCents(account.balance_cents) : "—"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reverse-date">Date du virement</Label>
              <Input
                id="reverse-date"
                type="date"
                value={reverseDate}
                onChange={(e) => setReverseDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reverse-ref">
                Référence bancaire{" "}
                <span className="text-muted-foreground text-xs">
                  (optionnel — recommandé)
                </span>
              </Label>
              <Input
                id="reverse-ref"
                value={reverseBankRef}
                onChange={(e) => setReverseBankRef(e.target.value)}
                placeholder="ex. VIRT-2026-04-27-001"
              />
            </div>
            {reverseError && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{reverseError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReverseDialogOpen(false)}
              disabled={reverseMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                const amountEuros = Number(reverseAmountInput);
                if (!Number.isFinite(amountEuros) || amountEuros <= 0) {
                  setReverseError("Le montant doit être positif.");
                  return;
                }
                const amountCents = Math.round(amountEuros * 100);
                reverseMutation.mutate({
                  amountCents,
                  date: reverseDate,
                  bankRef: reverseBankRef.trim() || undefined,
                });
              }}
              disabled={reverseMutation.isPending}
            >
              {reverseMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRightLeft className="w-4 h-4 mr-2" />
              )}
              Poser le reversement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CRG Section */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600" />
                Comptes Rendus de Gestion
              </CardTitle>
              <CardDescription>CRG generes pour ce mandat</CardDescription>
            </div>
            {mandate.status === "active" && (
              <Button size="sm" onClick={() => setShowCRGForm(!showCRGForm)}>
                <Plus className="w-4 h-4 mr-2" />
                Generer un CRG
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {showCRGForm && (
              <div className="mb-4">
                <CRGGenerator
                  mandates={[{
                    id: mandate.id,
                    mandate_number: mandate.mandate_number,
                    owner_name: `${owner?.prenom || ""} ${owner?.nom || ""}`.trim(),
                  }]}
                  onGenerate={async (mId, start, end) => {
                    const res = await fetch("/api/agency/crg/generate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ mandate_id: mId, period_start: start, period_end: end }),
                    });
                    if (!res.ok) {
                      const d = await res.json();
                      throw new Error(d.error);
                    }
                    queryClient.invalidateQueries({ queryKey: ["agency-mandate", mandateId] });
                  }}
                  onClose={() => setShowCRGForm(false)}
                />
              </div>
            )}

            {crgs.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Aucun CRG genere pour ce mandat
              </div>
            ) : (
              <div className="space-y-3">
                {crgs.map((crg: any) => (
                  <div key={crg.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Receipt className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {formatDate(crg.period_start)} — {formatDate(crg.period_end)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Net : {formatCents(crg.net_reversement_cents)} | Honoraires : {formatCents(crg.total_fees_cents)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {crgStatusLabels[crg.status] || crg.status}
                      </Badge>
                      {crg.status === "generated" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendCrgMutation.mutate(crg.id)}
                          disabled={sendCrgMutation.isPending}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Envoyer
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Fee Calculator */}
      <motion.div variants={itemVariants}>
        <FeeCalculator
          defaultRate={mandate.management_fee_rate ? Number(mandate.management_fee_rate) : 7}
          defaultType={mandate.management_fee_type || "percentage"}
        />
      </motion.div>
    </motion.div>
  );
}
