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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  Wallet,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Euro,
  Home,
  FileText,
  MinusCircle,
  PlusCircle,
  Calculator,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";

interface DepositRefundWizardProps {
  leaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface DeductionItem {
  id: string;
  label: string;
  amount: number;
  description?: string;
}

interface LeaseData {
  id: string;
  deposit: number;
  tenant_name: string;
  property_address: string;
  date_fin: string;
  unpaid_invoices: number;
  damages_estimate: number;
}

const COMMON_DEDUCTIONS = [
  { id: "loyers_impayes", label: "Loyers impayés", defaultAmount: 0 },
  { id: "charges_impayes", label: "Charges impayées", defaultAmount: 0 },
  { id: "reparations_locatives", label: "Réparations locatives", defaultAmount: 0 },
  { id: "nettoyage", label: "Nettoyage", defaultAmount: 150 },
  { id: "dommages", label: "Dommages constatés (EDL)", defaultAmount: 0 },
  { id: "cles_perdues", label: "Clés perdues", defaultAmount: 100 },
];

export function DepositRefundWizard({
  leaseId,
  open,
  onOpenChange,
  onSuccess,
}: DepositRefundWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaseData, setLeaseData] = useState<LeaseData | null>(null);

  // Form state
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);
  const [customDeduction, setCustomDeduction] = useState({ label: "", amount: 0 });
  const [refundMethod, setRefundMethod] = useState<"virement" | "cheque">("virement");
  const [iban, setIban] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmChecks, setConfirmChecks] = useState({
    edl_done: false,
    keys_returned: false,
    final_meter_readings: false,
  });

  // Calculs
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const refundAmount = Math.max(0, (leaseData?.deposit || 0) - totalDeductions);

  // Charger les données du bail
  useEffect(() => {
    if (open && leaseId) {
      loadLeaseData();
    }
  }, [open, leaseId]);

  const loadLeaseData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/deposit/refunds`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur chargement données");
      }

      const result = await response.json();
      setLeaseData(result);

      // Pré-remplir les déductions connues
      const initialDeductions: DeductionItem[] = [];
      
      if (result.unpaid_invoices > 0) {
        initialDeductions.push({
          id: "loyers_impayes",
          label: "Loyers et charges impayés",
          amount: result.unpaid_invoices,
          description: "Montant automatiquement calculé",
        });
      }

      if (result.damages_estimate > 0) {
        initialDeductions.push({
          id: "dommages",
          label: "Dommages constatés (EDL)",
          amount: result.damages_estimate,
          description: "Estimation basée sur l'état des lieux de sortie",
        });
      }

      setDeductions(initialDeductions);
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

  // Ajouter une déduction courante
  const addCommonDeduction = (item: typeof COMMON_DEDUCTIONS[0]) => {
    if (deductions.find(d => d.id === item.id)) {
      // Retirer si déjà présente
      setDeductions(deductions.filter(d => d.id !== item.id));
    } else {
      setDeductions([...deductions, {
        id: item.id,
        label: item.label,
        amount: item.defaultAmount,
      }]);
    }
  };

  // Modifier le montant d'une déduction
  const updateDeductionAmount = (id: string, amount: number) => {
    setDeductions(deductions.map(d =>
      d.id === id ? { ...d, amount } : d
    ));
  };

  // Supprimer une déduction
  const removeDeduction = (id: string) => {
    setDeductions(deductions.filter(d => d.id !== id));
  };

  // Ajouter une déduction personnalisée
  const addCustomDeduction = () => {
    if (!customDeduction.label || customDeduction.amount <= 0) return;
    
    setDeductions([...deductions, {
      id: `custom_${Date.now()}`,
      label: customDeduction.label,
      amount: customDeduction.amount,
    }]);
    setCustomDeduction({ label: "", amount: 0 });
  };

  // Soumettre
  const handleSubmit = async () => {
    if (!leaseData) return;

    // Vérifier les confirmations
    if (!confirmChecks.edl_done || !confirmChecks.keys_returned) {
      toast({
        title: "Confirmation requise",
        description: "Veuillez confirmer toutes les étapes obligatoires",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/deposit/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_deposit: leaseData.deposit,
          deductions: deductions.map(d => ({
            type: d.id,
            label: d.label,
            amount: d.amount,
          })),
          total_deductions: totalDeductions,
          refund_amount: refundAmount,
          refund_method: refundMethod,
          iban: refundMethod === "virement" ? iban : undefined,
          notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors du traitement");
      }

      toast({
        title: "Restitution enregistrée",
        description: refundAmount > 0 
          ? `Le locataire sera remboursé de ${formatCurrency(refundAmount)}`
          : "Les retenues couvrent le dépôt de garantie",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1: Récapitulatif et vérifications
  const renderStep1 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Récap bail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4" />
            Informations du bail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Locataire</span>
            <span className="font-medium">{leaseData?.tenant_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Adresse</span>
            <span className="font-medium">{leaseData?.property_address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dépôt de garantie</span>
            <span className="font-bold text-lg">{formatCurrency(leaseData?.deposit || 0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Vérifications obligatoires
          </CardTitle>
          <CardDescription>
            Avant de procéder à la restitution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="edl"
              checked={confirmChecks.edl_done}
              onCheckedChange={(checked) =>
                setConfirmChecks({ ...confirmChecks, edl_done: !!checked })
              }
            />
            <div>
              <Label htmlFor="edl" className="font-medium">
                État des lieux de sortie effectué
              </Label>
              <p className="text-xs text-muted-foreground">
                L'EDL de sortie a été réalisé et signé par les deux parties
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="keys"
              checked={confirmChecks.keys_returned}
              onCheckedChange={(checked) =>
                setConfirmChecks({ ...confirmChecks, keys_returned: !!checked })
              }
            />
            <div>
              <Label htmlFor="keys" className="font-medium">
                Clés restituées
              </Label>
              <p className="text-xs text-muted-foreground">
                Toutes les clés ont été rendues par le locataire
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="meters"
              checked={confirmChecks.final_meter_readings}
              onCheckedChange={(checked) =>
                setConfirmChecks({ ...confirmChecks, final_meter_readings: !!checked })
              }
            />
            <div>
              <Label htmlFor="meters" className="font-medium">
                Relevés de compteurs finaux
              </Label>
              <p className="text-xs text-muted-foreground">
                Les relevés ont été effectués (optionnel)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Step 2: Retenues
  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Retenues suggérées */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MinusCircle className="h-4 w-4" />
            Retenues sur le dépôt
          </CardTitle>
          <CardDescription>
            Sélectionnez les retenues applicables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {COMMON_DEDUCTIONS.map((item) => {
            const isSelected = deductions.some(d => d.id === item.id);
            const current = deductions.find(d => d.id === item.id);
            
            return (
              <div key={item.id} className="flex items-center gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => addCommonDeduction(item)}
                />
                <span className="flex-1 text-sm">{item.label}</span>
                {isSelected && (
                  <Input
                    type="number"
                    className="w-24"
                    value={current?.amount || 0}
                    onChange={(e) => updateDeductionAmount(item.id, parseFloat(e.target.value) || 0)}
                  />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Retenue personnalisée */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Ajouter une retenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Libellé"
              className="flex-1"
              value={customDeduction.label}
              onChange={(e) => setCustomDeduction({ ...customDeduction, label: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Montant"
              className="w-24"
              value={customDeduction.amount || ""}
              onChange={(e) => setCustomDeduction({ ...customDeduction, amount: parseFloat(e.target.value) || 0 })}
            />
            <Button
              variant="outline"
              onClick={addCustomDeduction}
              disabled={!customDeduction.label || customDeduction.amount <= 0}
            >
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Récap des retenues */}
      {deductions.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="pt-4">
            <div className="space-y-2">
              {deductions.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span>{d.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-red-600">-{formatCurrency(d.amount)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => removeDeduction(d.id)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                <span>Total retenues</span>
                <span className="text-red-600">-{formatCurrency(totalDeductions)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );

  // Step 3: Confirmation
  const renderStep3 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Calcul final */}
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Calcul de la restitution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Dépôt de garantie</span>
            <span className="font-medium">{formatCurrency(leaseData?.deposit || 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Total des retenues</span>
            <span className="font-medium text-red-600">-{formatCurrency(totalDeductions)}</span>
          </div>
          <div className="border-t pt-3 flex justify-between">
            <span className="font-bold">Montant à restituer</span>
            <span className="font-bold text-2xl text-green-600">
              {formatCurrency(refundAmount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Mode de remboursement */}
      {refundAmount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Mode de remboursement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button
                type="button"
                variant={refundMethod === "virement" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setRefundMethod("virement")}
              >
                Virement
              </Button>
              <Button
                type="button"
                variant={refundMethod === "cheque" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setRefundMethod("cheque")}
              >
                Chèque
              </Button>
            </div>

            {refundMethod === "virement" && (
              <div className="space-y-2">
                <Label htmlFor="iban">IBAN du locataire</Label>
                <Input
                  id="iban"
                  placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optionnel)</Label>
        <Textarea
          id="notes"
          placeholder="Remarques sur la restitution..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {/* Avertissement délai légal */}
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
        <p className="text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>Délai légal :</strong> Le dépôt doit être restitué dans un délai de 
            1 mois (si EDL conforme) ou 2 mois (si réserves) après la remise des clés.
          </span>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" />
            Restitution du dépôt de garantie
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
                s <= step ? "bg-green-600" : "bg-slate-200"
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
            <Button 
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && (!confirmChecks.edl_done || !confirmChecks.keys_returned)}
            >
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
                  Traitement...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmer la restitution
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DepositRefundWizard;

