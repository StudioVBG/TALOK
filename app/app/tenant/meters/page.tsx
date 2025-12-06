"use client";

/**
 * Page Compteurs - Espace Locataire
 * 
 * Permet au locataire de :
 * - Voir ses compteurs
 * - Effectuer des relevés mensuels
 * - Voir l'historique des relevés
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Gauge,
  Plus,
  Zap,
  Droplets,
  Flame,
  Calendar,
  Camera,
  History,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ImagePlus,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// ============================================
// TYPES
// ============================================

interface Meter {
  id: string;
  property_id: string;
  type: "electricity" | "gas" | "water" | "heating";
  serial_number: string;
  location?: string | null;
  provider?: string | null;
  unit: string;
  is_active: boolean;
  last_reading?: {
    value: number;
    date: string;
  } | null;
}

interface MeterReading {
  id: string;
  meter_id: string;
  value: number;
  reading_date: string;
  photo_url?: string | null;
  recorded_by: string;
  created_at: string;
}

// ============================================
// CONSTANTES
// ============================================

const meterConfig: Record<string, { 
  label: string; 
  icon: React.ElementType; 
  color: string; 
  bgColor: string;
}> = {
  electricity: { 
    label: "Électricité", 
    icon: Zap, 
    color: "text-yellow-600", 
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30" 
  },
  gas: { 
    label: "Gaz", 
    icon: Flame, 
    color: "text-orange-600", 
    bgColor: "bg-orange-100 dark:bg-orange-900/30" 
  },
  water: { 
    label: "Eau", 
    icon: Droplets, 
    color: "text-blue-600", 
    bgColor: "bg-blue-100 dark:bg-blue-900/30" 
  },
  heating: { 
    label: "Chauffage", 
    icon: Flame, 
    color: "text-red-600", 
    bgColor: "bg-red-100 dark:bg-red-900/30" 
  },
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function TenantMetersPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // États
  const [meters, setMeters] = useState<Meter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<Meter | null>(null);
  const [newReading, setNewReading] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [readingHistory, setReadingHistory] = useState<MeterReading[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ============================================
  // FETCH DES DONNÉES
  // ============================================

  const fetchMeters = async () => {
    setIsLoading(true);
    try {
      // Récupérer d'abord le bail actif du locataire
      const leaseResponse = await fetch("/api/tenant/lease");
      if (!leaseResponse.ok) {
        throw new Error("Impossible de récupérer votre bail");
      }
      const leaseData = await leaseResponse.json();
      
      if (!leaseData.lease?.property_id) {
        setMeters([]);
        return;
      }

      // Récupérer les compteurs du logement
      const metersResponse = await fetch(`/api/properties/${leaseData.lease.property_id}/meters`);
      if (!metersResponse.ok) {
        throw new Error("Impossible de récupérer les compteurs");
      }
      const metersData = await metersResponse.json();
      
      setMeters(metersData.meters || []);
    } catch (error: any) {
      console.error("Erreur chargement compteurs:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les compteurs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeters();
  }, []);

  // ============================================
  // HANDLERS
  // ============================================

  const handleOpenReadingDialog = (meter: Meter) => {
    setSelectedMeter(meter);
    setNewReading("");
    setPhotoPreview(null);
    setPhotoFile(null);
    setIsDialogOpen(true);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La photo ne doit pas dépasser 10 MB",
        variant: "destructive",
      });
      return;
    }

    setPhotoFile(file);
    
    // Prévisualisation
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReading = async () => {
    if (!selectedMeter || !newReading) return;

    const readingValue = parseFloat(newReading);
    if (isNaN(readingValue) || readingValue < 0) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une valeur valide",
        variant: "destructive",
      });
      return;
    }

    // Vérifier que la valeur est supérieure au dernier relevé
    if (selectedMeter.last_reading && readingValue < selectedMeter.last_reading.value) {
      const confirmLower = window.confirm(
        `La valeur saisie (${readingValue}) est inférieure au dernier relevé (${selectedMeter.last_reading.value}). Êtes-vous sûr ?`
      );
      if (!confirmLower) return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reading_value", readingValue.toString());
      formData.append("reading_date", new Date().toISOString().split("T")[0]);
      
      if (photoFile) {
        formData.append("photo", photoFile);
      }

      const response = await fetch(`/api/meters/${selectedMeter.id}/readings`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }

      toast({
        title: "Relevé enregistré",
        description: `Valeur: ${readingValue.toLocaleString("fr-FR")} ${selectedMeter.unit}`,
      });

      setIsDialogOpen(false);
      fetchMeters(); // Rafraîchir

    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowHistory = async (meter: Meter) => {
    setSelectedMeter(meter);
    setHistoryLoading(true);
    setShowHistory(true);

    try {
      const response = await fetch(`/api/meters/${meter.id}/history`);
      const data = await response.json();

      if (response.ok) {
        setReadingHistory(data.readings || []);
      } else {
        throw new Error(data.error || "Erreur");
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compteurs</h1>
          <p className="text-muted-foreground">
            Suivez et relevez vos compteurs d&apos;énergie
          </p>
        </div>
      </motion.div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : meters.length === 0 ? (
        /* Empty state */
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-16 text-center">
              <Gauge className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun compteur</h3>
              <p className="text-muted-foreground">
                Aucun compteur n&apos;est associé à votre logement.
                <br />
                Contactez votre propriétaire pour les ajouter.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Alert for upcoming reading */}
          <motion.div variants={itemVariants}>
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                      Relevé mensuel
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Pensez à relever vos compteurs régulièrement pour un suivi précis 
                      de votre consommation et une facturation juste.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Meters Grid */}
          <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {meters.filter(m => m.is_active).map((meter) => {
              const config = meterConfig[meter.type] || meterConfig.electricity;
              const Icon = config.icon;

              return (
                <motion.div key={meter.id} variants={itemVariants}>
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-3 rounded-xl", config.bgColor)}>
                            <Icon className={cn("h-6 w-6", config.color)} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{config.label}</CardTitle>
                            <CardDescription className="text-xs">
                              {meter.serial_number}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Actif
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm text-muted-foreground">Dernier relevé</span>
                          {meter.last_reading ? (
                            <span className="text-2xl font-bold">
                              {meter.last_reading.value.toLocaleString("fr-FR")}
                              <span className="text-sm font-normal text-muted-foreground ml-1">
                                {meter.unit}
                              </span>
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">
                              Aucun relevé
                            </span>
                          )}
                        </div>
                        {meter.last_reading && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {new Date(meter.last_reading.date).toLocaleDateString("fr-FR")}
                          </div>
                        )}
                      </div>

                      {meter.location && (
                        <p className="text-xs text-muted-foreground">
                          📍 {meter.location}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => handleOpenReadingDialog(meter)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Nouveau relevé
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => handleShowHistory(meter)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </>
      )}

      {/* Dialog for new reading */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMeter && (
                <>
                  {(() => {
                    const config = meterConfig[selectedMeter.type] || meterConfig.electricity;
                    const Icon = config.icon;
                    return <Icon className={cn("w-5 h-5", config.color)} />;
                  })()}
                  Nouveau relevé - {meterConfig[selectedMeter?.type || "electricity"]?.label}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedMeter && `Compteur n° ${selectedMeter.serial_number}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Zone photo */}
            <div className="space-y-2">
              <Label>Photo du compteur (recommandé)</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors",
                  photoPreview
                    ? "border-green-300 bg-green-50 dark:bg-green-950/20"
                    : "border-gray-300 hover:border-gray-400 dark:border-gray-700"
                )}
              >
                {photoPreview ? (
                  <>
                    <img
                      src={photoPreview}
                      alt="Photo du compteur"
                      className="w-full h-full object-contain rounded-lg"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoPreview(null);
                        setPhotoFile(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <ImagePlus className="w-10 h-10 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      Prendre une photo
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            {/* Valeur du relevé */}
            <div className="space-y-2">
              <Label htmlFor="reading">Index actuel ({selectedMeter?.unit}) *</Label>
              <Input
                id="reading"
                type="number"
                step="0.01"
                placeholder={
                  selectedMeter?.last_reading 
                    ? `Dernier: ${selectedMeter.last_reading.value}`
                    : "Ex: 12456"
                }
                value={newReading}
                onChange={(e) => setNewReading(e.target.value)}
                className="text-lg"
              />
              {selectedMeter?.last_reading && (
                <p className="text-sm text-muted-foreground">
                  Dernier relevé : {selectedMeter.last_reading.value.toLocaleString("fr-FR")} {selectedMeter.unit}
                  {" "}le {new Date(selectedMeter.last_reading.date).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmitReading} 
              disabled={!newReading || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Historique */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Historique des relevés
            </DialogTitle>
            <DialogDescription>
              {selectedMeter && meterConfig[selectedMeter.type]?.label} - {selectedMeter?.serial_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[400px] overflow-y-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : readingHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun historique disponible
              </div>
            ) : (
              <div className="space-y-3">
                {readingHistory.map((reading, index) => (
                  <div 
                    key={reading.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                  >
                    <div>
                      <p className="font-medium">
                        {reading.value.toLocaleString("fr-FR")} {selectedMeter?.unit}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(reading.reading_date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    {index < readingHistory.length - 1 && (
                      <Badge variant="secondary" className="text-xs">
                        +{(reading.value - readingHistory[index + 1].value).toLocaleString("fr-FR")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
