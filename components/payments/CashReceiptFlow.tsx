"use client";

/**
 * CashReceiptFlow - Flux complet de paiement en espèces
 * Génère un reçu avec double signature tactile (propriétaire + locataire)
 * SOTA 2025 avec animations, géolocalisation et PDF sécurisé
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
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  MapPin,
  Send,
  User,
  Users,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface CashReceiptFlowProps {
  invoiceId: string;
  amount: number;
  tenantName: string;
  ownerName: string;
  propertyAddress: string;
  periode: string;
  /** Mode rapide: combine info + signature proprio en une seule étape */
  quickMode?: boolean;
  onComplete?: (receiptData: ReceiptResult) => void;
  onCancel?: () => void;
}

interface ReceiptResult {
  receiptId: string;
  receiptNumber: string;
  pdfUrl: string | null;
  documentHash: string;
}

type Step = "info" | "owner-sign" | "combined" | "tenant-sign" | "generating" | "complete";

// Animation variants
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
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
  quickMode = true, // Par défaut en mode rapide
  onComplete,
  onCancel,
}: CashReceiptFlowProps) {
  const { toast } = useToast();

  // Refs signatures
  const ownerSignatureRef = useRef<SignaturePadRef>(null);
  const tenantSignatureRef = useRef<SignaturePadRef>(null);

  // État - en mode rapide, commencer par l'étape combinée
  const [step, setStep] = useState<Step>(quickMode ? "combined" : "info");
  const [direction, setDirection] = useState(0);
  const [ownerSignature, setOwnerSignature] = useState<string | null>(null);
  const [ownerSignedAt, setOwnerSignedAt] = useState<Date | null>(null);
  const [tenantSignature, setTenantSignature] = useState<string | null>(null);
  const [tenantSignedAt, setTenantSignedAt] = useState<Date | null>(null);
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
          console.log("Géolocalisation non disponible:", error);
          setGeoError("Position non disponible");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  // Montant en lettres (approximatif côté client)
  const amountFormatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(parseFloat(actualAmount) || amount);

  // Navigation
  const goToStep = (newStep: Step, dir: number = 1) => {
    setDirection(dir);
    setStep(newStep);
    setCanProceed(false);
  };

  // Valider signature propriétaire
  const handleOwnerSign = () => {
    if (!ownerSignatureRef.current || ownerSignatureRef.current.isEmpty()) {
      toast({
        title: "Signature requise",
        description: "Veuillez signer avant de continuer.",
        variant: "destructive",
      });
      return;
    }

    setOwnerSignature(ownerSignatureRef.current.toDataURL());
    setOwnerSignedAt(new Date());
    goToStep("tenant-sign", 1);
  };

  // Valider signature locataire et générer le reçu
  const handleTenantSign = async () => {
    if (!tenantSignatureRef.current || tenantSignatureRef.current.isEmpty()) {
      toast({
        title: "Signature requise",
        description: "Le locataire doit signer.",
        variant: "destructive",
      });
      return;
    }

    const tenantSig = tenantSignatureRef.current.toDataURL();
    setTenantSignature(tenantSig);
    setTenantSignedAt(new Date());
    goToStep("generating", 1);
    setLoading(true);

    try {
      const response = await fetch("/api/payments/cash-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId,
          amount: parseFloat(actualAmount) || amount,
          owner_signature: ownerSignature,
          tenant_signature: tenantSig,
          owner_signed_at: ownerSignedAt?.toISOString(),
          tenant_signed_at: new Date().toISOString(),
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
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la génération");
      }

      const data = await response.json();
      setReceiptResult({
        receiptId: data.receipt_id,
        receiptNumber: data.receipt_number,
        pdfUrl: data.pdf_url,
        documentHash: data.document_hash,
      });
      goToStep("complete", 1);

      toast({
        title: "✅ Reçu généré avec succès",
        description: `Reçu ${data.receipt_number} créé et envoyé.`,
      });

      onComplete?.(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
      goToStep("tenant-sign", -1);
    } finally {
      setLoading(false);
    }
  };

  // Rendu
  return (
    <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-xl">
      {/* Header avec progression */}
      <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Banknote className="w-5 h-5 text-green-600" />
            Reçu de paiement espèces
          </CardTitle>
          <span className="text-2xl font-bold text-green-600">
            {amountFormatted}
          </span>
        </div>

        {/* Barre de progression */}
        <div className="flex gap-1 mt-4">
          {(quickMode ? ["combined", "tenant-sign", "complete"] : ["info", "owner-sign", "tenant-sign", "complete"]).map((s, i) => {
            const steps: Step[] = quickMode
              ? ["combined", "tenant-sign", "generating", "complete"]
              : ["info", "owner-sign", "tenant-sign", "generating", "complete"];
            const currentIndex = steps.indexOf(step);
            const stepIndex = i;

            return (
              <div
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-300",
                  currentIndex >= stepIndex ? "bg-green-500" : "bg-muted"
                )}
              />
            );
          })}
        </div>

        {/* Labels des étapes */}
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          {quickMode ? (
            <>
              <span>Propriétaire</span>
              <span>Locataire</span>
              <span>Terminé</span>
            </>
          ) : (
            <>
              <span>Infos</span>
              <span>Propriétaire</span>
              <span>Locataire</span>
              <span>Terminé</span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ÉTAPE 1: Informations */}
          {step === "info" && (
            <motion.div
              key="info"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-4"
            >
              {/* Résumé */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Propriétaire
                  </span>
                  <span className="font-medium">{ownerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Locataire
                  </span>
                  <span className="font-medium">{tenantName}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground text-sm">Logement</span>
                  <span className="font-medium text-right text-sm max-w-[200px]">
                    {propertyAddress}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Période</span>
                  <span className="font-medium">{periode}</span>
                </div>
                <hr className="border-border/50" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Montant reçu
                  </span>
                  <Input
                    type="number"
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    className="w-32 text-right font-bold text-lg"
                    step="0.01"
                  />
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
                <label className="text-sm font-medium text-muted-foreground">
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

              {/* Métadonnées */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr })}
                </div>
                {geolocation ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <MapPin className="w-3 h-3" />
                    Position enregistrée
                  </div>
                ) : geoError ? (
                  <div className="flex items-center gap-1 text-amber-600">
                    <MapPin className="w-3 h-3" />
                    {geoError}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Géolocalisation...
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => goToStep("owner-sign", 1)}
                  className="flex-1 gap-2"
                >
                  Continuer
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* MODE RAPIDE: Étape combinée (infos + signature propriétaire) */}
          {step === "combined" && (
            <motion.div
              key="combined"
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
                  <span className="text-muted-foreground">De</span>
                  <span className="font-medium">{tenantName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">À</span>
                  <span className="font-medium">{ownerName}</span>
                </div>
                <hr className="border-border/50" />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Montant</span>
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
              </div>

              {/* Signature propriétaire intégrée */}
              <div className="border-2 border-primary/20 rounded-xl p-4 bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{ownerName} - Je confirme recevoir ce paiement</span>
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
                ) : null}
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
                  onClick={handleOwnerSign}
                  disabled={!canProceed}
                  className="flex-1 gap-2"
                >
                  <Check className="w-4 h-4" />
                  Passer au locataire
                </Button>
              </div>
            </motion.div>
          )}

          {/* ÉTAPE 2: Signature Propriétaire (mode classique) */}
          {step === "owner-sign" && (
            <motion.div
              key="owner-sign"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{ownerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Propriétaire - Confirme recevoir {amountFormatted}
                  </p>
                </div>
              </div>

              <SignaturePad
                ref={ownerSignatureRef}
                label="Votre signature"
                onSignatureChange={(isEmpty) => setCanProceed(!isEmpty)}
                height={180}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => goToStep("info", -1)}
                  className="gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Retour
                </Button>
                <Button
                  onClick={handleOwnerSign}
                  disabled={!canProceed}
                  className="flex-1 gap-2"
                >
                  <Check className="w-4 h-4" />
                  Valider ma signature
                </Button>
              </div>
            </motion.div>
          )}

          {/* ÉTAPE 3: Signature Locataire */}
          {step === "tenant-sign" && (
            <motion.div
              key="tenant-sign"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-4"
            >
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Passez le téléphone au locataire
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      {tenantName} doit maintenant signer pour confirmer avoir
                      remis {amountFormatted} en espèces.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{tenantName}</p>
                  <p className="text-xs text-muted-foreground">
                    Locataire - Confirme remettre {amountFormatted}
                  </p>
                </div>
              </div>

              <SignaturePad
                ref={tenantSignatureRef}
                label="Signature du locataire"
                onSignatureChange={(isEmpty) => setCanProceed(!isEmpty)}
                height={180}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => goToStep("owner-sign", -1)}
                  className="gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Retour
                </Button>
                <Button
                  onClick={handleTenantSign}
                  disabled={!canProceed || loading}
                  className="flex-1 gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Valider et générer le reçu
                </Button>
              </div>
            </motion.div>
          )}

          {/* ÉTAPE 4: Génération */}
          {step === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 space-y-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-16 h-16 text-primary mx-auto" />
              </motion.div>
              <div>
                <p className="font-medium text-lg">Génération du reçu...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Création du PDF et envoi par email
                </p>
              </div>
            </motion.div>
          )}

          {/* ÉTAPE 5: Terminé */}
          {step === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8 space-y-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto"
              >
                <Check className="w-10 h-10 text-green-600" />
              </motion.div>

              <div>
                <p className="text-xl font-bold text-foreground">
                  Reçu généré avec succès !
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {receiptResult?.receiptNumber}
                </p>
              </div>

              {/* Résumé */}
              <div className="bg-muted/50 rounded-xl p-4 text-sm space-y-2 text-left">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-4 h-4" />
                  Signatures enregistrées
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {format(new Date(), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                </div>
                {geolocation && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {geolocation.lat.toFixed(4)}, {geolocation.lng.toFixed(4)}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  Hash: {receiptResult?.documentHash?.slice(0, 16)}...
                </div>
              </div>

              {/* Notification envoi */}
              <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                <Send className="w-4 h-4" />
                Envoyé à {ownerName} et {tenantName}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                {receiptResult?.pdfUrl && (
                  <Button variant="outline" asChild className="flex-1 gap-2">
                    <a
                      href={receiptResult.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger PDF
                    </a>
                  </Button>
                )}
                <Button onClick={onCancel} className="flex-1 gap-2">
                  <Check className="w-4 h-4" />
                  Terminé
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

