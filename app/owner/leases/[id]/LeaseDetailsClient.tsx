"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  CalendarOff,
  Lock,
  FileText,
  Download,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  PenTool,
  Key,
  Euro,
  Clock,
  ArrowRight,
  MoreHorizontal,
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
import { LeaseTimeline } from "@/components/owner/leases/LeaseTimeline";
import { Celebration, useCelebration } from "@/components/ui/celebration";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  // Fallback : si dpe_deliverables est vide, utiliser les champs DPE de la propriété
  useEffect(() => {
    async function checkDPE() {
      try {
        const result = await dpeService.getLatestDeliverable(property.id);
        if (result.status !== "MISSING") {
          setDpeStatus(result);
          return;
        }
        // Fallback : vérifier les champs DPE stockés directement sur la propriété
        const propAny = property as any;
        const classeEnergie = propAny.dpe_classe_energie || propAny.energie;
        if (classeEnergie) {
          const isExpired = propAny.dpe_date_validite
            ? new Date(propAny.dpe_date_validite) < new Date()
            : false;
          setDpeStatus({
            status: isExpired ? "EXPIRED" : "VALID",
            data: {
              classe_energie: classeEnergie,
              classe_ges: propAny.dpe_classe_climat || propAny.ges,
              source: "property_fields",
            },
          });
        } else {
          setDpeStatus(result); // MISSING
        }
      } catch (error) {
        console.error("Erreur check DPE:", error);
        // Même en cas d'erreur, essayer le fallback propriété
        const propAny = property as any;
        const classeEnergie = propAny.dpe_classe_energie || propAny.energie;
        if (classeEnergie) {
          setDpeStatus({ status: "VALID", data: { classe_energie: classeEnergie, source: "property_fields_fallback" } });
        }
      }
    }
    checkDPE();
  }, [property]);

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
  // Log de diagnostic en dev pour identifier les problèmes de données
  if (process.env.NODE_ENV === "development" && (!signers || signers.length === 0)) {
    console.warn("[LeaseDetailsClient] ⚠️ Aucun signataire trouvé pour ce bail:", leaseId);
  }
  if (process.env.NODE_ENV === "development" && signers?.length > 0) {
    console.log("[LeaseDetailsClient] Signataires:", signers.map((s: any) => ({ id: s.id, role: s.role, profile_id: s.profile?.id, invited_email: s.invited_email, status: s.signature_status })));
  }

  const mainTenant = signers?.find((s: any) => {
    const role = (s.role || '').toLowerCase();
    return role === 'locataire_principal' || role === 'locataire' || role === 'tenant' || role === 'principal';
  });
  const ownerSigner = signers?.find((s: any) => {
    const role = (s.role || '').toLowerCase();
    return role === 'proprietaire' || role === 'owner' || role === 'bailleur';
  });

  if (process.env.NODE_ENV === "development" && signers?.length > 0 && !mainTenant) {
    console.warn("[LeaseDetailsClient] ⚠️ Signataires présents mais aucun avec rôle locataire. Rôles trouvés:", signers.map((s: any) => s.role));
  }
  
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
          title: "État des lieux requis",
          description: "Le bail est signé. Lancez l'EDL d'entrée pour activer le bail.",
          href: `/owner/inspections/new?lease_id=${leaseId}&property_id=${property.id}&type=entree`,
          actionLabel: "Commencer l'état des lieux",
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
      // ✅ SOTA 2026: Rediriger vers la page du bien pour que le CTA "Créer un bail" soit visible
      // Le revalidatePath côté API a déjà invalidé le cache ISR
      const propertyId = property?.id || result.propertyId;
      if (propertyId) {
        router.push(`/owner/properties/${propertyId}`);
      } else {
        router.push("/owner/leases");
      }
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
            <Link
              href="/owner/leases"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-muted-foreground hover:text-foreground")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
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
            
            {/* Bouton d'activation — grisé tant que les prérequis ne sont pas remplis */}
            {canActivate && (() => {
              const missingItems: string[] = [];
              if (!hasSignedEdl) missingItems.push("État des lieux non réalisé");
              if (dpeStatus?.status !== "VALID") missingItems.push("DPE manquant ou expiré");
              const canActivateNow = missingItems.length === 0;
              return (
                <Button
                  size="sm"
                  onClick={() => handleActivate(false)}
                  disabled={isActivating || !canActivateNow}
                  className={canActivateNow
                    ? "bg-green-600 hover:bg-green-700 shadow-sm"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none border border-slate-200"
                  }
                  title={canActivateNow
                    ? "Activer le bail"
                    : `Prérequis manquants : ${missingItems.join(", ")}`
                  }
                >
                  {isActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Activer le bail
                </Button>
              );
            })()}
            
            {/* Bouton Modifier ou Imprimer/PDF selon l'état */}
            {!isSealed ? (
              <Link
                href={`/owner/leases/${leaseId}/edit`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-white hover:bg-slate-50 border-slate-200")}
              >
                <Edit className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Modifier</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <a 
                  href={`/api/documents/download?path=${encodeURIComponent(signedPdfPath)}&filename=Bail_Complet_${property.ville || 'Logement'}.pdf`}
                  download
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Imprimer / PDF</span>
                  <span className="sm:hidden text-[10px]">PDF</span>
                </a>
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Colonne de gauche : Onglets Contrat / EDL / Documents / Paiements */}
          <div className="lg:col-span-8 xl:col-span-9 order-2 lg:order-1 flex flex-col lg:h-[calc(100vh-8rem)]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-1">
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
                <TabsTrigger
                  value="paiements"
                  className={`gap-2 data-[state=active]:bg-slate-100 ${
                    !["active", "terminated", "archived"].includes(lease.statut) ? "opacity-40 cursor-not-allowed" : ""
                  }`}
                  disabled={!["active", "terminated", "archived"].includes(lease.statut)}
                  title={!["active", "terminated", "archived"].includes(lease.statut) ? "Disponible après activation du bail" : undefined}
                >
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Paiements</span>
                  {!["active", "terminated", "archived"].includes(lease.statut) && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-200 text-slate-400 hidden sm:inline-flex">
                      après activation
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Contenu : Contrat */}
              <TabsContent value="contrat" className="flex-1 mt-0">
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 overflow-hidden flex-1 flex flex-col min-h-[50vh] lg:h-full">
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
                          <a
                            href={`/api/documents/view?path=${encodeURIComponent(signedPdfPath)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-emerald-700 border-emerald-200 hover:bg-emerald-50")}
                          >
                            <ExternalLink className="h-4 w-4 mr-1.5" />
                            Ouvrir
                          </a>
                          <a
                            href={`/api/documents/download?path=${encodeURIComponent(signedPdfPath)}&filename=Bail_${leaseId.substring(0, 8).toUpperCase()}.html`}
                            download
                            className={cn(buttonVariants({ size: "sm" }), "bg-emerald-600 hover:bg-emerald-700")}
                          >
                            <Download className="h-4 w-4 mr-1.5" />
                            Télécharger
                          </a>
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
                      <LeasePreview typeBail={lease.type_bail as any} bailData={bailData} leaseId={leaseId} leaseStatus={lease.statut} />
                    </div>
                  ) : (
                    <LeasePreview typeBail={lease.type_bail as any} bailData={bailData} leaseId={leaseId} leaseStatus={lease.statut} />
                  )}
                </div>
              </TabsContent>

              {/* Contenu : EDL d'entrée */}
              <TabsContent value="edl" className="flex-1 mt-0">
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 lg:overflow-auto p-6 pb-24 md:pb-6 lg:h-full">
                  <LeaseEdlTab
                    leaseId={leaseId}
                    propertyId={property.id}
                    leaseStatus={lease.statut}
                    edl={edl}
                    hasSignedEdl={hasSignedEdl}
                    propertyAddress={property.adresse_complete}
                    propertyCity={property.ville}
                    propertyType={property.type}
                    typeBail={lease.type_bail}
                  />
                </div>
              </TabsContent>

              {/* Contenu : Documents */}
              <TabsContent value="documents" className="flex-1 mt-0">
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 lg:overflow-auto p-6 pb-24 md:pb-6 lg:h-full">
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
                <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 lg:overflow-auto p-6 pb-24 md:pb-6 lg:h-full">
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

            {/* ✅ Bannière action prioritaire */}
            {nextAction && nextAction.actionLabel && (() => {
              const colorMap: Record<string, { border: string; bg: string; iconBg: string; iconText: string; title: string; desc: string; btn: string; btnHover: string }> = {
                amber:  { border: "border-amber-200",   bg: "bg-amber-50/50",   iconBg: "bg-amber-100",   iconText: "text-amber-600",   title: "text-amber-900",   desc: "text-amber-700",   btn: "bg-amber-600",   btnHover: "hover:bg-amber-700" },
                blue:   { border: "border-blue-200",    bg: "bg-blue-50/50",    iconBg: "bg-blue-100",    iconText: "text-blue-600",    title: "text-blue-900",    desc: "text-blue-700",    btn: "bg-blue-600",    btnHover: "hover:bg-blue-700" },
                indigo: { border: "border-indigo-200",  bg: "bg-indigo-50/50",  iconBg: "bg-indigo-100",  iconText: "text-indigo-600",  title: "text-indigo-900",  desc: "text-indigo-700",  btn: "bg-indigo-600",  btnHover: "hover:bg-indigo-700" },
                green:  { border: "border-emerald-200", bg: "bg-emerald-50/50", iconBg: "bg-emerald-100", iconText: "text-emerald-600", title: "text-emerald-900", desc: "text-emerald-700", btn: "bg-emerald-600", btnHover: "hover:bg-emerald-700" },
              };
              const c = colorMap[nextAction.color] || colorMap.indigo;
              const ActionIcon = nextAction.icon;
              return (
                <Card className={`border-2 ${c.border} ${c.bg} overflow-hidden`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full flex-shrink-0 ${c.iconBg}`}>
                        <ActionIcon className={`h-4 w-4 ${c.iconText}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${c.title}`}>
                          {nextAction.title}
                        </p>
                        <p className={`text-xs ${c.desc} mt-0.5`}>
                          {nextAction.description}
                        </p>
                        <div className="mt-3">
                          {nextAction.href ? (
                            <Link
                              href={nextAction.href}
                              className={cn(buttonVariants({ size: "sm" }), `w-full gap-2 ${c.btn} ${c.btnHover} text-white`)}
                            >
                              {nextAction.actionLabel}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : nextAction.action ? (
                            <Button size="sm" onClick={nextAction.action} className={`w-full gap-2 ${c.btn} ${c.btnHover} text-white`}>
                              {nextAction.actionLabel}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* ✅ Checklist d'activation — fusion Conformité + Prérequis */}
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-2 border-b border-slate-50">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  Checklist d&apos;activation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {/* Checklist items */}
                <div className="space-y-2">
                  {/* Signatures */}
                  <div className="flex items-center gap-2">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      ["fully_signed", "active", "terminated", "archived"].includes(lease.statut) ? "bg-emerald-100" : "bg-amber-100"
                    }`}>
                      {["fully_signed", "active", "terminated", "archived"].includes(lease.statut) ? (
                        <CheckCircle className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Clock className="h-3 w-3 text-amber-600" />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      ["fully_signed", "active", "terminated", "archived"].includes(lease.statut) ? "text-emerald-700" : "text-amber-700"
                    }`}>
                      Bail signé par toutes les parties
                    </span>
                  </div>

                  {/* DPE */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${dpeStatus?.status === "VALID" ? "bg-emerald-100" : "bg-red-100"}`}>
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
                    {dpeStatus?.status !== "VALID" && (
                      <Link
                        href={`/owner/properties/${property.id}/diagnostics`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50")}
                      >
                        Régulariser
                      </Link>
                    )}
                  </div>

                  {/* Assurance */}
                  <div className="flex items-center gap-2">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      leaseAnnexes.some(a => a.type === "attestation_assurance") ? "bg-emerald-100" : "bg-slate-100"
                    }`}>
                      {leaseAnnexes.some(a => a.type === "attestation_assurance") ? (
                        <CheckCircle className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Clock className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      leaseAnnexes.some(a => a.type === "attestation_assurance") ? "text-emerald-700" : "text-slate-500"
                    }`}>
                      {leaseAnnexes.some(a => a.type === "attestation_assurance") ? "Assurance habitation reçue" : "Assurance habitation en attente"}
                    </span>
                  </div>

                  {/* EDL */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${hasSignedEdl ? "bg-emerald-100" : "bg-amber-100"}`}>
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
                    {canActivate && !hasSignedEdl && (
                      edl ? (
                        <Link
                          href={`/owner/inspections/${edl.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50")}
                        >
                          {["draft", "scheduled", "in_progress"].includes(edl.status) ? "Continuer" : "Voir"}
                        </Link>
                      ) : (
                        <Link
                          href={`/owner/inspections/new?lease_id=${leaseId}&property_id=${property.id}&type=entree`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50")}
                        >
                          Créer
                        </Link>
                      )
                    )}
                  </div>
                </div>

                {/* Bouton activation forcée */}
                {canActivate && !hasSignedEdl && (
                  <div className="pt-2 border-t border-slate-50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => handleActivate(true)}
                      disabled={isActivating}
                    >
                      {isActivating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Activer sans EDL (non recommandé)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
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
                      <Link
                        href={`/owner/leases/${leaseId}/signers`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full border-dashed")}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Inviter un locataire
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chronologie des événements */}
            <LeaseTimeline
              lease={lease as any}
              signers={(signers || []).map((s: any) => ({
                role: s.role,
                signed_at: s.signed_at,
                profile: s.profile ? { prenom: s.profile.prenom, nom: s.profile.nom } : null,
              }))}
              edl={edl}
              payments={(payments || []).map((p: any) => ({
                created_at: p.created_at,
                statut: p.statut,
                montant: p.montant,
              }))}
            />

            {/* Actions du bail — menu contextuel compact */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-center gap-2 text-xs text-muted-foreground border-dashed">
                  <MoreHorizontal className="h-4 w-4" />
                  Plus d&apos;actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canRenew && (
                  <DropdownMenuItem onClick={() => setShowRenewalWizard(true)} className="text-blue-600 focus:text-blue-700">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Renouveler le bail
                  </DropdownMenuItem>
                )}
                {canTerminate && (
                  <DropdownMenuItem onClick={() => setShowTerminateDialog(true)} className="text-amber-600 focus:text-amber-700">
                    <CalendarOff className="h-4 w-4 mr-2" />
                    Résilier le bail
                  </DropdownMenuItem>
                )}
                {(canRenew || canTerminate) && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-500 focus:text-red-700 focus:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer ce bail
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Dialogs de confirmation (restent au même niveau pour le portail) */}
            <AlertDialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
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

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-red-600">
                    Supprimer définitivement ?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action effacera le bail, l&apos;historique des paiements et tous les documents associés.
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
