"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated

import { useMemo, useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { formatCents } from "@/lib/utils/format-cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  MapPin,
  User,
  Hash,
  Ruler,
  FileText,
  Download,
  CreditCard,
  Calendar,
  Home,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";

// -- Types -------------------------------------------------------------------

interface FundCallRow {
  id: string;
  period_label: string;
  amount_cents: number;
  paid_cents: number;
  status: "pending" | "partial" | "paid" | "overdue";
  due_date: string | null;
}

interface AssemblyRow {
  id: string;
  title: string;
  date: string | null;
  status: string;
}

interface DocumentRow {
  id: string;
  title: string;
  type: string;
  url: string | null;
  distributed_at: string;
}

interface LotRow {
  id: string;
  number: string;
  tantiemes: number;
  tantiemes_total: number;
  surface_m2: number | null;
  type: string | null;
  floor: number | null;
  property_id: string | null;
  property_address: string | null;
}

interface CoproSite {
  site: {
    id: string;
    name: string;
    address: string;
    syndic_name: string | null;
    syndic_email: string | null;
  };
  lots: LotRow[];
  fund_calls: FundCallRow[];
  assemblies_upcoming: AssemblyRow[];
  balance_cents: number;
  documents: DocumentRow[];
}

interface CoproApiResponse {
  copros: CoproSite[];
}

const CALL_STATUS_MAP: Record<
  FundCallRow["status"],
  { label: string; className: string }
> = {
  paid: {
    label: "Payé",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  partial: {
    label: "Partiel",
    className:
      "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  },
  pending: {
    label: "En attente",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  overdue: {
    label: "En retard",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
};

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
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
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<CoproApiResponse | null>({
    queryKey: ["owner", "copro"],
    queryFn: async () => {
      try {
        return await apiClient.get<CoproApiResponse>("/owner/copro");
      } catch {
        return null;
      }
    },
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
  });

  const copros = data?.copros ?? [];

  const selected = useMemo(() => {
    if (copros.length === 0) return null;
    if (selectedSiteId) {
      return copros.find((c) => c.site.id === selectedSiteId) ?? copros[0];
    }
    return copros[0];
  }, [copros, selectedSiteId]);

  if (isLoading) {
    return <CoproOwnerLoadingSkeleton />;
  }

  if (error || copros.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Ma copropriété
        </h1>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <Building2 className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Aucune copropriété rattachée à votre compte
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Si l'un de vos biens est en copropriété, demandez à votre syndic de
              vous inviter. Si votre syndic n'utilise pas Talok, contactez-nous
              à{" "}
              <a
                href="mailto:support@talok.fr"
                className="text-cyan-600 hover:underline"
              >
                support@talok.fr
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selected) return null;

  const { site, lots, fund_calls, balance_cents, documents, assemblies_upcoming } = selected;
  const totalAmountCents = fund_calls.reduce((sum, c) => sum + c.amount_cents, 0);
  const totalPaidCents = fund_calls.reduce((sum, c) => sum + c.paid_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Ma copropriété
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{site.name}</p>
        </div>
        {copros.length > 1 && (
          <Select
            value={selected.site.id}
            onValueChange={(v) => setSelectedSiteId(v)}
          >
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue placeholder="Choisir une copropriété" />
            </SelectTrigger>
            <SelectContent>
              {copros.map((c) => (
                <SelectItem key={c.site.id} value={c.site.id}>
                  {c.site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Copro info + lots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-600" />
              Informations copropriété
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow icon={<Building2 className="w-4 h-4" />} label="Nom" value={site.name} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Adresse" value={site.address || "—"} />
            <InfoRow icon={<User className="w-4 h-4" />} label="Syndic" value={site.syndic_name || "—"} />
            {site.syndic_email && (
              <p className="text-xs text-muted-foreground pl-8">{site.syndic_email}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="w-4 h-4 text-cyan-600" />
              Mes lots ({lots.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun lot rattaché.</p>
            ) : (
              lots.map((lot) => (
                <div
                  key={lot.id}
                  className="flex items-start justify-between py-2 border-b last:border-0 border-border/50"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Lot {lot.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {lot.tantiemes}/{lot.tantiemes_total} tantièmes
                      {lot.surface_m2 ? ` · ${lot.surface_m2} m²` : ""}
                      {lot.floor != null ? ` · Étage ${lot.floor}` : ""}
                    </p>
                    {lot.property_id && lot.property_address && (
                      <Link
                        href={`/owner/properties/${lot.property_id}`}
                        className="text-xs text-cyan-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Home className="w-3 h-3" />
                        {lot.property_address}
                      </Link>
                    )}
                  </div>
                  {lot.type && (
                    <Badge variant="outline" className="text-xs">
                      {lot.type}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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
                  ? "Solde débiteur — somme due à la copropriété"
                  : balance_cents < 0
                    ? "Solde créditeur — trop-perçu en votre faveur"
                    : "Solde équilibré"}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-1">
              <div>
                Total appelé : <span className="font-medium text-foreground">{formatCents(totalAmountCents)}</span>
              </div>
              <div>
                Total payé : <span className="font-medium text-foreground">{formatCents(totalPaidCents)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fund calls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-cyan-600" />
            Mes appels de fonds
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fund_calls.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun appel de fonds.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">Période</th>
                    <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">Échéance</th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">Montant</th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">Payé</th>
                    <th className="text-center py-2 px-4 sm:px-6 text-muted-foreground font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {fund_calls.map((call) => {
                    const cfg = CALL_STATUS_MAP[call.status] ?? CALL_STATUS_MAP.pending;
                    return (
                      <tr key={call.id} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-4 sm:px-6 font-medium text-foreground">{call.period_label}</td>
                        <td className="py-3 px-4 sm:px-6 text-muted-foreground">{formatDate(call.due_date)}</td>
                        <td className="py-3 px-4 sm:px-6 text-right text-foreground">{formatCents(call.amount_cents)}</td>
                        <td className="py-3 px-4 sm:px-6 text-right text-foreground">{formatCents(call.paid_cents)}</td>
                        <td className="py-3 px-4 sm:px-6 text-center">
                          <Badge className={`${cfg.className} border-0`}>{cfg.label}</Badge>
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

      {/* Upcoming assemblies */}
      {assemblies_upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-600" />
              Assemblées à venir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assemblies_upcoming.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.date)}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {a.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-600" />
              Documents distribués par le syndic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400 flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.distributed_at)}</p>
                    </div>
                  </div>
                  {doc.url && (
                    <Button variant="ghost" size="sm" className="text-cyan-600 hover:text-cyan-700" asChild>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

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

function CoproOwnerLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-44 bg-muted rounded-xl" />
        <div className="h-44 bg-muted rounded-xl" />
      </div>
      <div className="h-32 bg-muted rounded-xl" />
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
