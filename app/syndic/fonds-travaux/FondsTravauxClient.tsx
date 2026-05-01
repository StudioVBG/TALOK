"use client";

import { useEffect, useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useCoproSites } from "@/lib/hooks/use-copro-lots";
import { useSyndicDashboard } from "@/lib/hooks/use-syndic-dashboard";
import { formatCents } from "@/lib/utils/format-cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  Hammer,
  TrendingUp,
  Wallet,
  Info,
  ShieldCheck,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface Movement {
  id: string;
  movement_type: "cotisation" | "travaux" | "interets" | "remboursement" | "autre";
  direction: "credit" | "debit";
  amount_cents: number;
  movement_date: string;
  description: string | null;
  reference: string | null;
}

const MOVEMENT_TYPE_LABEL: Record<Movement["movement_type"], string> = {
  cotisation: "Cotisation",
  travaux: "Travaux",
  interets: "Intérêts",
  remboursement: "Remboursement",
  autre: "Autre",
};

export default function FondsTravauxClient() {
  return (
    <PlanGate feature="copro_module" mode="blur">
      <FondsTravauxContent />
    </PlanGate>
  );
}

function FondsTravauxContent() {
  const { data: sites } = useCoproSites();
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const activeSiteId = selectedSiteId || sites?.[0]?.id || "";

  const { worksFund, isLoading, refetch } = useSyndicDashboard(activeSiteId);
  const { toast } = useToast();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    movement_type: "cotisation" as Movement["movement_type"],
    direction: "credit" as Movement["direction"],
    amount_euros: "",
    movement_date: new Date().toISOString().split("T")[0],
    description: "",
    reference: "",
  });

  useEffect(() => {
    if (!activeSiteId) return;
    let cancelled = false;
    setMovementsLoading(true);
    fetch(`/api/copro/fonds-travaux/movements?site_id=${activeSiteId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMovements(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setMovements([]);
      })
      .finally(() => {
        if (!cancelled) setMovementsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSiteId, refetch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSiteId) return;
    const amountCents = Math.round(Number(form.amount_euros) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/copro/fonds-travaux/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: activeSiteId,
          movement_type: form.movement_type,
          direction: form.direction,
          amount_cents: amountCents,
          movement_date: form.movement_date,
          description: form.description || undefined,
          reference: form.reference || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erreur");
      toast({ title: "Mouvement enregistré" });
      setDialogOpen(false);
      setForm({
        movement_type: "cotisation",
        direction: "credit",
        amount_euros: "",
        movement_date: new Date().toISOString().split("T")[0],
        description: "",
        reference: "",
      });
      // Recharger la liste + KPIs
      const reload = await fetch(`/api/copro/fonds-travaux/movements?site_id=${activeSiteId}`);
      setMovements(await reload.json());
      refetch();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Échec de l'enregistrement",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <FondsTravauxLoadingSkeleton />;
  }

  const minRate = 2.5;
  const isCompliant = (worksFund?.rate_pct ?? 0) >= minRate;

  return (
    <div className="space-y-6">
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
              Fonds de travaux
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cotisation obligatoire loi ALUR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sites && sites.length > 1 && (
            <Select value={activeSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="w-full sm:w-64">
                <Building2 className="w-4 h-4 mr-2 text-cyan-600" />
                <SelectValue placeholder="Sélectionner une copropriété" />
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-cyan-600 hover:bg-cyan-700" disabled={!activeSiteId}>
                <Plus className="w-4 h-4 mr-2" />
                Saisir un mouvement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau mouvement</DialogTitle>
                <DialogDescription>
                  Cotisation, dépense de travaux, intérêts, remboursement…
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={form.movement_type}
                      onValueChange={(v) =>
                        setForm({ ...form, movement_type: v as Movement["movement_type"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cotisation">Cotisation</SelectItem>
                        <SelectItem value="travaux">Travaux</SelectItem>
                        <SelectItem value="interets">Intérêts</SelectItem>
                        <SelectItem value="remboursement">Remboursement</SelectItem>
                        <SelectItem value="autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sens</Label>
                    <Select
                      value={form.direction}
                      onValueChange={(v) => setForm({ ...form, direction: v as Movement["direction"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Entrée (crédit)</SelectItem>
                        <SelectItem value="debit">Sortie (débit)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Montant (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.amount_euros}
                      onChange={(e) => setForm({ ...form, amount_euros: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.movement_date}
                      onChange={(e) => setForm({ ...form, movement_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Référence</Label>
                  <Input
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="Facture, virement…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card
        className={
          isCompliant
            ? "border-emerald-200 dark:border-emerald-800"
            : "border-amber-200 dark:border-amber-800"
        }
      >
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div
              className={`shrink-0 p-2 rounded-lg ${
                isCompliant
                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : "bg-amber-100 dark:bg-amber-900/40"
              }`}
            >
              {isCompliant ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {isCompliant
                  ? "Conforme à la loi ALUR"
                  : "Attention : taux inférieur au minimum légal"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                La loi ALUR impose une cotisation minimale de 2,5% du budget
                prévisionnel pour les copropriétés de plus de 10 lots. Le taux
                actuel est de {worksFund?.rate_pct ?? 0}%.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Solde du fonds"
          value={formatCents(worksFund?.balance_cents ?? 0)}
          icon={<Wallet className="w-5 h-5" />}
          color="cyan"
        />
        <KpiCard
          title="Taux de cotisation"
          value={`${worksFund?.rate_pct ?? 0}%`}
          icon={<Hammer className="w-5 h-5" />}
          color="blue"
          subtitle={`Minimum légal : ${minRate}%`}
        />
        <KpiCard
          title="Évolution"
          value={`${(worksFund?.evolution_cents ?? 0) >= 0 ? "+" : ""}${formatCents(worksFund?.evolution_cents ?? 0)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color={(worksFund?.evolution_cents ?? 0) >= 0 ? "green" : "red"}
          subtitle="depuis le dernier exercice"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-cyan-600" />
            Historique des mouvements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {movementsLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : movements.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Aucun mouvement enregistré pour cette copropriété.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-4 sm:px-6 font-medium">Date</th>
                    <th className="text-left py-2 px-4 sm:px-6 font-medium">Type</th>
                    <th className="text-left py-2 px-4 sm:px-6 font-medium">Référence</th>
                    <th className="text-left py-2 px-4 sm:px-6 font-medium">Description</th>
                    <th className="text-right py-2 px-4 sm:px-6 font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 px-4 sm:px-6 text-foreground">
                        {new Date(m.movement_date).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-foreground">
                        {MOVEMENT_TYPE_LABEL[m.movement_type]}
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-muted-foreground text-xs font-mono">
                        {m.reference ?? "—"}
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-muted-foreground">
                        {m.description ?? "—"}
                      </td>
                      <td
                        className={`py-3 px-4 sm:px-6 text-right font-semibold ${
                          m.direction === "credit"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {m.direction === "credit" ? (
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownCircle className="w-3.5 h-3.5" />
                          )}
                          {m.direction === "credit" ? "+" : "-"}
                          {formatCents(m.amount_cents)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-600" />
            À propos du fonds de travaux
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Obligation légale</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Cotisation annuelle obligatoire (loi ALUR du 24 mars 2014)
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Minimum 2,5% du budget prévisionnel pour les copropriétés de plus de 10 lots
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Fonds attaché aux lots et non remboursable en cas de vente
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Utilisation</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Finance les travaux prescrits par la loi ou le règlement
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Travaux de conservation ou d&apos;amélioration de l&apos;immeuble
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Décision d&apos;utilisation votée en AG (majorité art. 25)
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: "cyan" | "blue" | "green" | "red";
  subtitle?: string;
}) {
  const colorMap = {
    cyan: {
      bg: "bg-cyan-100 dark:bg-cyan-900/40",
      text: "text-cyan-600 dark:text-cyan-400",
      gradient: "from-cyan-50 to-cyan-100/50 dark:from-cyan-900/20 dark:to-cyan-800/10",
    },
    blue: {
      bg: "bg-blue-100 dark:bg-blue-900/40",
      text: "text-blue-600 dark:text-blue-400",
      gradient: "from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10",
    },
    green: {
      bg: "bg-emerald-100 dark:bg-emerald-900/40",
      text: "text-emerald-600 dark:text-emerald-400",
      gradient: "from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10",
    },
    red: {
      bg: "bg-red-100 dark:bg-red-900/40",
      text: "text-red-600 dark:text-red-400",
      gradient: "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10",
    },
  };
  const colors = colorMap[color];

  return (
    <Card className="relative overflow-hidden">
      <div
        className={`absolute inset-0 bg-gradient-to-br opacity-50 ${colors.gradient}`}
      />
      <CardContent className="relative pt-4 sm:pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-lg sm:text-2xl font-bold tracking-tight truncate text-foreground">
              {value}
            </p>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className={`shrink-0 p-2 sm:p-3 rounded-xl ${colors.bg} ${colors.text}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FondsTravauxLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-52" />
      <div className="h-20 bg-muted rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
