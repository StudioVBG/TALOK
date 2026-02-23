"use client";
// @ts-nocheck

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Camera,
  Upload,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import Tesseract from "tesseract.js";

type Step = "intro" | "recto" | "verso" | "processing" | "success" | "error";

function RenewCNIContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leaseId = searchParams.get("lease_id");
  const { toast } = useToast();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("intro");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lease, setLease] = useState<any>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [rectoFile, setRectoFile] = useState<File | null>(null);
  const [rectoPreview, setRectoPreview] = useState<string | null>(null);
  const [versoFile, setVersoFile] = useState<File | null>(null);
  const [versoPreview, setVersoPreview] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [extractedData, setExtractedData] = useState<any>(null);

  useEffect(() => {
    if (!leaseId) {
      setError("ID du bail manquant");
      setLoading(false);
      return;
    }
    fetchLeaseAndProfile();
  }, [leaseId]);

  const fetchLeaseAndProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Non authentifié"); return; }

      const { data: profile } = await supabase
        .from("profiles").select("id").eq("user_id", user.id).single();
      if (!profile) { setError("Profil non trouvé"); return; }
      setProfileId(profile.id);

      const { data: signer } = await supabase
        .from("lease_signers")
        .select("id")
        .eq("lease_id", leaseId!)
        .eq("profile_id", profile.id)
        .in("role", ["locataire_principal", "colocataire"])
        .single();
      if (!signer) {
        setError(
          "Vous n'êtes pas autorisé à renouveler la CNI pour ce bail. Assurez-vous d'être bien locataire de ce logement et d'avoir accepté l'invitation si vous en avez reçu une."
        );
        return;
      }

      const { data: leaseData } = await supabase
        .from("leases")
        .select(`id, type_bail, statut, loyer, date_debut, properties (id, adresse_complete, ville, code_postal, type, dpe_classe_energie, owner_id)`)
        .eq("id", leaseId!).single();
      setLease(leaseData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (side: "recto" | "verso", file: File | null) => {
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Format non supporté", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (side === "recto") {
        setRectoFile(file);
        setRectoPreview(reader.result as string);
      } else {
        setVersoFile(file);
        setVersoPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const performOCR = async (imageData: string): Promise<any> => {
    try {
      const { data: { text, confidence } } = await Tesseract.recognize(imageData, "fra", {
        logger: (m) => {
          if (m.status === "recognizing text") setOcrProgress(Math.round(m.progress * 100));
          setOcrStatus(m.status);
        },
      });
      const result = extractFieldsFromText(text);
      result.ocr_confidence = confidence / 100;
      return result;
    } catch { return { ocr_confidence: 0 }; }
  };

  const extractFieldsFromText = (text: string): any => {
    const normalized = text.toUpperCase();
    const result: any = {};
    const nomMatch = normalized.match(/NOM\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]+)/);
    if (nomMatch) result.nom = nomMatch[1].trim().split(/\s+/)[0];
    const prenomMatch = normalized.match(/PR[EÉ]NOM[S]?\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]+)/);
    if (prenomMatch) result.prenom = prenomMatch[1].trim().split(/\s+/)[0];
    const expiryMatch = normalized.match(/VALABLE\s*JUSQU['\s]?AU\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i);
    if (expiryMatch) {
      const parts = expiryMatch[1].split(/[\.\/-]/);
      if (parts.length === 3) result.date_expiration = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return result;
  };

  const handleSubmit = async () => {
    if (!rectoFile || !versoFile || !leaseId) return;
    setStep("processing");
    setOcrProgress(0);
    try {
      setOcrStatus("Analyse du recto...");
      const ocrData = await performOCR(rectoPreview!);
      setExtractedData(ocrData);

      setOcrStatus("Envoi du recto...");
      const rectoFD = new FormData();
      rectoFD.append("file", rectoFile);
      rectoFD.append("side", "recto");
      rectoFD.append("lease_id", leaseId);
      rectoFD.append("is_renewal", "true");
      rectoFD.append("ocr_data", JSON.stringify(ocrData));
      const r1 = await fetch("/api/tenant/identity/upload", { method: "POST", body: rectoFD });
      if (!r1.ok) throw new Error((await r1.json()).error || "Erreur upload recto");

      setOcrStatus("Envoi du verso...");
      const versoFD = new FormData();
      versoFD.append("file", versoFile);
      versoFD.append("side", "verso");
      versoFD.append("lease_id", leaseId);
      versoFD.append("is_renewal", "true");
      const r2 = await fetch("/api/tenant/identity/upload", { method: "POST", body: versoFD });
      if (!r2.ok) throw new Error((await r2.json()).error || "Erreur upload verso");

      setStep("success");
      toast({ title: "CNI renouvelée", description: "Votre nouvelle CNI a été enregistrée" });
    } catch (err: any) {
      setError(err.message);
      setStep("error");
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (error && step !== "error") return (
    <div className="container mx-auto px-4 py-6 max-w-lg">
      <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      <Link href="/tenant/identity" className={cn(buttonVariants({ variant: "default" }), "mt-4")}><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-lg">
      <div className="mb-6">
        <Link href="/tenant/identity" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3 -ml-2")}><ArrowLeft className="mr-1 h-4 w-4" />Retour</Link>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl"><RefreshCw className="h-6 w-6 text-blue-600" /></div>
          <div><h1 className="text-2xl font-bold">Renouveler ma CNI</h1><p className="text-muted-foreground text-sm">{lease?.properties?.adresse_complete}</p></div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === "intro" && (
          <motion.div key="intro" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader><CardTitle>Renouvellement CNI</CardTitle><CardDescription>Votre ancienne CNI sera archivée.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {["Photographiez le recto", "Photographiez le verso", "Validation automatique"].map((t, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">{i + 1}</div>
                      <p className="font-medium">{t}</p>
                    </div>
                  ))}
                </div>
                <Button onClick={() => setStep("recto")} className="w-full"><Camera className="mr-2 h-4 w-4" />Commencer</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "recto" && (
          <motion.div key="recto" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader><CardTitle>Recto de la CNI</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {rectoPreview ? (
                  <div className="relative"><img src={rectoPreview} alt="Recto" className="w-full rounded-lg border" /><Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => { setRectoFile(null); setRectoPreview(null); }}><X className="h-4 w-4" /></Button></div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"><Upload className="h-10 w-10 text-muted-foreground mb-2" /><span className="text-sm text-muted-foreground">Cliquez pour importer</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileSelect("recto", e.target.files?.[0] || null)} /></label>
                )}
                <div className="flex gap-2"><Button variant="outline" onClick={() => setStep("intro")} className="flex-1">Retour</Button><Button onClick={() => setStep("verso")} disabled={!rectoFile} className="flex-1">Suivant</Button></div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "verso" && (
          <motion.div key="verso" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader><CardTitle>Verso de la CNI</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {versoPreview ? (
                  <div className="relative"><img src={versoPreview} alt="Verso" className="w-full rounded-lg border" /><Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => { setVersoFile(null); setVersoPreview(null); }}><X className="h-4 w-4" /></Button></div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"><Upload className="h-10 w-10 text-muted-foreground mb-2" /><span className="text-sm text-muted-foreground">Cliquez pour importer</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileSelect("verso", e.target.files?.[0] || null)} /></label>
                )}
                <div className="flex gap-2"><Button variant="outline" onClick={() => setStep("recto")} className="flex-1">Retour</Button><Button onClick={handleSubmit} disabled={!versoFile} className="flex-1">Valider</Button></div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "processing" && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" /><h3 className="text-lg font-semibold mb-2">Traitement...</h3><p className="text-muted-foreground mb-4">{ocrStatus}</p><Progress value={ocrProgress} className="h-2" /></CardContent></Card>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card><CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><CheckCircle className="h-8 w-8 text-green-600" /></div>
              <h3 className="text-xl font-semibold mb-2">CNI renouvelée !</h3>
              {extractedData?.date_expiration && <p className="text-muted-foreground mb-4">Expire le: {extractedData.date_expiration}</p>}
              <Link href="/tenant/identity" className={cn(buttonVariants({ variant: "default" }))}>Retour</Link>
            </CardContent></Card>
          </motion.div>
        )}

        {step === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card><CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-8 w-8 text-red-600" /></div>
              <h3 className="text-xl font-semibold mb-2">Erreur</h3><p className="text-muted-foreground mb-6">{error}</p>
              <div className="flex gap-2 justify-center"><Link href="/tenant/identity" className={cn(buttonVariants({ variant: "outline" }))}>Annuler</Link><Button onClick={() => setStep("intro")}>Réessayer</Button></div>
            </CardContent></Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RenewCNIPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>}><RenewCNIContent /></Suspense>;
}

