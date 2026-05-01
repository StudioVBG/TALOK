"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Euro,
  FileText,
  Video,
  MapPin,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface NextAssembly {
  id: string;
  title: string;
  reference_number: string | null;
  assembly_type: string;
  scheduled_at: string;
  location: string | null;
  online_meeting_url: string | null;
  status: string;
}

interface LatestFundCall {
  id: string;
  call_number: string | null;
  period_label: string | null;
  due_date: string | null;
  total_amount_cents: number | null;
  total_amount: number | null;
  status: string | null;
  user_owed_cents: number | null;
}

interface RecentMinute {
  id: string;
  version: number;
  status: string;
  signed_by_president_at: string | null;
  distributed_at: string | null;
  assembly?: { title: string; scheduled_at: string } | null;
}

interface Summary {
  linked: boolean;
  site_id?: string;
  next_assembly: NextAssembly | null;
  latest_fund_call: LatestFundCall | null;
  recent_documents: RecentMinute[];
}

const FUND_CALL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
  sent: { label: "Émis", color: "bg-blue-100 text-blue-700" },
  partial: { label: "Partiellement payé", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Soldé", color: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "En retard", color: "bg-red-100 text-red-700" },
};

function formatDateLong(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatEuros(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `${(cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

export function SyndicSidePanel({ buildingId }: { buildingId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/buildings/${buildingId}/syndic-summary`);
        if (res.ok && !cancelled) {
          setSummary(await res.json());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (!summary || !summary.linked) {
    return null;
  }

  const siteId = summary.site_id ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-600" />
            Côté copropriété
          </h2>
          <p className="text-sm text-muted-foreground">
            Informations transmises par votre syndic Talok (lecture seule).
          </p>
        </div>
        <Link href={`/syndic/sites/${siteId}`}>
          <Button variant="outline" size="sm">
            Voir l'espace copro
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Prochaine AG */}
        <Card className="border-violet-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-violet-700">
              <Calendar className="w-4 h-4" />
              Prochaine AG
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.next_assembly ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground line-clamp-2">
                  {summary.next_assembly.title}
                </p>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDateLong(summary.next_assembly.scheduled_at)}
                </p>
                {summary.next_assembly.online_meeting_url ? (
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Video className="w-3 h-3" />
                    En visioconférence
                  </p>
                ) : summary.next_assembly.location ? (
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {summary.next_assembly.location}
                  </p>
                ) : null}
                <div className="pt-2">
                  <Link href={`/syndic/assemblies/${summary.next_assembly.id}`}>
                    <Button size="sm" variant="ghost" className="text-violet-600 px-2 h-7">
                      Détails de l'AG
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aucune AG programmée.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dernier appel de fonds */}
        <Card className="border-cyan-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-cyan-700">
              <Euro className="w-4 h-4" />
              Dernier appel de fonds
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.latest_fund_call ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">
                    {summary.latest_fund_call.period_label ??
                      summary.latest_fund_call.call_number ??
                      "Appel"}
                  </p>
                  {summary.latest_fund_call.status &&
                    FUND_CALL_STATUS_LABELS[summary.latest_fund_call.status] && (
                      <Badge
                        className={`${FUND_CALL_STATUS_LABELS[summary.latest_fund_call.status].color} border-0 text-[10px]`}
                      >
                        {FUND_CALL_STATUS_LABELS[summary.latest_fund_call.status].label}
                      </Badge>
                    )}
                </div>
                {summary.latest_fund_call.due_date && (
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Échéance :{" "}
                    {new Date(summary.latest_fund_call.due_date).toLocaleDateString("fr-FR")}
                  </p>
                )}
                {summary.latest_fund_call.user_owed_cents != null &&
                  summary.latest_fund_call.user_owed_cents > 0 && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs">
                      <p className="text-red-700 inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Solde impayé :{" "}
                        <span className="font-bold">
                          {formatEuros(summary.latest_fund_call.user_owed_cents)}
                        </span>
                      </p>
                    </div>
                  )}
                {summary.latest_fund_call.user_owed_cents === 0 && (
                  <p className="text-xs text-emerald-700 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />À jour
                  </p>
                )}
                <div className="pt-2">
                  <a
                    href={`/api/copro/fund-calls/${summary.latest_fund_call.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="sm" variant="ghost" className="text-cyan-600 px-2 h-7">
                      Télécharger le PDF
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aucun appel émis pour le moment.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Documents récents */}
        <Card className="border-emerald-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
              <FileText className="w-4 h-4" />
              Procès-verbaux récents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.recent_documents.length > 0 ? (
              <div className="space-y-2">
                {summary.recent_documents.slice(0, 3).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 text-sm border-b border-border last:border-0 pb-1.5 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground line-clamp-1 text-xs font-medium">
                        {doc.assembly?.title ?? `PV v${doc.version}`}
                      </p>
                      <p className="text-muted-foreground text-[10px]">
                        {doc.signed_by_president_at
                          ? `Signé le ${new Date(doc.signed_by_president_at).toLocaleDateString("fr-FR")}`
                          : "Non signé"}
                      </p>
                    </div>
                    <a
                      href={`/api/copro/minutes/${doc.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 hover:text-emerald-700 text-xs"
                    >
                      PDF
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aucun PV publié.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
