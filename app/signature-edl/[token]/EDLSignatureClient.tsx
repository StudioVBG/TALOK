"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
  FileText,
  Home,
  Calendar,
  PenTool,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { formatDateShort } from "@/lib/helpers/format";
import { SignaturePad, type SignatureData } from "@/components/signature/SignaturePad";
import { EDLPreview } from "@/features/edl/components/edl-preview";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface EDLSignatureClientProps {
  token: string;
  edl: any;
  property: any;
  signatureId: string;
  identityComplete: boolean;
  leaseId: string;
  /** HTML pré-généré côté serveur (évite un second fetch) */
  previewHtml?: string;
}

export default function EDLSignatureClient({
  token,
  edl,
  property,
  signatureId,
  identityComplete,
  leaseId,
  previewHtml: initialPreviewHtml = "",
}: EDLSignatureClientProps) {
  const router = useRouter();
  const [isSigning, setIsSigning] = useState(false);
  const [step, setStep] = useState<"preview" | "sign">("preview");
  const [html, setHtml] = useState<string>(initialPreviewHtml);
  const [loadingPreview, setLoadingPreview] = useState(!initialPreviewHtml);
  const [signError, setSignError] = useState<string | null>(null);

  // Si le serveur n'a pas fourni de HTML (fallback), charger l'aperçu via l'API
  useEffect(() => {
    if (initialPreviewHtml) return;
    let cancelled = false;
    async function loadPreview() {
      try {
        const response = await fetch(`/api/signature/edl/${token}/preview`, {
          method: "POST",
        });
        const data = await response.json();
        if (!cancelled && data.html) setHtml(data.html);
      } catch (err) {
        if (!cancelled) console.error("Preview load failed", err);
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }
    loadPreview();
    return () => { cancelled = true; };
  }, [token, initialPreviewHtml]);

  const handleSign = async (signatureData: SignatureData) => {
    setSignError(null);
    setIsSigning(true);
    try {
      const response = await fetch(`/api/signature/edl/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: signatureData.data,
          metadata: signatureData.metadata,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message =
          response.status === 410
            ? "Ce lien a expiré. Demandez un nouveau lien à votre propriétaire."
            : (err.error as string) || "Erreur lors de la signature";
        setSignError(message);
        return;
      }

      router.push(`/tenant/inspections/${edl.id}`);
    } catch (error: unknown) {
      console.error("Erreur signature:", error);
      setSignError((error as Error).message);
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-4">
            <FileText className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900">
            Signature de votre EDL
          </h1>
          <p className="text-slate-500 text-lg">
            État des lieux {edl.type === "entree" ? "d'entrée" : "de sortie"}
          </p>
        </div>

        {/* Property Card */}
        <GlassCard className="p-6 border-slate-200 bg-white shadow-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-slate-50 rounded-xl">
              <Home className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-lg">
                {property.adresse_complete}
              </p>
              <p className="text-slate-500">
                {property.code_postal} {property.ville}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="secondary" className="font-bold">
                  {edl.type === "entree" ? "Entrée" : "Sortie"}
                </Badge>
                <span className="text-sm text-slate-400 flex items-center gap-1.5 font-medium">
                  <Calendar className="h-4 w-4" />
                  {formatDateShort(edl.scheduled_at || edl.created_at)}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* CTA bloquant : vérification d'identité requise */}
        {!identityComplete && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                  <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                    Vérification d&apos;identité requise
                  </CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">
                    Avant de signer l&apos;état des lieux, vous devez valider votre identité en fournissant votre CNI (recto + verso).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <Link
                href={leaseId ? `/tenant/identity/renew?lease_id=${leaseId}&redirect_to=${encodeURIComponent(`/signature-edl/${token}`)}` : "/tenant/identity"}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl font-bold text-lg h-14 px-8",
                  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30"
                )}
              >
                <ShieldCheck className="mr-2 h-5 w-5" />
                Vérifier mon identité
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Stepper et contenu signature (masqués si identité non complète) */}
        {identityComplete && (
        <>
        {/* Stepper */}
        <div className="flex items-center justify-center gap-4">
          <div className={cn(
            "h-2 w-24 rounded-full transition-all",
            step === "preview" ? "bg-indigo-600" : "bg-emerald-500"
          )} />
          <div className={cn(
            "h-2 w-24 rounded-full transition-all",
            step === "sign" ? "bg-indigo-600" : "bg-slate-200"
          )} />
        </div>

        {step === "preview" ? (
          <div className="space-y-6">
            <Card className="border-none shadow-2xl overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Vérification du document</CardTitle>
                    <CardDescription className="text-slate-400">
                      Veuillez relire attentivement l'état des lieux
                    </CardDescription>
                  </div>
                  <ShieldCheck className="h-10 w-10 text-indigo-400 opacity-50" />
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-slate-50">
                <div className="h-[60vh] overflow-y-auto custom-scrollbar">
                  {loadingPreview ? (
                    <div className="p-12 text-center text-slate-400 space-y-4">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto text-indigo-600" />
                      <p className="font-bold">Génération de l'aperçu sécurisé...</p>
                    </div>
                  ) : (
                    <iframe 
                      srcDoc={html} 
                      className="w-full h-full border-none bg-white" 
                      style={{ minHeight: '800px' }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={() => setStep("sign")}
              className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-indigo-100 group transition-all"
            >
              Continuer vers la signature
              <ChevronRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {signError && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{signError}</AlertDescription>
              </Alert>
            )}
            <Card className="border-none shadow-2xl overflow-hidden bg-white">
              <CardHeader className="p-8 border-b border-slate-100">
                <CardTitle className="text-2xl font-black">Apposez votre signature</CardTitle>
                <CardDescription className="text-lg">
                  En signant, vous validez l&apos;état général du logement et les relevés techniques.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <SignaturePad
                  signerName={edl?.tenant_name || edl?.signer_name || "Locataire"}
                  onSignatureComplete={handleSign}
                  disabled={isSigning}
                />
              </CardContent>
            </Card>

            <Button
              variant="ghost"
              onClick={() => { setStep("preview"); setSignError(null); }}
              className="w-full text-slate-400 font-bold hover:text-slate-600"
            >
              Retour à l&apos;aperçu
            </Button>
          </div>
        )}

        <div className="pt-8 text-center border-t border-slate-200">
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" />
            Signature électronique sécurisée conforme eIDAS
          </div>
        </div>
        </>
        )}
      </div>
    </PageTransition>
  );
}

