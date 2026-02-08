"use client";

/**
 * Composant de démonstration des améliorations UX/UI SOTA 2025
 * 
 * Ce composant montre tous les nouveaux composants et effets en action.
 * Utilisez-le comme référence pour vos propres implémentations.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, FileText, Euro, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ButtonEnhanced } from "@/components/ui/button-enhanced";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonPropertyCard } from "@/components/ui/skeleton-card";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";
import { Badge } from "@/components/ui/badge";

export function UXUIShowcase() {
  const [loading, setLoading] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const handleLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="container mx-auto py-12 px-4 space-y-12">
      {/* Header avec Dark Mode Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            UX/UI SOTA 2025 Showcase
          </h1>
          <p className="text-muted-foreground mt-2">
            Démonstration de tous les composants et effets modernes
          </p>
        </div>
        <DarkModeToggle />
      </div>

      {/* Section 1: Cards avec Glassmorphism */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">1. Cards avec Glassmorphism</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Mes biens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Gestion complète de votre portefeuille locatif avec effets modernes.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  Baux & locataires
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Suivez vos contrats et locataires avec une interface intuitive.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Euro className="h-5 w-5 text-green-600" />
                  Loyers & revenus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Visualisez vos revenus et suivez les paiements en temps réel.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Section 2: Boutons améliorés */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">2. Boutons avec Ripple & Loading</h2>
        <div className="flex flex-wrap gap-4">
          <ButtonEnhanced
            isLoading={loading}
            onClick={handleLoading}
            variant="default"
          >
            Bouton avec Loading
          </ButtonEnhanced>

          <ButtonEnhanced
            ripple={true}
            variant="gradient"
            onClick={() => {}}
          >
            Bouton Gradient avec Ripple
          </ButtonEnhanced>

          <Button variant="outline">
            Bouton Standard
          </Button>
        </div>
      </section>

      {/* Section 3: États (Empty, Error, Loading) */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">3. États de l'interface</h2>
        
        <div className="flex flex-wrap gap-4 mb-6">
          <Button onClick={() => { setShowEmpty(!showEmpty); setShowError(false); setShowSkeleton(false); }}>
            {showEmpty ? "Masquer" : "Afficher"} Empty State
          </Button>
          <Button onClick={() => { setShowError(!showError); setShowEmpty(false); setShowSkeleton(false); }}>
            {showError ? "Masquer" : "Afficher"} Error State
          </Button>
          <Button onClick={() => { setShowSkeleton(!showSkeleton); setShowEmpty(false); setShowError(false); }}>
            {showSkeleton ? "Masquer" : "Afficher"} Skeleton
          </Button>
        </div>

        {showEmpty && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <EmptyState
              icon={Building2}
              title="Aucun bien pour l'instant"
              description="Commencez par ajouter votre premier bien pour démarrer votre gestion locative."
              action={{
                label: "Ajouter un bien",
                onClick: () => alert("Action déclenchée !"),
                variant: "default",
              }}
            />
          </motion.div>
        )}

        {showError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <ErrorState
              title="Erreur de chargement"
              description="Impossible de charger les données. Veuillez réessayer."
              onRetry={() => {
                alert("Retry déclenché !");
                setShowError(false);
              }}
            />
          </motion.div>
        )}

        {showSkeleton && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonPropertyCard key={i} />
            ))}
          </motion.div>
        )}
      </section>

      {/* Section 4: Badges avec animations */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">4. Badges animés</h2>
        <div className="flex flex-wrap gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Badge variant="default" className="shadow-md">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Loué
            </Badge>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Badge variant="secondary" className="shadow-md">
              <AlertCircle className="mr-1 h-3 w-3" />
              En préavis
            </Badge>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Badge variant="outline" className="shadow-md">
              Vacant
            </Badge>
          </motion.div>
        </div>
      </section>

      {/* Section 5: Animations avec stagger */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">5. Animations avec Stagger</h2>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
          className="grid gap-4 md:grid-cols-4"
        >
          {["Item 1", "Item 2", "Item 3", "Item 4"].map((item, index) => (
            <motion.div
              key={index}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <Card className="p-4 text-center">
                <p className="font-medium">{item}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Section 6: Ombres harmonisées */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">6. Ombres harmonisées</h2>
        <div className="grid gap-4 md:grid-cols-5">
          {["sm", "md", "lg", "xl", "2xl"].map((size) => (
            <Card
              key={size}
              className={`shadow-${size} p-6 text-center`}
            >
              <p className="text-sm font-medium">shadow-{size}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="text-center py-8 border-t">
        <p className="text-muted-foreground">
          ✨ Tous ces composants sont disponibles dans{" "}
          <code className="bg-muted px-2 py-1 rounded">components/ui/</code>
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Consultez{" "}
          <code className="bg-muted px-2 py-1 rounded">docs/UX_UI_SOTA_2025.md</code>{" "}
          pour la documentation complète
        </p>
      </div>
    </div>
  );
}

