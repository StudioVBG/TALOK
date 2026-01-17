"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  RefreshCw,
  Calendar,
  Euro,
  TrendingUp,
  FileText,
  CheckCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Info,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";

interface LeaseRenewalWizardProps {
  leaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newLeaseId: string) => void;
}

interface RenewalData {
  current_lease: {
    id: string;
    type_bail: string;
    loyer: number;
    charges: number;
    depot: number;
    date_fin: string;
    statut: string;
    property_address: string;
  };
  suggestions: {
    new_loyer: number;
    loyer_increase: number;
    loyer_increase_percent: string;
    start_date: string;
    end_date: string;
    duration_months: number;
  };
  can_renew: boolean;
  reason: string | null;
}

export function LeaseRenewalWizard({
  leaseId,
  open,
  onOpenChange,
  onSuccess,
}: LeaseRenewalWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<RenewalData | null>(null);

  // Form state
  const [applyIrl, setApplyIrl] = useState(true);
  const [newLoyer, setNewLoyer] = useState<number>(0);
  const [newCharges, setNewCharges] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>("");
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [notes, setNotes] = useState<string>("");

  // Charger les données de renouvellement
  useEffect(() => {
    if (open && leaseId) {
      loadRenewalData();
    }
  }, [open, leaseId]);

  const loadRenewalData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/renew`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur chargement données");
      }

      const result: RenewalData = await response.json();
      setData(result);

      // Initialiser le formulaire avec les suggestions
      setNewLoyer(result.suggestions.new_loyer);
      setNewCharges(result.current_lease.charges);
      setStartDate(result.suggestions.start_date);
      setDurationMonths(result.suggestions.duration_months);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger les données",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  // Calculer la date de fin
  const calculateEndDate = () => {
    if (!startDate) return "";
    const start = new Date(startDate);
    start.setMonth(start.getMonth() + durationMonths);
    return start.toISOString().split("T")[0];
  };

  // Soumettre le renouvellement
  const handleSubmit = async () => {
    if (!data) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_loyer: applyIrl ? undefined : newLoyer,
          new_charges: newCharges,
          new_date_debut: startDate,
          duration_months: durationMonths,
          notes,
          apply_irl: applyIrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors du renouvellement");
      }

      const result = await response.json();

      toast({
        title: "Bail renouvelé !",
        description: "Le nouveau bail a été créé avec succès",
      });

      onSuccess?.(result.new_lease.id);
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de renouveler le bail",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Récapitulatif du bail actuel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Bail actuel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Adresse</span>
            <span className="font-medium">{data?.current_lease.property_address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type de bail</span>
            <span className="font-medium capitalize">{data?.current_lease.type_bail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Loyer actuel</span>
            <span className="font-medium">{formatCurrency(data?.current_lease.loyer || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date de fin</span>
            <span className="font-medium">
              {data?.current_lease.date_fin
                ? new Date(data.current_lease.date_fin).toLocaleDateString("fr-FR")
                : "Non définie"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Révision du loyer */}
      <Card className="border-blue-100 bg-blue-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Révision du loyer
          </CardTitle>
          <CardDescription>
            Ajustez le loyer selon l'IRL ou définissez un montant personnalisé
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Appliquer l'IRL automatiquement</Label>
              <p className="text-xs text-muted-foreground">
                Augmentation suggérée : {data?.suggestions.loyer_increase_percent}
              </p>
            </div>
            <Switch
              checked={applyIrl}
              onCheckedChange={setApplyIrl}
            />
          </div>

          {!applyIrl && (
            <div className="space-y-2">
              <Label htmlFor="newLoyer">Nouveau loyer (€)</Label>
              <Input
                id="newLoyer"
                type="number"
                step="0.01"
                value={newLoyer}
                onChange={(e) => setNewLoyer(parseFloat(e.target.value) || 0)}
              />
              {newLoyer > data!.current_lease.loyer && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Augmentation de {formatCurrency(newLoyer - data!.current_lease.loyer)} 
                  ({((newLoyer - data!.current_lease.loyer) / data!.current_lease.loyer * 100).toFixed(1)}%)
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newCharges">Charges (€)</Label>
            <Input
              id="newCharges"
              type="number"
              step="0.01"
              value={newCharges}
              onChange={(e) => setNewCharges(parseFloat(e.target.value) || 0)}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Durée et dates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Durée du renouvellement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Date de début</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Durée (mois)</Label>
            <div className="flex gap-2">
              {[12, 24, 36].map((months) => (
                <Button
                  key={months}
                  type="button"
                  variant={durationMonths === months ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDurationMonths(months)}
                >
                  {months / 12} an{months > 12 ? "s" : ""}
                </Button>
              ))}
              <Input
                id="duration"
                type="number"
                className="w-20"
                value={durationMonths}
                onChange={(e) => setDurationMonths(parseInt(e.target.value) || 12)}
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-muted-foreground">Date de fin calculée</p>
            <p className="font-medium">
              {calculateEndDate()
                ? new Date(calculateEndDate()).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optionnel)</Label>
        <Textarea
          id="notes"
          placeholder="Raisons du renouvellement, modifications particulières..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold">Confirmer le renouvellement</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Vérifiez les informations avant de valider
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Nouveau loyer</p>
              <p className="font-semibold text-lg">
                {formatCurrency(applyIrl ? (data?.suggestions.new_loyer || 0) : newLoyer)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Charges</p>
              <p className="font-semibold text-lg">{formatCurrency(newCharges)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date de début</p>
              <p className="font-medium">
                {startDate
                  ? new Date(startDate).toLocaleDateString("fr-FR")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Date de fin</p>
              <p className="font-medium">
                {calculateEndDate()
                  ? new Date(calculateEndDate()).toLocaleDateString("fr-FR")
                  : "-"}
              </p>
            </div>
          </div>

          {applyIrl && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                L'IRL sera appliqué automatiquement
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
        <p className="text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          Un nouveau bail en brouillon sera créé. Il devra être signé par toutes les parties.
        </p>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (data && !data.can_renew) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Renouvellement impossible
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">{data.reason}</p>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Renouveler le bail
          </DialogTitle>
          <DialogDescription>
            Étape {step} sur 3
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-blue-600" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="py-4">
          <AnimatePresence mode="wait">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => (step > 1 ? setStep(step - 1) : onOpenChange(false))}
            disabled={submitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step > 1 ? "Précédent" : "Annuler"}
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>
              Suivant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renouvellement...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmer
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LeaseRenewalWizard;

