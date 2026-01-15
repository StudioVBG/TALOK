"use client";
// @ts-nocheck

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
import { Plus, Search, LayoutGrid, LayoutList, Download } from "lucide-react";
import { exportProperties } from "@/lib/services/export-service";
import { useProperties, useLeases } from "@/lib/hooks";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { useSearchParams, useRouter } from "next/navigation";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { PropertyCardGridSkeleton } from "@/components/skeletons/property-card-skeleton";
import { SmartImageCard } from "@/components/ui/smart-image-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";

// Imports SOTA
import { PageTransition } from "@/components/ui/page-transition";
import { UsageLimitBanner } from "@/components/subscription";

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
  const { data: properties = [], isLoading, error: propertiesError, refetch: refetchProperties } = useProperties();
  
  const { data: leases = [], error: leasesError } = useLeases(undefined, {
    enabled: !isLoading && properties.length > 0,
  });

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
  }, [propertiesWithStatus, moduleFilter, typeFilter, statusFilter, debouncedSearchQuery]);

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
    };
    return labels[type] || type;
  };

  // Types de biens sans "pièces" (parking, box, local commercial, etc.)
  const TYPES_WITHOUT_ROOMS = ["parking", "box", "local_commercial", "bureaux", "entrepot", "fonds_de_commerce"];
  
  // Générer les badges adaptés au type de bien
  const getBadgesForProperty = (property: any) => {
    const badges = [];
    
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
            <div className="font-medium text-slate-900">{property.adresse_complete || "Adresse inconnue"}</div>
            <div className="text-xs text-muted-foreground">{property.ville} {property.code_postal}</div>
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
            <Link href={`/owner/properties/${property.id}`}>
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
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md">
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
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8"
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <motion.h1
                  className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent"
                  animate={{
                    backgroundPosition: ["0%", "100%", "0%"],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{
                    backgroundSize: "200% 100%",
                  }}
                >
                  Mes biens
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-lg"
                >
                  Gérez votre portefeuille locatif
                </motion.p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="flex flex-wrap gap-2"
              >
                {/* Bouton Export CSV */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportProperties(filteredProperties, "csv")}
                  disabled={filteredProperties.length === 0}
                  className="border-slate-300 hover:bg-slate-100 h-9 md:h-10"
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Exporter</span>
                </Button>
                
                {/* Bouton Ajouter */}
                <Button
                  asChild
                  className="relative overflow-hidden group shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <Link href="/owner/properties/new">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      whileHover={{ x: ["0%", "100%"], transition: { duration: 0.6, repeat: Infinity, repeatType: "reverse" } }}
                    />
                    <span className="relative flex items-center">
                      <motion.div
                        whileHover={{ rotate: 90 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                      </motion.div>
                      Ajouter un bien
                    </span>
                  </Link>
                </Button>
              </motion.div>
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
                    placeholder="Rechercher par adresse, code postal, ville..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/80 backdrop-blur-sm border-slate-200 focus:bg-white transition-all duration-200"
                  />
                </div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="bg-white/80 backdrop-blur-sm">
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
                  <SelectTrigger className="bg-white/80 backdrop-blur-sm">
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

              <motion.div className="flex items-center justify-end gap-1 bg-slate-100/50 p-1 rounded-lg border border-slate-200/50">
                <Button
                  variant={viewMode === "grid" ? "outline" : "ghost"}
                  size="sm"
                  className={viewMode === "grid" ? "bg-white shadow-sm" : ""}
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "outline" : "ghost"}
                  size="sm"
                  className={viewMode === "list" ? "bg-white shadow-sm" : ""}
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
                  <EmptyState 
                    title="Aucun bien"
                    description="Aucun bien ne correspond à vos critères de recherche."
                  />
                </motion.div>
              ) : !isLoading ? (
                viewMode === "grid" ? (
                  <motion.div
                    key="properties-grid"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  >
                    {filteredProperties.map((property: any, index: number) => (
                      <motion.div
                        key={property.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Link href={`/owner/properties/${property.id}`} className="block h-full">
                          <SmartImageCard
                            src={property.cover_url}
                            alt={property.adresse_complete || "Propriété sans nom"}
                            priority={index < 4}
                            
                            // Titres intégrés
                            title={property.adresse_complete || "Nouvelle propriété"}
                            subtitle={`${getTypeLabel(property.type)} • ${property.ville || ""}`}
                            
                            // Badges automatiques adaptés au type de bien
                            badges={getBadgesForProperty(property)}
                            
                            // Status badge
                            status={getStatusBadge(property.status)}
                            
                            // Overlay Action retiré
                          />
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="properties-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white/50 backdrop-blur-sm rounded-xl border overflow-hidden"
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
      </PageTransition>
    </ProtectedRoute>
  );
}
