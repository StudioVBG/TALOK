"use client";

/**
 * Écran 6: Logement prêt à louer
 * Récapitulatif final et lancement du nouveau bail
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Home,
  CheckCircle2,
  Calendar,
  Euro,
  Camera,
  FileText,
  Sparkles,
  ArrowRight,
  PartyPopper,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface ReadyToRentCardProps {
  property: {
    id: string;
    adresse: string;
    ville: string;
    surface: number;
    type: string;
  };
  summary: {
    totalDays: number;
    dgRetention: number;
    ownerInvestment: number;
    suggestedRent: number;
    previousRent: number;
    rentIncrease: number;
  };
  completedDate: string;
  onCreateListing: () => void;
  onNewLease: () => void;
  onViewProperty: () => void;
  className?: string;
}

export function ReadyToRentCard({
  property,
  summary,
  completedDate,
  onCreateListing,
  onNewLease,
  onViewProperty,
  className,
}: ReadyToRentCardProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  // Lancer les confettis
  const triggerConfetti = () => {
    if (!showConfetti) {
      setShowConfetti(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  // Calculer le ROI
  const monthlyRentIncrease = summary.rentIncrease;
  const roiMonths = summary.ownerInvestment > 0 
    ? Math.ceil(summary.ownerInvestment / monthlyRentIncrease)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onAnimationComplete={triggerConfetti}
    >
      <Card className={cn("overflow-hidden", className)}>
        {/* Header festif */}
        <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-center py-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center"
          >
            <PartyPopper className="w-10 h-10" />
          </motion.div>
          <CardTitle className="text-2xl">
            🎉 Logement prêt à louer !
          </CardTitle>
          <p className="text-white/80 mt-2">
            Processus terminé en {summary.totalDays} jours
          </p>
        </CardHeader>

        <CardContent className="p-0">
          {/* Résumé du logement */}
          <div className="p-6 bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Home className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{property.adresse}</h3>
                <p className="text-muted-foreground">
                  {property.ville} • {property.surface} m² • {property.type}
                </p>
              </div>
              <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Prêt
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Récapitulatif financier */}
          <div className="p-6">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Euro className="w-5 h-5" />
              Récapitulatif financier
            </h4>

            <div className="grid grid-cols-2 gap-4">
              {/* Retenue DG */}
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <div className="text-sm text-muted-foreground mb-1">
                  Récupéré sur DG
                </div>
                <div className="text-2xl font-bold text-red-600">
                  +{summary.dgRetention.toLocaleString("fr-FR")} €
                </div>
              </div>

              {/* Investissement */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <div className="text-sm text-muted-foreground mb-1">
                  Investissement
                </div>
                <div className="text-2xl font-bold text-amber-600">
                  -{summary.ownerInvestment.toLocaleString("fr-FR")} €
                </div>
              </div>

              {/* Ancien loyer */}
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="text-sm text-muted-foreground mb-1">
                  Ancien loyer
                </div>
                <div className="text-xl font-semibold">
                  {summary.previousRent.toLocaleString("fr-FR")} €/mois
                </div>
              </div>

              {/* Nouveau loyer suggéré */}
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Nouveau loyer suggéré
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {summary.suggestedRent.toLocaleString("fr-FR")} €/mois
                </div>
                <div className="text-xs text-green-600 mt-1">
                  +{summary.rentIncrease.toLocaleString("fr-FR")} €/mois
                </div>
              </div>
            </div>

            {/* ROI */}
            {roiMonths > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-indigo-600" />
                  <div>
                    <div className="font-medium">Retour sur investissement</div>
                    <div className="text-sm text-muted-foreground">
                      Votre investissement sera rentabilisé en{" "}
                      <span className="font-semibold text-indigo-600">
                        {roiMonths} mois
                      </span>{" "}
                      grâce à l'augmentation du loyer
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="p-6 space-y-3">
            <Button
              onClick={onNewLease}
              size="lg"
              className="w-full gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              <FileText className="w-5 h-5" />
              Créer un nouveau bail
              <ArrowRight className="w-5 h-5" />
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={onCreateListing}
                className="gap-2"
              >
                <Camera className="w-4 h-4" />
                Créer l'annonce
              </Button>
              <Button
                variant="outline"
                onClick={onViewProperty}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Voir le logement
              </Button>
            </div>
          </div>

          {/* Date de complétion */}
          <div className="px-6 pb-4 text-center text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 inline mr-1" />
            Processus terminé le{" "}
            {new Date(completedDate).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

