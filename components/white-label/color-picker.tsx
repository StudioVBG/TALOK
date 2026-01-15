"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Couleurs prédéfinies
const PRESET_COLORS = [
  // Bleus
  "#2563eb", "#3b82f6", "#0ea5e9", "#06b6d4",
  // Violets
  "#7c3aed", "#8b5cf6", "#a855f7", "#d946ef",
  // Verts
  "#10b981", "#22c55e", "#84cc16", "#14b8a6",
  // Oranges/Rouges
  "#f97316", "#ef4444", "#f43f5e", "#ec4899",
  // Neutres
  "#6b7280", "#374151", "#1f2937", "#0f172a",
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  defaultValue?: string;
  showPresets?: boolean;
  className?: string;
}

export function ColorPicker({
  value,
  onChange,
  label,
  description,
  disabled = false,
  defaultValue = "#2563eb",
  showPresets = true,
  className,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || defaultValue);

  useEffect(() => {
    setInputValue(value || defaultValue);
  }, [value, defaultValue]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      // Valider le format hex
      if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
        onChange(newValue);
      }
    },
    [onChange]
  );

  const handlePresetClick = useCallback(
    (color: string) => {
      setInputValue(color);
      onChange(color);
    },
    [onChange]
  );

  const handleReset = useCallback(() => {
    setInputValue(defaultValue);
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium text-slate-700">{label}</Label>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start gap-3 h-10",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div
              className="w-6 h-6 rounded-md border border-slate-200 shadow-sm"
              style={{ backgroundColor: inputValue }}
            />
            <span className="font-mono text-sm">{inputValue}</span>
            <Palette className="w-4 h-4 ml-auto text-slate-400" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-4" align="start">
          <div className="space-y-4">
            {/* Prévisualisation */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-lg border-2 border-slate-200 shadow-inner"
                style={{ backgroundColor: inputValue }}
              />
              <div className="flex-1">
                <Input
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="#000000"
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                title="Réinitialiser"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            {/* Input type color natif */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Sélecteur :</Label>
              <input
                type="color"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  onChange(e.target.value);
                }}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
            </div>

            {/* Couleurs prédéfinies */}
            {showPresets && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">
                  Couleurs suggérées
                </Label>
                <div className="grid grid-cols-8 gap-1.5">
                  {PRESET_COLORS.map((color) => (
                    <motion.button
                      key={color}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handlePresetClick(color)}
                      className={cn(
                        "w-7 h-7 rounded-md border-2 transition-all",
                        inputValue === color
                          ? "border-slate-900 ring-2 ring-slate-400"
                          : "border-transparent hover:border-slate-300"
                      )}
                      style={{ backgroundColor: color }}
                    >
                      <AnimatePresence>
                        {inputValue === color && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="flex items-center justify-center"
                          >
                            <Check className="w-4 h-4 text-white drop-shadow" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {description && (
        <p className="text-xs text-slate-500">{description}</p>
      )}
    </div>
  );
}

export default ColorPicker;
