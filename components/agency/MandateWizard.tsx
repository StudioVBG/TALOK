"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText,
  User,
  Building2,
  Euro,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MandateFormData {
  owner_profile_id: string;
  mandate_type: "gestion" | "location" | "syndic" | "transaction";
  start_date: string;
  end_date: string | null;
  tacit_renewal: boolean;
  management_fee_type: "percentage" | "fixed";
  management_fee_rate: number | null;
  management_fee_fixed_cents: number | null;
  property_ids: string[];
  mandant_bank_iban: string;
  mandant_bank_bic: string;
}

interface Owner {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string;
}

interface Property {
  id: string;
  nom: string;
  adresse: string;
}

interface MandateWizardProps {
  owners: Owner[];
  properties: Property[];
  onSubmit: (data: MandateFormData) => Promise<void>;
  onCancel: () => void;
}

const STEPS = [
  { id: "owner", title: "Mandant", icon: User },
  { id: "type", title: "Type de mandat", icon: FileText },
  { id: "properties", title: "Biens", icon: Building2 },
  { id: "fees", title: "Honoraires", icon: Euro },
  { id: "review", title: "Validation", icon: Check },
];

export function MandateWizard({ owners, properties, onSubmit, onCancel }: MandateWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<MandateFormData>({
    owner_profile_id: "",
    mandate_type: "gestion",
    start_date: new Date().toISOString().split("T")[0],
    end_date: null,
    tacit_renewal: true,
    management_fee_type: "percentage",
    management_fee_rate: 7,
    management_fee_fixed_cents: null,
    property_ids: [],
    mandant_bank_iban: "",
    mandant_bank_bic: "",
  });

  const updateField = <K extends keyof MandateFormData>(field: K, value: MandateFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleProperty = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      property_ids: prev.property_ids.includes(id)
        ? prev.property_ids.filter((p) => p !== id)
        : [...prev.property_ids, id],
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!formData.owner_profile_id;
      case 1: return !!formData.mandate_type && !!formData.start_date;
      case 2: return true; // properties optional
      case 3: return formData.management_fee_type === "percentage"
        ? formData.management_fee_rate !== null && formData.management_fee_rate > 0
        : formData.management_fee_fixed_cents !== null && formData.management_fee_fixed_cents > 0;
      case 4: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      toast({ title: "Mandat cree", description: "Le mandat a ete enregistre avec succes." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de creer le mandat.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOwner = owners.find((o) => o.id === formData.owner_profile_id);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const StepIcon = s.icon;
          return (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                  i === step && "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-medium",
                  i < step && "text-emerald-600 cursor-pointer hover:bg-emerald-50",
                  i > step && "text-muted-foreground"
                )}
              >
                <StepIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{s.title}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        {/* Step 0: Owner */}
        {step === 0 && (
          <>
            <CardHeader>
              <CardTitle>Selectionner le mandant</CardTitle>
              <CardDescription>Choisissez le proprietaire qui vous confie la gestion</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {owners.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Aucun proprietaire disponible. Invitez-en un d&apos;abord.
                </p>
              ) : (
                owners.map((owner) => (
                  <button
                    key={owner.id}
                    onClick={() => updateField("owner_profile_id", owner.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left",
                      formData.owner_profile_id === owner.id
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {(owner.prenom || owner.nom || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {owner.prenom} {owner.nom}
                      </p>
                      <p className="text-sm text-muted-foreground">{owner.email}</p>
                    </div>
                    {formData.owner_profile_id === owner.id && (
                      <Check className="w-5 h-5 text-indigo-600" />
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </>
        )}

        {/* Step 1: Type */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Type de mandat</CardTitle>
              <CardDescription>Definissez le type et les dates du mandat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.mandate_type}
                  onValueChange={(v) => updateField("mandate_type", v as MandateFormData["mandate_type"])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gestion">Gestion locative</SelectItem>
                    <SelectItem value="location">Mise en location</SelectItem>
                    <SelectItem value="syndic">Syndic</SelectItem>
                    <SelectItem value="transaction">Transaction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Date de debut</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => updateField("start_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Date de fin (optionnel)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date || ""}
                    onChange={(e) => updateField("end_date", e.target.value || null)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Tacite reconduction</p>
                  <p className="text-sm text-muted-foreground">Renouvellement automatique a l&apos;echeance</p>
                </div>
                <Switch
                  checked={formData.tacit_renewal}
                  onCheckedChange={(v) => updateField("tacit_renewal", v)}
                />
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Properties */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Biens sous mandat</CardTitle>
              <CardDescription>Selectionnez les biens concernes par ce mandat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {properties.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Aucun bien disponible pour ce proprietaire.
                </p>
              ) : (
                properties.map((prop) => (
                  <button
                    key={prop.id}
                    onClick={() => toggleProperty(prop.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left",
                      formData.property_ids.includes(prop.id)
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{prop.nom}</p>
                      <p className="text-sm text-muted-foreground">{prop.adresse}</p>
                    </div>
                    {formData.property_ids.includes(prop.id) && (
                      <Check className="w-5 h-5 text-indigo-600" />
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </>
        )}

        {/* Step 3: Fees */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Honoraires de gestion</CardTitle>
              <CardDescription>Definissez la commission de l&apos;agence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Mode de calcul</Label>
                <Select
                  value={formData.management_fee_type}
                  onValueChange={(v) => updateField("management_fee_type", v as "percentage" | "fixed")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Pourcentage des loyers</SelectItem>
                    <SelectItem value="fixed">Forfait mensuel fixe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.management_fee_type === "percentage" ? (
                <div className="space-y-2">
                  <Label htmlFor="fee_rate">Taux de commission (%)</Label>
                  <Input
                    id="fee_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.management_fee_rate || ""}
                    onChange={(e) => updateField("management_fee_rate", parseFloat(e.target.value) || null)}
                  />
                  <p className="text-xs text-muted-foreground">Taux habituel : 5% a 10% HT</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="fee_fixed">Forfait mensuel (EUR)</Label>
                  <Input
                    id="fee_fixed"
                    type="number"
                    min="0"
                    value={formData.management_fee_fixed_cents ? formData.management_fee_fixed_cents / 100 : ""}
                    onChange={(e) => updateField("management_fee_fixed_cents", Math.round(parseFloat(e.target.value) * 100) || null)}
                  />
                </div>
              )}

              <div className="pt-4 border-t space-y-4">
                <p className="font-medium">Coordonnees bancaires du mandant</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="iban">IBAN</Label>
                    <Input
                      id="iban"
                      value={formData.mandant_bank_iban}
                      onChange={(e) => updateField("mandant_bank_iban", e.target.value)}
                      placeholder="FR76 3000 4000 ..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bic">BIC</Label>
                    <Input
                      id="bic"
                      value={formData.mandant_bank_bic}
                      onChange={(e) => updateField("mandant_bank_bic", e.target.value)}
                      placeholder="BNPAFRPP"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <>
            <CardHeader>
              <CardTitle>Recapitulatif du mandat</CardTitle>
              <CardDescription>Verifiez les informations avant de valider</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Mandant</p>
                  <p className="font-medium">
                    {selectedOwner ? `${selectedOwner.prenom} ${selectedOwner.nom}` : "—"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{formData.mandate_type}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Date de debut</p>
                  <p className="font-medium">{formData.start_date}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Honoraires</p>
                  <p className="font-medium">
                    {formData.management_fee_type === "percentage"
                      ? `${formData.management_fee_rate}%`
                      : `${((formData.management_fee_fixed_cents || 0) / 100).toFixed(2)} EUR/mois`}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Biens</p>
                  <p className="font-medium">{formData.property_ids.length || "Tous"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground">Reconduction</p>
                  <Badge variant="outline" className={formData.tacit_renewal ? "border-emerald-500 text-emerald-600" : ""}>
                    {formData.tacit_renewal ? "Tacite" : "Non"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={step === 0 ? onCancel : () => setStep(step - 1)}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {step === 0 ? "Annuler" : "Precedent"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
          >
            Suivant
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-indigo-500 to-purple-600"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {isSubmitting ? "Creation..." : "Creer le mandat"}
          </Button>
        )}
      </div>
    </div>
  );
}
