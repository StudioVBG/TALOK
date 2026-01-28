"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Building2,
  Users,
  Car,
  Archive,
  Percent,
  Euro,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";
import type { Building } from "@/lib/types/building-v3";

interface BuildingCardProps {
  building: Building;
  index?: number;
}

/**
 * SOTA 2026: Card component for displaying building overview
 *
 * Shows key metrics: units, occupancy rate, revenue
 */
export function BuildingCard({ building, index = 0 }: BuildingCardProps) {
  const occupancyRate = building.occupancy_rate ?? 0;
  const totalUnits = building.total_units ?? 0;
  const totalParkings = building.total_parkings ?? 0;
  const totalCaves = building.total_caves ?? 0;
  const revenusPotentiels = building.revenus_potentiels ?? 0;

  // Occupancy color based on rate
  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return "text-emerald-600 bg-emerald-50";
    if (rate >= 70) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 100, damping: 15 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card className="group relative overflow-hidden backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-600 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer h-full flex flex-col">
        {/* Header with icon */}
        <div className="relative h-32 w-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <Building2 className="h-16 w-16 text-white/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

          {/* Occupancy badge */}
          <div className="absolute top-3 right-3">
            <Badge
              variant="secondary"
              className={cn("font-semibold", getOccupancyColor(occupancyRate))}
            >
              <Percent className="h-3 w-3 mr-1" />
              {occupancyRate}% occupe
            </Badge>
          </div>

          {/* Floors indicator */}
          <div className="absolute bottom-3 left-3">
            <Badge variant="secondary" className="bg-white/20 text-white backdrop-blur-sm">
              {building.floors} etage{building.floors > 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        <CardHeader className="pb-3">
          <CardTitle className="text-lg mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors duration-200">
            {building.name || "Immeuble sans nom"}
          </CardTitle>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {building.adresse_complete}
          </p>
          <p className="text-xs text-muted-foreground">
            {building.code_postal} {building.ville}
          </p>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between pt-0">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* Units */}
            <div className="flex flex-col items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Users className="h-4 w-4 text-blue-500 mb-1" />
              <span className="text-lg font-bold">{totalUnits}</span>
              <span className="text-xs text-muted-foreground">Lots</span>
            </div>

            {/* Parkings */}
            <div className="flex flex-col items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Car className="h-4 w-4 text-emerald-500 mb-1" />
              <span className="text-lg font-bold">{totalParkings}</span>
              <span className="text-xs text-muted-foreground">Parkings</span>
            </div>

            {/* Caves */}
            <div className="flex flex-col items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Archive className="h-4 w-4 text-amber-500 mb-1" />
              <span className="text-lg font-bold">{totalCaves}</span>
              <span className="text-xs text-muted-foreground">Caves</span>
            </div>
          </div>

          {/* Revenue */}
          {revenusPotentiels > 0 && (
            <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-emerald-600" />
                <span className="text-sm text-muted-foreground">Revenus potentiels</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                {formatCurrency(revenusPotentiels)}/mois
              </span>
            </div>
          )}

          {/* Action button */}
          <Button
            asChild
            variant="outline"
            className="w-full group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white group-hover:border-transparent transition-all duration-300"
          >
            <Link href={`/owner/buildings/${building.id}`}>
              Gerer l'immeuble
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          </Button>
        </CardContent>

        {/* Shine effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full pointer-events-none" />
      </Card>
    </motion.div>
  );
}

/**
 * Skeleton loader for BuildingCard
 */
export function BuildingCardSkeleton() {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="h-32 w-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
      <CardHeader className="pb-3">
        <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse mt-2" />
        <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mt-1" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between pt-0">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}
