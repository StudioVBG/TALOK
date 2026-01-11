"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Home, Warehouse, Car, Store, Hotel, Sofa, Building, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { cn } from "@/lib/utils";
import type { PropertyTypeV3 } from "@/lib/types/property-v3";

// Configuration des types avec "immeuble" en featured
const FEATURED_TYPE = {
  id: "immeuble",
  label: "Immeuble entier",
  description: "Gérez plusieurs lots d'un coup",
  icon: Building,
  featured: true,
} as const;

const TYPES = [
  // Habitation
  { id: "appartement", label: "Appartement", icon: Building2, group: "habitation" },
  { id: "maison", label: "Maison", icon: Home, group: "habitation" },
  { id: "studio", label: "Studio", icon: Sofa, group: "habitation" },
  { id: "colocation", label: "Colocation", icon: Home, group: "habitation" },
  { id: "saisonnier", label: "Saisonnier", icon: Hotel, group: "habitation" },
  // Parking
  { id: "parking", label: "Parking", icon: Car, group: "parking" },
  { id: "box", label: "Box / Garage", icon: Warehouse, group: "parking" },
  // Pro
  { id: "local_commercial", label: "Local Commercial", icon: Store, group: "pro" },
  { id: "bureaux", label: "Bureaux", icon: Building2, group: "pro" },
  { id: "entrepot", label: "Entrepôt", icon: Warehouse, group: "pro" },
  { id: "fonds_de_commerce", label: "Fonds de commerce", icon: Store, group: "pro" },
] as const;

export function TypeStep() {
  const { formData, initializeDraft, nextStep } = usePropertyWizardStore();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    // Focus sur le bouton "Immeuble" featured par défaut
    buttonRefs.current[0]?.focus();
  }, []);

  const handleSelect = useCallback(async (type: PropertyTypeV3) => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    try {
      // Attendre que le draft soit créé en BDD AVANT de passer à l'étape suivante
      await initializeDraft(type);

      // Petit délai pour l'animation visuelle, puis navigation
      await new Promise(resolve => setTimeout(resolve, 300));
      nextStep();
    } catch (error) {
      console.error('[TypeStep] Erreur création draft:', error);
      // Reset pour permettre un nouvel essai
      setIsTransitioning(false);
    }
  }, [initializeDraft, nextStep, isTransitioning]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number, totalItems: number) => {
    const cols = 6;
    let newIndex = index;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); newIndex = Math.min(index + 1, totalItems - 1); break;
      case 'ArrowLeft': e.preventDefault(); newIndex = Math.max(index - 1, 0); break;
      case 'ArrowDown': e.preventDefault(); newIndex = Math.min(index + cols, totalItems - 1); break;
      case 'ArrowUp': e.preventDefault(); newIndex = Math.max(index - cols, 0); break;
      case 'Enter': case ' ': 
        e.preventDefault(); 
        if (index === 0) {
          handleSelect(FEATURED_TYPE.id as PropertyTypeV3);
        } else {
          handleSelect(TYPES[index - 1].id as PropertyTypeV3);
        }
        return;
      default: return;
    }
    if (newIndex !== index) { 
      setFocusedIndex(newIndex); 
      buttonRefs.current[newIndex]?.focus(); 
    }
  }, [handleSelect]);

  const isSelected = (id: string) => formData.type === id;
  const isBeingSelected = (id: string) => isTransitioning && isSelected(id);

  return (
    <div className="h-full flex flex-col gap-6 overflow-y-auto py-2">
      
      {/* 🏢 FEATURED : Immeuble entier */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        <motion.button
          ref={(el) => { buttonRefs.current[0] = el; }}
          role="radio"
          aria-checked={isSelected(FEATURED_TYPE.id)}
          aria-label={FEATURED_TYPE.label}
          tabIndex={focusedIndex === 0 ? 0 : -1}
          onClick={() => handleSelect(FEATURED_TYPE.id as PropertyTypeV3)}
          onKeyDown={(e) => handleKeyDown(e, 0, TYPES.length + 1)}
          onFocus={() => setFocusedIndex(0)}
          whileHover={!isTransitioning ? { scale: 1.01 } : {}}
          whileTap={!isTransitioning ? { scale: 0.99 } : {}}
          disabled={isTransitioning}
          className={cn(
            "relative w-full p-4 md:p-6 rounded-2xl border-2 transition-all",
            "bg-gradient-to-br from-blue-600/10 via-indigo-500/10 to-purple-600/10",
            "hover:from-blue-600/20 hover:via-indigo-500/20 hover:to-purple-600/20",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            isSelected(FEATURED_TYPE.id)
              ? "border-blue-500 shadow-xl shadow-blue-500/20"
              : "border-blue-300/50 hover:border-blue-400",
            isTransitioning && !isSelected(FEATURED_TYPE.id) && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-4">
            {/* Icône avec effet glow */}
            <div className={cn(
              "relative w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center",
              "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
              "shadow-lg shadow-blue-500/30"
            )}>
              <FEATURED_TYPE.icon className="w-7 h-7 md:w-8 md:h-8" />
              <div className="absolute -top-1 -right-1">
                <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 shadow-md">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                  NOUVEAU
                </Badge>
              </div>
            </div>
            
            {/* Texte */}
            <div className="flex-1 text-left">
              <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                {FEATURED_TYPE.label}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {FEATURED_TYPE.description}
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  Multi-lots
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Vue 3D
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Duplication rapide
                </Badge>
              </div>
            </div>

            {/* Checkmark */}
            {isSelected(FEATURED_TYPE.id) && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            )}
          </div>

          {/* Loading overlay */}
          {isBeingSelected(FEATURED_TYPE.id) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-blue-500/10 rounded-2xl flex items-center justify-center backdrop-blur-sm"
            >
              <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}
        </motion.button>
      </motion.div>

      {/* Séparateur */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium">ou un bien individuel</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* 🏠 Grille des autres types */}
      <div 
        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3"
        role="radiogroup"
        aria-label="Sélectionnez le type de bien"
      >
        {TYPES.map((item, index) => {
          const globalIndex = index + 1; // +1 car l'index 0 est pour le featured
          const selected = isSelected(item.id);
          const selecting = isBeingSelected(item.id);
          
          return (
            <motion.button
              key={item.id}
              ref={(el) => { buttonRefs.current[globalIndex] = el; }}
              role="radio"
              aria-checked={selected}
              aria-label={item.label}
              tabIndex={focusedIndex === globalIndex ? 0 : -1}
              onClick={() => handleSelect(item.id as PropertyTypeV3)}
              onKeyDown={(e) => handleKeyDown(e, globalIndex, TYPES.length + 1)}
              onFocus={() => setFocusedIndex(globalIndex)}
              whileHover={!isTransitioning ? { scale: 1.03 } : {}}
              whileTap={!isTransitioning ? { scale: 0.97 } : {}}
              disabled={isTransitioning}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className={cn(
                "relative flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border-2 transition-all",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                "aspect-[4/3]",
                selected 
                  ? "border-primary bg-primary/10 shadow-lg" 
                  : "border-border bg-card hover:border-primary/50 hover:shadow-md",
                isTransitioning && !selected && "opacity-40 cursor-not-allowed"
              )}
            >
              {/* Icône responsive */}
              <div className={cn(
                "w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-2 transition-colors",
                selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <item.icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              
              {/* Label responsive */}
              <span className="text-xs md:text-sm font-semibold text-center leading-tight">
                {item.label}
              </span>

              {/* Checkmark */}
              {selected && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 h-5 w-5 bg-primary rounded-full flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
              
              {/* Loading */}
              {selecting && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-primary/20 rounded-xl flex items-center justify-center"
                >
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
