"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { FileSignature, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck, Loader2 } from "lucide-react";
import { LeasePreview } from "@/components/documents/LeasePreview";
import { useTenantData } from "../../_data/TenantDataProvider";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function TenantSignLeasePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { dashboard } = useTenantData();
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const leaseId = dashboard?.lease?.id;

  // Debug: log the state to help identify issues
  useEffect(() => {
    if (dashboard) {
      console.log("[TenantSignLeasePage] Dashboard loaded, leaseId:", leaseId);
    }
  }, [dashboard, leaseId]);

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
        router.push("/tenant/dashboard");
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
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header compact */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
            <FileSignature className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Signature du bail</h1>
            <p className="text-xs text-slate-500 font-medium">Étape finale de votre emménagement</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Certifié eIDAS</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Panneau Gauche : Aperçu du bail */}
        <div className="lg:col-span-7 p-6 overflow-y-auto bg-slate-100/50">
          {leaseId ? (
            <div className="max-w-4xl mx-auto shadow-2xl rounded-2xl overflow-hidden bg-white ring-1 ring-slate-200">
              <LeasePreview leaseId={leaseId} />
            </div>
          ) : !dashboard ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-600">Récupération de votre dossier...</h3>
              <p className="text-slate-400 max-w-sm mt-2">Nous préparons votre espace de signature.</p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <div className="h-20 w-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="h-10 w-10 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Aucun bail en attente</h3>
              <p className="text-slate-500 max-w-sm mt-2">
                Nous n'avons pas trouvé de contrat prêt pour la signature. 
                Si vous venez de recevoir l'invitation, essayez de rafraîchir la page.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>
                Rafraîchir la page
              </Button>
            </div>
          )}
        </div>

        {/* Panneau Droite : Actions de signature */}
        <div className="lg:col-span-5 p-8 bg-white border-l border-slate-200 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] overflow-y-auto">
          <div className="max-w-md mx-auto space-y-8">
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                    <strong>Note importante :</strong> Veuillez relire attentivement l'intégralité du document à gauche avant de procéder à la signature. Cette action a une valeur juridique légale.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-4 border-t border-slate-100">
              <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-indigo-600" />
                Validation & Engagement
              </h4>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group" onClick={() => setAccepted(!accepted)}>
                  <Checkbox 
                    id="accept-lease" 
                    checked={accepted} 
                    onCheckedChange={(checked) => setAccepted(!!checked)}
                    className="mt-1 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                  <label htmlFor="accept-lease" className="text-sm font-semibold text-slate-700 leading-snug cursor-pointer">
                    Je certifie avoir lu et accepté toutes les clauses du présent bail de location ainsi que ses annexes.
                  </label>
                </div>

                <Button 
                  onClick={handleSign} 
                  disabled={loading || !accepted || !leaseId} 
                  className={cn(
                    "w-full h-14 rounded-2xl text-lg font-black transition-all shadow-xl",
                    accepted && !loading ? "bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] shadow-indigo-200" : "bg-slate-200 text-slate-400"
                  )}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Signature en cours...
                    </div>
                  ) : (
                    <>
                      <FileSignature className="mr-3 h-6 w-6" />
                      Signer électroniquement
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-6 pt-8 border-t border-slate-100 opacity-50">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Étape suivante</h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                <p className="text-sm text-slate-400 font-bold mb-1">Dépôt de garantie</p>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Après signature, vous devrez effectuer le versement de votre dépôt de garantie pour valider définitivement votre dossier.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

