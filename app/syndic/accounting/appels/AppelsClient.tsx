"use client";

import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import {
  useCoproAppels,
  useCoproAppelDetail,
  useCoproAppelGeneration,
  type AppelPeriod,
  type AppelPeriodicity,
  type AppelStatus,
  type LotPaymentStatus,
} from "@/lib/hooks/use-copro-appels";
import { useCoproSites } from "@/lib/hooks/use-copro-lots";
import { formatCents } from "@/lib/utils/format-cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  ArrowLeft,
  Send,
  CreditCard,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  X,
} from "lucide-react";
import Link from "next/link";

// -- Status helpers ----------------------------------------------------------

const STATUS_CONFIG: Record<
  AppelStatus,
  { label: string; className: string }
> = {
  genere: {
    label: "Genere",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  envoye: {
    label: "Envoye",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  },
  partiellement_collecte: {
    label: "Partiellement collecte",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  collecte: {
    label: "Collecte",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  en_retard: {
    label: "En retard",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
};

const LOT_STATUS_CONFIG: Record<
  LotPaymentStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  paye: {
    label: "Paye",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  en_attente: {
    label: "En attente",
    icon: <Clock className="w-3.5 h-3.5" />,
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  en_retard: {
    label: "En retard",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
};

export default function AppelsClient() {
  return (
    <PlanGate feature="copro_module" mode="blur">
      <AppelsContent />
    </PlanGate>
  );
}

function AppelsContent() {
  const { data: sites } = useCoproSites();
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const activeSiteId = selectedSiteId || sites?.[0]?.id || "";

  const [periodicity, setPeriodicity] = useState<AppelPeriodicity>("trimestriel");
  const [selectedAppel, setSelectedAppel] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const { appels, isLoading } = useCoproAppels(activeSiteId);
  const { generateAppels, isGenerating } = useCoproAppelGeneration();

  const hasAppels = appels.length > 0;

  const handleGenerate = async () => {
    if (!activeSiteId) return;
    await generateAppels({
      site_id: activeSiteId,
      budget_id: "",
      periodicity,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Link
            href="/syndic/accounting"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
              Appels de fonds
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestion des appels et encaissements
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {sites && sites.length > 1 && (
            <Select value={activeSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="w-56">
                <Building2 className="w-4 h-4 mr-2 text-cyan-600" />
                <SelectValue placeholder="Copropriete" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={periodicity}
            onValueChange={(v) => setPeriodicity(v as AppelPeriodicity)}
          >
            <SelectTrigger className="w-44">
              <Calendar className="w-4 h-4 mr-2 text-cyan-600" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trimestriel">Trimestriel</SelectItem>
              <SelectItem value="semestriel">Semestriel</SelectItem>
              <SelectItem value="annuel">Annuel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Generate button when no calls */}
      {!hasAppels && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
              <Zap className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Aucun appel de fonds
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Le budget a ete vote mais les appels ne sont pas encore generes.
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              loading={isGenerating}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              Generer les appels
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Period cards */}
      {hasAppels && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {appels.map((appel) => (
              <AppelPeriodCard
                key={appel.id}
                appel={appel}
                isSelected={selectedAppel === appel.id}
                onClick={() =>
                  setSelectedAppel(
                    selectedAppel === appel.id ? null : appel.id
                  )
                }
              />
            ))}
          </div>

          {/* Detail view */}
          {selectedAppel && (
            <AppelDetailView
              appelId={selectedAppel}
              onRegisterPayment={() => setShowPaymentModal(true)}
            />
          )}
        </>
      )}

      {/* Payment modal */}
      {showPaymentModal && selectedAppel && (
        <PaymentModal
          appelId={selectedAppel}
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* Loading */}
      {isLoading && <AppelsLoadingSkeleton />}
    </div>
  );
}

// -- Period Card --------------------------------------------------------------

function AppelPeriodCard({
  appel,
  isSelected,
  onClick,
}: {
  appel: AppelPeriod;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusConfig = STATUS_CONFIG[appel.status];
  const pct = appel.collection_pct;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? "ring-2 ring-cyan-500 border-cyan-500"
          : "hover:border-cyan-200 dark:hover:border-cyan-800"
      }`}
      onClick={onClick}
    >
      <CardContent className="pt-4 sm:pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            {appel.period_label}
          </h3>
          <ChevronRight
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              isSelected ? "rotate-90" : ""
            }`}
          />
        </div>

        <Badge className={`${statusConfig.className} border-0`}>
          {statusConfig.label}
        </Badge>

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Collecte</span>
            <span className="font-medium text-foreground">{pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 100
                  ? "bg-emerald-500"
                  : pct >= 50
                    ? "bg-cyan-500"
                    : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCents(appel.total_collected_cents)}</span>
            <span>{formatCents(appel.total_due_cents)}</span>
          </div>
        </div>

        {appel.overdue_count > 0 && (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {appel.overdue_count} en retard
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// -- Detail View --------------------------------------------------------------

function AppelDetailView({
  appelId,
  onRegisterPayment,
}: {
  appelId: string;
  onRegisterPayment: () => void;
}) {
  const { lotDetails, isLoading, sendRelance, isSendingRelance } =
    useCoproAppelDetail(appelId);

  const overdueLots = lotDetails.filter((l) => l.status === "en_retard");

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-3">
        <CardTitle className="text-base flex-1">
          Detail par coproprietaire
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegisterPayment}
            className="text-cyan-600 border-cyan-200 hover:bg-cyan-50 dark:border-cyan-800 dark:hover:bg-cyan-900/30"
          >
            <CreditCard className="w-4 h-4 mr-1" />
            Enregistrer paiement
          </Button>
          {overdueLots.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                sendRelance(overdueLots.map((l) => l.lot_id))
              }
              loading={isSendingRelance}
              className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30"
            >
              <Send className="w-4 h-4 mr-1" />
              Envoyer relance
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-4 sm:-mx-6">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                  Lot
                </th>
                <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                  Nom
                </th>
                <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                  Tantiemes
                </th>
                <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                  Du
                </th>
                <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                  Paye
                </th>
                <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                  Solde
                </th>
                <th className="text-center py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody>
              {lotDetails.map((lot) => {
                const statusCfg = LOT_STATUS_CONFIG[lot.status];
                return (
                  <tr
                    key={lot.lot_id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-3 px-4 sm:px-6 font-medium text-foreground">
                      {lot.lot_number}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-foreground">
                      {lot.owner_name}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-right text-muted-foreground">
                      {lot.tantiemes}/{lot.tantiemes_total}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-right text-foreground">
                      {formatCents(lot.due_cents)}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-right text-foreground">
                      {formatCents(lot.paid_cents)}
                    </td>
                    <td
                      className={`py-3 px-4 sm:px-6 text-right font-medium ${
                        lot.balance_cents > 0
                          ? "text-red-600 dark:text-red-400"
                          : lot.balance_cents < 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                      }`}
                    >
                      {formatCents(lot.balance_cents)}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-center">
                      <Badge
                        className={`${statusCfg.className} border-0 gap-1`}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Payment Modal ------------------------------------------------------------

function PaymentModal({
  appelId,
  open,
  onClose,
}: {
  appelId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { lotDetails, registerPayment, isRegistering } =
    useCoproAppelDetail(appelId);
  const [selectedLot, setSelectedLot] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentType, setPaymentType] = useState<"virement" | "cheque" | "prelevement" | "especes">("virement");

  const handleSubmit = async () => {
    if (!selectedLot || !amount) return;
    await registerPayment({
      appel_period_id: appelId,
      lot_id: selectedLot,
      amount_cents: Math.round(parseFloat(amount) * 100),
      payment_date: paymentDate,
      payment_type: paymentType,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Coproprietaire
            </label>
            <Select value={selectedLot} onValueChange={setSelectedLot}>
              <SelectTrigger>
                <SelectValue placeholder="Selectionner un lot" />
              </SelectTrigger>
              <SelectContent>
                {lotDetails
                  .filter((l) => l.status !== "paye")
                  .map((lot) => (
                    <SelectItem key={lot.lot_id} value={lot.lot_id}>
                      Lot {lot.lot_number} - {lot.owner_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Montant
            </label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Date
            </label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Mode de paiement
            </label>
            <Select value={paymentType} onValueChange={(v) => setPaymentType(v as typeof paymentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="virement">Virement</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="prelevement">Prelevement</SelectItem>
                <SelectItem value="especes">Especes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedLot || !amount || isRegistering}
            loading={isRegistering}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -- Loading skeleton --------------------------------------------------------

function AppelsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-44 bg-muted rounded-xl" />
      ))}
    </div>
  );
}
