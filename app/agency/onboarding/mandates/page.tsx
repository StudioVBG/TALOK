"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ArrowRight, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const MANDATE_TYPES = [
  {
    id: "gestion",
    label: "Gestion locative",
    description: "Gestion complete des biens de vos clients : loyers, quittances, maintenance",
  },
  {
    id: "location",
    label: "Location",
    description: "Recherche de locataires, visites, etats des lieux, signatures de baux",
  },
  {
    id: "mixte",
    label: "Gestion + Location",
    description: "Offre complete couvrant la mise en location et la gestion au quotidien",
  },
  {
    id: "syndic",
    label: "Syndic de copropriete",
    description: "Gestion des parties communes, assemblees generales, appels de fonds",
  },
] as const;

export default function AgencyMandatesOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  useEffect(() => {
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "agency" && Array.isArray((draft.data as Record<string, unknown>).mandate_types)) {
        setSelectedTypes((draft.data as Record<string, unknown>).mandate_types as string[]);
      }
    });
  }, []);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) => {
      const next = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id];
      onboardingService.saveDraft("agency_mandates", { mandate_types: next }, "agency");
      return next;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      if (selectedTypes.length === 0) {
        toast({ title: "Selectionnez au moins un type de mandat", variant: "destructive" });
        setLoading(false);
        return;
      }

      await onboardingService.markStepCompleted("mandates", "agency");
      toast({ title: "Types de mandats enregistres" });
      router.push("/agency/onboarding/team");
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder. Veuillez reessayer.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Types de mandats</CardTitle>
              <CardDescription>Quels services proposez-vous a vos clients proprietaires ?</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {MANDATE_TYPES.map((type) => {
            const isSelected = selectedTypes.includes(type.id);
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => toggleType(type.id)}
                className={cn(
                  "w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
                  isSelected
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-border hover:border-blue-200 hover:bg-slate-50"
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all",
                    isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300"
                  )}
                >
                  {isSelected && <Check className="h-4 w-4 text-white" />}
                </div>
                <div>
                  <p className="font-medium text-foreground">{type.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                </div>
              </button>
            );
          })}

          <Button onClick={handleSubmit} disabled={loading || selectedTypes.length === 0} className="w-full mt-6">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Continuer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
