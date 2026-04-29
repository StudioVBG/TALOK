"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Plus,
  Search,
  Eye,
  Video,
  MapPin,
  Building2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDateShort } from "@/lib/helpers/format";

interface Assembly {
  id: string;
  site_id: string;
  title: string;
  reference_number: string | null;
  assembly_type: "ordinaire" | "extraordinaire" | "concertation" | "consultation_ecrite";
  scheduled_at: string;
  location: string | null;
  online_meeting_url: string | null;
  is_hybrid: boolean;
  status: "draft" | "convened" | "in_progress" | "held" | "adjourned" | "cancelled";
  quorum_required: number | null;
  present_tantiemes: number | null;
  fiscal_year: number | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700 border-slate-200" },
  convened: { label: "Convoquée", color: "bg-blue-100 text-blue-700 border-blue-200" },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700 border-amber-200" },
  held: { label: "Tenue", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  adjourned: { label: "Ajournée", color: "bg-orange-100 text-orange-700 border-orange-200" },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-700 border-red-200" },
};

const TYPE_CONFIG: Record<string, { label: string; short: string }> = {
  ordinaire: { label: "AG Ordinaire", short: "AGO" },
  extraordinaire: { label: "AG Extraordinaire", short: "AGE" },
  concertation: { label: "Concertation", short: "CONC" },
  consultation_ecrite: { label: "Consultation écrite", short: "CE" },
};

export default function SyndicAssembliesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    const fetchAssemblies = async () => {
      try {
        const res = await fetch("/api/copro/assemblies");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Impossible de charger les assemblées");
        }
        const data = await res.json();
        setAssemblies(Array.isArray(data) ? data : []);
      } catch (error) {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Impossible de charger les assemblées",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAssemblies();
  }, [toast]);

  const filteredAssemblies = useMemo(() => {
    return assemblies.filter((assembly) => {
      const matchesSearch =
        search === "" ||
        assembly.title.toLowerCase().includes(search.toLowerCase()) ||
        (assembly.reference_number || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || assembly.status === statusFilter;
      const matchesType = typeFilter === "all" || assembly.assembly_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [assemblies, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: assemblies.length,
      upcoming: assemblies.filter(
        (a) => ["draft", "convened"].includes(a.status) && new Date(a.scheduled_at) > new Date()
      ).length,
      held: assemblies.filter((a) => a.status === "held").length,
      draft: assemblies.filter((a) => a.status === "draft").length,
    };
  }, [assemblies]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-violet-600" />
            Assemblées Générales
          </h1>
          <p className="text-muted-foreground">Gérez les AG de vos copropriétés selon la loi du 10 juillet 1965</p>
        </div>
        <Link href="/syndic/assemblies/new">
          <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle AG
          </Button>
        </Link>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} icon={Calendar} color="text-violet-600" />
        <StatCard label="À venir" value={stats.upcoming} icon={AlertCircle} color="text-amber-600" />
        <StatCard label="Tenues" value={stats.held} icon={CheckCircle2} color="text-emerald-600" />
        <StatCard label="Brouillons" value={stats.draft} icon={Building2} color="text-blue-600" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre ou numéro..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="convened">Convoquée</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="held">Tenue</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="ordinaire">Ordinaire</SelectItem>
                <SelectItem value="extraordinaire">Extraordinaire</SelectItem>
                <SelectItem value="concertation">Concertation</SelectItem>
                <SelectItem value="consultation_ecrite">Consultation écrite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredAssemblies.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="mb-4">
                {assemblies.length === 0
                  ? "Aucune assemblée générale pour le moment."
                  : "Aucun résultat pour ces filtres."}
              </p>
              {assemblies.length === 0 && (
                <Link href="/syndic/assemblies/new">
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Créer votre première AG
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date prévue</TableHead>
                  <TableHead>Lieu</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssemblies.map((assembly) => {
                  const statusConfig = STATUS_CONFIG[assembly.status] || STATUS_CONFIG.draft;
                  const typeConfig = TYPE_CONFIG[assembly.assembly_type] || TYPE_CONFIG.ordinaire;
                  return (
                    <TableRow key={assembly.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {assembly.reference_number || "—"}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{assembly.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-violet-200 text-violet-700">
                          {typeConfig.short}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {formatDateShort(assembly.scheduled_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1 text-sm">
                          {assembly.is_hybrid ? (
                            <>
                              <Video className="h-3 w-3" />
                              Hybride
                            </>
                          ) : assembly.online_meeting_url ? (
                            <>
                              <Video className="h-3 w-3" />
                              Visio
                            </>
                          ) : assembly.location ? (
                            <>
                              <MapPin className="h-3 w-3" />
                              {assembly.location.slice(0, 30)}
                              {assembly.location.length > 30 && "..."}
                            </>
                          ) : (
                            "—"
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusConfig.color} border`}>{statusConfig.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/syndic/assemblies/${assembly.id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
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
