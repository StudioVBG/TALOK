"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { ownerAutomationSchema } from "@/lib/validations/onboarding";
import { Settings, ArrowRight, CheckCircle2 } from "lucide-react";

const AUTOMATION_LEVELS = [
  {
    id: "basique",
    name: "Basique",
    description: "Gestion manuelle, notifications par email",
    features: ["Notifications email", "Tableau de bord simple"],
  },
  {
    id: "standard",
    name: "Standard",
    description: "Automatisation partielle, relances automatiques",
    features: ["Relances automatiques", "Quittances automatiques", "Notifications"],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Automatisation avancée avec intégrations",
    features: ["Tout Standard", "Intégration comptable", "Rapports avancés", "Maintenance préventive"],
  },
  {
    id: "autopilot",
    name: "AutoPilot",
    description: "Gestion entièrement automatisée",
    features: ["Tout Pro", "IA pour optimisations", "Prédictions", "Support prioritaire"],
  },
];

export default function OwnerAutomationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<"basique" | "standard" | "pro" | "autopilot">("standard");

  useEffect(() => {
    // Charger le brouillon si disponible
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "owner") {
        const data = draft.data as any;
        if (data.automation_level) {
          setSelectedLevel(data.automation_level);
        }
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = ownerAutomationSchema.parse({
        automation_level: selectedLevel,
      });

      // Sauvegarder les préférences
      await onboardingService.saveDraft("owner_automation", validated, "owner");
      await onboardingService.markStepCompleted("owner_automation", "owner");

      toast({
        title: "Préférences enregistrées",
        description: "Votre niveau d'automatisation a été configuré.",
      });

      // Rediriger vers les invitations
      router.push("/owner/onboarding/invite");
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            <CardTitle>Niveau d'automatisation</CardTitle>
          </div>
          <CardDescription>
            Choisissez le niveau d'automatisation qui vous convient
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {AUTOMATION_LEVELS.map((level) => (
                <Card
                  key={level.id}
                  className={`cursor-pointer transition-all ${
                    selectedLevel === level.id
                      ? "border-primary ring-2 ring-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedLevel(level.id as any)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{level.name}</CardTitle>
                    <CardDescription>{level.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {level.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "Enregistrement..."
              ) : (
                <>
                  Continuer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

