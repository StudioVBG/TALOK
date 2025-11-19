"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Building2, Home, MapPin, Ruler, ArrowRight, Image as ImageIcon, BedDouble, Euro } from "lucide-react";
import { useProperties, useLeases } from "@/lib/hooks";
import { formatCurrency } from "@/lib/helpers/format";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { PropertyCardGridSkeleton } from "@/components/skeletons/property-card-skeleton";

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
  const searchParams = useSearchParams();
  const moduleFilter = searchParams.get("module");
  const { data: properties = [], isLoading, error: propertiesError, refetch: refetchProperties } = useProperties();
  
  // OPTIMISATION : Ne charger les baux que s'il y a des propriétés ET que le chargement est terminé
  const { data: leases = [], error: leasesError } = useLeases(undefined, {
    enabled: !isLoading && properties.length > 0, // Attendre la fin du chargement ET avoir des propriétés
  });

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // Debounce de 300ms
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");


  // Déterminer le statut de chaque bien avec useMemo pour optimiser les performances
  const propertiesWithStatus = useMemo(() => {
    return properties.map((property: any) => {
      const propertyLeases = leases.filter(
        (lease: any) => lease.property_id === property.id
      );
      const activeLease = propertyLeases.find(
        (lease: any) => lease.statut === "active"
      );
      const pendingLease = propertyLeases.find(
        (lease: any) => lease.statut === "pending_signature"
      );

      let status = "vacant";
      if (activeLease) status = "loue";
      else if (pendingLease) status = "en_preavis";

      return {
        ...property,
        status,
        currentLease: activeLease || pendingLease,
        monthlyRent: activeLease
          ? Number(activeLease.loyer || 0) + Number(activeLease.charges_forfaitaires || 0)
          : 0,
      };
    });
  }, [properties, leases]);

  // Filtrer selon les critères avec useMemo pour optimiser
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
      en_preavis: "secondary",
      vacant: "outline",
    };
    const labels: Record<string, string> = {
      loue: "Loué",
      en_preavis: "En préavis",
      vacant: "Vacant",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      appartement: "Appartement",
      maison: "Maison",
      colocation: "Colocation",
      saisonnier: "Saisonnier",
      commercial: "Local commercial",
      bureau: "Bureau",
      parking: "Parking",
    };
    return labels[type] || type;
  };


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
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen"
      >
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header avec animation moderne */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.h1
                className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent"
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
                className="text-muted-foreground mt-2 text-lg"
              >
                Gérez votre portefeuille locatif
              </motion.p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            >
              <Button
                asChild
                className="relative overflow-hidden group shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Link href="/app/owner/properties/new">
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
                  <SelectItem value="en_preavis">En préavis</SelectItem>
                  <SelectItem value="vacant">Vacant</SelectItem>
                </SelectContent>
              </Select>
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
                <EmptyState hasProperties={properties.length === 0} />
              </motion.div>
            ) : !isLoading ? (
              <motion.div
                key="properties"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              >
                {filteredProperties.map((property: any, index: number) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    index={index}
                    getTypeLabel={getTypeLabel}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
              </motion.div>
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
    </ProtectedRoute>
  );
}

function PropertyCard({
  property,
  index,
  getTypeLabel,
  getStatusBadge,
}: {
  property: any;
  index: number;
  getTypeLabel: (type: string) => string;
  getStatusBadge: (status: string) => JSX.Element;
}) {
  return (
    <motion.div
      variants={itemVariants}
      custom={index}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card className="group relative overflow-hidden bg-white/80 backdrop-blur-sm border-slate-200/80 hover:border-blue-300 transition-all duration-300 cursor-pointer h-full flex flex-col">
        {/* Image de couverture */}
        {property.cover_url ? (
          <div className="relative h-48 w-full overflow-hidden">
            <motion.img
              src={property.cover_url}
              alt={property.adresse_complete || "Propriété"}
              className="w-full h-full object-cover"
              initial={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.4 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute top-3 right-3">
              {getStatusBadge(property.status)}
            </div>
          </div>
        ) : (
          <div className="relative h-48 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
             {/* Pattern de fond subtil */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
            <ImageIcon className="h-12 w-12 text-slate-300" />
            <div className="absolute top-3 right-3">
              {getStatusBadge(property.status)}
            </div>
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-medium text-slate-500">
              Pas de photo
            </div>
          </div>
        )}

        <CardHeader className="pb-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="flex items-center justify-between mb-2">
               <Badge variant="outline" className="text-xs font-normal bg-slate-50">
                {getTypeLabel(property.type || "")}
              </Badge>
              {property.documents_count > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> {property.documents_count}
                </span>
              )}
            </div>
            <CardTitle className="text-base font-semibold leading-tight min-h-[2.5rem] line-clamp-2 group-hover:text-blue-600 transition-colors duration-200">
              {property.adresse_complete || <span className="text-muted-foreground italic">Adresse à compléter</span>}
            </CardTitle>
          </motion.div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between pt-0">
          <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-100 my-2">
            {/* Surface */}
            <div className="flex flex-col items-center justify-center p-2 rounded bg-slate-50/50">
               <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                 <Ruler className="h-3.5 w-3.5" />
                 <span className="text-[10px] uppercase font-bold tracking-wider">Surface</span>
               </div>
               <span className={`text-sm font-medium ${!property.surface ? 'text-muted-foreground/50' : 'text-slate-700'}`}>
                 {property.surface ? `${property.surface} m²` : "--"}
               </span>
            </div>

            {/* Pièces */}
            <div className="flex flex-col items-center justify-center p-2 rounded bg-slate-50/50">
               <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                 <Home className="h-3.5 w-3.5" />
                 <span className="text-[10px] uppercase font-bold tracking-wider">Pièces</span>
               </div>
               <span className={`text-sm font-medium ${!property.nb_pieces ? 'text-muted-foreground/50' : 'text-slate-700'}`}>
                 {property.nb_pieces ? property.nb_pieces : "--"}
               </span>
            </div>

            {/* Chambres */}
            <div className="flex flex-col items-center justify-center p-2 rounded bg-slate-50/50">
               <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                 <BedDouble className="h-3.5 w-3.5" />
                 <span className="text-[10px] uppercase font-bold tracking-wider">Chamb.</span>
               </div>
               <span className={`text-sm font-medium ${!property.nb_chambres ? 'text-muted-foreground/50' : 'text-slate-700'}`}>
                 {property.nb_chambres ? property.nb_chambres : "--"}
               </span>
            </div>
          </div>
          
          <div className="space-y-3">
             <div className="flex items-baseline justify-between">
                <div className="text-sm text-muted-foreground">Loyer estimé</div>
                {property.monthlyRent > 0 ? (
                  <div className="text-lg font-bold text-slate-900">
                    {formatCurrency(property.monthlyRent)} <span className="text-xs font-normal text-muted-foreground">/mois</span>
                  </div>
                ) : (
                  <div className="text-sm italic text-muted-foreground/60">Non défini</div>
                )}
             </div>

            <motion.div
              className="pt-2"
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="w-full justify-between hover:bg-blue-50 hover:text-blue-700 transition-colors p-0 h-auto font-medium"
              >
                <Link href={`/app/owner/properties/${property.id}`} className="flex items-center w-full py-2 px-2">
                  Voir le détail
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </CardContent>

        {/* Effet de brillance au survol */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full" />
      </Card>
    </motion.div>
  );
}

function EmptyState({ hasProperties }: { hasProperties: boolean }) {
  if (hasProperties) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/80">
          <CardContent className="py-16 text-center">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="inline-block mb-4"
            >
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground text-lg mb-4"
            >
              Aucun bien ne correspond à vos critères de recherche.
            </motion.p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/80 max-w-md mx-auto">
        <CardContent className="py-16 text-center">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="inline-block mb-6"
          >
            <Building2 className="h-20 w-20 mx-auto text-muted-foreground" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold mb-3 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent"
          >
            Aucun bien pour l'instant
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground mb-8 text-lg"
          >
            Cliquez sur "Ajouter un bien" pour enregistrer votre premier logement.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Link href="/app/owner/properties/new">
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un bien
              </Link>
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
