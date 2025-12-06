"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, X } from "lucide-react";
import { usePushNotifications } from "@/lib/hooks/use-push-notifications";
import { cn } from "@/lib/utils";

interface PushNotificationPromptProps {
  /** Style de l'affichage: 'banner' ou 'button' */
  variant?: "banner" | "button";
  /** Callback quand la permission est accordée */
  onPermissionGranted?: () => void;
  className?: string;
}

export function PushNotificationPrompt({
  variant = "banner",
  onPermissionGranted,
  className,
}: PushNotificationPromptProps) {
  const { permission, requestPermission, isSupported, isGranted } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Vérifier si déjà dismissed (localStorage)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = localStorage.getItem("push_notification_dismissed");
      if (isDismissed === "true") {
        setDismissed(true);
      }
    }
  }, []);

  const handleRequestPermission = async () => {
    setLoading(true);
    const granted = await requestPermission();
    setLoading(false);
    
    if (granted) {
      onPermissionGranted?.();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("push_notification_dismissed", "true");
    }
  };

  // Ne pas afficher si non supporté, déjà accordé, ou dismissed
  if (!isSupported || isGranted || dismissed || permission === "denied") {
    if (variant === "button" && isGranted) {
      return (
        <Button variant="ghost" size="icon" className={cn("text-emerald-600", className)} disabled>
          <Bell className="h-5 w-5" />
        </Button>
      );
    }
    return null;
  }

  if (variant === "button") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleRequestPermission}
        disabled={loading}
        className={cn("relative", className)}
        title="Activer les notifications"
      >
        <BellOff className="h-5 w-5 text-muted-foreground" />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
      </Button>
    );
  }

  // Banner variant
  return (
    <div className={cn(
      "flex items-center justify-between gap-4 p-4 rounded-lg",
      "bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100",
      className
    )}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-full">
          <Bell className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <p className="font-medium text-slate-900">Activer les notifications</p>
          <p className="text-sm text-muted-foreground">
            Recevez des alertes pour les paiements, tickets et messages importants
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={handleRequestPermission}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {loading ? "..." : "Activer"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default PushNotificationPrompt;

