"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ADDON_CONFIGS, type AddonType, type AddonStatus } from "@/lib/subscriptions/addon-config";
import { Package, HardDrive, MessageSquare, Mail, FileText, XCircle } from "lucide-react";

interface AddonCardProps {
  id: string;
  addonType: AddonType;
  status: AddonStatus;
  quantity: number;
  consumedCount: number;
  purchasedAt: string;
  onCancel?: (id: string) => void;
}

const ADDON_ICONS: Record<AddonType, React.ReactNode> = {
  signature_pack: <Package className="h-5 w-5" />,
  storage_20gb: <HardDrive className="h-5 w-5" />,
  sms: <MessageSquare className="h-5 w-5" />,
  rar_electronic: <Mail className="h-5 w-5" />,
  etat_date: <FileText className="h-5 w-5" />,
};

const STATUS_VARIANTS: Record<AddonStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  active: "default",
  consumed: "secondary",
  cancelled: "destructive",
  expired: "secondary",
};

const STATUS_LABELS: Record<AddonStatus, string> = {
  pending: "En attente",
  active: "Actif",
  consumed: "Consommé",
  cancelled: "Annulé",
  expired: "Expiré",
};

export function AddonCard({
  id,
  addonType,
  status,
  quantity,
  consumedCount,
  purchasedAt,
  onCancel,
}: AddonCardProps) {
  const [cancelling, setCancelling] = useState(false);
  const config = ADDON_CONFIGS[addonType];

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancel?.(id);
    } finally {
      setCancelling(false);
    }
  };

  const showUsage = addonType === "signature_pack" && status === "active";
  const canCancel = status === "active" && addonType === "storage_20gb";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {ADDON_ICONS[addonType]}
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">{config.label}</CardTitle>
          <CardDescription>{config.description}</CardDescription>
        </div>
        <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Prix : {config.priceLabel}</span>
          <span>
            Acheté le{" "}
            {new Date(purchasedAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        {showUsage && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>Signatures utilisées</span>
              <span className="font-medium">
                {consumedCount} / {quantity}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(consumedCount / quantity) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>

      {canCancel && (
        <CardFooter>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancel}
            loading={cancelling}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Annuler l&apos;add-on
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
