"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { METER_CONFIG } from "./meter-card";
import type { MeterType } from "@/lib/services/meters/types";

interface MeterReadingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meterId: string;
  meterType: MeterType;
  meterReference: string;
  lastValue?: number | null;
  onSuccess?: () => void;
  /** Use property-meters API (connected meters) vs legacy meters API */
  usePropertyMetersApi?: boolean;
}

export function MeterReadingForm({
  open,
  onOpenChange,
  meterId,
  meterType,
  meterReference,
  lastValue,
  onSuccess,
  usePropertyMetersApi = true,
}: MeterReadingFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const config = METER_CONFIG[meterType] || METER_CONFIG.other;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setPhotoPreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    const numValue = Number(value.replace(/\s/g, "").replace(",", "."));
    if (isNaN(numValue) || numValue < 0) {
      toast({ title: "Valeur invalide", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const readingDate = new Date().toISOString().split("T")[0];

      if (usePropertyMetersApi) {
        const response = await fetch(`/api/property-meters/${meterId}/readings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reading_date: readingDate,
            value: numValue,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Erreur");
        }
      } else {
        // Legacy API for tenant meters
        const formData = new FormData();
        formData.append("reading_value", String(numValue));
        formData.append("reading_date", new Date().toISOString());
        if (photoFile) formData.append("photo", photoFile);

        const response = await fetch(`/api/meters/${meterId}/readings`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Erreur");
      }

      toast({ title: "Releve enregistre" });
      onOpenChange(false);
      setValue("");
      setPhotoPreview(null);
      setPhotoFile(null);
      onSuccess?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'enregistrer le releve",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Nouveau Releve</DialogTitle>
          <DialogDescription className="font-medium">
            {config.label} - Ref {meterReference}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Photo capture */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300",
              photoPreview
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-border hover:bg-muted bg-muted/50"
            )}
          >
            {photoPreview ? (
              <div className="relative w-full h-full p-2">
                <img
                  src={photoPreview}
                  className="w-full h-full object-cover rounded-2xl"
                  alt="Photo compteur"
                />
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoPreview(null);
                    setPhotoFile(null);
                  }}
                  className="absolute top-4 right-4 h-8 w-8 rounded-full bg-red-500 p-0 hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <div className="h-12 w-12 bg-card rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <Camera className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">Photo du compteur</p>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-black">
                  Optionnel
                </p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            capture="environment"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />

          {/* Value input */}
          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Index ({config.unitLabel})
            </Label>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={lastValue != null ? `Dernier : ${lastValue}` : "Saisir l'index"}
              className="h-14 text-2xl font-black rounded-2xl border-border"
            />
            {lastValue != null && (
              <p className="text-[10px] text-muted-foreground">
                Dernier releve : {lastValue.toLocaleString("fr-FR")} {config.unitLabel}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!value || isSubmitting}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 rounded-xl px-8 shadow-lg"
          >
            {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
