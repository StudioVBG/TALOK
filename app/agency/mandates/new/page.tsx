"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  User,
  Building2,
  Percent,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

const steps = [
  { id: 1, title: "Propriétaire", icon: User },
  { id: 2, title: "Type de mandat", icon: FileText },
  { id: 3, title: "Commission", icon: Percent },
  { id: 4, title: "Confirmation", icon: Check },
];

export default function NewMandatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    // Propriétaire
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    ownerType: "particulier",
    // Mandat
    typeMandat: "gestion",
    dateDebut: new Date().toISOString().split("T")[0],
    dateFin: "",
    taciteReconduction: true,
    inclutTousBiens: true,
    // Commission
    commissionPourcentage: "7",
    honorairesLocation: "1200",
    honorairesEdl: "150",
    // Notes
    notes: "",
  });

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    
    toast({
      title: "Mandat créé !",
      description: "Le mandat a été créé et une invitation a été envoyée au propriétaire.",
    });
    
    router.push("/agency/mandates");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/agency/mandates">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nouveau mandat</h1>
          <p className="text-muted-foreground">Créer un mandat de gestion</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  currentStep >= step.id
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                )}
              >
                <step.icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "text-xs mt-2 font-medium",
                currentStep >= step.id ? "text-indigo-600" : "text-muted-foreground"
              )}>
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-full h-1 mx-2 rounded-full",
                  currentStep > step.id ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"
                )}
                style={{ width: "80px" }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-6">
          {/* Step 1: Propriétaire */}
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold mb-4">Informations du propriétaire</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Renseignez les coordonnées du propriétaire mandant
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Nom complet *</Label>
                  <Input
                    id="ownerName"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerType">Type</Label>
                  <Select
                    value={formData.ownerType}
                    onValueChange={(v) => setFormData({ ...formData, ownerType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="particulier">Particulier</SelectItem>
                      <SelectItem value="societe">Société / SCI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerEmail">Email *</Label>
                  <Input
                    id="ownerEmail"
                    type="email"
                    value={formData.ownerEmail}
                    onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    placeholder="jean.dupont@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerPhone">Téléphone</Label>
                  <Input
                    id="ownerPhone"
                    value={formData.ownerPhone}
                    onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    placeholder="06 12 34 56 78"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Type de mandat */}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold mb-4">Type de mandat</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Définissez les caractéristiques du mandat
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Type de mandat *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { value: "gestion", label: "Gestion locative", desc: "Gestion complète des biens" },
                      { value: "location", label: "Mise en location", desc: "Recherche de locataires" },
                    ].map((type) => (
                      <div
                        key={type.value}
                        onClick={() => setFormData({ ...formData, typeMandat: type.value })}
                        className={cn(
                          "p-4 rounded-xl border-2 cursor-pointer transition-all",
                          formData.typeMandat === type.value
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                            : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <p className="font-medium">{type.label}</p>
                        <p className="text-sm text-muted-foreground">{type.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateDebut">Date de début *</Label>
                    <Input
                      id="dateDebut"
                      type="date"
                      value={formData.dateDebut}
                      onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateFin">Date de fin (optionnel)</Label>
                    <Input
                      id="dateFin"
                      type="date"
                      value={formData.dateFin}
                      onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tacite"
                    checked={formData.taciteReconduction}
                    onCheckedChange={(checked) => setFormData({ ...formData, taciteReconduction: !!checked })}
                  />
                  <Label htmlFor="tacite" className="text-sm">
                    Tacite reconduction
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tousBiens"
                    checked={formData.inclutTousBiens}
                    onCheckedChange={(checked) => setFormData({ ...formData, inclutTousBiens: !!checked })}
                  />
                  <Label htmlFor="tousBiens" className="text-sm">
                    Inclut tous les biens du propriétaire
                  </Label>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Commission */}
          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold mb-4">Commission et honoraires</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Définissez votre rémunération
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="commission">Commission sur loyers (%)</Label>
                  <Input
                    id="commission"
                    type="number"
                    min="0"
                    max="15"
                    step="0.5"
                    value={formData.commissionPourcentage}
                    onChange={(e) => setFormData({ ...formData, commissionPourcentage: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Sur loyers encaissés HT</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="honorairesLocation">Honoraires location (€)</Label>
                  <Input
                    id="honorairesLocation"
                    type="number"
                    value={formData.honorairesLocation}
                    onChange={(e) => setFormData({ ...formData, honorairesLocation: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Par mise en location</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="honorairesEdl">Honoraires EDL (€)</Label>
                  <Input
                    id="honorairesEdl"
                    type="number"
                    value={formData.honorairesEdl}
                    onChange={(e) => setFormData({ ...formData, honorairesEdl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Par état des lieux</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes / conditions particulières</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Conditions particulières, exclusions, etc."
                />
              </div>
            </motion.div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === 4 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold mb-4">Récapitulatif</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Vérifiez les informations avant de créer le mandat
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    Propriétaire
                  </h4>
                  <p className="text-sm"><strong>{formData.ownerName}</strong></p>
                  <p className="text-sm text-muted-foreground">{formData.ownerEmail}</p>
                  <p className="text-sm text-muted-foreground">{formData.ownerPhone}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Mandat
                  </h4>
                  <p className="text-sm">
                    Type : <strong>{formData.typeMandat === "gestion" ? "Gestion locative" : "Mise en location"}</strong>
                  </p>
                  <p className="text-sm">Début : <strong>{formData.dateDebut}</strong></p>
                  {formData.dateFin && <p className="text-sm">Fin : <strong>{formData.dateFin}</strong></p>}
                  <p className="text-sm">Tacite reconduction : <strong>{formData.taciteReconduction ? "Oui" : "Non"}</strong></p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-indigo-600" />
                    Honoraires
                  </h4>
                  <p className="text-sm">Commission : <strong>{formData.commissionPourcentage}%</strong></p>
                  <p className="text-sm">Mise en location : <strong>{formData.honorairesLocation}€</strong></p>
                  <p className="text-sm">État des lieux : <strong>{formData.honorairesEdl}€</strong></p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                <p className="text-sm text-indigo-800 dark:text-indigo-200">
                  <strong>Prochaine étape :</strong> Une invitation sera envoyée au propriétaire pour qu'il signe le mandat électroniquement.
                </p>
              </div>
            </motion.div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Précédent
            </Button>
            
            {currentStep < steps.length ? (
              <Button onClick={handleNext}>
                Suivant
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                {isSubmitting ? "Création..." : "Créer le mandat"}
                <Check className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

