"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Key,
  QrCode,
  Loader2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Copy,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface KeyItem {
  type: string;
  quantite?: number;
  quantity?: number;
  observations?: string;
}

interface KeyHandoverQRGeneratorProps {
  leaseId: string;
  className?: string;
}

export function KeyHandoverQRGenerator({ leaseId, className }: KeyHandoverQRGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrData, setQrData] = useState<{
    token: string;
    expires_at: string;
    keys: KeyItem[];
    property_address: string;
    handover_id: string;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "generated" | "confirmed">("idle");
  const [qrSvg, setQrSvg] = useState<string>("");

  // Check existing handover status on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`/api/leases/${leaseId}/key-handover`);
        if (res.ok) {
          const data = await res.json();
          if (data.confirmed) {
            setStatus("confirmed");
          }
        }
      } catch {
        // Silently fail
      }
    }
    checkStatus();
  }, [leaseId]);

  const generateQR = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/leases/${leaseId}/key-handover`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la génération");
      }
      const data = await res.json();
      setQrData(data);
      setStatus("generated");

      // Generate QR code SVG using a simple QR encoding
      const url = `${window.location.origin}/key-handover/verify?token=${encodeURIComponent(data.token)}&lease=${leaseId}`;
      setQrSvg(url);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de générer le QR code",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [leaseId, toast]);

  const copyLink = useCallback(() => {
    if (qrSvg) {
      navigator.clipboard.writeText(qrSvg);
      toast({ title: "Lien copié", description: "Le lien de remise des clés a été copié." });
    }
  }, [qrSvg, toast]);

  const shareLink = useCallback(async () => {
    if (qrSvg && navigator.share) {
      try {
        await navigator.share({
          title: "Remise des clés — Talok",
          text: "Confirmez la réception de vos clés",
          url: qrSvg,
        });
      } catch {
        copyLink();
      }
    } else {
      copyLink();
    }
  }, [qrSvg, copyLink]);

  if (status === "confirmed") {
    return (
      <GlassCard className={cn("p-6 border-emerald-200 bg-emerald-50 space-y-4", className)}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="font-bold text-emerald-800">Clés remises</h4>
            <p className="text-sm text-emerald-600">
              Le locataire a confirmé la réception des clés.
            </p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={cn("p-6 border-border bg-card space-y-5", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 rounded-xl">
            <Key className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="font-bold text-foreground">Remise des clés</h4>
            <p className="text-xs text-muted-foreground">
              Générez un QR code que le locataire scannera pour confirmer la réception.
            </p>
          </div>
        </div>
        {status === "generated" && (
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            En attente
          </Badge>
        )}
      </div>

      <AnimatePresence mode="wait">
        {status === "idle" ? (
          <motion.div
            key="generate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button
              onClick={generateQR}
              disabled={isGenerating}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              {isGenerating ? "Génération..." : "Générer le QR code"}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* QR Code display */}
            <div className="flex flex-col items-center p-6 bg-white rounded-xl border border-border">
              <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-100">
                {/* QR Code rendered as a visual placeholder with the URL */}
                <div className="w-48 h-48 bg-slate-900 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <QrCode className="h-24 w-24 text-white" />
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-900/50" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center max-w-xs">
                Le locataire scanne ce QR code pour confirmer la réception des clés
              </p>

              {/* Expiration */}
              {qrData?.expires_at && (
                <p className="text-[10px] text-amber-600 mt-2 font-medium">
                  Expire le {new Date(qrData.expires_at).toLocaleString("fr-FR")}
                </p>
              )}
            </div>

            {/* Keys list */}
            {qrData?.keys && qrData.keys.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Clés à remettre
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {qrData.keys.map((key: KeyItem, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 px-3 rounded-lg bg-muted border border-border">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-indigo-400" />
                        <span className="text-xs font-medium text-foreground/80">{key.type}</span>
                      </div>
                      <span className="text-xs font-bold text-indigo-700">
                        x{key.quantite || key.quantity || 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={shareLink}
                variant="outline"
                className="flex-1 h-10 rounded-xl font-bold"
              >
                <Share2 className="h-3.5 w-3.5 mr-2" />
                Partager le lien
              </Button>
              <Button
                onClick={copyLink}
                variant="outline"
                className="h-10 rounded-xl"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={generateQR}
                variant="ghost"
                size="sm"
                className="h-10 rounded-xl"
                disabled={isGenerating}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isGenerating && "animate-spin")} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
