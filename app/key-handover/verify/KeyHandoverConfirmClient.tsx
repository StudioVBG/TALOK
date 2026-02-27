"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { SignaturePad, type SignatureData } from "@/components/signature/SignaturePad";
import { PageTransition } from "@/components/ui/page-transition";
import {
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  ShieldCheck,
  ChevronRight,
  Home,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface KeyHandoverConfirmClientProps {
  token: string;
  leaseId: string;
}

interface KeyItem {
  type: string;
  quantite?: number;
  quantity?: number;
  observations?: string;
}

export default function KeyHandoverConfirmClient({ token, leaseId }: KeyHandoverConfirmClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<"review" | "sign" | "success">("review");
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geolocation, setGeolocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [handoverInfo, setHandoverInfo] = useState<{
    keys: KeyItem[];
    property_address: string;
    expires_at: string;
  } | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // Load handover info
  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await fetch(`/api/leases/${leaseId}/key-handover`);
        if (res.ok) {
          const data = await res.json();
          if (data.confirmed) {
            setStep("success");
          }
          if (data.handover) {
            setHandoverInfo({
              keys: data.handover.keys_list || [],
              property_address: "",
              expires_at: data.handover.expires_at,
            });
          }
        }
      } catch {
        // Ignore
      } finally {
        setLoadingInfo(false);
      }
    }
    loadInfo();
  }, [leaseId]);

  // Request geolocation
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeolocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        // Geolocation is optional, don't block the flow
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    requestGeolocation();
  }, [requestGeolocation]);

  const handleSign = async (signatureData: SignatureData) => {
    if (!signatureData.data) return;
    setError(null);
    setIsSigning(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/key-handover/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          signature: signatureData.data,
          metadata: signatureData.metadata,
          geolocation,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la confirmation");
      }

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la confirmation");
    } finally {
      setIsSigning(false);
    }
  };

  if (loadingInfo) {
    return (
      <div className="container mx-auto px-4 max-w-lg py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (step === "success") {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 max-w-lg space-y-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-4"
          >
            <div className="inline-flex items-center justify-center p-4 bg-emerald-100 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-black text-slate-900">Clés reçues !</h1>
            <p className="text-slate-500 text-lg">
              La remise des clés a été confirmée avec succès.
              Une attestation est disponible dans vos documents.
            </p>
          </motion.div>

          <GlassCard className="p-6 bg-emerald-50 border-emerald-200 space-y-3">
            <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">
              Preuve enregistrée
            </h4>
            <div className="space-y-2 text-sm text-emerald-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Signature électronique horodatée</span>
              </div>
              {geolocation && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>Position géolocalisée enregistrée</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                <span>Preuve cryptographique SHA-256</span>
              </div>
            </div>
          </GlassCard>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => router.push("/tenant/documents")}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
            >
              <FileText className="h-4 w-4 mr-2" />
              Voir mes documents
            </Button>
            <Button
              onClick={() => router.push("/tenant/dashboard")}
              variant="outline"
              className="w-full h-12 rounded-xl font-bold"
            >
              Retour au tableau de bord
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  const keys = handoverInfo?.keys || [];

  return (
    <PageTransition>
      <div className="container mx-auto px-4 max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-2">
            <Key className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900">Remise des clés</h1>
          <p className="text-slate-500 text-lg">
            Vérifiez les clés et confirmez la réception
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-4">
          <div className={cn(
            "h-2 w-24 rounded-full transition-all",
            step === "review" ? "bg-indigo-600" : "bg-emerald-500"
          )} />
          <div className={cn(
            "h-2 w-24 rounded-full transition-all",
            step === "sign" ? "bg-indigo-600" : "bg-slate-200"
          )} />
        </div>

        {step === "review" ? (
          <div className="space-y-6">
            {/* Keys list */}
            <GlassCard className="p-6 border-slate-200 bg-white shadow-xl space-y-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-600" />
                Clés à recevoir
              </h3>

              {keys.length > 0 ? (
                <div className="space-y-2">
                  {keys.map((key: KeyItem, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <Key className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{key.type}</p>
                          {key.observations && (
                            <p className="text-xs text-slate-500">{key.observations}</p>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-700 font-bold">
                        x{key.quantite || key.quantity || 1}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune clé spécifiée dans l&apos;EDL.</p>
              )}
            </GlassCard>

            {/* Geolocation status */}
            <div className="flex items-center gap-2 justify-center text-sm">
              {geoLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  <span className="text-slate-400">Géolocalisation en cours...</span>
                </>
              ) : geolocation ? (
                <>
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">Position enregistrée</span>
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-400">Géolocalisation non disponible</span>
                </>
              )}
            </div>

            <Button
              onClick={() => setStep("sign")}
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-indigo-100 group"
            >
              Je confirme avoir reçu les clés
              <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <GlassCard className="p-6 border-none shadow-2xl bg-white space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">Apposez votre signature</h3>
                <p className="text-sm text-slate-500">
                  En signant, vous confirmez avoir reçu toutes les clés listées ci-dessus.
                </p>
              </div>
              <SignaturePad
                signerName="Locataire"
                onSignatureComplete={handleSign}
                disabled={isSigning}
              />
            </GlassCard>

            <Button
              variant="ghost"
              onClick={() => { setStep("review"); setError(null); }}
              className="w-full h-11 text-slate-400 font-bold"
            >
              Retour à la vérification
            </Button>
          </div>
        )}

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" />
            Preuve horodatée et géolocalisée conforme eIDAS
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
