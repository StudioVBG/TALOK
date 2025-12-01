"use client";
// @ts-nocheck

import { useState, useCallback } from "react";
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
  AlertCircle,
  Smartphone,
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
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { CNIScanner } from "./CNIScanner";

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
    adresseActuelle: "",
    situationPro: "",
    revenus: "",
  });
  const [hasReadLease, setHasReadLease] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Vérification identité simulée (CNI scan)
  const handleIdentityVerification = useCallback(async () => {
    setIsSubmitting(true);
    
    // Simuler le scan de CNI
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simuler des données extraites
    const extractedData = {
      nom: "MARTIN",
      prenom: "Marie",
      dateNaissance: "1990-05-15",
      lieuNaissance: "Lyon",
      nationalite: "Française",
    };
    
    setProfileData(prev => ({
      ...prev,
      ...extractedData,
    }));
    
    setIdentityVerified(true);
    setIsSubmitting(false);
    
    toast({
      title: "✅ Identité vérifiée",
      description: "Vos informations ont été extraites automatiquement",
    });
    
    // Passer à l'étape suivante
    setCurrentStep(2);
  }, [toast]);

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

  // Envoyer le code OTP
  const handleSendOtp = async () => {
    if (!profileData.telephone) {
      toast({
        title: "Téléphone requis",
        description: "Veuillez renseigner votre numéro de téléphone",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/signature/${token}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: profileData.telephone }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'envoi du code");
      }

      setOtpSent(true);
      toast({
        title: "📱 Code envoyé",
        description: `Un code de vérification a été envoyé au ${profileData.telephone}`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le code SMS",
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
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de signer le bail",
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
                          onClick={() => {
                            setIdentityMethod("france_identite");
                            // TODO: Intégrer France Identité
                            toast({
                              title: "France Identité",
                              description: "Cette fonctionnalité sera bientôt disponible",
                            });
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
                    <Button
                      variant="ghost"
                      onClick={() => setCniStep(cniStep === "verso" ? "recto" : "choose")}
                      className="w-full gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Retour
                    </Button>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom *</Label>
                      <Input
                        value={profileData.nom}
                        onChange={(e) => handleProfileUpdate("nom", e.target.value)}
                        placeholder="MARTIN"
                        className={identityVerified ? "bg-slate-50" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Prénom *</Label>
                      <Input
                        value={profileData.prenom}
                        onChange={(e) => handleProfileUpdate("prenom", e.target.value)}
                        placeholder="Marie"
                        className={identityVerified ? "bg-slate-50" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date de naissance *</Label>
                      <Input
                        type="date"
                        value={profileData.dateNaissance}
                        onChange={(e) => handleProfileUpdate("dateNaissance", e.target.value)}
                        className={identityVerified ? "bg-slate-50" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lieu de naissance *</Label>
                      <Input
                        value={profileData.lieuNaissance}
                        onChange={(e) => handleProfileUpdate("lieuNaissance", e.target.value)}
                        placeholder="Lyon"
                        className={identityVerified ? "bg-slate-50" : ""}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Téléphone portable *</Label>
                      <Input
                        type="tel"
                        value={profileData.telephone}
                        onChange={(e) => handleProfileUpdate("telephone", e.target.value)}
                        placeholder="06 12 34 56 78"
                      />
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

              {/* Étape 3: Aperçu du bail */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl font-bold">Aperçu du bail</h2>
                    <p className="text-muted-foreground mt-1">
                      Relisez attentivement le contrat avant de signer
                    </p>
                  </div>

                  {/* Aperçu simplifié */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Contrat de {LEASE_TYPE_LABELS[lease.type_bail]}</h3>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Eye className="h-4 w-4" />
                        Voir le PDF complet
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Bailleur</p>
                        <p className="font-medium">{ownerName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Locataire</p>
                        <p className="font-medium">{profileData.prenom} {profileData.nom}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Loyer mensuel</p>
                        <p className="font-medium">{formatCurrency(lease.loyer)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Charges</p>
                        <p className="font-medium">{formatCurrency(lease.charges_forfaitaires || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Dépôt de garantie</p>
                        <p className="font-medium">{formatCurrency(lease.depot_de_garantie || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date de début</p>
                        <p className="font-medium">{formatDateShort(lease.date_debut)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Checkbox lecture */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Checkbox
                        id="read"
                        checked={hasReadLease}
                        onCheckedChange={(c) => setHasReadLease(c === true)}
                      />
                      <Label htmlFor="read" className="text-sm cursor-pointer">
                        J'ai lu le contrat de bail dans son intégralité
                      </Label>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
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

              {/* Étape 4: Signature */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl font-bold">Signature électronique</h2>
                    <p className="text-muted-foreground mt-1">
                      Signez avec un code de vérification SMS
                    </p>
                  </div>

                  {!otpSent ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-6 w-6 text-blue-600" />
                          <div>
                            <p className="font-medium text-blue-900 dark:text-blue-100">
                              Vérification par SMS
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Un code sera envoyé au {profileData.telephone}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={handleSendOtp}
                        disabled={isSubmitting}
                        className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Envoi en cours...
                          </>
                        ) : (
                          <>
                            <Smartphone className="h-4 w-4" />
                            Envoyer le code de vérification
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-6 w-6 text-green-600" />
                          <div>
                            <p className="font-medium text-green-900 dark:text-green-100">
                              Code envoyé !
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Entrez le code reçu au {profileData.telephone}
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
                        onClick={handleSendOtp}
                        className="text-sm text-blue-600 hover:underline w-full text-center"
                      >
                        Renvoyer le code
                      </button>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    onClick={() => setCurrentStep(3)}
                    className="w-full gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour à l'aperçu
                  </Button>
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

