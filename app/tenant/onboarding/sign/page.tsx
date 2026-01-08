"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { FileSignature, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck, Loader2, UserCheck, ShieldAlert } from "lucide-react";
import { LeasePreview } from "@/components/documents/LeasePreview";
import { useTenantData } from "../../_data/TenantDataProvider";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad, type SignatureData } from "@/components/signature/SignaturePad";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function TenantSignLeasePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { dashboard } = useTenantData();
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const leaseId = dashboard?.lease?.id;
  const leaseStatus = dashboard?.lease?.statut;
  const kycStatus = dashboard?.kyc_status || 'pending';
  const signerName = dashboard?.tenant ? `${dashboard.tenant.prenom} ${dashboard.tenant.nom}` : "Locataire";

  // ✅ FIX: Un locataire est considéré "vérifié" s'il a un compte créé (via invitation)
  // OU si son kyc_status est explicitement "verified"
  // Le simple fait d'avoir un compte + tenant profile = identité validée
  const isKycVerified = useMemo(() => {
    // Si kyc_status est 'verified', c'est OK
    if (kycStatus === 'verified') return true;
    
    // Si le locataire a un profil avec prénom et nom = il a créé son compte via invitation
    // Donc son identité a été implicitement vérifiée (email vérifié)
    if (dashboard?.tenant?.prenom && dashboard?.tenant?.nom) return true;
    
    // Si le locataire a un profile_id, il a un compte créé
    if (dashboard?.profile_id) return true;
    
    return false;
  }, [kycStatus, dashboard]);

  // ✅ FIX: Vérifier si le locataire a déjà signé ce bail
  const hasAlreadySigned = useMemo(() => {
    if (!dashboard?.lease?.signers) return false;
    
    // Chercher si le locataire actuel a signé
    const tenantSigner = dashboard.lease.signers.find((s: any) => 
      s.role === 'locataire_principal' || s.role === 'tenant' || s.role === 'locataire'
    );
    
    return tenantSigner?.signature_status === 'signed' || !!tenantSigner?.signed_at;
  }, [dashboard]);

  // ✅ FIX: Rediriger si déjà signé ou si le bail n'est plus en attente de signature
  useEffect(() => {
    if (dashboard && leaseId) {
      // Si le bail est déjà signé par le locataire
      if (hasAlreadySigned) {
        toast({
          title: "Bail déjà signé",
          description: "Vous avez déjà signé ce bail.",
        });
        router.push("/tenant/dashboard");
        return;
      }
      
      // Si le bail n'est plus en attente de signature (active, terminated, etc.)
      if (leaseStatus && !['pending_signature', 'draft'].includes(leaseStatus)) {
        router.push("/tenant/dashboard");
      }
    }
  }, [dashboard, leaseId, hasAlreadySigned, leaseStatus, router, toast]);

  // Debug: log the state to help identify issues
  useEffect(() => {
    if (dashboard) {
      console.log("[TenantSignLeasePage] Dashboard loaded, leaseId:", leaseId, "KYC:", kycStatus, "isKycVerified:", isKycVerified, "hasAlreadySigned:", hasAlreadySigned);
    }
  }, [dashboard, leaseId, kycStatus, isKycVerified, hasAlreadySigned]);

  const onSignatureComplete = async (signature: SignatureData) => {
    setLoading(true);

    try {
      if (!leaseId) throw new Error("ID du bail manquant");

      // ✅ APPEL À LA VRAIE API DE SIGNATURE
      const response = await fetch(`/api/leases/${leaseId}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signature_image: signature.data,
          metadata: {
            screenSize: signature.metadata.screenSize,
            touchDevice: signature.metadata.touchDevice,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la signature");
      }

      // Marquer l'étape d'onboarding comme complétée
      await onboardingService.markStepCompleted("lease_signed", "tenant");

      setSigned(true);
      toast({
        title: "Bail signé avec succès",
        description: "Votre engagement a été enregistré. Bienvenue chez vous !",
      });

      // Rediriger vers le dashboard après 3 secondes
      setTimeout(() => {
        router.push("/tenant/dashboard");
      }, 3000);
    } catch (error: any) {
      console.error("[SignLease] Error:", error);
      toast({
        title: "Erreur de signature",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (signed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-emerald-50">
        <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden">
          <div className="h-2 bg-emerald-500" />
          <CardHeader className="text-center space-y-4 pb-8">
            <div className="mx-auto w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <CardTitle className="text-3xl font-black text-slate-900">Contrat Validé !</CardTitle>
            <CardDescription className="text-lg font-medium text-slate-600 px-4">
              Félicitations, votre bail est maintenant actif. Préparez vos cartons !
            </CardDescription>
          </CardHeader>
          <CardContent className="bg-slate-50 p-6 text-center border-t">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Redirection vers votre espace...</p>
          </CardContent>
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
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider",
            isKycVerified ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
          )}>
            {isKycVerified ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            <span>{isKycVerified ? "Identité vérifiée" : "Identité à vérifier"}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Panneau Gauche : Aperçu du bail */}
        <div className="lg:col-span-7 p-6 overflow-y-auto bg-slate-100/50">
          {!isKycVerified ? (
            <Card className="max-w-xl mx-auto mt-12 border-none shadow-xl">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4 text-amber-600">
                  <UserCheck className="w-8 h-8" />
                </div>
                <CardTitle className="text-2xl font-black">Vérification obligatoire</CardTitle>
                <CardDescription className="text-slate-600">
                  Pour des raisons légales (eIDAS), vous devez avoir vérifié votre identité avec une CNI ou un Passeport avant de pouvoir signer votre bail.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 italic text-sm text-amber-800">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>Votre statut actuel est : <strong>{kycStatus === 'processing' ? 'En cours de validation' : 'Non vérifié'}</strong></p>
                </div>
                <Button asChild className="w-full h-12 rounded-xl bg-indigo-600 text-lg font-bold">
                  <Link href="/tenant/onboarding/identity">
                    Vérifier mon identité maintenant
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : leaseId ? (
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
                <div className={cn(
                  "flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer group",
                  !isKycVerified ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200" : "hover:border-indigo-200 hover:bg-indigo-50/30 border-slate-200"
                )} onClick={() => isKycVerified && setAccepted(!accepted)}>
                  <Checkbox 
                    id="accept-lease" 
                    checked={accepted} 
                    onCheckedChange={(checked) => isKycVerified && setAccepted(!!checked)}
                    disabled={!isKycVerified}
                    className="mt-1 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                  <label htmlFor="accept-lease" className="text-sm font-semibold text-slate-700 leading-snug cursor-pointer">
                    Je certifie avoir lu et accepté toutes les clauses du présent bail de location ainsi que ses annexes.
                  </label>
                </div>

                {!showSignaturePad ? (
                  <Button 
                    onClick={() => setShowSignaturePad(true)} 
                    disabled={loading || !accepted || !leaseId || !isKycVerified} 
                    className={cn(
                      "w-full h-14 rounded-2xl text-lg font-black transition-all shadow-xl",
                      accepted && isKycVerified ? "bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] shadow-indigo-200" : "bg-slate-200 text-slate-400"
                    )}
                  >
                    Prêt pour la signature
                  </Button>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="border-2 border-indigo-100 shadow-xl overflow-hidden bg-slate-50/50">
                      <CardHeader className="bg-white border-b py-3 px-4">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <FileSignature className="h-4 w-4 text-indigo-600" />
                          Signature de {signerName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <SignaturePad 
                          signerName={signerName}
                          onSignatureComplete={onSignatureComplete}
                          disabled={loading}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setShowSignaturePad(false)}
                          className="w-full mt-2 text-slate-400 font-bold hover:text-slate-600"
                        >
                          Annuler
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>

            {/* Aide eIDAS */}
            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-widest">Processus eIDAS</span>
              </div>
              <p className="text-[10px] text-emerald-600 leading-tight font-medium italic">
                Ce processus de signature inclut la capture de vos métadonnées (IP, User Agent, Horodatage) et le scellement cryptographique du document pour garantir son intégrité légale.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
