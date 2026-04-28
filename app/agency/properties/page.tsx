"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
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
  Loader2,
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

interface AgencyProperty {
  id: string;
  type: string | null;
  adresse_complete: string | null;
  ville: string | null;
  code_postal: string | null;
  surface: number | null;
  nb_pieces: number | null;
  loyer_hc: number | null;
  charges_mensuelles: number | null;
  cover_url: string | null;
  owner: { id: string; prenom: string | null; nom: string | null } | null;
  active_lease: { id: string; loyer: number; statut: string } | null;
}

interface AgencyPropertiesResponse {
  properties: AgencyProperty[];
  total: number;
  page: number;
  limit: number;
}

const typeLabels: Record<string, string> = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  colocation: "Colocation",
  parking: "Parking",
  box: "Box",
  local_commercial: "Local commercial",
  bureaux: "Bureaux",
  entrepot: "Entrepôt",
  fonds_de_commerce: "Fonds de commerce",
  immeuble: "Immeuble",
};

export default function AgencyPropertiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery<AgencyPropertiesResponse>({
    queryKey: ["agency", "properties"],
    queryFn: async () => {
      const res = await fetch("/api/agency/properties?limit=100", {
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Erreur lors du chargement des biens");
      }
      return res.json();
    },
  });

  const properties = data?.properties ?? [];

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const ownerName = `${property.owner?.prenom ?? ""} ${property.owner?.nom ?? ""}`.trim();
      const matchesSearch =
        !searchQuery ||
        (property.adresse_complete ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (property.ville ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        ownerName.toLowerCase().includes(searchQuery.toLowerCase());

      const isOccupied = !!property.active_lease;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "occupied" && isOccupied) ||
        (statusFilter === "vacant" && !isOccupied);

      const matchesType = typeFilter === "all" || property.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [properties, searchQuery, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const occupied = properties.filter((p) => !!p.active_lease).length;
    const totalLoyers = properties.reduce(
      (sum, p) => sum + (p.active_lease?.loyer ?? p.loyer_hc ?? 0),
      0,
    );
    return {
      total: properties.length,
      occupied,
      vacant: properties.length - occupied,
      totalLoyers,
    };
  }, [properties]);

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
                <SelectItem value="colocation">Colocation</SelectItem>
                <SelectItem value="parking">Parking</SelectItem>
                <SelectItem value="local_commercial">Local commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading / Error / Empty states */}
      {isLoading && (
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Chargement des biens gérés…</p>
          </CardContent>
        </Card>
      )}

      {error && !isLoading && (
        <Card className="border-0 bg-red-50 dark:bg-red-950/20">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error instanceof Error ? error.message : "Erreur inconnue"}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && properties.length === 0 && (
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">Aucun bien sous mandat</p>
            <p className="text-xs text-muted-foreground">
              Ajoutez un mandat de gestion depuis la page Mandants pour voir les biens ici.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Properties Grid */}
      {!isLoading && !error && properties.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProperties.map((property) => {
            const isOccupied = !!property.active_lease;
            const ownerName = `${property.owner?.prenom ?? ""} ${property.owner?.nom ?? ""}`.trim() || "—";
            const loyer = property.active_lease?.loyer ?? property.loyer_hc ?? 0;
            const typeLabel = typeLabels[property.type ?? ""] ?? property.type ?? "Bien";
            const cityLine = [property.code_postal, property.ville].filter(Boolean).join(" ");

            return (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group overflow-hidden">
                  {/* Cover */}
                  <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center relative">
                    {property.cover_url ? (
                      <Image
                        src={property.cover_url}
                        alt={property.adresse_complete ?? "Bien"}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <Home className="w-12 h-12 text-slate-400" />
                    )}
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <Badge variant="outline" className="text-xs mb-2">
                          {typeLabel}
                        </Badge>
                        <h3 className="font-semibold truncate">
                          {property.adresse_complete ?? "Adresse non renseignée"}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{cityLine || "—"}</span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/agency/properties/${property.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              Voir le détail
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      {property.surface != null && (
                        <>
                          <span>{property.surface} m²</span>
                          <span>•</span>
                        </>
                      )}
                      {property.nb_pieces != null && (
                        <span>
                          {property.nb_pieces} pièce{property.nb_pieces > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Propriétaire</p>
                        <p className="text-sm font-medium truncate">{ownerName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-indigo-600">
                          {loyer.toLocaleString("fr-FR")}€
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            isOccupied
                              ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                              : "border-amber-500 text-amber-600 bg-amber-50",
                          )}
                        >
                          {isOccupied ? "Occupé" : "Vacant"}
                        </Badge>
                      </div>
                    </div>

                    {isOccupied && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Bail actif</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {filteredProperties.length === 0 && (
            <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm md:col-span-2 lg:col-span-3">
              <CardContent className="py-12 text-center">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Aucun bien ne correspond à vos filtres.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  );
}
