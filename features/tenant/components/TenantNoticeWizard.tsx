"use client";

/**
 * TenantNoticeWizard - Wizard pour donner congé
 * Processus guidé en 4 étapes conformément à la loi française
 */

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  CalendarOff,
  Home,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Info,
  FileText,
  MapPin,
  Calendar,
  Scale,
  Download,
  Send,
  ShieldCheck,
  Euro,
  Building2,
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

interface TenantNoticeWizardProps {
  leaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface NoticeConditions {
  lease: {
    id: string;
    type_bail: string;
    type_bail_label: string;
    date_debut: string;
    loyer: number;
    charges: number;
    depot_garantie: number;
  };
  property: {
    adresse: string;
    ville: string;
    code_postal: string;
    zone_tendue: boolean;
  };
  owner: {
    prenom: string;
    nom: string;
    email: string;
  } | null;
  tenant: {
    prenom: string;
    nom: string;
    email: string;
  };
  notice_conditions: {
    standard_days: number;
    reduced_days: number;
    can_have_reduced: boolean;
    is_zone_tendue: boolean;
    standard_end_date: string;
    reduced_end_date: string;
    reduced_reasons: string[];
  };
}

const REDUCED_REASON_LABELS: Record<string, string> = {
  mutation_professionnelle: "Mutation professionnelle",
  perte_emploi: "Perte d'emploi",
  nouvel_emploi: "Nouvel emploi consécutif à une perte d'emploi",
  raison_sante: "État de santé justifiant un changement de domicile",
  rsa_beneficiaire: "Bénéficiaire du RSA",
  aah_beneficiaire: "Bénéficiaire de l'AAH",
  zone_tendue: "Logement situé en zone tendue",
  premier_emploi: "Premier emploi",
  violence_conjugale: "Violence conjugale",
};

const STEPS = [
  { id: "info", title: "Informations", icon: Info },
  { id: "preavais", title: "Préavis", icon: Clock },
  { id: "details", title: "Détails", icon: FileText },
  { id: "confirm", title: "Confirmation", icon: CheckCircle2 },
];

export function TenantNoticeWizard({
  leaseId,
  open,
  onOpenChange,
  onSuccess,
}: TenantNoticeWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [conditions, setConditions] = useState<NoticeConditions | null>(null);

  // Form state
  const [wantsReducedNotice, setWantsReducedNotice] = useState(false);
  const [reducedReason, setReducedReason] = useState("");
  const [forwardingAddress, setForwardingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmations, setConfirmations] = useState({
    understand_deposit: false,
    understand_edl: false,
    understand_final: false,
  });

  // Charger les conditions de congé
  useEffect(() => {
    if (open && leaseId) {
      loadConditions();
    }
  }, [open, leaseId]);

  const loadConditions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/notice`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur chargement conditions");
      }
      const data = await response.json();
      setConditions(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger les conditions",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  // Calcul de la date de fin
  const effectiveEndDate = conditions?.notice_conditions
    ? wantsReducedNotice && conditions.notice_conditions.can_have_reduced
      ? conditions.notice_conditions.reduced_end_date
      : conditions.notice_conditions.standard_end_date
    : null;

  const noticeDays = conditions?.notice_conditions
    ? wantsReducedNotice && conditions.notice_conditions.can_have_reduced
      ? conditions.notice_conditions.reduced_days
      : conditions.notice_conditions.standard_days
    : 0;

  // Navigation
  const canProceed = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        if (wantsReducedNotice && conditions?.notice_conditions.can_have_reduced) {
          return !!reducedReason;
        }
        return true;
      case 2:
        return true;
      case 3:
        return confirmations.understand_deposit && confirmations.understand_edl && confirmations.understand_final;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!conditions) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notice_date: new Date().toISOString().split("T")[0],
          end_date: effectiveEndDate,
          reason: wantsReducedNotice ? reducedReason : null,
          reduced_notice: wantsReducedNotice && conditions.notice_conditions.can_have_reduced,
          forwarding_address: forwardingAddress || null,
          notes: notes || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de l'envoi du congé");
      }

      toast({
        title: "✅ Congé enregistré",
        description: `Votre congé a été envoyé. Fin du bail prévue le ${formatDateShort(effectiveEndDate!)}.`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'enregistrer le congé",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(0);
      setWantsReducedNotice(false);
      setReducedReason("");
      setForwardingAddress("");
      setNotes("");
      setConfirmations({
        understand_deposit: false,
        understand_edl: false,
        understand_final: false,
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-amber-100 rounded-xl">
              <CalendarOff className="h-5 w-5 text-amber-600" />
            </div>
            Donner congé
          </DialogTitle>
          <DialogDescription>
            Procédure guidée pour mettre fin à votre bail
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isCompleted = i < step;
            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                    isActive
                      ? "bg-amber-500 border-amber-500 text-white"
                      : isCompleted
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "bg-slate-100 border-slate-200 text-slate-400"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-12 h-1 mx-2 rounded",
                      isCompleted ? "bg-emerald-500" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : conditions ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Étape 1: Informations */}
              {step === 0 && (
                <div className="space-y-6">
                  <Card className="border-amber-200 bg-amber-50/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        Attention - Procédure irréversible
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-amber-800 space-y-2">
                      <p>
                        Donner congé met fin à votre bail de manière définitive. 
                        Une fois le congé validé, vous devrez :
                      </p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Respecter le préavis applicable</li>
                        <li>Continuer à payer le loyer jusqu'à la fin du préavis</li>
                        <li>Réaliser un état des lieux de sortie</li>
                        <li>Remettre les clés au propriétaire</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <Home className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Logement</p>
                            <p className="font-semibold text-sm">{conditions.property.adresse}</p>
                            <p className="text-xs text-muted-foreground">
                              {conditions.property.code_postal} {conditions.property.ville}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <FileText className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Type de bail</p>
                            <p className="font-semibold text-sm">{conditions.lease.type_bail_label}</p>
                            <p className="text-xs text-muted-foreground">
                              Depuis le {formatDateShort(conditions.lease.date_debut)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <Euro className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Loyer mensuel</p>
                            <p className="font-semibold text-sm">
                              {formatCurrency(conditions.lease.loyer + conditions.lease.charges)}
                            </p>
                            <p className="text-xs text-muted-foreground">charges comprises</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <ShieldCheck className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Dépôt de garantie</p>
                            <p className="font-semibold text-sm">
                              {formatCurrency(conditions.lease.depot_garantie)}
                            </p>
                            <p className="text-xs text-muted-foreground">à récupérer</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {conditions.notice_conditions.is_zone_tendue && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <p className="text-sm text-blue-800">
                        Votre logement est situé en <strong>zone tendue</strong>. 
                        Le préavis est automatiquement réduit à 1 mois pour les locations nues.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Étape 2: Préavis */}
              {step === 1 && (
                <div className="space-y-6">
                  <Card className="border-indigo-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-indigo-600" />
                        Durée du préavis
                      </CardTitle>
                      <CardDescription>
                        Le préavis légal pour votre type de bail
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-indigo-50 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-indigo-600 font-medium">Préavis standard</p>
                            <p className="text-3xl font-black text-indigo-700">
                              {conditions.notice_conditions.standard_days} jours
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Date de fin estimée</p>
                            <p className="font-semibold">
                              {formatDateShort(conditions.notice_conditions.standard_end_date)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {conditions.notice_conditions.can_have_reduced && (
                        <>
                          <Separator />
                          
                          <div className="space-y-4">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id="reduced"
                                checked={wantsReducedNotice}
                                onCheckedChange={(checked) => {
                                  setWantsReducedNotice(!!checked);
                                  if (!checked) setReducedReason("");
                                }}
                              />
                              <Label htmlFor="reduced" className="cursor-pointer">
                                Je souhaite bénéficier du préavis réduit ({conditions.notice_conditions.reduced_days} jours)
                              </Label>
                            </div>

                            {wantsReducedNotice && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4"
                              >
                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                  <div className="flex items-start gap-2">
                                    <Scale className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-amber-800">
                                      Le préavis réduit nécessite un <strong>justificatif légal</strong>. 
                                      Vous devrez fournir les documents correspondants à votre propriétaire.
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Motif du préavis réduit *</Label>
                                  <RadioGroup
                                    value={reducedReason}
                                    onValueChange={setReducedReason}
                                    className="grid grid-cols-1 gap-2"
                                  >
                                    {conditions.notice_conditions.reduced_reasons.map((reason) => (
                                      <div
                                        key={reason}
                                        className={cn(
                                          "flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                                          reducedReason === reason
                                            ? "border-indigo-500 bg-indigo-50"
                                            : "border-slate-200 hover:bg-slate-50"
                                        )}
                                        onClick={() => setReducedReason(reason)}
                                      >
                                        <RadioGroupItem value={reason} id={reason} />
                                        <Label htmlFor={reason} className="cursor-pointer flex-1">
                                          {REDUCED_REASON_LABELS[reason] || reason}
                                        </Label>
                                      </div>
                                    ))}
                                  </RadioGroup>
                                </div>

                                {reducedReason && (
                                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-sm text-emerald-600 font-medium">Préavis réduit</p>
                                        <p className="text-3xl font-black text-emerald-700">
                                          {conditions.notice_conditions.reduced_days} jours
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Date de fin estimée</p>
                                        <p className="font-semibold text-emerald-700">
                                          {formatDateShort(conditions.notice_conditions.reduced_end_date)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Étape 3: Détails */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forwarding">
                        <MapPin className="h-4 w-4 inline mr-2" />
                        Nouvelle adresse (optionnel)
                      </Label>
                      <Textarea
                        id="forwarding"
                        placeholder="Votre nouvelle adresse pour la correspondance et la restitution du dépôt de garantie..."
                        value={forwardingAddress}
                        onChange={(e) => setForwardingAddress(e.target.value)}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Cette adresse sera utilisée pour l'envoi du remboursement du dépôt de garantie.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">
                        <FileText className="h-4 w-4 inline mr-2" />
                        Commentaires (optionnel)
                      </Label>
                      <Textarea
                        id="notes"
                        placeholder="Informations complémentaires que vous souhaitez communiquer au propriétaire..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  <Card className="bg-slate-50 border-slate-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-600" />
                        Propriétaire
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {conditions.owner ? (
                        <div className="space-y-1">
                          <p className="font-semibold">
                            {conditions.owner.prenom} {conditions.owner.nom}
                          </p>
                          <p className="text-sm text-muted-foreground">{conditions.owner.email}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Le propriétaire sera automatiquement notifié de votre congé.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Informations propriétaire non disponibles
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Étape 4: Confirmation */}
              {step === 3 && (
                <div className="space-y-6">
                  <Card className="border-2 border-amber-300 bg-amber-50/30">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-amber-600" />
                        Récapitulatif de votre congé
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Logement</p>
                          <p className="font-semibold">{conditions.property.adresse}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Type de bail</p>
                          <p className="font-semibold">{conditions.lease.type_bail_label}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Durée du préavis</p>
                          <p className="font-semibold">{noticeDays} jours</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Date de fin du bail</p>
                          <p className="font-semibold text-amber-700">
                            {effectiveEndDate && formatDateShort(effectiveEndDate)}
                          </p>
                        </div>
                      </div>

                      {wantsReducedNotice && reducedReason && (
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <p className="text-sm">
                            <strong>Préavis réduit :</strong>{" "}
                            {REDUCED_REASON_LABELS[reducedReason]}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    <p className="font-semibold text-sm">
                      Veuillez confirmer avoir pris connaissance des points suivants :
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                        <Checkbox
                          id="confirm_deposit"
                          checked={confirmations.understand_deposit}
                          onCheckedChange={(checked) =>
                            setConfirmations({ ...confirmations, understand_deposit: !!checked })
                          }
                        />
                        <Label htmlFor="confirm_deposit" className="cursor-pointer text-sm leading-relaxed">
                          Je comprends que le dépôt de garantie ({formatCurrency(conditions.lease.depot_garantie)}) 
                          sera restitué dans un délai de 1 à 2 mois après l'état des lieux de sortie, 
                          déduction faite d'éventuelles retenues justifiées.
                        </Label>
                      </div>

                      <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                        <Checkbox
                          id="confirm_edl"
                          checked={confirmations.understand_edl}
                          onCheckedChange={(checked) =>
                            setConfirmations({ ...confirmations, understand_edl: !!checked })
                          }
                        />
                        <Label htmlFor="confirm_edl" className="cursor-pointer text-sm leading-relaxed">
                          Je m'engage à réaliser un état des lieux de sortie contradictoire avec le propriétaire 
                          et à remettre toutes les clés du logement à la date de fin du bail.
                        </Label>
                      </div>

                      <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                        <Checkbox
                          id="confirm_final"
                          checked={confirmations.understand_final}
                          onCheckedChange={(checked) =>
                            setConfirmations({ ...confirmations, understand_final: !!checked })
                          }
                        />
                        <Label htmlFor="confirm_final" className="cursor-pointer text-sm leading-relaxed">
                          Je confirme vouloir donner congé et comprends que cette décision est définitive. 
                          Le loyer reste dû jusqu'à la fin du préavis.
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        ) : null}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={step === 0 ? () => onOpenChange(false) : handleBack}
            disabled={submitting}
          >
            {step === 0 ? (
              "Annuler"
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </>
            )}
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed() || submitting}
            className={cn(
              step === STEPS.length - 1
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : step === STEPS.length - 1 ? (
              <>
                <Send className="h-4 w-4 mr-2" />
                Confirmer le congé
              </>
            ) : (
              <>
                Continuer
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

