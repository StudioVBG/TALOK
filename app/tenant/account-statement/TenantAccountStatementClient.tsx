"use client";

import { useMemo, useState } from "react";
import { Download, AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/helpers/format";
import type { SituationLocataire } from "@/features/accounting/types";

interface Props {
  situation: SituationLocataire | null;
  errorMessage: string | null;
  tenantId: string;
}

const STATUS_VARIANT: Record<
  "solde" | "partiel" | "impaye",
  { label: string; className: string }
> = {
  solde: {
    label: "Solde",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  },
  partiel: {
    label: "Partiel",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",
  },
  impaye: {
    label: "Impaye",
    className:
      "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30",
  },
};

export function TenantAccountStatementClient({
  situation,
  errorMessage,
  tenantId,
}: Props) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const summary = useMemo(() => {
    if (!situation) return null;
    return {
      totalAppele: situation.situation.total_appele,
      totalPaye: situation.situation.total_paye,
      soldeDu: situation.situation.solde_du,
      aJour: situation.situation.a_jour,
      depotGarantie: situation.bail.depot_garantie,
      monthly: situation.bail.total_mensuel,
    };
  }, [situation]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/accounting/situation/${tenantId}?format=pdf`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        throw new Error("Telechargement indisponible");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `releve-${situation?.locataire.nom ?? "compte"}-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Telechargement impossible",
        description:
          err instanceof Error ? err.message : "Reessayez dans un instant.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (errorMessage || !situation || !summary) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Releve de compte
          </h1>
          <p className="text-muted-foreground">
            Recapitulatif de vos echeances, paiements et solde restant du.
          </p>
        </header>
        <GlassCard className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                Releve indisponible pour le moment
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {errorMessage ??
                  "Aucun bail actif n'a ete trouve sur votre compte. Contactez votre proprietaire si l'erreur persiste."}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Releve de compte
          </h1>
          <p className="text-muted-foreground">
            {situation.bien.adresse} — bail depuis le{" "}
            {new Date(situation.bail.date_debut).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="self-start md:self-auto"
        >
          <Download className="mr-2 h-4 w-4" />
          {downloading ? "Generation…" : "Telecharger en PDF"}
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <GlassCard className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Loyer mensuel
          </p>
          <p className="text-xl font-semibold mt-1">
            {formatCurrency(summary.monthly)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            dont {formatCurrency(situation.bail.provisions_charges)} de charges
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Total appele
          </p>
          <p className="text-xl font-semibold mt-1">
            {formatCurrency(summary.totalAppele)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            sur {situation.situation.nb_mois_bail} mois
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Total paye
          </p>
          <p className="text-xl font-semibold mt-1">
            {formatCurrency(summary.totalPaye)}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Solde du
          </p>
          <p
            className={`text-xl font-semibold mt-1 ${
              summary.aJour ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {formatCurrency(summary.soldeDu)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-xs">
            {summary.aJour ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-600">A jour</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                <span className="text-rose-600">Retard</span>
              </>
            )}
          </div>
        </GlassCard>
      </section>

      <GlassCard className="p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-3">Depot de garantie</h2>
        <p className="text-sm text-muted-foreground">
          Depot verse a la signature : {formatCurrency(summary.depotGarantie)}
          . Il vous sera restitue sous 1 a 2 mois apres la fin du bail,
          deduction faite des eventuelles retenues justifiees.
        </p>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        <div className="px-4 md:px-6 py-3 border-b border-border/50">
          <h2 className="text-lg font-semibold">Historique des echeances</h2>
          <p className="text-xs text-muted-foreground">
            12 dernieres echeances. Pour l'historique complet, telechargez le
            PDF.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="px-4 md:px-6 py-2 font-medium">Periode</th>
                <th className="px-4 md:px-6 py-2 font-medium">Echeance</th>
                <th className="px-4 md:px-6 py-2 font-medium text-right">
                  Appele
                </th>
                <th className="px-4 md:px-6 py-2 font-medium text-right">
                  Paye
                </th>
                <th className="px-4 md:px-6 py-2 font-medium text-right">
                  Solde
                </th>
                <th className="px-4 md:px-6 py-2 font-medium text-right">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody>
              {situation.historique.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 md:px-6 py-6 text-center text-muted-foreground"
                  >
                    Aucune echeance enregistree pour le moment.
                  </td>
                </tr>
              ) : (
                situation.historique.map((row) => {
                  const variant = STATUS_VARIANT[row.statut];
                  return (
                    <tr
                      key={row.periode}
                      className="border-t border-border/40 hover:bg-muted/20"
                    >
                      <td className="px-4 md:px-6 py-2">{row.periode}</td>
                      <td className="px-4 md:px-6 py-2">
                        {new Date(row.date_echeance).toLocaleDateString(
                          "fr-FR",
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-2 text-right tabular-nums">
                        {formatCurrency(row.montant_appele)}
                      </td>
                      <td className="px-4 md:px-6 py-2 text-right tabular-nums">
                        {formatCurrency(row.montant_paye)}
                      </td>
                      <td className="px-4 md:px-6 py-2 text-right tabular-nums">
                        {formatCurrency(row.solde)}
                      </td>
                      <td className="px-4 md:px-6 py-2 text-right">
                        <Badge
                          variant="outline"
                          className={variant.className}
                        >
                          {variant.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
