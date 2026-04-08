"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Package } from "lucide-react";
import { SignatureUsageBar } from "./SignatureUsageBar";
import { StorageUsageBar } from "./StorageUsageBar";
import type { LimitResult } from "@/lib/subscriptions/check-limit";

interface SubscriptionOverviewProps {
  planName: string;
}

export function SubscriptionOverview({ planName }: SubscriptionOverviewProps) {
  const [sigLimits, setSigLimits] = useState<LimitResult | null>(null);
  const [storageLimits, setStorageLimits] = useState<LimitResult | null>(null);
  const [activeAddonsCount, setActiveAddonsCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [sigRes, storageRes, addonsRes] = await Promise.all([
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
          fetch("/api/subscriptions/addons"),
        ]);

        const [sigData, storageData, addonsData] = await Promise.all([
          sigRes.json(),
          storageRes.json(),
          addonsRes.json(),
        ]);

        if (!sigData.error) setSigLimits(sigData);
        if (!storageData.error) setStorageLimits(storageData);
        const active = (addonsData.addons || []).filter(
          (a: any) => a.status === "active"
        );
        setActiveAddonsCount(active.length);
      } catch {
        // silently fail — non-critical
      }
    }
    load();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          Add-ons
          {activeAddonsCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeAddonsCount} actif{activeAddonsCount > 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
        <Link href="/owner/settings/subscription/addons">
          <Button variant="ghost" size="sm" className="gap-1">
            <Package className="h-4 w-4" />
            Gérer
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {sigLimits && (
          <SignatureUsageBar
            used={sigLimits.current}
            planLimit={sigLimits.maxBase}
            addonRemaining={
              sigLimits.maxBase === -1
                ? 0
                : sigLimits.maxWithAddons - sigLimits.maxBase
            }
          />
        )}
        {storageLimits && (
          <StorageUsageBar
            usedMB={storageLimits.current}
            planLimitMB={storageLimits.maxBase}
            addonMB={
              storageLimits.maxBase === -1
                ? 0
                : storageLimits.maxWithAddons - storageLimits.maxBase
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
