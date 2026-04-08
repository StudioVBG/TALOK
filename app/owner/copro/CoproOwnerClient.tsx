"use client";

import { PlanGate } from "@/components/subscription/plan-gate";
import { formatCents } from "@/lib/utils/format-cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  User,
  Hash,
  Ruler,
  FileText,
  Download,
  CreditCard,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";

// -- Types -------------------------------------------------------------------

interface CoproOwnerData {
  copro: {
    name: string;
    address: string;
    syndic_name: string;
    syndic_email: string;
  };
  lot: {
    number: string;
    tantiemes: number;
    tantiemes_total: number;
    surface_m2: number | null;
    type: string;
    floor: string | null;
  };
  fund_calls: FundCallRow[];
  balance_cents: number;
  annexes: AnnexeDoc[];
}

interface FundCallRow {
  id: string;
  period_label: string;
  amount_cents: number;
  paid_cents: number;
  status: "paye" | "en_attente" | "en_retard";
}

interface AnnexeDoc {
  number: number;
  title: string;
  exercise_label: string;
  download_url: string;
}

const CALL_STATUS_MAP: Record<
  FundCallRow["status"],
  { label: string; className: string }
> = {
  paye: {
    label: "Paye",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  en_attente: {
    label: "En attente",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  en_retard: {
    label: "En retard",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
};

export default function CoproOwnerClient() {
  return (
    <PlanGate feature="copro_module" mode="blur">
      <CoproOwnerContent />
    </PlanGate>
  );
}

function CoproOwnerContent() {
  const { profile } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["owner", "copro"],
    queryFn: async (): Promise<CoproOwnerData | null> => {
      try {
        return await apiClient.get<CoproOwnerData>("/owner/copro");
      } catch {
        return null;
      }
    },
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <CoproOwnerLoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Ma copropriete
        </h1>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <Building2 className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Aucune copropriete associee
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vous n&apos;etes pas rattache a une copropriete pour le moment.
              Contactez votre syndic si vous pensez qu&apos;il s&apos;agit
              d&apos;une erreur.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { copro, lot, fund_calls, balance_cents, annexes } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Ma copropriete
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{copro.name}</p>
      </div>

      {/* Copro info + Lot info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Copro info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-600" />
              Informations copropriete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              icon={<Building2 className="w-4 h-4" />}
              label="Nom"
              value={copro.name}
            />
            <InfoRow
              icon={<MapPin className="w-4 h-4" />}
              label="Adresse"
              value={copro.address}
            />
            <InfoRow
              icon={<User className="w-4 h-4" />}
              label="Syndic"
              value={copro.syndic_name}
            />
            <p className="text-xs text-muted-foreground pl-8">
              {copro.syndic_email}
            </p>
          </CardContent>
        </Card>

        {/* Lot info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="w-4 h-4 text-cyan-600" />
              Mon lot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              icon={<Hash className="w-4 h-4" />}
              label="Numero"
              value={`Lot ${lot.number}`}
            />
            <InfoRow
              icon={<CreditCard className="w-4 h-4" />}
              label="Tantiemes"
              value={`${lot.tantiemes}/${lot.tantiemes_total}`}
            />
            {lot.surface_m2 && (
              <InfoRow
                icon={<Ruler className="w-4 h-4" />}
                label="Surface"
                value={`${lot.surface_m2} m2`}
              />
            )}
            {lot.floor && (
              <InfoRow
                icon={<Building2 className="w-4 h-4" />}
                label="Etage"
                value={lot.floor}
              />
            )}
            <InfoRow
              icon={<FileText className="w-4 h-4" />}
              label="Type"
              value={lot.type.charAt(0).toUpperCase() + lot.type.slice(1)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Fund calls table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-cyan-600" />
            Mes appels de fonds
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fund_calls.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucun appel de fonds
            </p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full text-sm min-w-[450px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Periode
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Montant
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Paye
                    </th>
                    <th className="text-center py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fund_calls.map((call) => {
                    const statusCfg = CALL_STATUS_MAP[call.status];
                    return (
                      <tr
                        key={call.id}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-3 px-4 sm:px-6 font-medium text-foreground">
                          {call.period_label}
                        </td>
                        <td className="py-3 px-4 sm:px-6 text-right text-foreground">
                          {formatCents(call.amount_cents)}
                        </td>
                        <td className="py-3 px-4 sm:px-6 text-right text-foreground">
                          {formatCents(call.paid_cents)}
                        </td>
                        <td className="py-3 px-4 sm:px-6 text-center">
                          <Badge className={`${statusCfg.className} border-0`}>
                            {statusCfg.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Balance */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Mon solde</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  balance_cents > 0
                    ? "text-red-600 dark:text-red-400"
                    : balance_cents < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground"
                }`}
              >
                {formatCents(Math.abs(balance_cents))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {balance_cents > 0
                  ? "Solde debiteur - vous devez cette somme"
                  : balance_cents < 0
                    ? "Solde crediteur - trop-percu en votre faveur"
                    : "Solde equilibre"}
              </p>
            </div>
            {balance_cents > 0 && (
              <Button className="bg-cyan-600 hover:bg-cyan-700" size="sm">
                <CreditCard className="w-4 h-4 mr-2" />
                Regulariser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AG Documents - Annexes */}
      {annexes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-600" />
              Documents AG - Annexes du dernier exercice cloture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {annexes.map((annexe) => (
                <div
                  key={annexe.number}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center text-xs font-bold text-cyan-600 dark:text-cyan-400">
                      {annexe.number}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {annexe.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {annexe.exercise_label}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-cyan-600 hover:text-cyan-700"
                    asChild
                  >
                    <a
                      href={annexe.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// -- Info Row -----------------------------------------------------------------

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

// -- Loading skeleton --------------------------------------------------------

function CoproOwnerLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-44 bg-muted rounded-xl" />
        <div className="h-44 bg-muted rounded-xl" />
      </div>
      <div className="h-64 bg-muted rounded-xl" />
      <div className="h-32 bg-muted rounded-xl" />
    </div>
  );
}
