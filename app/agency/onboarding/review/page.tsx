"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Loader2, Sparkles } from "lucide-react";

export default function AgencyReviewOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await apiClient.post("/me/onboarding-complete");
      await onboardingService.markStepCompleted("review", "agency");

      toast({
        title: "Votre agence est configuree !",
        description: "Bienvenue sur Talok. Commencez a gerer vos mandats.",
      });

      router.push("/agency/dashboard");
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de finaliser. Veuillez reessayer.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Tout est pret !</CardTitle>
          <CardDescription className="text-base">
            Votre espace agence est configure. Vous pouvez maintenant commencer a gerer vos mandats et vos
            proprietaires sur Talok.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-3">
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Prochaines etapes recommandees
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">1.</span>
                <span>Ajoutez vos premiers proprietaires et leurs biens</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">2.</span>
                <span>Creez vos mandats de gestion</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">3.</span>
                <span>Invitez vos locataires a rejoindre la plateforme</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">4.</span>
                <span>Configurez les automatisations de paiement</span>
              </li>
            </ul>
          </div>

          <Button onClick={handleComplete} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Acceder a mon tableau de bord
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
