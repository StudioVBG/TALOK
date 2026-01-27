"use client";

import { motion } from "framer-motion";
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
  Edit,
  MoreHorizontal,
  Users,
  Calendar,
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
import Link from "next/link";
import Image from "next/image";
import type { BuildingRow, BuildingUnitRow } from "@/lib/supabase/database.types";

interface BuildingDetailClientProps {
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
  vacant: "bg-green-100 text-green-800",
  occupe: "bg-blue-100 text-blue-800",
  travaux: "bg-orange-100 text-orange-800",
  reserve: "bg-purple-100 text-purple-800",
};

const statusLabels: Record<string, string> = {
  vacant: "Vacant",
  occupe: "Occupé",
  travaux: "Travaux",
  reserve: "Réservé",
};

export function BuildingDetailClient({
  building,
  buildingMeta,
  units,
}: BuildingDetailClientProps) {
  // Group units by floor
  const unitsByFloor = units.reduce((acc, unit) => {
    const floor = unit.floor ?? 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(unit);
    return acc;
  }, {} as Record<number, typeof units>);

  const floors = Object.keys(unitsByFloor)
    .map(Number)
    .sort((a, b) => b - a); // Descending order

  // Stats
  const totalUnits = units.length;
  const vacantUnits = units.filter(u => u.status === "vacant").length;
  const occupiedUnits = units.filter(u => u.status === "occupe").length;
  const totalRent = units.reduce((sum, u) => sum + (u.loyer_hc || 0), 0);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/owner/buildings">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux immeubles
        </Link>
      </Button>

      {/* Header with Image */}
      <div className="relative h-64 rounded-xl overflow-hidden mb-8 bg-slate-100 dark:bg-slate-800">
        {building.cover_url ? (
          <Image
            src={building.cover_url}
            alt={building.adresse_complete}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 className="h-24 w-24 text-slate-300 dark:text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-6 left-6 text-white">
          <h1 className="text-3xl font-bold mb-2">{building.adresse_complete}</h1>
          <p className="flex items-center gap-2 text-white/80">
            <MapPin className="h-4 w-4" />
            {building.code_postal} {building.ville}
          </p>
        </div>
        <div className="absolute top-4 right-4">
          <Button variant="secondary" asChild size="sm">
            <Link href={`/owner/properties/${building.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUnits}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Lots</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <DoorOpen className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{vacantUnits}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Vacants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{occupiedUnits}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Occupés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRent.toLocaleString()}€</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Loyers/mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Building Features */}
      {buildingMeta && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Équipements de l'immeuble</CardTitle>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Units by Floor */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Lots par étage</h2>
        <Button asChild>
          <Link href={`/owner/buildings/${building.id}/units`}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un lot
          </Link>
        </Button>
      </div>

      {floors.length > 0 ? (
        <div className="space-y-6">
          {floors.map((floor, floorIndex) => (
            <motion.div
              key={floor}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: floorIndex * 0.1 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    {floor === 0 ? "Rez-de-chaussée" : floor < 0 ? `Sous-sol ${Math.abs(floor)}` : `Étage ${floor}`}
                  </CardTitle>
                  <CardDescription>
                    {unitsByFloor[floor].length} lot{unitsByFloor[floor].length > 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {unitsByFloor[floor].map((unit) => {
                      const Icon = unitTypeIcons[unit.type || "appartement"] || Home;
                      return (
                        <div
                          key={unit.id}
                          className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
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
                                <p className="text-sm text-slate-500">
                                  {unit.template && `${unit.template} • `}
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
                                <DropdownMenuItem>Modifier</DropdownMenuItem>
                                <DropdownMenuItem>Créer un bail</DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">Supprimer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge className={statusColors[unit.status || "vacant"]}>
                              {statusLabels[unit.status || "vacant"]}
                            </Badge>
                            <p className="font-semibold text-blue-600">
                              {(unit.loyer_hc || 0).toLocaleString()}€/mois
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Aucun lot configuré pour cet immeuble
            </p>
            <Button asChild>
              <Link href={`/owner/buildings/${building.id}/units`}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter des lots
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
