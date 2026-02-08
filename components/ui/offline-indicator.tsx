"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { cn } from "@/lib/utils";

/**
 * Displays a fixed banner at the top of the screen when the device is offline.
 * Automatically hides when connectivity is restored.
 *
 * Place this component in a layout that wraps all pages (e.g., owner-app-layout).
 *
 * @example
 * ```tsx
 * <OfflineIndicator />
 * <main>{children}</main>
 * ```
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "fixed top-0 inset-x-0 z-[70] flex items-center justify-center gap-2",
        "bg-destructive text-destructive-foreground",
        "px-4 py-2 text-sm font-medium",
        "animate-in slide-in-from-top duration-300",
        "safe-area-top"
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Hors connexion — Les modifications seront synchronisées au retour du réseau</span>
    </div>
  );
}
