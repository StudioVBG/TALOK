"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { FileSignature, CheckCircle2 } from "lucide-react";

export default function GuarantorSignPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(false);

  const handleSign = async () => {
    setLoading(true);

    try {
      // TODO: Intégrer avec un service de signature électronique (eIDAS/SES)
      const signaturePayload = "signature_simulee_" + Date.now();

      // Sauvegarder la signature
      await onboardingService.saveDraft("guarantor_signed", { signature_payload: signaturePayload }, "guarantor" as any);
      await onboardingService.markStepCompleted("guarantor_signed", "guarantor" as any);

      setSigned(true);
      toast({
        title: "Acte signé",
        description: "Votre acte de garantie a été signé avec succès !",
      });

      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        router.push("/guarantor");
      }, 2000);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de la signature.",
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
            <CardTitle className="text-2xl">Acte signé !</CardTitle>
            <CardDescription>
              Votre acte de garantie a été signé avec succès. Vous allez être redirigé vers votre tableau de bord.
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
            <CardTitle>Signature de l'acte de garantie</CardTitle>
          </div>
          <CardDescription>
            Signez l'acte de garantie pour finaliser votre engagement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note :</strong> Dans une version complète, cette page intégrerait un service de signature électronique (eIDAS/SES).
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Signature de l'acte</h4>
            <p className="text-sm text-muted-foreground">
              Veuillez lire attentivement l'acte de garantie avant de signer. La signature est définitive.
            </p>
            <Button onClick={handleSign} disabled={loading} className="w-full">
              {loading ? (
                "Signature en cours..."
              ) : (
                <>
                  <FileSignature className="mr-2 h-4 w-4" />
                  Signer l'acte
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

