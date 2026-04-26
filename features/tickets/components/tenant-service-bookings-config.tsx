"use client";

import { useState } from "react";
import { Sparkles, Save, Loader2, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  TENANT_BOOKABLE_CATEGORIES,
  TENANT_BOOKABLE_CATEGORY_LABELS,
  type TenantBookableCategory,
  type TenantBookingPermissions,
} from "@/lib/tickets/tenant-service-permissions";

interface Props {
  leaseId: string;
  initial: TenantBookingPermissions;
}

/**
 * Bloc de configuration à intégrer sur la page bail côté propriétaire.
 * Permet d'activer le self-service locataire, choisir les catégories,
 * un plafond par intervention, et un workflow d'approbation.
 */
export function TenantServiceBookingsConfig({ leaseId, initial }: Props) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [categories, setCategories] = useState<Set<string>>(
    new Set(initial.allowed_categories)
  );
  const [maxAmountEuros, setMaxAmountEuros] = useState<string>(
    initial.max_amount_cents != null
      ? String(Math.round(initial.max_amount_cents / 100))
      : ""
  );
  const [requiresApproval, setRequiresApproval] = useState(
    initial.requires_owner_approval
  );
  const [saving, setSaving] = useState(false);

  const toggleCategory = (cat: string) => {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedMax = maxAmountEuros.trim()
        ? Math.round(Number(maxAmountEuros) * 100)
        : null;
      if (parsedMax !== null && (Number.isNaN(parsedMax) || parsedMax <= 0)) {
        toast({
          title: "Plafond invalide",
          description: "Indiquez un montant en euros ou laissez vide.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const res = await fetch(
        `/api/owner/leases/${leaseId}/tenant-service-bookings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled,
            allowed_categories: Array.from(categories),
            max_amount_cents: parsedMax,
            requires_owner_approval: requiresApproval,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Enregistrement impossible");
      }
      toast({
        title: "Configuration enregistrée",
        description: enabled
          ? `Votre locataire peut réserver ${categories.size} catégorie(s).`
          : "La réservation directe a été désactivée.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error ? error.message : "Enregistrement impossible",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card border border-border">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">
              Services réservables par le locataire
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Autorisez votre locataire à réserver directement certains
              prestataires (jardinage, ménage...). Le ticket vous est toujours
              notifié.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Activer" />
        </div>

        {enabled && (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Catégories autorisées
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(TENANT_BOOKABLE_CATEGORIES as readonly TenantBookableCategory[]).map(
                  (cat) => {
                    const active = categories.has(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={cn(
                          "px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                          active
                            ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                            : "border-border hover:border-indigo-200 text-muted-foreground"
                        )}
                      >
                        {TENANT_BOOKABLE_CATEGORY_LABELS[cat]}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_amount" className="text-sm font-semibold">
                  Plafond par intervention (€)
                </Label>
                <Input
                  id="max_amount"
                  type="number"
                  min="1"
                  placeholder="Laissez vide = illimité"
                  value={maxAmountEuros}
                  onChange={(e) => setMaxAmountEuros(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Valider chaque réservation
                </Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={requiresApproval}
                    onCheckedChange={setRequiresApproval}
                  />
                  <span className="text-sm text-muted-foreground">
                    {requiresApproval ? "Oui" : "Non (réservation directe)"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Vous êtes toujours notifié quand une réservation est créée et
                vous pouvez l'annuler à tout moment depuis la page ticket.
              </p>
            </div>
          </>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
