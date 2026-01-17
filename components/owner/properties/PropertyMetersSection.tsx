"use client";

/**
 * Section de gestion des compteurs pour un logement (propriétaire)
 * 
 * Permet de:
 * - Voir la liste des compteurs du logement
 * - Ajouter un nouveau compteur
 * - Modifier/supprimer un compteur
 * - Voir l'historique des relevés
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Flame,
  Droplet,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  Check,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface Meter {
  id: string;
  property_id: string;
  lease_id?: string | null;
  type: "electricity" | "gas" | "water" | "heating";
  meter_number: string; // Nom réel dans le schéma DB
  provider?: string | null;
  provider_meter_id?: string | null;
  unit: string;
  is_connected: boolean;
  created_at: string;
  last_reading?: {
    value: number;
    date: string;
  } | null;
}

interface PropertyMetersSectionProps {
  propertyId: string;
  className?: string;
}

// ============================================
// CONSTANTES
// ============================================

const METER_CONFIG: Record<string, {
  label: string;
  icon: typeof Zap;
  color: string;
  bgColor: string;
  unit: string;
  providers: string[];
}> = {
  electricity: {
    label: "Électricité",
    icon: Zap,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    unit: "kWh",
    providers: ["EDF SEI (DROM)", "Enedis", "EDF", "Linky", "Autre"],
  },
  gas: {
    label: "Gaz",
    icon: Flame,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    unit: "m³",
    providers: ["GRDF", "SARA (Antilles)", "Gazpar", "Engie", "Autre"],
  },
  water: {
    label: "Eau",
    icon: Droplet,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    unit: "m³",
    providers: ["ODYSSI", "SME (Martinique)", "SMDS", "CISE Réunion", "Suez", "Veolia", "Saur", "Syndic", "Autre"],
  },
  heating: {
    label: "Chauffage",
    icon: Flame,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    unit: "kWh",
    providers: ["Collectif", "Individuel", "Autre"],
  },
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function PropertyMetersSection({ propertyId, className }: PropertyMetersSectionProps) {
  const { toast } = useToast();
  
  // États
  const [meters, setMeters] = useState<Meter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
  
  // Formulaire
  const [formData, setFormData] = useState({
    type: "electricity" as keyof typeof METER_CONFIG,
    serial_number: "",
    location: "",
    provider: "",
  });

  // ============================================
  // FETCH
  // ============================================

  const fetchMeters = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/properties/${propertyId}/meters`);
      const data = await response.json();
      
      if (response.ok) {
        setMeters(data.meters || []);
      } else {
        throw new Error(data.error || "Erreur lors du chargement");
      }
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (propertyId) {
      fetchMeters();
    }
  }, [propertyId]);

  // ============================================
  // HANDLERS
  // ============================================

  const resetForm = () => {
    setFormData({
      type: "electricity",
      serial_number: "",
      location: "",
      provider: "",
    });
    setEditingMeter(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleOpenEdit = (meter: Meter) => {
    setFormData({
      type: meter.type as keyof typeof METER_CONFIG,
      serial_number: meter.meter_number, // meter_number dans DB, serial_number dans le form
      location: "", // Non stocké en DB, pour affichage uniquement
      provider: meter.provider || "",
    });
    setEditingMeter(meter);
    setShowAddDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.serial_number.trim()) {
      toast({
        title: "Erreur",
        description: "Le numéro de compteur est obligatoire",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingMeter 
        ? `/api/properties/${propertyId}/meters/${editingMeter.id}`
        : `/api/properties/${propertyId}/meters`;
      
      const method = editingMeter ? "PATCH" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          serial_number: formData.serial_number.trim(),
          location: formData.location.trim() || null,
          provider: formData.provider || null,
          unit: METER_CONFIG[formData.type].unit,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }

      toast({
        title: editingMeter ? "Compteur modifié" : "Compteur ajouté",
        description: `Compteur ${METER_CONFIG[formData.type].label} enregistré avec succès`,
      });

      setShowAddDialog(false);
      resetForm();
      fetchMeters();

    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (meterId: string) => {
    if (!confirm("Supprimer ce compteur ? Les relevés associés seront conservés.")) {
      return;
    }

    try {
      const response = await fetch(`/api/properties/${propertyId}/meters/${meterId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      toast({
        title: "Compteur supprimé",
      });

      fetchMeters();

    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };


  // ============================================
  // RENDER
  // ============================================

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Compteurs
            </CardTitle>
            <CardDescription>
              Gérez les compteurs d'énergie du logement
            </CardDescription>
          </div>
          <Button onClick={handleOpenAdd} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : meters.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Aucun compteur enregistré pour ce logement
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Cliquez sur "Ajouter" ci-dessus pour enregistrer un compteur
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {meters.map((meter) => {
              const config = METER_CONFIG[meter.type] || METER_CONFIG.electricity;
              const Icon = config.icon;

              return (
                <motion.div
                  key={meter.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 rounded-lg border bg-white dark:bg-slate-800"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-xl", config.bgColor)}>
                      <Icon className={cn("w-6 h-6", config.color)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.label}</span>
                        {meter.is_connected && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                            Connecté
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        N° {meter.meter_number}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {meter.provider && (
                      <Badge variant="outline" className="text-xs">
                        {meter.provider}
                      </Badge>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEdit(meter)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(meter.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Info */}
        <Alert className="mt-4 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-700 dark:text-blue-400">
            Les compteurs sont utilisés lors des états des lieux pour enregistrer 
            les relevés d'entrée et de sortie (obligation légale).
          </AlertDescription>
        </Alert>
      </CardContent>

      {/* Dialog Ajout/Modification */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        if (!open) resetForm();
        setShowAddDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMeter ? "Modifier le compteur" : "Ajouter un compteur"}
            </DialogTitle>
            <DialogDescription>
              Renseignez les informations du compteur d'énergie
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Type de compteur */}
            <div className="space-y-2">
              <Label>Type de compteur *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as any })}
                disabled={!!editingMeter}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METER_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn("w-4 h-4", config.color)} />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Numéro de compteur */}
            <div className="space-y-2">
              <Label htmlFor="serial">Numéro de compteur (PDL/PCE) *</Label>
              <Input
                id="serial"
                placeholder="Ex: 09235678901234"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Pour Linky: 14 chiffres (PDL) • Pour Gazpar: 14 chiffres (PCE)
              </p>
            </div>

            {/* Fournisseur */}
            <div className="space-y-2">
              <Label>Fournisseur / Gestionnaire</Label>
              <Select
                value={formData.provider}
                onValueChange={(value) => setFormData({ ...formData, provider: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {METER_CONFIG[formData.type]?.providers.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Emplacement */}
            <div className="space-y-2">
              <Label htmlFor="location">Emplacement</Label>
              <Input
                id="location"
                placeholder="Ex: Entrée, Cuisine, Cellier..."
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {editingMeter ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

