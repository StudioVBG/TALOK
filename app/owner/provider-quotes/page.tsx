"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";

type QuoteStatus =
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted";

interface QuoteRow {
  id: string;
  reference: string;
  title: string;
  status: QuoteStatus;
  total_amount: number | string;
  valid_until?: string | null;
  sent_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  provider_name: string;
  provider_logo_url?: string | null;
  property_address?: string | null;
}

interface QuoteStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
}

const statusBadge: Record<QuoteStatus, { label: string; className: string }> = {
  sent: { label: "À examiner", className: "bg-blue-100 text-blue-700" },
  viewed: { label: "À examiner", className: "bg-blue-100 text-blue-700" },
  accepted: { label: "Accepté", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Refusé", className: "bg-red-100 text-red-700" },
  expired: { label: "Expiré", className: "bg-amber-100 text-amber-700" },
  converted: {
    label: "Converti en facture",
    className: "bg-violet-100 text-violet-700",
  },
};

function formatEur(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);
}

function formatDateFr(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function OwnerProviderQuotesListPage() {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [stats, setStats] = useState<QuoteStats>({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/owner/provider-quotes", {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erreur de chargement");
        if (!cancelled) {
          setQuotes(json.quotes || []);
          setStats(json.stats || { total: 0, pending: 0, accepted: 0, rejected: 0 });
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Erreur",
            description: error instanceof Error ? error.message : "Impossible de charger",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingQuotes = quotes.filter(
    (q) => q.status === "sent" || q.status === "viewed",
  );
  const otherQuotes = quotes.filter(
    (q) => q.status !== "sent" && q.status !== "viewed",
  );

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Devis prestataires</h1>
        <p className="text-muted-foreground mt-1">
          Devis reçus de vos prestataires pour vos biens
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="À examiner"
          value={stats.pending}
          icon={<Clock className="h-4 w-4" />}
          accent="text-blue-600"
        />
        <StatCard
          label="Acceptés"
          value={stats.accepted}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="text-emerald-600"
        />
        <StatCard
          label="Refusés"
          value={stats.rejected}
          icon={<XCircle className="h-4 w-4" />}
          accent="text-red-600"
        />
      </div>

      {pendingQuotes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">À examiner</h2>
          <div className="space-y-3">
            {pendingQuotes.map((q) => (
              <QuoteRowCard key={q.id} quote={q} highlight />
            ))}
          </div>
        </section>
      )}

      {otherQuotes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Historique
          </h2>
          <div className="space-y-3">
            {otherQuotes.map((q) => (
              <QuoteRowCard key={q.id} quote={q} />
            ))}
          </div>
        </section>
      )}

      {quotes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              Aucun devis prestataire reçu pour le moment.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <span className={accent || "text-muted-foreground"}>{icon}</span>
        </div>
        <p className={`text-2xl font-bold mt-1 ${accent || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function QuoteRowCard({
  quote,
  highlight,
}: {
  quote: QuoteRow;
  highlight?: boolean;
}) {
  const status = statusBadge[quote.status];
  return (
    <Link href={`/owner/provider-quotes/${quote.id}`}>
      <Card
        className={`transition-shadow hover:shadow-md cursor-pointer ${
          highlight ? "border-blue-200 bg-blue-50/30" : ""
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base truncate">
                  {quote.title}
                </CardTitle>
                <Badge variant="outline" className={status.className}>
                  {status.label}
                </Badge>
              </div>
              <CardDescription className="truncate">
                {quote.provider_name}
                {quote.property_address ? ` · ${quote.property_address}` : ""}
              </CardDescription>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-orange-600">
                {formatEur(quote.total_amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {quote.reference}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Reçu {formatDateFr(quote.sent_at)}
              {quote.valid_until ? ` · valable jusqu'au ${formatDateFr(quote.valid_until)}` : ""}
            </span>
            <span className="inline-flex items-center gap-1 text-foreground font-medium">
              Voir le détail <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
