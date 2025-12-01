"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Badge } from "@/components/ui/badge";
import { 
  Home, Building2, Car, Store, Bed, Bath, Ruler, Euro, MapPin, 
  ImageIcon, Sparkles 
} from "lucide-react";
import Image from "next/image";

const TYPE_LABELS: Record<string, string> = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  colocation: "Colocation",
  parking: "Parking",
  box: "Box/Garage",
  local_commercial: "Local commercial",
  bureaux: "Bureaux",
  entrepot: "Entrepôt",
  fonds_de_commerce: "Fonds de commerce",
  saisonnier: "Saisonnier",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  appartement: Building2,
  maison: Home,
  studio: Building2,
  colocation: Home,
  parking: Car,
  box: Car,
  local_commercial: Store,
  bureaux: Store,
  entrepot: Store,
  fonds_de_commerce: Store,
  saisonnier: Home,
};

export function PreviewCard() {
  const { formData, photos, rooms } = usePropertyWizardStore();

  const mainPhoto = useMemo(() => photos.find(p => p.is_main) || photos[0], [photos]);
  const TypeIcon = TYPE_ICONS[formData.type as string] || Home;

  const stats = useMemo(() => {
    const nbPieces = rooms.filter(r => 
      ["chambre", "sejour", "bureau", "salon_cuisine", "suite_parentale", "mezzanine"].includes(r.type_piece)
    ).length;
    const nbChambres = rooms.filter(r => 
      ["chambre", "suite_parentale", "suite_enfant"].includes(r.type_piece)
    ).length;
    const nbSdb = rooms.filter(r => 
      ["salle_de_bain", "salle_eau"].includes(r.type_piece)
    ).length;
    return { nbPieces, nbChambres, nbSdb };
  }, [rooms]);

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return "— €";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(price);
  };

  const completionScore = useMemo(() => {
    let score = 0;
    if (formData.type) score += 20;
    if (formData.adresse_complete && formData.code_postal && formData.ville) score += 20;
    if (formData.surface || formData.surface_habitable_m2) score += 15;
    if (formData.loyer_hc) score += 15;
    if (rooms.length > 0) score += 15;
    if (photos.length > 0) score += 15;
    return score;
  }, [formData, rooms, photos]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl overflow-hidden border shadow-lg"
    >
      {/* Image Header */}
      <div className="relative aspect-[16/10] bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
        {mainPhoto?.url ? (
          <Image
            src={mainPhoto.url}
            alt="Aperçu"
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50">
            <ImageIcon className="h-8 w-8 mb-1" />
            <span className="text-[10px]">Aucune photo</span>
          </div>
        )}
        
        {/* Badge type */}
        {formData.type && (
          <Badge className="absolute top-2 left-2 bg-background/90 text-foreground backdrop-blur-sm shadow-sm text-[10px]">
            <TypeIcon className="h-3 w-3 mr-1" />
            {TYPE_LABELS[formData.type as string] || "Bien"}
          </Badge>
        )}

        {/* Photo count */}
        {photos.length > 0 && (
          <Badge variant="secondary" className="absolute top-2 right-2 bg-black/50 text-white backdrop-blur-sm text-[10px]">
            <ImageIcon className="h-3 w-3 mr-1" />
            {photos.length}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Address */}
        {formData.adresse_complete ? (
          <div className="flex items-start gap-1.5 mb-2">
            <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm leading-tight line-clamp-1">
                {formData.adresse_complete}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formData.code_postal} {formData.ville}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-2">Adresse non renseignée</p>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {(formData.surface || formData.surface_habitable_m2) && (
            <Badge variant="outline" className="text-[10px] gap-1 h-5">
              <Ruler className="h-2.5 w-2.5" />
              {formData.surface_habitable_m2 || formData.surface} m²
            </Badge>
          )}
          {stats.nbPieces > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 h-5">
              <Home className="h-2.5 w-2.5" />
              {stats.nbPieces} pièce{stats.nbPieces > 1 ? "s" : ""}
            </Badge>
          )}
          {stats.nbChambres > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 h-5">
              <Bed className="h-2.5 w-2.5" />
              {stats.nbChambres}
            </Badge>
          )}
          {stats.nbSdb > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 h-5">
              <Bath className="h-2.5 w-2.5" />
              {stats.nbSdb}
            </Badge>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between border-t pt-2">
          <div className="flex items-center gap-1.5">
            <Euro className="h-4 w-4 text-primary" />
            <span className="text-lg font-bold text-primary">
              {formatPrice(formData.loyer_hc as number)}
            </span>
            <span className="text-[10px] text-muted-foreground">/mois</span>
          </div>
          {formData.meuble && (
            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Meublé
            </Badge>
          )}
        </div>

        {/* Completion indicator */}
        <div className="mt-3 pt-2 border-t">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Complétude
            </span>
            <span className="font-bold">{completionScore}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${completionScore}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

