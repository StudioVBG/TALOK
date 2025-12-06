"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList, Search, CheckCircle2, Clock, Eye } from "lucide-react";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// SOTA Imports
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";
import { PlanGate } from "@/components/subscription";

interface Inspection {
  id: string;
  lease_id: string;
  type: "entree" | "sortie";
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  property_address: string;
  property_city: string;
  tenant_name: string;
  signatures_count: number;
  created_at: string;
}

interface Props {
  inspections: Inspection[];
}

export function InspectionsClient({ inspections }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredInspections = inspections.filter((edl) => {
    const matchesSearch =
      !search ||
      edl.property_address.toLowerCase().includes(search.toLowerCase()) ||
      edl.tenant_name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || edl.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const pendingCount = inspections.filter((e) => e.status === "draft" || e.status === "in_progress").length;

  const columns = [
    {
      header: "Logement",
      cell: (edl: Inspection) => (
        <div>
          <p className="font-medium truncate max-w-[200px] text-slate-900">{edl.property_address}</p>
          <p className="text-xs text-muted-foreground">{edl.property_city}</p>
        </div>
      ),
    },
    {
      header: "Type",
      cell: (edl: Inspection) => (
        <Badge variant="outline" className="bg-slate-50">
          {edl.type === "entree" ? "Entrée" : "Sortie"}
        </Badge>
      ),
    },
    {
      header: "Locataire",
      accessorKey: "tenant_name" as const,
      cell: (edl: Inspection) => <span className="text-sm">{edl.tenant_name}</span>,
    },
    {
      header: "Date prévue",
      cell: (edl: Inspection) => (
        <span className="text-sm text-slate-600">
          {edl.scheduled_date
            ? new Date(edl.scheduled_date).toLocaleDateString("fr-FR")
            : "—"}
        </span>
      ),
    },
    {
      header: "Statut",
      cell: (edl: Inspection) => (
        <StatusBadge 
          status={
            edl.status === 'signed' ? 'Signé' : 
            edl.status === 'completed' ? 'Terminé' : 
            edl.status === 'in_progress' ? 'En cours' : 
            edl.status === 'disputed' ? 'Contesté' : 'Brouillon'
          }
          type={
            edl.status === 'signed' ? 'success' : 
            edl.status === 'completed' ? 'info' : 
            edl.status === 'in_progress' ? 'warning' : 
            edl.status === 'disputed' ? 'error' : 'neutral'
          }
        />
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (edl: Inspection) => (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" asChild className="hover:bg-slate-100">
            <Link href={`/app/owner/inspections/${edl.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              Voir
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageTransition>
      <div className="space-y-8 container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">
              États des lieux
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Gérez les entrées et sorties de vos locataires
            </p>
          </div>
          <Button asChild className="shadow-lg hover:shadow-xl transition-all duration-300">
            <Link href="/app/owner/inspections/new">
              <Plus className="mr-2 h-4 w-4" />
              Planifier un EDL
            </Link>
          </Button>
        </div>

        {/* PlanGate SOTA 2025 - EDL Digital */}
        <PlanGate 
          feature="edl_digital" 
          mode="blur"
          message="L'EDL digital avec signature électronique nécessite un forfait supérieur. Passez à un forfait payant pour créer des états des lieux numériques."
        >

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard gradient={true} hoverEffect={true}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-3xl font-bold text-slate-900">
                    <AnimatedCounter value={inspections.length} />
                  </p>
                </div>
                <div className="p-3 bg-slate-100 rounded-full text-slate-600">
                  <ClipboardList className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </GlassCard>
          
          <GlassCard hoverEffect={true} className="border-amber-100 bg-amber-50/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-700/80">En attente</p>
                  <p className="text-3xl font-bold text-amber-600">
                    <AnimatedCounter value={pendingCount} />
                  </p>
                </div>
                <div className="p-3 bg-amber-100 rounded-full text-amber-600">
                  <Clock className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </GlassCard>
          
          <GlassCard hoverEffect={true} className="border-emerald-100 bg-emerald-50/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700/80">Signés</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    <AnimatedCounter value={inspections.filter((e) => e.status === "signed").length} />
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </GlassCard>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-white/50 backdrop-blur-sm p-1 rounded-xl border border-slate-200/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par adresse ou locataire..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-transparent border-none focus-visible:ring-0 shadow-none"
            />
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {["all", "entree", "sortie"].map((type) => (
              <Button
                key={type}
                variant={typeFilter === type ? "default" : "ghost"}
                size="sm"
                onClick={() => setTypeFilter(type)}
                className={typeFilter === type ? "shadow-sm" : "hover:bg-white/50"}
              >
                {type === "all" ? "Tous" : type === "entree" ? "Entrée" : "Sortie"}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        {filteredInspections.length > 0 ? (
          <GlassCard className="p-0 overflow-hidden">
            <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
              <CardTitle className="text-base font-semibold">Liste des EDL</CardTitle>
              <CardDescription>
                {filteredInspections.length} état{filteredInspections.length > 1 ? "s" : ""} des lieux affiché{filteredInspections.length > 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <ResponsiveTable 
              data={filteredInspections}
              columns={columns}
              keyExtractor={(edl) => edl.id}
            />
          </GlassCard>
        ) : (
          <EmptyState 
            title="Aucun état des lieux"
            description={search ? "Aucun résultat pour votre recherche." : "Commencez par planifier un état des lieux d'entrée ou de sortie."}
            icon={ClipboardList}
            action={!search ? {
                label: "Planifier un EDL",
                href: "/app/owner/inspections/new",
                variant: "default"
            } : undefined}
          />
        )}
        </PlanGate>
      </div>
    </PageTransition>
  );
}
