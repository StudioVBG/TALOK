"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  ShieldCheck,
  ClipboardCheck,
  Sparkles,
  PartyPopper,
  ArrowRight,
  PenTool,
  Key,
  Euro,
  Zap,
  Clock,
  Send,
  Bell
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
import { Celebration, useCelebration } from "@/components/ui/celebration";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LeaseEdlTab } from "./tabs/LeaseEdlTab";
import { LeaseDocumentsTab } from "./tabs/LeaseDocumentsTab";
import { LeasePaymentsTab } from "./tabs/LeasePaymentsTab";

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

/**
 * SSOT 2026 — Config des statuts alignée avec la CHECK DB.
 * Seuls les statuts réellement écrits par l'API sont listés.
 * Migration : 20260108400000_lease_lifecycle_sota2026.sql
 */
const STATUS_CONFIG: Record<string, { label: string; color: string; description?: string }> = {
  draft: {
    label: "Brouillon",
    color: "bg-slate-100 text-slate-700 border-slate-300",
    description: "Le bail est en cours de rédaction",
  },
  pending_signature: {
    label: "Signature en attente",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    description: "En attente de toutes les signatures",
  },
  partially_signed: {
    label: "Partiellement signé",
    color: "bg-orange-100 text-orange-700 border-orange-300",
    description: "Certaines parties ont signé",
  },
  fully_signed: {
    label: "Signé - EDL requis",
    color: "bg-indigo-100 text-indigo-700 border-indigo-300",
    description: "Bail entièrement signé. Un état des lieux d'entrée est requis pour activer le bail.",
  },
  active: {
    label: "Actif",
    color: "bg-green-100 text-green-700 border-green-300",
    description: "Le bail est en cours",
  },
  terminated: {
    label: "Terminé",
    color: "bg-slate-100 text-slate-600 border-slate-300",
    description: "Le bail est terminé",
  },
  archived: {
    label: "Archivé",
    color: "bg-gray-200 text-gray-600 border-gray-300",
    description: "Le bail est archivé",
  },
  cancelled: {
    label: "Annulé",
    color: "bg-red-100 text-red-600 border-red-300",
    description: "Le bail a été annulé",
  },
};

export function LeaseDetailsClient({ details, leaseId, ownerProfile }: LeaseDetailsClientProps) {
  const { lease, property, signers, payments, invoices, documents, edl } = details;
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
  
  // ✅ SOTA 2026: Hook de célébration
  const { celebrate, celebrationProps } = useCelebration();
  
  const [activationCheck, setActivationCheck] = useState<{
    can_activate: boolean;
    can_force_activate: boolean;
    missing_conditions: string[];
    edl?: { id: string; status: string } | null;
  } | null>(null);

  // ✅ SSOT 2026: Onglet actif — auto-switch vers EDL quand bail fully_signed
  const defaultTab = useMemo(() => {
    if (lease.statut === "fully_signed") return "edl";
    return "contrat";
  }, [lease.statut]);
  const [activeTab, setActiveTab] = useState(defaultTab);

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

  // ✅ SOTA 2026: Détection robuste des signataires (gère toutes les variantes de rôles)
  const mainTenant = signers?.find((s: any) => {
    const role = (s.role || '').toLowerCase();
    return role === 'locataire_principal' || role === 'locataire' || role === 'tenant' || role === 'principal';
  });
  const ownerSigner = signers?.find((s: any) => {
    const role = (s.role || '').toLowerCase();
    return role === 'proprietaire' || role === 'owner' || role === 'bailleur';
  });
  
  // ✅ SOTA 2026: Logique corrigée - Le propriétaire peut signer dès que le locataire a signé
  const needsOwnerSignature = useMemo(() => {
    // Si déjà fully_signed, active, ou terminé → pas besoin de signer
    if (["fully_signed", "active", "terminated", "archived"].includes(lease.statut)) {
      return false;
    }
    // Si le propriétaire a déjà signé → pas besoin
    if (ownerSigner?.signature_status === "signed") {
      return false;
    }
    // Le locataire principal doit avoir signé en premier
    return mainTenant?.signature_status === "signed";
  }, [lease.statut, mainTenant?.signature_status, ownerSigner?.signature_status]);

  // ✅ SOTA 2026: Utiliser les données pré-calculées par fetchLeaseDetails (SSOT)
  // edl est un OBJET unique (ou null), PAS un tableau !
  const hasEdl = useMemo(() => {
    // Si c'est un objet unique (nouveau format SOTA 2026)
    if (edl && typeof edl === "object" && !Array.isArray(edl)) {
      return true;
    }
    // Fallback legacy: Si c'est un tableau (ancien format)
    if (Array.isArray(edl)) {
      return edl.length > 0;
    }
    return false;
  }, [edl]);
  
  // ✅ SOTA 2026: Priorité aux données pré-calculées dans lease.has_signed_edl
  const hasSignedEdl = useMemo(() => {
    // 1. Utiliser la valeur pré-calculée par fetchLeaseDetails (SSOT)
    if (typeof (lease as any).has_signed_edl === "boolean") {
      return (lease as any).has_signed_edl;
    }
    // 2. Fallback: edl est un OBJET unique (nouveau format)
    if (edl && typeof edl === "object" && !Array.isArray(edl)) {
      return edl.status === "signed" || edl.status === "completed";
    }
    // 3. Fallback legacy: Si c'est un tableau
    if (Array.isArray(edl)) {
      const entryEdl = edl.find((e: any) => e.type === "entree");
      return entryEdl?.status === "signed" || entryEdl?.status === "completed";
    }
    return false;
  }, [lease, edl]);

  // Données bail au format wizard EDL (pour le mode inline)
  const wizardLease = useMemo(() => {
    const tenantName = signers
      ?.filter((s: any) => {
        const role = (s.role || "").toLowerCase();
        return role === "locataire_principal" || role === "locataire" || role === "colocataire";
      })
      .map((s: any) => `${s.profile?.prenom || ""} ${s.profile?.nom || ""}`.trim())
      .filter(Boolean)
      .join(", ") || "Locataire";

    return {
      id: leaseId,
      type_bail: lease.type_bail,
      statut: lease.statut,
      date_debut: lease.date_debut,
      property: {
        id: property.id,
        adresse_complete: property.adresse_complete,
        ville: property.ville,
        code_postal: property.code_postal,
      },
      tenant_name: tenantName,
    };
  }, [leaseId, lease, property, signers]);

  // ✅ SOTA 2026: Priorité aux données pré-calculées dans lease.has_paid_initial
  const hasPaidInitial = useMemo(() => {
    // 1. Utiliser la valeur pré-calculée par fetchLeaseDetails (SSOT)
    if (typeof (lease as any).has_paid_initial === "boolean") {
      return (lease as any).has_paid_initial;
    }
    // 2. Fallback: Vérifier les paiements
    if (!payments || payments.length === 0) return false;
    return payments.some((p: any) => 
      p.statut === "succeeded" || p.statut === "paid"
    );
  }, [lease, payments]);

  // ✅ SOTA 2026: Déterminer l'action prioritaire
  const nextAction = useMemo(() => {
    // 1. En attente de signature locataire
    if (["draft", "sent", "pending_signature"].includes(lease.statut) && mainTenant?.signature_status !== "signed") {
      return {
        type: "waiting_tenant",
        icon: Clock,
        title: "En attente du locataire",
        description: mainTenant?.invited_email 
          ? `${mainTenant.invited_email} n'a pas encore signé`
          : "Le locataire n'a pas encore signé",
        action: null,
        actionLabel: null,
        color: "amber"
      };
    }
    
    // 2. Propriétaire doit signer
    if (needsOwnerSignature) {
      return {
        type: "sign_owner",
        icon: PenTool,
        title: "À votre tour de signer !",
        description: "Le locataire a signé. Signez pour valider le bail.",
        action: () => setShowSignatureModal(true),
        actionLabel: "Signer le bail",
        color: "blue",
        urgent: true
      };
    }
    
    // 3. Bail signé, EDL requis — action contextuelle selon l'état de l'EDL
    if (lease.statut === "fully_signed" && !hasSignedEdl) {
      // 3a. Pas d'EDL → Créer
      if (!edl) {
        return {
          type: "create_edl",
          icon: ClipboardCheck,
          title: "Créer l'état des lieux",
          description: "Le bail est signé. Créez l'EDL d'entrée pour l'activer.",
          href: `/owner/inspections/new?lease_id=${leaseId}&property_id=${property.id}&type=entree`,
          actionLabel: "Créer l'EDL d'entrée",
          color: "indigo"
        };
      }
      // 3b. EDL incomplet (brouillon, planifié, en cours) → Continuer
      if (["draft", "scheduled", "in_progress"].includes(edl.status)) {
        return {
          type: "continue_edl",
          icon: ClipboardCheck,
          title: "Compléter l'état des lieux",
          description: "Un EDL d'entrée est en cours. Complétez-le pour activer le bail.",
          href: `/owner/inspections/${edl.id}`,
          actionLabel: "Continuer l'EDL",
          color: "indigo"
        };
      }
      // 3c. EDL complété mais pas signé → Signer
      if (edl.status === "completed") {
        return {
          type: "sign_edl",
          icon: PenTool,
          title: "Signer l'état des lieux",
          description: "L'EDL est complété. Faites-le signer pour activer le bail.",
          href: `/owner/inspections/${edl.id}`,
          actionLabel: "Signer l'EDL",
          color: "indigo",
          urgent: true
        };
      }
      // 3d. Autre statut (ex: disputed) → Voir l'onglet EDL
      return {
        type: "view_edl",
        icon: ClipboardCheck,
        title: "État des lieux",
        description: "Consultez l'état des lieux d'entrée.",
        action: () => setActiveTab("edl"),
        actionLabel: "Voir l'onglet EDL",
        color: "indigo"
      };
    }
    
    // 4. EDL fait, activer le bail
    if (lease.statut === "fully_signed" && hasSignedEdl) {
      return {
        type: "activate",
        icon: Key,
        title: "Prêt à activer !",
        description: "L'EDL est signé. Activez le bail pour démarrer la location.",
        action: () => handleActivate(false),
        actionLabel: "Activer le bail",
        color: "green"
      };
    }
    
    // 5. Bail actif, premier paiement en attente
    if (lease.statut === "active" && !hasPaidInitial) {
      return {
        type: "awaiting_payment",
        icon: Euro,
        title: "En attente du 1er paiement",
        description: `${formatCurrency(premierVersement)} (loyer + charges + dépôt)`,
        action: null,
        actionLabel: null,
        color: "amber"
      };
    }
    
    // 6. Tout est OK
    if (lease.statut === "active") {
      return {
        type: "all_done",
        icon: CheckCircle,
        title: "Bail actif",
        description: "Tout est en ordre ! Le bail est en cours.",
        action: null,
        actionLabel: null,
        color: "green"
      };
    }
    
    return null;
  }, [lease.statut, mainTenant, needsOwnerSignature, hasSignedEdl, hasPaidInitial, premierVersement, leaseId, property.id, edl]);

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
      
      setShowSignatureModal(false);
      
      // 🎉 SSOT 2026: Célébration après signature réussie + switch onglet EDL
      celebrate({
        title: "Bail signé ! 🎉",
        subtitle: "Toutes les parties ont signé. Prochaine étape : l'état des lieux d'entrée.",
        type: "milestone",
        nextAction: {
          label: "Aller à l'onglet EDL",
          onClick: () => setActiveTab("edl"),
        },
      });
      
      router.refresh();
    } catch (error: unknown) {
      console.error("Erreur signature:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de signer le bail",
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
    } catch (error: unknown) {
      console.error("Erreur suppression:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer le bail",
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
    } catch (error: unknown) {
      console.error("Erreur résiliation:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de résilier le bail",
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
      
      // 🎉 SOTA 2026: Grande célébration - Bail actif !
      celebrate({
        title: "Félicitations ! 🏠",
        subtitle: `Le bail est maintenant actif. La première facture de ${formatCurrency(premierVersement)} a été générée.`,
        type: "complete",
        nextAction: {
          label: "Voir les factures",
          href: `/owner/leases/${leaseId}/invoices`,
        },
      });
      
      router.refresh();
    } catch (error: unknown) {
      console.error("Erreur activation:", error);
      toast({
        title: "Action requise",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-4">
        <Breadcrumb
          items={[
            { label: "Baux & locataires", href: "/owner/leases" },
            { label: `Bail ${property.ville}` }
          ]}
          homeHref="/owner/dashboard"
        />
      </div>

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
            
            {/* Bouton d'activation — désactivé si EDL ou DPE manquant */}
            {canActivate && (
              <Button
                size="sm"
                onClick={() => handleActivate(false)}
                disabled={isActivating || (!hasSignedEdl && dpeStatus?.status !== "VALID")}
                className={hasSignedEdl ? "bg-green-600 hover:bg-green-700 shadow-sm" : "bg-slate-400 cursor-not-allowed shadow-sm"}
                title={!hasSignedEdl ? "L'état des lieux d'entrée doit être réalisé avant d'activer le bail" : !dpeStatus || dpeStatus.status !== "VALID" ? "Le DPE doit être valide avant d'activer le bail" : "Activer le bail"}
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
        {/* 🚀 SOTA 2026: Tracker de progression */}
        <div className="mb-6">
          <LeaseProgressTracker 
            status={lease.statut as LeaseProgressStatus}
            hasSignedEdl={hasSignedEdl}
            hasPaidInitial={hasPaidInitial}
          />
        </div>

        {/* ⚡ SOTA 2026: Carte d'action prioritaire - User First */}
        {nextAction && nextAction.type !== "all_done" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className={`overflow-hidden border-2 ${
              nextAction.color === "blue" ? "border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50" :
              nextAction.color === "green" ? "border-green-300 bg-gradient-to-r from-green-50 to-emerald-50" :
              nextAction.color === "indigo" ? "border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50" :
              nextAction.color === "amber" ? "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50" :
              "border-slate-200"
            }`}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Icône avec animation */}
                  <motion.div
                    animate={nextAction.urgent ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`p-3 rounded-xl ${
                      nextAction.color === "blue" ? "bg-blue-500" :
                      nextAction.color === "green" ? "bg-green-500" :
                      nextAction.color === "indigo" ? "bg-indigo-500" :
                      nextAction.color === "amber" ? "bg-amber-500" :
                      "bg-slate-500"
                    }`}
                  >
                    <nextAction.icon className="h-6 w-6 text-white" />
                  </motion.div>
                  
                  {/* Texte */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-lg font-bold ${
                        nextAction.color === "blue" ? "text-blue-900" :
                        nextAction.color === "green" ? "text-green-900" :
                        nextAction.color === "indigo" ? "text-indigo-900" :
                        nextAction.color === "amber" ? "text-amber-900" :
                        "text-slate-900"
                      }`}>
                        {nextAction.title}
                      </h3>
                      {nextAction.urgent && (
                        <Badge className="bg-blue-600 animate-pulse">
                          <Zap className="h-3 w-3 mr-1" />
                          Action requise
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${
                      nextAction.color === "blue" ? "text-blue-700" :
                      nextAction.color === "green" ? "text-green-700" :
                      nextAction.color === "indigo" ? "text-indigo-700" :
                      nextAction.color === "amber" ? "text-amber-700" :
                      "text-slate-600"
                    }`}>
                      {nextAction.description}
                    </p>
                  </div>
                  
                  {/* Bouton d'action */}
                  {(nextAction.action || nextAction.href) && (
                    <Button
                      size="lg"
                      onClick={nextAction.href ? () => router.push(nextAction.href) : nextAction.action}
                      disabled={isSigning || isActivating}
                      className={`gap-2 shadow-lg ${
                        nextAction.color === "blue" ? "bg-blue-600 hover:bg-blue-700" :
                        nextAction.color === "green" ? "bg-green-600 hover:bg-green-700" :
                        nextAction.color === "indigo" ? "bg-indigo-600 hover:bg-indigo-700" :
                        "bg-slate-600 hover:bg-slate-700"
                      }`}
                    >
                      {(isSigning || isActivating) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {nextAction.actionLabel}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* Pour les actions en attente */}
                  {nextAction.type === "waiting_tenant" && mainTenant?.invited_email && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetch(`/api/leases/${leaseId}/signers/${mainTenant.id}/resend`, { method: "POST" });
                          toast({ title: "✅ Relance envoyée", description: `Un nouvel email a été envoyé à ${mainTenant.invited_email}` });
                        } catch (e) {
                          toast({ title: "Erreur", description: "Impossible d'envoyer la relance", variant: "destructive" });
                        }
                      }}
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Relancer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ✅ SOTA 2026: Message de succès si tout est OK */}
        {nextAction?.type === "all_done" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 bg-green-500 rounded-full">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-900">Bail actif</h3>
                  <p className="text-sm text-green-700">Tout est en ordre ! Le locataire est installé.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Colonne de gauche : Onglets Contrat / EDL / Documents / Paiements */}
          <div className="lg:col-span-8 xl:col-span-9 order-2 lg:order-1 flex flex-col h-[calc(100vh-8rem)]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
              {/* Barre d'onglets */}
              <TabsList className="w-full justify-start bg-white border border-slate-200 rounded-t-xl rounded-b-none h-12 px-2 gap-1">
                <TabsTrigger value="contrat" className="gap-2 data-[state=active]:bg-slate-100">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Contrat</span>
                </TabsTrigger>
                <TabsTrigger
                  value="edl"
                  className="gap-2 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">EDL d&apos;entrée</span>
                  {lease.statut === "fully_signed" && !hasSignedEdl && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                    </span>
                  )}
                  {hasSignedEdl && (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2 data-[state=active]:bg-slate-100">
                  <FolderOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Documents</span>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {documents?.length || 0}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="paiements" className="gap-2 data-[state=active]:bg-slate-100">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Paiements</span>
                </TabsTrigger>
              </TabsList>

              {/* Contenu : Contrat */}
              <TabsContent value="contrat" className="flex-1 mt-0">
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 overflow-hidden flex-1 flex flex-col h-full">
                  {isSealed && signedPdfPath ? (
                    <div className="flex flex-col h-full">
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
                          <Button variant="outline" size="sm" asChild className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                            <a href={`/api/documents/view?path=${encodeURIComponent(signedPdfPath)}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1.5" />
                              Ouvrir
                            </a>
                          </Button>
                          <Button size="sm" asChild className="bg-emerald-600 hover:bg-emerald-700">
                            <a href={`/api/documents/download?path=${encodeURIComponent(signedPdfPath)}&filename=Bail_${leaseId.substring(0, 8).toUpperCase()}.html`} download>
                              <Download className="h-4 w-4 mr-1.5" />
                              Télécharger
                            </a>
                          </Button>
                        </div>
                      </div>
                      <iframe
                        src={`/api/documents/view?path=${encodeURIComponent(signedPdfPath)}`}
                        className="flex-1 w-full border-0"
                        title="Bail de location signé"
                      />
                      <div className="px-4 py-2 border-t bg-slate-50 text-center">
                        <p className="text-xs text-slate-500">
                          <Lock className="h-3 w-3 inline mr-1" />
                          Ce document est légalement scellé et ne peut plus être modifié.
                        </p>
                      </div>
                    </div>
                  ) : isSealed && !signedPdfPath ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-amber-50">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                          <span className="font-medium text-amber-800">PDF signé en cours de génération</span>
                        </div>
                        <span className="text-xs text-amber-600">Aperçu du contrat ci-dessous</span>
                      </div>
                      <LeasePreview typeBail={lease.type_bail as any} bailData={bailData} leaseId={leaseId} />
                    </div>
                  ) : (
                    <LeasePreview typeBail={lease.type_bail as any} bailData={bailData} leaseId={leaseId} />
                  )}
                </div>
              </TabsContent>

              {/* Contenu : EDL d'entrée — padding réduit si wizard inline */}
              <TabsContent value="edl" className="flex-1 mt-0">
                <div className={`bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 overflow-auto h-full ${!edl && lease.statut === "fully_signed" ? "p-2 md:p-4" : "p-6"}`}>
                  <LeaseEdlTab
                    leaseId={leaseId}
                    propertyId={property.id}
                    leaseStatus={lease.statut}
                    edl={edl}
                    hasSignedEdl={hasSignedEdl}
                    wizardLease={wizardLease}
                  />
                </div>
              </TabsContent>

              {/* Contenu : Documents */}
              <TabsContent value="documents" className="flex-1 mt-0">
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 overflow-auto p-6 h-full">
                  <LeaseDocumentsTab
                    leaseId={leaseId}
                    propertyId={property.id}
                    documents={documents || []}
                    dpeStatus={dpeStatus}
                  />
                </div>
              </TabsContent>

              {/* Contenu : Paiements */}
              <TabsContent value="paiements" className="flex-1 mt-0">
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 overflow-auto p-6 h-full">
                  <LeasePaymentsTab
                    leaseId={leaseId}
                    payments={payments || []}
                    invoices={invoices || []}
                    leaseStatus={lease.statut}
                  />
                </div>
              </TabsContent>
            </Tabs>
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
            
            {/* ===== PRÉREQUIS ACTIVATION — Checklist compacte si fully_signed ===== */}
            {canActivate && (
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader className="pb-2 border-b border-slate-50">
                  <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-indigo-500" />
                    Prérequis activation
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  {/* Checklist des prérequis */}
                  <div className="space-y-2">
                    {/* Signatures */}
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 text-emerald-600" />
                      </div>
                      <span className="text-xs text-emerald-700 font-medium">Bail signé par toutes les parties</span>
                    </div>

                    {/* EDL */}
                    <div className="flex items-center gap-2">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center ${hasSignedEdl ? "bg-emerald-100" : "bg-amber-100"}`}>
                        {hasSignedEdl ? (
                          <CheckCircle className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Clock className="h-3 w-3 text-amber-600" />
                        )}
                      </div>
                      <span className={`text-xs font-medium ${hasSignedEdl ? "text-emerald-700" : "text-amber-700"}`}>
                        {hasSignedEdl ? "État des lieux réalisé" : "État des lieux requis"}
                      </span>
                    </div>

                    {/* DPE */}
                    <div className="flex items-center gap-2">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center ${dpeStatus?.status === "VALID" ? "bg-emerald-100" : "bg-red-100"}`}>
                        {dpeStatus?.status === "VALID" ? (
                          <CheckCircle className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="h-3 w-3 text-red-600" />
                        )}
                      </div>
                      <span className={`text-xs font-medium ${dpeStatus?.status === "VALID" ? "text-emerald-700" : "text-red-700"}`}>
                        {dpeStatus?.status === "VALID" ? "DPE conforme" : `DPE ${dpeStatus?.status === "EXPIRED" ? "expiré" : "manquant"}`}
                      </span>
                    </div>
                  </div>

                  {/* Actions contextuelles */}
                  <div className="space-y-2 pt-1">
                    {!hasSignedEdl && (
                      edl ? (
                        <Button
                          size="sm"
                          className="w-full bg-indigo-600 hover:bg-indigo-700"
                          onClick={() => router.push(`/owner/inspections/${edl.id}`)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {["draft", "scheduled", "in_progress"].includes(edl.status) ? "Continuer l'EDL" : "Voir l'EDL"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full bg-indigo-600 hover:bg-indigo-700"
                          onClick={() => router.push(`/owner/inspections/new?lease_id=${leaseId}&property_id=${property.id}&type=entree`)}
                        >
                          <ClipboardCheck className="h-4 w-4 mr-2" />
                          Créer l&apos;EDL d&apos;entrée
                        </Button>
                      )
                    )}

                    {dpeStatus?.status !== "VALID" && (
                      <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50" asChild>
                        <Link href={`/owner/properties/${property.id}/diagnostics`}>
                          <ShieldAlert className="h-4 w-4 mr-2" />
                          Régulariser le DPE
                        </Link>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-slate-500 hover:text-slate-700"
                      onClick={() => handleActivate(true)}
                      disabled={isActivating}
                    >
                      {isActivating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Activer sans EDL (non recommandé)
                    </Button>
                  </div>
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

            {/* Menu de Gestion — Raccourcis onglets + Liens externes */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3 border-b border-slate-50">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Navigation rapide
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 p-2">
                <nav className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("edl")}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md hover:bg-indigo-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                      État des lieux
                    </div>
                    {canActivate && !hasSignedEdl && (
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">Requis</Badge>
                    )}
                    {hasSignedEdl && (
                      <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">Signé</Badge>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("documents")}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <FolderOpen className="h-4 w-4 text-slate-500" />
                      Documents
                    </div>
                    <Badge variant="secondary" className="text-xs">{documents?.length || 0}</Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("paiements")}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-slate-500" />
                      Paiements
                    </div>
                    <Badge variant="secondary" className="text-xs">{payments?.length || 0}</Badge>
                  </button>

                  <div className="h-px bg-slate-100 my-1" />

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

      {/* 🎉 SOTA 2026: Célébration */}
      <Celebration {...celebrationProps} />
    </div>
  );
}
