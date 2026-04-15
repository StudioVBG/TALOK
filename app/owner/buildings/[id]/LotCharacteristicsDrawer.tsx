"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Sparkles, Thermometer, Home, Zap } from "lucide-react";

const DPE_CLASSES = ["A", "B", "C", "D", "E", "F", "G"] as const;
type DpeClass = (typeof DPE_CLASSES)[number];

const HEATING_TYPES = [
  { value: "individuel", label: "Individuel" },
  { value: "collectif", label: "Collectif" },
  { value: "aucun", label: "Aucun" },
] as const;

const HEATING_ENERGIES = [
  { value: "electricite", label: "Électricité" },
  { value: "gaz", label: "Gaz" },
  { value: "fioul", label: "Fioul" },
  { value: "bois", label: "Bois" },
  { value: "reseau_urbain", label: "Réseau urbain" },
  { value: "autre", label: "Autre" },
] as const;

const HOT_WATER_TYPES = [
  { value: "electrique_indiv", label: "Électrique indiv." },
  { value: "gaz_indiv", label: "Gaz individuel" },
  { value: "collectif", label: "Collectif" },
  { value: "solaire", label: "Solaire" },
  { value: "autre", label: "Autre" },
] as const;

/**
 * Équipements checkboxes (subset des EquipmentV3 les plus courants).
 * Couvre les besoins DPE/description locative sans surcharger l'UI.
 */
const LOT_EQUIPMENTS: Array<{ key: string; label: string; icon?: string }> = [
  { key: "wifi", label: "Wifi" },
  { key: "television", label: "TV" },
  { key: "cuisine_equipee", label: "Cuisine équipée" },
  { key: "lave_linge", label: "Lave-linge" },
  { key: "lave_vaisselle", label: "Lave-vaisselle" },
  { key: "micro_ondes", label: "Micro-ondes" },
  { key: "climatisation", label: "Climatisation" },
  { key: "balcon", label: "Balcon" },
  { key: "terrasse", label: "Terrasse" },
  { key: "jardin", label: "Jardin" },
];

export interface LotCharacteristicsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string; // id de la property du lot
  unitLabel: string; // affiche "Lot A - Étage 1"
  onSaved?: () => void;
}

interface LotDraft {
  dpe_classe_energie: DpeClass | "";
  dpe_classe_climat: DpeClass | "";
  chauffage_type: "individuel" | "collectif" | "aucun" | "";
  chauffage_energie: string;
  eau_chaude_type: string;
  nb_chambres: number | "";
  meuble: boolean;
  equipments: string[];
  // Flag : true tant qu'on n'a pas fetch les valeurs actuelles
  _loaded: boolean;
}

const EMPTY_DRAFT: LotDraft = {
  dpe_classe_energie: "",
  dpe_classe_climat: "",
  chauffage_type: "",
  chauffage_energie: "",
  eau_chaude_type: "",
  nb_chambres: "",
  meuble: false,
  equipments: [],
  _loaded: false,
};

export function LotCharacteristicsDrawer({
  open,
  onOpenChange,
  propertyId,
  unitLabel,
  onSaved,
}: LotCharacteristicsDrawerProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<LotDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Charger les caractéristiques actuelles de la property lot quand le drawer s'ouvre
  useEffect(() => {
    if (!open || !propertyId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/properties/${propertyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const p = (data?.property || data) as Record<string, unknown>;
        setDraft({
          dpe_classe_energie: ((p.dpe_classe_energie as string) || "") as DpeClass | "",
          dpe_classe_climat: ((p.dpe_classe_climat as string) || "") as DpeClass | "",
          chauffage_type: ((p.chauffage_type as string) || "") as LotDraft["chauffage_type"],
          chauffage_energie: (p.chauffage_energie as string) || "",
          eau_chaude_type: (p.eau_chaude_type as string) || "",
          nb_chambres: typeof p.nb_chambres === "number" ? p.nb_chambres : "",
          meuble: Boolean(p.meuble),
          equipments: Array.isArray(p.equipments) ? (p.equipments as string[]) : [],
          _loaded: true,
        });
      })
      .catch((e) => {
        if (!cancelled) {
          toast({
            title: "Erreur de chargement",
            description: e instanceof Error ? e.message : "Impossible de charger le lot",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, propertyId, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        dpe_classe_energie: draft.dpe_classe_energie || null,
        dpe_classe_climat: draft.dpe_classe_climat || null,
        chauffage_type: draft.chauffage_type || null,
        chauffage_energie: draft.chauffage_energie || null,
        eau_chaude_type: draft.eau_chaude_type || null,
        nb_chambres: draft.nb_chambres === "" ? null : draft.nb_chambres,
        meuble: draft.meuble,
        equipments: draft.equipments,
      };
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Erreur lors de la sauvegarde");
      }
      toast({ title: "Caractéristiques enregistrées" });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Erreur",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleEquipment = (key: string) => {
    setDraft((d) => ({
      ...d,
      equipments: d.equipments.includes(key)
        ? d.equipments.filter((e) => e !== key)
        : [...d.equipments, key],
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#2563EB]" />
            Caractéristiques du lot
          </SheetTitle>
          <SheetDescription>
            <Badge variant="secondary" className="mt-1">
              {unitLabel}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-1 my-4 pr-3">
            <div className="space-y-6">
              {/* DPE */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Diagnostic de performance énergétique
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">DPE (énergie)</Label>
                    <Select
                      value={draft.dpe_classe_energie || ""}
                      onValueChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          dpe_classe_energie: v as DpeClass | "",
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Non renseigné" />
                      </SelectTrigger>
                      <SelectContent>
                        {DPE_CLASSES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">GES (climat)</Label>
                    <Select
                      value={draft.dpe_classe_climat || ""}
                      onValueChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          dpe_classe_climat: v as DpeClass | "",
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Non renseigné" />
                      </SelectTrigger>
                      <SelectContent>
                        {DPE_CLASSES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Chauffage */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Thermometer className="h-4 w-4 text-red-500" />
                  Chauffage &amp; eau chaude
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={draft.chauffage_type || ""}
                      onValueChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          chauffage_type: v as LotDraft["chauffage_type"],
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Non renseigné" />
                      </SelectTrigger>
                      <SelectContent>
                        {HEATING_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Énergie</Label>
                    <Select
                      value={draft.chauffage_energie || ""}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, chauffage_energie: v }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Non renseigné" />
                      </SelectTrigger>
                      <SelectContent>
                        {HEATING_ENERGIES.map((e) => (
                          <SelectItem key={e.value} value={e.value}>
                            {e.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Eau chaude sanitaire</Label>
                  <Select
                    value={draft.eau_chaude_type || ""}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, eau_chaude_type: v }))
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Non renseigné" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOT_WATER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </section>

              <Separator />

              {/* Pièces & meublé */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Home className="h-4 w-4 text-emerald-500" />
                  Agencement
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nb_chambres" className="text-xs">
                    Nombre de chambres
                  </Label>
                  <Input
                    id="nb_chambres"
                    type="number"
                    min={0}
                    max={20}
                    value={draft.nb_chambres}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        nb_chambres:
                          e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    placeholder="0"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="meuble" className="text-sm">
                    Lot meublé
                  </Label>
                  <Switch
                    id="meuble"
                    checked={draft.meuble}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, meuble: v }))}
                  />
                </div>
              </section>

              <Separator />

              {/* Équipements */}
              <section className="space-y-3">
                <div className="text-sm font-semibold">Équipements</div>
                <div className="grid grid-cols-2 gap-2">
                  {LOT_EQUIPMENTS.map((eq) => {
                    const selected = draft.equipments.includes(eq.key);
                    return (
                      <button
                        key={eq.key}
                        type="button"
                        onClick={() => toggleEquipment(eq.key)}
                        className={
                          "text-left px-3 py-2 rounded-md border text-xs transition-colors " +
                          (selected
                            ? "border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] font-medium"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500")
                        }
                      >
                        {eq.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </ScrollArea>
        )}

        <SheetFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
