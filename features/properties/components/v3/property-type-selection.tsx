/**
 * PropertyTypeSelection - Composant de sélection du type de bien V3
 * 
 * Architecture UX finale :
 * - Cartes horizontales compactes (160-200px large, 120-150px haut)
 * - Labels horizontaux lisibles
 * - Icônes emoji grandes et visibles
 * - Bouton "Choisir" clair
 * - 3 blocs séparés visuellement (Habitation, Parking & Box, Local commercial)
 * - Sélection active avec contour épais, fond clair, check
 * - Message d'aide raccourci et professionnel
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { PROPERTY_TYPE_GROUPS } from "@/lib/types/property-v3";
import type { PropertyTypeV3 } from "@/lib/types/property-v3";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Home, Car, Building2 } from "lucide-react";
import { containerVariants, itemVariants } from "@/lib/design-system/animations";
import { CLASSES } from "@/lib/design-system/design-tokens";

interface PropertyTypeSelectionProps {
  selectedType?: PropertyTypeV3 | null;
  onSelect: (type: PropertyTypeV3) => void;
  onContinue?: () => void;
}

// Variants pour les cartes horizontales
const cardVariants = {
  initial: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -2,
    transition: { type: "spring" as const, stiffness: 300, damping: 20 },
  },
  tap: { scale: 0.98 },
  selected: {
    scale: 1.03,
    y: -4,
    boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.3)",
    transition: { type: "spring" as const, stiffness: 300, damping: 20 },
  },
};

// Composant de carte horizontale compacte
function TypeCard({
  type,
  label,
  icon,
  isSelected,
  onSelect,
}: {
  type: PropertyTypeV3;
  label: string;
  icon: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate={isSelected ? "selected" : "initial"}
      whileHover="hover"
      whileTap="tap"
      className="w-full"
    >
      <Card
        className={`relative cursor-pointer border-2 overflow-hidden transition-all duration-300 ${
          isSelected
            ? "border-primary bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 shadow-lg ring-2 ring-primary/20"
            : "border-border/50 bg-background/80 backdrop-blur-sm hover:border-primary/50 hover:bg-primary/5"
        }`}
        onClick={onSelect}
        style={{
          minWidth: "160px",
          maxWidth: "200px",
          height: "140px",
        }}
      >
        {/* Effet de brillance animé pour la sélection */}
        {isSelected && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ["-100%", "200%"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}

        <CardContent className="p-5 h-full flex flex-col justify-between relative z-10">
          {/* Icône emoji grande */}
          <div className="flex items-center justify-between mb-3">
            <motion.div
              className="text-5xl"
              animate={isSelected ? { scale: 1.1, rotate: [0, 5, -5, 0] } : { scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              {icon}
            </motion.div>
            {/* Check icon animé */}
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
                >
                  <Check className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Label horizontal */}
          <div className="flex-1 flex flex-col justify-end">
            <h3
              className={`text-base font-bold tracking-tight transition-colors ${
                isSelected ? "text-primary" : "text-foreground"
              }`}
            >
              {label}
            </h3>
            {/* Bouton "Choisir" */}
            {!isSelected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2"
              >
                <span className="text-xs text-muted-foreground font-medium">Choisir</span>
              </motion.div>
            )}
          </div>
        </CardContent>

        {/* Glow effect au hover/selection */}
        {isSelected && (
          <motion.div
            className="absolute inset-0 rounded-lg bg-primary/20 blur-xl -z-0"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </Card>
    </motion.div>
  );
}

// Composant de bloc (Habitation, Parking, Locaux)
function TypeBlock({
  title,
  icon: Icon,
  description,
  types,
  selectedType,
  onSelect,
}: {
  title: string;
  icon: typeof Home;
  description: string;
  types: readonly { value: PropertyTypeV3; label: string; icon: string }[];
  selectedType?: PropertyTypeV3 | null;
  onSelect: (type: PropertyTypeV3) => void;
}) {
  return (
    <motion.div variants={itemVariants} className="space-y-6">
      {/* En-tête du bloc avec séparation visuelle */}
      <div className="pb-4 border-b border-border/50">
        <div className="flex items-center gap-4">
          <motion.div
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 via-primary/15 to-primary/10 shadow-md"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Icon className="h-7 w-7 text-primary" />
          </motion.div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {title}
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed mt-1">{description}</p>
          </div>
        </div>
      </div>

      {/* Grille de cartes horizontales flexibles */}
      <div className="flex flex-wrap gap-4">
        {types.map(({ value, label, icon }) => (
          <TypeCard
            key={value}
            type={value}
            label={label}
            icon={icon}
            isSelected={selectedType === value}
            onSelect={() => onSelect(value)}
          />
        ))}
      </div>
    </motion.div>
  );
}

export function PropertyTypeSelection({
  selectedType,
  onSelect,
  onContinue,
}: PropertyTypeSelectionProps) {
  const canContinue = selectedType !== null && selectedType !== undefined;

  // Passage automatique à l'étape suivante après sélection
  const handleSelect = (type: PropertyTypeV3) => {
    onSelect(type);
    // Délai pour permettre l'animation de sélection avant de passer à l'étape suivante
    setTimeout(() => {
      onContinue?.();
    }, 500);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-12">
      {/* Titre et description */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-3"
      >
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Quel type de bien souhaitez-vous ajouter ?
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Sélectionnez le type de bien pour adapter le parcours à vos besoins
        </p>
      </motion.div>

      {/* 3 Blocs séparés visuellement */}
      <div className="space-y-10">
        {/* Bloc 1 - Habitation */}
        <TypeBlock
          title="Habitation"
          icon={Home}
          description="Appartements, maisons, studios et colocations"
          types={PROPERTY_TYPE_GROUPS.habitation}
          selectedType={selectedType}
          onSelect={handleSelect}
        />

        {/* Bloc 2 - Parking & Box */}
        <TypeBlock
          title="Parking & Box"
          icon={Car}
          description="Places de parking et boxes fermés"
          types={PROPERTY_TYPE_GROUPS.parking}
          selectedType={selectedType}
          onSelect={handleSelect}
        />

        {/* Bloc 3 - Locaux professionnels */}
        <TypeBlock
          title="Local commercial"
          icon={Building2}
          description="Commerces, bureaux, entrepôts et fonds de commerce"
          types={PROPERTY_TYPE_GROUPS.locaux}
          selectedType={selectedType}
          onSelect={handleSelect}
        />
      </div>

      {/* Message d'aide raccourci et professionnel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className={`${CLASSES.glass} rounded-xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-5 shadow-md`}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="text-xl"
          >
            ℹ️
          </motion.div>
          <p className="text-sm text-foreground leading-relaxed">
            <strong className="font-semibold text-primary">Le questionnaire s'adapte automatiquement</strong> selon le type de bien sélectionné.
          </p>
        </div>
      </motion.div>

      {/* Bouton Continuer (optionnel, car passage automatique) */}
      <AnimatePresence>
        {canContinue && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="flex justify-end pt-4"
          >
            <Button
              size="lg"
              onClick={onContinue}
              className="min-w-[200px] shadow-lg transition-all hover:shadow-xl"
            >
              Continuer
              <motion.span
                initial={{ x: -5 }}
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="ml-2"
              >
                →
              </motion.span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
