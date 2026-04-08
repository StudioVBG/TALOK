"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, HardDrive, PenTool } from "lucide-react";
import { AddonCard } from "@/features/addons/components/AddonCard";
import { AddonPurchaseButton } from "@/features/addons/components/AddonPurchaseButton";
import { SignatureUsageBar } from "@/features/addons/components/SignatureUsageBar";
import { StorageUsageBar } from "@/features/addons/components/StorageUsageBar";
import { SMSUsageSummary } from "@/features/addons/components/SMSUsageSummary";
import { Skeleton } from "@/components/ui/skeleton";
import type { AddonType, AddonStatus } from "@/lib/subscriptions/addon-config";
import type { LimitResult } from "@/lib/subscriptions/check-limit";

interface Addon {
  id: string;
  addon_type: AddonType;
  status: AddonStatus;
  quantity: number;
  consumed_count: number;
  purchased_at: string;
}

export default function AddonsPage() {
  const router = useRouter();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [sigLimits, setSigLimits] = useState<LimitResult | null>(null);
  const [storageLimits, setStorageLimits] = useState<LimitResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [addonsRes, sigRes, storageRes] = await Promise.all([
          fetch("/api/subscriptions/addons"),
          fetch("/api/subscriptions/addons/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: "signatures" }),
          }),
          fetch("/api/subscriptions/addons/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: "storage" }),
          }),
        ]);

        const [addonsData, sigData, storageData] = await Promise.all([
          addonsRes.json(),
          sigRes.json(),
          storageRes.json(),
        ]);

        setAddons(addonsData.addons || []);
        if (!sigData.error) setSigLimits(sigData);
        if (!storageData.error) setStorageLimits(storageData);
      } catch (err) {
        console.error("[AddonsPage]", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCancel = async (addonId: string) => {
    const res = await fetch("/api/subscriptions/addons/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addonId }),
    });
    if (res.ok) {
      setAddons((prev) =>
        prev.map((a) =>
          a.id === addonId ? { ...a, status: "cancelled" as AddonStatus } : a
        )
      );
    }
  };

  const activeAddons = addons.filter((a) => a.status === "active");
  const pastAddons = addons.filter((a) => a.status !== "active" && a.status !== "pending");

  if (loading) {
    return (
      <div className="container max-w-3xl mx-auto py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/owner/money?tab=forfait")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add-ons</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos add-ons et consultez votre consommation
          </p>
        </div>
      </div>

      {/* Usage overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consommation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sigLimits && (
            <SignatureUsageBar
              used={sigLimits.current}
              planLimit={sigLimits.maxBase}
              addonRemaining={sigLimits.maxWithAddons - sigLimits.maxBase}
            />
          )}
          {storageLimits && (
            <StorageUsageBar
              usedMB={storageLimits.current}
              planLimitMB={storageLimits.maxBase}
              addonMB={storageLimits.maxWithAddons - storageLimits.maxBase}
            />
          )}
          <SMSUsageSummary
            count={0}
            month={new Date().toISOString().slice(0, 7)}
          />
        </CardContent>
      </Card>

      {/* Buy add-ons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acheter un add-on</CardTitle>
          <CardDescription>
            Ajoutez des capacités supplémentaires à votre abonnement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <AddonPurchaseButton
              addonType="signature_pack"
              variant="outline"
              className="h-auto py-3 flex-col items-start text-left"
            />
            <AddonPurchaseButton
              addonType="storage_20gb"
              variant="outline"
              className="h-auto py-3 flex-col items-start text-left"
            />
            <AddonPurchaseButton
              addonType="rar_electronic"
              variant="outline"
              className="h-auto py-3 flex-col items-start text-left"
            />
            <AddonPurchaseButton
              addonType="etat_date"
              variant="outline"
              className="h-auto py-3 flex-col items-start text-left"
            />
          </div>
        </CardContent>
      </Card>

      {/* Active add-ons */}
      {activeAddons.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Add-ons actifs</h2>
          {activeAddons.map((addon) => (
            <AddonCard
              key={addon.id}
              id={addon.id}
              addonType={addon.addon_type}
              status={addon.status}
              quantity={addon.quantity}
              consumedCount={addon.consumed_count}
              purchasedAt={addon.purchased_at}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {/* Past add-ons */}
      {pastAddons.length > 0 && (
        <div className="space-y-3">
          <Separator />
          <h2 className="text-lg font-semibold text-muted-foreground">
            Historique
          </h2>
          {pastAddons.map((addon) => (
            <AddonCard
              key={addon.id}
              id={addon.id}
              addonType={addon.addon_type}
              status={addon.status}
              quantity={addon.quantity}
              consumedCount={addon.consumed_count}
              purchasedAt={addon.purchased_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}
