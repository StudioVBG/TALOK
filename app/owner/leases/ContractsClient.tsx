"use client";

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
import { Search, FileText, Plus, MoreHorizontal, Eye, Download, Trash2, Loader2, PenLine, AlertTriangle, RefreshCw, User, Users, ClipboardCheck } from "lucide-react";
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
import { UsageLimitBanner, useSubscription, useUsageLimit, UpgradeModal } from "@/components/subscription";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlanLevel, PLANS, type PlanSlug } from "@/lib/subscriptions/plans";

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

  // SOTA 2026: Vérification limite abonnement pour les baux
  const { canAdd: canAddLease, loading: subscriptionLoading } = useUsageLimit("leases");
  const { currentPlan, hasFeature } = useSubscription();
  const canNavigateToNewLease = canAddLease || subscriptionLoading;
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>(
    filterParam === "pending_signature" ? "pending_signature" : "all"
  );

  // États pour la suppression
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaseToDelete, setLeaseToDelete] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Synchroniser les statuts des baux ET EDL (corrige les signatures non mises à jour)
  const handleSyncStatuses = async () => {
    try {
      setIsSyncing(true);
      
      // 1. Synchroniser les signatures de bail
      const leaseResponse = await fetch("/api/admin/sync-lease-statuses", {
        method: "POST",
      });
      const leaseResult = await leaseResponse.json();
      
      // 2. Synchroniser les EDL et activer les baux
      const edlResponse = await fetch("/api/admin/sync-edl-lease-status", {
        method: "POST",
      });
      const edlResult = await edlResponse.json();
      
      const totalFixed = (leaseResult.fixed || 0) + (edlResult.edlsUpdated || 0) + (edlResult.leasesActivated || 0);
      
      if (leaseResponse.ok || edlResponse.ok) {
        toast({
          title: "✅ Synchronisation terminée",
          description: `${leaseResult.fixed || 0} bail(s) corrigé(s), ${edlResult.edlsUpdated || 0} EDL(s) mis à jour, ${edlResult.leasesActivated || 0} bail(s) activé(s)`,
        });
        // Rafraîchir la liste
        window.location.reload();
      } else {
        throw new Error(leaseResult.error || edlResult.error);
      }
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de synchroniser les statuts",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

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
          description: error instanceof Error ? error.message : "Impossible de supprimer le bail",
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
    const query = searchQuery.toLowerCase();
    filteredLeases = filteredLeases.filter((lease: any) => {
      const property = properties.find((p: any) => p.id === lease.property_id);
      const addressMatch = property?.adresse_complete?.toLowerCase().includes(query);
      const tenantMatch = lease.tenant_name?.toLowerCase().includes(query);
      return addressMatch || tenantMatch;
    });
  }

  if (typeFilter !== "all") {
    filteredLeases = filteredLeases.filter((l: any) => l.type_bail === typeFilter);
  }

  if (statusFilter !== "all") {
    if (statusFilter === "pending_signature") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "pending_signature" || l.statut === "partially_signed");
    } else if (statusFilter === "active") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "active");
    } else if (statusFilter === "fully_signed") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "fully_signed");
    } else if (statusFilter === "draft") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "draft");
    } else if (statusFilter === "notice_given") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "notice_given");
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
                    <span className="font-medium text-foreground block">{getTypeLabel(lease.type_bail)}</span>
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
                <span className="text-sm text-muted-foreground">
                    {property?.adresse_complete || "Bien non trouvé"}
                </span>
            )
        }
    },
    {
        header: "Locataire",
        cell: (lease: any) => {
            const tenantSigner = (lease.signers || []).find(
                (s: any) => s.role === "locataire_principal" || s.role === "colocataire"
            );
            const tenantProfile = tenantSigner?.profile;
            const name = lease.tenant_name && lease.tenant_name !== "Locataire"
                ? lease.tenant_name
                : null;

            if (!name && !tenantProfile) {
                return (
                    <span className="text-xs text-muted-foreground italic">
                        Non assigné
                    </span>
                );
            }

            const initials = tenantProfile
                ? `${(tenantProfile.prenom?.[0] || "").toUpperCase()}${(tenantProfile.nom?.[0] || "").toUpperCase()}`
                : name ? name.split(" ").map((w: string) => w[0]?.toUpperCase()).join("").slice(0, 2) : "?";

            return (
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-semibold text-[10px] flex-shrink-0">
                        {initials || <User className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground block truncate max-w-[140px]">
                            {name || "Locataire"}
                        </span>
                        {tenantProfile?.email && (
                            <span className="text-[10px] text-muted-foreground truncate block max-w-[140px]">
                                {tenantProfile.email}
                            </span>
                        )}
                    </div>
                </div>
            );
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
        cell: (lease: any) => {
            // Déterminer si le propriétaire doit signer
            const ownerNeedsToSign = lease.owner_needs_to_sign || 
              (lease.signers || []).some((s: any) => s.role === "proprietaire" && s.signature_status === "pending");
            
            // Déterminer si on attend le locataire
            const tenantNeedsToSign = lease.tenant_needs_to_sign ||
              (lease.signers || []).some((s: any) => ["locataire_principal", "colocataire"].includes(s.role) && s.signature_status === "pending");
            
            return (
                <div className="flex flex-col items-end gap-1">
                    {/* Badge principal */}
                    <StatusBadge 
                        status={
                            lease.statut === "active" ? "Actif" 
                            : lease.statut === "fully_signed" ? "Signé (Attend EDL)" 
                            : lease.statut === "partially_signed" ? "Partiellement signé"
                            : lease.statut === "pending_signature" ? "Signature" 
                            : lease.statut === "sent" ? "Envoyé"
                            : lease.statut === "draft" ? "Brouillon"
                            : lease.statut === "notice_given" ? "📬 Congé donné"
                            : lease.statut === "terminated" ? "Terminé"
                            : "Archivé"
                        }
                        type={
                            lease.statut === "active" ? "success" 
                            : lease.statut === "fully_signed" ? "info"
                            : lease.statut === "partially_signed" ? "warning"
                            : lease.statut === "pending_signature" ? "warning" 
                            : lease.statut === "draft" ? "neutral"
                            : "neutral"
                        }
                    />
                    {/* Indicateur spécifique pour le propriétaire */}
                    {(lease.statut === "pending_signature" || lease.statut === "partially_signed") && ownerNeedsToSign && (
                        <div className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full animate-pulse">
                            <PenLine className="h-3 w-3" />
                            <span>À signer</span>
                        </div>
                    )}
                    {/* Indicateur si on attend le locataire */}
                    {(lease.statut === "pending_signature" || lease.statut === "partially_signed") && !ownerNeedsToSign && tenantNeedsToSign && (
                        <div className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            <span>Attente locataire</span>
                        </div>
                    )}
                </div>
            );
        }
    },
    {
        header: "Action",
        className: "text-right",
        cell: (lease: any) => {
            const property = properties.find((p: any) => p.id === lease.property_id);
            const ownerNeedsToSign = lease.owner_needs_to_sign || 
              (lease.signers || []).some((s: any) => s.role === "proprietaire" && s.signature_status === "pending");
            
            return (
                <div className="flex justify-end items-center gap-2">
                    {/* Bouton Signer visible si nécessaire */}
                    {lease.statut === "pending_signature" && ownerNeedsToSign && (
                        <Button 
                            asChild
                            size="sm" 
                            className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                        >
                            <Link href={`/owner/leases/${lease.id}`}>
                                <PenLine className="mr-1.5 h-3.5 w-3.5" />
                                Signer
                            </Link>
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                                <Link href={`/owner/leases/${lease.id}`} className="flex items-center">
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

  // Calculer les baux en attente de signature propriétaire
  const leasesAwaitingOwnerSignature = leases.filter((lease: any) => {
    if (lease.statut !== "pending_signature") return false;
    return lease.owner_needs_to_sign || 
      (lease.signers || []).some((s: any) => s.role === "proprietaire" && s.signature_status === "pending");
  });

  const activeLeaseCount = leases.filter((lease: any) =>
    lease.statut === "active" || lease.statut === "pending_signature"
  ).length;

  const nextLeasePlan = ([
    "gratuit",
    "starter",
    "confort",
    "pro",
    "enterprise_s",
    "enterprise_m",
    "enterprise_l",
    "enterprise_xl",
  ] as PlanSlug[]).find(
    (slug) =>
      getPlanLevel(slug) > getPlanLevel(currentPlan) &&
      (PLANS[slug].limits.max_leases === -1 || PLANS[slug].limits.max_leases > activeLeaseCount)
  );

  const createLeaseLabel = canNavigateToNewLease
    ? "Créer un bail"
    : nextLeasePlan
      ? `Passer ${PLANS[nextLeasePlan].name}`
      : "Voir les forfaits";

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
                <span className="block font-medium text-foreground">{getLeaseAddress()}</span>
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
        <div className="container mx-auto px-4 py-4 md:py-8 max-w-7xl">
          {/* Header avec animation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
                Baux & locataires
              </h1>
              <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-lg">
                Gérez vos contrats et vos locataires
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Bouton Sync Statuts */}
              <Button
                variant="outline"
                onClick={handleSyncStatuses}
                disabled={isSyncing}
                size="sm"
                className="border-border hover:bg-muted h-9 md:h-10"
                title="Corriger les statuts des baux signés"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>

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
                size="sm"
                className="border-border hover:bg-muted h-9 md:h-10"
              >
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Exporter</span>
              </Button>

              {/* SOTA 2026: Bouton conditionnel selon limite abonnement */}
              <Button
                {...(canNavigateToNewLease ? { asChild: true } : { onClick: () => setShowUpgradeModal(true) })}
                size="sm"
                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 h-9 md:h-10"
              >
                {canNavigateToNewLease ? (
                  <Link href="/owner/leases/new">
                    <Plus className="mr-1 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{createLeaseLabel}</span>
                    <span className="sm:hidden">Bail</span>
                  </Link>
                ) : (
                  <span className="flex items-center">
                    <Plus className="mr-1 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{createLeaseLabel}</span>
                    <span className="sm:hidden">Bail</span>
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* 🔔 Alerte signatures en attente */}
          {leasesAwaitingOwnerSignature.length > 0 && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-orange-100 rounded-full animate-pulse">
                      <PenLine className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-900 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {leasesAwaitingOwnerSignature.length === 1 
                        ? "1 bail attend votre signature" 
                        : `${leasesAwaitingOwnerSignature.length} baux attendent votre signature`}
                    </h3>
                    <p className="text-sm text-orange-700 mt-1">
                      Cliquez sur le bail concerné pour le signer et finaliser le contrat.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {leasesAwaitingOwnerSignature.slice(0, 3).map((lease: any) => {
                        const property = properties.find((p: any) => p.id === lease.property_id);
                        return (
                          <Link 
                            key={lease.id}
                            href={`/owner/leases/${lease.id}`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-card border border-orange-200 rounded-lg text-sm font-medium text-orange-800 hover:bg-orange-50 hover:border-orange-300 transition-all"
                          >
                            <PenLine className="h-3 w-3" />
                            {property?.adresse_complete?.slice(0, 30) || "Bail"}{property?.adresse_complete?.length > 30 ? "..." : ""}
                          </Link>
                        );
                      })}
                      {leasesAwaitingOwnerSignature.length > 3 && (
                        <span className="inline-flex items-center px-3 py-1.5 text-sm text-orange-600">
                          + {leasesAwaitingOwnerSignature.length - 3} autre(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Usage Limit Banner SOTA 2025 */}
          <div className="mb-6">
            <UsageLimitBanner
              resource="leases"
              variant="inline"
              threshold={70}
              dismissible={true}
            />
          </div>

          {/* SOTA 2026 — Onglets Hub Gestion Locative */}
          <Tabs defaultValue="leases" className="space-y-4 md:space-y-6">
            <TabsList className="bg-card/50 backdrop-blur-sm border w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="leases" className="text-xs sm:text-sm gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Baux & contrats
              </TabsTrigger>
              <TabsTrigger value="tenants" className="text-xs sm:text-sm gap-1.5" asChild>
                <Link href="/owner/tenants">
                  <Users className="h-3.5 w-3.5" />
                  Locataires
                </Link>
              </TabsTrigger>
              <TabsTrigger value="inspections" className="text-xs sm:text-sm gap-1.5" asChild>
                {hasFeature("edl_digital") ? (
                  <Link href="/owner/inspections">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    États des lieux
                  </Link>
                ) : (
                  <button type="button" onClick={() => setShowUpgradeModal(true)} className="flex items-center gap-1.5">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    États des lieux
                  </button>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Baux & contrats */}
            <TabsContent value="leases">
              {/* Filtres */}
              <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 mb-4 md:mb-6">
                <div className="sm:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par adresse ou locataire..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-card/80 backdrop-blur-sm"
                    />
                  </div>
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="bg-card/80 backdrop-blur-sm">
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
                  <SelectTrigger className="bg-card/80 backdrop-blur-sm">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="active">En cours (Actif)</SelectItem>
                    <SelectItem value="notice_given">📬 Congé donné</SelectItem>
                    <SelectItem value="fully_signed">Signés (Attend EDL)</SelectItem>
                    <SelectItem value="pending_signature">En signature</SelectItem>
                    <SelectItem value="draft">Brouillons</SelectItem>
                    <SelectItem value="terminated">Terminés</SelectItem>
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
                    action={canNavigateToNewLease ? {
                        label: "Créer un bail",
                        href: "/owner/leases/new"
                    } : undefined}
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

            {/* Locataires et EDL: navigation vers pages dédiées via les onglets Link ci-dessus */}
          </Tabs>
        </div>
      </div>
      {/* SOTA 2026: Modal upgrade si limite baux atteinte */}
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} requiredPlan={nextLeasePlan} />
    </PageTransition>
  );
}
