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
  draft: { label: "Brouillon", color: "bg-slate-500/20 text-slate-200 border-slate-400/40", icon: Clock },
  pending_signature: {
    label: "En attente signature",
    color: "bg-amber-500/20 text-amber-200 border-amber-400/40",
    icon: AlertCircle,
  },
  active: { label: "Actif", color: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40", icon: CheckCircle2 },
  suspended: { label: "Suspendu", color: "bg-orange-500/20 text-orange-200 border-orange-400/40", icon: AlertCircle },
  terminated: { label: "Résilié", color: "bg-red-500/20 text-red-200 border-red-400/40", icon: XCircle },
  expired: { label: "Expiré", color: "bg-slate-500/20 text-slate-300 border-slate-500/40", icon: Clock },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="h-6 w-6 text-violet-400" />
              Mandats de syndic
            </h1>
            <p className="text-slate-400">Gérez vos mandats selon la loi du 10 juillet 1965 (durée 1-36 mois)</p>
          </div>
          <Link href="/syndic/mandates/new">
            <Button className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau mandat
            </Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total" value={mandates.length} icon={FileText} color="text-violet-400" />
          <StatCard label="Actifs" value={activeCount} icon={CheckCircle2} color="text-emerald-400" />
          <StatCard label="Brouillons" value={draftCount} icon={Clock} color="text-slate-400" />
          <StatCard
            label="Expirent < 3 mois"
            value={expiringCount}
            icon={AlertCircle}
            color="text-amber-400"
          />
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 bg-white/10" />
                ))}
              </div>
            ) : mandates.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="h-12 w-12 mx-auto mb-3 text-slate-500" />
                <p className="mb-4">Aucun mandat pour le moment</p>
                <Link href="/syndic/mandates/new">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    <Plus className="h-4 w-4 mr-2" />
                    Créer votre premier mandat
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-300">Référence</TableHead>
                    <TableHead className="text-slate-300">Titre</TableHead>
                    <TableHead className="text-slate-300">Période</TableHead>
                    <TableHead className="text-slate-300">Durée</TableHead>
                    <TableHead className="text-slate-300 text-right">Honoraires/an</TableHead>
                    <TableHead className="text-slate-300">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mandates.map((mandate) => {
                    const config = STATUS_CONFIG[mandate.status] || STATUS_CONFIG.draft;
                    const Icon = config.icon;
                    return (
                      <TableRow key={mandate.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="font-mono text-xs text-slate-400">
                          {mandate.mandate_number || "—"}
                        </TableCell>
                        <TableCell className="text-white font-medium">{mandate.title}</TableCell>
                        <TableCell className="text-slate-300 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateShort(mandate.start_date)} → {formatDateShort(mandate.end_date)}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {mandate.duration_months} mois
                          {mandate.tacit_renewal && (
                            <Badge variant="outline" className="ml-2 border-blue-400/30 text-blue-200 text-xs">
                              Reconduction
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-white">
                          <div className="flex items-center justify-end gap-1">
                            <Euro className="h-3 w-3 text-slate-400" />
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
    <Card className="bg-white/5 border-white/10 backdrop-blur">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}
