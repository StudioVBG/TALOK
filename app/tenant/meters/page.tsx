"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Gauge,
  Plus,
  Zap,
  Droplet,
  Flame,
  Calendar,
  Camera,
  History,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ImagePlus,
  X,
  TrendingUp,
  ChevronRight,
  Info
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDateShort } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { logger } from "@/lib/monitoring";
import { metersService } from "@/features/tenant/services/meters.service";

// Types
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

interface ConsumptionEstimate {
  id: string;
  meter_id: string;
  period_start: string;
  period_end: string;
  estimated_value: number;
  actual_value?: number | null;
  unit: string;
}

import type { LucideIcon } from "lucide-react";

const meterConfig: Record<string, { 
  label: string; 
  icon: LucideIcon; 
  color: string; 
  bgColor: string;
  gradient: string;
}> = {
  electricity: { 
    label: "Électricité", 
    icon: Zap, 
    color: "text-amber-600", 
    bgColor: "bg-amber-50",
    gradient: "from-amber-500 to-orange-600"
  },
  gas: { 
    label: "Gaz", 
    icon: Flame, 
    color: "text-orange-600", 
    bgColor: "bg-orange-50",
    gradient: "from-orange-500 to-red-600"
  },
  water: { 
    label: "Eau", 
    icon: Droplet, 
    color: "text-blue-600", 
    bgColor: "bg-blue-50",
    gradient: "from-blue-500 to-indigo-600"
  },
  heating: { 
    label: "Chauffage", 
    icon: Flame, 
    color: "text-red-600", 
    bgColor: "bg-red-50",
    gradient: "from-red-500 to-rose-600"
  },
};

export default function TenantMetersPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [estimates, setEstimates] = useState<ConsumptionEstimate[]>([]);
  const [lastThreeReadings, setLastThreeReadings] = useState<MeterReading[]>([]);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitPayload, setSubmitPayload] = useState<{ value: number; overConsumption?: boolean } | null>(null);

  const fetchMeters = async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const leaseResponse = await fetch("/api/tenant/lease", { signal });
      if (!leaseResponse.ok) {
        setMeters([]);
        return;
      }
      const leaseData = await leaseResponse.json();
      const leaseId = leaseData.lease?.id;
      if (!leaseId) {
        setMeters([]);
        return;
      }
      const metersList = await metersService.getMeters(leaseId);
      const metersWithLastReading: Meter[] = await Promise.all(
        metersList.map(async (m) => {
          const readings = await metersService.getMeterReadings(m.id, 1);
          const last = readings[0];
          return {
            id: m.id,
            property_id: m.property_id ?? undefined,
            type: (m.type || "electricity") as Meter["type"],
            serial_number: m.meter_number ?? m.id.slice(0, 8),
            location: null,
            provider: m.provider ?? null,
            unit: m.unit,
            is_active: m.is_connected,
            last_reading: last
              ? { value: last.reading_value, date: last.reading_date }
              : null,
          };
        })
      );
      setMeters(metersWithLastReading);

      const meterIds = metersList.map((m) => m.id);
      if (meterIds.length > 0) {
        try {
          const allEstimates: ConsumptionEstimate[] = [];
          const estResponses = await Promise.allSettled(
            meterIds.map((id: string) => metersService.getConsumptionEstimates(id))
          );
          for (const r of estResponses) {
            if (r.status === "fulfilled" && Array.isArray(r.value)) {
              allEstimates.push(
                ...r.value.map((e) => ({
                  id: e.id,
                  meter_id: e.meter_id,
                  period_start: e.period_start,
                  period_end: e.period_end,
                  estimated_value: e.estimated_consumption,
                  actual_value: null,
                  unit: "kwh" as const,
                }))
              );
            }
          }
          setEstimates(allEstimates);
        } catch {
          // Non bloquant
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") return;
      logger.error("Erreur chargement compteurs", { error: error instanceof Error ? error : String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchMeters(controller.signal);
    return () => controller.abort();
  }, []);

  const handleOpenReadingDialog = async (meter: Meter) => {
    setSelectedMeter(meter);
    setNewReading("");
    setPhotoPreview(null);
    setPhotoFile(null);
    setLastThreeReadings([]);
    setIsDialogOpen(true);
    try {
      const readings = await metersService.getMeterReadings(meter.id, 12);
      setLastThreeReadings(
        readings.slice(0, 3).map((r) => ({
          id: r.id,
          meter_id: r.meter_id,
          value: r.reading_value,
          reading_date: r.reading_date,
          photo_url: r.photo_url,
          recorded_by: r.created_by ?? "",
          created_at: r.created_at,
        }))
      );
    } catch {
      // optionnel
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setPhotoPreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRequestSubmitReading = () => {
    if (!selectedMeter || !newReading) return;
    const value = Number(newReading.replace(/\s/g, "").replace(",", "."));
    if (Number.isNaN(value)) {
      toast({ title: "Valeur invalide", description: "Saisissez un nombre valide.", variant: "destructive" });
      return;
    }
    const lastVal = selectedMeter.last_reading?.value;
    if (lastVal != null && value <= lastVal) {
      toast({
        title: "Relevé invalide",
        description: "Le nouvel index doit être supérieur au dernier relevé.",
        variant: "destructive",
      });
      return;
    }
    const avg =
      lastThreeReadings.length >= 1
        ? lastThreeReadings.reduce((s, r) => s + r.value, 0) / lastThreeReadings.length
        : null;
    const overConsumption = avg != null && value > avg * 1.3;
    setSubmitPayload({ value, overConsumption });
    setConfirmSubmitOpen(true);
  };

  const handleConfirmSubmitReading = async () => {
    if (!selectedMeter || !submitPayload) return;
    setConfirmSubmitOpen(false);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reading_value", String(submitPayload.value));
      formData.append("reading_date", new Date().toISOString());
      if (photoFile) formData.append("photo", photoFile);

      const response = await fetch(`/api/meters/${selectedMeter.id}/readings`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast({ title: "Relevé enregistré", description: "Votre consommation a été mise à jour." });
        setIsDialogOpen(false);
        setSubmitPayload(null);
        fetchMeters();
      }
    } catch (error: unknown) {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le relevé.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowHistory = async (meter: Meter) => {
    setSelectedMeter(meter);
    setHistoryLoading(true);
    setShowHistory(true);
    try {
      const readings = await metersService.getMeterReadings(meter.id, 24);
      setReadingHistory(
        readings.map((r) => ({
          id: r.id,
          meter_id: r.meter_id,
          value: r.reading_value,
          reading_date: r.reading_date,
          photo_url: r.photo_url,
          recorded_by: r.created_by ?? "",
          created_at: r.created_at,
        }))
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500 rounded-lg shadow-lg shadow-amber-200">
                <Gauge className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Mes Compteurs</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Suivi mensuel et index de consommation.
            </p>
          </motion.div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div role="status" aria-label="Chargement des compteurs">
              <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
              <span className="sr-only">Chargement en cours…</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Colonne Gauche : Liste des Compteurs - 8/12 */}
            <div className="lg:col-span-8 space-y-6">
              {meters.length === 0 ? (
                <GlassCard className="p-12 text-center border-border">
                  <div className="h-20 w-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Gauge className="h-10 w-10 text-amber-400 dark:text-amber-500" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Aucun compteur configuré</h3>
                  <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                    Les relevés de compteurs seront disponibles dès que votre propriétaire les aura ajoutés à votre logement.
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-4 italic">
                    Eau, électricité, gaz — tout sera suivi ici automatiquement.
                  </p>
                </GlassCard>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {meters.map((meter, index) => {
                    const config = meterConfig[meter.type] || meterConfig.electricity;
                    const Icon = config.icon;
                    return (
                      <motion.div 
                        key={meter.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <GlassCard className="group hover:shadow-2xl hover:border-amber-200 dark:hover:border-amber-800 transition-all duration-300 border-border bg-card p-6">
                          <div className="flex items-start justify-between mb-6">
                            <div className={cn("p-4 rounded-2xl shadow-inner transition-transform group-hover:scale-110", config.bgColor)}>
                              <Icon className={cn("h-8 w-8", config.color)} />
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="bg-muted text-[10px] font-black uppercase tracking-[0.1em] mb-1">
                                {config.label}
                              </Badge>
                              <p className="text-[10px] text-muted-foreground font-mono">{meter.serial_number}</p>
                            </div>
                          </div>

                          <div className="space-y-4 mb-8">
                            <div className="flex items-baseline justify-between p-4 rounded-2xl bg-muted border border-border">
                              <span className="text-xs font-bold text-muted-foreground uppercase">Dernier index</span>
                              <div className="text-right">
                                <span className="text-3xl font-black text-foreground">
                                  {meter.last_reading?.value.toLocaleString("fr-FR") || "—"}
                                </span>
                                <span className="text-sm font-bold text-muted-foreground ml-1">{meter.unit}</span>
                              </div>
                            </div>
                            {meter.last_reading && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 px-1 font-bold uppercase tracking-wider">
                                <Calendar className="h-3 w-3" />
                                Relevé le {new Date(meter.last_reading.date).toLocaleDateString("fr-FR")}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              onClick={() => handleOpenReadingDialog(meter)}
                              className="flex-1 h-12 bg-foreground hover:bg-foreground/90 text-background font-bold shadow-lg rounded-xl"
                            >
                              <Plus className="h-4 w-4 mr-2" /> Nouveau relevé
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon"
                              className="h-12 w-12 rounded-xl border-border hover:bg-muted"
                              onClick={() => handleShowHistory(meter)}
                            >
                              <History className="h-5 w-5 text-muted-foreground" />
                            </Button>
                          </div>
                        </GlassCard>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Colonne Droite : Tips & Analytics - 4/12 */}
            <div className="lg:col-span-4 space-y-6">
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <GlassCard className="p-6 border-none bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-2xl relative overflow-hidden">
                  <div className="relative z-10 space-y-4">
                    <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold">Consommation Responsable</h3>
                    <p className="text-white/70 text-sm leading-relaxed">
                      Effectuez un relevé tous les 1ers du mois pour identifier les fuites d'eau ou les surconsommations électriques.
                    </p>
                    <div className="pt-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block">
                              <Button variant="secondary" disabled className="w-full bg-white/10 border-white/30 text-white backdrop-blur-md font-bold opacity-70 cursor-not-allowed">
                                Voir les éco-gestes
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Bientôt disponible</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div className="absolute -right-10 -bottom-10 h-40 w-40 bg-white/5 rounded-full blur-3xl" />
                </GlassCard>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <GlassCard className="p-6 border-border bg-amber-50/50 dark:bg-amber-900/10">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Conseil Linky & Gazpar</p>
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        Pour un relevé certifié, prenez une photo nette de l'index. Nos algorithmes comparent automatiquement les chiffres pour éviter les erreurs de saisie.
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </div>

          </div>
        )}

        {/* Dialog Nouveau Relevé */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Nouveau Relevé</DialogTitle>
              <DialogDescription className="font-medium">
                {selectedMeter && `${meterConfig[selectedMeter.type]?.label} - N°${selectedMeter.serial_number}`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300",
                  photoPreview ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-border hover:bg-muted bg-muted/50"
                )}
              >
                {photoPreview ? (
                  <div className="relative w-full h-full p-2">
                    <img src={photoPreview} className="w-full h-full object-cover rounded-2xl" alt="Preview" />
                    <Button 
                      onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); }}
                      className="absolute top-4 right-4 h-8 w-8 rounded-full bg-red-500 p-0 hover:bg-red-600 shadow-xl"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="h-12 w-12 bg-card rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground">Ajouter une photo</p>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-black">Preuve visuelle requise</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" capture="environment" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nouvel index ({selectedMeter?.unit})</Label>
                <Input 
                  type="number" 
                  value={newReading}
                  onChange={(e) => setNewReading(e.target.value)}
                  placeholder={`Dernier : ${selectedMeter?.last_reading?.value || "0"}`}
                  className="h-14 text-2xl font-black rounded-2xl border-border focus:ring-amber-500"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold">Annuler</Button>
              <Button 
                onClick={handleRequestSubmitReading} 
                disabled={!newReading || isSubmitting}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 rounded-xl px-8 shadow-lg shadow-amber-100"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmation avant soumission */}
        <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Confirmer le relevé</DialogTitle>
              <DialogDescription>
                {submitPayload?.overConsumption ? (
                  <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    Ce relevé est nettement au-dessus de votre moyenne. Souhaitez-vous tout de même l&apos;enregistrer ?
                  </span>
                ) : (
                  "Êtes-vous sûr de vouloir enregistrer ce relevé ?"
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => { setConfirmSubmitOpen(false); setSubmitPayload(null); }} className="rounded-xl font-bold">Annuler</Button>
              <Button onClick={handleConfirmSubmitReading} className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl px-6">
                Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Historique */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="sm:max-w-lg rounded-3xl border-none shadow-2xl" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Historique des relevés</DialogTitle>
            </DialogHeader>
            
            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 py-4">
              {historyLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground/30" /></div>
              ) : readingHistory.map((reading, idx) => (
                <div key={reading.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted border border-border">
                  <div>
                    <p className="text-xl font-black text-foreground">{reading.value.toLocaleString("fr-FR")} <span className="text-xs font-bold text-muted-foreground">{selectedMeter?.unit}</span></p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{formatDateShort(reading.reading_date)}</p>
                  </div>
                  {idx < readingHistory.length - 1 && (
                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold">
                      +{ (reading.value - readingHistory[idx+1].value).toLocaleString("fr-FR") }
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </PageTransition>
  );
}
