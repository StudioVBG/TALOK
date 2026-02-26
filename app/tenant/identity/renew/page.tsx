"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { extractMRZFromOCR } from "@/lib/identity/mrz-parser";

type Step = "verify_2fa" | "intro" | "recto" | "verso" | "processing" | "success" | "error";

interface LeaseData {
  id: string;
  type_bail: string;
  statut: string;
  properties: {
    adresse_complete: string;
    ville: string;
  } | null;
}

interface OcrExtractedData {
  nom?: string;
  prenom?: string;
  date_naissance?: string;
  date_expiration?: string;
  numero_document?: string;
  sexe?: string;
  ocr_confidence?: number;
  mrz_valid?: boolean;
}

function RenewCNIContent() {
  const searchParams = useSearchParams();
  const leaseId = searchParams.get("lease_id");
  const redirectTo = searchParams.get("redirect_to");
  const verified2fa = searchParams.get("verified_2fa") === "true";
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(verified2fa ? "intro" : "verify_2fa");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lease, setLease] = useState<LeaseData | null>(null);
  const [rectoFile, setRectoFile] = useState<File | null>(null);
  const [rectoPreview, setRectoPreview] = useState<string | null>(null);
  const [versoFile, setVersoFile] = useState<File | null>(null);
  const [versoPreview, setVersoPreview] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [extractedData, setExtractedData] = useState<OcrExtractedData | null>(null);
  const [twoFaToken, setTwoFaToken] = useState<string | null>(null);
  const [twoFaMaskedEmail, setTwoFaMaskedEmail] = useState<string | null>(null);
  const [showOtpFallback, setShowOtpFallback] = useState(false);
  const [twoFaOtp, setTwoFaOtp] = useState("");
  const [twoFaSending, setTwoFaSending] = useState(false);
  const [twoFaVerifying, setTwoFaVerifying] = useState(false);

  const fetchLeaseAndProfile = useCallback(async () => {
    if (!leaseId) {
      setError("ID du bail manquant");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/tenant/identity/check-access?lease_id=${encodeURIComponent(leaseId)}`);
      const data = await res.json();

      if (!data.authorized) {
        setError(data.reason || "Accès non autorisé");
        return;
      }

      if (data.lease) {
        setLease(data.lease);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    fetchLeaseAndProfile();
  }, [fetchLeaseAndProfile]);

  useEffect(() => {
    if (verified2fa && step === "verify_2fa") setStep("intro");
  }, [verified2fa, step]);

  const handleRequest2Fa = async () => {
    if (!leaseId) return;
    setTwoFaSending(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/identity/request-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lease_id: leaseId, action: "renew" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = (data.error as string) || "Erreur envoi du code";
        const failedDetails = Array.isArray(data.channels_failed) && data.channels_failed.length > 0
          ? data.channels_failed.map((f: { channel: string; error: string }) => `${f.channel}: ${f.error}`).join(". ")
          : "";
        setError(errMsg);
        toast({
          title: "Erreur",
          description: failedDetails ? `${errMsg} (${failedDetails})` : errMsg,
          variant: "destructive",
        });
        return;
      }
      setTwoFaToken((data.token as string) || null);
      setTwoFaMaskedEmail((data.masked_email as string) || null);
      const successMsg = data.message as string || "Code envoyé";
      const channelsFailed = data.channels_failed as { channel: string; error: string }[] | undefined;
      const hasPartialFailure = Array.isArray(channelsFailed) && channelsFailed.length > 0;
      toast({
        title: "Email envoyé",
        description: hasPartialFailure
          ? `${successMsg}. Un canal n'a pas fonctionné : ${channelsFailed.map((f) => f.channel).join(", ")}.`
          : "Cliquez sur le lien dans l'email pour continuer.",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'envoyer le code",
        variant: "destructive",
      });
    } finally {
      setTwoFaSending(false);
    }
  };

  const handleVerify2Fa = async () => {
    if (!twoFaToken || twoFaOtp.length !== 6) {
      toast({ title: "Code invalide", description: "Saisissez les 6 chiffres reçus.", variant: "destructive" });
      return;
    }
    setTwoFaVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/identity/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: twoFaToken, otp_code: twoFaOtp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.error as string) || "Code incorrect");
      const redirectUrl = data.redirect_url as string | undefined;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      setStep("intro");
      toast({ title: "Vérification réussie" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Code incorrect", variant: "destructive" });
    } finally {
      setTwoFaVerifying(false);
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

  const performOCR = async (imageData: string, side: "recto" | "verso" = "recto"): Promise<OcrExtractedData> => {
    try {
      const { data: { text, confidence } } = await Tesseract.recognize(imageData, "fra", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setOcrProgress(Math.round(m.progress * 100));
          setOcrStatus(m.status);
        },
      });

      // Tenter l'extraction MRZ sur le verso (nouvelle CNI post-2021)
      if (side === "verso") {
        const mrzData = extractMRZFromOCR(text);
        if (mrzData) {
          return {
            nom: mrzData.last_name,
            prenom: mrzData.first_name,
            date_naissance: mrzData.date_of_birth,
            date_expiration: mrzData.expiry_date,
            numero_document: mrzData.document_number,
            sexe: mrzData.sex,
            ocr_confidence: mrzData.is_valid ? 0.95 : confidence / 100,
            mrz_valid: mrzData.is_valid,
          };
        }
      }

      // Fallback : extraction par regex (ancienne CNI ou recto)
      const result = extractFieldsFromText(text);
      result.ocr_confidence = confidence / 100;
      return result;
    } catch {
      return { ocr_confidence: 0 };
    }
  };

  const extractFieldsFromText = (text: string): OcrExtractedData => {
    const normalized = text.toUpperCase();
    const result: OcrExtractedData = {};

    // Nom
    const nomMatch = normalized.match(/NOM\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]+)/);
    if (nomMatch) result.nom = nomMatch[1].trim().split(/\s+/)[0];

    // Prénom
    const prenomMatch = normalized.match(/PR[EÉ]NOM[S]?\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]+)/);
    if (prenomMatch) result.prenom = prenomMatch[1].trim().split(/\s+/)[0];

    // Date d'expiration — couvre "VALABLE JUSQU'AU", "EXPIRE LE", "DATE D'EXPIRATION"
    const expiryPatterns = [
      /VALABLE\s*JUSQU['\s]?AU\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/,
      /EXPIRE?\s*LE\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/,
      /DATE\s*D['\u2019]?\s*EXPIRATION\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/,
    ];
    for (const pattern of expiryPatterns) {
      const match = normalized.match(pattern);
      if (match) {
        const parts = match[1].split(/[\.\/-]/);
        if (parts.length === 3) {
          result.date_expiration = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
        break;
      }
    }

    // Numéro de document
    const docNumMatch = normalized.match(/N[°O]\s*(?:DE\s*)?(?:DOCUMENT|CARTE|CNI)\s*[:\-]?\s*([A-Z0-9]{9,12})/);
    if (docNumMatch) result.numero_document = docNumMatch[1].trim();

    // Date de naissance
    const dobMatch = normalized.match(/N[EÉ]\(?E?\)?\s*LE\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/);
    if (dobMatch) {
      const parts = dobMatch[1].split(/[\.\/-]/);
      if (parts.length === 3) {
        result.date_naissance = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }

    // Sexe
    const sexMatch = normalized.match(/SEXE\s*[:\-]?\s*([MF])/);
    if (sexMatch) result.sexe = sexMatch[1];

    return result;
  };

  const handleSubmit = async () => {
    if (!rectoFile || !versoFile || !leaseId) return;
    setStep("processing");
    setOcrProgress(0);
    try {
      // 1. Analyser le recto (OCR classique)
      setOcrStatus("Analyse du recto...");
      const rectoOcr = await performOCR(rectoPreview!, "recto");

      // 2. Analyser le verso (MRZ prioritaire pour nouvelle CNI)
      setOcrStatus("Analyse du verso (MRZ)...");
      setOcrProgress(0);
      const versoOcr = await performOCR(versoPreview!, "verso");

      // 3. Fusionner les données : priorité MRZ si disponible
      const ocrData: OcrExtractedData = versoOcr.mrz_valid
        ? { ...rectoOcr, ...versoOcr }
        : { ...versoOcr, ...rectoOcr };
      setExtractedData(ocrData);

      // Normaliser les champs pour l'API (numero_document -> numero_cni)
      const normalizedOcrData = {
        ...ocrData,
        numero_cni: ocrData.numero_document || (ocrData as Record<string, unknown>).numero_cni,
      };

      // 4. Upload recto
      setOcrStatus("Envoi du recto...");
      const rectoFD = new FormData();
      rectoFD.append("file", rectoFile);
      rectoFD.append("side", "recto");
      rectoFD.append("lease_id", leaseId);
      rectoFD.append("is_renewal", "true");
      rectoFD.append("ocr_data", JSON.stringify(normalizedOcrData));
      const r1 = await fetch("/api/tenant/identity/upload", { method: "POST", body: rectoFD });
      if (!r1.ok) {
        const errBody = await r1.json().catch(() => ({}));
        throw new Error((errBody.error as string) || "Erreur upload recto");
      }

      // 5. Upload verso (avec ocr_data pour cohérence)
      setOcrStatus("Envoi du verso...");
      const versoFD = new FormData();
      versoFD.append("file", versoFile);
      versoFD.append("side", "verso");
      versoFD.append("lease_id", leaseId);
      versoFD.append("is_renewal", "true");
      versoFD.append("ocr_data", JSON.stringify(normalizedOcrData));
      const r2 = await fetch("/api/tenant/identity/upload", { method: "POST", body: versoFD });
      if (!r2.ok) {
        const errBody = await r2.json().catch(() => ({}));
        throw new Error((errBody.error as string) || "Erreur upload verso");
      }

      setStep("success");
      toast({ title: "CNI renouvelée", description: "Votre nouvelle CNI a été enregistrée" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
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
        {step === "verify_2fa" && (
          <motion.div key="verify_2fa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle>Vérification en deux étapes</CardTitle>
                <CardDescription>Pour renouveler votre CNI, nous devons vérifier votre identité. Un email contenant un lien de vérification vous sera envoyé. Cliquez sur le lien pour continuer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!twoFaToken ? (
                  <Button onClick={handleRequest2Fa} disabled={twoFaSending} className="w-full">
                    {twoFaSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Envoyer le lien par email
                  </Button>
                ) : (
                  <>
                    {!showOtpFallback ? (
                      <>
                        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                          <p className="font-medium">Vérifiez votre boîte mail</p>
                          <p className="text-sm text-muted-foreground">
                            Un email vous a été envoyé{twoFaMaskedEmail ? ` à ${twoFaMaskedEmail}` : ""}. <strong>Cliquez sur le lien dans l&apos;email</strong> pour continuer. Vous pouvez laisser cette page ouverte ou la fermer.
                          </p>
                        </div>
                        <Button variant="outline" onClick={handleRequest2Fa} disabled={twoFaSending} className="w-full">
                          {twoFaSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Renvoyer l&apos;email
                        </Button>
                        <button
                          type="button"
                          onClick={() => setShowOtpFallback(true)}
                          className="text-sm text-muted-foreground hover:text-foreground underline w-full text-center"
                        >
                          Le lien ne fonctionne pas ? Saisir le code
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="otp">Code à 6 chiffres</Label>
                          <Input
                            id="otp"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="000000"
                            value={twoFaOtp}
                            onChange={(e) => setTwoFaOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="text-center text-lg tracking-widest font-mono"
                          />
                        </div>
                        <Button onClick={handleVerify2Fa} disabled={twoFaVerifying || twoFaOtp.length !== 6} className="w-full">
                          {twoFaVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Valider
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleRequest2Fa} disabled={twoFaSending} className="w-full">
                          Renvoyer le code
                        </Button>
                        <button
                          type="button"
                          onClick={() => setShowOtpFallback(false)}
                          className="text-sm text-muted-foreground hover:text-foreground underline w-full text-center"
                        >
                          Retour au message
                        </button>
                      </>
                    )}
                  </>
                )}
                <Link href={redirectTo || "/tenant/identity"} className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-center")}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        )}

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
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rectoPreview} alt="Recto" className="w-full rounded-lg border" />
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => { setRectoFile(null); setRectoPreview(null); }}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                    <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Cliquez pour importer</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileSelect("recto", e.target.files?.[0] || null)} />
                  </label>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("intro")} className="flex-1">Retour</Button>
                  <Button onClick={() => setStep("verso")} disabled={!rectoFile} className="flex-1">Suivant</Button>
                </div>
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
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={versoPreview} alt="Verso" className="w-full rounded-lg border" />
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => { setVersoFile(null); setVersoPreview(null); }}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                    <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Cliquez pour importer</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileSelect("verso", e.target.files?.[0] || null)} />
                  </label>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("recto")} className="flex-1">Retour</Button>
                  <Button onClick={handleSubmit} disabled={!versoFile} className="flex-1">Valider</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "processing" && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card><CardContent className="py-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Traitement...</h3>
              <p className="text-muted-foreground mb-4">{ocrStatus}</p>
              <Progress value={ocrProgress} className="h-2" />
            </CardContent></Card>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card><CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><CheckCircle className="h-8 w-8 text-green-600" /></div>
              <h3 className="text-xl font-semibold mb-2">CNI renouvelée !</h3>
              {extractedData?.date_expiration && <p className="text-muted-foreground mb-4">Expire le: {extractedData.date_expiration}</p>}
              <Link href={redirectTo || "/tenant/identity"} className={cn(buttonVariants({ variant: "default" }))}>
                {redirectTo ? "Retour à la signature" : "Retour"}
              </Link>
            </CardContent></Card>
          </motion.div>
        )}

        {step === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card><CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-8 w-8 text-red-600" /></div>
              <h3 className="text-xl font-semibold mb-2">Erreur</h3>
              <p className="text-muted-foreground mb-6">{error}</p>
              <div className="flex gap-2 justify-center">
                <Link href="/tenant/identity" className={cn(buttonVariants({ variant: "outline" }))}>Annuler</Link>
                <Button onClick={() => setStep("intro")}>Réessayer</Button>
              </div>
            </CardContent></Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RenewCNIPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>}>
      <RenewCNIContent />
    </Suspense>
  );
}
