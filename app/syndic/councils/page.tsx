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

interface ProfileSummary {
  id: string;
  prenom: string | null;
  nom: string | null;
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
  president?: ProfileSummary | null;
  vice_president?: ProfileSummary | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  active: { label: "Actif", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  suspended: { label: "Suspendu", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertCircle },
  dissolved: { label: "Dissous", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  expired: { label: "Expiré", color: "bg-slate-100 text-slate-700 border-slate-200", icon: AlertCircle },
};

function formatPersonName(person?: ProfileSummary | null): string {
  if (!person) return "—";
  const parts = [person.prenom, person.nom].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

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
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-violet-600" />
            Conseils syndicaux
          </h1>
          <p className="text-muted-foreground">
            Assistent et contrôlent le syndic (loi du 10 juillet 1965, art. 21)
          </p>
        </div>
        <Link href="/syndic/councils/new">
          <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau conseil
          </Button>
        </Link>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground mt-1">{councils.length}</p>
              </div>
              <Users className="h-8 w-8 text-violet-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Actifs</p>
                <p className="text-2xl font-bold text-foreground mt-1">{activeCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : councils.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="mb-4">Aucun conseil syndical pour le moment</p>
              <Link href="/syndic/councils/new">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un conseil
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période de mandat</TableHead>
                  <TableHead>Membres</TableHead>
                  <TableHead>Président</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {councils.map((council) => {
                  const config = STATUS_CONFIG[council.status] || STATUS_CONFIG.active;
                  const Icon = config.icon;
                  return (
                    <TableRow key={council.id}>
                      <TableCell className="text-foreground text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateShort(council.mandate_start)} → {formatDateShort(council.mandate_end)}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {council.members_count} membre{council.members_count > 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {formatPersonName(council.president)}
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
