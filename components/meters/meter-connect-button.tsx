"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { MeterType } from "@/lib/services/meters/types";

interface MeterConnectButtonProps {
  meterId: string;
  meterType: MeterType;
  isConnected: boolean;
  onConnectionChange?: () => void;
}

export function MeterConnectButton({
  meterId,
  meterType,
  isConnected,
  onConnectionChange,
}: MeterConnectButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Water meters can't be connected in V1
  if (meterType === "water") {
    return null;
  }

  const providerLabel = meterType === "electricity" ? "Enedis" : "GRDF";

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/property-meters/${meterId}/connect`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        toast({
          title: "Connexion impossible",
          description: data.error || "Erreur lors de la connexion",
          variant: "destructive",
        });
        return;
      }

      const { auth_url } = await response.json();
      // Redirect to OAuth provider
      window.location.href = auth_url;
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'initier la connexion",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/property-meters/${meterId}/disconnect`, {
        method: "POST",
      });

      if (response.ok) {
        toast({ title: "Compteur deconnecte" });
        setShowDisconnectDialog(false);
        onConnectionChange?.();
      } else {
        const data = await response.json();
        toast({
          title: "Erreur",
          description: data.error || "Erreur lors de la deconnexion",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de deconnecter le compteur",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isConnected) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl text-xs"
          onClick={() => setShowDisconnectDialog(true)}
        >
          <WifiOff className="h-3.5 w-3.5" />
          Deconnecter
        </Button>

        <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <DialogContent className="sm:max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle>Deconnecter le compteur ?</DialogTitle>
              <DialogDescription>
                Le consentement {providerLabel} sera revoque. Les releves existants seront conserves.
                Vous pourrez reconnecter le compteur ulterieurement.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setShowDisconnectDialog(false)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Deconnecter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Button
      size="sm"
      className="gap-2 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
      onClick={handleConnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="animate-spin h-3.5 w-3.5" />
      ) : (
        <Wifi className="h-3.5 w-3.5" />
      )}
      Connecter {providerLabel}
    </Button>
  );
}
