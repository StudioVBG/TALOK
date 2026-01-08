"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Trash2, 
  Loader2,
  Edit,
  Users,
  FolderOpen,
  CreditCard,
  CheckCircle,
  RefreshCw,
  XCircle,
  CalendarOff,
  Lock,
  FileText,
  Download,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { LeaseRenewalWizard } from "@/features/leases/components/lease-renewal-wizard";
import { useToast } from "@/components/ui/use-toast";
import type { LeaseDetails } from "../../_data/fetchLeaseDetails";
import { LeasePreview } from "@/features/leases/components/lease-preview";
import { formatCurrency } from "@/lib/helpers/format";
import { mapLeaseToTemplate } from "@/lib/mappers/lease-to-template";
import { OwnerSignatureModal } from "./OwnerSignatureModal";
import { dpeService } from "@/features/diagnostics/services/dpe.service";
import { useEffect } from "react";
import { LeaseProgressTracker, type LeaseProgressStatus } from "@/components/owner/leases/LeaseProgressTracker";

interface LeaseDetailsClientProps {
  details: LeaseDetails;
  leaseId: string;
  ownerProfile?: {
    id: string;
    prenom: string;
    nom: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    type?: string;
    raison_sociale?: string;
    forme_juridique?: string;
    siret?: string;
  };
}

// ✅ SOTA 2026: Config des statuts - FLUX COMPLET avec tous les statuts légaux
const STATUS_CONFIG: Record<string, { label: string; color: string; description?: string; icon?: string }> = {
  draft: { 
    label: "Brouillon", 
    color: "bg-slate-100 text-slate-700 border-slate-300", 
    description: "Le bail est en cours de rédaction",
    icon: "📝"
  },
  sent: { 
    label: "Envoyé", 
    color: "bg-blue-100 text-blue-700 border-blue-300", 
    description: "Le bail a été envoyé pour signature",
    icon: "📤"
  },
  pending_signature: { 
    label: "Signature en attente", 
    color: "bg-amber-100 text-amber-700 border-amber-300", 
    description: "En attente de toutes les signatures",
    icon: "⏳"
  },
  partially_signed: { 
    label: "Partiellement signé", 
    color: "bg-orange-100 text-orange-700 border-orange-300", 
    description: "Certaines parties ont signé",
    icon: "✍️"
  },
  pending_owner_signature: { 
    label: "À signer (propriétaire)", 
    color: "bg-blue-100 text-blue-700 border-blue-300", 
    description: "Attente de la signature du propriétaire",
    icon: "🔐"
  },
  fully_signed: { 
    label: "Signé - EDL requis", 
    color: "bg-indigo-100 text-indigo-700 border-indigo-300", 
    description: "Bail entièrement signé. Un état des lieux d'entrée est requis pour activer le bail.",
    icon: "✅"
  },
  active: { 
    label: "Actif", 
    color: "bg-green-100 text-green-700 border-green-300", 
    description: "Le bail est en cours",
    icon: "🏠"
  },
  notice_given: { 
    label: "Congé donné", 
    color: "bg-orange-100 text-orange-700 border-orange-300", 
    description: "Un congé a été donné, préavis en cours",
    icon: "📬"
  },
  amended: { 
    label: "Avenant en cours", 
    color: "bg-purple-100 text-purple-700 border-purple-300", 
    description: "Un avenant au bail est en cours de traitement",
    icon: "📋"
  },
  terminated: { 
    label: "Terminé", 
    color: "bg-slate-100 text-slate-600 border-slate-300", 
    description: "Le bail est terminé",
    icon: "🔚"
  },
  archived: { 
    label: "Archivé", 
    color: "bg-gray-200 text-gray-600 border-gray-300", 
    description: "Le bail est archivé",
    icon: "📦"
  },
};

export function LeaseDetailsClient({ details, leaseId, ownerProfile }: LeaseDetailsClientProps) {
  const { lease, property, signers, payments, documents, edl } = details;
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showRenewalWizard, setShowRenewalWizard] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [dpeStatus, setDpeStatus] = useState<{ status: string; data?: any } | null>(null);
  const [activationCheck, setActivationCheck] = useState<{
    can_activate: boolean;
    can_force_activate: boolean;
    missing_conditions: string[];
    edl?: { id: string; status: string } | null;
  } | null>(null);

  // Charger le statut DPE au chargement
  useEffect(() => {
    async function checkDPE() {
      try {
        const result = await dpeService.getLatestDeliverable(property.id);
        setDpeStatus(result);
      } catch (error) {
        console.error("Erreur check DPE:", error);
      }
    }
    checkDPE();
  }, [property.id]);

  const statusConfig = STATUS_CONFIG[lease.statut] || STATUS_CONFIG.draft;
  
  // ✅ FILTRAGE ET DÉ-DUPLICATION DES DOCUMENTS
  // On ne garde que les annexes contractuelles et on évite les doublons techniques
  const leaseAnnexes = Object.values(
    (documents || [])
      .filter((doc: any) => 
        ["diagnostic_performance", "diagnostic_amiante", "attestation_assurance", "EDL_entree", "annexe_pinel", "etat_travaux", "autre"].includes(doc.type)
      )
      .reduce((acc: Record<string, any>, doc: any) => {
        // Si doublon de type (ex: 2 DPE), on garde le plus récent
        if (!acc[doc.type] || new Date(doc.created_at) > new Date(acc[doc.type].created_at)) {
          acc[doc.type] = doc;
        }
        return acc;
      }, {})
  ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // Vérifier si le bail peut être activé (statut fully_signed)
  const canActivate = lease.statut === "fully_signed";
  
  // ✅ BAIL SCELLÉ : Un bail signé ne peut plus être modifié
  const isSealed = !!(lease as any).sealed_at || ["fully_signed", "active", "terminated", "archived"].includes(lease.statut);
  const signedPdfPath = (lease as any).signed_pdf_path;
  const sealedAt = (lease as any).sealed_at;

  // ✅ SYNCHRONISATION : Les données financières viennent du BIEN (source unique)
  const propAny = property as any;
  
  // Calcul du dépôt max légal selon le type de bail
  const getMaxDepotLegal = (typeBail: string, loyerHC: number): number => {
    switch (typeBail) {
      case "nu":
      case "etudiant":
        return loyerHC * 1;
      case "meuble":
      case "colocation":
        return loyerHC * 2;
      case "mobilite":
        return 0;
      case "saisonnier":
        return loyerHC * 2;
      default:
        return loyerHC;
    }
  };

  // ✅ LIRE depuis le BIEN (source unique SSOT 2026)
  const displayLoyer = lease.loyer ?? propAny?.loyer_hc ?? propAny?.loyer_base ?? 0;
  const displayCharges = lease.charges_forfaitaires ?? propAny?.charges_mensuelles ?? 0;
  const displayDepot = lease.depot_de_garantie ?? getMaxDepotLegal(lease.type_bail, displayLoyer);
  const premierVersement = displayLoyer + displayCharges + displayDepot;

  // Trouver les signataires
  const mainTenant = signers?.find((s: any) => s.role === "locataire_principal");
  const ownerSigner = signers?.find((s: any) => s.role === "proprietaire");
  
  // Vérifier si le propriétaire doit signer
  const needsOwnerSignature = (
    lease.statut === "pending_owner_signature" || 
    (lease.statut === "pending_signature" && mainTenant?.signature_status === "signed" && ownerSigner?.signature_status !== "signed")
  );

  // Construire bailData pour la prévisualisation (via mapper)
  const bailData = mapLeaseToTemplate(details, ownerProfile);

  // Signer le bail en tant que propriétaire avec image de signature
  const handleOwnerSign = async (signatureImage: string) => {
    setIsSigning(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "SES",
          signature_image: signatureImage,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la signature");
      }
      toast({
        title: "✅ Bail signé !",
        description: "Le bail est maintenant actif.",
      });
      setShowSignatureModal(false);
      router.refresh();
    } catch (error: any) {
      console.error("Erreur signature:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de signer le bail",
        variant: "destructive",
      });
      throw error; // Re-throw pour le modal
    } finally {
      setIsSigning(false);
    }
  };

  // Supprimer le bail
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la suppression");
      }
      toast({
        title: "✅ Bail supprimé",
        description: "Le bail et toutes ses données ont été supprimés.",
      });
      router.push("/owner/leases");
      router.refresh();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le bail",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Résilier le bail
  const handleTerminate = async () => {
    setIsTerminating(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termination_date: new Date().toISOString().split("T")[0],
          reason: "Résiliation à l'initiative du propriétaire",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la résiliation");
      }
      toast({
        title: "✅ Bail résilié",
        description: "Le bail a été terminé avec succès.",
      });
      router.refresh();
    } catch (error: any) {
      console.error("Erreur résiliation:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de résilier le bail",
        variant: "destructive",
      });
    } finally {
      setIsTerminating(false);
      setShowTerminateDialog(false);
    }
  };

  // Callback après renouvellement
  const handleRenewalSuccess = (newLeaseId: string) => {
    router.push(`/owner/leases/${newLeaseId}`);
    router.refresh();
  };

  // Peut-on renouveler ou résilier ?
  const canRenew = lease.statut === "active";
  const canTerminate = lease.statut === "active";

  // ===== ACTIVATION DU BAIL =====
  // Vérifier les conditions d'activation
  const checkActivation = async () => {
    try {
      const response = await fetch(`/api/leases/${leaseId}/activate`);
      const data = await response.json();
      if (response.ok) {
        setActivationCheck(data);
      }
    } catch (error) {
      console.error("Erreur vérification activation:", error);
    }
  };

  // Activer le bail
  const handleActivate = async (force = false) => {
    setIsActivating(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force_without_edl: force }),
      });
      const result = await response.json();
      
      if (!response.ok) {
        // Stocker les infos de vérification pour affichage
        setActivationCheck(result);
        throw new Error(result.error || "Impossible d'activer le bail");
      }
      
      toast({
        title: "✅ Bail activé !",
        description: result.warning || "Le bail est maintenant actif.",
      });
      router.refresh();
    } catch (error: any) {
      console.error("Erreur activation:", error);
      toast({
        title: "Action requise",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      {/* Barre supérieure fixe (Header) */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
              <Link href="/owner/leases">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Link>
            </Button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-slate-900 hidden sm:block">
                Bail {property.ville}
              </h1>
              <Badge className={statusConfig.color} variant="outline">
                {statusConfig.label}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {needsOwnerSignature && (
              <Button
                size="sm"
                onClick={() => setShowSignatureModal(true)}
                disabled={isSigning}
                className="bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                {isSigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Signer le bail
              </Button>
            )}
            
            {/* Bouton d'activation - apparaît quand le bail est fully_signed */}
            {canActivate && (
              <Button
                size="sm"
                onClick={() => handleActivate(false)}
                disabled={isActivating}
                className="bg-green-600 hover:bg-green-700 shadow-sm"
              >
                {isActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Activer le bail
              </Button>
            )}
            
            {/* Bouton Modifier ou Imprimer/PDF selon l'état */}
            {!isSealed ? (
              <Button variant="outline" size="sm" asChild className="bg-white hover:bg-slate-50 border-slate-200">
                <Link href={`/owner/leases/${leaseId}/edit`}>
                  <Edit className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Modifier</span>
                </Link>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  asChild
                >
                  <a 
                    href={`/api/documents/download?path=${encodeURIComponent(signedPdfPath)}&filename=Bail_Complet_${property.ville || 'Logement'}.pdf`}
                    download
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Imprimer / PDF</span>
                    <span className="sm:hidden text-[10px]">PDF</span>
                  </a>
              </Button>
                <div className="hidden md:flex items-center gap-1 text-[10px] text-slate-400 font-medium uppercase tracking-wider px-2 py-1 bg-slate-50 rounded border border-slate-100">
                  <Lock className="h-3 w-3" />
                  Scellé
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* 🚀 Tracker de progression SOTA 2026 */}
        <div className="mb-8">
          <LeaseProgressTracker 
            status={lease.statut as LeaseProgressStatus}
            hasSignedEdl={lease.has_signed_edl}
            hasPaidInitial={lease.has_paid_initial}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Colonne de gauche : Document */}
          <div className="lg:col-span-8 xl:col-span-9 order-2 lg:order-1 flex flex-col h-[calc(100vh-8rem)]">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
              
              {/* ✅ BAIL SCELLÉ : Afficher le document final signé */}
              {isSealed && signedPdfPath ? (
                <div className="flex flex-col h-full">
                  {/* Header avec badge scellé */}
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50 to-green-50">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 rounded-full">
                        <Lock className="h-3.5 w-3.5 text-emerald-700" />
                        <span className="text-xs font-semibold text-emerald-700">Document scellé</span>
                      </div>
                      {sealedAt && (
                        <span className="text-xs text-slate-500">
                          le {new Date(sealedAt).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        asChild
                        className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      >
                        <a 
                          href={`/api/documents/view?path=${encodeURIComponent(signedPdfPath)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-1.5" />
                          Ouvrir
                        </a>
                      </Button>
                      <Button 
                        size="sm"
                        asChild
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <a 
                          href={`/api/documents/download?path=${encodeURIComponent(signedPdfPath)}&filename=Bail_${leaseId.substring(0, 8).toUpperCase()}.html`}
                          download
                        >
                          <Download className="h-4 w-4 mr-1.5" />
                          Télécharger
                        </a>
                      </Button>
                    </div>
                  </div>
                  
                  {/* Iframe avec le document signé */}
                  <iframe 
                    src={`/api/documents/view?path=${encodeURIComponent(signedPdfPath)}`}
                    className="flex-1 w-full border-0"
                    title="Bail de location signé"
                  />
                  
                  {/* Footer informatif */}
                  <div className="px-4 py-2 border-t bg-slate-50 text-center">
                    <p className="text-xs text-slate-500">
                      <Lock className="h-3 w-3 inline mr-1" />
                      Ce document est légalement scellé et ne peut plus être modifié.
                    </p>
                  </div>
                </div>
              ) : isSealed && !signedPdfPath ? (
                // Bail scellé mais PDF pas encore généré
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-amber-50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-amber-600" />
                      <span className="font-medium text-amber-800">Document en cours de génération</span>
                    </div>
                  </div>
                  {/* Afficher l'aperçu en attendant */}
                  <LeasePreview 
                    typeBail={lease.type_bail} 
                    bailData={bailData} 
                    leaseId={leaseId}
                  />
                </div>
              ) : (
                // Bail non scellé : Aperçu dynamique modifiable
                <LeasePreview 
                  typeBail={lease.type_bail} 
                  bailData={bailData} 
                  leaseId={leaseId}
                />
              )}
            </div>
          </div>

          {/* Colonne de droite : Contexte & Actions */}
          <div className="lg:col-span-4 xl:col-span-3 order-1 lg:order-2 space-y-6">
            
            {/* ✅ Checklist Conformité Express */}
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-2 border-b border-slate-50">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  Conformité du dossier
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Diagnostic Énergie (DPE)</span>
                  {dpeStatus?.status === "VALID" ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] h-5">✓ Conforme</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px] h-5 animate-pulse">! Manquant</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Assurance Habitation</span>
                  {leaseAnnexes.some(a => a.type === "attestation_assurance") ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] h-5">✓ Reçu</Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 text-[10px] h-5 border-slate-200">En attente</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">État des Lieux (EDL)</span>
                  {leaseAnnexes.some(a => a.type === "EDL_entree") ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] h-5">✓ Réalisé</Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 text-[10px] h-5 border-slate-200">À faire</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* ===== CARTE ACTIVATION - Visible si fully_signed ===== */}
            {canActivate && (
              <Card className="border-2 border-indigo-200 shadow-sm bg-gradient-to-br from-indigo-50 to-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-indigo-900 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-indigo-600" />
                    Bail signé - Prochaine étape
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Alerte DPE manquant/expiré avant activation */}
                  {dpeStatus?.status !== "VALID" && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                      <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-red-900">DPE Non Conforme</p>
                        <p className="text-xs text-red-700 leading-relaxed">
                          Le DPE est {dpeStatus?.status === "EXPIRED" ? "expiré" : "manquant"}. 
                          Il est légalement obligatoire pour louer ce bien.
                        </p>
                        <Button variant="link" size="sm" className="h-auto p-0 text-red-600 text-xs font-bold" asChild>
                          <Link href={`/owner/properties/${property.id}/diagnostics`}>
                            Régulariser maintenant →
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-indigo-700">
                    Toutes les parties ont signé. Pour activer le bail, réalisez l&apos;état des lieux d&apos;entrée.
                  </p>
                  
                  <div className="space-y-2">
                    {edl ? (
                      <Button 
                        asChild
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Link href={`/owner/inspections/${edl.id}`}>
                          <FileText className="h-4 w-4 mr-2" />
                          {["draft", "scheduled", "in_progress"].includes(edl.status) ? "Continuer l'état des lieux" : "Voir l'état des lieux"}
                        </Link>
                      </Button>
                    ) : (
                      <Button 
                        asChild
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Link href={`/owner/inspections/new?lease_id=${leaseId}&type=entree`}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Créer l&apos;état des lieux d&apos;entrée
                        </Link>
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      onClick={() => handleActivate(true)}
                      disabled={isActivating}
                    >
                      {isActivating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Activer sans EDL (non recommandé)
                    </Button>
                  </div>
                  
                  <p className="text-xs text-indigo-500 italic">
                    💡 L&apos;EDL est obligatoire et protège les deux parties en cas de litige.
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Carte Info Rapide */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3 border-b border-slate-50">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Détails Clés
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Loyer mensuel</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(displayLoyer + displayCharges)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(displayLoyer)} HC + {formatCurrency(displayCharges)} charges
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                  <div>
                    <p className="text-xs text-muted-foreground">Dépôt de garantie</p>
                    <p className="text-base font-semibold text-slate-800">{formatCurrency(displayDepot)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">1er versement</p>
                    <p className="text-base font-semibold text-emerald-600">{formatCurrency(premierVersement)}</p>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-slate-50">
                  <p className="text-xs text-muted-foreground mb-2">Locataire</p>
                  {mainTenant ? (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                        {mainTenant.profile?.prenom?.[0]}{mainTenant.profile?.nom?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{mainTenant.profile?.prenom} {mainTenant.profile?.nom}</p>
                        <Badge variant="secondary" className="text-[10px] h-5">Principal</Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm italic text-muted-foreground">En attente d&apos;invitation</p>
                      <Button variant="outline" size="sm" asChild className="w-full border-dashed">
                        <Link href={`/owner/leases/${leaseId}/signers`}>
                           <Users className="h-4 w-4 mr-2" />
                           Inviter un locataire
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ✅ NOUVEAU : Bloc Annexes & Documents */}
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Annexes Contractuelles
                </CardTitle>
                <Badge variant="outline" className="text-[10px] bg-slate-50">
                  {leaseAnnexes.length}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {/* Alert DPE dans la liste des documents */}
                {dpeStatus?.status !== "VALID" && (
                  <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-amber-100 flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-900">DPE {dpeStatus?.status === "EXPIRED" ? "Expiré" : "Manquant"}</p>
                        <p className="text-[10px] text-amber-700 font-medium">Obligatoire pour le bail</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] bg-white border-amber-200 hover:bg-amber-100" asChild>
                      <Link href={`/owner/properties/${property.id}/diagnostics`}>Régulariser</Link>
                    </Button>
                  </div>
                )}

                {leaseAnnexes.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {leaseAnnexes.slice(0, 5).map((doc: any) => {
                      // Formater le libellé pour éviter les noms techniques
                      const getDocLabel = (d: any) => {
                        if (d.title) return d.title;
                        const labels: Record<string, string> = {
                          diagnostic_performance: "DPE (Énergie)",
                          diagnostic_amiante: "Diagnostic Amiante",
                          attestation_assurance: "Attestation Assurance",
                          EDL_entree: "État des Lieux d'entrée",
                          annexe_pinel: "Annexe Loi Pinel",
                          etat_travaux: "État des travaux",
                          autre: d.name || "Document annexe"
                        };
                        return labels[d.type] || d.type;
                      };

                      return (
                        <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-slate-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate pr-2">
                                {getDocLabel(doc)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" asChild>
                            <a href={`/api/documents/view?path=${encodeURIComponent(doc.storage_path)}`} target="_blank">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      );
                    })}
                    {leaseAnnexes.length > 5 && (
                      <Link 
                        href={`/owner/documents?lease_id=${leaseId}`}
                        className="block w-full text-center py-2 text-[10px] font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Voir les {leaseAnnexes.length - 5} autres annexes
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <FolderOpen className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Aucune annexe contractuelle jointe</p>
                  </div>
                )}
                <div className="p-3 bg-slate-50 border-t border-slate-100">
                  <Button variant="outline" size="sm" className="w-full text-[10px] h-8 border-dashed" asChild>
                    <Link href={`/owner/documents?lease_id=${leaseId}`}>
                      <FolderOpen className="h-3 w-3 mr-2" />
                      Gérer le dossier et les pièces d&apos;identité
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Menu de Gestion */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3 border-b border-slate-50">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Gestion
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 p-2">
                <nav className="space-y-1">
                  <Link 
                    href={`/owner/leases/${leaseId}/signers`}
                    className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-slate-500" />
                      Signataires
                    </div>
                    <div className="flex items-center gap-2">
                      {lease.statut === "pending_signature" && signers?.some((s: any) => s.signature_status === "signed") && (
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Signatures en cours" />
                      )}
                    <Badge variant="secondary" className="text-xs">{signers?.length || 0}</Badge>
                    </div>
                  </Link>
                  
                  <Link 
                    href={`/owner/inspections?lease_id=${leaseId}`}
                    className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-slate-500" />
                      État des lieux
                    </div>
                    {canActivate && (
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">Requis</Badge>
                    )}
                  </Link>

                  <Link 
                    href={`/owner/documents?lease_id=${leaseId}`}
                    className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FolderOpen className="h-4 w-4 text-slate-500" />
                      Documents
                    </div>
                    <Badge variant="secondary" className="text-xs">{documents?.length || 0}</Badge>
                  </Link>

                  <Link 
                    href={`/owner/money?lease_id=${leaseId}`}
                    className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-slate-500" />
                      Paiements
                    </div>
                    <Badge variant="secondary" className="text-xs">{payments?.length || 0}</Badge>
                  </Link>
                </nav>

                {/* Actions de cycle de vie */}
                {(canRenew || canTerminate) && (
                  <div className="mt-4 pt-4 border-t border-slate-50 px-2 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      Cycle de vie
                    </p>
                    
                    {canRenew && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                        onClick={() => setShowRenewalWizard(true)}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Renouveler le bail
                      </Button>
                    )}
                    
                    {canTerminate && (
                      <AlertDialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full justify-start text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                          >
                            <CalendarOff className="h-4 w-4 mr-2" />
                            Résilier le bail
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-amber-600 flex items-center gap-2">
                              <CalendarOff className="h-5 w-5" />
                              Résilier ce bail ?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action mettra fin au bail. Le locataire sera notifié et 
                              le processus de fin de bail (EDL, restitution dépôt) sera initié.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isTerminating}>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleTerminate}
                              disabled={isTerminating}
                              className="bg-amber-600 hover:bg-amber-700"
                            >
                              {isTerminating ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Résiliation...
                                </>
                              ) : (
                                "Confirmer la résiliation"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-50 px-2">
                  <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer ce bail
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600">
                          Supprimer définitivement ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action effacera le bail, l'historique des paiements et tous les documents associés.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {isDeleting ? "Suppression..." : "Supprimer"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {/* Wizard de renouvellement */}
      <LeaseRenewalWizard
        leaseId={leaseId}
        open={showRenewalWizard}
        onOpenChange={setShowRenewalWizard}
        onSuccess={handleRenewalSuccess}
      />

      {/* Modal de signature propriétaire */}
      <OwnerSignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSign={handleOwnerSign}
        leaseInfo={{
          id: leaseId,
          typeBail: lease.type_bail,
          loyer: displayLoyer,
          charges: displayCharges,
          propertyAddress: property.adresse_complete || `${property.numero_rue || ""} ${property.nom_rue || ""}`.trim(),
          propertyCity: property.ville || "",
          tenantName: mainTenant?.profile ? `${mainTenant.profile.prenom || ""} ${mainTenant.profile.nom || ""}`.trim() : undefined,
          dateDebut: lease.date_debut,
        }}
        ownerName={ownerProfile ? `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim() : ""}
      />
    </div>
  );
}
