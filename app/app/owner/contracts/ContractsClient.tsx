"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, FileText, Plus, MoreHorizontal, Eye, Download, Trash2, Loader2 } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { exportLeases } from "@/lib/services/export-service";
import { useToast } from "@/components/ui/use-toast";

// React Query hooks pour la réactivité
import { useLeases, useDeleteLease } from "@/lib/hooks/use-leases";
import { useProperties } from "@/lib/hooks/use-properties";

// SOTA Imports
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassCard } from "@/components/ui/glass-card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { UsageLimitBanner } from "@/components/subscription";
import { Skeleton } from "@/components/ui/skeleton";

export function ContractsClient() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const propertyIdFilter = searchParams.get("property_id");
  const filterParam = searchParams.get("filter");

  // ✅ React Query : données réactives avec mise à jour automatique
  const { data: leases = [], isLoading: isLoadingLeases } = useLeases();
  const { data: properties = [], isLoading: isLoadingProperties } = useProperties();
  const deleteLeaseMutation = useDeleteLease();
  
  const isLoading = isLoadingLeases || isLoadingProperties;

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>(
    filterParam === "pending_signature" ? "pending_signature" : "all"
  );
  
  // États pour la suppression
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaseToDelete, setLeaseToDelete] = useState<any>(null);

  // ✅ Suppression avec React Query - mise à jour automatique de l'UI !
  const handleDeleteLease = async () => {
    if (!leaseToDelete) return;
    
    deleteLeaseMutation.mutate(leaseToDelete.id, {
      onSuccess: () => {
        toast({
          title: "✅ Bail supprimé",
          description: "Le bail a été supprimé avec succès.",
        });
        setDeleteDialogOpen(false);
        setLeaseToDelete(null);
      },
      onError: (error: any) => {
        console.error("Erreur suppression:", error);
        toast({
          title: "Erreur",
          description: error.message || "Impossible de supprimer le bail",
          variant: "destructive",
        });
      },
    });
  };

  // Ouvrir la dialog de confirmation
  const openDeleteDialog = (lease: any) => {
    setLeaseToDelete(lease);
    setDeleteDialogOpen(true);
  };

  // Filtrer les baux
  let filteredLeases = leases;

  if (propertyIdFilter) {
    filteredLeases = filteredLeases.filter((lease: any) => lease.property_id === propertyIdFilter);
  }

  if (searchQuery) {
    filteredLeases = filteredLeases.filter((lease: any) => {
      const property = properties.find((p: any) => p.id === lease.property_id);
      return property?.adresse_complete?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }

  if (typeFilter !== "all") {
    filteredLeases = filteredLeases.filter((l: any) => l.type_bail === typeFilter);
  }

  if (statusFilter !== "all") {
    if (statusFilter === "pending_signature") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "pending_signature");
    } else if (statusFilter === "active") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "active");
    } else if (statusFilter === "terminated") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "terminated");
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      nu: "Habitation (nu)",
      meuble: "Habitation (meublé)",
      colocation: "Colocation",
      saisonnier: "Saisonnier",
      bail_mobilite: "Bail Mobilité",
      contrat_parking: "Parking",
      commercial_3_6_9: "Commercial 3/6/9",
      commercial_derogatoire: "Commercial dérogatoire",
      professionnel: "Professionnel",
      location_gerance: "Location-gérance",
    };
    return labels[type] || type;
  };

  // Colonnes pour ResponsiveTable
  const columns = [
    {
        header: "Type de Bail",
        cell: (lease: any) => (
            <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <FileText className="h-4 w-4" />
                </div>
                <div>
                    <span className="font-medium text-slate-900 block">{getTypeLabel(lease.type_bail)}</span>
                    <span className="text-xs text-muted-foreground">ID: {lease.id.slice(0, 8)}</span>
                </div>
            </div>
        )
    },
    {
        header: "Bien",
        cell: (lease: any) => {
            const property = properties.find((p: any) => p.id === lease.property_id);
            return (
                <span className="text-sm text-slate-600">
                    {property?.adresse_complete || "Bien non trouvé"}
                </span>
            )
        }
    },
    {
        header: "Période",
        cell: (lease: any) => (
            <div className="text-sm">
                <div className="font-medium">{formatDateShort(lease.date_debut)}</div>
                <div className="text-muted-foreground text-xs">
                    {lease.date_fin ? `au ${formatDateShort(lease.date_fin)}` : "Indéterminée"}
                </div>
            </div>
        )
    },
    {
        header: "Loyer",
        className: "text-right",
        cell: (lease: any) => (
            <div className="text-right">
                <span className="font-bold block">
                    {formatCurrency(Number(lease.loyer || 0) + Number(lease.charges_forfaitaires || 0))}
                </span>
                <span className="text-xs text-muted-foreground">/mois cc</span>
            </div>
        )
    },
    {
        header: "Statut",
        className: "text-right",
        cell: (lease: any) => (
            <div className="flex justify-end">
                <StatusBadge 
                    status={lease.statut === "active" ? "Actif" : lease.statut === "pending_signature" ? "Signature" : "Terminé"}
                    type={lease.statut === "active" ? "success" : lease.statut === "pending_signature" ? "warning" : "neutral"}
                />
            </div>
        )
    },
    {
        header: "Action",
        className: "text-right",
        cell: (lease: any) => {
            const property = properties.find((p: any) => p.id === lease.property_id);
            return (
                <div className="flex justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                                <Link href={`/app/owner/contracts/${lease.id}`} className="flex items-center">
                                    <Eye className="mr-2 h-4 w-4" />
                                    Voir le détail
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => window.open(`/api/leases/${lease.id}/pdf`, '_blank')}
                                className="flex items-center"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Télécharger PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => openDeleteDialog(lease)}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            );
        }
    }
  ];

  // Obtenir l'adresse du bail à supprimer
  const getLeaseAddress = () => {
    if (!leaseToDelete) return "";
    const property = properties.find((p: any) => p.id === leaseToDelete.property_id);
    return property?.adresse_complete || "Adresse inconnue";
  };

  return (
    <PageTransition>
      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Supprimer ce bail ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <span className="block">Vous êtes sur le point de supprimer le bail :</span>
                <span className="block font-medium text-slate-900">{getLeaseAddress()}</span>
                <span className="block text-red-600 font-medium mt-4">
                  ⚠️ Cette action est irréversible !
                </span>
                <span className="block text-sm">
                  Toutes les données associées seront supprimées.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLeaseMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLease}
              disabled={deleteLeaseMutation.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteLeaseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header avec animation */}
          <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
                Baux & locataires
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Gérez vos contrats et vos locataires
              </p>
            </div>
            <div className="flex gap-2">
              {/* Bouton Export CSV */}
              <Button
                variant="outline"
                onClick={() => exportLeases(filteredLeases.map((lease: any) => {
                  const property = properties.find((p: any) => p.id === lease.property_id);
                  return {
                    ...lease,
                    property_address: property?.adresse_complete || 'N/A',
                    tenant_name: lease.signers?.find((s: any) => s.role === 'locataire_principal')?.profile?.prenom + ' ' + 
                      lease.signers?.find((s: any) => s.role === 'locataire_principal')?.profile?.nom || 'N/A',
                  };
                }), "csv")}
                disabled={filteredLeases.length === 0}
                className="border-slate-300 hover:bg-slate-100"
              >
                <Download className="mr-2 h-4 w-4" />
                Exporter
              </Button>
              
              <Button asChild className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <Link href="/app/owner/contracts/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un bail
                </Link>
              </Button>
            </div>
          </div>

          {/* Usage Limit Banner SOTA 2025 */}
          <div className="mb-6">
            <UsageLimitBanner
              resource="leases"
              variant="inline"
              threshold={70}
              dismissible={true}
            />
          </div>

          {/* Onglets */}
          <Tabs defaultValue="leases" className="space-y-6">
            <TabsList className="bg-white/50 backdrop-blur-sm border">
              <TabsTrigger value="leases">Baux & contrats</TabsTrigger>
              <TabsTrigger value="tenants">Locataires & garants</TabsTrigger>
            </TabsList>

            {/* Baux & contrats */}
            <TabsContent value="leases">
              {/* Filtres */}
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par adresse..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-white/80 backdrop-blur-sm"
                    />
                  </div>
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="bg-white/80 backdrop-blur-sm">
                    <SelectValue placeholder="Type bail" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="nu">Habitation (nu)</SelectItem>
                    <SelectItem value="meuble">Habitation (meublé)</SelectItem>
                    <SelectItem value="colocation">Colocation</SelectItem>
                    <SelectItem value="saisonnier">Saisonnier</SelectItem>
                    <SelectItem value="bail_mobilite">Bail Mobilité</SelectItem>
                    <SelectItem value="contrat_parking">Parking</SelectItem>
                    <SelectItem value="commercial_3_6_9">Commercial 3/6/9</SelectItem>
                    <SelectItem value="professionnel">Professionnel</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-white/80 backdrop-blur-sm">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="active">En cours</SelectItem>
                    <SelectItem value="pending_signature">En attente</SelectItem>
                    <SelectItem value="terminated">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Liste des baux */}
              {isLoading ? (
                <GlassCard className="p-6">
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ) : filteredLeases.length === 0 ? (
                <EmptyState
                    title="Aucun bail trouvé"
                    description="Vous n'avez pas encore de bail correspondant à vos critères."
                    icon={FileText}
                    action={{
                        label: "Créer un bail",
                        href: "/app/owner/contracts/new"
                    }}
                />
              ) : (
                <GlassCard className="p-0 overflow-hidden">
                    <ResponsiveTable 
                        data={filteredLeases}
                        columns={columns}
                        keyExtractor={(lease) => lease.id}
                    />
                </GlassCard>
              )}
            </TabsContent>

            {/* Locataires & garants */}
            <TabsContent value="tenants">
              <GlassCard>
                <div className="p-8 text-center">
                    <h2 className="text-xl font-semibold mb-2">Locataires & Garants</h2>
                    <p className="text-muted-foreground mb-4">
                        Vue consolidée de tous vos contacts locataires (Bientôt disponible).
                    </p>
                    <Button variant="outline" asChild>
                        <Link href="/app/owner/contracts">Retour aux baux</Link>
                    </Button>
                </div>
              </GlassCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageTransition>
  );
}
