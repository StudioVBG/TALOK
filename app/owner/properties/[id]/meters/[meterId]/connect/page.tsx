"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Loader2, ArrowLeft, Wifi, Shield, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { METER_CONFIG, ConsentBanner } from "@/components/meters";
import { cn } from "@/lib/utils";
import type { PropertyMeter } from "@/lib/services/meters/types";

export default function MeterConnectPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const propertyId = params.id as string;
  const meterId = params.meterId as string;

  const [meter, setMeter] = useState<PropertyMeter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const fetchMeter = async () => {
      try {
        const res = await fetch(`/api/property-meters?property_id=${propertyId}`);
        if (res.ok) {
          const data = await res.json();
          const found = (data.meters || []).find((m: PropertyMeter) => m.id === meterId);
          if (found) setMeter(found);
        }
      } catch {
        // handled below
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeter();
  }, [propertyId, meterId]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch(`/api/property-meters/${meterId}/connect`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        toast({
          title: "Connexion impossible",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      const { auth_url } = await response.json();
      window.location.href = auth_url;
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!meter) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Compteur non trouve</h1>
        <Button onClick={() => router.back()}>Retour</Button>
      </div>
    );
  }

  if (meter.is_connected) {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 py-12 max-w-lg text-center space-y-6">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-bold">Compteur deja connecte</h1>
          <p className="text-muted-foreground">
            Ce compteur est deja connecte et les releves sont synchronises automatiquement.
          </p>
          <Button
            onClick={() => router.push(`/owner/properties/${propertyId}/meters/${meterId}`)}
          >
            Voir le detail
          </Button>
        </div>
      </PageTransition>
    );
  }

  const config = METER_CONFIG[meter.meter_type] || METER_CONFIG.other;
  const providerName = meter.meter_type === "electricity" ? "Enedis" : "GRDF";

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-lg space-y-8">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => router.push(`/owner/properties/${propertyId}/meters/${meterId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>

        <GlassCard className="p-8 text-center space-y-6">
          <div className={cn("h-20 w-20 rounded-full flex items-center justify-center mx-auto", config.bgColor)}>
            <Wifi className={cn("h-10 w-10", config.color)} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Connecter {providerName}
            </h1>
            <p className="text-muted-foreground mt-2">
              Compteur {config.label} - Ref: {meter.meter_reference}
            </p>
          </div>

          <div className="text-left space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3 items-start">
              <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-emerald-600 text-xs font-bold">1</span>
              </div>
              <p>Vous allez etre redirige vers {providerName} pour autoriser l'acces a vos donnees</p>
            </div>
            <div className="flex gap-3 items-start">
              <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-emerald-600 text-xs font-bold">2</span>
              </div>
              <p>Le locataire (titulaire du contrat) devra donner son consentement</p>
            </div>
            <div className="flex gap-3 items-start">
              <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-emerald-600 text-xs font-bold">3</span>
              </div>
              <p>Les releves seront synchronises automatiquement chaque jour</p>
            </div>
          </div>

          {(meter.meter_type === "electricity" || meter.meter_type === "gas") && (
            <ConsentBanner
              provider={meter.meter_type === "electricity" ? "enedis" : "grdf"}
            />
          )}

          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg"
          >
            {isConnecting ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                <Shield className="h-5 w-5 mr-2" />
                Connexion securisee {providerName}
              </>
            )}
          </Button>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
