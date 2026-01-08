"use client";

/**
 * Page: Détail d'un Immeuble - SOTA 2026
 * 
 * Affiche un immeuble avec visualisation des étages et lots
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Building, 
  ArrowLeft,
  MapPin, 
  Home,
  Car,
  TrendingUp,
  Users,
  Edit2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Warehouse,
  Calendar,
  Check,
  Clock,
  Wrench,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buildingsService, BuildingWithStats } from "@/features/properties/services/buildings.service";
import { BuildingUnit, getUnitTypeLabel, getUnitStatusLabel, getUnitStatusColor } from "@/lib/types/building-v3";
import { cn } from "@/lib/utils";

export default function BuildingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const buildingId = params.id as string;
  
  const [building, setBuilding] = useState<BuildingWithStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (buildingId) {
      loadBuilding();
    }
  }, [buildingId]);

  const loadBuilding = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await buildingsService.getBuildingById(buildingId);
      setBuilding(data);
      
      // Expand all floors by default
      if (data.unitsByFloor) {
        setExpandedFloors(new Set(Object.keys(data.unitsByFloor).map(Number)));
      }
    } catch (err: any) {
      console.error("Erreur chargement immeuble:", err);
      setError(err.message || "Erreur lors du chargement");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await buildingsService.deleteBuilding(buildingId);
      router.push("/owner/buildings");
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression");
      setIsDeleting(false);
    }
  };

  const toggleFloor = (floor: number) => {
    setExpandedFloors(prev => {
      const next = new Set(prev);
      if (next.has(floor)) {
        next.delete(floor);
      } else {
        next.add(floor);
      }
      return next;
    });
  };

  const getFloorLabel = (floor: number): string => {
    if (floor === 0) return "Rez-de-chaussée";
    if (floor < 0) return `Sous-sol ${Math.abs(floor)}`;
    if (floor === 1) return "1er étage";
    return `${floor}ème étage`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "occupe": return <Users className="h-3.5 w-3.5" />;
      case "vacant": return <Check className="h-3.5 w-3.5" />;
      case "travaux": return <Wrench className="h-3.5 w-3.5" />;
      case "reserve": return <Clock className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !building) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h2 className="text-lg font-semibold">Immeuble introuvable</h2>
              <p className="text-muted-foreground">{error || "L'immeuble demandé n'existe pas"}</p>
            </div>
            <Button onClick={() => router.push("/owner/buildings")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour aux immeubles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = building.stats || {};
  const floors = building.unitsByFloor ? Object.keys(building.unitsByFloor).map(Number).sort((a, b) => b - a) : [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Breadcrumb */}
      <Link href="/owner/buildings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 group">
        <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Retour aux immeubles
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between gap-6 mb-8">
        <div className="flex-1">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Building className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{building.name}</h1>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <MapPin className="h-4 w-4" />
                {building.adresse_complete}, {building.code_postal} {building.ville}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="outline">{building.floors} étage{building.floors > 1 ? 's' : ''}</Badge>
                {building.has_ascenseur && <Badge variant="secondary">🛗 Ascenseur</Badge>}
                {building.has_gardien && <Badge variant="secondary">👷 Gardien</Badge>}
                {building.has_digicode && <Badge variant="secondary">🔢 Digicode</Badge>}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2">
            <Edit2 className="h-4 w-4" />
            Modifier
          </Button>
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un lot
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cet immeuble ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Tous les lots associés seront également supprimés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Supprimer définitivement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Home className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_units || 0}</p>
                <p className="text-xs text-muted-foreground">Logements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.occupancy_rate || 0}%</p>
                <p className="text-xs text-muted-foreground">Occupation</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Check className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.vacant_units || 0}</p>
                <p className="text-xs text-muted-foreground">Vacants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/10">
                <Car className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_parkings || 0}</p>
                <p className="text-xs text-muted-foreground">Parkings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(stats.revenus_potentiels || 0).toLocaleString()}€</p>
                <p className="text-xs text-muted-foreground">Rev./mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenu principal */}
      <Tabs defaultValue="floors" className="space-y-6">
        <TabsList>
          <TabsTrigger value="floors">Par étage</TabsTrigger>
          <TabsTrigger value="all">Tous les lots</TabsTrigger>
          <TabsTrigger value="vacant">Vacants</TabsTrigger>
        </TabsList>

        <TabsContent value="floors" className="space-y-4">
          {floors.length === 0 ? (
            <Card className="p-12 text-center">
              <Home className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucun lot dans cet immeuble</p>
              <Button className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un lot
              </Button>
            </Card>
          ) : (
            floors.map((floor) => (
              <Collapsible
                key={floor}
                open={expandedFloors.has(floor)}
                onOpenChange={() => toggleFloor(floor)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedFloors.has(floor) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <CardTitle className="text-lg">{getFloorLabel(floor)}</CardTitle>
                          <Badge variant="secondary">
                            {building.unitsByFloor?.[floor]?.length || 0} lot{(building.unitsByFloor?.[floor]?.length || 0) > 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {building.unitsByFloor?.[floor]?.map((unit: BuildingUnit) => (
                          <motion.div
                            key={unit.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={cn(
                              "p-4 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer",
                              unit.status === "occupe" && "border-emerald-200 bg-emerald-50/50",
                              unit.status === "vacant" && "border-blue-200 bg-blue-50/50",
                              unit.status === "travaux" && "border-amber-200 bg-amber-50/50",
                              unit.status === "reserve" && "border-purple-200 bg-purple-50/50"
                            )}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold">
                                  {unit.template?.toUpperCase() || getUnitTypeLabel(unit.type)} - {unit.position}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {unit.surface}m² • {unit.nb_pieces} pièce{unit.nb_pieces > 1 ? 's' : ''}
                                </p>
                              </div>
                              <Badge 
                                variant="secondary"
                                className={cn(
                                  "gap-1",
                                  unit.status === "occupe" && "bg-emerald-100 text-emerald-700",
                                  unit.status === "vacant" && "bg-blue-100 text-blue-700",
                                  unit.status === "travaux" && "bg-amber-100 text-amber-700",
                                  unit.status === "reserve" && "bg-purple-100 text-purple-700"
                                )}
                              >
                                {getStatusIcon(unit.status)}
                                {getUnitStatusLabel(unit.status)}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 border-t mt-2">
                              <span className="text-sm text-muted-foreground">Loyer</span>
                              <span className="font-semibold">
                                {unit.loyer_hc}€ <span className="text-xs text-muted-foreground">+ {unit.charges}€</span>
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {building.units?.map((unit: BuildingUnit) => (
                  <div
                    key={unit.id}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer",
                      unit.status === "occupe" && "border-emerald-200 bg-emerald-50/50",
                      unit.status === "vacant" && "border-blue-200 bg-blue-50/50",
                      unit.status === "travaux" && "border-amber-200 bg-amber-50/50",
                      unit.status === "reserve" && "border-purple-200 bg-purple-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">
                          {unit.template?.toUpperCase() || getUnitTypeLabel(unit.type)} - {unit.position}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getFloorLabel(unit.floor)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {unit.surface}m²
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">
                      {unit.loyer_hc + unit.charges}€/mois
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vacant">
          <Card>
            <CardContent className="p-6">
              {building.units?.filter(u => u.status === "vacant").length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
                  <p className="font-medium text-emerald-600">Tous vos lots sont occupés !</p>
                  <p className="text-sm text-muted-foreground">Excellent taux d'occupation 🎉</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {building.units?.filter(u => u.status === "vacant").map((unit: BuildingUnit) => (
                    <div
                      key={unit.id}
                      className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50/50 hover:shadow-md cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">
                            {unit.template?.toUpperCase() || getUnitTypeLabel(unit.type)} - {unit.position}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getFloorLabel(unit.floor)} • {unit.surface}m²
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t mt-2">
                        <span className="font-semibold text-blue-700">
                          {unit.loyer_hc + unit.charges}€/mois
                        </span>
                        <Button size="sm" variant="outline">
                          Louer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

