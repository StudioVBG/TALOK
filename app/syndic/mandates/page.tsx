"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Plus,
  Calendar,
  Euro,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDateShort } from "@/lib/helpers/format";

interface SyndicMandate {
  id: string;
  site_id: string;
  syndic_profile_id: string;
  mandate_number: string | null;
  title: string;
  start_date: string;
  end_date: string;
  duration_months: number;
  tacit_renewal: boolean;
  honoraires_annuels_cents: number;
  status: "draft" | "pending_signature" | "active" | "suspended" | "terminated" | "expired";
  signed_at: string | null;
  terminated_at: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
  pending_signature: {
    label: "En attente signature",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: AlertCircle,
  },
  active: { label: "Actif", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  suspended: { label: "Suspendu", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
  terminated: { label: "Résilié", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  expired: { label: "Expiré", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
};

export default function SyndicMandatesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [mandates, setMandates] = useState<SyndicMandate[]>([]);

  useEffect(() => {
    const fetchMandates = async () => {
      try {
        const res = await fetch("/api/copro/mandates");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erreur de chargement");
        }
        const data = await res.json();
        setMandates(Array.isArray(data) ? data : []);
      } catch (error) {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Impossible de charger les mandats",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchMandates();
  }, [toast]);

  const activeCount = mandates.filter((m) => m.status === "active").length;
  const draftCount = mandates.filter((m) => m.status === "draft").length;
  const expiringCount = mandates.filter((m) => {
    if (m.status !== "active") return false;
    const end = new Date(m.end_date);
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    return end <= threeMonthsFromNow;
  }).length;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-violet-600" />
            Mandats de syndic
          </h1>
          <p className="text-muted-foreground">Gérez vos mandats selon la loi du 10 juillet 1965 (durée 1-36 mois)</p>
        </div>
        <Link href="/syndic/mandates/new">
          <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau mandat
          </Button>
        </Link>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={mandates.length} icon={FileText} color="text-violet-600" />
        <StatCard label="Actifs" value={activeCount} icon={CheckCircle2} color="text-emerald-600" />
        <StatCard label="Brouillons" value={draftCount} icon={Clock} color="text-slate-500" />
        <StatCard
          label="Expirent < 3 mois"
          value={expiringCount}
          icon={AlertCircle}
          color="text-amber-600"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : mandates.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="mb-4">Aucun mandat pour le moment</p>
              <Link href="/syndic/mandates/new">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer votre premier mandat
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead className="text-right">Honoraires/an</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mandates.map((mandate) => {
                  const config = STATUS_CONFIG[mandate.status] || STATUS_CONFIG.draft;
                  const Icon = config.icon;
                  return (
                    <TableRow key={mandate.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {mandate.mandate_number || "—"}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{mandate.title}</TableCell>
                      <TableCell className="text-foreground text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateShort(mandate.start_date)} → {formatDateShort(mandate.end_date)}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {mandate.duration_months} mois
                        {mandate.tacit_renewal && (
                          <Badge variant="outline" className="ml-2 border-blue-200 text-blue-700 text-xs">
                            Reconduction
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-foreground">
                        <div className="flex items-center justify-end gap-1">
                          <Euro className="h-3 w-3 text-muted-foreground" />
                          {(mandate.honoraires_annuels_cents / 100).toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${config.color} border`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}
