"use client";

/**
 * Page: Liste des Immeubles - SOTA 2026
 * 
 * Affiche tous les immeubles du propriétaire avec leurs statistiques
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Building, 
  Plus, 
  MapPin, 
  Home,
  Car,
  TrendingUp,
  Users,
  ChevronRight,
  Loader2,
  AlertCircle,
  Warehouse
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { buildingsService, BuildingWithStats } from "@/features/properties/services/buildings.service";
import { cn } from "@/lib/utils";

export default function BuildingsListPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<BuildingWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await buildingsService.getBuildings();
      setBuildings(data);
    } catch (err: any) {
      console.error("Erreur chargement immeubles:", err);
      setError(err.message || "Erreur lors du chargement");
    } finally {
      setIsLoading(false);
    }
  };

  // Stats globales
  const totalUnits = buildings.reduce((acc, b) => acc + (b.stats?.total_units || 0), 0);
  const totalParkings = buildings.reduce((acc, b) => acc + (b.stats?.total_parkings || 0), 0);
  const avgOccupancy = buildings.length > 0 
    ? Math.round(buildings.reduce((acc, b) => acc + (b.stats?.occupancy_rate || 0), 0) / buildings.length)
    : 0;
  const totalRevenue = buildings.reduce((acc, b) => acc + (b.stats?.revenus_potentiels || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Building className="h-8 w-8 text-primary" />
            Mes Immeubles
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos immeubles et leurs lots en un seul endroit
          </p>
        </div>
        <Button 
          onClick={() => router.push("/owner/properties/new?type=immeuble")}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Ajouter un immeuble
        </Button>
      </div>

      {/* Stats globales */}
      {buildings.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Building className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{buildings.length}</p>
                  <p className="text-xs text-muted-foreground">Immeubles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Home className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUnits}</p>
                  <p className="text-xs text-muted-foreground">Logements</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Users className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgOccupancy}%</p>
                  <p className="text-xs text-muted-foreground">Occupation moy.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalRevenue.toLocaleString()}€</p>
                  <p className="text-xs text-muted-foreground">Rev. potentiels/mois</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <Card className="mb-8 border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadBuildings} className="ml-auto">
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Liste vide */}
      {!error && buildings.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Building className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Aucun immeuble</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Créez votre premier immeuble pour gérer tous vos lots au même endroit
          </p>
          <Button 
            onClick={() => router.push("/owner/properties/new?type=immeuble")}
            size="lg"
            className="gap-2"
          >
            <Plus className="h-5 w-5" />
            Créer mon premier immeuble
          </Button>
        </motion.div>
      )}

      {/* Liste des immeubles */}
      {buildings.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {buildings.map((building, index) => (
            <motion.div
              key={building.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link href={`/owner/buildings/${building.id}`}>
                <Card className="group hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-1">
                          {building.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {building.ville} ({building.code_postal})
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Badges lots */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Home className="h-3 w-3" />
                        {building.stats?.total_units || 0} logements
                      </Badge>
                      {(building.stats?.total_parkings || 0) > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <Car className="h-3 w-3" />
                          {building.stats?.total_parkings}
                        </Badge>
                      )}
                      {(building.stats?.total_caves || 0) > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <Warehouse className="h-3 w-3" />
                          {building.stats?.total_caves}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Taux d'occupation */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Occupation</span>
                        <span className={cn(
                          "font-medium",
                          (building.stats?.occupancy_rate || 0) >= 80 ? "text-emerald-600" :
                          (building.stats?.occupancy_rate || 0) >= 50 ? "text-amber-600" : "text-red-600"
                        )}>
                          {building.stats?.occupancy_rate || 0}%
                        </span>
                      </div>
                      <Progress 
                        value={building.stats?.occupancy_rate || 0} 
                        className="h-2"
                      />
                    </div>
                    
                    {/* Revenus */}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Revenus potentiels</span>
                      <span className="font-semibold text-primary">
                        {(building.stats?.revenus_potentiels || 0).toLocaleString()}€/mois
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

