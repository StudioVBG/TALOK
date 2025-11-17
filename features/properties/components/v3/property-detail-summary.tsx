/**
 * PropertyDetailSummary - Bloc résumé avec informations clés
 * Affiche loyer, charges, dépôt, annexes, mini-photos
 */

"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Euro, Key, Layers, Home, Car, Building2 } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatCurrency } from "@/lib/helpers/format";
import { CLASSES_EXTENDED } from "@/lib/design-system/design-tokens";
import { itemVariants } from "@/lib/design-system/animations";

interface PropertyDetailSummaryProps {
  property: Property;
  isHabitation: boolean;
}

export function PropertyDetailSummary({ property, isHabitation }: PropertyDetailSummaryProps) {
  const totalLoyer = (property.loyer_base ?? 0) + (property.charges_mensuelles ?? 0);

  return (
    <motion.div
      variants={itemVariants}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {/* Loyer CC */}
      <Card className={`${CLASSES_EXTENDED.card} border-primary/20`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Euro className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Loyer CC</p>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totalLoyer)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            HC: {formatCurrency(property.loyer_base ?? 0)} + Charges: {formatCurrency(property.charges_mensuelles ?? 0)}
          </p>
        </CardContent>
      </Card>

      {/* Dépôt de garantie */}
      <Card className={`${CLASSES_EXTENDED.card} border-primary/20`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Key className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Dépôt de garantie</p>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(property.depot_garantie ?? 0)}</p>
        </CardContent>
      </Card>

      {/* Surface */}
      {isHabitation && property.surface && (
        <Card className={`${CLASSES_EXTENDED.card} border-primary/20`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Surface</p>
            </div>
            <p className="text-2xl font-bold">{property.surface} m²</p>
            {property.nb_pieces && (
              <p className="text-xs text-muted-foreground mt-1">
                {property.nb_pieces} pièce{property.nb_pieces > 1 ? "s" : ""}
                {property.nb_chambres ? ` • ${property.nb_chambres} chambre${property.nb_chambres > 1 ? "s" : ""}` : ""}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Code unique */}
      <Card className={`${CLASSES_EXTENDED.card} border-primary/20`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Key className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Code unique</p>
          </div>
          <p className="text-sm font-mono font-bold">{property.unique_code}</p>
        </CardContent>
      </Card>

      {/* Annexes (badges) */}
      {isHabitation && (
        <div className="md:col-span-2 lg:col-span-4 flex flex-wrap gap-2 mt-2">
          {(property as any).has_balcon && (
            <Badge variant="outline" className="text-xs">
              <Home className="h-3 w-3 mr-1" />
              Balcon
            </Badge>
          )}
          {(property as any).has_terrasse && (
            <Badge variant="outline" className="text-xs">
              <Home className="h-3 w-3 mr-1" />
              Terrasse
            </Badge>
          )}
          {(property as any).has_jardin && (
            <Badge variant="outline" className="text-xs">
              <Home className="h-3 w-3 mr-1" />
              Jardin
            </Badge>
          )}
          {(property as any).has_cave && (
            <Badge variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              Cave
            </Badge>
          )}
          {(property as any).places_parking > 0 && (
            <Badge variant="outline" className="text-xs">
              <Car className="h-3 w-3 mr-1" />
              Parking ({((property as any).places_parking)})
            </Badge>
          )}
        </div>
      )}
    </motion.div>
  );
}

