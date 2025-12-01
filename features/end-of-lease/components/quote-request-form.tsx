"use client";

/**
 * Écran 5: Demande de devis en 2 clics
 * Interface ultra simple pour contacter les artisans
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Send,
  Plus,
  Trash2,
  User,
  Mail,
  Phone,
  CheckCircle2,
  Loader2,
  Wrench,
  Euro,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { RenovationItem, RenovationWorkType } from "@/lib/types/end-of-lease";

interface Provider {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface QuoteRequestFormProps {
  renovationItems: RenovationItem[];
  suggestedProviders?: Provider[];
  onSubmit: (data: {
    selectedItems: string[];
    providers: Provider[];
    message: string;
  }) => Promise<void>;
  onBack: () => void;
  onSkip: () => void;
  className?: string;
}

const WORK_TYPE_LABELS: Record<RenovationWorkType, { label: string; icon: string }> = {
  peinture: { label: "Peinture", icon: "🎨" },
  sol: { label: "Sols", icon: "🪵" },
  plomberie: { label: "Plomberie", icon: "🔧" },
  electricite: { label: "Électricité", icon: "⚡" },
  menuiserie: { label: "Menuiserie", icon: "🚪" },
  nettoyage: { label: "Nettoyage", icon: "🧹" },
  salle_de_bain: { label: "Salle de bain", icon: "🚿" },
  cuisine: { label: "Cuisine", icon: "🍳" },
  autres: { label: "Autres", icon: "🔨" },
};

export function QuoteRequestForm({
  renovationItems,
  suggestedProviders = [],
  onSubmit,
  onBack,
  onSkip,
  className,
}: QuoteRequestFormProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>(
    renovationItems.map((item) => item.id)
  );
  const [providers, setProviders] = useState<Provider[]>(
    suggestedProviders.length > 0
      ? suggestedProviders
      : [{ id: "1", name: "", email: "", phone: "" }]
  );
  const [message, setMessage] = useState(
    "Bonjour,\n\nJe souhaite obtenir un devis pour des travaux de rénovation dans mon logement.\n\nCordialement"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Calculer le total des travaux sélectionnés
  const selectedTotal = renovationItems
    .filter((item) => selectedItems.includes(item.id))
    .reduce((sum, item) => sum + item.estimated_cost, 0);

  // Ajouter un prestataire
  const addProvider = () => {
    setProviders([
      ...providers,
      { id: Date.now().toString(), name: "", email: "", phone: "" },
    ]);
  };

  // Supprimer un prestataire
  const removeProvider = (id: string) => {
    if (providers.length > 1) {
      setProviders(providers.filter((p) => p.id !== id));
    }
  };

  // Mettre à jour un prestataire
  const updateProvider = (id: string, field: keyof Provider, value: string) => {
    setProviders(
      providers.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Soumettre la demande
  const handleSubmit = async () => {
    // Valider les données
    const validProviders = providers.filter((p) => p.name && p.email);
    if (validProviders.length === 0) {
      alert("Veuillez renseigner au moins un artisan");
      return;
    }

    if (selectedItems.length === 0) {
      alert("Veuillez sélectionner au moins un travail");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        selectedItems,
        providers: validProviders,
        message,
      });
      setIsSuccess(true);
    } catch (error) {
      console.error("Erreur envoi devis:", error);
      alert("Erreur lors de l'envoi des demandes");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Affichage du succès
  if (isSuccess) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-12 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-20 h-20 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
          >
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </motion.div>
          <h3 className="text-2xl font-bold mb-2">Demandes envoyées !</h3>
          <p className="text-muted-foreground mb-6">
            {providers.filter((p) => p.name && p.email).length} artisan(s) vont recevoir
            votre demande de devis.
          </p>
          <Button onClick={onSkip} size="lg">
            Continuer le processus
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
        <CardTitle className="text-xl flex items-center gap-2">
          <Send className="w-6 h-6" />
          Demander des devis
        </CardTitle>
        <p className="text-white/80 text-sm mt-1">
          2 clics pour contacter des artisans de confiance
        </p>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Travaux à réaliser */}
        <div>
          <Label className="text-base font-semibold mb-3 block">
            Travaux sélectionnés
          </Label>
          <div className="space-y-2">
            {renovationItems.map((item) => {
              const config = WORK_TYPE_LABELS[item.work_type];
              const isSelected = selectedItems.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    isSelected ? "bg-primary/5 border-primary" : "bg-muted/30"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedItems([...selectedItems, item.id]);
                      } else {
                        setSelectedItems(selectedItems.filter((id) => id !== item.id));
                      }
                    }}
                  />
                  <span className="text-2xl">{config.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {config.label}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {item.estimated_cost.toLocaleString("fr-FR")} €
                  </Badge>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-right">
            <span className="text-sm text-muted-foreground">Total estimé : </span>
            <span className="font-semibold">{selectedTotal.toLocaleString("fr-FR")} €</span>
          </div>
        </div>

        <Separator />

        {/* Artisans */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-semibold">
              Artisans à contacter
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addProvider}
              disabled={providers.length >= 3}
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>

          <div className="space-y-4">
            {providers.map((provider, index) => (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">Artisan {index + 1}</span>
                  {providers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProvider(provider.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor={`name-${provider.id}`} className="text-xs">
                      Nom *
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id={`name-${provider.id}`}
                        placeholder="Nom de l'artisan"
                        value={provider.name}
                        onChange={(e) => updateProvider(provider.id, "name", e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`email-${provider.id}`} className="text-xs">
                      Email *
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id={`email-${provider.id}`}
                        type="email"
                        placeholder="email@exemple.com"
                        value={provider.email}
                        onChange={(e) => updateProvider(provider.id, "email", e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`phone-${provider.id}`} className="text-xs">
                      Téléphone
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id={`phone-${provider.id}`}
                        type="tel"
                        placeholder="06 XX XX XX XX"
                        value={provider.phone || ""}
                        onChange={(e) => updateProvider(provider.id, "phone", e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Message personnalisé */}
        <div>
          <Label htmlFor="message" className="text-base font-semibold mb-2 block">
            Message (optionnel)
          </Label>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Ajoutez des détails pour les artisans..."
          />
        </div>
      </CardContent>

      <Separator />

      {/* Actions */}
      <div className="p-4 flex items-center justify-between bg-muted/30">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onSkip}>
            Passer
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Envoyer les demandes
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

