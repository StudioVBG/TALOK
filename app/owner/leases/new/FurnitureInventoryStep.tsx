"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  Bed,
  Blinds,
  CookingPot,
  Microwave,
  Refrigerator,
  UtensilsCrossed,
  Armchair,
  BookOpen,
  Lamp,
  Sparkles,
  Camera,
  Plus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FurnitureCondition } from "@/lib/types/end-of-lease";
import {
  MANDATORY_FURNITURE_LIST,
  FURNITURE_CONDITION_LABELS,
  FURNITURE_CONDITION_COLORS,
} from "@/lib/types/end-of-lease";

// ============================================
// Types
// ============================================

export interface FurnitureItemState {
  name: string;
  legalRef: string;
  condition: FurnitureCondition;
  quantity: number;
  isMandatory: boolean;
}

export interface FurnitureInventoryData {
  items: FurnitureItemState[];
  additionalItems: { name: string; condition: FurnitureCondition; quantity: number }[];
  isComplete: boolean;
}

interface FurnitureInventoryStepProps {
  value: FurnitureInventoryData;
  onChange: (data: FurnitureInventoryData) => void;
  typeBail: string;
}

// ============================================
// Icon mapping
// ============================================

const ITEM_ICONS: Record<number, React.ElementType> = {
  0: Bed,          // Literie
  1: Blinds,       // Volets/rideaux
  2: CookingPot,   // Plaques
  3: Microwave,    // Four/micro-ondes
  4: Refrigerator, // Réfrigérateur
  5: UtensilsCrossed, // Vaisselle
  6: UtensilsCrossed, // Ustensiles
  7: Armchair,     // Table et sièges
  8: BookOpen,     // Étagères
  9: Lamp,         // Luminaires
  10: Sparkles,    // Entretien
};

// ============================================
// Initial state factory
// ============================================

export function createInitialInventory(): FurnitureInventoryData {
  return {
    items: MANDATORY_FURNITURE_LIST.map((item) => ({
      name: item.name,
      legalRef: item.legal_requirement,
      condition: "bon" as FurnitureCondition,
      quantity: 1,
      isMandatory: true,
    })),
    additionalItems: [],
    isComplete: false,
  };
}

// ============================================
// Component
// ============================================

export function FurnitureInventoryStep({
  value,
  onChange,
  typeBail,
}: FurnitureInventoryStepProps) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");

  // Compute completion status
  const completionStatus = useMemo(() => {
    const mandatoryPresent = value.items.filter(
      (item) => item.isMandatory && item.condition !== "absent"
    ).length;
    const totalMandatory = value.items.filter((item) => item.isMandatory).length;
    const allPresent = mandatoryPresent === totalMandatory;
    return { mandatoryPresent, totalMandatory, allPresent };
  }, [value.items]);

  // Update item condition
  const handleConditionChange = useCallback(
    (index: number, condition: FurnitureCondition) => {
      const newItems = [...value.items];
      newItems[index] = { ...newItems[index], condition };
      const allPresent = newItems
        .filter((i) => i.isMandatory)
        .every((i) => i.condition !== "absent");
      onChange({ ...value, items: newItems, isComplete: allPresent });
    },
    [value, onChange]
  );

  // Update item quantity
  const handleQuantityChange = useCallback(
    (index: number, quantity: number) => {
      const newItems = [...value.items];
      newItems[index] = { ...newItems[index], quantity: Math.max(0, quantity) };
      onChange({ ...value, items: newItems });
    },
    [value, onChange]
  );

  // Add additional item
  const handleAddItem = useCallback(() => {
    if (!newItemName.trim()) return;
    const newAdditional = [
      ...value.additionalItems,
      { name: newItemName.trim(), condition: "bon" as FurnitureCondition, quantity: 1 },
    ];
    onChange({ ...value, additionalItems: newAdditional });
    setNewItemName("");
    setShowAddItem(false);
  }, [value, onChange, newItemName]);

  // Remove additional item
  const handleRemoveAdditional = useCallback(
    (index: number) => {
      const newAdditional = value.additionalItems.filter((_, i) => i !== index);
      onChange({ ...value, additionalItems: newAdditional });
    },
    [value, onChange]
  );

  const isFurnished = ["meuble", "bail_mobilite", "etudiant"].includes(typeBail);

  if (!isFurnished) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm uppercase text-muted-foreground">
            Inventaire mobilier obligatoire
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Décret n°2015-981 du 31 juillet 2015 — 11 éléments obligatoires
          </p>
        </div>
        <Badge
          variant={completionStatus.allPresent ? "default" : "destructive"}
          className={cn(
            completionStatus.allPresent
              ? "bg-green-100 text-green-700 border-green-200"
              : "bg-red-100 text-red-700 border-red-200"
          )}
        >
          {completionStatus.mandatoryPresent}/{completionStatus.totalMandatory}
        </Badge>
      </div>

      {/* Warning if not complete */}
      {!completionStatus.allPresent && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Inventaire incomplet
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Un logement meublé doit contenir les 11 équipements obligatoires.
                Sans inventaire complet, le bail peut être requalifié en location nue
                (dépôt limité à 1 mois, durée minimum 3 ans).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory items grid */}
      <div className="grid grid-cols-1 gap-2">
        {value.items.map((item, index) => {
          const Icon = ITEM_ICONS[index] || Sparkles;
          const isPresent = item.condition !== "absent";
          const color = FURNITURE_CONDITION_COLORS[item.condition];

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                isPresent
                  ? "bg-white border-slate-200"
                  : "bg-red-50 border-red-200"
              )}
            >
              {/* Icon + status */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  isPresent ? "bg-green-100" : "bg-red-100"
                )}
              >
                {isPresent ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>

              {/* Name + legal ref */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">{item.legalRef}</p>
              </div>

              {/* Quantity */}
              <Input
                type="number"
                min={0}
                value={item.quantity}
                onChange={(e) =>
                  handleQuantityChange(index, parseInt(e.target.value) || 0)
                }
                className="w-16 h-8 text-center text-xs"
              />

              {/* Condition selector */}
              <Select
                value={item.condition}
                onValueChange={(v) =>
                  handleConditionChange(index, v as FurnitureCondition)
                }
              >
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FURNITURE_CONDITION_LABELS).map(
                    ([key, label]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5"
                          style={{
                            backgroundColor:
                              FURNITURE_CONDITION_COLORS[
                                key as FurnitureCondition
                              ],
                          }}
                        />
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </motion.div>
          );
        })}
      </div>

      {/* Additional items */}
      {value.additionalItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Équipements supplémentaires
          </p>
          {value.additionalItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 rounded-lg border bg-white"
            >
              <div className="flex-1 text-sm">{item.name}</div>
              <Select
                value={item.condition}
                onValueChange={(v) => {
                  const newAdditional = [...value.additionalItems];
                  newAdditional[index] = {
                    ...newAdditional[index],
                    condition: v as FurnitureCondition,
                  };
                  onChange({ ...value, additionalItems: newAdditional });
                }}
              >
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FURNITURE_CONDITION_LABELS).map(
                    ([key, label]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleRemoveAdditional(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add item button */}
      <AnimatePresence>
        {showAddItem ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex gap-2"
          >
            <Input
              placeholder="Nom de l'équipement..."
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              className="h-8 text-sm"
              autoFocus
            />
            <Button size="sm" className="h-8" onClick={handleAddItem}>
              Ajouter
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setShowAddItem(false)}
            >
              Annuler
            </Button>
          </motion.div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => setShowAddItem(true)}
          >
            <Plus className="h-3 w-3" />
            Ajouter un équipement supplémentaire
          </Button>
        )}
      </AnimatePresence>

      {/* Completion message */}
      {completionStatus.allPresent && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 rounded-lg bg-green-50 border border-green-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Inventaire conforme — 11/11 équipements présents
            </p>
          </div>
          <p className="text-xs text-green-600 mt-1 ml-6">
            L'inventaire sera annexé au bail conformément au Décret 2015-981.
          </p>
        </motion.div>
      )}
    </div>
  );
}
