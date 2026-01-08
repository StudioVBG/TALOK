"use client";
// @ts-nocheck

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
import {
  FileText,
  Home,
  Calendar,
  PenTool,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { formatDateShort } from "@/lib/helpers/format";
import { SignaturePad, type SignatureData } from "@/components/signature/SignaturePad";
import { EDLPreview } from "@/features/edl/components/edl-preview";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EDLSignatureClientProps {
  token: string;
  edl: any;
  property: any;
  signatureId: string;
}

export default function EDLSignatureClient({
  token,
  edl,
  property,
  signatureId,
}: EDLSignatureClientProps) {
  const router = useRouter();
  const [isSigning, setIsSigning] = useState(false);
  const [step, setStep] = useState<"preview" | "sign">("preview");
  const [html, setHtml] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(true);

  // Charger l'aperçu HTML - ✅ FIX: useEffect au lieu de useState
  useEffect(() => {
    async function loadPreview() {
      try {
        const response = await fetch(`/api/signature/edl/${token}/preview`, {
          method: "POST"
        });
        const data = await response.json();
        if (data.html) setHtml(data.html);
      } catch (err) {
        console.error("Preview load failed", err);
      } finally {
        setLoadingPreview(false);
      }
    }
    loadPreview();
  }, [token]);

  const handleSign = async (signatureData: SignatureData) => {
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
        const err = await response.json();
        throw new Error(err.error || "Erreur lors de la signature");
      }

      router.push(`/tenant/inspections/${edl.id}`);
    } catch (error: any) {
      console.error("Erreur signature:", error);
      alert(error.message);
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
            <Card className="border-none shadow-2xl overflow-hidden bg-white">
              <CardHeader className="p-8 border-b border-slate-100">
                <CardTitle className="text-2xl font-black">Apposez votre signature</CardTitle>
                <CardDescription className="text-lg">
                  En signant, vous validez l'état général du logement et les relevés techniques.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <SignaturePad 
                  signerName="Locataire"
                  onSignatureComplete={handleSign}
                  disabled={isSigning}
                />
              </CardContent>
            </Card>

            <Button 
              variant="ghost" 
              onClick={() => setStep("preview")}
              className="w-full text-slate-400 font-bold hover:text-slate-600"
            >
              Retour à l'aperçu
            </Button>
          </div>
        )}

        <div className="pt-8 text-center border-t border-slate-200">
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" />
            Signature électronique sécurisée conforme eIDAS
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

