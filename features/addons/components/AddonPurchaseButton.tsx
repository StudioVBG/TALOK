"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import type { AddonType } from "@/lib/subscriptions/addon-config";
import { ADDON_CONFIGS } from "@/lib/subscriptions/addon-config";

interface AddonPurchaseButtonProps {
  addonType: AddonType;
  metadata?: Record<string, string>;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function AddonPurchaseButton({
  addonType,
  metadata,
  variant = "default",
  size = "default",
  className,
}: AddonPurchaseButtonProps) {
  const [loading, setLoading] = useState(false);
  const config = ADDON_CONFIGS[addonType];

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions/addons/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addonType, metadata }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        console.error("[AddonPurchase]", data.error);
      }
    } catch (err) {
      console.error("[AddonPurchase]", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handlePurchase}
      loading={loading}
      className={className}
    >
      <ShoppingCart className="mr-2 h-4 w-4" />
      {config.label} — {config.priceLabel}
    </Button>
  );
}
