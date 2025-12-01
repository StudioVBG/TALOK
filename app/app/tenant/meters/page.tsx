"use client";
// @ts-nocheck

import { useState } from "react";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Gauge,
  Plus,
  Zap,
  Droplets,
  Flame,
  Calendar,
  TrendingUp,
  Camera,
  History,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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

interface Meter {
  id: string;
  type: "electricite" | "eau" | "gaz";
  numero: string;
  dernierReleve: number;
  dateReleve: string;
  unite: string;
}

// Données fictives pour la démo
const mockMeters: Meter[] = [
  {
    id: "1",
    type: "electricite",
    numero: "EDF-12345678",
    dernierReleve: 45123,
    dateReleve: "2024-01-15",
    unite: "kWh",
  },
  {
    id: "2",
    type: "eau",
    numero: "EAU-87654321",
    dernierReleve: 234,
    dateReleve: "2024-01-15",
    unite: "m³",
  },
  {
    id: "3",
    type: "gaz",
    numero: "GAZ-11223344",
    dernierReleve: 1234,
    dateReleve: "2024-01-10",
    unite: "m³",
  },
];

const meterConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  electricite: { label: "Électricité", icon: Zap, color: "text-yellow-600", bgColor: "bg-yellow-100" },
  eau: { label: "Eau", icon: Droplets, color: "text-blue-600", bgColor: "bg-blue-100" },
  gaz: { label: "Gaz", icon: Flame, color: "text-orange-600", bgColor: "bg-orange-100" },
};

export default function TenantMetersPage() {
  const { toast } = useToast();
  const [meters] = useState<Meter[]>(mockMeters);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<Meter | null>(null);
  const [newReading, setNewReading] = useState("");

  const handleSubmitReading = () => {
    if (!selectedMeter || !newReading) return;

    toast({
      title: "Relevé enregistré",
      description: `Nouveau relevé de ${newReading} ${selectedMeter.unite} pour le compteur ${selectedMeter.numero}`,
    });

    setIsDialogOpen(false);
    setNewReading("");
    setSelectedMeter(null);
  };

  const openReadingDialog = (meter: Meter) => {
    setSelectedMeter(meter);
    setIsDialogOpen(true);
  };

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

      {/* Alert for upcoming reading */}
      <motion.div variants={itemVariants}>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900">Relevé à effectuer</h3>
                <p className="text-sm text-amber-700 mt-1">
                  N&apos;oubliez pas de relever vos compteurs avant la fin du mois pour une facturation précise.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Meters Grid */}
      <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {meters.map((meter) => {
          const config = meterConfig[meter.type];
          const Icon = config.icon;

          return (
            <motion.div key={meter.id} variants={itemVariants}>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${config.bgColor}`}>
                        <Icon className={`h-6 w-6 ${config.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{config.label}</CardTitle>
                        <CardDescription className="text-xs">{meter.numero}</CardDescription>
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
                      <span className="text-2xl font-bold">
                        {meter.dernierReleve.toLocaleString("fr-FR")}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          {meter.unite}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(meter.dateReleve).toLocaleDateString("fr-FR")}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => openReadingDialog(meter)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nouveau relevé
                    </Button>
                    <Button variant="outline" size="icon">
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Empty state if no meters */}
      {meters.length === 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-16 text-center">
              <Gauge className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun compteur</h3>
              <p className="text-muted-foreground">
                Aucun compteur n&apos;est associé à votre logement.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Dialog for new reading */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau relevé</DialogTitle>
            <DialogDescription>
              {selectedMeter && (
                <>
                  Saisissez le relevé pour votre compteur {meterConfig[selectedMeter.type].label.toLowerCase()} ({selectedMeter.numero})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reading">Index actuel ({selectedMeter?.unite})</Label>
              <Input
                id="reading"
                type="number"
                placeholder={`Ex: ${((selectedMeter?.dernierReleve || 0) + 100).toString()}`}
                value={newReading}
                onChange={(e) => setNewReading(e.target.value)}
              />
              {selectedMeter && (
                <p className="text-sm text-muted-foreground">
                  Dernier relevé : {selectedMeter.dernierReleve.toLocaleString("fr-FR")} {selectedMeter.unite}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Photo du compteur (optionnel)</Label>
              <Button variant="outline" className="w-full">
                <Camera className="h-4 w-4 mr-2" />
                Prendre une photo
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmitReading} disabled={!newReading}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

