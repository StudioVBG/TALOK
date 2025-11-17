/**
 * PropertyDetailHeader - Header de la fiche propriété V2.5
 * Affiche le titre, badges, et actions rapides
 */

"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Edit, ArrowLeft } from "lucide-react";
import Image from "next/image";
import type { Property } from "@/lib/types";

interface PropertyDetailHeaderProps {
  property: Property;
  TypeIcon: any;
  statusConfig: { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any };
  StatusIcon: any;
  onEdit: () => void;
  onBack: () => void;
}

export function PropertyDetailHeader({
  property,
  TypeIcon,
  statusConfig,
  StatusIcon,
  onEdit,
  onBack,
}: PropertyDetailHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden"
    >
      {/* Image de couverture ou gradient */}
      {property.cover_url ? (
        <div className="relative h-[50vh] min-h-[350px] w-full">
          <Image
            src={property.cover_url}
            alt={property.adresse_complete}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent" />
        </div>
      ) : (
        <div className="relative h-[40vh] min-h-[300px] w-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center">
          <div className="text-center space-y-4">
            <TypeIcon className="h-24 w-24 mx-auto text-primary/30" />
            <div className="h-1 w-32 bg-primary/20 mx-auto rounded-full" />
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button
          variant="secondary"
          size="sm"
          className="backdrop-blur-md bg-background/80 border-border/50"
          onClick={onEdit}
        >
          <Edit className="h-4 w-4 mr-2" />
          Modifier
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="backdrop-blur-md bg-background/80 border-border/50"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>

      {/* Contenu header */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 -mt-32 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {/* Titre et badges */}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <TypeIcon className="h-8 w-8 text-primary" />
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                  {property.adresse_complete || "Bien immobilier"}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={statusConfig.variant} className="text-sm px-3 py-1">
                  <StatusIcon className="h-3 w-3 mr-1.5" />
                  {statusConfig.label}
                </Badge>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="text-base">
                    {property.code_postal} {property.ville}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

