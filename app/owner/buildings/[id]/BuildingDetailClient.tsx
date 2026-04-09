"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  ArrowLeft,
  Plus,
  MapPin,
  Layers,
  Home,
  DoorOpen,
  Car,
  Store,
  MoreHorizontal,
  Users,
  Euro,
  TrendingUp,
  Filter,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import Image from "next/image";
import type { BuildingRow, BuildingUnitRow } from "@/lib/supabase/database.types";

interface BuildingDetailClientProps {
  propertyId: string;
  buildingId: string | null;
  building: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    departement: string;
    surface: number;
    cover_url: string | null;
    annee_construction: number | null;
    created_at: string;
    updated_at: string;
  };
  buildingMeta: Partial<BuildingRow> | null;
  units: Array<Partial<BuildingUnitRow>>;
}

const unitTypeIcons: Record<string, typeof Home> = {
  appartement: Home,
  studio: DoorOpen,
  local_commercial: Store,
  parking: Car,
  cave: Layers,
  bureau: Building2,
};

const unitTypeLabels: Record<string, string> = {
  appartement: "Appartement",
  studio: "Studio",
  local_commercial: "Local commercial",
  parking: "Parking",
  cave: "Cave",
  bureau: "Bureau",
};

const statusColors: Record<string, string> = {
  vacant: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  occupe: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  travaux: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  reserve: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const statusLabels: Record<string, string> = {
  vacant: "Vacant",
  occupe: "Occupé",
  travaux: "Travaux",
  reserve: "Réservé",
};

function floorLabel(floor: number): string {
  if (floor < 0) return `Sous-sol ${Math.abs(floor)}`;
  if (floor === 0) return "Rez-de-chaussée";
  return `Étage ${floor}`;
}

export function BuildingDetailClient({
  propertyId,
  buildingId,
  building,
  buildingMeta,
  units,
}: BuildingDetailClientProps) {
  // Filters
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Available filter options
  const availableFloors = useMemo(() => {
    const floors = [...new Set(units.map((u) => u.floor ?? 0))].sort((a, b) => b - a);
    return floors;
  }, [units]);

  const availableTypes = useMemo(() => {
    return [...new Set(units.map((u) => u.type || "appartement"))];
  }, [units]);

  // Filtered units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (filterFloor !== "all" && (u.floor ?? 0) !== Number(filterFloor)) return false;
      if (filterType !== "all" && u.type !== filterType) return false;
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      return true;
    });
  }, [units, filterFloor, filterType, filterStatus]);

  // Group filtered units by floor
  const unitsByFloor = filteredUnits.reduce<Record<number, typeof units>>((acc, unit) => {
    const floor = unit.floor ?? 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(unit);
    return acc;
  }, {});

  const floors = Object.keys(unitsByFloor)
    .map(Number)
    .sort((a, b) => b - a);

  // Stats (computed on ALL units, not filtered)
  const totalUnits = units.length;
  const parkingUnits = units.filter((u) => u.type === "parking" || u.type === "cave").length;
  const habitableUnits = totalUnits - parkingUnits;
  const vacantUnits = units.filter((u) => u.status === "vacant" && u.type !== "parking" && u.type !== "cave").length;
  const occupiedUnits = units.filter((u) => u.status === "occupe" && u.type !== "parking" && u.type !== "cave").length;
  const occupancyRate = habitableUnits > 0 ? Math.round((occupiedUnits / habitableUnits) * 100) : 0;
  const revenuActuel = units.filter((u) => u.status === "occupe").reduce((sum, u) => sum + (u.loyer_hc || 0) + (u.charges || 0), 0);
  const revenuPotentiel = units.reduce((sum, u) => sum + (u.loyer_hc || 0) + (u.charges || 0), 0);

  const hasActiveFilters = filterFloor !== "all" || filterType !== "all" || filterStatus !== "all";

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/owner/properties?tab=immeubles">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux immeubles
        </Link>
      </Button>

      {/* Header */}
      <div className="relative h-56 md:h-64 rounded-xl overflow-hidden mb-8 bg-card">
        {building.cover_url ? (
          <Image
            src={building.cover_url}
            alt={building.adresse_complete}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1D4ED8] to-[#60A5FA]">
            <Building2 className="h-24 w-24 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-6 left-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-manrope)]">
              {building.adresse_complete}
            </h1>
            <Badge className="bg-[#2563EB] text-white">
              Immeuble &bull; {totalUnits} lot{totalUnits > 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="flex items-center gap-2 text-white/80">
            <MapPin className="h-4 w-4" />
            {building.code_postal} {building.ville}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{occupancyRate}%</p>
                <p className="text-sm text-muted-foreground">Occupation</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Euro className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{revenuActuel.toLocaleString()}€</p>
                <p className="text-sm text-muted-foreground">Revenus/mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Euro className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{revenuPotentiel.toLocaleString()}€</p>
                <p className="text-sm text-muted-foreground">Potentiel/mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {occupiedUnits}<span className="text-base font-normal text-muted-foreground">/{habitableUnits}</span>
                </p>
                <p className="text-sm text-muted-foreground">Occupés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Building Features */}
      {buildingMeta && (
        <Card className="mb-8 bg-card">
          <CardHeader>
            <CardTitle>Équipements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {buildingMeta.has_ascenseur && <Badge variant="secondary">Ascenseur</Badge>}
              {buildingMeta.has_gardien && <Badge variant="secondary">Gardien</Badge>}
              {buildingMeta.has_interphone && <Badge variant="secondary">Interphone</Badge>}
              {buildingMeta.has_digicode && <Badge variant="secondary">Digicode</Badge>}
              {buildingMeta.has_local_velo && <Badge variant="secondary">Local vélos</Badge>}
              {buildingMeta.has_local_poubelles && <Badge variant="secondary">Local poubelles</Badge>}
              {buildingMeta.has_parking_commun && <Badge variant="secondary">Parking commun</Badge>}
              {buildingMeta.floors && <Badge variant="outline">{buildingMeta.floors} étage{(buildingMeta.floors ?? 0) > 1 ? "s" : ""}</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lots Header + Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold font-[family-name:var(--font-manrope)]">
          Lots par étage
          {hasActiveFilters && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({filteredUnits.length}/{totalUnits})
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterFloor} onValueChange={setFilterFloor}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Étage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les étages</SelectItem>
              {availableFloors.map((f) => (
                <SelectItem key={f} value={String(f)}>{floorLabel(f)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {availableTypes.map((t) => (
                <SelectItem key={t} value={t}>{unitTypeLabels[t] || t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="vacant">Vacant</SelectItem>
              <SelectItem value="occupe">Occupé</SelectItem>
              <SelectItem value="travaux">Travaux</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterFloor("all"); setFilterType("all"); setFilterStatus("all"); }}
            >
              Réinitialiser
            </Button>
          )}
          <Button asChild size="sm">
            <Link href={`/owner/buildings/${building.id}/units`}>
              <Plus className="mr-1 h-4 w-4" />
              Ajouter
            </Link>
          </Button>
        </div>
      </div>

      {/* Units by Floor */}
      {floors.length > 0 ? (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {floors.map((floor, floorIndex) => (
              <motion.div
                key={floor}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: floorIndex * 0.05 }}
              >
                <Card className="bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{floorLabel(floor)}</CardTitle>
                    <CardDescription>
                      {unitsByFloor[floor].length} lot{unitsByFloor[floor].length > 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {unitsByFloor[floor].map((unit) => {
                        const Icon = unitTypeIcons[unit.type || "appartement"] || Home;
                        return (
                          <motion.div
                            key={unit.id}
                            layout
                            className="border rounded-lg p-4 hover:border-[#2563EB]/40 transition-colors bg-card"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                  <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {unitTypeLabels[unit.type || "appartement"]} {unit.position}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {unit.template && `${(unit.template as string).toUpperCase()} • `}
                                    {unit.surface}m² • {unit.nb_pieces} pièce{(unit.nb_pieces || 0) > 1 ? "s" : ""}
                                  </p>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/owner/buildings/${building.id}/units`}>Modifier</Link>
                                  </DropdownMenuItem>
                                  {unit.property_id && (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/owner/properties/${unit.property_id}`}>
                                        <FileText className="h-3.5 w-3.5 mr-2" />
                                        Fiche du bien
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  {unit.status !== "occupe" && (
                                    <DropdownMenuItem asChild>
                                      <Link href={
                                        unit.property_id
                                          ? `/owner/leases/new?propertyId=${unit.property_id}&buildingUnitId=${unit.id}`
                                          : `/owner/buildings/${building.id}/units`
                                      }>
                                        Créer un bail
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem className="text-red-600">Supprimer</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex items-center justify-between">
                              <Badge className={statusColors[unit.status || "vacant"]}>
                                {statusLabels[unit.status || "vacant"]}
                              </Badge>
                              <div className="text-right">
                                <p className="font-semibold text-[#2563EB]">
                                  {(unit.loyer_hc || 0).toLocaleString()}€
                                  <span className="text-xs font-normal text-muted-foreground">/mois</span>
                                </p>
                                {(unit.charges || 0) > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    + {(unit.charges || 0).toLocaleString()}€ charges
                                  </p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Card className="bg-card">
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {hasActiveFilters
                ? "Aucun lot ne correspond aux filtres sélectionnés"
                : "Aucun lot configuré pour cet immeuble"}
            </p>
            {hasActiveFilters ? (
              <Button
                variant="outline"
                onClick={() => { setFilterFloor("all"); setFilterType("all"); setFilterStatus("all"); }}
              >
                Réinitialiser les filtres
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/owner/buildings/${building.id}/units`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter des lots
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
