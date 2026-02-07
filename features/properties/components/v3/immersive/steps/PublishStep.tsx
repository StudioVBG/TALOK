"use client";

import React from "react";
import { motion } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Globe, Lock, Eye, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { EntitySelector } from "@/components/entities/EntitySelector";
import { useEntityStore } from "@/stores/useEntityStore";

export function PublishStep() {
  const { formData, updateFormData } = usePropertyWizardStore();
  const { entities } = useEntityStore();

  const availableFrom = formData.available_from ? new Date(formData.available_from) : new Date();
  const visibility = (formData as any).visibility || "private";

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto justify-center gap-8 py-4">
      <div className="space-y-6">
        {/* Entité juridique propriétaire */}
        {entities.length > 0 && (
          <div className="space-y-3">
            <EntitySelector
              value={formData.legal_entity_id || null}
              onChange={(id) => updateFormData({ legal_entity_id: id })}
              label="Entité propriétaire du bien"
              hint="Sélectionnez l'entité juridique qui détient ce bien. Optionnel pour les particuliers."
            />
          </div>
        )}

        {/* Date de disponibilité */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Date de disponibilité</Label>
          <p className="text-sm text-muted-foreground">À partir de quand le bien est-il prêt à être loué ?</p>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full h-12 justify-start text-left font-normal text-lg",
                  !availableFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-3 h-5 w-5" />
                {availableFrom ? (
                  format(availableFrom, "PPP", { locale: fr })
                ) : (
                  <span>Choisir une date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={availableFrom}
                onSelect={(date) => updateFormData({ available_from: date?.toISOString() })}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Visibilité */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Visibilité de l'annonce</Label>
          <RadioGroup
            value={visibility}
            onValueChange={(v) => updateFormData({ visibility: v } as any)}
            className="grid gap-4"
          >
            <div className="flex items-center space-x-4">
              <RadioGroupItem value="public" id="v-public" className="peer sr-only" />
              <Label
                htmlFor="v-public"
                className={cn(
                  "flex flex-1 items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-all",
                  visibility === "public" ? "border-primary bg-primary/5 shadow-sm" : "border-muted hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center",
                    visibility === "public" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Public</p>
                    <p className="text-xs text-muted-foreground">Visible par tous les utilisateurs du SaaS</p>
                  </div>
                </div>
                {visibility === "public" && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </Label>
            </div>

            <div className="flex items-center space-x-4">
              <RadioGroupItem value="private" id="v-private" className="peer sr-only" />
              <Label
                htmlFor="v-private"
                className={cn(
                  "flex flex-1 items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-all",
                  visibility === "private" ? "border-primary bg-primary/5 shadow-sm" : "border-muted hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center",
                    visibility === "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Privé</p>
                    <p className="text-xs text-muted-foreground">Visible uniquement par vous et vos invités</p>
                  </div>
                </div>
                {visibility === "private" && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Note informative */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 flex gap-3">
          <Eye className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Une fois publiée, vous pourrez toujours modifier ces options depuis le tableau de bord de votre bien.
          </p>
        </div>
      </div>
    </div>
  );
}

