"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ui/glass-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Check, Zap, Flame, Droplet, Gauge } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { ConsentBanner } from "@/components/meters";
import { cn } from "@/lib/utils";
import type { MeterType, TariffOption } from "@/lib/services/meters/types";

const METER_TYPES: Array<{
  value: MeterType;
  label: string;
  icon: typeof Zap;
  color: string;
  refLabel: string;
  refPlaceholder: string;
}> = [
  {
    value: "electricity",
    label: "Electricite",
    icon: Zap,
    color: "text-amber-600",
    refLabel: "PDL (Point De Livraison)",
    refPlaceholder: "14 chiffres - ex: 09235678901234",
  },
  {
    value: "gas",
    label: "Gaz",
    icon: Flame,
    color: "text-orange-600",
    refLabel: "PCE (Point de Comptage)",
    refPlaceholder: "14 chiffres - ex: 21234567890123",
  },
  {
    value: "water",
    label: "Eau",
    icon: Droplet,
    color: "text-blue-600",
    refLabel: "Numero compteur",
    refPlaceholder: "Numero du compteur d'eau",
  },
  {
    value: "heating",
    label: "Chauffage",
    icon: Flame,
    color: "text-red-600",
    refLabel: "Numero compteur",
    refPlaceholder: "Numero du compteur chauffage",
  },
];

export default function AddMeterPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const propertyId = params.id as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    meter_type: "electricity" as MeterType,
    meter_reference: "",
    meter_serial: "",
    contract_holder: "",
    tariff_option: "" as TariffOption | "",
    subscribed_power_kva: "",
    alert_threshold_daily: "",
    alert_threshold_monthly: "",
  });

  const selectedType = METER_TYPES.find((t) => t.value === formData.meter_type)!;
  const showTariffOptions = formData.meter_type === "electricity";
  const showConsentBanner =
    formData.meter_type === "electricity" || formData.meter_type === "gas";

  const handleSubmit = async () => {
    if (!formData.meter_reference.trim()) {
      toast({ title: "Reference compteur requise", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        property_id: propertyId,
        meter_type: formData.meter_type,
        meter_reference: formData.meter_reference.trim(),
        provider: formData.meter_type === "electricity" ? "enedis" : formData.meter_type === "gas" ? "grdf" : "manual",
      };

      if (formData.meter_serial.trim()) body.meter_serial = formData.meter_serial.trim();
      if (formData.contract_holder.trim()) body.contract_holder = formData.contract_holder.trim();
      if (formData.tariff_option) body.tariff_option = formData.tariff_option;
      if (formData.subscribed_power_kva) body.subscribed_power_kva = parseInt(formData.subscribed_power_kva);
      if (formData.alert_threshold_daily) body.alert_threshold_daily = parseFloat(formData.alert_threshold_daily);
      if (formData.alert_threshold_monthly) body.alert_threshold_monthly = parseFloat(formData.alert_threshold_monthly);

      const response = await fetch("/api/property-meters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'ajout");
      }

      toast({ title: "Compteur ajoute" });
      router.push(`/owner/properties/${propertyId}/meters`);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'ajouter le compteur",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2"
            onClick={() => router.push(`/owner/properties/${propertyId}/meters`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500 rounded-lg shadow-lg shadow-amber-200">
              <Gauge className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Ajouter un compteur
            </h1>
          </div>
        </motion.div>

        <GlassCard className="p-8 space-y-6">
          {/* Type */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Type de compteur *
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {METER_TYPES.map((type) => {
                const TypeIcon = type.icon;
                const isSelected = formData.meter_type === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, meter_type: type.value })}
                    className={cn(
                      "p-4 rounded-xl border-2 text-center transition-all",
                      isSelected
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                        : "border-border hover:border-amber-300"
                    )}
                  >
                    <TypeIcon className={cn("h-6 w-6 mx-auto mb-1", type.color)} />
                    <span className="text-xs font-bold">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              {selectedType.refLabel} *
            </Label>
            <Input
              value={formData.meter_reference}
              onChange={(e) => setFormData({ ...formData, meter_reference: e.target.value })}
              placeholder={selectedType.refPlaceholder}
              className="h-12 rounded-xl"
            />
          </div>

          {/* Serial */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Numero de serie (optionnel)
            </Label>
            <Input
              value={formData.meter_serial}
              onChange={(e) => setFormData({ ...formData, meter_serial: e.target.value })}
              placeholder="Numero de serie du compteur"
              className="h-12 rounded-xl"
            />
          </div>

          {/* Contract holder */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Titulaire du contrat
            </Label>
            <Input
              value={formData.contract_holder}
              onChange={(e) => setFormData({ ...formData, contract_holder: e.target.value })}
              placeholder="Nom du titulaire"
              className="h-12 rounded-xl"
            />
          </div>

          {/* Tariff (electricity only) */}
          {showTariffOptions && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Option tarifaire
                </Label>
                <Select
                  value={formData.tariff_option}
                  onValueChange={(v) =>
                    setFormData({ ...formData, tariff_option: v as TariffOption })
                  }
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="hc_hp">HC/HP</SelectItem>
                    <SelectItem value="tempo">Tempo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Puissance (kVA)
                </Label>
                <Input
                  type="number"
                  value={formData.subscribed_power_kva}
                  onChange={(e) =>
                    setFormData({ ...formData, subscribed_power_kva: e.target.value })
                  }
                  placeholder="6"
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
          )}

          {/* Alert thresholds */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Seuil alerte jour
              </Label>
              <Input
                type="number"
                value={formData.alert_threshold_daily}
                onChange={(e) =>
                  setFormData({ ...formData, alert_threshold_daily: e.target.value })
                }
                placeholder="ex: 30"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Seuil alerte mois
              </Label>
              <Input
                type="number"
                value={formData.alert_threshold_monthly}
                onChange={(e) =>
                  setFormData({ ...formData, alert_threshold_monthly: e.target.value })
                }
                placeholder="ex: 500"
                className="h-12 rounded-xl"
              />
            </div>
          </div>

          {/* Consent banner */}
          {showConsentBanner && (
            <ConsentBanner provider={formData.meter_type === "electricity" ? "enedis" : "grdf"} />
          )}
        </GlassCard>

        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={() => router.push(`/owner/properties/${propertyId}/meters`)}
            className="rounded-xl font-bold"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.meter_reference.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold h-12 px-8 shadow-lg"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" /> Ajouter le compteur
              </>
            )}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
