"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  Building2,
  Home,
  Users,
  Euro,
  MapPin,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Données de démonstration
const mockProperties = [
  {
    id: "1",
    adresse: "15 Rue Victor Hugo",
    ville: "Paris 75011",
    type: "appartement",
    surface: 65,
    pieces: 3,
    loyer: 1450,
    status: "occupied",
    owner: "Jean Dupont",
    tenant: "Sophie Bernard",
  },
  {
    id: "2",
    adresse: "8 Avenue de la République",
    ville: "Lyon 69003",
    type: "studio",
    surface: 28,
    pieces: 1,
    loyer: 650,
    status: "occupied",
    owner: "Marie Martin",
    tenant: "Lucas Petit",
  },
  {
    id: "3",
    adresse: "42 Boulevard Gambetta",
    ville: "Marseille 13001",
    type: "appartement",
    surface: 85,
    pieces: 4,
    loyer: 1100,
    status: "occupied",
    owner: "SCI Les Oliviers",
    tenant: "Emma Durand",
  },
  {
    id: "4",
    adresse: "3 Rue des Lilas",
    ville: "Bordeaux 33000",
    type: "maison",
    surface: 120,
    pieces: 5,
    loyer: 1800,
    status: "vacant",
    owner: "Pierre Lefebvre",
    tenant: null,
  },
  {
    id: "5",
    adresse: "27 Place du Marché",
    ville: "Toulouse 31000",
    type: "appartement",
    surface: 45,
    pieces: 2,
    loyer: 750,
    status: "occupied",
    owner: "Marie Martin",
    tenant: "Marc Dubois",
  },
  {
    id: "6",
    adresse: "12 Impasse des Roses",
    ville: "Nice 06000",
    type: "studio",
    surface: 22,
    pieces: 1,
    loyer: 580,
    status: "vacant",
    owner: "SCI Les Oliviers",
    tenant: null,
  },
];

const typeLabels = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  colocation: "Colocation",
};

export default function AgencyPropertiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredProperties = mockProperties.filter((property) => {
    const matchesSearch =
      property.adresse.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.ville.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || property.status === statusFilter;
    const matchesType = typeFilter === "all" || property.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = {
    total: mockProperties.length,
    occupied: mockProperties.filter((p) => p.status === "occupied").length,
    vacant: mockProperties.filter((p) => p.status === "vacant").length,
    totalLoyers: mockProperties.reduce((sum, p) => sum + p.loyer, 0),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Biens gérés
          </h1>
          <p className="text-muted-foreground mt-1">
            Tous les biens sous mandat de gestion
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total biens</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.occupied}</p>
              <p className="text-xs text-muted-foreground">Occupés</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <XCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.vacant}</p>
              <p className="text-xs text-muted-foreground">Vacants</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Euro className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalLoyers.toLocaleString("fr-FR")}€</p>
              <p className="text-xs text-muted-foreground">Loyers/mois</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par adresse, ville ou propriétaire..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="occupied">Occupés</SelectItem>
                <SelectItem value="vacant">Vacants</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="appartement">Appartement</SelectItem>
                <SelectItem value="maison">Maison</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Properties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProperties.map((property) => (
          <motion.div
            key={property.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group overflow-hidden">
              {/* Image placeholder */}
              <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                <Home className="w-12 h-12 text-slate-400" />
              </div>
              
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Badge variant="outline" className="text-xs mb-2">
                      {typeLabels[property.type as keyof typeof typeLabels]}
                    </Badge>
                    <h3 className="font-semibold">{property.adresse}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {property.ville}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="w-4 h-4 mr-2" />
                        Voir le détail
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span>{property.surface} m²</span>
                  <span>•</span>
                  <span>{property.pieces} pièce{property.pieces > 1 ? "s" : ""}</span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Propriétaire</p>
                    <p className="text-sm font-medium">{property.owner}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-indigo-600">{property.loyer}€</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        property.status === "occupied" 
                          ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                          : "border-amber-500 text-amber-600 bg-amber-50"
                      )}
                    >
                      {property.status === "occupied" ? "Occupé" : "Vacant"}
                    </Badge>
                  </div>
                </div>

                {property.tenant && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Locataire:</span>
                    <span className="font-medium">{property.tenant}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredProperties.length === 0 && (
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucun bien trouvé</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

