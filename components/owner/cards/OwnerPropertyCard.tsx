"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Image as ImageIcon, Ruler } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";
import type { OwnerProperty } from "@/lib/owner/types";
import { PROPERTY_STATUS_LABELS } from "@/lib/owner/constants";
import { ownerPropertyRoutes } from "@/lib/owner/routes";
import { cn } from "@/lib/utils";

interface OwnerPropertyCardProps {
  property: OwnerProperty;
  index?: number;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  loue: "default",
  en_preavis: "secondary",
  vacant: "outline",
  a_completer: "outline",
};

export function OwnerPropertyCard({ property, index = 0 }: OwnerPropertyCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 100, damping: 15 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card className="group relative overflow-hidden backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-600 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer h-full flex flex-col">
        {/* Image de couverture */}
        {property.cover_url ? (
          <div className="relative h-48 w-full overflow-hidden">
            <motion.img
              src={property.cover_url}
              alt={property.adresse_complete}
              className="w-full h-full object-cover"
              initial={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.4 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute top-3 right-3">
              <Badge variant={statusVariants[property.status] || "outline"}>
                {PROPERTY_STATUS_LABELS[property.status] || property.status}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="relative h-48 w-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            <ImageIcon className="h-16 w-16 text-slate-400" />
            <div className="absolute top-3 right-3">
              <Badge variant={statusVariants[property.status] || "outline"}>
                {PROPERTY_STATUS_LABELS[property.status] || property.status}
              </Badge>
            </div>
          </div>
        )}

        <CardHeader className="pb-3">
          <CardTitle className="text-lg mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors duration-200">
            {property.adresse_complete || "Sans adresse"}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {property.type}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between pt-0">
          <div className="space-y-3">
            {property.surface && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Ruler className="h-4 w-4" />
                <span>{property.surface} m²</span>
                {property.nb_pieces && <span>· {property.nb_pieces} pièces</span>}
              </div>
            )}
            {property.monthlyRent > 0 && (
              <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {formatCurrency(property.monthlyRent)} / mois
              </div>
            )}
          </div>

          <div className="mt-4">
            <Button
              asChild
              variant="outline"
              className="w-full group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white group-hover:border-transparent transition-all duration-300"
            >
              <Link href={ownerPropertyRoutes.detail(property.id)}>
                Voir la fiche
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </Button>
          </div>
        </CardContent>

        {/* Effet de brillance au survol */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full" />
      </Card>
    </motion.div>
  );
}

