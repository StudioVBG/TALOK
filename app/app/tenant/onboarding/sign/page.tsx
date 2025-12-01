"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { FileSignature, ArrowRight, CheckCircle2 } from "lucide-react";

export default function TenantSignLeasePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(false);

  const handleSign = async () => {
    setLoading(true);

    try {
      // TODO: Intégrer avec un service de signature électronique (eIDAS/SES)
      // Pour l'instant, on simule la signature
      const signaturePayload = "signature_simulee_" + Date.now();

      // Sauvegarder la signature
      await onboardingService.saveDraft("lease_signed", { signature_payload: signaturePayload }, "tenant");
      await onboardingService.markStepCompleted("lease_signed", "tenant");

      setSigned(true);
      toast({
        title: "Bail signé",
        description: "Votre bail a été signé avec succès !",
      });

      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        router.push("/app/tenant/dashboard");
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la signature.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (signed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Bail signé !</CardTitle>
            <CardDescription>
              Votre bail a été signé avec succès. Vous allez être redirigé vers votre tableau de bord.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-primary" />
            <CardTitle>Signature du bail & dépôt</CardTitle>
          </div>
          <CardDescription>
            Signez votre bail et effectuez le dépôt de garantie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note :</strong> Dans une version complète, cette page intégrerait un service de signature électronique (eIDAS/SES) et un système de paiement pour le dépôt de garantie.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Signature du bail</h4>
            <p className="text-sm text-muted-foreground">
              Veuillez lire attentivement le bail avant de signer. La signature est définitive.
            </p>
            <Button onClick={handleSign} disabled={loading} className="w-full">
              {loading ? (
                "Signature en cours..."
              ) : (
                <>
                  <FileSignature className="mr-2 h-4 w-4" />
                  Signer le bail
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4 border-t pt-6">
            <h4 className="font-semibold">Dépôt de garantie</h4>
            <p className="text-sm text-muted-foreground">
              Le dépôt de garantie peut être effectué après la signature du bail.
            </p>
            <Button variant="outline" className="w-full" disabled>
              Effectuer le dépôt (bientôt disponible)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

