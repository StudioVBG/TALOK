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
  Users,
  Plus,
  Calendar,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDateShort } from "@/lib/helpers/format";

interface CouncilMember {
  profile_id: string;
  unit_id?: string;
  role: "member" | "president" | "vice_president";
  elected_at?: string;
}

interface CoproCouncil {
  id: string;
  site_id: string;
  mandate_start: string;
  mandate_end: string;
  president_profile_id: string | null;
  vice_president_profile_id: string | null;
  members: CouncilMember[];
  members_count: number;
  status: "active" | "suspended" | "dissolved" | "expired";
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  active: { label: "Actif", color: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40", icon: CheckCircle2 },
  suspended: { label: "Suspendu", color: "bg-amber-500/20 text-amber-200 border-amber-400/40", icon: AlertCircle },
  dissolved: { label: "Dissous", color: "bg-red-500/20 text-red-200 border-red-400/40", icon: XCircle },
  expired: { label: "Expiré", color: "bg-slate-500/20 text-slate-300 border-slate-500/40", icon: AlertCircle },
};

export default function SyndicCouncilsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [councils, setCouncils] = useState<CoproCouncil[]>([]);

  useEffect(() => {
    const fetchCouncils = async () => {
      try {
        const res = await fetch("/api/copro/councils");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erreur de chargement");
        }
        const data = await res.json();
        setCouncils(Array.isArray(data) ? data : []);
      } catch (error) {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Impossible de charger les conseils",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchCouncils();
  }, [toast]);

  const activeCount = councils.filter((c) => c.status === "active").length;

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
              <Users className="h-6 w-6 text-violet-400" />
              Conseils syndicaux
            </h1>
            <p className="text-slate-400">
              Assistent et contrôlent le syndic (loi du 10 juillet 1965, art. 21)
            </p>
          </div>
          <Link href="/syndic/councils/new">
            <Button className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau conseil
            </Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total</p>
                  <p className="text-2xl font-bold text-white mt-1">{councils.length}</p>
                </div>
                <Users className="h-8 w-8 text-violet-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Actifs</p>
                  <p className="text-2xl font-bold text-white mt-1">{activeCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 bg-white/10" />
                ))}
              </div>
            ) : councils.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="h-12 w-12 mx-auto mb-3 text-slate-500" />
                <p className="mb-4">Aucun conseil syndical pour le moment</p>
                <Link href="/syndic/councils/new">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un conseil
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-slate-300">Période de mandat</TableHead>
                    <TableHead className="text-slate-300">Membres</TableHead>
                    <TableHead className="text-slate-300">Président</TableHead>
                    <TableHead className="text-slate-300">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {councils.map((council) => {
                    const config = STATUS_CONFIG[council.status] || STATUS_CONFIG.active;
                    const Icon = config.icon;
                    return (
                      <TableRow key={council.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-slate-300 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateShort(council.mandate_start)} → {formatDateShort(council.mandate_end)}
                          </div>
                        </TableCell>
                        <TableCell className="text-white">
                          {council.members_count} membre{council.members_count > 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="text-slate-300 font-mono text-xs">
                          {council.president_profile_id
                            ? `${council.president_profile_id.slice(0, 8)}...`
                            : "—"}
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
