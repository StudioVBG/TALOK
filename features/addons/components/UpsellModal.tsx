"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowUpCircle, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import type { LimitResource } from "@/lib/subscriptions/check-limit";

interface UpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: LimitResource;
  current: number;
  max: number;
  plan: string;
  /** Hide the "buy add-on" option (e.g. for properties/users where no add-on exists) */
  addonDisabled?: boolean;
}

const RESOURCE_LABELS: Record<LimitResource, { name: string; addonLabel: string }> = {
  signatures: {
    name: "signatures électroniques",
    addonLabel: "Acheter un pack de 10 signatures — 19 €",
  },
  storage: {
    name: "stockage",
    addonLabel: "Ajouter 20 Go de stockage — 4,90 €/mois",
  },
  properties: {
    name: "biens",
    addonLabel: "",
  },
  users: {
    name: "utilisateurs",
    addonLabel: "",
  },
};

export function UpsellModal({
  open,
  onOpenChange,
  resource,
  current,
  max,
  plan,
  addonDisabled,
}: UpsellModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const labels = RESOURCE_LABELS[resource];
  const showAddon = !addonDisabled && !!labels.addonLabel;

  const handleUpgrade = () => {
    router.push("/owner/settings/billing");
    onOpenChange(false);
  };

  const handleBuyAddon = async () => {
    const addonType = resource === "signatures" ? "signature_pack" : "storage_20gb";
    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions/addons/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addonType }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Limite atteinte</DialogTitle>
          <DialogDescription>
            Vous avez utilisé {current} {labels.name} sur {max} disponibles
            (plan {plan}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Button
            variant="default"
            className="w-full justify-start gap-3"
            onClick={handleUpgrade}
          >
            <ArrowUpCircle className="h-5 w-5 shrink-0" />
            <span>Passer au plan supérieur</span>
          </Button>

          {showAddon && (
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleBuyAddon}
              loading={loading}
            >
              <ShoppingCart className="h-5 w-5 shrink-0" />
              <span>{labels.addonLabel}</span>
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
