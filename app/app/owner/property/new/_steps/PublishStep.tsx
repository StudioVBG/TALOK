"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Globe, Lock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import StepFrame from "../_components/StepFrame";
import WizardFooter from "../_components/WizardFooter";
import { useNewProperty } from "../_store/useNewProperty";

export default function PublishStep() {
  const { draft, patch, prev, next } = useNewProperty();
  const reduced = useReducedMotion();
  
  const [isPublished, setIsPublished] = useState(draft.is_published ?? false);
  const [visibility, setVisibility] = useState<"public" | "private">(
    (draft.visibility as "public" | "private") || "public"
  );
  const [availableFrom, setAvailableFrom] = useState<Date | undefined>(
    draft.available_from ? new Date(draft.available_from) : undefined
  );

  const handleTogglePublished = (checked: boolean) => {
    setIsPublished(checked);
    patch({ is_published: checked });
  };

  const handleVisibilityChange = (value: "public" | "private") => {
    setVisibility(value);
    patch({ visibility: value });
  };

  const handleAvailableFromChange = (date: Date | undefined) => {
    setAvailableFrom(date);
    patch({ available_from: date?.toISOString() });
  };

  return (
    <StepFrame k="PUBLISH">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Options de publication</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez la visibilité et la disponibilité de votre bien
          </p>
        </div>

        {/* Publication */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Publication
              </CardTitle>
              <CardDescription>
                Publiez votre bien pour qu'il soit visible par les locataires potentiels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="publish-toggle">Publier le bien</Label>
                  <p className="text-sm text-muted-foreground">
                    {isPublished
                      ? "Votre bien sera visible par les locataires"
                      : "Votre bien restera privé pour le moment"}
                  </p>
                </div>
                <Switch
                  id="publish-toggle"
                  checked={isPublished}
                  onCheckedChange={handleTogglePublished}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Visibilité */}
        {isPublished && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.2, delay: reduced ? 0 : 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Visibilité
                </CardTitle>
                <CardDescription>
                  Choisissez qui peut voir votre bien
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition",
                      visibility === "public"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/30"
                    )}
                    onClick={() => handleVisibilityChange("public")}
                  >
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="cursor-pointer">Public</Label>
                      <p className="text-sm text-muted-foreground">
                        Visible par tous les locataires potentiels
                      </p>
                    </div>
                    <input
                      type="radio"
                      id="visibility-public"
                      name="visibility"
                      value="public"
                      checked={visibility === "public"}
                      onChange={() => handleVisibilityChange("public")}
                      className="h-4 w-4"
                    />
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition",
                      visibility === "private"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/30"
                    )}
                    onClick={() => handleVisibilityChange("private")}
                  >
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="cursor-pointer">Privé</Label>
                      <p className="text-sm text-muted-foreground">
                        Visible uniquement via un lien de partage
                      </p>
                    </div>
                    <input
                      type="radio"
                      id="visibility-private"
                      name="visibility"
                      value="private"
                      checked={visibility === "private"}
                      onChange={() => handleVisibilityChange("private")}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Date de disponibilité */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.2, delay: reduced ? 0 : 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Disponibilité
              </CardTitle>
              <CardDescription>
                Date à partir de laquelle le bien sera disponible à la location
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                id="available-from"
                name="available-from"
                type="date"
                value={availableFrom ? availableFrom.toISOString().split("T")[0] : ""}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : undefined;
                  handleAvailableFromChange(date);
                }}
                className="w-full"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Message d'aide */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            Vous pourrez modifier ces options à tout moment depuis la page de votre bien.
          </p>
        </div>
      </div>

      <WizardFooter
        primary="Continuer — Récapitulatif"
        onPrimary={next}
        onBack={prev}
        hint="Parfait, on passe au récapitulatif ✨"
      />
    </StepFrame>
  );
}
