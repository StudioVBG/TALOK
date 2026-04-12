"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Banknote, Check, Clock, Download, Loader2, MapPin, Shield, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { SignaturePad, type SignaturePadRef } from "@/components/payments/SignaturePad";

interface Props {
  receiptId: string;
  receiptNumber: string;
  amount: number;
  amountWords: string | null;
  periode: string;
  status: string;
  ownerName: string;
  tenantName: string;
  propertyAddress: string;
  ownerSignature: string | null;
  ownerSignedAt: string | null;
  existingTenantSignature: string | null;
  notes: string | null;
}

export function TenantCashReceiptSignatureClient({
  receiptId,
  receiptNumber,
  amount,
  amountWords,
  periode,
  status: initialStatus,
  ownerName,
  tenantName,
  propertyAddress,
  ownerSignature,
  ownerSignedAt,
  existingTenantSignature,
  notes,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const signatureRef = useRef<SignaturePadRef>(null);

  const [status, setStatus] = useState(initialStatus);
  const [canProceed, setCanProceed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geolocation, setGeolocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeolocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.warn("Géolocalisation non disponible:", err);
        setGeoError("Position non disponible");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const amountFormatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);

  const alreadySigned = status === "signed" || status === "sent" || !!existingTenantSignature;

  const handleSubmit = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: "Signature requise",
        description: "Veuillez signer avant de valider.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/payments/cash-receipt/${receiptId}/tenant-sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_signature: signatureRef.current.toDataURL(),
          tenant_signed_at: new Date().toISOString(),
          geolocation,
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
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Erreur lors de la signature");
      }

      setStatus("signed");
      toast({
        title: "Reçu signé",
        description: `Merci, votre paiement est confirmé. Reçu ${receiptNumber}.`,
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <Card className="w-full max-w-lg mx-auto flex flex-col max-h-[90vh] overflow-hidden shadow-xl bg-card">
        <CardHeader className="bg-gradient-to-r from-[#2563EB]/10 to-[#2563EB]/5 border-b pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Banknote className="w-5 h-5 text-[#2563EB]" />
              Reçu de paiement espèces
            </CardTitle>
            <span className="text-2xl font-bold text-[#2563EB]">{amountFormatted}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Référence : {receiptNumber}
          </p>
        </CardHeader>

        <CardContent className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Résumé */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Propriétaire</span>
              <span className="font-medium">{ownerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Locataire</span>
              <span className="font-medium">{tenantName}</span>
            </div>
            {propertyAddress && (
              <div className="flex justify-between items-start gap-4">
                <span className="text-muted-foreground">Logement</span>
                <span className="font-medium text-right">{propertyAddress}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Période</span>
              <span className="font-medium">{periode}</span>
            </div>
            <hr className="border-border/50" />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Montant reçu</span>
              <span className="text-lg font-bold">{amountFormatted}</span>
            </div>
            {amountWords && (
              <p className="text-xs italic text-muted-foreground">
                {amountWords}
              </p>
            )}
            {notes && (
              <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                <span className="font-medium">Notes : </span>{notes}
              </p>
            )}
          </div>

          {/* Signature propriétaire (prévisualisation) */}
          <div className="border rounded-xl p-3 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-[#2563EB]" />
              <span className="text-xs font-medium">
                Signé par {ownerName}
                {ownerSignedAt && (
                  <span className="text-muted-foreground ml-2">
                    {format(new Date(ownerSignedAt), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                  </span>
                )}
              </span>
            </div>
            {ownerSignature && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ownerSignature}
                alt="Signature propriétaire"
                className="h-20 w-full object-contain bg-muted/30 rounded"
              />
            )}
          </div>

          {/* Zone signature locataire ou confirmation */}
          {alreadySigned ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6 space-y-4"
            >
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Reçu déjà signé</p>
                <p className="text-sm text-muted-foreground">
                  Merci ! Votre paiement a bien été confirmé.
                </p>
              </div>

              {/* T5 — Attestation PDF téléchargeable une fois les deux
                  signatures collectées. Le backend retourne 409 si le
                  status n'est pas 'signed'|'sent'|'archived' donc le
                  bouton reste inactif tant que ce n'est pas prêt. */}
              <Button
                asChild
                className="w-full gap-2 bg-[#2563EB] hover:bg-[#2563EB]/90"
              >
                <a
                  href={`/api/payments/cash-receipt/${receiptId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-4 h-4" />
                  Télécharger l'attestation
                </a>
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push("/tenant/payments")}
                className="w-full"
              >
                Retour à mes paiements
              </Button>
            </motion.div>
          ) : (
            <>
              <div className="border-2 border-[#2563EB]/20 rounded-xl p-4 bg-[#2563EB]/5">
                <div className="flex items-start gap-2 mb-3">
                  <User className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0" />
                  <span className="text-sm font-medium leading-tight">
                    {tenantName} — Je confirme avoir effectué ce paiement en espèces
                  </span>
                </div>
                <SignaturePad
                  ref={signatureRef}
                  label="Signez ici"
                  onSignatureChange={(isEmpty) => setCanProceed(!isEmpty)}
                  height={128}
                />
              </div>

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
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Signature légale chiffrée
                </div>
              </div>

              {/* Actions — sticky bottom pour rester visibles sur mobile */}
              <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-card border-t flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push("/tenant/payments")}
                  className="flex-1"
                  disabled={loading}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed || loading}
                  className="flex-1 gap-2 bg-[#2563EB] hover:bg-[#2563EB]/90"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Valider ma signature
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
