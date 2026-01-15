"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  value: string | number | null | undefined;
  onSave: (newValue: string) => Promise<void>;
  label?: string;
  type?: "text" | "textarea" | "number" | "currency";
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export function EditableText({
  value,
  onSave,
  label,
  type = "text",
  className,
  inputClassName,
  placeholder = "Non renseigné",
  readOnly = false,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value?.toString() || "");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Formatage pour l'affichage
  const displayValue = React.useMemo(() => {
    if (value === null || value === undefined || value === "") return placeholder;
    if (type === "currency") {
      return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
    }
    return value;
  }, [value, type, placeholder]);

  const handleSave = async () => {
    if (tempValue === value?.toString()) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(tempValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      // Optionnel : Toast d'erreur ici
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setTempValue(value?.toString() || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (readOnly) {
    return <div className={className}>{displayValue}</div>;
  }

  if (isEditing) {
    return (
      <div className={cn("flex items-start gap-2 animate-in fade-in duration-200 relative z-50", className)}>
        <div className="flex-1">
          {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
          {type === "textarea" ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn("min-h-[80px] resize-none shadow-lg border-primary/50 bg-white text-black", inputClassName)}
              placeholder={placeholder}
              disabled={isLoading}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type === "currency" ? "number" : type}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn("shadow-lg border-primary/50 bg-white text-black", inputClassName)}
              placeholder={placeholder}
              disabled={isLoading}
            />
          )}
        </div>
        <div className="flex flex-col gap-1 mt-auto">
          <Button
            size="icon"
            variant="default"
            className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white shadow-md"
            onClick={handleSave}
            disabled={isLoading}
            aria-label="Enregistrer"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-slate-200 text-slate-700 hover:bg-slate-300 shadow-md"
            onClick={handleCancel}
            disabled={isLoading}
            aria-label="Annuler"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "group relative rounded-md border border-transparent hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-sm px-2 -mx-2 py-1 transition-all cursor-pointer",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      {label && <p className="text-xs text-muted-foreground mb-0.5">{label}</p>}
      <div className="w-full">
        <span className={cn(
          "truncate block w-full",
          (value === null || value === undefined || value === "") && "text-muted-foreground italic"
        )}>
          {displayValue}
        </span>
      </div>
    </div>
  );
}
