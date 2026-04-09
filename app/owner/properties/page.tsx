"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, LayoutGrid, LayoutList, Download, Building, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportProperties } from "@/lib/services/export-service";
import { useProperties, useLeases } from "@/lib/hooks";
import { useEntityStore } from "@/stores/useEntityStore";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { useSearchParams, useRouter } from "next/navigation";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { PropertyCardGridSkeleton } from "@/components/skeletons/property-card-skeleton";
import { SmartImageCard } from "@/components/ui/smart-image-card";
import { EmptyState } from "@/components/ui/empty-state";
import { VirtualGrid } from "@/components/ui/virtual-grid";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";

// Imports SOTA
import { PageTransition } from "@/components/ui/page-transition";
import { UsageLimitBanner, useSubscription, useUsageLimit, UpgradeModal } from "@/components/subscription";
import { PLANS } from "@/lib/subscriptions/plans";
import { buildPropertyQuotaSummary } from "@/lib/subscriptions/property-quota";
import { resolvePropertyCreationGate } from "@/lib/subscriptions/property-creation-gate";
import { ownerPropertyRoutes } from "@/lib/owner/routes";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function OwnerPropertiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleFilter = searchParams.get("module");
  const initialTab = searchParams.get("tab");
  const { activeEntityId, entities, getActiveEntity } = useEntityStore();

  // SOTA 2026 — Onglet "Mes biens" | "Immeubles"
  const [propertyTab, setPropertyTab] = useState<"biens" | "immeubles">(
    initialTab === "immeubles" ? "immeubles" : "biens"
  );

  // Déterminer l'entityId pour le filtrage :
  // - null (toutes les entités) → pas de filtre
  // - un ID d'entité de type "particulier" → "personal" (biens en nom propre)
  // - un ID d'entité spécifique → cet ID
  const activeEntity = getActiveEntity();
  const entityFilterId = activeEntityId === null
    ? undefined
    : activeEntity?.entityType === "particulier"
      ? "personal"
      : activeEntityId;

  const { data: properties = [], isLoading, error: propertiesError, refetch: refetchProperties } = useProperties(entityFilterId);
  const handlePullRefresh = async () => { await refetchProperties(); };
  
  const { data: leases = [], error: leasesError } = useLeases(undefined, {
    enabled: !isLoading && properties.length > 0,
  });

  const { isAtLimit, canAdd, loading: subscriptionLoading } = useUsageLimit("properties");
  const { currentPlan, usage } = useSubscription();
  const upgradeParam = searchParams.get("upgrade");
  const [showUpgradeModal, setShowUpgradeModal] = useState(upgradeParam === "true");

  // Pendant le chargement de l'abonnement, autoriser la navigation (le backend vérifiera)
  // pour éviter un flash de l'UpgradeModal pendant le loading
  const canNavigateToNew = resolvePropertyCreationGate({
    currentPlan,
    usedProperties: usage?.properties?.used ?? properties.length,
    canAddFromUsageLimit: canAdd,
    subscriptionLoading,
  });
  const currentPlanConfig = PLANS[currentPlan];
  const extraPropertyPrice = currentPlanConfig.limits.extra_property_price;
  const addPropertyLabel = canNavigateToNew
    ? "Ajouter un bien"
    : currentPlan === "gratuit"
      ? "Passer Starter"
      : "Voir les options";

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");


  const propertiesWithStatus = useMemo(() => {
    return properties.map((property: any) => {
      const propertyLeases = leases.filter(
        (lease: any) => lease.property_id === property.id
      );
      
      // Trouver les différents types de baux par ordre de priorité
      const activeLease = propertyLeases.find(
        (lease: any) => lease.statut === "active"
      );
      const signedLease = propertyLeases.find(
        (lease: any) => lease.statut === "fully_signed"
      );
      const partiallySignedLease = propertyLeases.find(
        (lease: any) => lease.statut === "partially_signed"
      );
      const pendingLease = propertyLeases.find(
        (lease: any) => lease.statut === "pending_signature"
      );
      const draftLease = propertyLeases.find(
        (lease: any) => lease.statut === "draft" || lease.statut === "sent"
      );

      // Déterminer le statut par ordre de priorité
      let status = "vacant";
      if (activeLease) status = "loue";
      else if (signedLease) status = "signe"; // Nouveau : bail signé, en attente d'EDL
      else if (partiallySignedLease) status = "signature_partielle";
      else if (pendingLease) status = "en_attente_signature";
      else if (draftLease) status = "brouillon";

      // Prendre le bail le plus pertinent
      const currentLease = activeLease || signedLease || partiallySignedLease || pendingLease || draftLease;
      
      const rentFromLease = currentLease
        ? Number(currentLease.loyer || 0) + Number(currentLease.charges_forfaitaires || 0)
        : 0;
      const rentFromProperty = Number(property.loyer_hc || property.loyer_base || 0);
      
      return {
        ...property,
        status,
        currentLease,
        monthlyRent: rentFromLease > 0 ? rentFromLease : rentFromProperty,
      };
    });
  }, [properties, leases]);

  const filteredProperties = useMemo(() => {
    let filtered = propertiesWithStatus;

    // SOTA 2026 — Filtre par onglet Biens/Immeubles
    if (propertyTab === "immeubles") {
      filtered = filtered.filter((p: any) => p.type === "immeuble");
    } else {
      // Tab "Mes biens" : exclure les immeubles parents et les lots (enfants)
      filtered = filtered.filter((p: any) => p.type !== "immeuble" && !p.parent_property_id);
    }

    if (moduleFilter) {
      filtered = filtered.filter((p: any) => {
        if (moduleFilter === "habitation") {
          return p.type === "appartement" || p.type === "maison" || p.type === "colocation";
        }
        if (moduleFilter === "pro") {
          return p.type === "commercial" || p.type === "bureau";
        }
        return true;
      });
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((p: any) => p.type === typeFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((p: any) => p.status === statusFilter);
    }

    if (debouncedSearchQuery) {
      const searchLower = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter((p: any) =>
        p.adresse_complete?.toLowerCase().includes(searchLower) ||
        p.code_postal?.toLowerCase().includes(searchLower) ||
        p.ville?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [propertiesWithStatus, propertyTab, moduleFilter, typeFilter, statusFilter, debouncedSearchQuery]);

  // Quota global : toujours basé sur le nombre total de biens facturables (hors immeubles parents)
  // Le quota doit être identique sur les 2 tabs
  const globalBillableCount = usage?.properties?.used ?? properties.filter((p: any) => p.type !== "immeuble").length;
  const hasScopedView = Boolean(
    moduleFilter ||
    debouncedSearchQuery ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    activeEntityId !== null
  );
  const propertyQuotaSummary = buildPropertyQuotaSummary({
    visibleCount: propertyTab === "immeubles" ? globalBillableCount : filteredProperties.length,
    totalCount: globalBillableCount,
    limit: currentPlanConfig.limits.max_properties,
    hasScopedView,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      loue: "default",
      signe: "default", // Bail signé - bleu
      signature_partielle: "secondary",
      en_attente_signature: "secondary",
      brouillon: "outline",
      vacant: "destructive",
    };
    const labels: Record<string, string> = {
      loue: "Loué",
      signe: "Signé",
      signature_partielle: "Signature partielle",
      en_attente_signature: "En attente",
      brouillon: "Brouillon",
      vacant: "Vacant",
    };
    
    // Returning just the component props or small JSX, 
    // but SmartImageCard expects a ReactNode. We'll pass a Badge there directly or handle it here.
    // Actually SmartImageCard expects `status` as ReactNode.
    // We can use our new StatusBadge here if we want, or keep standard Badge.
    // Let's use standard Badge for consistency with SmartImageCard style which has its own badges array.
    // Actually, SmartImageCard has a dedicated `status` prop which is usually a badge.
    
    const colorClasses: Record<string, string> = {
      loue: 'bg-emerald-500/90 text-white border-emerald-600',
      signe: 'bg-blue-500/90 text-white border-blue-600',
      signature_partielle: 'bg-indigo-500/90 text-white border-indigo-600',
      en_attente_signature: 'bg-amber-500/90 text-white border-amber-600',
      brouillon: 'bg-slate-400/90 text-white border-slate-500',
      vacant: 'bg-red-500/90 text-white border-red-600',
    };
    
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${
        colorClasses[status] || 'bg-slate-500/90 text-white border-slate-600'
      } shadow-sm backdrop-blur-md`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      appartement: "Appartement",
      maison: "Maison",
      studio: "Studio",
      colocation: "Colocation",
      saisonnier: "Saisonnier",
      local_commercial: "Local commercial",
      bureaux: "Bureaux",
      entrepot: "Entrepôt",
      parking: "Parking",
      box: "Box / Garage",
      fonds_de_commerce: "Fonds de commerce",
      immeuble: "Immeuble",
    };
    return labels[type] || type;
  };

  // Types de biens sans "pièces" (parking, box, local commercial, etc.)
  const TYPES_WITHOUT_ROOMS = ["parking", "box", "local_commercial", "bureaux", "entrepot", "fonds_de_commerce"];
  
  // Générer les badges adaptés au type de bien
  const getBadgesForProperty = (property: any) => {
    const badges = [];

    // Immeuble parent : afficher des stats agrégées depuis les lots
    if (property.type === "immeuble") {
      const lots = propertiesWithStatus.filter((p: any) => p.parent_property_id === property.id);
      const nbLots = lots.length;
      const nbOccupes = lots.filter((l: any) => l.status === "loue").length;
      const totalSurface = lots.reduce((acc: number, l: any) => acc + (Number(l.surface) || 0), 0);
      const totalRent = lots.reduce((acc: number, l: any) => acc + (Number(l.monthlyRent) || 0), 0);

      badges.push({ label: `${nbLots} lot${nbLots > 1 ? "s" : ""}`, variant: "secondary" as const });
      badges.push({ label: `${nbOccupes} occupé${nbOccupes > 1 ? "s" : ""}`, variant: "secondary" as const });
      if (totalSurface > 0) {
        badges.push({ label: `${totalSurface} m²`, variant: "secondary" as const });
      }
      badges.push({ label: formatCurrency(totalRent), variant: "default" as const });

      return badges;
    }

    // Surface (toujours affichée)
    badges.push({
      label: `${property.surface || "?"} m²`,
      variant: "secondary" as const
    });

    // Pièces : seulement pour les biens d'habitation
    if (!TYPES_WITHOUT_ROOMS.includes(property.type)) {
      badges.push({
        label: `${property.nb_pieces || "?"} pièces`,
        variant: "secondary" as const
      });
    } else if (property.type === "parking" || property.type === "box") {
      // Pour parking/box : afficher le numéro si disponible
      if (property.parking_numero) {
        badges.push({
          label: `N°${property.parking_numero}`,
          variant: "secondary" as const
        });
      }
    }

    // Loyer (toujours affiché)
    badges.push({
      label: formatCurrency(property.monthlyRent),
      variant: "default" as const
    });

    return badges;
  };

  const columns = [
    {
      header: "Bien",
      cell: (property: any) => (
        <div className="flex items-center gap-3">
          {property.cover_url && (
            <img
              src={property.cover_url}
              alt=""
              className="w-10 h-10 rounded-md object-cover border hidden sm:block"
            />
          )}
          <div>
            <div className="font-medium text-foreground">{property.adresse_complete || "Adresse inconnue"}</div>
            <div className="text-xs text-muted-foreground">
              {property.ville} {property.code_postal}
              {!activeEntityId && property.entity_nom && (
                <span className="ml-1.5 inline-flex items-center gap-1">
                  <span className="text-muted-foreground/50">·</span>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-muted"
                    style={property.entity_couleur ? { borderLeft: `2px solid ${property.entity_couleur}` } : undefined}
                  >
                    {property.entity_nom}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      header: "Type",
      cell: (property: any) => getTypeLabel(property.type)
    },
    {
      header: "Surface / Pièces",
      cell: (property: any) => (
        <div className="text-sm">
          {property.surface ? `${property.surface} m²` : "-"}
          <span className="text-muted-foreground mx-1">•</span>
          {property.nb_pieces ? `${property.nb_pieces} p.` : "-"}
        </div>
      )
    },
    {
      header: "Loyer",
      className: "text-right",
      cell: (property: any) => (
        <div className="text-right">
          <span className="font-medium block">
            {formatCurrency(property.monthlyRent)}
          </span>
          <span className="text-xs text-muted-foreground">
            {property.currentLease ? "Loyer actuel" : "Loyer estimé"}
          </span>
        </div>
      )
    },
    {
      header: "Statut",
      className: "text-right",
      cell: (property: any) => (
        <div className="flex justify-end">
          <StatusBadge 
            status={
              property.status === "loue" ? "Loué" : 
              property.status === "signe" ? "Signé" :
              property.status === "signature_partielle" ? "Signature partielle" :
              property.status === "en_attente_signature" ? "En attente" :
              property.status === "brouillon" ? "Brouillon" :
              "Vacant"
            }
            type={
              property.status === "loue" ? "success" : 
              property.status === "signe" ? "info" :
              property.status === "signature_partielle" ? "warning" :
              property.status === "en_attente_signature" ? "warning" :
              property.status === "brouillon" ? "neutral" :
              "error"
            }
          />
        </div>
      )
    },
    {
      header: "Action",
      className: "text-right",
      cell: (property: any) => (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" asChild>
            <Link href={property.type === "immeuble" ? `/owner/buildings/${property.id}` : `/owner/properties/${property.id}`}>
              Gérer
            </Link>
          </Button>
        </div>
      )
    }
  ];


  // Gestion d'erreur
  if (propertiesError) {
    return (
      <ProtectedRoute allowedRoles={["owner"]}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-destructive">Erreur de chargement</CardTitle>
                <CardDescription>
                  Impossible de charger vos propriétés
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {propertiesError instanceof Error 
                    ? propertiesError.message 
                    : "Une erreur est survenue lors du chargement des données"}
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => refetchProperties()} variant="default">
                    Réessayer
                  </Button>
                  <Button onClick={() => window.location.reload()} variant="outline">
                    Recharger la page
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <PageTransition>
        <PullToRefreshContainer onRefresh={handlePullRefresh}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen"
        >
          <div className="container mx-auto px-4 py-4 md:py-8 max-w-7xl">
            {/* Header avec animation moderne */}
            <motion.div
              variants={itemVariants}
              className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between md:mb-8"
            >
              <motion.div
                className="min-w-0 flex-1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1
                  className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent dark:from-slate-100 dark:via-blue-200 dark:to-slate-100"
                >
                  {activeEntity ? `Biens · ${activeEntity.nom}` : "Mes biens"}
                </h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-lg"
                >
                  {activeEntity
                    ? `${filteredProperties.length} bien${filteredProperties.length > 1 ? "s" : ""} détenu${filteredProperties.length > 1 ? "s" : ""} par ${activeEntity.nom}`
                    : "Gérez votre portefeuille locatif"}
                </motion.p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap"
              >
                {/* Bouton Export CSV */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportProperties(filteredProperties, "csv")}
                  disabled={filteredProperties.length === 0}
                  className="h-9 shrink-0 whitespace-nowrap border-border hover:bg-muted md:h-10"
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Exporter</span>
                </Button>

                {/* Bouton Ajouter — CTA contextualisé selon quota */}
                <Button
                  size="sm"
                  onClick={() => canNavigateToNew ? router.push(ownerPropertyRoutes.new()) : setShowUpgradeModal(true)}
                  className="h-9 shrink-0 whitespace-nowrap text-white shadow-lg transition-all duration-300 hover:shadow-xl md:h-10"
                  style={{ background: 'linear-gradient(to right, #2563eb, #4f46e5)' }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {addPropertyLabel}
                </Button>
              </motion.div>
            </motion.div>

            {/* SOTA 2026 — Onglets Biens / Immeubles */}
            <motion.div variants={itemVariants} className="mb-6">
              <Tabs
                value={propertyTab}
                onValueChange={(v) => setPropertyTab(v as "biens" | "immeubles")}
              >
                <TabsList className="grid w-full grid-cols-2 max-w-xs">
                  <TabsTrigger value="biens" className="gap-1.5 text-xs sm:text-sm">
                    <LayoutGrid className="h-4 w-4" />
                    Mes biens
                  </TabsTrigger>
                  <TabsTrigger value="immeubles" className="gap-1.5 text-xs sm:text-sm">
                    <Building className="h-4 w-4" />
                    Immeubles
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </motion.div>

            {/* Usage Limit Banner SOTA 2025 */}
            <motion.div
              variants={itemVariants}
              className="mb-6"
            >
              <UsageLimitBanner
                resource="properties"
                variant="inline"
                threshold={70}
                dismissible={true}
              />
            </motion.div>

            <motion.div variants={itemVariants} className="mb-6">
              <Card className="border-border bg-card/80">
                <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      Quota global de biens : {propertyQuotaSummary.usageLabel}
                      {currentPlanConfig.limits.max_properties === -1 ? " (illimite)" : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Le blocage d'ajout se base sur le total réel compté pour votre forfait, pas uniquement sur les cartes visibles à l'écran.
                    </p>
                    {propertyQuotaSummary.showScopedHint && propertyQuotaSummary.scopedHint && (
                      <p className="mt-1 text-sm text-amber-700">{propertyQuotaSummary.scopedHint}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Le badge sur chaque carte indique l'occupation ou l'état du bail, pas le paiement du forfait.
                    </p>
                  </div>
                  {isAtLimit && !canNavigateToNew && (
                    <Button variant="outline" onClick={() => setShowUpgradeModal(true)}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Debloquer plus de biens
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {!subscriptionLoading && isAtLimit && extraPropertyPrice > 0 && (
              <motion.div variants={itemVariants} className="mb-6">
                <Card className="border-blue-200 bg-blue-50/60">
                  <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        Votre quota inclus est atteint, mais vous pouvez continuer.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Chaque bien supplémentaire ajoute {formatCurrency(extraPropertyPrice)} HT/mois à votre forfait {currentPlanConfig.name}.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setShowUpgradeModal(true)}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Comparer avec un forfait supérieur
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Filtres avec animations */}
            <motion.div
              variants={itemVariants}
              className="grid gap-4 md:grid-cols-4 mb-6"
            >
              <motion.div
                className="md:col-span-2"
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    aria-label="Rechercher un bien"
                    placeholder="Rechercher par adresse, code postal, ville..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background/80 backdrop-blur-sm border-border focus:bg-background transition-all duration-200"
                  />
                </div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="bg-background/80 backdrop-blur-sm">
                    <SelectValue placeholder="Type de bien" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="appartement">Appartement</SelectItem>
                    <SelectItem value="maison">Maison</SelectItem>
                    <SelectItem value="colocation">Colocation</SelectItem>
                    <SelectItem value="saisonnier">Saisonnier</SelectItem>
                    <SelectItem value="commercial">Local commercial</SelectItem>
                    <SelectItem value="bureau">Bureau</SelectItem>
                    <SelectItem value="parking">Parking</SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-background/80 backdrop-blur-sm">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="loue">Loué</SelectItem>
                    <SelectItem value="signe">Signé (EDL requis)</SelectItem>
                    <SelectItem value="signature_partielle">Signature partielle</SelectItem>
                    <SelectItem value="en_attente_signature">En attente de signature</SelectItem>
                    <SelectItem value="brouillon">Brouillon</SelectItem>
                    <SelectItem value="vacant">Vacant</SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>

              <motion.div className="flex items-center justify-end gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
                <Button
                  variant={viewMode === "grid" ? "outline" : "ghost"}
                  size="sm"
                  className={viewMode === "grid" ? "bg-card shadow-sm" : ""}
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "outline" : "ghost"}
                  size="sm"
                  className={viewMode === "list" ? "bg-card shadow-sm" : ""}
                  onClick={() => setViewMode("list")}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </motion.div>
            </motion.div>

            {/* Loading State avec Skeleton */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <PropertyCardGridSkeleton count={6} />
              </motion.div>
            )}

            {/* Liste des biens avec animations */}
            <AnimatePresence mode="wait">
              {!isLoading && filteredProperties.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  {entityFilterId === "personal" && properties.length === 0 ? (
                    <EmptyState
                      title="Aucun bien en nom propre"
                      description="Vos biens sont associés à une entité juridique. Sélectionnez une entité dans le menu ou choisissez « Tous mes biens » pour les voir."
                    />
                  ) : (
                    <EmptyState
                      title="Aucun bien"
                      description="Aucun bien ne correspond à vos critères de recherche."
                    />
                  )}
                </motion.div>
              ) : !isLoading ? (
                viewMode === "grid" ? (
                  <VirtualGrid
                    items={filteredProperties}
                    estimateSize={320}
                    columns={{ sm: 1, md: 2, lg: 3 }}
                    virtualizeThreshold={30}
                    renderItem={(property: any, index: number) => (
                      <Link href={property.type === "immeuble" ? `/owner/buildings/${property.id}` : `/owner/properties/${property.id}`} className="block h-full">
                        <SmartImageCard
                          src={property.cover_url}
                          alt={property.adresse_complete || "Propriété sans nom"}
                          priority={index < 4}
                          title={property.adresse_complete || "Nouvelle propriété"}
                          subtitle={`${getTypeLabel(property.type)} • ${property.ville || ""}${!activeEntityId && property.entity_nom ? ` • ${property.entity_nom}` : ""}`}
                          badges={[
                            ...getBadgesForProperty(property),
                            ...(!activeEntityId && property.entity_nom ? [{
                              label: property.entity_nom,
                              variant: "outline" as const,
                            }] : []),
                          ]}
                          status={getStatusBadge(property.status)}
                        />
                      </Link>
                    )}
                  />
                ) : (
                  <motion.div
                    key="properties-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-card/50 backdrop-blur-sm rounded-xl border overflow-hidden"
                  >
                    <ResponsiveTable
                      data={filteredProperties}
                      columns={columns}
                      keyExtractor={(item: any) => item.id}
                      onRowClick={(item: any) => router.push(`/owner/properties/${item.id}`)}
                    />
                  </motion.div>
                )
              ) : null}
            </AnimatePresence>

            {/* Gestion d'erreur avec animation */}
            {propertiesError && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <Card className="max-w-md mx-auto border-destructive/50">
                  <CardHeader>
                    <CardTitle className="text-destructive">Erreur de chargement</CardTitle>
                    <CardDescription>
                      Impossible de charger vos propriétés
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {propertiesError instanceof Error 
                        ? propertiesError.message 
                        : "Une erreur est survenue lors du chargement des données"}
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={() => refetchProperties()} variant="default">
                        Réessayer
                      </Button>
                      <Button onClick={() => window.location.reload()} variant="outline">
                        Recharger la page
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </motion.div>
        </PullToRefreshContainer>
      </PageTransition>

      {/* Modal d'upgrade / ajout bien quand limite atteinte */}
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        context="properties"
      />
    </ProtectedRoute>
  );
}
