"use client";

import React, { useState, useMemo, useId, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DIAGNOSTIC_TYPES,
  type DiagnosticTypeV3,
} from "@/lib/types/property-v3";
import {
  getRequiredDiagnostics,
  isDomTomPostalCode,
} from "@/lib/validations/property-v3";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, FileCheck, AlertTriangle,
  CheckCircle2, Clock, Info, Shield,
  CalendarDays, Upload,
} from "lucide-react";

interface LocalDiagnostic {
  id: string;
  diagnostic_type: DiagnosticTypeV3;
  date_performed: string;
  expiry_date: string;
  provider_name: string;
  provider_certification: string;
  document_url: string;
  notes: string;
}

let tempIdCounter = 0;
function tempId(): string {
  return `temp-diag-${Date.now()}-${++tempIdCounter}`;
}

function computeExpiryDate(datePerformed: string, validityYears: number | null): string {
  if (!datePerformed || validityYears === null) return "";
  const date = new Date(datePerformed);
  if (isNaN(date.getTime())) return "";
  const months = Math.round(validityYears * 12);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split("T")[0];
}

function isDiagnosticExpired(expiryDate: string): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

function isDiagnosticExpiringSoon(expiryDate: string, monthsAhead: number = 3): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const soon = new Date();
  soon.setMonth(soon.getMonth() + monthsAhead);
  return expiry <= soon && expiry >= new Date();
}

export function DiagnosticsStep() {
  const { formData, updateFormData } = usePropertyWizardStore();
  const baseId = useId();
  const propertyType = (formData.type as string) || "";
  const postalCode = formData.code_postal || "";
  const isDomTom = isDomTomPostalCode(postalCode);
  const constructionYear = formData.construction_year;
  const hasGas = formData.chauffage_energie === "gaz" || formData.eau_chaude_type === "gaz_indiv";

  // Local state for diagnostics
  const [diagnostics, setDiagnostics] = useState<LocalDiagnostic[]>(() => {
    const saved = (formData as any)._diagnostics;
    return Array.isArray(saved) ? saved : [];
  });

  const syncToStore = useCallback((updated: LocalDiagnostic[]) => {
    updateFormData({ _diagnostics: updated } as any);
  }, [updateFormData]);

  // Required diagnostics for this property
  const requiredTypes = useMemo(() => {
    return getRequiredDiagnostics({
      propertyType,
      isDomTom,
      constructionYear,
      hasGas,
    });
  }, [propertyType, isDomTom, constructionYear, hasGas]);

  // Status of each required diagnostic
  const diagnosticStatus = useMemo(() => {
    return requiredTypes.map(type => {
      const existing = diagnostics.find(d => d.diagnostic_type === type);
      const meta = DIAGNOSTIC_TYPES.find(d => d.value === type);
      if (!existing) return { type, status: "missing" as const, meta };
      if (existing.expiry_date && isDiagnosticExpired(existing.expiry_date)) {
        return { type, status: "expired" as const, meta, diagnostic: existing };
      }
      if (existing.expiry_date && isDiagnosticExpiringSoon(existing.expiry_date)) {
        return { type, status: "expiring" as const, meta, diagnostic: existing };
      }
      return { type, status: "valid" as const, meta, diagnostic: existing };
    });
  }, [requiredTypes, diagnostics]);

  const missingCount = diagnosticStatus.filter(d => d.status === "missing").length;
  const expiredCount = diagnosticStatus.filter(d => d.status === "expired").length;
  const expiringCount = diagnosticStatus.filter(d => d.status === "expiring").length;
  const validCount = diagnosticStatus.filter(d => d.status === "valid").length;

  const addDiagnostic = (type?: DiagnosticTypeV3) => {
    const newDiag: LocalDiagnostic = {
      id: tempId(),
      diagnostic_type: type || "dpe",
      date_performed: "",
      expiry_date: "",
      provider_name: "",
      provider_certification: "",
      document_url: "",
      notes: "",
    };
    const updated = [...diagnostics, newDiag];
    setDiagnostics(updated);
    syncToStore(updated);
  };

  const updateDiagnostic = (id: string, field: keyof LocalDiagnostic, value: string) => {
    const updated = diagnostics.map(d => {
      if (d.id !== id) return d;
      const newDiag = { ...d, [field]: value };
      // Auto-compute expiry when date changes
      if (field === "date_performed" && value) {
        const meta = DIAGNOSTIC_TYPES.find(dt => dt.value === newDiag.diagnostic_type);
        if (meta?.validity_years) {
          newDiag.expiry_date = computeExpiryDate(value, meta.validity_years);
        }
      }
      if (field === "diagnostic_type") {
        // Reset expiry when type changes
        const meta = DIAGNOSTIC_TYPES.find(dt => dt.value === value);
        if (meta?.validity_years && newDiag.date_performed) {
          newDiag.expiry_date = computeExpiryDate(newDiag.date_performed, meta.validity_years);
        }
      }
      return newDiag;
    });
    setDiagnostics(updated);
    syncToStore(updated);
  };

  const removeDiagnostic = (id: string) => {
    const updated = diagnostics.filter(d => d.id !== id);
    setDiagnostics(updated);
    syncToStore(updated);
  };

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto overflow-y-auto pb-8 gap-6">
      {/* Status summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap gap-2"
      >
        <Badge variant={missingCount > 0 ? "destructive" : "secondary"} className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {missingCount} manquant(s)
        </Badge>
        {expiredCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <Clock className="h-3 w-3" />
            {expiredCount} expiré(s)
          </Badge>
        )}
        {expiringCount > 0 && (
          <Badge className="gap-1 bg-amber-100 text-amber-800 border-amber-300">
            <Clock className="h-3 w-3" />
            {expiringCount} bientôt expiré(s)
          </Badge>
        )}
        {validCount > 0 && (
          <Badge className="gap-1 bg-green-100 text-green-800 border-green-300">
            <CheckCircle2 className="h-3 w-3" />
            {validCount} valide(s)
          </Badge>
        )}
      </motion.div>

      {/* DOM-TOM alert */}
      {isDomTom && (
        <Alert className="bg-amber-50 border-amber-200">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            <strong>Zone DOM-TOM :</strong> Le diagnostic termites est obligatoire sur l'ensemble du territoire.
            L'état des risques naturels (cyclone, séisme, volcan) est également requis.
          </AlertDescription>
        </Alert>
      )}

      {/* Required diagnostics checklist */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" />
          Diagnostics obligatoires
        </h3>

        <div className="space-y-2">
          {diagnosticStatus.map(({ type, status, meta }) => (
            <div
              key={type}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                status === "valid" && "bg-green-50 border-green-200",
                status === "expiring" && "bg-amber-50 border-amber-200",
                status === "expired" && "bg-red-50 border-red-200",
                status === "missing" && "bg-muted/50 border-dashed",
              )}
            >
              <div className="flex items-center gap-3">
                {status === "valid" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {status === "expiring" && <Clock className="h-4 w-4 text-amber-600" />}
                {status === "expired" && <AlertTriangle className="h-4 w-4 text-red-600" />}
                {status === "missing" && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                <div>
                  <p className="text-sm font-medium">{meta?.label || type}</p>
                  <p className="text-xs text-muted-foreground">{meta?.description}</p>
                </div>
              </div>

              {status === "missing" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addDiagnostic(type as DiagnosticTypeV3)}
                  className="shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
                </Button>
              )}
              {(status === "expired" || status === "expiring") && (
                <Badge variant={status === "expired" ? "destructive" : "secondary"} className="shrink-0">
                  {status === "expired" ? "Expiré" : "Expire bientôt"}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* Diagnostic details */}
      {diagnostics.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Détails des diagnostics renseignés
          </h3>

          <AnimatePresence>
            {diagnostics.map((diag, index) => {
              const meta = DIAGNOSTIC_TYPES.find(d => d.value === diag.diagnostic_type);
              const isExpired = diag.expiry_date && isDiagnosticExpired(diag.expiry_date);

              return (
                <motion.div
                  key={diag.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "rounded-xl border bg-card p-4 space-y-3",
                    isExpired && "border-red-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {meta?.label || diag.diagnostic_type}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDiagnostic(diag.id)}
                      className="text-destructive h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type de diagnostic</Label>
                      <Select
                        value={diag.diagnostic_type}
                        onValueChange={(v) => updateDiagnostic(diag.id, "diagnostic_type", v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIAGNOSTIC_TYPES.map((dt) => (
                            <SelectItem key={dt.value} value={dt.value}>
                              {dt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Date de réalisation</Label>
                      <Input
                        className="h-9"
                        type="date"
                        value={diag.date_performed}
                        onChange={(e) => updateDiagnostic(diag.id, "date_performed", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Date d'expiration
                        {meta?.validity_years && (
                          <span className="text-muted-foreground ml-1">
                            (validité : {meta.validity_years >= 1 ? `${meta.validity_years} an(s)` : `${Math.round(meta.validity_years * 12)} mois`})
                          </span>
                        )}
                      </Label>
                      <Input
                        className={cn("h-9", isExpired && "border-red-300 text-red-600")}
                        type="date"
                        value={diag.expiry_date}
                        onChange={(e) => updateDiagnostic(diag.id, "expiry_date", e.target.value)}
                      />
                      {isExpired && (
                        <p className="text-xs text-red-600 font-medium">Ce diagnostic est expiré</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Diagnostiqueur</Label>
                      <Input
                        className="h-9"
                        placeholder="Nom du prestataire"
                        value={diag.provider_name}
                        onChange={(e) => updateDiagnostic(diag.id, "provider_name", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">N° certification</Label>
                    <Input
                      className="h-9"
                      placeholder="Numéro de certification du diagnostiqueur"
                      value={diag.provider_certification}
                      onChange={(e) => updateDiagnostic(diag.id, "provider_certification", e.target.value)}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.section>
      )}

      {/* Add extra diagnostic */}
      <Button
        type="button"
        variant="outline"
        onClick={() => addDiagnostic()}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" /> Ajouter un diagnostic supplémentaire
      </Button>

      {/* DPE warning */}
      {formData.dpe_classe_energie === "G" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Interdiction de location :</strong> Les logements classés G (passoires thermiques)
            sont interdits à la location depuis le 1er janvier 2025.
            Les logements classés F seront interdits à partir de 2028.
          </AlertDescription>
        </Alert>
      )}

      {formData.dpe_classe_energie === "F" && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Attention :</strong> Les logements classés F seront interdits à la location
            à partir du 1er janvier 2028. Pensez à planifier des travaux de rénovation énergétique.
          </AlertDescription>
        </Alert>
      )}

      {/* Info */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          Les diagnostics seront vérifiés lors de la création d'un bail.
          Vous pourrez ajouter les documents PDF depuis la fiche du bien.
        </AlertDescription>
      </Alert>
    </div>
  );
}
