"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  FileText,
  CheckCircle,
  User,
  CreditCard,
  Fingerprint,
  Eye,
  PenTool,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Building2,
  Euro,
  Calendar,
  Maximize2,
  X,
  Download,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { CNIScanner } from "./CNIScanner";
import { SignaturePad, type SignatureData } from "@/components/signature/SignaturePad";

interface Lease {
  id: string;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  depot_de_garantie: number;
  date_debut: string;
  date_fin?: string;
  tenant_email_pending?: string;
  tenant_name_pending?: string;
  property?: {
    adresse_complete: string;
    code_postal: string;
    ville: string;
    type: string;
    surface: number;
    nb_pieces: number;
    dpe_classe?: string;
  };
}

interface SignatureFlowProps {
  token: string;
  lease: Lease;
  tenantEmail: string;
  ownerName: string;
  propertyAddress: string;
}

// Étapes du processus
const STEPS = [
  { id: 1, title: "Identité", icon: Shield, description: "Vérifiez votre identité" },
  { id: 2, title: "Profil", icon: User, description: "Complétez vos informations" },
  { id: 3, title: "Aperçu", icon: Eye, description: "Relisez le bail" },
  { id: 4, title: "Signature", icon: PenTool, description: "Signez le contrat" },
];

// Labels types de bail
const LEASE_TYPE_LABELS: Record<string, string> = {
  nu: "Location nue",
  meuble: "Location meublée",
  colocation: "Colocation",
  saisonnier: "Location saisonnière",
  mobilite: "Bail mobilité",
  etudiant: "Bail étudiant",
};

export function SignatureFlow({ token, lease, tenantEmail, ownerName, propertyAddress }: SignatureFlowProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Données du locataire
  const [identityMethod, setIdentityMethod] = useState<"cni" | "france_identite" | null>(null);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [cniStep, setCniStep] = useState<"choose" | "recto" | "verso" | "done">("choose");
  const [cniRectoPath, setCniRectoPath] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    nom: lease.tenant_name_pending?.split(" ").slice(1).join(" ") || "",
    prenom: lease.tenant_name_pending?.split(" ")[0] || "",
    email: tenantEmail,
    dateNaissance: "",
    lieuNaissance: "",
    nationalite: "Française",
    telephone: "",
    countryCode: "", // Indicatif pays (auto-détecté ou manuel)
    adresseActuelle: "",
    situationPro: "",
    revenus: "",
  });
  const [detectedTerritory, setDetectedTerritory] = useState<string | null>(null);
  const [hasReadLease, setHasReadLease] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Mode de signature : "otp" (code par email) ou "pad" (tracé au doigt/texte)
  const [signatureMode, setSignatureMode] = useState<"pad" | "otp">("pad");

  // Aperçu du bail A4
  const [leaseHtml, setLeaseHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Charger l'aperçu du bail au démarrage et quand on arrive à l'étape 3
  useEffect(() => {
    const loadPreview = async () => {
      if (currentStep !== 3 || leaseHtml) return;
      
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        console.log("[Preview] Chargement de l'aperçu...");
        // Envoyer les données du profil pour personnaliser l'aperçu
        const response = await fetch(`/api/signature/${token}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nom: profileData.nom,
            prenom: profileData.prenom,
            email: profileData.email,
            telephone: profileData.telephone,
            dateNaissance: profileData.dateNaissance,
            lieuNaissance: profileData.lieuNaissance,
            nationalite: profileData.nationalite,
          }),
        });

        const data = await response.json();
        
        if (response.ok && data.html) {
          console.log("[Preview] ✅ Aperçu chargé");
          setLeaseHtml(data.html);
        } else {
          console.error("[Preview] ❌ Erreur:", data.error);
          setPreviewError(data.error || "Erreur lors du chargement de l'aperçu");
        }
      } catch (error: unknown) {
        console.error("[Preview] ❌ Erreur:", error);
        setPreviewError(error instanceof Error ? error.message : "Erreur de connexion");
      } finally {
        setPreviewLoading(false);
      }
    };

    loadPreview();
  }, [currentStep, token, profileData, leaseHtml]);

  // Rafraîchir l'aperçu avec les nouvelles données profil
  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const response = await fetch(`/api/signature/${token}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: profileData.nom,
          prenom: profileData.prenom,
          email: profileData.email,
          telephone: profileData.telephone,
          dateNaissance: profileData.dateNaissance,
          lieuNaissance: profileData.lieuNaissance,
          nationalite: profileData.nationalite,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.html) {
        setLeaseHtml(data.html);
        setPreviewError(null);
      } else {
        setPreviewError(data.error || "Erreur lors du chargement");
      }
    } catch (error: unknown) {
      console.error("Erreur rafraîchissement aperçu:", error);
      setPreviewError(error instanceof Error ? error.message : "Erreur de connexion");
    } finally {
      setPreviewLoading(false);
    }
  }, [token, profileData]);

  // Mise à jour du profil
  const handleProfileUpdate = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  // Soumettre le profil
  const handleProfileSubmit = async () => {
    // Validation basique
    if (!profileData.nom || !profileData.prenom || !profileData.dateNaissance || !profileData.telephone) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Envoyer les données au serveur
      const response = await fetch(`/api/signature/${token}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profileData,
          identity_method: identityMethod,
          identity_verified: identityVerified,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la sauvegarde du profil");
      }

      toast({
        title: "✅ Profil enregistré",
        description: "Vous pouvez maintenant relire le bail",
      });
      
      setCurrentStep(3);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le profil",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Envoyer le code OTP par email
  const handleSendOtp = async () => {
    const email = (profileData.email || tenantEmail)?.trim();
    if (!email) {
      toast({
        title: "Email requis",
        description: "Veuillez renseigner votre adresse email",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/signature/${token}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi du code");
      }

      setOtpSent(true);
      toast({
        title: "Code envoyé",
        description: data.message ?? "Code envoyé par email",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'envoyer le code",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Signer le bail
  const handleSign = async () => {
    if (!otpCode || otpCode.length < 6) {
      toast({
        title: "Code requis",
        description: "Veuillez entrer le code à 6 chiffres",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/signature/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp_code: otpCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la signature");
      }

      toast({
        title: "🎉 Bail signé !",
        description: "Votre contrat a été signé avec succès",
      });
      
      // Rediriger vers la page de succès
      window.location.href = `/signature/success?lease_id=${lease.id}`;
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de signer le bail",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Signer avec le pad (signature au doigt/texte)
  const handleSignWithPad = async (signatureData: SignatureData) => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/signature/${token}/sign-with-pad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureType: signatureData.type,
          signatureImage: signatureData.data,
          signerName: `${profileData.prenom} ${profileData.nom}`,
          identityVerified: identityVerified,
          identityMethod: identityMethod,
          userAgent: signatureData.metadata.userAgent,
          screenSize: signatureData.metadata.screenSize,
          touchDevice: signatureData.metadata.touchDevice,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la signature");
      }

      const result = await response.json();

      toast({
        title: "🎉 Bail signé !",
        description: "Votre contrat a été signé avec succès",
      });
      
      // Rediriger vers la page de succès
      window.location.href = `/signature/success?lease_id=${lease.id}&proof=${result.proof_id}`;
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de signer le bail",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalRent = lease.loyer + (lease.charges_forfaitaires || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Signez votre bail
          </h1>
          <p className="text-muted-foreground mt-1">
            Invitation de {ownerName}
          </p>
        </div>

        {/* Résumé du bail */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white truncate">
                {lease.property?.adresse_complete || propertyAddress}
              </p>
              <p className="text-sm text-muted-foreground">
                {lease.property?.code_postal} {lease.property?.ville}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Badge variant="secondary">
                  {LEASE_TYPE_LABELS[lease.type_bail] || lease.type_bail}
                </Badge>
                <span className="text-sm font-semibold text-primary flex items-center gap-1">
                  <Euro className="h-3 w-3" />
                  {formatCurrency(totalRent)}/mois
                </span>
                {lease.date_debut && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Début: {formatDateShort(lease.date_debut)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <motion.div
                      initial={false}
                      animate={{
                        scale: isActive ? 1.1 : 1,
                        backgroundColor: isCompleted
                          ? "rgb(34 197 94)"
                          : isActive
                          ? "rgb(59 130 246)"
                          : "rgb(226 232 240)",
                      }}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                        isActive || isCompleted ? "text-white" : "text-slate-500"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </motion.div>
                    <span className={cn(
                      "text-xs mt-1 font-medium hidden sm:block",
                      isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-muted-foreground"
                    )}>
                      {step.title}
                    </span>
                  </div>
                  
                  {index < STEPS.length - 1 && (
                    <div className="flex-1 mx-2 h-0.5 bg-slate-200 dark:bg-slate-700">
                      <motion.div
                        initial={false}
                        animate={{ width: currentStep > step.id ? "100%" : "0%" }}
                        className="h-full bg-green-500"
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              {/* Étape 1: Vérification d'identité */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  {/* Choix de la méthode */}
                  {cniStep === "choose" && (
                    <>
                      <div className="text-center">
                        <h2 className="text-xl font-bold">Vérifiez votre identité</h2>
                        <p className="text-muted-foreground mt-1">
                          Choisissez une méthode de vérification
                        </p>
                      </div>

                      <div className="grid gap-4">
                        {/* Option CNI */}
                        <button
                          type="button"
                          onClick={() => {
                            setIdentityMethod("cni");
                            setCniStep("recto");
                          }}
                          className="p-4 rounded-xl border-2 text-left transition-all border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                              <CreditCard className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">Scanner ma carte d'identité</p>
                              <p className="text-sm text-muted-foreground">
                                Prenez en photo votre CNI (recto + verso)
                              </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </button>

                        {/* Option France Identité */}
                        <button
                          type="button"
                          onClick={async () => {
                            setIdentityMethod("france_identite");
                            try {
                              // Initier le flow FranceConnect pour la vérification d'identité
                              const response = await fetch("/api/auth/france-identite/authorize", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  context: "signature",
                                  callback_url: window.location.href,
                                }),
                              });

                              if (response.ok) {
                                const data = await response.json();
                                if (data.authorization_url) {
                                  // Rediriger vers FranceConnect
                                  window.location.href = data.authorization_url;
                                  return;
                                }
                              }

                              toast({
                                title: "France Identité",
                                description: "Service non disponible. Veuillez réessayer ou utiliser une autre méthode.",
                                variant: "destructive",
                              });
                            } catch {
                              toast({
                                title: "France Identité",
                                description: "Erreur de connexion au service. Veuillez réessayer.",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="p-4 rounded-xl border-2 text-left transition-all border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/50">
                              <Fingerprint className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">France Identité</p>
                              <p className="text-sm text-muted-foreground">
                                Utilisez l'app officielle + NFC
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              Bientôt
                            </Badge>
                          </div>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Scanner CNI - Recto */}
                  {cniStep === "recto" && (
                    <CNIScanner
                      token={token}
                      side="recto"
                      onSuccess={(data) => {
                        setCniRectoPath(data.file_path);
                        // Pré-remplir les données extraites
                        if (data.extracted_data) {
                          setProfileData(prev => ({
                            ...prev,
                            nom: data.extracted_data.nom || prev.nom,
                            prenom: data.extracted_data.prenom || prev.prenom,
                            dateNaissance: data.extracted_data.date_naissance || prev.dateNaissance,
                            lieuNaissance: data.extracted_data.lieu_naissance || prev.lieuNaissance,
                            nationalite: data.extracted_data.nationalite || prev.nationalite,
                          }));
                        }
                        setCniStep("verso");
                        toast({
                          title: "✅ Recto enregistré",
                          description: "Maintenant, scannez le verso de votre CNI",
                        });
                      }}
                    />
                  )}

                  {/* Scanner CNI - Verso */}
                  {cniStep === "verso" && (
                    <CNIScanner
                      token={token}
                      side="verso"
                      onSuccess={(data) => {
                        setIdentityVerified(true);
                        setCniStep("done");
                        toast({
                          title: "✅ Identité vérifiée",
                          description: "Vos informations ont été enregistrées",
                        });
                        // Passer automatiquement à l'étape suivante
                        setCurrentStep(2);
                      }}
                      onSkip={() => {
                        setIdentityVerified(true);
                        setCniStep("done");
                        setCurrentStep(2);
                      }}
                    />
                  )}

                  {/* Bouton retour si dans le scan */}
                  {(cniStep === "recto" || cniStep === "verso") && (
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setCniStep(cniStep === "verso" ? "recto" : "choose")}
                        className="w-full gap-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Retour
                      </Button>
                      {/* Option pour passer l'étape d'identité (dev/test) */}
                      <Button
                        variant="link"
                        onClick={() => {
                          setCniStep("done");
                          setCurrentStep(2);
                        }}
                        className="w-full text-muted-foreground text-sm"
                      >
                        Passer l'étape d'identité (saisie manuelle)
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Étape 2: Profil */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl font-bold">Vos informations</h2>
                    <p className="text-muted-foreground mt-1">
                      {identityVerified ? "Vérifiez et complétez vos informations" : "Renseignez vos informations"}
                    </p>
                  </div>

                  {identityVerified && (
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-green-700 dark:text-green-400">
                        Identité vérifiée - informations pré-remplies
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom *</Label>
                      <Input
                        value={profileData.nom}
                        onChange={(e) => handleProfileUpdate("nom", e.target.value)}
                        placeholder="MARTIN"
                        className={identityVerified ? "bg-slate-50 text-slate-900 dark:text-slate-900" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Prénom *</Label>
                      <Input
                        value={profileData.prenom}
                        onChange={(e) => handleProfileUpdate("prenom", e.target.value)}
                        placeholder="Marie"
                        className={identityVerified ? "bg-slate-50 text-slate-900 dark:text-slate-900" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date de naissance *</Label>
                      <Input
                        type="date"
                        value={profileData.dateNaissance}
                        onChange={(e) => handleProfileUpdate("dateNaissance", e.target.value)}
                        className={identityVerified ? "bg-slate-50 text-slate-900 dark:text-slate-900" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lieu de naissance *</Label>
                      <Input
                        value={profileData.lieuNaissance}
                        onChange={(e) => handleProfileUpdate("lieuNaissance", e.target.value)}
                        placeholder="Lyon"
                        className={identityVerified ? "bg-slate-50 text-slate-900 dark:text-slate-900" : ""}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Téléphone portable *</Label>
                      <div className="flex gap-2">
                        <Select
                          value={profileData.countryCode}
                          onValueChange={(v) => {
                            handleProfileUpdate("countryCode", v);
                            setDetectedTerritory(null); // Réinitialiser la détection auto
                          }}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Pays" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="33">🇫🇷 +33 France</SelectItem>
                            <SelectItem value="596">🇲🇶 +596 Martinique</SelectItem>
                            <SelectItem value="590">🇬🇵 +590 Guadeloupe</SelectItem>
                            <SelectItem value="262">🇷🇪 +262 Réunion</SelectItem>
                            <SelectItem value="594">🇬🇫 +594 Guyane</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="tel"
                          value={profileData.telephone}
                          onChange={(e) => {
                            const phone = e.target.value;
                            handleProfileUpdate("telephone", phone);
                            // Détection automatique du territoire
                            const cleaned = phone.replace(/[^0-9]/g, "");
                            if (cleaned.length >= 4 && !profileData.countryCode) {
                              const prefix = cleaned.substring(0, 4);
                              if (["0696", "0697"].includes(prefix)) {
                                setDetectedTerritory("Martinique (+596)");
                                handleProfileUpdate("countryCode", "596");
                              } else if (["0690", "0691"].includes(prefix)) {
                                setDetectedTerritory("Guadeloupe (+590)");
                                handleProfileUpdate("countryCode", "590");
                              } else if (["0692", "0693"].includes(prefix)) {
                                setDetectedTerritory("Réunion (+262)");
                                handleProfileUpdate("countryCode", "262");
                              } else if (prefix === "0694") {
                                setDetectedTerritory("Guyane (+594)");
                                handleProfileUpdate("countryCode", "594");
                              } else if (cleaned.startsWith("06") || cleaned.startsWith("07")) {
                                setDetectedTerritory("France (+33)");
                                handleProfileUpdate("countryCode", "33");
                              }
                            }
                          }}
                          placeholder="696 12 34 56"
                          className="flex-1"
                        />
                      </div>
                      {detectedTerritory && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Détecté : {detectedTerritory}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Nécessaire pour la signature par SMS
                      </p>
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Adresse actuelle</Label>
                      <Input
                        value={profileData.adresseActuelle}
                        onChange={(e) => handleProfileUpdate("adresseActuelle", e.target.value)}
                        placeholder="12 rue de la Paix, 75002 Paris"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Situation professionnelle</Label>
                      <Select
                        value={profileData.situationPro}
                        onValueChange={(v) => handleProfileUpdate("situationPro", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cdi">CDI</SelectItem>
                          <SelectItem value="cdd">CDD</SelectItem>
                          <SelectItem value="fonctionnaire">Fonctionnaire</SelectItem>
                          <SelectItem value="independant">Indépendant</SelectItem>
                          <SelectItem value="etudiant">Étudiant</SelectItem>
                          <SelectItem value="retraite">Retraité</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Revenus mensuels nets</Label>
                      <Input
                        type="number"
                        value={profileData.revenus}
                        onChange={(e) => handleProfileUpdate("revenus", e.target.value)}
                        placeholder="2500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Retour
                    </Button>
                    <Button
                      onClick={handleProfileSubmit}
                      disabled={isSubmitting}
                      className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          Continuer
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Étape 3: Aperçu du bail - Format A4 identique au propriétaire */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl font-bold">Aperçu du bail</h2>
                    <p className="text-muted-foreground mt-1">
                      Relisez attentivement le contrat avant de signer
                    </p>
                  </div>

                  {/* Barre d'outils */}
                  <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        Bail {LEASE_TYPE_LABELS[lease.type_bail]}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {lease.property?.adresse_complete?.split(",")[0] || propertyAddress.split(",")[0]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshPreview}
                        disabled={previewLoading}
                        className="gap-1"
                      >
                        <RefreshCw className={cn("h-3 w-3", previewLoading && "animate-spin")} />
                        <span className="hidden sm:inline">Rafraîchir</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFullscreenPreview(true)}
                        className="gap-1"
                      >
                        <Maximize2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Plein écran</span>
                      </Button>
                    </div>
                  </div>

                  {/* Zone de prévisualisation A4 */}
                  <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900" style={{ height: "450px" }}>
                    {previewLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 z-10">
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                            Chargement du bail...
                          </p>
                        </div>
                      </div>
                    ) : leaseHtml ? (
                      <iframe
                        ref={iframeRef}
                        srcDoc={leaseHtml}
                        className="w-full h-full border-0 bg-white"
                        title="Prévisualisation du bail"
                        style={{ transform: "scale(0.9)", transformOrigin: "top center", height: "500px" }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="font-medium">{previewError || "Aperçu non disponible"}</p>
                          {previewError?.includes("expiré") && (
                            <p className="text-sm mt-2 text-amber-600">
                              Demandez au propriétaire de vous renvoyer une invitation
                            </p>
                          )}
                          <Button 
                            variant="link" 
                            size="sm" 
                            onClick={refreshPreview}
                            className="mt-2"
                          >
                            Réessayer
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Résumé rapide */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(lease.loyer)}</p>
                      <p className="text-xs text-muted-foreground">Loyer</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <p className="text-lg font-bold">
                        {lease.charges_forfaitaires ? formatCurrency(lease.charges_forfaitaires) : "Incluses"}
                      </p>
                      <p className="text-xs text-muted-foreground">Charges</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <p className="text-lg font-bold">{formatCurrency(lease.depot_de_garantie || 0)}</p>
                      <p className="text-xs text-muted-foreground">Dépôt</p>
                    </div>
                    <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(lease.loyer + (lease.charges_forfaitaires || 0))}
                      </p>
                      <p className="text-xs text-muted-foreground">Total/mois</p>
                    </div>
                  </div>

                  {/* Checkbox lecture */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <Checkbox
                        id="read"
                        checked={hasReadLease}
                        onCheckedChange={(c) => setHasReadLease(c === true)}
                      />
                      <Label htmlFor="read" className="text-sm cursor-pointer">
                        J'ai lu le contrat de bail dans son intégralité
                      </Label>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <Checkbox
                        id="accept"
                        checked={hasAcceptedTerms}
                        onCheckedChange={(c) => setHasAcceptedTerms(c === true)}
                      />
                      <Label htmlFor="accept" className="text-sm cursor-pointer">
                        J'accepte les conditions du bail et je m'engage à les respecter
                      </Label>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      className="gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Retour
                    </Button>
                    <Button
                      onClick={() => setCurrentStep(4)}
                      disabled={!hasReadLease || !hasAcceptedTerms}
                      className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
                    >
                      Passer à la signature
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Dialog Plein Écran pour l'aperçu */}
              <Dialog open={fullscreenPreview} onOpenChange={setFullscreenPreview}>
                <DialogContent className="max-w-[95vw] h-[95vh] p-0 flex flex-col" aria-describedby={undefined}>
                  <DialogHeader className="p-4 border-b shrink-0">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Bail {LEASE_TYPE_LABELS[lease.type_bail]}
                      </DialogTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refreshPreview}
                          disabled={previewLoading}
                          className="gap-1"
                        >
                          <RefreshCw className={cn("h-3 w-3", previewLoading && "animate-spin")} />
                          Rafraîchir
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setFullscreenPreview(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-900 overflow-auto">
                    {leaseHtml ? (
                      <iframe
                        srcDoc={leaseHtml}
                        className="w-full h-full border-0 bg-white"
                        title="Prévisualisation du bail (plein écran)"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Étape 4: Signature */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl font-bold">Signature électronique</h2>
                    <p className="text-muted-foreground mt-1">
                      {signatureMode === "pad" 
                        ? "Dessinez ou tapez votre signature ci-dessous"
                        : "Vérification par code de sécurité"}
                    </p>
                  </div>

                  {/* Mode Signature Pad - AFFICHÉ PAR DÉFAUT */}
                  {signatureMode === "pad" && (
                    <div className="space-y-4">
                      {/* Badge info */}
                      <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <PenTool className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          Signature rapide recommandée
                        </span>
                      </div>

                      <SignaturePad
                        signerName={`${profileData.prenom} ${profileData.nom}`}
                        onSignatureComplete={handleSignWithPad}
                        disabled={isSubmitting}
                      />
                      
                      {/* Lien discret pour changer de méthode */}
                      <div className="text-center pt-2 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-muted-foreground mb-2">
                          Problème avec la signature ?
                        </p>
                        <button
                          type="button"
                          onClick={() => setSignatureMode("otp")}
                          className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center justify-center gap-1 mx-auto"
                        >
                          <FileText className="h-3 w-3" />
                          Signer par code (email)
                        </button>
                      </div>
                      
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(3)}
                        className="w-full gap-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Retour à l'aperçu
                      </Button>
                    </div>
                  )}

                  {/* Mode OTP (code par email) */}
                  {signatureMode === "otp" && !otpSent && (
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() => setSignatureMode("pad")}
                        className="w-full text-sm text-green-600 hover:text-green-700 hover:underline flex items-center justify-center gap-1 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                      >
                        <PenTool className="h-4 w-4" />
                        ← Retour à la signature rapide (recommandé)
                      </button>

                      <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-3">
                          <FileText className="h-6 w-6 text-purple-600" />
                          <div>
                            <p className="font-medium text-purple-900 dark:text-purple-100">
                              Vérification par email
                            </p>
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                              Un code sera envoyé à {profileData.email || tenantEmail}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleSendOtp()}
                        disabled={isSubmitting}
                        className="w-full gap-2 bg-gradient-to-r from-purple-600 to-indigo-600"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Envoi en cours...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4" />
                            Envoyer le code par email
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(3)}
                        className="w-full gap-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Retour à l'aperçu
                      </Button>
                    </div>
                  )}

                  {/* Mode OTP - Code envoyé */}
                  {signatureMode === "otp" && otpSent && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-6 w-6 text-green-600" />
                          <div>
                            <p className="font-medium text-green-900 dark:text-green-100">
                              Code envoyé !
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Entrez le code reçu à {profileData.email || tenantEmail}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Code de vérification (6 chiffres)</Label>
                        <Input
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          className="text-center text-2xl tracking-widest"
                        />
                      </div>

                      <Button
                        onClick={handleSign}
                        disabled={isSubmitting || otpCode.length < 6}
                        className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600 h-12 text-lg"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Signature en cours...
                          </>
                        ) : (
                          <>
                            <PenTool className="h-5 w-5" />
                            Signer le bail
                          </>
                        )}
                      </Button>

                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        className="text-sm text-blue-600 hover:underline w-full text-center"
                      >
                        Renvoyer le code
                      </button>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setOtpSent(false);
                            setOtpCode("");
                          }}
                          className="flex-1 gap-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Changer de méthode
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSignatureMode("pad");
                            setOtpSent(false);
                            setOtpCode("");
                          }}
                          className="flex-1 gap-2 border-green-300 text-green-700 hover:bg-green-50"
                        >
                          <PenTool className="h-4 w-4" />
                          Signature rapide
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer sécurité */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            Signature électronique sécurisée conforme eIDAS
          </p>
        </div>
      </div>
    </div>
  );
}

