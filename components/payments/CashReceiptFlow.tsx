"use client";

/**
 * CashReceiptFlow - Flux SOTA 2026 pour le reçu espèces
 *
 * Nouveau flow (deux étapes):
 *  1. Le propriétaire signe sur SON espace — ce composant.
 *  2. Une notification est envoyée au locataire qui signe depuis
 *     SON espace (cf. /tenant/payments/cash-receipt/[id]).
 *
 * Ce composant ne demande donc PLUS de passer le téléphone au locataire.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { SignaturePad, type SignaturePadRef } from "./SignaturePad";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Banknote,
  Check,
  Clock,
  Loader2,
  MapPin,
  Send,
  User,
  AlertTriangle,
  Shield,
  Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CashReceiptFlowProps {
  invoiceId: string;
  amount: number;
  tenantName: string;
  ownerName: string;
  propertyAddress: string;
  periode: string;
  onComplete?: (receiptData: ReceiptResult) => void;
  onCancel?: () => void;
}

interface ReceiptResult {
  receiptId: string;
  receiptNumber: string;
  status: string;
  actionUrl: string | null;
}

type Step = "sign" | "submitting" | "pending";

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export function CashReceiptFlow({
  invoiceId,
  amount,
  tenantName,
  ownerName,
  propertyAddress,
  periode,
  onComplete,
  onCancel,
}: CashReceiptFlowProps) {
  const { toast } = useToast();

  const ownerSignatureRef = useRef<SignaturePadRef>(null);

  const [step, setStep] = useState<Step>("sign");
  const [direction, setDirection] = useState(0);
  const [canProceed, setCanProceed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geolocation, setGeolocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);
  const [actualAmount, setActualAmount] = useState(amount.toString());
  const [notes, setNotes] = useState("");

  // Obtenir géolocalisation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeolocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (error) => {
          console.warn("Géolocalisation non disponible:", error);
          setGeoError("Position non disponible");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  const amountFormatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(parseFloat(actualAmount) || amount);

  const goToStep = (newStep: Step, dir: number = 1) => {
    setDirection(dir);
    setStep(newStep);
    setCanProceed(false);
  };

  const handleOwnerSignAndSend = async () => {
    if (!ownerSignatureRef.current || ownerSignatureRef.current.isEmpty()) {
      toast({
        title: "Signature requise",
        description: "Veuillez signer avant de continuer.",
        variant: "destructive",
      });
      return;
    }

    const ownerSig = ownerSignatureRef.current.toDataURL();
    goToStep("submitting", 1);
    setLoading(true);

    try {
      const response = await fetch("/api/payments/cash-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId,
          amount: parseFloat(actualAmount) || amount,
          owner_signature: ownerSig,
          owner_signed_at: new Date().toISOString(),
          geolocation,
          notes,
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || "Erreur lors de l'envoi du reçu");
      }

      const data = await response.json();
      const result: ReceiptResult = {
        receiptId: data.receipt_id,
        receiptNumber: data.receipt_number,
        status: data.status,
        actionUrl: data.action_url ?? null,
      };
      setReceiptResult(result);
      goToStep("pending", 1);

      toast({
        title: "Notification envoyée",
        description: `${tenantName} doit maintenant signer depuis son espace.`,
      });
      // NB: onComplete est appelé lorsque l'utilisateur clique sur "Fermer"
      // afin qu'il puisse voir l'écran "En attente de signature" avant
      // que la modal ne se ferme.
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
      goToStep("sign", -1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-xl bg-card">
      <CardHeader className="bg-gradient-to-r from-[#2563EB]/10 to-[#2563EB]/5 border-b pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Banknote className="w-5 h-5 text-[#2563EB]" />
            Reçu de paiement espèces
          </CardTitle>
          <span className="text-2xl font-bold text-[#2563EB]">
            {amountFormatted}
          </span>
        </div>

        {/* Barre de progression: Propriétaire → En attente locataire */}
        <div className="flex gap-1 mt-4">
          {(["sign", "pending"] as const).map((s, i) => {
            const currentIndex = step === "pending" ? 1 : 0;
            return (
              <div
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-300",
                  currentIndex >= i ? "bg-[#2563EB]" : "bg-muted"
                )}
              />
            );
          })}
        </div>

        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Votre signature</span>
          <span>Locataire signe</span>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ÉTAPE 1: Signature propriétaire */}
          {step === "sign" && (
            <motion.div
              key="sign"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-4"
            >
              {/* Résumé compact */}
              <div className="bg-muted/50 rounded-xl p-3 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Locataire</span>
                  <span className="font-medium">{tenantName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Logement</span>
                  <span className="font-medium text-right text-xs max-w-[220px] truncate">
                    {propertyAddress}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Période</span>
                  <span className="font-medium">{periode}</span>
                </div>
                <hr className="border-border/50" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Montant reçu</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={actualAmount}
                      onChange={(e) => setActualAmount(e.target.value)}
                      className="w-24 h-8 text-right font-bold"
                      step="0.01"
                    />
                    <span className="text-lg font-bold">€</span>
                  </div>
                </div>
                {parseFloat(actualAmount) !== amount && (
                  <div className="flex items-center gap-2 text-amber-600 text-xs">
                    <AlertTriangle className="w-3 h-3" />
                    Montant différent du loyer attendu ({amount}€)
                  </div>
                )}
              </div>

              {/* Notes optionnelles */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Notes (optionnel)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Reçu en main propre le..."
                  rows={2}
                  className="mt-1"
                />
              </div>

              {/* Signature propriétaire */}
              <div className="border-2 border-[#2563EB]/20 rounded-xl p-4 bg-[#2563EB]/5">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-sm font-medium">
                    {ownerName} — Je confirme recevoir ce paiement
                  </span>
                </div>
                <SignaturePad
                  ref={ownerSignatureRef}
                  label="Signez ici"
                  onSignatureChange={(isEmpty) => setCanProceed(!isEmpty)}
                  height={140}
                />
              </div>

              {/* Métadonnées compactes */}
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(), "dd/MM HH:mm", { locale: fr })}
                </div>
                {geolocation ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <MapPin className="w-3 h-3" />
                    GPS OK
                  </div>
                ) : geoError ? (
                  <div className="flex items-center gap-1 text-amber-600">
                    <MapPin className="w-3 h-3" />
                    {geoError}
                  </div>
                ) : null}
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Sécurisé
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="gap-2"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleOwnerSignAndSend}
                  disabled={!canProceed || loading}
                  className="flex-1 gap-2 bg-[#2563EB] hover:bg-[#2563EB]/90"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Envoyer au locataire
                </Button>
              </div>
            </motion.div>
          )}

          {/* ÉTAPE 2: Envoi en cours */}
          {step === "submitting" && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 space-y-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-16 h-16 text-[#2563EB] mx-auto" />
              </motion.div>
              <div>
                <p className="font-medium text-lg">Envoi en cours…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Notification envoyée au locataire
                </p>
              </div>
            </motion.div>
          )}

          {/* ÉTAPE 3: En attente de la signature du locataire */}
          {step === "pending" && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6 space-y-5"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 bg-[#2563EB]/10 rounded-full flex items-center justify-center mx-auto"
              >
                <Hourglass className="w-10 h-10 text-[#2563EB]" />
              </motion.div>

              <div>
                <p className="text-xl font-bold text-foreground">
                  En attente de signature
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {tenantName} a reçu une notification pour signer
                  le reçu depuis son espace.
                </p>
                {receiptResult?.receiptNumber && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Référence : {receiptResult.receiptNumber}
                  </p>
                )}
              </div>

              <div className="bg-muted/50 rounded-xl p-4 text-sm text-left space-y-2">
                <div className="flex items-center gap-2 text-[#2563EB]">
                  <Check className="w-4 h-4" />
                  Votre signature est enregistrée
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Send className="w-4 h-4" />
                  Notification envoyée au locataire
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hourglass className="w-4 h-4" />
                  Le reçu sera finalisé après signature du locataire
                </div>
              </div>

              <Button
                onClick={() => {
                  if (receiptResult) onComplete?.(receiptResult);
                  onCancel?.();
                }}
                className="w-full gap-2 bg-[#2563EB] hover:bg-[#2563EB]/90"
              >
                <Check className="w-4 h-4" />
                Fermer
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
