"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { CheckCircle2, Clock, ArrowRight } from "lucide-react";

export default function ProviderReviewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);

    try {
      // Marquer l'onboarding comme terminé
      // Dans une version complète, cela déclencherait une modération admin
      await onboardingService.saveDraft("provider_review", { submitted: true }, "provider");

      setSubmitted(true);
      toast({
        title: "Profil soumis",
        description: "Votre profil est en attente de validation par un administrateur.",
      });

      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        router.push("/provider/dashboard");
      }, 2000);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
              <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <CardTitle className="text-2xl">En attente de validation</CardTitle>
            <CardDescription>
              Votre profil a été soumis avec succès. Un administrateur va le valider sous peu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Vous recevrez un email une fois votre profil validé. En attendant, vous pouvez accéder à votre tableau de bord avec des fonctionnalités limitées.
            </p>
            <Button onClick={() => router.push("/provider/dashboard")} className="w-full">
              Accéder au tableau de bord
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Récapitulatif et validation</CardTitle>
          <CardDescription>
            Vérifiez vos informations avant de soumettre votre profil
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note :</strong> Dans une version complète, cette page afficherait un récapitulatif de toutes les informations saisies. 
              Une fois soumis, votre profil sera soumis à modération par un administrateur.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span>Profil professionnel complété</span>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span>Services et zones définis</span>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span>Disponibilités configurées</span>
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={loading}>
            {loading ? (
              "Soumission..."
            ) : (
              <>
                Soumettre mon profil
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

