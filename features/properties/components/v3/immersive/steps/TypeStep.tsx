"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Home, Warehouse, Car, Store, Hotel, Sofa } from "lucide-react";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import type { PropertyTypeV3 } from "@/lib/types/property-v3";

const TYPES = [
  { id: "appartement", label: "Appartement", icon: Building2 },
  { id: "maison", label: "Maison", icon: Home },
  { id: "studio", label: "Studio", icon: Sofa },
  { id: "colocation", label: "Colocation", icon: Home },
  { id: "saisonnier", label: "Saisonnier", icon: Hotel },
  { id: "parking", label: "Parking", icon: Car },
  { id: "box", label: "Box / Garage", icon: Warehouse },
  { id: "local_commercial", label: "Local Commercial", icon: Store },
  { id: "bureaux", label: "Bureaux", icon: Building2 },
  { id: "entrepot", label: "Entrepôt", icon: Warehouse },
  { id: "fonds_de_commerce", label: "Fonds de commerce", icon: Store },
] as const;

export function TypeStep() {
  const { formData, initializeDraft, nextStep } = usePropertyWizardStore();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    buttonRefs.current[0]?.focus();
  }, []);

  const handleSelect = useCallback(async (type: PropertyTypeV3) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    await initializeDraft(type);
    setTimeout(() => nextStep(), 300);
  }, [initializeDraft, nextStep, isTransitioning]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const cols = 6;
    let newIndex = index;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); newIndex = Math.min(index + 1, TYPES.length - 1); break;
      case 'ArrowLeft': e.preventDefault(); newIndex = Math.max(index - 1, 0); break;
      case 'ArrowDown': e.preventDefault(); newIndex = Math.min(index + cols, TYPES.length - 1); break;
      case 'ArrowUp': e.preventDefault(); newIndex = Math.max(index - cols, 0); break;
      case 'Enter': case ' ': e.preventDefault(); handleSelect(TYPES[index].id as PropertyTypeV3); return;
      default: return;
    }
    if (newIndex !== index) { setFocusedIndex(newIndex); buttonRefs.current[newIndex]?.focus(); }
  }, [handleSelect]);

  return (
    <div className="h-full flex flex-col">
      {/* Grille responsive qui remplit l'espace */}
      <div 
        className="flex-1 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3 content-center"
        role="radiogroup"
        aria-label="Sélectionnez le type de bien"
      >
        {TYPES.map((item, index) => {
          const isSelected = formData.type === item.id;
          const isBeingSelected = isTransitioning && isSelected;
          
          return (
            <motion.button
              key={item.id}
              ref={(el) => { buttonRefs.current[index] = el; }}
              role="radio"
              aria-checked={isSelected}
              aria-label={item.label}
              tabIndex={focusedIndex === index ? 0 : -1}
              onClick={() => handleSelect(item.id as PropertyTypeV3)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onFocus={() => setFocusedIndex(index)}
              whileHover={!isTransitioning ? { scale: 1.03 } : {}}
              whileTap={!isTransitioning ? { scale: 0.97 } : {}}
              disabled={isTransitioning}
              className={`relative flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border-2 transition-all
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                aspect-[4/3]
                ${isSelected 
                  ? "border-primary bg-primary/10 shadow-lg" 
                  : "border-border bg-card hover:border-primary/50 hover:shadow-md"
                }
                ${isTransitioning && !isSelected ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {/* Icône responsive */}
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-2 transition-colors
                ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <item.icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              
              {/* Label responsive */}
              <span className="text-xs md:text-sm font-semibold text-center leading-tight">
                {item.label}
              </span>

              {/* Checkmark */}
              {isSelected && (
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
              {isBeingSelected && (
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
