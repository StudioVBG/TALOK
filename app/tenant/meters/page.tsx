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

const meterConfig: Record<string, { 
  label: string; 
  icon: any; 
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

  const fetchMeters = async () => {
    setIsLoading(true);
    try {
      const leaseResponse = await fetch("/api/tenant/lease");
      const leaseData = await leaseResponse.json();
      if (!leaseData.lease?.property_id) {
        setMeters([]);
        return;
      }
      const metersResponse = await fetch(`/api/properties/${leaseData.lease.property_id}/meters`);
      const metersData = await metersResponse.json();
      setMeters(metersData.meters || []);
    } catch (error: unknown) {
      console.error("Erreur chargement compteurs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchMeters(); }, []);

  const handleOpenReadingDialog = (meter: Meter) => {
    setSelectedMeter(meter);
    setNewReading("");
    setPhotoPreview(null);
    setPhotoFile(null);
    setIsDialogOpen(true);
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

  const handleSubmitReading = async () => {
    if (!selectedMeter || !newReading) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reading_value", newReading);
      formData.append("reading_date", new Date().toISOString());
      if (photoFile) formData.append("photo", photoFile);

      const response = await fetch(`/api/meters/${selectedMeter.id}/readings`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast({ title: "Relevé enregistré", description: "Votre consommation a été mise à jour." });
        setIsDialogOpen(false);
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
      const response = await fetch(`/api/meters/${meter.id}/history`);
      const data = await response.json();
      setReadingHistory(data.readings || []);
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
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mes Compteurs</h1>
            </div>
            <p className="text-slate-500 text-lg">
              Suivi mensuel et index de consommation.
            </p>
          </motion.div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Colonne Gauche : Liste des Compteurs - 8/12 */}
            <div className="lg:col-span-8 space-y-6">
              {meters.length === 0 ? (
                <GlassCard className="p-12 text-center border-slate-200">
                  <Gauge className="h-16 w-16 mx-auto text-slate-200 mb-4" />
                  <h3 className="text-xl font-bold">Aucun compteur configuré</h3>
                  <p className="text-slate-500 mt-2">Contactez votre propriétaire pour ajouter vos compteurs d'énergie.</p>
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
                        <GlassCard className="group hover:shadow-2xl hover:border-amber-200 transition-all duration-300 border-slate-200 bg-white p-6">
                          <div className="flex items-start justify-between mb-6">
                            <div className={cn("p-4 rounded-2xl shadow-inner transition-transform group-hover:scale-110", config.bgColor)}>
                              <Icon className={cn("h-8 w-8", config.color)} />
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.1em] mb-1">
                                {config.label}
                              </Badge>
                              <p className="text-[10px] text-slate-400 font-mono">{meter.serial_number}</p>
                            </div>
                          </div>

                          <div className="space-y-4 mb-8">
                            <div className="flex items-baseline justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                              <span className="text-xs font-bold text-slate-400 uppercase">Dernier index</span>
                              <div className="text-right">
                                <span className="text-3xl font-black text-slate-900">
                                  {meter.last_reading?.value.toLocaleString("fr-FR") || "—"}
                                </span>
                                <span className="text-sm font-bold text-slate-400 ml-1">{meter.unit}</span>
                              </div>
                            </div>
                            {meter.last_reading && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1.5 px-1 font-bold uppercase tracking-wider">
                                <Calendar className="h-3 w-3" />
                                Relevé le {new Date(meter.last_reading.date).toLocaleDateString("fr-FR")}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              onClick={() => handleOpenReadingDialog(meter)}
                              className="flex-1 h-12 bg-slate-900 hover:bg-black text-white font-bold shadow-lg shadow-slate-200 rounded-xl"
                            >
                              <Plus className="h-4 w-4 mr-2" /> Nouveau relevé
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon"
                              className="h-12 w-12 rounded-xl border-slate-200 hover:bg-slate-50"
                              onClick={() => handleShowHistory(meter)}
                            >
                              <History className="h-5 w-5 text-slate-400" />
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
                      <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/20 border-white/30 text-white backdrop-blur-md font-bold">
                        Voir les éco-gestes
                      </Button>
                    </div>
                  </div>
                  <div className="absolute -right-10 -bottom-10 h-40 w-40 bg-white/5 rounded-full blur-3xl" />
                </GlassCard>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <GlassCard className="p-6 border-slate-200 bg-amber-50/50">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-amber-900">Conseil Linky & Gazpar</p>
                      <p className="text-xs text-amber-800 leading-relaxed">
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
                  photoPreview ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:bg-slate-50 bg-slate-50/50"
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
                    <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <Camera className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-500">Ajouter une photo</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Preuve visuelle requise</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" capture="environment" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Nouvel index ({selectedMeter?.unit})</Label>
                <Input 
                  type="number" 
                  value={newReading}
                  onChange={(e) => setNewReading(e.target.value)}
                  placeholder={`Dernier : ${selectedMeter?.last_reading?.value || "0"}`}
                  className="h-14 text-2xl font-black rounded-2xl border-slate-200 focus:ring-amber-500"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold">Annuler</Button>
              <Button 
                onClick={handleSubmitReading} 
                disabled={!newReading || isSubmitting}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 rounded-xl px-8 shadow-lg shadow-amber-100"
              >
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Historique */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="sm:max-w-lg rounded-3xl border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Historique des relevés</DialogTitle>
            </DialogHeader>
            
            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 py-4">
              {historyLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-slate-200" /></div>
              ) : readingHistory.map((reading, idx) => (
                <div key={reading.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-xl font-black text-slate-900">{reading.value.toLocaleString("fr-FR")} <span className="text-xs font-bold text-slate-400">{selectedMeter?.unit}</span></p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{formatDateShort(reading.reading_date)}</p>
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
