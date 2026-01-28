"use client";

import { motion } from "framer-motion";
import { Building2, Plus, MapPin, Layers, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";

interface Building {
  id: string;
  adresse_complete: string;
  ville: string;
  code_postal: string;
  surface: number;
  cover_url: string | null;
  created_at: string;
  building_floors?: { floors: number }[];
  units_count?: { count: number }[];
}

interface BuildingsListClientProps {
  buildings: Building[];
}

export function BuildingsListClient({ buildings }: BuildingsListClientProps) {
  const hasBuildings = buildings.length > 0;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            Mes Immeubles
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {hasBuildings
              ? `${buildings.length} immeuble${buildings.length > 1 ? "s" : ""} dans votre portefeuille`
              : "Gérez vos immeubles et leurs lots"}
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link href="/owner/properties/new?type=immeuble">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un immeuble
          </Link>
        </Button>
      </div>

      {/* Buildings Grid */}
      {hasBuildings ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buildings.map((building, index) => (
            <motion.div
              key={building.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={`/owner/buildings/${building.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden">
                  {/* Image */}
                  <div className="relative h-40 bg-slate-100 dark:bg-slate-800">
                    {building.cover_url ? (
                      <Image
                        src={building.cover_url}
                        alt={building.adresse_complete}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Building2 className="h-16 w-16 text-slate-300 dark:text-slate-600" />
                      </div>
                    )}
                    {/* Badge lots */}
                    <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {building.units_count?.[0]?.count || 0} lots
                    </div>
                  </div>

                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg line-clamp-1">
                      {building.adresse_complete}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {building.code_postal} {building.ville}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Home className="h-4 w-4" />
                        {building.surface} m²
                      </span>
                      <span>
                        {building.building_floors?.[0]?.floors || "?"} étages
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <div className="mx-auto w-24 h-24 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6">
            <Building2 className="h-12 w-12 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
            Aucun immeuble
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Commencez par ajouter votre premier immeuble pour gérer vos lots
            (appartements, locaux, parkings).
          </p>
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
            <Link href="/owner/properties/new?type=immeuble">
              <Plus className="mr-2 h-5 w-5" />
              Ajouter mon premier immeuble
            </Link>
          </Button>
        </motion.div>
      )}
    </div>
  );
}
