"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Save,
  Receipt,
  Info,
  Check,
  User,
  Building2,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { CanonicalChargeCategory } from "@/lib/tickets/charges-classification";

const CATEGORY_OPTIONS: Array<{ value: CanonicalChargeCategory; label: string }> = [
  { value: "ascenseurs", label: "Ascenseurs" },
  { value: "eau_chauffage", label: "Eau & chauffage" },
  { value: "installations_individuelles", label: "Installations individuelles" },
  { value: "parties_communes", label: "Parties communes" },
  { value: "espaces_exterieurs", label: "Espaces extérieurs" },
  { value: "taxes_redevances", label: "Taxes & redevances" },
];

type Choice = "tenant" | "owner" | "unset";

function statusFromProps(
  is_tenant_chargeable: boolean | null | undefined
): Choice {
  if (is_tenant_chargeable === true) return "tenant";
  if (is_tenant_chargeable === false) return "owner";
  return "unset";
}

interface Props {
  ticketId: string;
  workOrderId?: string | null;
  initial: {
    is_tenant_chargeable: boolean | null;
    charge_category_code: CanonicalChargeCategory | null;
  };
  /** Autoriser le bouton "Imputer aux charges" (après paiement prestataire). */
  canInjectCharges?: boolean;
}

export function TicketChargesClassification({
  ticketId,
  workOrderId,
  initial,
  canInjectCharges,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [choice, setChoice] = useState<Choice>(statusFromProps(initial.is_tenant_chargeable));
  const [category, setCategory] = useState<CanonicalChargeCategory | "">(
    initial.charge_category_code ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [injecting, setInjecting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const is_tenant_chargeable =
        choice === "tenant" ? true : choice === "owner" ? false : null;
      const charge_category_code =
        is_tenant_chargeable === true && category ? category : null;

      const res = await fetch(`/api/tickets/${ticketId}/charge-classification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_tenant_chargeable, charge_category_code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Enregistrement impossible");

      toast({
        title: "Classification enregistrée",
        description:
          is_tenant_chargeable === true
            ? "Intervention imputée au locataire."
            : is_tenant_chargeable === false
              ? "Intervention à la charge du propriétaire."
              : "Décision reportée.",
      });
      router.refresh();
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

  const handleInject = async () => {
    if (!workOrderId) return;
    setInjecting(true);
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/inject-charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Injection impossible");

      const euros = ((data.amount_cents as number) / 100).toFixed(2);
      toast({
        title: data.created ? "Ajouté aux charges récupérables" : "Déjà imputé",
        description: data.created
          ? `${euros} € seront intégrés à la prochaine régularisation.`
          : `Cette intervention est déjà dans les charges (${euros} €).`,
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error ? error.message : "Injection impossible",
        variant: "destructive",
      });
    } finally {
      setInjecting(false);
    }
  };

  const showCategory = choice === "tenant";
  const canSave =
    choice !== statusFromProps(initial.is_tenant_chargeable) ||
    (category || null) !== (initial.charge_category_code ?? null);

  return (
    <Card className="bg-card border border-border">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
            <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">
              Qui paie cette intervention ?
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Décret 87-713 — certains frais peuvent être refacturés au
              locataire via la régularisation annuelle des charges.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <ChoicePill
            active={choice === "owner"}
            icon={Building2}
            label="Propriétaire"
            onClick={() => setChoice("owner")}
          />
          <ChoicePill
            active={choice === "tenant"}
            icon={User}
            label="Locataire"
            onClick={() => setChoice("tenant")}
          />
          <ChoicePill
            active={choice === "unset"}
            icon={AlertCircle}
            label="À décider"
            onClick={() => setChoice("unset")}
          />
        </div>

        {showCategory && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Catégorie de charge récupérable
            </Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as CanonicalChargeCategory)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une catégorie..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={saving || !canSave}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Enregistrer
              </>
            )}
          </Button>

          {canInjectCharges &&
            workOrderId &&
            initial.is_tenant_chargeable === true &&
            initial.charge_category_code && (
              <Button
                onClick={handleInject}
                disabled={injecting}
                size="sm"
                variant="outline"
              >
                {injecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Ajouter aux charges récupérables
                  </>
                )}
              </Button>
            )}
        </div>

        {choice === "unset" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>
              Tant qu'aucune décision n'est prise, l'intervention reste à la
              charge du propriétaire et ne sera pas ajoutée à la régularisation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChoicePill({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof User;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-medium",
        active
          ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
          : "border-border hover:border-emerald-200 text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
